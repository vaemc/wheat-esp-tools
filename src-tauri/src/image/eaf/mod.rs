//! GIF → EAF 转换（对齐 esp_lv_eaf_player 格式）

use color_quant::NeuQuant;
// 使用 `::image` 避免与 crate 根模块 `mod image` 同名冲突
use ::image::codecs::gif::GifDecoder;
use ::image::codecs::jpeg::JpegEncoder;
use ::image::imageops::{self, FilterType};
use ::image::{AnimationDecoder, DynamicImage, Frame, ImageEncoder, RgbaImage};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::hash::{Hash, Hasher};
use std::io::{BufReader, Cursor};
use std::path::Path;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EafConvertOptions {
    pub width: Option<u32>,
    pub height: Option<u32>,
    /// 分片高度；0 = 整帧一条带（blocks=1，减少 JPEG 条带头开销）
    pub split_height: Option<u32>,
    /// 4 | 8 | 24
    pub color_depth: Option<u8>,
    /// "rle" | "rle_huffman" | "jpeg"
    pub encoding_mode: Option<String>,
    /// JPEG 质量 11–100
    pub jpeg_quality: Option<u8>,
    /// 抽帧：0=不抽；否则保留 N 帧后丢弃 1 帧
    pub frame_step: Option<u32>,
    /// 近似帧合并阈值（0=仅精确相同）。采样像素的平均 |ΔRGB|/3，≤阈值则复用上一唯一帧 payload
    pub similar_threshold: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GifProbeResult {
    pub path: String,
    pub file_name: String,
    pub width: u32,
    pub height: u32,
    pub frame_count: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EafConvertResult {
    pub width: u32,
    pub height: u32,
    pub frame_count: u32,
    pub split_height: u32,
    pub color_depth: u8,
    pub encoding_mode: String,
    pub size_bytes: u32,
    /// Temporary .eaf path for the frontend to read (avoids base64 round-trip)
    pub eaf_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EafProgressEvent {
    pub job_id: String,
    pub path: String,
    /// load | encode | pack | done
    pub stage: String,
    pub current: u32,
    pub total: u32,
    pub percent: f32,
    pub message: String,
}

pub type ProgressCallback = Arc<dyn Fn(EafProgressEvent) + Send + Sync>;

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
        cb(EafProgressEvent {
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

const ENC_RLE: u8 = 0;
const ENC_HUFFMAN_RLE: u8 = 1;
const ENC_JPEG: u8 = 2;

/// JPEG 整帧一条带时常用的 block_height（≥ 实际高度即可）
const FULL_FRAME_JPEG_BLOCK_HEIGHT: u32 = 512;

fn u16_le(n: u16) -> [u8; 2] {
    n.to_le_bytes()
}

fn hash_rgba(raw: &[u8]) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    raw.hash(&mut hasher);
    hasher.finish()
}

/// 采样比较两帧相似度；threshold 为平均每通道差（0–255 量级）
fn frames_similar(a: &[u8], b: &[u8], threshold: u32) -> bool {
    if a.len() != b.len() || a.is_empty() {
        return false;
    }
    if threshold == 0 {
        return a == b;
    }
    // 每 4 个像素采样一次，降低开销
    let step = 16usize; // RGBA * 4
    let mut sum: u64 = 0;
    let mut count: u64 = 0;
    let mut i = 0usize;
    while i + 3 < a.len() {
        let dr = (a[i] as i16 - b[i] as i16).unsigned_abs() as u64;
        let dg = (a[i + 1] as i16 - b[i + 1] as i16).unsigned_abs() as u64;
        let db = (a[i + 2] as i16 - b[i + 2] as i16).unsigned_abs() as u64;
        sum += (dr + dg + db) / 3;
        count += 1;
        i += step;
    }
    if count == 0 {
        return true;
    }
    ((sum / count) as u32) <= threshold
}

fn select_frames_by_step(frames: Vec<RgbaImage>, frame_step: usize) -> Vec<RgbaImage> {
    if frame_step == 0 || frames.len() <= 1 {
        return frames;
    }
    let mut out = Vec::with_capacity(frames.len());
    let mut iter = frames.into_iter();
    while let Some(first) = iter.next() {
        out.push(first);
        let mut kept = 1usize;
        while kept < frame_step {
            match iter.next() {
                Some(f) => {
                    out.push(f);
                    kept += 1;
                }
                None => return out,
            }
        }
        // drop 1 frame
        let _ = iter.next();
    }
    out
}

fn resolve_split_height(requested: u32, frame_height: u32, jpeg: bool) -> u32 {
    if requested == 0 {
        if jpeg {
            // blocks=1：bh≥高度即可；取常用 512 便于与常见 EAF 资源一致
            frame_height.max(FULL_FRAME_JPEG_BLOCK_HEIGHT)
        } else {
            frame_height.max(1)
        }
    } else {
        requested.max(1)
    }
}

fn u32_le(n: u32) -> [u8; 4] {
    n.to_le_bytes()
}

fn checksum(data: &[u8]) -> u32 {
    data.iter().fold(0u32, |acc, b| acc.wrapping_add(*b as u32))
}

struct HuffmanNode {
    freq: u32,
    byte: Option<u8>,
    left: Option<Box<HuffmanNode>>,
    right: Option<Box<HuffmanNode>>,
}

impl PartialEq for HuffmanNode {
    fn eq(&self, other: &Self) -> bool {
        self.freq == other.freq
    }
}
impl Eq for HuffmanNode {}
impl PartialOrd for HuffmanNode {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}
impl Ord for HuffmanNode {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        // 小顶堆：频率小的优先
        other.freq.cmp(&self.freq)
    }
}

fn rle_encode(data: &[u8]) -> Vec<u8> {
    if data.is_empty() {
        return Vec::new();
    }
    let mut out = Vec::new();
    let mut prev = data[0];
    let mut count: u8 = 1;
    for &b in &data[1..] {
        if b == prev && count < 255 {
            count += 1;
        } else {
            out.push(count);
            out.push(prev);
            prev = b;
            count = 1;
        }
    }
    out.push(count);
    out.push(prev);
    out
}

fn build_huffman_codes(data: &[u8]) -> HashMap<u8, String> {
    let mut freq = [0u32; 256];
    for &b in data {
        freq[b as usize] += 1;
    }
    let mut heap: std::collections::BinaryHeap<HuffmanNode> = freq
        .iter()
        .enumerate()
        .filter(|(_, &f)| f > 0)
        .map(|(b, &f)| HuffmanNode {
            freq: f,
            byte: Some(b as u8),
            left: None,
            right: None,
        })
        .collect();

    if heap.is_empty() {
        return HashMap::new();
    }
    if heap.len() == 1 {
        let only = heap.pop().unwrap();
        let mut map = HashMap::new();
        map.insert(only.byte.unwrap_or(0), "0".to_string());
        return map;
    }

    while heap.len() > 1 {
        let a = heap.pop().unwrap();
        let b = heap.pop().unwrap();
        heap.push(HuffmanNode {
            freq: a.freq + b.freq,
            byte: None,
            left: Some(Box::new(a)),
            right: Some(Box::new(b)),
        });
    }
    let root = heap.pop().unwrap();
    let mut map = HashMap::new();
    fn walk(node: &HuffmanNode, prefix: String, map: &mut HashMap<u8, String>) {
        if let Some(b) = node.byte {
            map.insert(b, if prefix.is_empty() { "0".into() } else { prefix });
            return;
        }
        if let Some(ref left) = node.left {
            walk(left, format!("{prefix}0"), map);
        }
        if let Some(ref right) = node.right {
            walk(right, format!("{prefix}1"), map);
        }
    }
    walk(&root, String::new(), &mut map);
    map
}

fn huffman_encode(data: &[u8]) -> (Vec<u8>, Vec<u8>) {
    if data.is_empty() {
        return (Vec::new(), vec![0]);
    }
    let codes = build_huffman_codes(data);
    let mut bits = String::new();
    for &b in data {
        bits.push_str(codes.get(&b).map(|s| s.as_str()).unwrap_or("0"));
    }
    let padding = (8 - (bits.len() % 8)) % 8;
    bits.push_str(&"0".repeat(padding));

    let mut compressed = Vec::with_capacity(bits.len() / 8);
    for chunk in bits.as_bytes().chunks(8) {
        let s = std::str::from_utf8(chunk).unwrap_or("00000000");
        compressed.push(u8::from_str_radix(s, 2).unwrap_or(0));
    }

    let mut dict = vec![padding as u8];
    for (&byte, code) in &codes {
        dict.push(byte);
        dict.push(code.len() as u8);
        let byte_len = (code.len() + 7) / 8;
        let value = u64::from_str_radix(code, 2).unwrap_or(0);
        for i in (0..byte_len).rev() {
            dict.push(((value >> (i * 8)) & 0xff) as u8);
        }
    }
    (compressed, dict)
}

fn encode_block_payload(raw: &[u8], mode: &str) -> Vec<u8> {
    let rle = rle_encode(raw);
    if mode == "rle" {
        let mut out = vec![ENC_RLE];
        out.extend_from_slice(&rle);
        return out;
    }
    // rle_huffman：选更小的
    let (compressed, dict) = huffman_encode(&rle);
    let mut huff = vec![ENC_HUFFMAN_RLE];
    huff.extend_from_slice(&u16_le(dict.len() as u16));
    huff.extend_from_slice(&dict);
    huff.extend_from_slice(&compressed);

    let mut rle_payload = vec![ENC_RLE];
    rle_payload.extend_from_slice(&rle);

    if huff.len() < rle_payload.len() {
        huff
    } else {
        rle_payload
    }
}

fn build_frame_header(
    width: u16,
    height: u16,
    blocks: u16,
    block_height: u16,
    bit_depth: u8,
    block_lens: &[u32],
) -> Vec<u8> {
    let mut head = Vec::with_capacity(18 + block_lens.len() * 4);
    head.extend_from_slice(&[0x5f, 0x53, 0x00]); // `_S\0`
    head.extend_from_slice(&[0x00, 0x00, 0x00, 0x00, 0x00, 0x01]); // version-ish
    head.push(bit_depth);
    head.extend_from_slice(&u16_le(width));
    head.extend_from_slice(&u16_le(height));
    head.extend_from_slice(&u16_le(blocks));
    head.extend_from_slice(&u16_le(block_height));
    for &len in block_lens {
        head.extend_from_slice(&u32_le(len));
    }
    head
}

fn pack_indices_4(indices: &[u8], width: u32, height: u32) -> Vec<u8> {
    let row_bytes = ((width as usize) + 1) / 2;
    let mut out = vec![0u8; row_bytes * height as usize];
    for y in 0..height as usize {
        for x in (0..width as usize).step_by(2) {
            let i0 = indices[y * width as usize + x] & 0x0f;
            let i1 = if x + 1 < width as usize {
                indices[y * width as usize + x + 1] & 0x0f
            } else {
                0
            };
            out[y * row_bytes + (x / 2)] = (i0 << 4) | i1;
        }
    }
    out
}

fn gray_palette_4() -> Vec<u8> {
    let mut pal = Vec::with_capacity(64);
    for i in 0..16u32 {
        let g = ((i * 255) / 15) as u8;
        pal.extend_from_slice(&[g, g, g, 255]); // BGRA
    }
    pal
}

fn quantize_gray4(img: &RgbaImage) -> (Vec<u8>, Vec<u8>) {
    let w = img.width() as usize;
    let h = img.height() as usize;
    let mut buffer = vec![0f32; w * h];
    for (i, p) in img.pixels().enumerate() {
        let [r, g, b, _] = p.0;
        buffer[i] = 0.299 * r as f32 + 0.587 * g as f32 + 0.114 * b as f32;
    }
    let mut indices = vec![0u8; w * h];
    for y in 0..h {
        for x in 0..w {
            let i = y * w + x;
            let old = buffer[i];
            let level = ((old / 255.0) * 15.0).round().clamp(0.0, 15.0) as u8;
            indices[i] = level;
            let neu = (level as f32 * 255.0) / 15.0;
            let err = old - neu;
            if x + 1 < w {
                buffer[i + 1] += err * 7.0 / 16.0;
            }
            if y + 1 < h {
                if x > 0 {
                    buffer[i + w - 1] += err * 3.0 / 16.0;
                }
                buffer[i + w] += err * 5.0 / 16.0;
                if x + 1 < w {
                    buffer[i + w + 1] += err * 1.0 / 16.0;
                }
            }
        }
    }
    (indices, gray_palette_4())
}

fn neuquant_to_bgra_palette(nq: &NeuQuant) -> Vec<u8> {
    let map = nq.color_map_rgba(); // RGBA * 256
    let mut palette = vec![0u8; 1024];
    for i in 0..256 {
        let o = i * 4;
        // store BGRA
        palette[o] = map[o + 2];
        palette[o + 1] = map[o + 1];
        palette[o + 2] = map[o];
        palette[o + 3] = map[o + 3];
    }
    palette
}

fn map_indices_nq(img: &RgbaImage, nq: &NeuQuant) -> Vec<u8> {
    img.as_raw()
        .chunks_exact(4)
        .map(|pix| nq.index_of(pix) as u8)
        .collect()
}

/// 从多帧抽样训练一份全局 8bit 调色板（避免每帧 NeuQuant）
fn train_shared_palette8<'a, I>(frames: I) -> (NeuQuant, Vec<u8>)
where
    I: IntoIterator<Item = &'a RgbaImage>,
{
    let imgs: Vec<&RgbaImage> = frames.into_iter().collect();
    let n_frames = imgs.len().max(1);
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
            sample.extend_from_slice(pix);
        }
    }
    if sample.len() < 4 {
        sample.extend_from_slice(&[0, 0, 0, 255]);
    }
    let nq = NeuQuant::new(1, 256, &sample);
    let palette = neuquant_to_bgra_palette(&nq);
    (nq, palette)
}

fn encode_jpeg_rgb(img: &RgbaImage, quality: u8) -> Result<Vec<u8>, String> {
    let rgb = DynamicImage::ImageRgba8(img.clone()).to_rgb8();
    let mut buf = Cursor::new(Vec::new());
    let enc = JpegEncoder::new_with_quality(&mut buf, quality);
    enc.write_image(
        rgb.as_raw(),
        rgb.width(),
        rgb.height(),
        ::image::ExtendedColorType::Rgb8,
    )
    .map_err(|e| format!("JPEG encode failed: {e}"))?;
    Ok(buf.into_inner())
}

fn encode_jpeg_frame(
    img: &RgbaImage,
    split_height: u32,
    jpeg_quality: u8,
) -> Result<Vec<u8>, String> {
    let width = img.width();
    let height = img.height();
    let blocks = ((height + split_height - 1) / split_height) as u16;
    let mut chunks: Vec<Vec<u8>> = Vec::new();
    let mut lens: Vec<u32> = Vec::new();

    for i in 0..blocks as u32 {
        let y = i * split_height;
        let h = (height - y).min(split_height);
        let strip = imageops::crop_imm(img, 0, y, width, h).to_image();
        let jpeg = encode_jpeg_rgb(&strip, jpeg_quality)?;
        let mut block = vec![ENC_JPEG];
        block.extend_from_slice(&jpeg);
        lens.push(block.len() as u32);
        chunks.push(block);
    }

    let mut out = build_frame_header(
        width as u16,
        height as u16,
        blocks,
        split_height as u16,
        24,
        &lens,
    );
    for c in chunks {
        out.extend_from_slice(&c);
    }
    Ok(out)
}

fn encode_indexed_from_indices(
    width: u32,
    height: u32,
    indices: &[u8],
    palette: &[u8],
    split_height: u32,
    bit_depth: u8,
    mode: &str,
) -> Vec<u8> {
    let blocks = ((height + split_height - 1) / split_height) as u16;
    let mut chunks: Vec<Vec<u8>> = Vec::new();
    let mut lens: Vec<u32> = Vec::new();

    for i in 0..blocks as u32 {
        let y0 = i * split_height;
        let h = (height - y0).min(split_height);
        let start = (y0 * width) as usize;
        let end = ((y0 + h) * width) as usize;
        let slice = &indices[start..end];
        let packed = if bit_depth == 4 {
            pack_indices_4(slice, width, h)
        } else {
            slice.to_vec()
        };
        let payload = encode_block_payload(&packed, mode);
        lens.push(payload.len() as u32);
        chunks.push(payload);
    }

    let mut out = build_frame_header(
        width as u16,
        height as u16,
        blocks,
        split_height as u16,
        bit_depth,
        &lens,
    );
    out.extend_from_slice(palette);
    for c in chunks {
        out.extend_from_slice(&c);
    }
    out
}

fn encode_indexed_frame(
    img: &RgbaImage,
    split_height: u32,
    bit_depth: u8,
    mode: &str,
) -> Result<Vec<u8>, String> {
    // 8-bit uses shared NeuQuant in convert_gif_to_eaf; this path is 4-bit gray
    if bit_depth != 4 {
        return Err(format!("encode_indexed_frame expects 4-bit, got {bit_depth}"));
    }
    let width = img.width();
    let height = img.height();
    let (indices, palette) = quantize_gray4(img);
    Ok(encode_indexed_from_indices(
        width,
        height,
        &indices,
        &palette,
        split_height,
        bit_depth,
        mode,
    ))
}

fn write_temp_eaf(bytes: &[u8]) -> Result<String, String> {
    let millis = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let mut path = std::env::temp_dir();
    path.push(format!("wheat-eaf-{}-{}.eaf", std::process::id(), millis));
    std::fs::write(&path, bytes).map_err(|e| format!("写入临时 EAF 失败: {e}"))?;
    Ok(path.to_string_lossy().into_owned())
}

/// 选出需要实际编码的帧：精确相同 / 近似帧复用已编码结果
fn plan_unique_frames(
    resized: &[RgbaImage],
    similar_threshold: u32,
) -> (Vec<Option<usize>>, Vec<usize>) {
    let mut reuse_of: Vec<Option<usize>> = vec![None; resized.len()];
    let mut encode_indices: Vec<usize> = Vec::new();
    let mut exact: HashMap<u64, usize> = HashMap::new();
    let mut last_unique: Option<usize> = None;

    for (i, img) in resized.iter().enumerate() {
        let raw = img.as_raw();
        let key = hash_rgba(raw);
        if let Some(&prev) = exact.get(&key) {
            reuse_of[i] = Some(prev);
            continue;
        }
        if similar_threshold > 0 {
            if let Some(prev) = last_unique {
                if frames_similar(raw, resized[prev].as_raw(), similar_threshold) {
                    reuse_of[i] = Some(prev);
                    exact.insert(key, prev);
                    continue;
                }
            }
        }
        exact.insert(key, i);
        last_unique = Some(i);
        encode_indices.push(i);
    }
    (reuse_of, encode_indices)
}

fn pack_eaf_container(frame_payloads: &[Vec<u8>]) -> Vec<u8> {
    // 按内容去重
    let mut unique: HashMap<Vec<u8>, (u32, u32)> = HashMap::new();
    let mut parts: Vec<Vec<u8>> = Vec::new();
    let mut offset: u32 = 0;
    let mut table_entries: Vec<(u32, u32)> = Vec::new();

    for payload in frame_payloads {
        if let Some(&(off, size)) = unique.get(payload) {
            table_entries.push((size, off));
            continue;
        }
        let mut prefixed = vec![0x5au8, 0x5a];
        prefixed.extend_from_slice(payload);
        let size = prefixed.len() as u32;
        unique.insert(payload.clone(), (offset, size));
        table_entries.push((size, offset));
        parts.push(prefixed);
        offset += size;
    }

    let mut table = Vec::with_capacity(table_entries.len() * 8);
    for &(size, off) in &table_entries {
        table.extend_from_slice(&u32_le(size));
        table.extend_from_slice(&u32_le(off));
    }
    let mut body = table;
    for p in parts {
        body.extend_from_slice(&p);
    }
    let chk = checksum(&body);
    let mut out = vec![0x89, b'E', b'A', b'F'];
    out.extend_from_slice(&u32_le(table_entries.len() as u32));
    out.extend_from_slice(&u32_le(chk));
    out.extend_from_slice(&u32_le(body.len() as u32));
    out.extend_from_slice(&body);
    out
}

fn load_gif_frames(path: &Path) -> Result<(u32, u32, Vec<RgbaImage>), String> {
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
    let images: Vec<RgbaImage> = frames.into_iter().map(Frame::into_buffer).collect();
    Ok((w, h, images))
}

/// 仅解析 GIF 头与块结构，不解码像素（打开列表时可快速返回）
fn probe_gif_meta(data: &[u8]) -> Result<(u32, u32, u32), String> {
    if data.len() < 13 || &data[0..3] != b"GIF" {
        return Err("不是有效的 GIF 文件".into());
    }
    let width = u16::from_le_bytes([data[6], data[7]]) as u32;
    let height = u16::from_le_bytes([data[8], data[9]]) as u32;
    if width == 0 || height == 0 {
        return Err("GIF 尺寸无效".into());
    }

    let packed = data[10];
    let mut i = 13usize;
    if packed & 0x80 != 0 {
        let gct_size = 3 * (1 << ((packed & 0x07) + 1));
        i = i
            .checked_add(gct_size)
            .ok_or_else(|| "GIF 全局色表越界".to_string())?;
        if i > data.len() {
            return Err("GIF 全局色表不完整".into());
        }
    }

    let mut frame_count = 0u32;
    while i < data.len() {
        match data[i] {
            0x3B => break, // trailer
            0x21 => {
                // extension
                i += 1;
                if i >= data.len() {
                    break;
                }
                i += 1; // label
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
                // image descriptor
                frame_count += 1;
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
                // LZW minimum code size
                if i >= data.len() {
                    return Err("GIF 图像数据不完整".into());
                }
                i += 1;
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
                // 容错：跳过未知字节，避免直接失败
                i += 1;
            }
        }
    }

    if frame_count == 0 {
        return Err("GIF 没有任何帧".into());
    }
    Ok((width, height, frame_count))
}

pub fn probe_gif(path: &str) -> Result<GifProbeResult, String> {
    let p = Path::new(path);
    if !p.is_file() {
        return Err(format!("文件不存在: {path}"));
    }
    let data = std::fs::read(p).map_err(|e| format!("读取 GIF 失败: {e}"))?;
    let (width, height, frame_count) = probe_gif_meta(&data)?;
    let file_name = p
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string());
    Ok(GifProbeResult {
        path: path.to_string(),
        file_name,
        width,
        height,
        frame_count,
    })
}

pub fn convert_gif_to_eaf(
    path: &str,
    options: EafConvertOptions,
    job_id: &str,
    on_progress: Option<ProgressCallback>,
) -> Result<EafConvertResult, String> {
    let p = Path::new(path);
    if !p.is_file() {
        return Err(format!("文件不存在: {path}"));
    }

    let mut encoding_mode = options
        .encoding_mode
        .unwrap_or_else(|| "jpeg".into())
        .to_lowercase();
    let mut color_depth = options.color_depth.unwrap_or(24);
    let split_height_opt = options.split_height.unwrap_or(32);
    let jpeg_quality = options.jpeg_quality.unwrap_or(85).clamp(11, 100);
    let frame_step = options.frame_step.unwrap_or(0) as usize;
    let similar_threshold = options.similar_threshold.unwrap_or(1);

    if encoding_mode == "jpeg" {
        color_depth = 24;
    } else if color_depth == 24 {
        encoding_mode = "jpeg".into();
    } else if color_depth != 4 && color_depth != 8 {
        color_depth = 8;
    }

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

    let (src_w, src_h, frames) = load_gif_frames(p)?;
    let frames = select_frames_by_step(frames, frame_step);
    if frames.is_empty() {
        return Err("抽帧后没有任何帧".into());
    }
    let target_w = options.width.unwrap_or(src_w).max(1);
    let target_h = options.height.unwrap_or(src_h).max(1);
    let is_jpeg = encoding_mode == "jpeg" || color_depth == 24;
    let split_height = resolve_split_height(split_height_opt, target_h, is_jpeg);
    let total_frames = frames.len() as u32;

    emit_progress(
        &on_progress,
        job_id,
        path,
        "load",
        1,
        1,
        5.0,
        &format!("已加载 {total_frames} 帧，开始缩放…"),
    );

    // 并行缩放
    let resize_done = AtomicU32::new(0);
    let progress_resize = on_progress.clone();
    let job_resize = job_id.to_string();
    let path_resize = path.to_string();
    let resized: Vec<RgbaImage> = frames
        .into_par_iter()
        .map(|frame| {
            let out = if frame.width() != target_w || frame.height() != target_h {
                imageops::resize(&frame, target_w, target_h, FilterType::Triangle)
            } else {
                frame
            };
            let current = resize_done.fetch_add(1, Ordering::Relaxed) + 1;
            let percent = 5.0 + (current as f32 / total_frames.max(1) as f32) * 10.0;
            emit_progress(
                &progress_resize,
                &job_resize,
                &path_resize,
                "encode",
                current,
                total_frames,
                percent,
                &format!("缩放帧 {current}/{total_frames}"),
            );
            out
        })
        .collect();

    let (reuse_of, encode_indices) = plan_unique_frames(&resized, similar_threshold);
    let encode_total = encode_indices.len().max(1) as u32;

    // 8bit：全局共享调色板
    let shared8 = if !is_jpeg && color_depth == 8 {
        emit_progress(
            &on_progress,
            job_id,
            path,
            "encode",
            0,
            1,
            16.0,
            "训练共享调色板…",
        );
        Some(train_shared_palette8(encode_indices.iter().map(|&i| &resized[i])))
    } else {
        None
    };

    emit_progress(
        &on_progress,
        job_id,
        path,
        "encode",
        0,
        encode_total,
        18.0,
        &format!("并行编码 {} 帧…", encode_indices.len()),
    );

    let encode_done = AtomicU32::new(0);
    let progress_encode = on_progress.clone();
    let job_encode = job_id.to_string();
    let path_encode = path.to_string();
    let mode_owned = encoding_mode.clone();
    let nq_ref = shared8.as_ref().map(|(nq, _)| nq);
    let pal_ref = shared8.as_ref().map(|(_, pal)| pal.as_slice());

    let encoded: Vec<(usize, Vec<u8>)> = encode_indices
        .par_iter()
        .map(|&idx| -> Result<(usize, Vec<u8>), String> {
            let img = &resized[idx];
            let payload = if is_jpeg {
                encode_jpeg_frame(img, split_height, jpeg_quality)?
            } else if color_depth == 8 {
                let nq = nq_ref.expect("shared 8bit palette");
                let palette = pal_ref.expect("shared 8bit palette");
                let indices = map_indices_nq(img, nq);
                encode_indexed_from_indices(
                    img.width(),
                    img.height(),
                    &indices,
                    palette,
                    split_height,
                    8,
                    &mode_owned,
                )
            } else {
                encode_indexed_frame(img, split_height, color_depth, &mode_owned)?
            };
            let current = encode_done.fetch_add(1, Ordering::Relaxed) + 1;
            let percent = 18.0 + (current as f32 / encode_total as f32) * 74.0;
            emit_progress(
                &progress_encode,
                &job_encode,
                &path_encode,
                "encode",
                current,
                encode_total,
                percent,
                &format!("编码帧 {current}/{encode_total}"),
            );
            Ok((idx, payload))
        })
        .collect::<Result<Vec<_>, _>>()?;

    let mut unique_payloads: HashMap<usize, Vec<u8>> = HashMap::with_capacity(encoded.len());
    for (idx, payload) in encoded {
        unique_payloads.insert(idx, payload);
    }

    let mut payloads: Vec<Vec<u8>> = Vec::with_capacity(resized.len());
    for (i, reuse) in reuse_of.into_iter().enumerate() {
        let src = reuse.unwrap_or(i);
        let payload = unique_payloads
            .get(&src)
            .ok_or_else(|| format!("内部错误：缺少帧 {src} 的编码结果"))?;
        payloads.push(payload.clone());
    }

    emit_progress(
        &on_progress,
        job_id,
        path,
        "pack",
        total_frames,
        total_frames,
        95.0,
        "正在打包 EAF…",
    );

    let bytes = pack_eaf_container(&payloads);
    let eaf_path = write_temp_eaf(&bytes)?;

    emit_progress(
        &on_progress,
        job_id,
        path,
        "done",
        total_frames,
        total_frames,
        100.0,
        "完成",
    );

    Ok(EafConvertResult {
        width: target_w,
        height: target_h,
        frame_count: payloads.len() as u32,
        split_height,
        color_depth,
        encoding_mode,
        size_bytes: bytes.len() as u32,
        eaf_path,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use ::image::{Rgba, RgbaImage};

    #[test]
    fn jpeg_auto_split_is_full_frame() {
        assert_eq!(resolve_split_height(0, 360, true), 512);
        assert_eq!(resolve_split_height(0, 600, true), 600);
        assert_eq!(resolve_split_height(32, 360, true), 32);
        assert_eq!(resolve_split_height(0, 360, false), 360);
    }

    #[test]
    fn jpeg_frame_is_single_block() {
        let img = RgbaImage::from_pixel(64, 48, Rgba([10, 20, 30, 255]));
        let payload = encode_jpeg_frame(&img, 512, 55).unwrap();
        assert_eq!(&payload[0..2], b"_S");
        assert_eq!(payload[9], 24);
        let blocks = u16::from_le_bytes([payload[14], payload[15]]);
        let bh = u16::from_le_bytes([payload[16], payload[17]]);
        assert_eq!(blocks, 1);
        assert_eq!(bh, 512);
        assert_eq!(payload[18 + 4], ENC_JPEG);
    }

    #[test]
    fn similar_frames_and_frame_step() {
        let a = vec![10u8, 20, 30, 255, 11, 21, 31, 255];
        let b = vec![12u8, 22, 32, 255, 13, 23, 33, 255];
        assert!(frames_similar(&a, &b, 6));
        assert!(!frames_similar(&a, &b, 0));

        let frames: Vec<RgbaImage> = (0..5)
            .map(|i| RgbaImage::from_pixel(2, 2, Rgba([i as u8, 0, 0, 255])))
            .collect();
        // keep 2, drop 1 → [0,1], drop 2, [3,4]
        let selected = select_frames_by_step(frames, 2);
        assert_eq!(selected.len(), 4);
    }

    #[test]
    fn pack_shared_offset() {
        let p = vec![1u8, 2, 3];
        let bytes = pack_eaf_container(&[p.clone(), p]);
        assert_eq!(&bytes[0..4], &[0x89, b'E', b'A', b'F']);
        let frames = u32::from_le_bytes(bytes[4..8].try_into().unwrap());
        assert_eq!(frames, 2);
        let off0 = u32::from_le_bytes(bytes[20..24].try_into().unwrap());
        let off1 = u32::from_le_bytes(bytes[28..32].try_into().unwrap());
        assert_eq!(off0, off1);
    }
}
