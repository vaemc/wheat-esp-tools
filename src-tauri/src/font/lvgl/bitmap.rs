//! 灰度像素 -> LVGL 连续 MSB-first 位流。

/// 灰度图阈值二值化后打成 bpp1。
pub fn pack_mono_from_gray(gray: &[u8], width: usize, rows: usize) -> Vec<u8> {
    if width == 0 || rows == 0 {
        return vec![0];
    }
    let mut out = Vec::with_capacity((width * rows + 7) / 8);
    let mut acc: u8 = 0;
    let mut bits: u32 = 0;

    for y in 0..rows {
        let row = y * width;
        for x in 0..width {
            let bit = if gray.get(row + x).copied().unwrap_or(0) >= 128 {
                1
            } else {
                0
            };
            acc = (acc << 1) | bit;
            bits += 1;
            if bits == 8 {
                out.push(acc);
                acc = 0;
                bits = 0;
            }
        }
    }
    if bits > 0 {
        out.push(acc << (8 - bits));
    }
    if out.is_empty() {
        out.push(0);
    }
    out
}

/// 灰度像素 -> LVGL bpp 2/4/8 连续位流。
pub fn pack_gray_pixels(gray: &[u8], width: usize, rows: usize, bpp: u8) -> Vec<u8> {
    if width == 0 || rows == 0 {
        return vec![0];
    }
    let bpp = match bpp {
        2 | 4 | 8 => bpp,
        _ => 4,
    };
    let shift = 8 - bpp;
    let mask = (1u16 << bpp) - 1;
    let mut out = Vec::with_capacity((width * rows * bpp as usize + 7) / 8);
    let mut acc: u32 = 0;
    let mut bits: u32 = 0;

    for y in 0..rows {
        let row = y * width;
        for x in 0..width {
            let g = gray.get(row + x).copied().unwrap_or(0);
            let val = ((g as u16) >> shift) & mask;
            acc = (acc << bpp) | u32::from(val);
            bits += u32::from(bpp);
            while bits >= 8 {
                bits -= 8;
                out.push(((acc >> bits) & 0xff) as u8);
                acc &= (1u32 << bits) - 1;
            }
        }
    }
    if bits > 0 {
        out.push((acc << (8 - bits)) as u8);
    }
    if out.is_empty() {
        out.push(0);
    }
    out
}
