//! 纯 Rust LVGL 字库转换（fontdue + ttf-parser）。
//!
//! 输出：无压缩、无 kern、无子像素的位图字库。
//! - `lvgl`：C 源（FORMAT0_TINY / SPARSE_TINY）
//! - `bin`：与 [lv_font_conv](https://github.com/lvgl/lv_font_conv) 兼容的二进制格式
//! - `both`：同时输出

mod bin_writer;
mod bitmap;
mod cmap;
mod extract_chars;
mod writer;

pub use extract_chars::{extract_from_path, extract_from_source, ExtractLvglFontCharsResult};

use std::collections::{BTreeMap, HashSet};
use std::sync::Arc;

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use fontdue::{Font, FontSettings};
use serde::{Deserialize, Serialize};
use ttf_parser::Face;

use bin_writer::{write_lvgl_bin, BinFontMetrics};
use bitmap::{pack_gray_pixels, pack_mono_from_gray};
use cmap::build_cmaps;
use writer::{write_lvgl_c, LvglHeaderInfo};

/// 未开启 `LV_FONT_FMT_TXT_LARGE` 时 glyph id 安全上限（预留 id=0）
const MAX_GLYPHS: u32 = 65_534;
/// 单段 Unicode 跨度上限，避免 `0x0-0xfffff` 一类范围空转/爆内存
const MAX_RANGE_SPAN: u32 = 300_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LvglFontConvertOptions {
    pub font_name: String,
    pub size: u32,
    pub bpp: u8,
    /// `lvgl` | `bin` | `both`
    #[serde(default = "default_format")]
    pub format: String,
    pub range: String,
    pub symbols: String,
    #[serde(default)]
    pub fallback: String,
    #[serde(default)]
    pub lv_include: String,
}

fn default_format() -> String {
    "lvgl".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LvglFontConvertResult {
    pub font_name: String,
    pub size: u32,
    pub bpp: u8,
    pub c_source: Option<String>,
    /// lv_font_conv 兼容 `.bin`（base64）
    pub bin_base64: Option<String>,
    pub glyph_count: u32,
    pub elapsed_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LvglFontProgressEvent {
    pub job_id: String,
    /// load | cmap | render | write | done
    pub stage: String,
    pub current: u32,
    pub total: u32,
    pub percent: f32,
    pub message: String,
}

pub type ProgressCallback = Arc<dyn Fn(LvglFontProgressEvent) + Send + Sync>;

#[derive(Debug, Clone)]
pub struct Glyph {
    pub cp: u32,
    pub adv_w: i32,
    pub box_w: u16,
    pub box_h: u16,
    pub ofs_x: i16,
    pub ofs_y: i16,
    pub bitmap: Vec<u8>,
}

fn emit_progress(
    cb: &Option<ProgressCallback>,
    job_id: &str,
    stage: &str,
    current: u32,
    total: u32,
    percent: f32,
    message: &str,
) {
    if let Some(cb) = cb {
        cb(LvglFontProgressEvent {
            job_id: job_id.to_string(),
            stage: stage.to_string(),
            current,
            total,
            percent: percent.clamp(0.0, 100.0),
            message: message.to_string(),
        });
    }
}

fn sanitize_font_name(name: &str) -> String {
    let mut cleaned: String = name
        .trim()
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    while cleaned.contains("__") {
        cleaned = cleaned.replace("__", "_");
    }
    let cleaned = cleaned.trim_matches('_').to_string();
    if cleaned.is_empty() {
        return "font".into();
    }
    if cleaned.chars().next().is_some_and(|c| c.is_ascii_digit()) {
        format!("font_{cleaned}")
    } else {
        cleaned
    }
}

/// C 标识符：空则 None；否则规范化为安全标识符
fn sanitize_c_ident(name: &str) -> Option<String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(sanitize_font_name(trimmed))
}

/// include 路径：禁止引号/换行等注入
fn sanitize_include_path(raw: &str) -> String {
    let t = raw.trim();
    if t.is_empty() {
        return "lvgl.h".into();
    }
    let cleaned: String = t
        .chars()
        .filter(|c| {
            c.is_ascii_alphanumeric()
                || matches!(c, '/' | '\\' | '.' | '_' | '-' | '+')
        })
        .collect();
    if cleaned.is_empty() {
        "lvgl.h".into()
    } else {
        cleaned
    }
}

fn parse_code_point(text: &str) -> Result<u32, String> {
    let t = text.trim();
    if t.is_empty() {
        return Err("EMPTY".into());
    }
    let lower = t.to_ascii_lowercase();
    if let Some(hex) = lower.strip_prefix("0x") {
        u32::from_str_radix(hex, 16).map_err(|_| format!("INVALID_RANGE:{t}"))
    } else {
        t.parse::<u32>().map_err(|_| format!("INVALID_RANGE:{t}"))
    }
}

fn parse_unicode_ranges(input: &str) -> Result<Vec<(u32, u32, u32)>, String> {
    let raw = input.trim();
    if raw.is_empty() {
        return Ok(vec![]);
    }
    let mut out = Vec::new();
    for part in raw
        .split(|c: char| c == ',' || c == ';' || c.is_whitespace())
        .filter(|s| !s.is_empty())
    {
        let mapped: Vec<&str> = part.split("=>").collect();
        let span = mapped[0].trim();
        let remap_raw = mapped.get(1).map(|s| s.trim());
        let dash: Vec<&str> = span.split('-').collect();
        if dash[0].trim().is_empty() {
            return Err(format!("INVALID_RANGE:{part}"));
        }
        let start = parse_code_point(dash[0].trim())?;
        let end = if dash.len() > 1 {
            if dash[1].trim().is_empty() {
                return Err(format!("INVALID_RANGE:{part}"));
            }
            parse_code_point(dash[1].trim())?
        } else {
            start
        };
        let remap = if let Some(r) = remap_raw {
            if r.is_empty() {
                return Err(format!("INVALID_RANGE:{part}"));
            }
            parse_code_point(r)?
        } else {
            start
        };
        if end < start {
            return Err(format!("INVALID_RANGE:{part}"));
        }
        let span = end.saturating_sub(start).saturating_add(1);
        if span > MAX_RANGE_SPAN {
            return Err("RANGE_TOO_WIDE".into());
        }
        out.push((start, end, remap));
    }
    Ok(out)
}

fn collect_font_codepoints(font_bytes: &[u8]) -> Result<HashSet<u32>, String> {
    let face = Face::parse(font_bytes, 0).map_err(|e| format!("解析字体失败: {e}"))?;
    let mut set = HashSet::new();
    if let Some(cmap) = face.tables().cmap {
        for subtable in cmap.subtables {
            if !subtable.is_unicode() {
                continue;
            }
            subtable.codepoints(|cp| {
                if cp != 0 {
                    set.insert(cp);
                }
            });
        }
    }
    if set.is_empty() {
        return Err("字体中无可用 Unicode 字符映射".into());
    }
    Ok(set)
}

/// 从 TTF 取 OS/2 / post 度量，缩放到目标字号（对齐 lv_font_conv）。
fn bin_metrics_from_face(face: &Face<'_>, size: u32, bpp: u8) -> BinFontMetrics {
    let upem = face.units_per_em().max(1) as f32;
    let scale = size as f32 / upem;

    let (typo_ascent, typo_descent, typo_line_gap) = if let Some(os2) = face.tables().os2 {
        (
            (f32::from(os2.typographic_ascender()) * scale)
                .round()
                .clamp(0.0, u16::MAX as f32) as u16,
            (f32::from(os2.typographic_descender()) * scale)
                .round()
                .clamp(i16::MIN as f32, i16::MAX as f32) as i16,
            (f32::from(os2.typographic_line_gap()) * scale)
                .round()
                .clamp(0.0, u16::MAX as f32) as u16,
        )
    } else {
        let asc = (f32::from(face.ascender()) * scale)
            .round()
            .clamp(0.0, u16::MAX as f32) as u16;
        let desc = (f32::from(face.descender()) * scale)
            .round()
            .clamp(i16::MIN as f32, i16::MAX as f32) as i16;
        (asc, desc, 0)
    };

    let (underline_position, underline_thickness) =
        if let Some(m) = face.underline_metrics() {
            (
                (f32::from(m.position) * scale)
                    .round()
                    .clamp(i16::MIN as f32, i16::MAX as f32) as i16,
                (f32::from(m.thickness) * scale)
                    .round()
                    .clamp(0.0, u16::MAX as f32) as u16,
            )
        } else {
            (-1, 1)
        };

    BinFontMetrics {
        size,
        bpp,
        typo_ascent,
        typo_descent,
        typo_line_gap,
        underline_position,
        underline_thickness,
    }
}

/// 收集 (输出 unicode, 源 unicode) 有序列表
fn collect_glyph_pairs(
    available: &HashSet<u32>,
    ranges: &[(u32, u32, u32)],
    symbols: &str,
) -> Result<Vec<(u32, u32)>, String> {
    let mut map: BTreeMap<u32, u32> = BTreeMap::new();

    for &(lo, hi, remap) in ranges {
        let mut i = 0u32;
        let mut cp = lo;
        while cp <= hi {
            if available.contains(&cp) {
                let out_cp = remap.saturating_add(i);
                map.entry(out_cp).or_insert(cp);
            }
            if cp == u32::MAX {
                break;
            }
            cp += 1;
            i = i.saturating_add(1);
        }
    }

    for ch in symbols.chars() {
        let cp = ch as u32;
        if available.contains(&cp) {
            map.entry(cp).or_insert(cp);
        }
    }

    if map.is_empty() {
        return Err("EMPTY_GLYPHS".into());
    }

    Ok(map.into_iter().collect())
}

fn render_glyphs(
    font: &Font,
    pairs: &[(u32, u32)],
    px: f32,
    bpp: u8,
    job_id: &str,
    progress: &Option<ProgressCallback>,
) -> Result<(Vec<Glyph>, i32, i32), String> {
    let n = pairs.len() as u32;
    let mut glyphs = Vec::with_capacity(pairs.len());
    let report_every = (n / 40).max(1).min(200);

    for (i, &(out_cp, src_cp)) in pairs.iter().enumerate() {
        let ch = match char::from_u32(src_cp) {
            Some(c) => c,
            None => {
                return Err(format!("非法码点 U+{src_cp:04X}"));
            }
        };
        let (metrics, gray) = font.rasterize(ch, px);

        let w = metrics.width;
        let h = metrics.height;
        let (box_w, box_h, bitmap) = if w == 0 || h == 0 || gray.is_empty() {
            (1u16, 1u16, vec![0u8])
        } else {
            let packed = if bpp <= 1 {
                pack_mono_from_gray(&gray, w, h)
            } else {
                pack_gray_pixels(&gray, w, h, bpp)
            };
            (w as u16, h as u16, packed)
        };

        // LVGL adv_w 单位 1/16 px
        let adv_w = (metrics.advance_width * 16.0).round() as i32;
        let ofs_x = metrics.xmin.clamp(i16::MIN as i32, i16::MAX as i32) as i16;
        // fontdue ymin = 位图底边相对基线；等价 FreeType (bitmap_top - h)
        let ofs_y = metrics.ymin.clamp(i16::MIN as i32, i16::MAX as i32) as i16;

        glyphs.push(Glyph {
            cp: out_cp,
            adv_w,
            box_w,
            box_h,
            ofs_x,
            ofs_y,
            bitmap,
        });

        let cur = (i as u32) + 1;
        if cur == 1 || cur == n || cur % report_every == 0 {
            let pct = 15.0 + (cur as f32 / n.max(1) as f32) * 70.0;
            emit_progress(
                progress,
                job_id,
                "render",
                cur,
                n,
                pct,
                &format!("渲染字形 {cur}/{n}"),
            );
        }
    }

    let (line_height, base_line) = if let Some(lm) = font.horizontal_line_metrics(px) {
        let ascent = lm.ascent.ceil() as i32;
        let descent = lm.descent.floor() as i32; // 通常为负
        let line_height = (ascent - descent).max(1);
        let base_line = (-descent).max(0);
        (line_height, base_line)
    } else {
        let size = px.round() as i32;
        (size.max(1), (size / 4).max(0))
    };

    Ok((glyphs, line_height, base_line))
}

/// 将字体字节转换为 LVGL C 源码（在 `spawn_blocking` 内调用，带进度回调）。
pub fn convert_lvgl_font(
    font_bytes: &[u8],
    font_file_name: &str,
    options: LvglFontConvertOptions,
    job_id: &str,
    progress: Option<ProgressCallback>,
) -> Result<LvglFontConvertResult, String> {
    let t0 = std::time::Instant::now();

    if font_bytes.is_empty() {
        return Err("字体数据为空".into());
    }

    let font_name = sanitize_font_name(&options.font_name);
    let size = options.size.max(4).min(256);
    let bpp = match options.bpp {
        1 | 2 | 4 | 8 => options.bpp,
        3 => return Err("BPP3_UNSUPPORTED".into()),
        _ => return Err(format!("不支持的 bpp: {}", options.bpp)),
    };

    let format = options.format.to_ascii_lowercase();
    let want_c = format.is_empty() || format == "lvgl" || format == "both";
    let want_bin = format == "bin" || format == "both";
    if !want_c && !want_bin {
        return Err(format!("不支持的输出格式: {}", options.format));
    }
    if want_bin && bpp == 8 {
        return Err("BPP8_BIN_UNSUPPORTED".into());
    }

    let ranges = parse_unicode_ranges(&options.range)?;
    if ranges.is_empty() && options.symbols.is_empty() {
        return Err("EMPTY_GLYPHS".into());
    }

    emit_progress(&progress, job_id, "load", 0, 1, 2.0, "加载字体…");

    let settings = FontSettings {
        collection_index: 0,
        scale: 40.0,
        ..FontSettings::default()
    };
    let font = Font::from_bytes(font_bytes, settings)
        .map_err(|e| format!("打开字体失败（请使用 TTF/OTF）: {e}"))?;

    let face = Face::parse(font_bytes, 0).map_err(|e| format!("解析字体失败: {e}"))?;
    let bin_metrics = bin_metrics_from_face(&face, size, bpp);

    emit_progress(&progress, job_id, "cmap", 0, 1, 8.0, "读取字符映射…");

    let available = collect_font_codepoints(font_bytes)?;
    let pairs = collect_glyph_pairs(&available, &ranges, &options.symbols)?;
    let glyph_count = pairs.len() as u32;

    if glyph_count > MAX_GLYPHS {
        return Err("TOO_MANY_GLYPHS".into());
    }

    emit_progress(
        &progress,
        job_id,
        "cmap",
        glyph_count,
        glyph_count,
        15.0,
        &format!("码位数: {glyph_count}"),
    );

    let px = size as f32;
    let (glyphs, line_height, base_line) =
        render_glyphs(&font, &pairs, px, bpp, job_id, &progress)?;

    let out_cps: Vec<u32> = glyphs.iter().map(|g| g.cp).collect();
    let cmaps = build_cmaps(&out_cps, 1)?;

    let mut c_source: Option<String> = None;
    let mut bin_base64: Option<String> = None;

    if want_c {
        emit_progress(&progress, job_id, "write", 0, 1, 88.0, "生成 C 源文件…");

        let lv_include = sanitize_include_path(&options.lv_include);
        let fallback = sanitize_c_ident(&options.fallback).unwrap_or_default();
        let header = LvglHeaderInfo {
            source_font: font_file_name,
            font_name: &font_name,
            size,
            bpp,
            range: options.range.trim(),
            lv_include: &lv_include,
            fallback: &fallback,
            glyph_count,
        };

        c_source = Some(write_lvgl_c(
            &header,
            &glyphs,
            &cmaps,
            line_height,
            base_line,
            |written, total| {
                let pct = 88.0 + (written as f32 / total.max(1) as f32) * 5.0;
                emit_progress(
                    &progress,
                    job_id,
                    "write",
                    written,
                    total,
                    pct,
                    &format!("写入 C 字形数据 {written}/{total}"),
                );
            },
        )?);
    }

    if want_bin {
        emit_progress(
            &progress,
            job_id,
            "write",
            0,
            1,
            if want_c { 93.0 } else { 88.0 },
            "生成 bin 字库…",
        );
        let bin = write_lvgl_bin(&bin_metrics, &glyphs, &cmaps, |written, total| {
            let base = if want_c { 93.0 } else { 88.0 };
            let pct = base + (written as f32 / total.max(1) as f32) * (99.0 - base);
            emit_progress(
                &progress,
                job_id,
                "write",
                written,
                total,
                pct,
                &format!("写入 bin 字形数据 {written}/{total}"),
            );
        })?;
        bin_base64 = Some(B64.encode(&bin));
    }

    emit_progress(
        &progress,
        job_id,
        "done",
        glyph_count,
        glyph_count,
        100.0,
        "完成",
    );

    Ok(LvglFontConvertResult {
        font_name,
        size,
        bpp,
        c_source,
        bin_base64,
        glyph_count,
        elapsed_ms: t0.elapsed().as_millis() as u64,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn convert_arial_ascii_bpp1() {
        let path = r"C:\Windows\Fonts\arial.ttf";
        let bytes = std::fs::read(path).expect("arial.ttf");
        let opts = LvglFontConvertOptions {
            font_name: "font_arial_16".into(),
            size: 16,
            bpp: 1,
            format: "lvgl".into(),
            range: "0x20-0x7F".into(),
            symbols: String::new(),
            fallback: String::new(),
            lv_include: String::new(),
        };
        let result = convert_lvgl_font(&bytes, "arial.ttf", opts, "test", None).expect("convert");
        assert!(result.glyph_count > 50);
        let src = result.c_source.expect("c");
        assert!(src.contains("const lv_font_t font_arial_16"));
        assert!(src.contains("glyph_bitmap"));
        assert!(src.contains("LV_FONT_FMT_TXT_CMAP_"));
        assert!(src.contains("#include \"lvgl.h\""));
        assert!(src.contains("#include \"lvgl/lvgl.h\""));
        assert!(src.contains("Generated by Wheat ESP Tools"));
        assert!(src.contains("Generated at :"));
        assert!(src.contains("Source font : arial.ttf"));
        assert!(src.contains("C symbol    : font_arial_16"));
        assert!(src.contains("uncompressed bitmap, no kerning"));
        assert!(!src.contains("--no-compress"));
        assert!(!src.contains("Opts:"));
    }

    #[test]
    fn convert_arial_ascii_bin() {
        let path = r"C:\Windows\Fonts\arial.ttf";
        let bytes = std::fs::read(path).expect("arial.ttf");
        let opts = LvglFontConvertOptions {
            font_name: "font_arial_16".into(),
            size: 16,
            bpp: 4,
            format: "bin".into(),
            range: "0x20-0x7F".into(),
            symbols: String::new(),
            fallback: String::new(),
            lv_include: String::new(),
        };
        let result = convert_lvgl_font(&bytes, "arial.ttf", opts, "test", None).expect("convert");
        assert!(result.glyph_count > 50);
        assert!(result.c_source.is_none());
        let b64 = result.bin_base64.expect("bin");
        let bin = B64.decode(b64.as_bytes()).expect("b64");
        assert!(bin.len() > 64);
        assert_eq!(&bin[4..8], b"head");
        // tables follow head
        let head_size = u32::from_le_bytes(bin[0..4].try_into().unwrap()) as usize;
        assert_eq!(&bin[head_size + 4..head_size + 8], b"cmap");
    }

    #[test]
    fn reject_bpp8_for_bin() {
        let opts = LvglFontConvertOptions {
            font_name: "f".into(),
            size: 16,
            bpp: 8,
            format: "bin".into(),
            range: "0x20-0x7F".into(),
            symbols: String::new(),
            fallback: String::new(),
            lv_include: String::new(),
        };
        let err = convert_lvgl_font(&[0u8; 16], "x.ttf", opts, "t", None).unwrap_err();
        assert!(err.contains("BPP8_BIN_UNSUPPORTED"));
    }

    #[test]
    fn reject_range_too_wide() {
        let path = r"C:\Windows\Fonts\arial.ttf";
        let bytes = std::fs::read(path).expect("arial.ttf");
        let opts = LvglFontConvertOptions {
            font_name: "font_wide".into(),
            size: 16,
            bpp: 1,
            format: "lvgl".into(),
            range: "0x0-0xfffff".into(),
            symbols: String::new(),
            fallback: String::new(),
            lv_include: String::new(),
        };
        let err = convert_lvgl_font(&bytes, "arial.ttf", opts, "test", None).unwrap_err();
        assert!(err.contains("RANGE_TOO_WIDE"));
    }

    #[test]
    fn reject_empty_bytes() {
        let opts = LvglFontConvertOptions {
            font_name: "f".into(),
            size: 16,
            bpp: 1,
            format: "lvgl".into(),
            range: "0x20-0x7F".into(),
            symbols: String::new(),
            fallback: String::new(),
            lv_include: String::new(),
        };
        let err = convert_lvgl_font(&[], "x.ttf", opts, "t", None).unwrap_err();
        assert!(err.contains("空"));
    }

    #[test]
    fn sanitize_include_strips_quotes() {
        let cleaned = sanitize_include_path("lvgl.h\";system(\"x\")");
        assert!(!cleaned.contains('"'));
        assert!(!cleaned.contains('('));
        assert!(cleaned.starts_with("lvgl.h"));
        assert_eq!(sanitize_include_path(""), "lvgl.h");
    }
}
