//! Flash / 分区相关的 Tauri 命令层。
//!
//! 底层协议由 `crates/wheat-esptool`（esptool 移植版）实现，
//! 本模块负责：参数解析、串口互斥、进度事件适配、错误码转换。
//! 事件契约（`espflash_progress` / `espflash_log` + messageKey）与前端
//! `src/utils/espflash` 保持一致。

mod connect;
mod merge;
mod progress;
mod types;

pub use types::*;

use connect::{
    connect_flasher, is_retryable_read_error, map_esp_error, parse_after, parse_before,
    parse_flash_mode, parse_u32, patch_flash_mode, read_baud_candidates,
};
use progress::{fmt_bytes, OpsSink, ProgressEmitter};
use std::fs;
use std::io::{BufWriter, Write};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::WebviewWindow;
use types::{hex_addr, p};
use wheat_esptool::{flash_size_label, CancelToken, Flasher, Segment};

/// 全局串口互斥：任意时刻只允许一个 Flash 任务。
static FLASH_LOCK: Mutex<()> = Mutex::new(());

/// 当前活跃任务的取消令牌（FLASH_LOCK 保证同时只有一个任务）。
static CANCEL_REGISTRY: Mutex<Option<(String, CancelToken)>> = Mutex::new(None);

fn cancel_registry() -> std::sync::MutexGuard<'static, Option<(String, CancelToken)>> {
    CANCEL_REGISTRY
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// 注册取消令牌；返回的 guard 在任务结束（drop）时自动注销。
fn register_cancel(job_id: &str) -> (CancelToken, CancelGuard) {
    let token = CancelToken::new();
    *cancel_registry() = Some((job_id.to_string(), token.clone()));
    (
        token,
        CancelGuard {
            job_id: job_id.to_string(),
        },
    )
}

struct CancelGuard {
    job_id: String,
}

impl Drop for CancelGuard {
    fn drop(&mut self) {
        let mut reg = cancel_registry();
        if reg.as_ref().is_some_and(|(id, _)| id == &self.job_id) {
            *reg = None;
        }
    }
}

/// 请求停止当前 Flash 任务。`job_id` 为空时取消任意活跃任务。
/// 返回是否有任务被标记取消（实际停止发生在下一个数据包边界）。
#[tauri::command]
pub async fn espflash_cancel(job_id: Option<String>) -> Result<bool, String> {
    let reg = cancel_registry();
    match reg.as_ref() {
        Some((id, token))
            if job_id
                .as_deref()
                .is_none_or(|j| j.is_empty() || j == id) =>
        {
            token.cancel();
            Ok(true)
        }
        _ => Ok(false),
    }
}

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
    if err == "cancelled" {
        // 用户主动停止：单独的 messageKey，前端展示「已停止」而非「失败」
        emitter.phase("error", 100.0, "cancelled");
    } else if err != "ESPFLASH_BUSY" {
        emitter.phase_params("error", 100.0, "failed", p(&[("error", err.clone())]));
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

/// 连接完成后打一条「芯片 + Flash 容量」的终端日志。
fn log_chip_info(emitter: &ProgressEmitter, flasher: &Flasher) {
    let flash = flasher
        .flash_size_bytes()
        .map(flash_size_label)
        .unwrap_or_else(|| "?".into());
    emitter.log_key(
        "chipInfo",
        p(&[
            ("chip", flasher.chip_name().to_string()),
            ("flash", flash),
        ]),
    );
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

            let flash_mode = parse_flash_mode(&args.flash_mode)?;
            let mut segments: Vec<Segment> = Vec::with_capacity(args.items.len());
            let mut total_bytes: u64 = 0;

            for item in &args.items {
                let offset = parse_u32(&item.offset)?;
                let mut data = fs::read(&item.path)
                    .map_err(|e| format!("read_file_failed:{}:{e}", item.path))?;
                if data.is_empty() {
                    return Err(format!("empty_file:{}", item.path));
                }
                patch_flash_mode(&mut data, flash_mode);
                // 与 esptool 对齐：长度补齐到 4 字节
                let rem = data.len() % 4;
                if rem != 0 {
                    data.extend(std::iter::repeat_n(0xFFu8, 4 - rem));
                }
                emitter.log_key(
                    "segmentInfo",
                    p(&[
                        ("addr", hex_addr(offset)),
                        ("path", item.path.clone()),
                        ("bytes", fmt_bytes(data.len() as u64)),
                    ]),
                );
                total_bytes += data.len() as u64;
                segments.push(Segment { addr: offset, data });
            }

            let before = parse_before(&args.before);
            let after = parse_after(&args.after);

            let write_base = if args.erase_all { 35.0 } else { 15.0 };
            let write_span = if args.erase_all { 60.0 } else { 80.0 };

            let (cancel, _cancel_guard) = register_cancel(&args.job_id);

            let mut sink = OpsSink::new(&emitter);
            sink.set_write_profile(write_base, write_span, total_bytes, 15.0, 30.0);

            let mut flasher = connect_flasher(&args.port, args.baud, before, after, &mut sink)?;
            flasher.set_cancel_token(cancel.clone());
            log_chip_info(&emitter, &flasher);

            let write_result = (|| -> Result<(), String> {
                if cancel.is_cancelled() {
                    return Err("cancelled".into());
                }
                if args.erase_all {
                    // OpsSink 会推 eraseAllRunning(15%) / eraseAllDone(30%)
                    flasher.erase_flash(&mut sink).map_err(map_esp_error)?;
                }
                flasher
                    .write_flash(&segments, args.verify, &mut sink)
                    .map_err(map_esp_error)
            })();

            if let Err(e) = write_result {
                // 停止/失败后尽力复位，避免设备停留在 bootloader
                let _ = flasher.abort();
                return Err(e);
            }

            // 按 after 参数复位（默认硬复位运行用户程序）
            flasher.finish().map_err(map_esp_error)?;
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

            let (cancel, _cancel_guard) = register_cancel(&args.job_id);

            // 读 Flash 对串口更敏感：波特率超限自动封顶，失败按阶梯降速重试
            let baud_list = read_baud_candidates(args.baud);
            let mut last_err = String::from("read_failed");
            let mut size: Option<u32> = None;

            for (attempt, baud) in baud_list.iter().copied().enumerate() {
                if cancel.is_cancelled() {
                    return Err("cancelled".into());
                }
                if attempt > 0 {
                    emitter.log_key(
                        "readRetryBaud",
                        p(&[("baud", baud.to_string()), ("error", last_err.clone())]),
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

                let mut sink = OpsSink::new(&emitter);
                let mut flasher =
                    match connect_flasher(&args.port, baud, before, after, &mut sink) {
                        Ok(f) => f,
                        Err(e) => {
                            last_err = e;
                            if is_retryable_read_error(&last_err) {
                                continue;
                            }
                            return Err(last_err);
                        }
                    };
                flasher.set_cancel_token(cancel.clone());

                // 解析读取长度（"ALL" = 从 offset 读到片尾；容量在连接时已探测）
                let read_size = if let Some(s) = size {
                    s
                } else if size_raw.eq_ignore_ascii_case("ALL") {
                    emitter.phase("reading", 12.0, "detectFlashSize");
                    let bytes = match flasher.flash_size_bytes() {
                        Some(b) => b,
                        None => return Err("flash_size_unknown".into()),
                    };
                    if offset >= bytes {
                        return Err(format!(
                            "offset_oob:{}:{}",
                            hex_addr(offset),
                            flash_size_label(bytes)
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
                        ("bytes", fmt_bytes(read_size as u64)),
                        ("baud", baud.to_string()),
                    ]),
                    Some(offset),
                    Some(0),
                    Some(read_size as u64),
                    true,
                );

                // 流式写入目标文件；失败时删除半截文件
                let file = fs::File::create(&args.save_path)
                    .map_err(|e| format!("create_failed:{e}"))?;
                let mut writer = BufWriter::new(file);

                let read_result = flasher
                    .read_flash(offset, read_size, &mut writer, &mut sink)
                    .map_err(map_esp_error)
                    .and_then(|()| writer.flush().map_err(|e| format!("write_failed:{e}")));

                match read_result {
                    Ok(()) => {
                        drop(writer);
                        let written = fs::metadata(&args.save_path).map(|m| m.len()).unwrap_or(0);
                        if written == 0 {
                            let _ = fs::remove_file(&args.save_path);
                            return Err("empty_read_result".into());
                        }

                        flasher.finish().map_err(map_esp_error)?;
                        emitter.emit(
                            "done",
                            100.0,
                            "readDone",
                            p(&[
                                ("path", args.save_path.clone()),
                                ("bytes", fmt_bytes(written)),
                            ]),
                            Some(offset),
                            Some(written),
                            Some(read_size as u64),
                            true,
                        );
                        return Ok(());
                    }
                    Err(e) => {
                        drop(writer);
                        let _ = fs::remove_file(&args.save_path);
                        last_err = e;
                        let _ = flasher.finish();
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
            let (cancel, _cancel_guard) = register_cancel(&args.job_id);

            let mut sink = OpsSink::new(&emitter);
            // 独立擦除命令：EraseAllStart/Done 落在 25% → 95%，避免长时间停在小百分比
            sink.set_erase_points(25.0, 95.0);
            let mut flasher = connect_flasher(&args.port, args.baud, before, after, &mut sink)?;

            // 擦除一旦下发就无法中断（芯片自行完成），只在开始前响应停止
            if cancel.is_cancelled() {
                let _ = flasher.abort();
                return Err("cancelled".into());
            }
            flasher.erase_flash(&mut sink).map_err(map_esp_error)?;

            flasher.finish().map_err(map_esp_error)?;
            // 终端成功日志已由 sink 的 EraseAllDone 打过，这里只收尾进度条
            emitter.emit("done", 100.0, "eraseAllDone", p(&[]), None, None, None, false);
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
            let (cancel, _cancel_guard) = register_cancel(&args.job_id);

            let mut sink = OpsSink::new(&emitter);
            let mut flasher = connect_flasher(&args.port, args.baud, before, after, &mut sink)?;

            // 区域擦除同样只在开始前响应停止
            if cancel.is_cancelled() {
                let _ = flasher.abort();
                return Err("cancelled".into());
            }
            emitter.emit(
                "erasing",
                30.0,
                "eraseRegionRunning",
                p(&[("addr", hex_addr(offset)), ("size", hex_addr(size))]),
                Some(offset),
                None,
                Some(size as u64),
                true,
            );
            flasher.erase_region(offset, size).map_err(map_esp_error)?;

            flasher.finish().map_err(map_esp_error)?;
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
            let mut sink = OpsSink::new(&emitter);
            let mut flasher = connect_flasher(&args.port, args.baud, before, after, &mut sink)?;

            emitter.phase("reading", 40.0, "deviceInfoQuery");
            let info = flasher.device_info().map_err(map_esp_error)?;

            let revision = info
                .revision
                .map(|(major, minor)| format!("v{major}.{minor}"))
                .unwrap_or_default();

            let chip_type = info.chip.clone();
            let chip_detail = if revision.is_empty() {
                chip_type.clone()
            } else {
                format!("{chip_type} (revision {revision})")
            };

            emitter.phase("reading", 70.0, "deviceInfoSecurity");
            let security = match flasher.security_info() {
                Ok(Some(sec)) => sec.to_string(),
                Ok(None) => String::new(),
                Err(e) => {
                    emitter.log_key(
                        "securityUnavailable",
                        p(&[("error", map_esp_error(e))]),
                    );
                    String::new()
                }
            };

            let features = info.features.join(", ");
            let psram = extract_psram(&info.features);

            let dto = EspDeviceInfoDto {
                chip_type,
                chip_detail,
                revision,
                mac: info.mac.unwrap_or_default().to_ascii_uppercase(),
                crystal: format!("{} MHz", info.crystal_mhz),
                features,
                flash_size: info
                    .flash_size_bytes
                    .map(flash_size_label)
                    .unwrap_or_default(),
                psram,
                security,
            };

            flasher.finish().map_err(map_esp_error)?;
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
            merge::merge_bins(&args.output_path, &args.items, &emitter)
        })
    })
    .await
}
