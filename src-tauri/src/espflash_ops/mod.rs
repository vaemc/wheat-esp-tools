mod connect;
mod merge;
mod progress;
mod types;

pub use types::*;

use connect::{
    connect_flasher, finish_with_reset, format_flash_size, is_retryable_read_error,
    map_espflash_error, parse_after, parse_before, parse_flash_mode, parse_u32, patch_flash_mode,
    read_baud_candidates,
};
use espflash::flasher::Flasher;
use espflash::image_format::Segment;
use progress::{ProgressEmitter, WriteProgress};
use std::borrow::Cow;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use strum::IntoEnumIterator;
use tauri::WebviewWindow;
use types::{hex_addr, p};

/// 全局串口互斥：任意时刻只允许一个 espflash 任务。
static FLASH_LOCK: Mutex<()> = Mutex::new(());

struct FlashLockGuard {
    _guard: std::sync::MutexGuard<'static, ()>,
}

fn acquire_lock() -> Result<FlashLockGuard, String> {
    match FLASH_LOCK.try_lock() {
        Ok(guard) => Ok(FlashLockGuard { _guard: guard }),
        Err(std::sync::TryLockError::WouldBlock) => Err("ESPFLASH_BUSY".into()),
        Err(std::sync::TryLockError::Poisoned(poisoned)) => {
            // panic 后恢复互斥，避免永久 BUSY
            Ok(FlashLockGuard {
                _guard: poisoned.into_inner(),
            })
        }
    }
}

async fn run_blocking<T, F>(f: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tokio::task::spawn_blocking(f)
        .await
        .map_err(|e| format!("task_join_failed:{e}"))?
}

fn map_job_err(emitter: &ProgressEmitter, err: String) -> String {
    if err != "ESPFLASH_BUSY" {
        emitter.phase_params(
            "error",
            100.0,
            "failed",
            p(&[("error", err.clone())]),
        );
    }
    err
}

fn run_job<T>(
    emitter: &ProgressEmitter,
    f: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    match f() {
        Ok(v) => Ok(v),
        Err(e) => Err(map_job_err(emitter, e)),
    }
}

fn chip_label(chip: espflash::target::Chip) -> String {
    chip.to_string().to_ascii_uppercase()
}

/// espflash `read_flash` 无进度回调；按块读取并拼文件，以便推送进度条。
fn read_flash_with_progress(
    flasher: &mut Flasher,
    offset: u32,
    size: u32,
    save_path: &Path,
    emitter: &ProgressEmitter,
) -> Result<(), String> {
    const PACKET: u32 = 0x1000;
    const MAX_IN_FLIGHT: u32 = 1;
    // 每块 128KiB：进度够细，又不会因每块 MD5 过慢
    const CHUNK: u32 = 128 * 1024;

    let tmp_path = save_path.with_extension("espflash-read.tmp");
    let mut out =
        fs::File::create(save_path).map_err(|e| format!("create_failed:{e}"))?;

    let mut done: u32 = 0;
    let mut last_log_bucket: i32 = -1;

    while done < size {
        let this = (size - done).min(CHUNK);
        let addr = offset.saturating_add(done);

        if let Err(e) = flasher.read_flash(
            addr,
            this,
            PACKET,
            MAX_IN_FLIGHT,
            tmp_path.clone(),
        ) {
            let _ = fs::remove_file(&tmp_path);
            return Err(map_espflash_error(e));
        }

        let chunk = match fs::read(&tmp_path) {
            Ok(c) => c,
            Err(e) => {
                let _ = fs::remove_file(&tmp_path);
                return Err(format!("read_tmp_failed:{e}"));
            }
        };
        if chunk.len() as u32 != this {
            let _ = fs::remove_file(&tmp_path);
            return Err(format!("read_chunk_len:{this}:{}", chunk.len()));
        }
        if let Err(e) = out.write_all(&chunk) {
            let _ = fs::remove_file(&tmp_path);
            return Err(format!("write_failed:{e}"));
        }

        done += this;
        let percent = 20.0 + 75.0 * (done as f64 / size as f64);
        let bucket = (percent / 5.0).floor() as i32;
        // 进度条每块更新；终端约每 5% 打一条
        let to_terminal = done >= size || bucket > last_log_bucket;
        if to_terminal {
            last_log_bucket = bucket;
        }

        emitter.emit(
            "reading",
            percent,
            "readProgress",
            p(&[
                ("addr", hex_addr(offset)),
                ("current", done.to_string()),
                ("total", size.to_string()),
            ]),
            Some(addr),
            Some(done as u64),
            Some(size as u64),
            to_terminal,
        );
    }

    out.flush().map_err(|e| format!("flush_failed:{e}"))?;
    let _ = fs::remove_file(&tmp_path);
    Ok(())
}

fn extract_psram(features: &[String]) -> String {
    for f in features {
        let upper = f.to_ascii_uppercase();
        if let Some(idx) = upper.find("PSRAM") {
            let rest = f[idx..].trim();
            let re_like = rest
                .split_whitespace()
                .skip_while(|w| !w.to_ascii_uppercase().contains("PSRAM"))
                .take(2)
                .collect::<Vec<_>>()
                .join(" ");
            if re_like.to_ascii_uppercase().contains("PSRAM") {
                return re_like.replace(' ', "");
            }
        }
    }
    String::new()
}

#[tauri::command]
pub async fn espflash_list_chips() -> Result<Vec<String>, String> {
    let mut chips: Vec<String> = espflash::target::Chip::iter()
        .map(chip_label)
        .collect();
    chips.sort();
    Ok(chips)
}

#[tauri::command]
pub async fn espflash_write_flash(
    window: WebviewWindow,
    args: WriteFlashArgs,
) -> Result<(), String> {
    run_blocking(move || {
        let _lock = acquire_lock()?;
        let emitter = ProgressEmitter::new(window, args.job_id.clone(), "write");
        run_job(&emitter, || {
            emitter.phase("starting", 0.0, "writeStarting");

            if args.items.is_empty() {
                return Err("no_segments".into());
            }

            let flash_mode = parse_flash_mode(&args.flash_mode);
            let mut segments_data: Vec<(u32, Vec<u8>)> = Vec::with_capacity(args.items.len());

            for item in &args.items {
                let offset = parse_u32(&item.offset)?;
                let mut data =
                    fs::read(&item.path).map_err(|e| format!("read_failed:{}:{e}", item.path))?;
                if data.is_empty() {
                    return Err(format!("empty_file:{}", item.path));
                }
                if let Some(mode) = flash_mode {
                    patch_flash_mode(&mut data, mode);
                }
                // 与 espflash write_bin_to_flash 对齐：长度补齐到 4 字节
                let rem = data.len() % 4;
                if rem != 0 {
                    data.extend(std::iter::repeat(0xFFu8).take(4 - rem));
                }
                emitter.log_key(
                    "segmentInfo",
                    p(&[
                        ("addr", hex_addr(offset)),
                        ("path", item.path.clone()),
                        ("bytes", data.len().to_string()),
                    ]),
                );
                segments_data.push((offset, data));
            }

            let before = parse_before(&args.before);
            let after = parse_after(&args.after);
            let mut flasher = connect_flasher(&args.port, args.baud, before, after, &emitter)?;

            let info = flasher.device_info().map_err(map_espflash_error)?;
            emitter.log_key(
                "chipInfo",
                p(&[
                    ("chip", chip_label(info.chip)),
                    ("flash", format_flash_size(info.flash_size)),
                ]),
            );

            let write_base = if args.erase_all { 35.0 } else { 15.0 };
            let write_span = if args.erase_all { 60.0 } else { 80.0 };

            if args.erase_all {
                emitter.phase("erasing", 15.0, "eraseAllRunning");
                flasher.erase_flash().map_err(map_espflash_error)?;
                emitter.phase("erasing", 30.0, "eraseAllDone");
            }

            let segment_sizes: Vec<u64> = segments_data
                .iter()
                .map(|(_, data)| data.len() as u64)
                .collect();

            let segments: Vec<Segment<'_>> = segments_data
                .iter()
                .map(|(addr, data)| Segment {
                    addr: *addr,
                    data: Cow::Borrowed(data.as_slice()),
                })
                .collect();

            let mut progress =
                WriteProgress::new(&emitter, segment_sizes, write_base, write_span);
            flasher
                .write_bins_to_flash(&segments, &mut progress)
                .map_err(map_espflash_error)?;

            // write_bins_to_flash 内部 finish(..., reboot=true) 已按 after 复位，
            // 再调 reset_after 易在端口抖动时把已成功烧录误报为失败。
            emitter.phase("done", 100.0, "writeDone");
            Ok(())
        })
    })
    .await
}

#[tauri::command]
pub async fn espflash_read_flash(
    window: WebviewWindow,
    args: ReadFlashArgs,
) -> Result<(), String> {
    run_blocking(move || {
        let _lock = acquire_lock()?;
        let emitter = ProgressEmitter::new(window, args.job_id.clone(), "read");
        run_job(&emitter, || {
            emitter.phase("starting", 0.0, "readStarting");

            let offset = parse_u32(&args.offset)?;
            let size_raw = args.size.trim();
            let before = parse_before(&args.before);
            let after = parse_after(&args.after);

            // 读 Flash 对串口更敏感；具体参数见 read_flash_with_progress。
            let baud_list = read_baud_candidates(args.baud);
            let mut last_err = String::from("read_failed");
            let mut size: Option<u32> = None;

            for (attempt, baud) in baud_list.iter().copied().enumerate() {
                if attempt > 0 {
                    emitter.log_key(
                        "readRetryBaud",
                        p(&[
                            ("baud", baud.to_string()),
                            ("error", last_err.clone()),
                        ]),
                    );
                } else if args.baud > baud {
                    emitter.log_key(
                        "readBaudCapped",
                        p(&[
                            ("requested", args.baud.to_string()),
                            ("baud", baud.to_string()),
                        ]),
                    );
                }

                let mut flasher = match connect_flasher(&args.port, baud, before, after, &emitter)
                {
                    Ok(f) => f,
                    Err(e) => {
                        last_err = e;
                        if is_retryable_read_error(&last_err) {
                            continue;
                        }
                        return Err(last_err);
                    }
                };

                let read_size = if let Some(s) = size {
                    s
                } else if size_raw.eq_ignore_ascii_case("ALL") {
                    emitter.phase("reading", 12.0, "detectFlashSize");
                    let detected = match flasher.flash_detect().map_err(map_espflash_error) {
                        Ok(Some(d)) => d,
                        Ok(None) => return Err("flash_size_unknown".into()),
                        Err(e) => {
                            last_err = e;
                            let _ = finish_with_reset(&mut flasher);
                            if is_retryable_read_error(&last_err) {
                                continue;
                            }
                            return Err(last_err);
                        }
                    };
                    let bytes = detected.size();
                    if offset >= bytes {
                        return Err(format!(
                            "offset_oob:{}:{}",
                            hex_addr(offset),
                            format_flash_size(detected)
                        ));
                    }
                    let s = bytes - offset;
                    size = Some(s);
                    s
                } else {
                    let s = parse_u32(size_raw)?;
                    size = Some(s);
                    s
                };

                if read_size == 0 {
                    return Err("zero_size".into());
                }

                if let Some(parent) = PathBuf::from(&args.save_path).parent() {
                    if !parent.as_os_str().is_empty() {
                        fs::create_dir_all(parent).map_err(|e| format!("mkdir_failed:{e}"))?;
                    }
                }

                emitter.emit(
                    "reading",
                    20.0,
                    "readRunning",
                    p(&[
                        ("addr", hex_addr(offset)),
                        ("bytes", read_size.to_string()),
                        ("baud", baud.to_string()),
                    ]),
                    Some(offset),
                    Some(0),
                    Some(read_size as u64),
                    true,
                );

                match read_flash_with_progress(
                    &mut flasher,
                    offset,
                    read_size,
                    Path::new(&args.save_path),
                    &emitter,
                ) {
                    Ok(()) => {
                        let written = fs::metadata(&args.save_path)
                            .map(|m| m.len())
                            .unwrap_or(0);
                        if written == 0 {
                            return Err("empty_read_result".into());
                        }

                        finish_with_reset(&mut flasher)?;
                        emitter.emit(
                            "done",
                            100.0,
                            "readDone",
                            p(&[
                                ("path", args.save_path.clone()),
                                ("bytes", written.to_string()),
                            ]),
                            Some(offset),
                            Some(written),
                            Some(read_size as u64),
                            true,
                        );
                        return Ok(());
                    }
                    Err(e) => {
                        last_err = e;
                        let _ = finish_with_reset(&mut flasher);
                        if is_retryable_read_error(&last_err) {
                            continue;
                        }
                        return Err(last_err);
                    }
                }
            }

            Err(last_err)
        })
    })
    .await
}

#[tauri::command]
pub async fn espflash_erase_flash(
    window: WebviewWindow,
    args: EraseFlashArgs,
) -> Result<(), String> {
    run_blocking(move || {
        let _lock = acquire_lock()?;
        let emitter = ProgressEmitter::new(window, args.job_id.clone(), "erase");
        run_job(&emitter, || {
            emitter.phase("starting", 0.0, "eraseStarting");

            let before = parse_before(&args.before);
            let after = parse_after(&args.after);
            let mut flasher = connect_flasher(&args.port, args.baud, before, after, &emitter)?;

            emitter.phase("erasing", 25.0, "eraseAllRunning");
            flasher.erase_flash().map_err(map_espflash_error)?;

            finish_with_reset(&mut flasher)?;
            emitter.phase("done", 100.0, "eraseAllDone");
            Ok(())
        })
    })
    .await
}

#[tauri::command]
pub async fn espflash_erase_region(
    window: WebviewWindow,
    args: EraseRegionArgs,
) -> Result<(), String> {
    run_blocking(move || {
        let _lock = acquire_lock()?;
        let emitter = ProgressEmitter::new(window, args.job_id.clone(), "erase_region");
        run_job(&emitter, || {
            emitter.phase("starting", 0.0, "eraseRegionStarting");

            let offset = parse_u32(&args.offset)?;
            let size = parse_u32(&args.size)?;
            if size == 0 {
                return Err("zero_size".into());
            }

            let before = parse_before(&args.before);
            let after = parse_after(&args.after);
            let mut flasher = connect_flasher(&args.port, args.baud, before, after, &emitter)?;

            emitter.emit(
                "erasing",
                30.0,
                "eraseRegionRunning",
                p(&[
                    ("addr", hex_addr(offset)),
                    ("size", hex_addr(size)),
                ]),
                Some(offset),
                None,
                Some(size as u64),
                true,
            );
            flasher
                .erase_region(offset, size)
                .map_err(map_espflash_error)?;

            finish_with_reset(&mut flasher)?;
            emitter.phase("done", 100.0, "eraseRegionDone");
            Ok(())
        })
    })
    .await
}

#[tauri::command]
pub async fn espflash_device_info(
    window: WebviewWindow,
    args: DeviceInfoArgs,
) -> Result<EspDeviceInfoDto, String> {
    run_blocking(move || {
        let _lock = acquire_lock()?;
        let emitter = ProgressEmitter::new(window, args.job_id.clone(), "device_info");
        run_job(&emitter, || {
            emitter.phase("starting", 0.0, "deviceInfoStarting");

            let before = parse_before(&args.before);
            let after = parse_after(&args.after);
            let mut flasher = connect_flasher(&args.port, args.baud, before, after, &emitter)?;

            emitter.phase("reading", 40.0, "deviceInfoQuery");
            let info = flasher.device_info().map_err(map_espflash_error)?;

            let revision = info
                .revision
                .map(|(major, minor)| format!("v{major}.{minor}"))
                .unwrap_or_default();

            let chip_type = chip_label(info.chip);
            let chip_detail = if revision.is_empty() {
                chip_type.clone()
            } else {
                format!("{chip_type} (revision {revision})")
            };

            let mut security = String::new();
            if info.chip != espflash::target::Chip::Esp32 {
                emitter.phase("reading", 70.0, "deviceInfoSecurity");
                match flasher.security_info() {
                    Ok(sec) => security = sec.to_string(),
                    Err(e) => {
                        emitter.log_key(
                            "securityUnavailable",
                            p(&[("error", map_espflash_error(e))]),
                        );
                    }
                }
            }

            let features = info.features.join(", ");
            let psram = extract_psram(&info.features);

            let dto = EspDeviceInfoDto {
                chip_type,
                chip_detail,
                revision,
                mac: info.mac_address.unwrap_or_default().to_ascii_uppercase(),
                crystal: info.crystal_frequency.to_string(),
                features,
                flash_size: format_flash_size(info.flash_size),
                flash_type: String::new(),
                flash_manufacturer: String::new(),
                flash_device: String::new(),
                psram,
                security,
            };

            finish_with_reset(&mut flasher)?;
            emitter.phase_params(
                "done",
                100.0,
                "deviceInfoDone",
                p(&[
                    ("chip", dto.chip_type.clone()),
                    ("flash", dto.flash_size.clone()),
                ]),
            );
            Ok(dto)
        })
    })
    .await
}

#[tauri::command]
pub async fn espflash_merge_bin(
    window: WebviewWindow,
    args: MergeBinArgs,
) -> Result<(), String> {
    // 合并是纯文件操作，不占用串口锁
    run_blocking(move || {
        let emitter = ProgressEmitter::new(window, args.job_id.clone(), "merge");
        run_job(&emitter, || {
            if !args.chip.trim().is_empty() {
                emitter.log_key(
                    "targetChip",
                    p(&[("chip", args.chip.trim().to_string())]),
                );
            }
            merge::merge_bins(&args.output_path, &args.items, &emitter)
        })
    })
    .await
}
