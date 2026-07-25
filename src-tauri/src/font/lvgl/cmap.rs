//! cmap：FORMAT0_TINY / SPARSE_TINY（对齐快速 Python 转换器）。
//!
//! 注意：默认 LVGL（未开 `LV_FONT_FMT_TXT_LARGE`）里
//! `range_length` / sparse 相对偏移 / `glyph_id_start` 多为 `uint16_t`。

#[derive(Debug, Clone)]
pub struct CmapEntry {
    pub range_start: u32,
    pub range_length: u32,
    pub glyph_id_start: u32,
    /// "FORMAT0_TINY" | "SPARSE_TINY"
    pub type_name: &'static str,
    pub unicode_list: Option<Vec<u16>>,
    pub list_name: Option<String>,
}

const MIN_DENSE: usize = 8;
/// 未开启 LV_FONT_FMT_TXT_LARGE 时的安全上限
const U16_MAX: u32 = 0xffff;

/// 按连续段生成 FORMAT0_TINY；短间隙合并为 SPARSE_TINY。
/// 自动拆分超长段，避免 `uint16_t` 溢出。
pub fn build_cmaps(codepoints: &[u32], glyph_id_start: u32) -> Result<Vec<CmapEntry>, String> {
    if codepoints.is_empty() {
        return Ok(vec![]);
    }

    let mut runs: Vec<Vec<u32>> = vec![vec![codepoints[0]]];
    for &cp in &codepoints[1..] {
        let last = runs.last_mut().unwrap();
        let prev = *last.last().unwrap();
        if cp == prev + 1 {
            last.push(cp);
        } else if cp > prev {
            runs.push(vec![cp]);
        } else {
            return Err("内部错误：码点未按升序排列".into());
        }
    }

    let mut entries = Vec::new();
    let mut gid = glyph_id_start;
    let mut i = 0usize;
    let mut sparse_idx = 0usize;

    while i < runs.len() {
        let run = &runs[i];
        if run.len() >= MIN_DENSE {
            // 过长 dense 段拆分，保证 range_length <= 0xffff
            let mut offset = 0usize;
            while offset < run.len() {
                let take = run.len().saturating_sub(offset).min(U16_MAX as usize);
                let slice = &run[offset..offset + take];
                entries.push(CmapEntry {
                    range_start: slice[0],
                    range_length: take as u32,
                    glyph_id_start: gid,
                    type_name: "FORMAT0_TINY",
                    unicode_list: None,
                    list_name: None,
                });
                gid = gid
                    .checked_add(take as u32)
                    .ok_or_else(|| "字形 ID 溢出".to_string())?;
                offset += take;
            }
            i += 1;
            continue;
        }

        let mut sparse_cps: Vec<u32> = Vec::new();
        let start_gid = gid;
        while i < runs.len() && runs[i].len() < MIN_DENSE {
            sparse_cps.extend_from_slice(&runs[i]);
            gid = gid
                .checked_add(runs[i].len() as u32)
                .ok_or_else(|| "字形 ID 溢出".to_string())?;
            i += 1;
            if i < runs.len() && runs[i].len() >= MIN_DENSE {
                break;
            }
        }

        // 按 uint16 相对偏移上限拆分 sparse
        let mut chunk_start = 0usize;
        let mut local_gid = start_gid;
        while chunk_start < sparse_cps.len() {
            let base = sparse_cps[chunk_start];
            let mut chunk_end = chunk_start + 1;
            while chunk_end < sparse_cps.len() {
                let rel = sparse_cps[chunk_end].saturating_sub(base);
                if rel > U16_MAX {
                    break;
                }
                chunk_end += 1;
            }
            let chunk = &sparse_cps[chunk_start..chunk_end];
            let lo = chunk[0];
            let hi = *chunk.last().unwrap();
            let range_length = hi - lo + 1;
            if range_length > U16_MAX {
                return Err(format!(
                    "SPARSE cmap 跨度过大 (U+{lo:04X}..U+{hi:04X})，请缩小 Unicode 范围"
                ));
            }
            let rel: Vec<u16> = chunk.iter().map(|c| (c - lo) as u16).collect();
            let name = format!("unicode_list_{sparse_idx}");
            sparse_idx += 1;
            entries.push(CmapEntry {
                range_start: lo,
                range_length,
                glyph_id_start: local_gid,
                type_name: "SPARSE_TINY",
                unicode_list: Some(rel),
                list_name: Some(name),
            });
            local_gid = local_gid
                .checked_add(chunk.len() as u32)
                .ok_or_else(|| "字形 ID 溢出".to_string())?;
            chunk_start = chunk_end;
        }
    }

    Ok(entries)
}
