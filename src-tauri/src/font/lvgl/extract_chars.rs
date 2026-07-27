//! Extract Unicode characters from an existing LVGL font `.c` file (pure Rust).
//!
//! Prefer `/* U+XXXX ... */` comments in `glyph_bitmap` (lv_font_conv and this tool).
//! Fallback: parse `cmaps[]` (FORMAT0_TINY / SPARSE_TINY).

use std::collections::BTreeSet;

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractLvglFontCharsResult {
    /// Characters sorted by codepoint (for the symbols textarea).
    pub characters: String,
    /// Character count (excludes U+0000).
    pub count: u32,
    /// Source file name when loaded from a path.
    pub source_name: String,
}

/// Read from disk and extract.
pub fn extract_from_path(path: &str) -> Result<ExtractLvglFontCharsResult, String> {
    let path = path.trim();
    if path.is_empty() {
        return Err("字体 C 文件路径为空".into());
    }
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("读取 LVGL 字体 C 文件失败: {e}"))?;
    let source_name = std::path::Path::new(path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(path)
        .to_string();
    extract_from_source(&content, source_name)
}

/// Extract from source text.
pub fn extract_from_source(
    source: &str,
    source_name: String,
) -> Result<ExtractLvglFontCharsResult, String> {
    if source.trim().is_empty() {
        return Err("LVGL 字体 C 内容为空".into());
    }

    let mut cps = extract_from_u_plus_comments(source);
    if cps.is_empty() {
        cps = extract_from_cmaps(source);
    }
    if cps.is_empty() {
        return Err("未在文件中找到字形码点（缺少 U+ 注释或 cmaps）".into());
    }

    let characters = sanitize_extracted_chars(&cps);
    let count = characters.chars().count() as u32;
    if count == 0 {
        return Err("未提取到有效 Unicode 字符".into());
    }

    Ok(ExtractLvglFontCharsResult {
        characters,
        count,
        source_name,
    })
}

/// Keep usable glyphs for the symbols box: drop controls / junk whitespace;
/// keep at most one ASCII space; preserve other printable codepoints (CJK, etc.).
fn sanitize_extracted_chars(cps: &BTreeSet<u32>) -> String {
    let mut out = String::with_capacity(cps.len() * 3);
    let mut has_space = false;
    for &cp in cps {
        let Some(ch) = char::from_u32(cp) else {
            continue;
        };
        if !is_usable_symbol_char(ch) {
            continue;
        }
        if ch == ' ' {
            if has_space {
                continue;
            }
            has_space = true;
        }
        out.push(ch);
    }
    out
}

fn is_usable_symbol_char(ch: char) -> bool {
    // Reserved / noncharacters
    let cp = ch as u32;
    if cp == 0 || (0xFDD0..=0xFDEF).contains(&cp) || (cp & 0xFFFE) == 0xFFFE {
        return false;
    }
    // Drop C0/C1 controls and DEL (includes \n \r \t)
    if ch.is_control() {
        return false;
    }
    // Drop other Unicode whitespace except a single ASCII space (handled by caller dedupe)
    if ch.is_whitespace() && ch != ' ' {
        return false;
    }
    true
}

/// Scan `/* U+XXXX ... */` comments.
fn extract_from_u_plus_comments(source: &str) -> BTreeSet<u32> {
    let bytes = source.as_bytes();
    let mut out = BTreeSet::new();
    let mut i = 0;
    while i + 4 < bytes.len() {
        if bytes[i] == b'U' && bytes[i + 1] == b'+' {
            let start = i + 2;
            let mut j = start;
            while j < bytes.len() && j < start + 6 && bytes[j].is_ascii_hexdigit() {
                j += 1;
            }
            let len = j - start;
            if (4..=6).contains(&len) {
                if let Ok(s) = std::str::from_utf8(&bytes[start..j]) {
                    if let Ok(cp) = u32::from_str_radix(s, 16) {
                        if cp <= 0x10_FFFF {
                            out.insert(cp);
                        }
                    }
                }
            }
            i = j;
            continue;
        }
        i += 1;
    }
    out
}

/// Fallback: parse FORMAT0_TINY / SPARSE_TINY in `cmaps[]`.
fn extract_from_cmaps(source: &str) -> BTreeSet<u32> {
    let mut out = BTreeSet::new();
    let unicode_lists = parse_uint16_arrays(source, "unicode_list_");

    let bytes = source.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if let Some(rest) = strip_prefix_at(bytes, i, b".range_start") {
            i = rest;
            i = skip_ws_and_eq(bytes, i);
            let (range_start, next) = match parse_u32_at(bytes, i) {
                Some(v) => v,
                None => {
                    i += 1;
                    continue;
                }
            };
            i = next;

            let mut range_length: Option<u32> = None;
            let mut list_name: Option<String> = None;
            let mut list_length: Option<usize> = None;
            let mut cmap_type: Option<&str> = None;

            let limit = (i + 800).min(bytes.len());
            while i < limit {
                if let Some(r) = strip_prefix_at(bytes, i, b".range_length") {
                    i = skip_ws_and_eq(bytes, r);
                    if let Some((v, n)) = parse_u32_at(bytes, i) {
                        range_length = Some(v);
                        i = n;
                        continue;
                    }
                }
                if let Some(r) = strip_prefix_at(bytes, i, b".unicode_list") {
                    i = skip_ws_and_eq(bytes, r);
                    if strip_prefix_at(bytes, i, b"NULL").is_some() {
                        list_name = None;
                        i += 4;
                        continue;
                    }
                    if let Some((name, n)) = parse_ident_at(bytes, i) {
                        list_name = Some(name);
                        i = n;
                        continue;
                    }
                }
                if let Some(r) = strip_prefix_at(bytes, i, b".list_length") {
                    i = skip_ws_and_eq(bytes, r);
                    if let Some((v, n)) = parse_u32_at(bytes, i) {
                        list_length = Some(v as usize);
                        i = n;
                        continue;
                    }
                }
                if let Some(r) = strip_prefix_at(bytes, i, b"LV_FONT_FMT_TXT_CMAP_") {
                    let (ty, n) = parse_ident_at(bytes, r).unwrap_or(("UNKNOWN".into(), r));
                    cmap_type = Some(match ty.as_str() {
                        "FORMAT0_TINY" => "FORMAT0_TINY",
                        "SPARSE_TINY" => "SPARSE_TINY",
                        "FORMAT0_FULL" => "FORMAT0_FULL",
                        "SPARSE_FULL" => "SPARSE_FULL",
                        _ => "OTHER",
                    });
                    i = n;
                    break;
                }
                i += 1;
            }

            let Some(len) = range_length else {
                continue;
            };
            match cmap_type {
                Some("FORMAT0_TINY") | Some("FORMAT0_FULL") => {
                    for off in 0..len {
                        let cp = range_start.saturating_add(off);
                        if cp > 0 {
                            out.insert(cp);
                        }
                    }
                }
                Some("SPARSE_TINY") | Some("SPARSE_FULL") => {
                    if let Some(name) = list_name.as_deref() {
                        if let Some(list) = unicode_lists.get(name) {
                            let take = list_length.unwrap_or(list.len()).min(list.len());
                            for &rel in list.iter().take(take) {
                                let cp = range_start.saturating_add(rel as u32);
                                if cp > 0 {
                                    out.insert(cp);
                                }
                            }
                        }
                    }
                }
                _ => {}
            }
            continue;
        }
        i += 1;
    }
    out
}

fn parse_uint16_arrays(
    source: &str,
    name_prefix: &str,
) -> std::collections::HashMap<String, Vec<u16>> {
    let mut map = std::collections::HashMap::new();
    let bytes = source.as_bytes();
    let prefix = name_prefix.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if let Some(after) = find_array_decl(bytes, i, prefix) {
            let (name, body_start) = after;
            if let Some((vals, next)) = parse_brace_u16_list(bytes, body_start) {
                map.insert(name, vals);
                i = next;
                continue;
            }
        }
        i += 1;
    }
    map
}

/// Find `prefix...[] = {`, return (ident, index after `{`).
fn find_array_decl(bytes: &[u8], i: usize, prefix: &[u8]) -> Option<(String, usize)> {
    if i + prefix.len() >= bytes.len() {
        return None;
    }
    if !bytes[i..].starts_with(prefix) {
        return None;
    }
    if i > 0 {
        let prev = bytes[i - 1];
        if prev.is_ascii_alphanumeric() || prev == b'_' {
            return None;
        }
    }
    let (name, mut j) = parse_ident_at(bytes, i)?;
    j = skip_ws(bytes, j);
    if j >= bytes.len() || bytes[j] != b'[' {
        return None;
    }
    while j < bytes.len() && bytes[j] != b'=' {
        j += 1;
    }
    if j >= bytes.len() {
        return None;
    }
    j += 1;
    j = skip_ws(bytes, j);
    if j >= bytes.len() || bytes[j] != b'{' {
        return None;
    }
    Some((name, j + 1))
}

fn parse_brace_u16_list(bytes: &[u8], mut i: usize) -> Option<(Vec<u16>, usize)> {
    let mut vals = Vec::new();
    while i < bytes.len() {
        i = skip_ws_and_comments(bytes, i);
        if i >= bytes.len() {
            break;
        }
        if bytes[i] == b'}' {
            return Some((vals, i + 1));
        }
        if bytes[i] == b',' {
            i += 1;
            continue;
        }
        let (n, next) = parse_u32_at(bytes, i)?;
        if n > u16::MAX as u32 {
            return None;
        }
        vals.push(n as u16);
        i = next;
    }
    None
}

fn strip_prefix_at(bytes: &[u8], i: usize, prefix: &[u8]) -> Option<usize> {
    if bytes[i..].starts_with(prefix) {
        Some(i + prefix.len())
    } else {
        None
    }
}

fn skip_ws(bytes: &[u8], mut i: usize) -> usize {
    while i < bytes.len() && bytes[i].is_ascii_whitespace() {
        i += 1;
    }
    i
}

fn skip_ws_and_eq(bytes: &[u8], mut i: usize) -> usize {
    i = skip_ws(bytes, i);
    if i < bytes.len() && bytes[i] == b'=' {
        i += 1;
        i = skip_ws(bytes, i);
    }
    i
}

fn skip_ws_and_comments(bytes: &[u8], mut i: usize) -> usize {
    loop {
        i = skip_ws(bytes, i);
        if i + 1 < bytes.len() && bytes[i] == b'/' && bytes[i + 1] == b'*' {
            i += 2;
            while i + 1 < bytes.len() && !(bytes[i] == b'*' && bytes[i + 1] == b'/') {
                i += 1;
            }
            if i + 1 < bytes.len() {
                i += 2;
            }
            continue;
        }
        if i + 1 < bytes.len() && bytes[i] == b'/' && bytes[i + 1] == b'/' {
            i += 2;
            while i < bytes.len() && bytes[i] != b'\n' {
                i += 1;
            }
            continue;
        }
        break;
    }
    i
}

fn parse_u32_at(bytes: &[u8], i: usize) -> Option<(u32, usize)> {
    if i >= bytes.len() {
        return None;
    }
    if i + 2 < bytes.len()
        && bytes[i] == b'0'
        && (bytes[i + 1] == b'x' || bytes[i + 1] == b'X')
    {
        let mut j = i + 2;
        let start = j;
        while j < bytes.len() && bytes[j].is_ascii_hexdigit() {
            j += 1;
        }
        if j == start {
            return None;
        }
        let s = std::str::from_utf8(&bytes[start..j]).ok()?;
        let v = u32::from_str_radix(s, 16).ok()?;
        return Some((v, j));
    }
    let mut j = i;
    if j < bytes.len() && bytes[j] == b'-' {
        return None;
    }
    let start = j;
    while j < bytes.len() && bytes[j].is_ascii_digit() {
        j += 1;
    }
    if j == start {
        return None;
    }
    let s = std::str::from_utf8(&bytes[start..j]).ok()?;
    let v: u32 = s.parse().ok()?;
    Some((v, j))
}

fn parse_ident_at(bytes: &[u8], i: usize) -> Option<(String, usize)> {
    if i >= bytes.len() {
        return None;
    }
    let b0 = bytes[i];
    if !(b0.is_ascii_alphabetic() || b0 == b'_') {
        return None;
    }
    let mut j = i + 1;
    while j < bytes.len() && (bytes[j].is_ascii_alphanumeric() || bytes[j] == b'_') {
        j += 1;
    }
    let s = std::str::from_utf8(&bytes[i..j]).ok()?.to_string();
    Some((s, j))
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"
static LV_ATTRIBUTE_LARGE_CONST const uint8_t glyph_bitmap[] = {
    /* U+0020 " " */
    /* U+0021 "!" */
    0x6f, 0x85,
    /* U+4E00 "yi" */
    0x01,
    /* U+4E2D "zhong" */
};

static const uint16_t unicode_list_0[] = {
    0, 10, 13,
};

static const lv_font_fmt_txt_cmap_t cmaps[] = {
    {
        .range_start = 0, .range_length = 14, .glyph_id_start = 1,
        .unicode_list = unicode_list_0, .glyph_id_ofs_list = NULL, .list_length = 3, .type = LV_FONT_FMT_TXT_CMAP_SPARSE_TINY
    },
    {
        .range_start = 32, .range_length = 2, .glyph_id_start = 4,
        .unicode_list = NULL, .glyph_id_ofs_list = NULL, .list_length = 0, .type = LV_FONT_FMT_TXT_CMAP_FORMAT0_TINY
    },
};
"#;

    #[test]
    fn extract_from_u_plus() {
        let r = extract_from_source(SAMPLE, "t.c".into()).unwrap();
        assert_eq!(r.count, 4);
        assert!(r.characters.contains(' '));
        assert!(r.characters.contains('!'));
        assert!(r.characters.contains(char::from_u32(0x4E00).unwrap()));
        assert!(r.characters.contains(char::from_u32(0x4E2D).unwrap()));
    }

    #[test]
    fn strips_controls_and_keeps_single_space() {
        let src = r#"
static const uint8_t glyph_bitmap[] = {
    /* U+0000 */
    /* U+000A */
    /* U+000D */
    /* U+0009 */
    /* U+0020 " " */
    /* U+0020 " " */
    /* U+0041 "A" */
    /* U+4E00 */
    /* U+00A0 */
};
"#;
        let r = extract_from_source(src, "t.c".into()).unwrap();
        // space + A + ?  (NBSP U+00A0 dropped as whitespace)
        assert_eq!(r.count, 3);
        assert!(!r.characters.contains('\n'));
        assert!(!r.characters.contains('\r'));
        assert!(!r.characters.contains('\t'));
        assert_eq!(r.characters.chars().filter(|&c| c == ' ').count(), 1);
        assert!(r.characters.contains('A'));
        assert!(r.characters.contains(char::from_u32(0x4E00).unwrap()));
    }

    #[test]
    fn extract_cmap_fallback_without_u_plus() {
        let src = r#"
static const uint16_t unicode_list_0[] = { 1, 2, };
static const lv_font_fmt_txt_cmap_t cmaps[] = {
    {
        .range_start = 0x40, .range_length = 10, .glyph_id_start = 1,
        .unicode_list = unicode_list_0, .glyph_id_ofs_list = NULL, .list_length = 2,
        .type = LV_FONT_FMT_TXT_CMAP_SPARSE_TINY
    },
    {
        .range_start = 65, .range_length = 3, .glyph_id_start = 3,
        .unicode_list = NULL, .glyph_id_ofs_list = NULL, .list_length = 0,
        .type = LV_FONT_FMT_TXT_CMAP_FORMAT0_TINY
    },
};
"#;
        let r = extract_from_source(src, "x.c".into()).unwrap();
        // sparse: 0x40+1/2 = A,B; format0: 65..67 = A,B,C -> unique A,B,C
        assert_eq!(r.count, 3);
        assert_eq!(r.characters, "ABC");
    }
}
