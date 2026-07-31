//! 写出 [lv_font_conv](https://github.com/lvgl/lv_font_conv) 兼容的二进制字库。
//!
//! 表布局：`head` + `cmap` + `loca` + `glyf`（无 kern）。
//! 与本工具 C 导出一致：无压缩、无字距、无子像素；bpp 仅 1/2/4。

use super::cmap::CmapEntry;
use super::Glyph;

/// bin 头表需要的全局度量。
pub struct BinFontMetrics {
    pub size: u32,
    pub bpp: u8,
    pub typo_ascent: u16,
    pub typo_descent: i16,
    pub typo_line_gap: u16,
    pub underline_position: i16,
    pub underline_thickness: u16,
}

fn align4(n: usize) -> usize {
    if n % 4 == 0 {
        n
    } else {
        n + 4 - (n % 4)
    }
}

fn pad4(buf: &mut Vec<u8>) {
    let n = align4(buf.len()) - buf.len();
    buf.extend(std::iter::repeat(0u8).take(n));
}

fn unsigned_bits(val: i32) -> u8 {
    let mut v = val.max(0) as u32;
    let mut count = 0u8;
    while v != 0 {
        count = count.saturating_add(1);
        v >>= 1;
    }
    count
}

fn signed_bits(val: i32) -> u8 {
    if val >= 0 {
        unsigned_bits(val).saturating_add(1)
    } else {
        unsigned_bits(val.abs().saturating_sub(1)).saturating_add(1)
    }
}

fn push_u16_le(buf: &mut Vec<u8>, v: u16) {
    buf.extend_from_slice(&v.to_le_bytes());
}

fn push_u32_le(buf: &mut Vec<u8>, v: u32) {
    buf.extend_from_slice(&v.to_le_bytes());
}

/// MSB-first 位流（对齐 bit-buffer bigEndian）。
struct BitWriter {
    data: Vec<u8>,
    acc: u8,
    bits: u32,
}

impl BitWriter {
    fn with_capacity(cap: usize) -> Self {
        Self {
            data: Vec::with_capacity(cap),
            acc: 0,
            bits: 0,
        }
    }

    fn write_bits(&mut self, value: i32, nbits: u8) {
        if nbits == 0 {
            return;
        }
        let nbits = nbits as u32;
        let mask = if nbits >= 32 {
            u32::MAX
        } else {
            (1u32 << nbits) - 1
        };
        let mut v = (value as u32) & mask;
        let mut remaining = nbits;
        while remaining > 0 {
            let space = 8 - self.bits;
            let take = space.min(remaining);
            let shift = remaining - take;
            let chunk = ((v >> shift) & ((1u32 << take) - 1)) as u8;
            self.acc |= chunk << (space - take);
            self.bits += take;
            remaining -= take;
            v &= if shift >= 32 {
                0
            } else {
                (1u32 << shift) - 1
            };
            if self.bits == 8 {
                self.data.push(self.acc);
                self.acc = 0;
                self.bits = 0;
            }
        }
    }

    /// 将已打包的 MSB-first 位图续写到当前位流。
    fn write_packed_bits(&mut self, packed: &[u8], bit_len: usize) {
        let mut written = 0usize;
        for &byte in packed {
            if written >= bit_len {
                break;
            }
            let left = bit_len - written;
            if left >= 8 && self.bits == 0 {
                self.data.push(byte);
                written += 8;
            } else {
                let n = left.min(8) as u8;
                let v = if n == 8 {
                    byte as i32
                } else {
                    (byte >> (8 - n)) as i32
                };
                self.write_bits(v, n);
                written += n as usize;
            }
        }
    }

    fn finish(mut self) -> Vec<u8> {
        if self.bits > 0 {
            self.data.push(self.acc);
        }
        self.data
    }
}

fn advance_px(g: &Glyph) -> i32 {
    // Glyph.adv_w 为 LVGL 1/16 px；bin 无 kern 时存整像素
    ((g.adv_w as f32) / 16.0).round() as i32
}

fn compile_glyph(
    g: &Glyph,
    monospaced: bool,
    advance_bits: u8,
    xy_bits: u8,
    wh_bits: u8,
    bpp: u8,
) -> Vec<u8> {
    let pixel_bits = (g.box_w as usize)
        .saturating_mul(g.box_h as usize)
        .saturating_mul(bpp as usize);
    let header_bits = if monospaced {
        0
    } else {
        advance_bits as usize
    } + 2 * xy_bits as usize
        + 2 * wh_bits as usize;
    let mut bw = BitWriter::with_capacity((header_bits + pixel_bits + 7) / 8 + 8);

    if !monospaced {
        bw.write_bits(advance_px(g), advance_bits);
    }
    bw.write_bits(g.ofs_x as i32, xy_bits);
    bw.write_bits(g.ofs_y as i32, xy_bits);
    bw.write_bits(g.box_w as i32, wh_bits);
    bw.write_bits(g.box_h as i32, wh_bits);
    bw.write_packed_bits(&g.bitmap, pixel_bits);
    bw.finish()
}

fn build_glyf_blobs(
    glyphs: &[Glyph],
    monospaced: bool,
    advance_bits: u8,
    xy_bits: u8,
    wh_bits: u8,
    bpp: u8,
    mut on_progress: impl FnMut(u32, u32),
) -> Result<Vec<Vec<u8>>, String> {
    let total = glyphs.len() as u32;
    let mut bin_data = Vec::with_capacity(glyphs.len() + 1);
    bin_data.push(Vec::new()); // id 0 reserved

    for (idx, g) in glyphs.iter().enumerate() {
        bin_data.push(compile_glyph(
            g,
            monospaced,
            advance_bits,
            xy_bits,
            wh_bits,
            bpp,
        ));
        let written = (idx as u32) + 1;
        if written == 1 || written == total || written % 200 == 0 {
            on_progress(written, total.max(1));
        }
    }
    Ok(bin_data)
}

fn glyf_payload_size(bin_data: &[Vec<u8>]) -> usize {
    const HEAD: usize = 8; // size + label
    align4(HEAD + bin_data.iter().map(|b| b.len()).sum::<usize>())
}

fn glyph_offset(bin_data: &[Vec<u8>], id: usize) -> u32 {
    const HEAD: usize = 8;
    let mut offset = HEAD;
    for i in 0..id {
        offset += bin_data[i].len();
    }
    offset as u32
}

fn write_head(
    metrics: &BinFontMetrics,
    ascent: i16,
    descent: i16,
    min_y: i16,
    max_y: i16,
    monospaced: bool,
    def_advance: u16,
    index_to_loc_format: u8,
    glyph_id_format: u8,
    advance_width_format: u8,
    xy_bits: u8,
    wh_bits: u8,
    advance_width_bits: u8,
) -> Vec<u8> {
    // O_UNDERLINE_THICKNESS + 2 == 48，已 4 对齐
    let mut buf = vec![0u8; 48];
    buf[0..4].copy_from_slice(&48u32.to_le_bytes());
    buf[4..8].copy_from_slice(b"head");
    buf[8..12].copy_from_slice(&1u32.to_le_bytes()); // version
    buf[12..14].copy_from_slice(&3u16.to_le_bytes()); // additional tables: cmap,loca,glyf
    buf[14..16].copy_from_slice(&(metrics.size as u16).to_le_bytes());
    buf[16..18].copy_from_slice(&(ascent as u16).to_le_bytes());
    buf[18..20].copy_from_slice(&descent.to_le_bytes());
    buf[20..22].copy_from_slice(&metrics.typo_ascent.to_le_bytes());
    buf[22..24].copy_from_slice(&metrics.typo_descent.to_le_bytes());
    buf[24..26].copy_from_slice(&metrics.typo_line_gap.to_le_bytes());
    buf[26..28].copy_from_slice(&min_y.to_le_bytes());
    buf[28..30].copy_from_slice(&max_y.to_le_bytes());
    buf[30..32].copy_from_slice(&if monospaced { def_advance } else { 0 }.to_le_bytes());
    buf[32..34].copy_from_slice(&16u16.to_le_bytes()); // kerningScale FP12.4 = 1.0
    buf[34] = index_to_loc_format;
    buf[35] = glyph_id_format;
    buf[36] = advance_width_format;
    buf[37] = metrics.bpp;
    buf[38] = xy_bits;
    buf[39] = wh_bits;
    buf[40] = if monospaced { 0 } else { advance_width_bits };
    buf[41] = 0; // compression: raw
    buf[42] = 0; // subpixels none
    buf[43] = 0; // reserved
    buf[44..46].copy_from_slice(&metrics.underline_position.to_le_bytes());
    buf[46..48].copy_from_slice(&metrics.underline_thickness.to_le_bytes());
    buf
}

fn write_cmap(cmaps: &[CmapEntry]) -> Result<Vec<u8>, String> {
    const HEAD_LEN: usize = 12; // size + label + count
    let mut sub_heads: Vec<[u8; 16]> = Vec::with_capacity(cmaps.len());
    let mut sub_data: Vec<Vec<u8>> = Vec::with_capacity(cmaps.len());

    for cm in cmaps {
        let (format_code, entries_count, data) = match cm.type_name {
            "FORMAT0_TINY" => (2u8, cm.range_length as u16, Vec::new()),
            "SPARSE_TINY" => {
                let list = cm
                    .unicode_list
                    .as_ref()
                    .ok_or_else(|| "SPARSE_TINY 缺少 unicode_list".to_string())?;
                let mut raw = Vec::with_capacity(list.len() * 2);
                for &v in list {
                    push_u16_le(&mut raw, v);
                }
                pad4(&mut raw);
                (3u8, list.len() as u16, raw)
            }
            other => {
                return Err(format!("bin 不支持的 cmap 类型: {other}"));
            }
        };

        if cm.range_length > 0xffff {
            return Err("cmap range_length 超过 uint16".into());
        }
        if cm.glyph_id_start > 0xffff {
            return Err("glyph_id_start 超过 uint16".into());
        }

        let mut head = [0u8; 16];
        // offset filled later
        head[4..8].copy_from_slice(&cm.range_start.to_le_bytes());
        head[8..10].copy_from_slice(&(cm.range_length as u16).to_le_bytes());
        head[10..12].copy_from_slice(&(cm.glyph_id_start as u16).to_le_bytes());
        head[12..14].copy_from_slice(&entries_count.to_le_bytes());
        head[14] = format_code;
        sub_heads.push(head);
        sub_data.push(data);
    }

    let heads_bytes = sub_heads.len() * 16;
    let mut data_off = 0usize;
    for i in 0..sub_heads.len() {
        let offset = HEAD_LEN + heads_bytes + data_off;
        sub_heads[i][0..4].copy_from_slice(&(offset as u32).to_le_bytes());
        data_off += sub_data[i].len();
    }

    let mut buf = Vec::with_capacity(HEAD_LEN + heads_bytes + data_off);
    buf.extend_from_slice(&[0u8; HEAD_LEN]);
    for h in &sub_heads {
        buf.extend_from_slice(h);
    }
    for d in &sub_data {
        buf.extend_from_slice(d);
    }
    let len = buf.len() as u32;
    buf[0..4].copy_from_slice(&len.to_le_bytes());
    buf[4..8].copy_from_slice(b"cmap");
    buf[8..12].copy_from_slice(&(sub_heads.len() as u32).to_le_bytes());
    Ok(buf)
}

fn write_loca(bin_data: &[Vec<u8>], index_to_loc_format: u8) -> Vec<u8> {
    const HEAD_LEN: usize = 12;
    let count = bin_data.len() as u32;
    let mut body = Vec::with_capacity(bin_data.len() * if index_to_loc_format == 0 { 2 } else { 4 });
    for id in 0..bin_data.len() {
        let off = glyph_offset(bin_data, id);
        if index_to_loc_format == 0 {
            push_u16_le(&mut body, off as u16);
        } else {
            push_u32_le(&mut body, off);
        }
    }
    pad4(&mut body);

    let mut buf = Vec::with_capacity(HEAD_LEN + body.len());
    buf.extend_from_slice(&[0u8; HEAD_LEN]);
    buf.extend_from_slice(&body);
    let len = buf.len() as u32;
    buf[0..4].copy_from_slice(&len.to_le_bytes());
    buf[4..8].copy_from_slice(b"loca");
    buf[8..12].copy_from_slice(&count.to_le_bytes());
    buf
}

fn write_glyf(bin_data: &[Vec<u8>]) -> Vec<u8> {
    const HEAD_LEN: usize = 8;
    let mut buf = Vec::with_capacity(glyf_payload_size(bin_data));
    buf.extend_from_slice(&[0u8; HEAD_LEN]);
    for blob in bin_data {
        buf.extend_from_slice(blob);
    }
    pad4(&mut buf);
    let len = buf.len() as u32;
    buf[0..4].copy_from_slice(&len.to_le_bytes());
    buf[4..8].copy_from_slice(b"glyf");
    buf
}

/// 写出 lv_font_conv 兼容 `.bin`（无压缩 / 无 kern）。
pub fn write_lvgl_bin(
    metrics: &BinFontMetrics,
    glyphs: &[Glyph],
    cmaps: &[CmapEntry],
    mut on_progress: impl FnMut(u32, u32),
) -> Result<Vec<u8>, String> {
    if glyphs.is_empty() {
        return Err("EMPTY_GLYPHS".into());
    }
    match metrics.bpp {
        1 | 2 | 4 => {}
        3 => return Err("BPP3_UNSUPPORTED".into()),
        8 => return Err("BPP8_BIN_UNSUPPORTED".into()),
        _ => return Err(format!("bin 不支持的 bpp: {}", metrics.bpp)),
    }

    let mut min_y = i32::MAX;
    let mut max_y = i32::MIN;
    let mut xy_bits: u8 = 1;
    let mut wh_bits: u8 = 1;
    let mut advance_bits: u8 = 1;
    let first_adv = advance_px(&glyphs[0]);
    let mut monospaced = true;

    for g in glyphs {
        let y0 = g.ofs_y as i32;
        let y1 = y0 + g.box_h as i32;
        min_y = min_y.min(y0);
        max_y = max_y.max(y1);
        xy_bits = xy_bits
            .max(signed_bits(g.ofs_x as i32))
            .max(signed_bits(g.ofs_y as i32));
        wh_bits = wh_bits
            .max(unsigned_bits(g.box_w as i32))
            .max(unsigned_bits(g.box_h as i32));
        let adv = advance_px(g);
        if adv != first_adv {
            monospaced = false;
        }
        advance_bits = advance_bits.max(signed_bits(adv));
    }

    if min_y == i32::MAX {
        min_y = 0;
        max_y = 0;
    }

    let ascent = max_y.clamp(i16::MIN as i32, i16::MAX as i32) as i16;
    let descent = min_y.clamp(i16::MIN as i32, i16::MAX as i32) as i16;
    let min_y_i16 = descent;
    let max_y_i16 = ascent;

    let bin_data = build_glyf_blobs(
        glyphs,
        monospaced,
        advance_bits,
        xy_bits,
        wh_bits,
        metrics.bpp,
        &mut on_progress,
    )?;

    let glyf_size = glyf_payload_size(&bin_data);
    let index_to_loc_format: u8 = if glyf_size > 65535 { 1 } else { 0 };
    let last_id = bin_data.len(); // includes reserved 0
    let glyph_id_format: u8 = if last_id > 255 { 1 } else { 0 };
    let advance_width_format: u8 = 0; // no kerning
    let def_advance = if monospaced {
        first_adv.clamp(0, u16::MAX as i32) as u16
    } else {
        0
    };

    let head = write_head(
        metrics,
        ascent,
        descent,
        min_y_i16,
        max_y_i16,
        monospaced,
        def_advance,
        index_to_loc_format,
        glyph_id_format,
        advance_width_format,
        xy_bits,
        wh_bits,
        advance_bits,
    );
    let cmap = write_cmap(cmaps)?;
    let loca = write_loca(&bin_data, index_to_loc_format);
    let glyf = write_glyf(&bin_data);

    let mut out = Vec::with_capacity(head.len() + cmap.len() + loca.len() + glyf.len());
    out.extend_from_slice(&head);
    out.extend_from_slice(&cmap);
    out.extend_from_slice(&loca);
    out.extend_from_slice(&glyf);
    on_progress(glyphs.len() as u32, glyphs.len() as u32);
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bit_writer_msb() {
        let mut bw = BitWriter::with_capacity(4);
        bw.write_bits(0b1011, 4);
        bw.write_bits(0b01, 2);
        bw.write_bits(0b11, 2);
        assert_eq!(bw.finish(), vec![0b1011_0111]);
    }

    #[test]
    fn signed_bits_matches_ref() {
        assert_eq!(signed_bits(0), 1);
        assert_eq!(signed_bits(1), 2);
        assert_eq!(signed_bits(5), 4);
        assert_eq!(signed_bits(-1), 1);
        assert_eq!(signed_bits(-3), 3);
    }
}
