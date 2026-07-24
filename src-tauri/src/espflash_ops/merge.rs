use std::fs;
use std::io::Write;
use std::path::Path;

use super::connect::parse_u32;
use super::progress::ProgressEmitter;
use super::types::{hex_addr, p, FlashItem};

/// 合并输出上限，避免超大稀疏地址把内存打爆（约 256 MiB）。
const MAX_MERGE_BYTES: u64 = 256 * 1024 * 1024;

/// 按地址合并多个 bin（0xFF 填充空隙），对齐 esptool `merge-bin` 的常见用法。
pub fn merge_bins(
    output_path: &str,
    items: &[FlashItem],
    emitter: &ProgressEmitter,
) -> Result<(), String> {
    if items.is_empty() {
        return Err("no_segments".into());
    }

    emitter.phase("merging", 5.0, "mergeReading");

    let mut segments: Vec<(u32, Vec<u8>)> = Vec::with_capacity(items.len());
    let mut total_input: u64 = 0;

    for item in items {
        let offset = parse_u32(&item.offset)?;
        let data = fs::read(&item.path).map_err(|e| format!("read_failed:{}:{e}", item.path))?;
        if data.is_empty() {
            return Err(format!("empty_file:{}", item.path));
        }
        total_input = total_input.saturating_add(data.len() as u64);
        segments.push((offset, data));
    }

    segments.sort_by_key(|(offset, _)| *offset);

    for window in segments.windows(2) {
        let (a_off, a_data) = &window[0];
        let (b_off, _) = &window[1];
        let a_end = (*a_off as u64)
            .checked_add(a_data.len() as u64)
            .ok_or_else(|| format!("offset_overflow:{}", hex_addr(*a_off)))?;
        if a_end > *b_off as u64 {
            return Err(format!(
                "segment_overlap:{}:{}:{}",
                hex_addr(*a_off),
                a_data.len(),
                hex_addr(*b_off)
            ));
        }
    }

    let last = segments
        .last()
        .ok_or_else(|| "no_segments".to_string())?;
    let out_len_u64 = (last.0 as u64)
        .checked_add(last.1.len() as u64)
        .ok_or_else(|| "merge_too_large".to_string())?;
    if out_len_u64 > MAX_MERGE_BYTES || out_len_u64 > (usize::MAX as u64) {
        return Err("merge_too_large".into());
    }
    let out_len = out_len_u64 as usize;

    emitter.phase_params(
        "merging",
        15.0,
        "mergeAlloc",
        p(&[("bytes", out_len.to_string())]),
    );

    let mut out = vec![0xFFu8; out_len];
    let mut written: u64 = 0;

    for (offset, data) in &segments {
        let start = *offset as usize;
        let end = start
            .checked_add(data.len())
            .ok_or_else(|| format!("write_offset_overflow:{}", hex_addr(*offset)))?;
        if end > out.len() {
            return Err(format!("segment_oob:{}", hex_addr(*offset)));
        }
        out[start..end].copy_from_slice(data);
        written = written.saturating_add(data.len() as u64);
        let percent = 15.0 + 70.0 * (written as f64 / total_input.max(1) as f64);
        emitter.emit(
            "merging",
            percent,
            "mergeSegment",
            p(&[
                ("addr", hex_addr(*offset)),
                ("bytes", data.len().to_string()),
            ]),
            Some(*offset),
            Some(written),
            Some(total_input),
            true,
        );
    }

    if let Some(parent) = Path::new(output_path).parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|e| format!("mkdir_failed:{e}"))?;
        }
    }

    emitter.phase_params(
        "merging",
        90.0,
        "mergeWriting",
        p(&[("path", output_path.to_string())]),
    );

    let mut file =
        fs::File::create(output_path).map_err(|e| format!("create_failed:{e}"))?;
    file.write_all(&out)
        .map_err(|e| format!("write_failed:{e}"))?;
    file.flush().map_err(|e| format!("flush_failed:{e}"))?;

    emitter.phase_params(
        "done",
        100.0,
        "mergeDone",
        p(&[
            ("path", output_path.to_string()),
            ("bytes", out_len.to_string()),
        ]),
    );
    Ok(())
}
