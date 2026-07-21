//! GIF 压缩：丰富探测 + 抽帧 / 缩放 / 减色 / 帧间隔重写。

use std::fs::File;
use std::io::{BufReader, Cursor};
use std::path::Path;

use ::image::codecs::gif::GifDecoder;
use ::image::imageops::{self, FilterType};
use ::image::{AnimationDecoder, Frame as ImageFrame, RgbaImage};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use color_quant::NeuQuant;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GifRichProbeResult {
    pub path: String,
    pub file_name: String,
    pub width: u32,
    pub height: u32,
    pub frame_count: u32,
    pub delays_ms: Vec<u32>,
    pub delay_min_ms: u32,
    pub delay_max_ms: u32,
    pub delay_avg_ms: f32,
    pub fps_estimate: f32,
    pub loop_count: Option<u32>,
    pub has_global_palette: bool,
    pub has_transparency: bool,
    pub byte_length: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GifCompressOptions {
    /// 每隔 N 帧跳过 1 帧（保留 N 帧后丢弃 1 帧）；0 = 不抽帧
    pub frame_step: Option<u32>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    /// 调色板颜色数：8 / 16 / 32 / 64 / 128 / 256
    pub colors: Option<u32>,
    pub dither: Option<bool>,
    /// "keep" | "fixed"（兼容前端字符串；解析见 DelayMode）
    pub delay_mode: Option<String>,
    /// delay_mode=fixed 时使用的毫秒
    pub fixed_delay_ms: Option<u32>,
    /// 帧差分：只写变化区域，相同像素透明穿透；默认 true
    pub frame_diff: Option<bool>,
    /// 有损强度 0–200（0=无损帧差分；越高越小、噪点/色差越明显）。类似 gifsicle --lossy
    pub lossy: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GifCompressResult {
    pub width: u32,
    pub height: u32,
    pub frame_count: u32,
    pub byte_length: u64,
    pub gif_base64: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GifCompressProgressEvent {
    pub job_id: String,
    pub path: String,
    /// load | resize | palette | encode | pack | done
    pub stage: String,
    pub current: u32,
    pub total: u32,
    pub percent: f32,
    pub message: String,
}

pub type ProgressCallback = Arc<dyn Fn(GifCompressProgressEvent) + Send + Sync>;
// Arc+Sync：减色/缩放阶段用 rayon 并行上报进度，与 EAF 的 Box 回调不同。

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DelayMode {
    Keep,
    Fixed,
}

impl DelayMode {
    fn from_option(raw: Option<&str>) -> Self {
        match raw.map(|s| s.to_ascii_lowercase()).as_deref() {
            Some("fixed") => Self::Fixed,
            _ => Self::Keep,
        }
    }
}

fn emit_progress(
    cb: &Option<ProgressCallback>,
    job_id: &str,
    path: &str,
    stage: &str,
    current: u32,
    total: u32,
    percent: f32,
    message: &str,
) {
    if let Some(cb) = cb {
        cb(GifCompressProgressEvent {
            job_id: job_id.to_string(),
            path: path.to_string(),
            stage: stage.to_string(),
            current,
            total,
            percent: percent.clamp(0.0, 100.0),
            message: message.to_string(),
        });
    }
}

/// 解析 GIF 元信息（含 delay / loop / 透明），不解码像素。
pub fn probe_gif_rich(path: &str) -> Result<GifRichProbeResult, String> {
    let p = Path::new(path);
    if !p.is_file() {
        return Err(format!("文件不存在: {path}"));
    }
    let data = std::fs::read(p).map_err(|e| format!("读取 GIF 失败: {e}"))?;
    let meta = parse_gif_rich_meta(&data)?;
    let file_name = p
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string());
    Ok(GifRichProbeResult {
        path: path.to_string(),
        file_name,
        width: meta.width,
        height: meta.height,
        frame_count: meta.frame_count,
        delays_ms: meta.delays_ms,
        delay_min_ms: meta.delay_min_ms,
        delay_max_ms: meta.delay_max_ms,
        delay_avg_ms: meta.delay_avg_ms,
        fps_estimate: meta.fps_estimate,
        loop_count: meta.loop_count,
        has_global_palette: meta.has_global_palette,
        has_transparency: meta.has_transparency,
        byte_length: data.len() as u64,
    })
}

struct RichMeta {
    width: u32,
    height: u32,
    frame_count: u32,
    delays_ms: Vec<u32>,
    delay_min_ms: u32,
    delay_max_ms: u32,
    delay_avg_ms: f32,
    fps_estimate: f32,
    loop_count: Option<u32>,
    has_global_palette: bool,
    has_transparency: bool,
}

fn centiseconds_to_ms(cs: u16) -> u32 {
    // GIF 规范：0 常表示浏览器默认约 100ms
    if cs == 0 {
        100
    } else {
        (cs as u32) * 10
    }
}

fn parse_gif_rich_meta(data: &[u8]) -> Result<RichMeta, String> {
    if data.len() < 13 || &data[0..3] != b"GIF" {
        return Err("不是有效的 GIF 文件".into());
    }
    let width = u16::from_le_bytes([data[6], data[7]]) as u32;
    let height = u16::from_le_bytes([data[8], data[9]]) as u32;
    if width == 0 || height == 0 {
        return Err("GIF 尺寸无效".into());
    }

    let packed = data[10];
    let has_global_palette = packed & 0x80 != 0;
    let mut i = 13usize;
    if has_global_palette {
        let gct_size = 3 * (1 << ((packed & 0x07) + 1));
        i = i
            .checked_add(gct_size)
            .ok_or_else(|| "GIF 全局色表越界".to_string())?;
        if i > data.len() {
            return Err("GIF 全局色表不完整".into());
        }
    }

    let mut frame_count = 0u32;
    let mut delays_ms: Vec<u32> = Vec::new();
    let mut pending_delay_cs: Option<u16> = None;
    let mut has_transparency = false;
    let mut loop_count: Option<u32> = None;

    while i < data.len() {
        match data[i] {
            0x3B => break,
            0x21 => {
                i += 1;
                if i >= data.len() {
                    break;
                }
                let label = data[i];
                i += 1;
                if label == 0xF9 {
                    // Graphic Control Extension
                    if i < data.len() && data[i] == 4 && i + 5 <= data.len() {
                        let gce_packed = data[i + 1];
                        if gce_packed & 0x01 != 0 {
                            has_transparency = true;
                        }
                        let delay_cs = u16::from_le_bytes([data[i + 2], data[i + 3]]);
                        pending_delay_cs = Some(delay_cs);
                        // Graphic Control: block size(1) + 4 bytes + terminator(1)
                        i += 6;
                        continue;
                    }
                } else if label == 0xFF {
                    // Application Extension — Netscape loop
                    if i < data.len() {
                        let block_size = data[i] as usize;
                        i += 1;
                        if block_size > 0 && i + block_size <= data.len() {
                            let app = &data[i..i + block_size];
                            i += block_size;
                            if app.starts_with(b"NETSCAPE2.0") || app.starts_with(b"ANIMEXTS1.0") {
                                // sub-block: size 3, 0x01, loop LE u16
                                if i + 4 <= data.len() && data[i] == 3 && data[i + 1] == 1 {
                                    let loops = u16::from_le_bytes([data[i + 2], data[i + 3]]) as u32;
                                    loop_count = Some(loops);
                                }
                            }
                        }
                    }
                }
                // skip remaining sub-blocks for this extension
                while i < data.len() {
                    let block_size = data[i] as usize;
                    i += 1;
                    if block_size == 0 {
                        break;
                    }
                    i = i
                        .checked_add(block_size)
                        .ok_or_else(|| "GIF 扩展块越界".to_string())?;
                    if i > data.len() {
                        return Err("GIF 扩展块不完整".into());
                    }
                }
            }
            0x2C => {
                frame_count += 1;
                let delay_cs = pending_delay_cs.take().unwrap_or(10);
                delays_ms.push(centiseconds_to_ms(delay_cs));
                i += 1;
                if i + 9 > data.len() {
                    return Err("GIF 图像描述符不完整".into());
                }
                let local_packed = data[i + 8];
                i += 9;
                if local_packed & 0x80 != 0 {
                    let lct_size = 3 * (1 << ((local_packed & 0x07) + 1));
                    i = i
                        .checked_add(lct_size)
                        .ok_or_else(|| "GIF 局部色表越界".to_string())?;
                    if i > data.len() {
                        return Err("GIF 局部色表不完整".into());
                    }
                }
                if i >= data.len() {
                    return Err("GIF 图像数据不完整".into());
                }
                i += 1; // LZW min code size
                while i < data.len() {
                    let block_size = data[i] as usize;
                    i += 1;
                    if block_size == 0 {
                        break;
                    }
                    i = i
                        .checked_add(block_size)
                        .ok_or_else(|| "GIF 图像数据块越界".to_string())?;
                    if i > data.len() {
                        return Err("GIF 图像数据不完整".into());
                    }
                }
            }
            _ => {
                i += 1;
            }
        }
    }

    if frame_count == 0 {
        return Err("GIF 没有任何帧".into());
    }
    if delays_ms.len() as u32 != frame_count {
        // 容错：补齐
        while delays_ms.len() < frame_count as usize {
            delays_ms.push(100);
        }
        delays_ms.truncate(frame_count as usize);
    }

    let delay_min_ms = *delays_ms.iter().min().unwrap_or(&100);
    let delay_max_ms = *delays_ms.iter().max().unwrap_or(&100);
    let sum: u64 = delays_ms.iter().map(|&d| d as u64).sum();
    let delay_avg_ms = if delays_ms.is_empty() {
        100.0
    } else {
        sum as f32 / delays_ms.len() as f32
    };
    let fps_estimate = if delay_avg_ms > 0.0 {
        1000.0 / delay_avg_ms
    } else {
        10.0
    };

    Ok(RichMeta {
        width,
        height,
        frame_count,
        delays_ms,
        delay_min_ms,
        delay_max_ms,
        delay_avg_ms,
        fps_estimate,
        loop_count,
        has_global_palette,
        has_transparency,
    })
}

fn delay_ms_from_image_frame(frame: &ImageFrame) -> u32 {
    let (numer, denom) = frame.delay().numer_denom_ms();
    let denom = denom.max(1);
    let ms = numer / denom;
    if ms == 0 {
        100
    } else {
        ms
    }
}

fn load_frames_with_delay(path: &Path) -> Result<(u32, u32, Vec<(RgbaImage, u32)>), String> {
    let file = File::open(path).map_err(|e| format!("打开 GIF 失败: {e}"))?;
    let decoder = GifDecoder::new(BufReader::new(file)).map_err(|e| format!("GIF 解码失败: {e}"))?;
    let frames = decoder
        .into_frames()
        .collect_frames()
        .map_err(|e| format!("读取 GIF 帧失败: {e}"))?;
    if frames.is_empty() {
        return Err("GIF 没有任何帧".into());
    }
    let first = frames[0].buffer();
    let w = first.width();
    let h = first.height();
    let out: Vec<(RgbaImage, u32)> = frames
        .into_iter()
        .map(|f| {
            let delay = delay_ms_from_image_frame(&f);
            (f.into_buffer(), delay)
        })
        .collect();
    Ok((w, h, out))
}

/// 从若干帧抽样训练**一份**全局调色板（避免每帧都跑 NeuQuant，这是原先慢的主因）。
/// `reserve_transparent` 为 true 时预留最后一个索引给透明/帧差分。
fn train_shared_palette<'a, I>(
    frames: I,
    colors: usize,
    reserve_transparent: bool,
) -> (NeuQuant, Vec<u8>, u8)
where
    I: IntoIterator<Item = &'a RgbaImage>,
{
    let colors = colors.clamp(2, 256);
    let quant_colors = if reserve_transparent {
        colors.saturating_sub(1).max(2)
    } else {
        colors
    };
    let transparent_slot = if reserve_transparent {
        (colors - 1) as u8
    } else {
        // 仍给出末槽，供源图 alpha 使用
        (quant_colors - 1) as u8
    };

    let imgs: Vec<&RgbaImage> = frames.into_iter().collect();
    let n_frames = imgs.len().max(1);
    // 最多采约 12 帧；像素再隔点取样，控制训练量
    let frame_stride = ((n_frames + 11) / 12).max(1);
    let mut sample: Vec<u8> = Vec::with_capacity(256 * 1024);
    for (fi, img) in imgs.iter().enumerate() {
        if fi % frame_stride != 0 && fi + 1 != n_frames {
            continue;
        }
        let raw = img.as_raw();
        let px = raw.len() / 4;
        let pix_stride = ((px / 12_000).max(1)).min(8);
        for pix in raw.chunks_exact(4).step_by(pix_stride) {
            if pix[3] < 128 {
                continue;
            }
            sample.extend_from_slice(pix);
        }
    }
    if sample.len() < 4 {
        sample.extend_from_slice(&[0, 0, 0, 255]);
    }
    // 样本已稀疏，sample_fac 取较小值即可
    let nq = NeuQuant::new(1, quant_colors, &sample);
    let map = nq.color_map_rgb();
    let mut palette = vec![0u8; colors * 3];
    palette[..quant_colors * 3].copy_from_slice(&map[..quant_colors * 3]);
    (nq, palette, transparent_slot)
}

fn map_index_opaque(nq: &NeuQuant, pix: &[u8], transparent_slot: u8) -> u8 {
    let idx = nq.index_of(pix) as u8;
    if idx == transparent_slot {
        0
    } else {
        idx
    }
}

fn map_frame_to_indices(
    img: &RgbaImage,
    nq: &NeuQuant,
    palette: &[u8],
    transparent_slot: u8,
    dither: bool,
) -> Vec<u8> {
    let w = img.width() as usize;
    let h = img.height() as usize;
    let raw = img.as_raw();
    let mut indices = vec![0u8; w * h];

    if !dither {
        for (i, pix) in raw.chunks_exact(4).enumerate() {
            if pix[3] < 128 {
                indices[i] = transparent_slot;
            } else {
                indices[i] = map_index_opaque(nq, pix, transparent_slot);
            }
        }
        return indices;
    }

    let mut rbuf = vec![0.0f32; w * h];
    let mut gbuf = vec![0.0f32; w * h];
    let mut bbuf = vec![0.0f32; w * h];
    let mut abuf = vec![0u8; w * h];
    for (i, pix) in raw.chunks_exact(4).enumerate() {
        rbuf[i] = pix[0] as f32;
        gbuf[i] = pix[1] as f32;
        bbuf[i] = pix[2] as f32;
        abuf[i] = pix[3];
    }

    for y in 0..h {
        for x in 0..w {
            let i = y * w + x;
            if abuf[i] < 128 {
                indices[i] = transparent_slot;
                continue;
            }
            let pr = rbuf[i].clamp(0.0, 255.0).round() as u8;
            let pg = gbuf[i].clamp(0.0, 255.0).round() as u8;
            let pb = bbuf[i].clamp(0.0, 255.0).round() as u8;
            let pix = [pr, pg, pb, 255];
            let idx = map_index_opaque(nq, &pix, transparent_slot);
            indices[i] = idx;
            let oi = (idx as usize) * 3;
            let er = rbuf[i] - palette[oi] as f32;
            let eg = gbuf[i] - palette[oi + 1] as f32;
            let eb = bbuf[i] - palette[oi + 2] as f32;
            let mut diffuse = |rx: usize, ry: usize, factor: f32| {
                if ry < h && rx < w {
                    let j = ry * w + rx;
                    if abuf[j] >= 128 {
                        rbuf[j] += er * factor;
                        gbuf[j] += eg * factor;
                        bbuf[j] += eb * factor;
                    }
                }
            };
            diffuse(x + 1, y, 7.0 / 16.0);
            if x > 0 {
                diffuse(x - 1, y + 1, 3.0 / 16.0);
            }
            diffuse(x, y + 1, 5.0 / 16.0);
            diffuse(x + 1, y + 1, 1.0 / 16.0);
        }
    }

    indices
}

/// 有损 0–200 → 调色板 RGB 平方距离阈值；超过则视为「像素变了」。
fn lossy_to_dist_sq(lossy: u32) -> u32 {
    let l = lossy.min(200);
    if l == 0 {
        return 0;
    }
    // 经验映射：30≈轻、80≈中、150≈重（相对 255 色差）
    let t = (l as f32) * 0.55;
    (t * t) as u32
}

/// 有损越高，量化前色阶越粗（8→更少有效 bit）。
fn lossy_to_posterize_bits(lossy: u32) -> u8 {
    match lossy.min(200) {
        0..=20 => 8,
        21..=50 => 7,
        51..=100 => 6,
        101..=150 => 5,
        _ => 4,
    }
}

fn posterize_image(img: &mut RgbaImage, bits: u8) {
    if bits >= 8 {
        return;
    }
    let shift = 8 - bits;
    let mask = !(((1u8 << shift) - 1));
    for p in img.pixels_mut() {
        p.0[0] &= mask;
        p.0[1] &= mask;
        p.0[2] &= mask;
    }
}

fn palette_dist_sq(palette: &[u8], a: u8, b: u8) -> u32 {
    if a == b {
        return 0;
    }
    let ai = (a as usize) * 3;
    let bi = (b as usize) * 3;
    if ai + 2 >= palette.len() || bi + 2 >= palette.len() {
        return u32::MAX;
    }
    let dr = palette[ai] as i32 - palette[bi] as i32;
    let dg = palette[ai + 1] as i32 - palette[bi + 1] as i32;
    let db = palette[ai + 2] as i32 - palette[bi + 2] as i32;
    (dr * dr + dg * dg + db * db) as u32
}

/// 有损帧间合并：色差小于阈值时沿用上一帧索引，显著扩大「未变化」区域。
fn apply_lossy_coalesce(
    prev: &[u8],
    curr: &mut [u8],
    palette: &[u8],
    max_dist_sq: u32,
) {
    if max_dist_sq == 0 || prev.len() != curr.len() {
        return;
    }
    for i in 0..curr.len() {
        if prev[i] == curr[i] {
            continue;
        }
        if palette_dist_sq(palette, prev[i], curr[i]) <= max_dist_sq {
            curr[i] = prev[i];
        }
    }
}

/// 相对上一帧做脏矩形；完全相同返回 None（调用方合并 delay）。
fn diff_crop(
    prev: &[u8],
    curr: &[u8],
    width: usize,
    height: usize,
    transparent: u8,
) -> Option<(u16, u16, u16, u16, Vec<u8>)> {
    debug_assert_eq!(prev.len(), width * height);
    debug_assert_eq!(curr.len(), width * height);
    if prev == curr {
        return None;
    }
    let mut min_x = width;
    let mut min_y = height;
    let mut max_x = 0usize;
    let mut max_y = 0usize;
    for y in 0..height {
        let row = y * width;
        for x in 0..width {
            if prev[row + x] != curr[row + x] {
                min_x = min_x.min(x);
                min_y = min_y.min(y);
                max_x = max_x.max(x);
                max_y = max_y.max(y);
            }
        }
    }
    if min_x > max_x {
        return None;
    }
    let cw = max_x - min_x + 1;
    let ch = max_y - min_y + 1;
    let mut cropped = vec![transparent; cw * ch];
    for y in 0..ch {
        for x in 0..cw {
            let sx = min_x + x;
            let sy = min_y + y;
            let si = sy * width + sx;
            if prev[si] != curr[si] {
                cropped[y * cw + x] = curr[si];
            }
        }
    }
    Some((
        min_x as u16,
        min_y as u16,
        cw as u16,
        ch as u16,
        cropped,
    ))
}

fn encode_gif_bytes(
    width: u16,
    height: u16,
    palette: &[u8],
    frames: &[(Vec<u8>, u32)],
    transparent_slot: u8,
    frame_diff: bool,
    lossy_dist_sq: u32,
    job_id: &str,
    path: &str,
    on_progress: &Option<ProgressCallback>,
) -> Result<(Vec<u8>, u32), String> {
    if frames.is_empty() {
        return Err("没有可编码的帧".into());
    }
    let total = frames.len() as u32;
    let mut out = Cursor::new(Vec::new());
    let mut encoder = gif::Encoder::new(&mut out, width, height, palette)
        .map_err(|e| format!("创建 GIF 编码器失败: {e}"))?;
    encoder
        .set_repeat(gif::Repeat::Infinite)
        .map_err(|e| format!("设置循环失败: {e}"))?;

    // 延迟写出，便于把「完全相同」的后续帧 delay 合并进上一帧
    struct Pending {
        left: u16,
        top: u16,
        w: u16,
        h: u16,
        buffer: Vec<u8>,
        delay_ms: u32,
    }

    let mut written = 0u32;
    let mut prev_full: Option<Vec<u8>> = None;
    let mut pending: Option<Pending> = None;

    let flush_pending = |encoder: &mut gif::Encoder<&mut Cursor<Vec<u8>>>,
                         pending: &mut Option<Pending>,
                         written: &mut u32,
                         transparent_slot: u8|
     -> Result<(), String> {
        if let Some(p) = pending.take() {
            let delay_cs = ((p.delay_ms + 5) / 10).min(u16::MAX as u32) as u16;
            let mut frame = gif::Frame::from_indexed_pixels(
                p.w,
                p.h,
                p.buffer,
                Some(transparent_slot),
            );
            frame.left = p.left;
            frame.top = p.top;
            frame.delay = delay_cs.max(1);
            frame.dispose = gif::DisposalMethod::Keep;
            encoder
                .write_frame(&frame)
                .map_err(|e| format!("写入 GIF 帧失败: {e}"))?;
            *written += 1;
        }
        Ok(())
    };

    for (index, (indices, delay_ms)) in frames.iter().enumerate() {
        let current = (index + 1) as u32;
        let percent = 88.0 + (current as f32 / total.max(1) as f32) * 10.0;
        emit_progress(
            on_progress,
            job_id,
            path,
            "pack",
            current,
            total,
            percent,
            &format!("写入帧 {current}/{total}"),
        );

        let mut curr = indices.clone();
        if frame_diff {
            if let Some(prev) = prev_full.as_deref() {
                apply_lossy_coalesce(prev, &mut curr, palette, lossy_dist_sq);
                if prev == curr.as_slice() {
                    if let Some(p) = pending.as_mut() {
                        p.delay_ms = p.delay_ms.saturating_add(*delay_ms);
                    }
                    continue;
                }
                match diff_crop(prev, &curr, width as usize, height as usize, transparent_slot) {
                    None => {
                        if let Some(p) = pending.as_mut() {
                            p.delay_ms = p.delay_ms.saturating_add(*delay_ms);
                        }
                        continue;
                    }
                    Some((left, top, cw, ch, cropped)) => {
                        flush_pending(
                            &mut encoder,
                            &mut pending,
                            &mut written,
                            transparent_slot,
                        )?;
                        pending = Some(Pending {
                            left,
                            top,
                            w: cw,
                            h: ch,
                            buffer: cropped,
                            delay_ms: *delay_ms,
                        });
                        prev_full = Some(curr);
                        continue;
                    }
                }
            }
        }

        flush_pending(
            &mut encoder,
            &mut pending,
            &mut written,
            transparent_slot,
        )?;
        pending = Some(Pending {
            left: 0,
            top: 0,
            w: width,
            h: height,
            buffer: curr.clone(),
            delay_ms: *delay_ms,
        });
        prev_full = Some(curr);
    }

    flush_pending(
        &mut encoder,
        &mut pending,
        &mut written,
        transparent_slot,
    )?;
    drop(encoder);
    if written == 0 {
        return Err("没有可编码的帧".into());
    }
    Ok((out.into_inner(), written))
}

pub fn compress_gif(
    path: &str,
    options: GifCompressOptions,
    job_id: &str,
    on_progress: Option<ProgressCallback>,
) -> Result<GifCompressResult, String> {
    let p = Path::new(path);
    if !p.is_file() {
        return Err(format!("文件不存在: {path}"));
    }

    let frame_step = options.frame_step.unwrap_or(0) as usize;
    let colors = options.colors.unwrap_or(64).clamp(2, 256) as usize;
    let dither = options.dither.unwrap_or(false);
    let delay_mode = DelayMode::from_option(options.delay_mode.as_deref());
    let fixed_delay_ms = options.fixed_delay_ms.unwrap_or(100).max(10);
    let lossy = options.lossy.unwrap_or(40).min(200);
    let lossy_dist_sq = lossy_to_dist_sq(lossy);
    let posterize_bits = lossy_to_posterize_bits(lossy);

    emit_progress(
        &on_progress,
        job_id,
        path,
        "load",
        0,
        1,
        2.0,
        "正在读取 GIF…",
    );

    let (src_w, src_h, frames) = load_frames_with_delay(p)?;
    let target_w = options.width.unwrap_or(src_w).max(1);
    let target_h = options.height.unwrap_or(src_h).max(1);

    // frame_step=0：不抽；否则保留 N 帧后跳过 1 帧，跳过帧的 delay 合并到上一保留帧
    let selected: Vec<(RgbaImage, u32)> = if frame_step == 0 {
        frames
    } else {
        let mut out = Vec::new();
        let mut iter = frames.into_iter();
        loop {
            let mut kept = 0usize;
            while kept < frame_step {
                match iter.next() {
                    Some(frame) => {
                        out.push(frame);
                        kept += 1;
                    }
                    None => break,
                }
            }
            if kept == 0 {
                break;
            }
            if let Some((_, skip_delay)) = iter.next() {
                if let Some((_, delay)) = out.last_mut() {
                    *delay = delay.saturating_add(skip_delay).max(10);
                }
            } else {
                break;
            }
        }
        out
    };
    if selected.is_empty() {
        return Err("抽帧后没有剩余帧".into());
    }

    let total_frames = selected.len() as u32;
    emit_progress(
        &on_progress,
        job_id,
        path,
        "load",
        1,
        1,
        8.0,
        &format!("已加载 {total_frames} 帧，开始处理…"),
    );

    // 缩放 8% ~ 22%
    let resize_done = AtomicU32::new(0);
    let progress_resize = on_progress.clone();
    let job_resize = job_id.to_string();
    let path_resize = path.to_string();
    let prepared: Vec<(RgbaImage, u32)> = selected
        .into_par_iter()
        .map(|(img, delay)| {
            let mut resized = if img.width() != target_w || img.height() != target_h {
                imageops::resize(&img, target_w, target_h, FilterType::Triangle)
            } else {
                img
            };
            posterize_image(&mut resized, posterize_bits);
            let current = resize_done.fetch_add(1, Ordering::Relaxed) + 1;
            let percent = 8.0 + (current as f32 / total_frames.max(1) as f32) * 14.0;
            emit_progress(
                &progress_resize,
                &job_resize,
                &path_resize,
                "resize",
                current,
                total_frames,
                percent,
                &format!("缩放帧 {current}/{total_frames}"),
            );
            (resized, delay)
        })
        .collect();

    let frame_diff = options.frame_diff.unwrap_or(true);
    let reserve_transparent = frame_diff || prepared.len() > 1;

    emit_progress(
        &on_progress,
        job_id,
        path,
        "palette",
        0,
        1,
        24.0,
        "训练调色板…",
    );
    let (nq, palette, transparent_slot) =
        train_shared_palette(prepared.iter().map(|(img, _)| img), colors, reserve_transparent);
    emit_progress(
        &on_progress,
        job_id,
        path,
        "palette",
        1,
        1,
        28.0,
        "调色板就绪，开始减色…",
    );

    // 减色映射 28% ~ 88%（与 EAF「编码帧」文案对齐）
    let encode_done = AtomicU32::new(0);
    let progress_encode = on_progress.clone();
    let job_encode = job_id.to_string();
    let path_encode = path.to_string();
    let encoded_frames: Vec<(Vec<u8>, u32)> = prepared
        .into_par_iter()
        .map(|(img, delay)| {
            let indices =
                map_frame_to_indices(&img, &nq, &palette, transparent_slot, dither);
            let current = encode_done.fetch_add(1, Ordering::Relaxed) + 1;
            let percent = 28.0 + (current as f32 / total_frames.max(1) as f32) * 60.0;
            emit_progress(
                &progress_encode,
                &job_encode,
                &path_encode,
                "encode",
                current,
                total_frames,
                percent,
                &format!("编码帧 {current}/{total_frames}"),
            );
            let out_delay = if delay_mode == DelayMode::Fixed {
                fixed_delay_ms
            } else {
                delay
            };
            (indices, out_delay)
        })
        .collect();

    let (bytes, written_frames) = encode_gif_bytes(
        target_w as u16,
        target_h as u16,
        &palette,
        &encoded_frames,
        transparent_slot,
        frame_diff,
        lossy_dist_sq,
        job_id,
        path,
        &on_progress,
    )?;
    let byte_length = bytes.len() as u64;
    let frame_count = written_frames;
    let gif_base64 = B64.encode(&bytes);

    emit_progress(
        &on_progress,
        job_id,
        path,
        "done",
        frame_count,
        frame_count,
        100.0,
        "完成",
    );

    Ok(GifCompressResult {
        width: target_w,
        height: target_h,
        frame_count,
        byte_length,
        gif_base64,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn write_tiny_anim_gif(path: &Path) {
        let mut out = Vec::new();
        {
            let palette = [0u8, 0, 0, 255, 255, 255];
            let mut enc =
                gif::Encoder::new(&mut out, 4, 4, &palette).expect("encoder");
            enc.set_repeat(gif::Repeat::Infinite).unwrap();
            for (fill, delay_cs) in [(0u8, 10u16), (1u8, 20u16), (0u8, 10u16), (1u8, 20u16)] {
                let pixels = vec![fill; 16];
                let mut frame =
                    gif::Frame::from_palette_pixels(4, 4, pixels, palette.to_vec(), None);
                frame.delay = delay_cs;
                enc.write_frame(&frame).unwrap();
            }
        }
        let mut f = File::create(path).expect("create gif");
        f.write_all(&out).expect("write gif");
    }

    #[test]
    fn probe_and_compress_smoke() {
        let dir = std::env::temp_dir().join("wheat_gifcompress_smoke");
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("tiny.gif");
        write_tiny_anim_gif(&path);
        let path_str = path.to_string_lossy().to_string();

        let probe = probe_gif_rich(&path_str).expect("probe");
        assert_eq!(probe.width, 4);
        assert_eq!(probe.height, 4);
        assert_eq!(probe.frame_count, 4);
        assert_eq!(probe.loop_count, Some(0));
        assert_eq!(probe.delays_ms.len(), 4);

        // 每隔 1 帧跳过 1 帧：4 帧 → 保留 2
        let out = compress_gif(
            &path_str,
            GifCompressOptions {
                frame_step: Some(1),
                width: Some(4),
                height: Some(4),
                colors: Some(32),
                dither: Some(false),
                delay_mode: Some("keep".into()),
                fixed_delay_ms: None,
                frame_diff: Some(true),
                lossy: Some(40),
            },
            "test-job",
            None,
        )
        .expect("compress");
        assert!(out.frame_count >= 1);
        assert!(out.byte_length > 0);
        assert!(out.gif_base64.starts_with("R0lG"));
    }
}
