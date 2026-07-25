//! 汉字 → 无声调拼音标识（用于自动生成 C 字体名）。

use pinyin::ToPinyin;

/// 将显示名转为 C 安全标识片段：中文转拼音，ASCII 字母数字保留并小写。
pub fn to_ident_pinyin(text: &str) -> String {
    let mut out = String::new();
    for ch in text.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
            continue;
        }
        if let Some(py) = ch.to_pinyin() {
            out.push_str(py.plain());
        }
        // 空格、标点等跳过
    }
    if out.is_empty() {
        "font".into()
    } else {
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chinese_to_pinyin() {
        let s = to_ident_pinyin("站酷文艺体");
        assert!(s.contains("zhan"));
        assert!(s.chars().all(|c| c.is_ascii_lowercase()));
    }

    #[test]
    fn ascii_passthrough() {
        assert_eq!(to_ident_pinyin("Arial"), "arial");
        assert_eq!(to_ident_pinyin("Noto Sans SC"), "notosanssc");
    }
}
