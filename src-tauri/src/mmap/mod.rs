//! ESP mmap 资源镜像打包（表头 + 条目表 + ZZ 载荷）
//! 递归收录目录文件；跳过 config.json；相对路径 < 32 字节。
//! index.json：目录已有则原样打入；缺失时可按常见字段自动生成。

use serde::Serialize;
use serde_json::{json, Map, Value};
use std::fs;
use std::path::{Path, PathBuf};

const MAX_NAME_LEN: usize = 32;
const MAGIC: [u8; 2] = [0x5A, 0x5A];
const HEADER_LEN: usize = 12;
const TABLE_ENTRY_LEN: usize = 44;
const INDEX_JSON_NAME: &str = "index.json";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MmapAssetEntry {
    pub rel: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MmapProbeResult {
    pub dir: String,
    pub files: Vec<MmapAssetEntry>,
    pub total_bytes: u64,
    pub errors: Vec<String>,
    /// 根目录是否已有 index.json
    pub has_index_json: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MmapPackResult {
    pub output_path: String,
    pub file_count: u32,
    pub size: u64,
    pub checksum: u32,
    /// "existing" | "generated" | "none"
    pub index_json_source: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MmapIndexEntry {
    pub name: String,
    pub size: u32,
    /// 相对 ZZ 载荷区起点的偏移（与镜像表内 offset 字段一致）
    pub offset: u32,
    pub width: u16,
    pub height: u16,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MmapIndexPreview {
    /// "dir" | "bin"
    pub source: String,
    pub path: String,
    pub file_count: u32,
    pub checksum: Option<u32>,
    pub payload_len: Option<u32>,
    pub bin_size: Option<u64>,
    pub header_len: u32,
    pub table_entry_len: u32,
    pub files: Vec<MmapIndexEntry>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexJsonPreview {
    /// "existing" | "generated" | "from_bin"
    pub source: String,
    pub path: String,
    pub content: String,
}

fn compute_checksum(data: &[u8]) -> u32 {
    data.iter().fold(0u32, |acc, &b| acc.wrapping_add(b as u32)) & 0xFFFF
}

fn read_u32_le(data: &[u8], at: usize) -> Result<u32, String> {
    let bytes: [u8; 4] = data
        .get(at..at + 4)
        .ok_or_else(|| "镜像过短，无法读取 u32".to_string())?
        .try_into()
        .map_err(|_| "镜像过短，无法读取 u32".to_string())?;
    Ok(u32::from_le_bytes(bytes))
}

fn read_u16_le(data: &[u8], at: usize) -> Result<u16, String> {
    let bytes: [u8; 2] = data
        .get(at..at + 2)
        .ok_or_else(|| "镜像过短，无法读取 u16".to_string())?
        .try_into()
        .map_err(|_| "镜像过短，无法读取 u16".to_string())?;
    Ok(u16::from_le_bytes(bytes))
}

fn collect_files(root: &Path) -> Result<Vec<PathBuf>, String> {
    if !root.is_dir() {
        return Err(format!("不是目录: {}", root.display()));
    }

    let mut files: Vec<PathBuf> = Vec::new();
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let entries = fs::read_dir(&dir).map_err(|e| format!("读取目录失败 {}: {e}", dir.display()))?;
        for entry in entries {
            let entry = entry.map_err(|e| format!("读取目录项失败: {e}"))?;
            let path = entry.path();
            let meta = entry
                .metadata()
                .map_err(|e| format!("读取元数据失败 {}: {e}", path.display()))?;
            if meta.is_dir() {
                stack.push(path);
            } else if meta.is_file() {
                let name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("");
                if name == "config.json" {
                    continue;
                }
                files.push(path);
            }
        }
    }

    files.sort_by(|a, b| {
        let ra = a
            .strip_prefix(root)
            .map(|p| p.to_string_lossy().replace('\\', "/").to_ascii_lowercase())
            .unwrap_or_default();
        let rb = b
            .strip_prefix(root)
            .map(|p| p.to_string_lossy().replace('\\', "/").to_ascii_lowercase())
            .unwrap_or_default();
        ra.cmp(&rb)
    });
    Ok(files)
}

fn rel_posix(root: &Path, file: &Path) -> Result<String, String> {
    let rel = file
        .strip_prefix(root)
        .map_err(|_| format!("路径不在根目录下: {}", file.display()))?;
    Ok(rel.to_string_lossy().replace('\\', "/"))
}

fn file_stem(rel: &str) -> String {
    let name = rel.rsplit('/').next().unwrap_or(rel);
    match name.rsplit_once('.') {
        Some((stem, _)) if !stem.is_empty() => stem.to_string(),
        _ => name.to_string(),
    }
}

fn extension_lower(rel: &str) -> String {
    Path::new(rel)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
}

fn is_font_bin(rel: &str) -> bool {
    let lower = rel.to_ascii_lowercase();
    if !lower.ends_with(".bin") {
        return false;
    }
    Path::new(&lower)
        .file_name()
        .and_then(|n| n.to_str())
        .map(|base| base.contains("font"))
        .unwrap_or(false)
}

fn is_emoji_asset(rel: &str) -> bool {
    matches!(
        extension_lower(rel).as_str(),
        "png" | "gif" | "jpg" | "jpeg" | "bmp" | "webp" | "eaf"
    )
}

/// 按常见字段顺序生成 index.json（version → srmodels → text_font → emoji_collection）
pub fn build_index_json_from_rels(rels: &[String]) -> String {
    let mut root = Map::new();
    root.insert("version".to_string(), json!(1));

    if rels.iter().any(|r| r == "srmodels.bin") {
        root.insert("srmodels".to_string(), json!("srmodels.bin"));
    }

    if let Some(font) = rels.iter().find(|r| is_font_bin(r)) {
        root.insert("text_font".to_string(), json!(font));
    }

    let mut emoji = Vec::new();
    for rel in rels {
        if rel == INDEX_JSON_NAME || !is_emoji_asset(rel) {
            continue;
        }
        let name = file_stem(rel);
        if name.is_empty() {
            continue;
        }
        if extension_lower(rel) == "eaf" {
            emoji.push(json!({
                "name": name,
                "file": rel,
                "eaf": { "loop": true, "fps": 20 }
            }));
        } else {
            emoji.push(json!({
                "name": name,
                "file": rel
            }));
        }
    }
    if !emoji.is_empty() {
        root.insert("emoji_collection".to_string(), Value::Array(emoji));
    }

    serde_json::to_string_pretty(&Value::Object(root))
        .unwrap_or_else(|_| "{\n  \"version\": 1\n}".to_string())
}

fn list_rel_paths(root: &Path) -> Result<Vec<String>, String> {
    let files = collect_files(root)?;
    let mut rels = Vec::new();
    for fp in &files {
        rels.push(rel_posix(root, fp)?);
    }
    Ok(rels)
}

fn root_has_index_json(root: &Path) -> bool {
    root.join(INDEX_JSON_NAME).is_file()
}

/// 解析将打入包的 index.json：已有原样，或按 auto_generate 扫描生成
pub fn resolve_index_json(dir: &str, auto_generate: bool) -> Result<IndexJsonPreview, String> {
    let root = PathBuf::from(dir);
    if !root.is_dir() {
        return Err(format!("不是目录: {}", root.display()));
    }

    let index_path = root.join(INDEX_JSON_NAME);
    if index_path.is_file() {
        let content =
            fs::read_to_string(&index_path).map_err(|e| format!("读取 index.json 失败: {e}"))?;
        // 校验可解析
        serde_json::from_str::<Value>(&content).map_err(|e| format!("index.json 不是合法 JSON: {e}"))?;
        return Ok(IndexJsonPreview {
            source: "existing".to_string(),
            path: index_path.display().to_string(),
            content,
        });
    }

    if !auto_generate {
        return Err("目录中没有 index.json，且未启用自动生成".to_string());
    }

    let rels = list_rel_paths(&root)?;
    let content = build_index_json_from_rels(&rels);
    Ok(IndexJsonPreview {
        source: "generated".to_string(),
        path: root.display().to_string(),
        content,
    })
}

/// 组装最终打包条目：(相对路径, 字节内容)
fn collect_pack_entries(
    root: &Path,
    auto_generate_index: bool,
) -> Result<(Vec<(String, Vec<u8>)>, String), String> {
    let files = collect_files(root)?;
    let mut entries: Vec<(String, Vec<u8>)> = Vec::new();
    let mut has_index = false;

    for fp in &files {
        let rel = rel_posix(root, fp)?;
        if rel.as_bytes().len() >= MAX_NAME_LEN {
            return Err(format!("路径名过长 (>={MAX_NAME_LEN}): {rel}"));
        }
        if rel == INDEX_JSON_NAME {
            has_index = true;
        }
        let raw = fs::read(fp).map_err(|e| format!("读取文件失败 {rel}: {e}"))?;
        entries.push((rel, raw));
    }

    let index_source = if has_index {
        "existing".to_string()
    } else if auto_generate_index {
        let rels: Vec<String> = entries.iter().map(|(r, _)| r.clone()).collect();
        let content = build_index_json_from_rels(&rels);
        let bytes = content.into_bytes();
        entries.push((INDEX_JSON_NAME.to_string(), bytes));
        entries.sort_by(|a, b| a.0.to_ascii_lowercase().cmp(&b.0.to_ascii_lowercase()));
        "generated".to_string()
    } else {
        "none".to_string()
    };

    if entries.is_empty() {
        return Err(format!("目录下没有可打包文件: {}", root.display()));
    }
    Ok((entries, index_source))
}

fn pack_entries_to_bin(
    entries: &[(String, Vec<u8>)],
    output_path: &str,
) -> Result<(u32, u64, u32), String> {
    let mut merged: Vec<u8> = Vec::new();
    let mut table_rows: Vec<(String, u32, u32)> = Vec::new();

    for (rel, raw) in entries {
        let offset = merged.len() as u32;
        merged.extend_from_slice(&MAGIC);
        let size = raw.len() as u32;
        merged.extend_from_slice(raw);
        table_rows.push((rel.clone(), offset, size));
    }

    let mut mmap_table: Vec<u8> = Vec::with_capacity(table_rows.len() * TABLE_ENTRY_LEN);
    for (rel, offset, size) in &table_rows {
        let mut name = [0u8; MAX_NAME_LEN];
        let bytes = rel.as_bytes();
        let n = bytes.len().min(MAX_NAME_LEN);
        name[..n].copy_from_slice(&bytes[..n]);
        mmap_table.extend_from_slice(&name);
        mmap_table.extend_from_slice(&size.to_le_bytes());
        mmap_table.extend_from_slice(&offset.to_le_bytes());
        mmap_table.extend_from_slice(&0u16.to_le_bytes());
        mmap_table.extend_from_slice(&0u16.to_le_bytes());
    }

    let mut combined = mmap_table;
    combined.extend_from_slice(&merged);
    let checksum = compute_checksum(&combined);
    let file_count = table_rows.len() as u32;
    let payload_len = combined.len() as u32;

    let mut blob = Vec::with_capacity(HEADER_LEN + combined.len());
    blob.extend_from_slice(&file_count.to_le_bytes());
    blob.extend_from_slice(&checksum.to_le_bytes());
    blob.extend_from_slice(&payload_len.to_le_bytes());
    blob.extend_from_slice(&combined);

    let out = PathBuf::from(output_path);
    if let Some(parent) = out.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|e| format!("创建输出目录失败: {e}"))?;
        }
    }
    fs::write(&out, &blob).map_err(|e| format!("写入失败 {}: {e}", out.display()))?;
    Ok((file_count, blob.len() as u64, checksum))
}

/// 仅按文件大小推算映射表（不读完整内容；不含自动生成的虚拟 index）
fn build_index_rows_from_dir(root: &Path) -> Result<Vec<MmapIndexEntry>, String> {
    let files = collect_files(root)?;
    if files.is_empty() {
        return Err(format!("目录下没有可打包文件: {}", root.display()));
    }

    let mut rows = Vec::new();
    let mut payload_offset: u32 = 0;
    for fp in &files {
        let rel = rel_posix(root, fp)?;
        if rel.as_bytes().len() >= MAX_NAME_LEN {
            return Err(format!("路径名过长 (>={MAX_NAME_LEN}): {rel}"));
        }
        let size = fs::metadata(fp)
            .map(|m| m.len() as u32)
            .map_err(|e| format!("读取大小失败 {rel}: {e}"))?;
        rows.push(MmapIndexEntry {
            name: rel,
            size,
            offset: payload_offset,
            width: 0,
            height: 0,
        });
        payload_offset = payload_offset
            .checked_add(2)
            .and_then(|v| v.checked_add(size))
            .ok_or_else(|| "载荷偏移溢出".to_string())?;
    }
    Ok(rows)
}

fn parse_index_from_bin_bytes(blob: &[u8], path: &str) -> Result<MmapIndexPreview, String> {
    if blob.len() < HEADER_LEN {
        return Err("不是有效的 mmap 镜像（过短）".to_string());
    }
    let file_count = read_u32_le(blob, 0)?;
    let checksum = read_u32_le(blob, 4)?;
    let payload_len = read_u32_le(blob, 8)?;
    if file_count == 0 || file_count > 4096 {
        return Err(format!("无效的文件数: {file_count}"));
    }
    let table_bytes = file_count as usize * TABLE_ENTRY_LEN;
    if blob.len() < HEADER_LEN + table_bytes {
        return Err("镜像表损坏：长度不足".to_string());
    }

    let mut files = Vec::with_capacity(file_count as usize);
    for i in 0..file_count as usize {
        let base = HEADER_LEN + i * TABLE_ENTRY_LEN;
        let name_raw = &blob[base..base + MAX_NAME_LEN];
        let end = name_raw.iter().position(|&b| b == 0).unwrap_or(MAX_NAME_LEN);
        let name = String::from_utf8_lossy(&name_raw[..end]).into_owned();
        let size = read_u32_le(blob, base + 32)?;
        let offset = read_u32_le(blob, base + 36)?;
        let width = read_u16_le(blob, base + 40)?;
        let height = read_u16_le(blob, base + 42)?;
        files.push(MmapIndexEntry {
            name,
            size,
            offset,
            width,
            height,
        });
    }

    Ok(MmapIndexPreview {
        source: "bin".to_string(),
        path: path.to_string(),
        file_count,
        checksum: Some(checksum),
        payload_len: Some(payload_len),
        bin_size: Some(blob.len() as u64),
        header_len: HEADER_LEN as u32,
        table_entry_len: TABLE_ENTRY_LEN as u32,
        files,
    })
}

pub fn probe_mmap_assets_dir(dir: &str) -> Result<MmapProbeResult, String> {
    let root = PathBuf::from(dir);
    let files = collect_files(&root)?;
    let mut entries = Vec::new();
    let mut errors = Vec::new();
    let mut total_bytes = 0u64;

    for fp in &files {
        let rel = match rel_posix(&root, fp) {
            Ok(r) => r,
            Err(e) => {
                errors.push(e);
                continue;
            }
        };
        if rel.as_bytes().len() >= MAX_NAME_LEN {
            errors.push(format!("路径名过长 (>={MAX_NAME_LEN}): {rel}"));
            continue;
        }
        let size = fs::metadata(fp)
            .map(|m| m.len())
            .map_err(|e| format!("读取大小失败 {rel}: {e}"))?;
        total_bytes = total_bytes.saturating_add(size);
        entries.push(MmapAssetEntry { rel, size });
    }

    Ok(MmapProbeResult {
        dir: root.display().to_string(),
        files: entries,
        total_bytes,
        errors,
        has_index_json: root_has_index_json(&root),
    })
}

/// 根据目录预览即将写入 .bin 的映射表（无旁路 JSON 文件）
pub fn preview_mmap_index_from_dir(dir: &str) -> Result<MmapIndexPreview, String> {
    let root = PathBuf::from(dir);
    let files = build_index_rows_from_dir(&root)?;
    let file_count = files.len() as u32;
    Ok(MmapIndexPreview {
        source: "dir".to_string(),
        path: root.display().to_string(),
        file_count,
        checksum: None,
        payload_len: None,
        bin_size: None,
        header_len: HEADER_LEN as u32,
        table_entry_len: TABLE_ENTRY_LEN as u32,
        files,
    })
}

/// 解析已有 mmap .bin 的映射表
pub fn preview_mmap_index_from_bin(bin_path: &str) -> Result<MmapIndexPreview, String> {
    let blob = fs::read(bin_path).map_err(|e| format!("读取失败 {bin_path}: {e}"))?;
    parse_index_from_bin_bytes(&blob, bin_path)
}

/// 从 mmap .bin 载荷区按相对路径取出文件字节（offset 相对 ZZ 区起点）
fn extract_file_bytes_from_blob(blob: &[u8], entry: &MmapIndexEntry) -> Result<Vec<u8>, String> {
    let file_count = read_u32_le(blob, 0)?;
    let table_bytes = file_count as usize * TABLE_ENTRY_LEN;
    let payload_base = HEADER_LEN + table_bytes;
    let magic_at = payload_base
        .checked_add(entry.offset as usize)
        .ok_or_else(|| "载荷偏移溢出".to_string())?;
    let data_at = magic_at
        .checked_add(2)
        .ok_or_else(|| "载荷偏移溢出".to_string())?;
    let end = data_at
        .checked_add(entry.size as usize)
        .ok_or_else(|| "载荷长度溢出".to_string())?;
    if end > blob.len() {
        return Err(format!("无法读取包内文件 {}: 超出镜像范围", entry.name));
    }
    if &blob[magic_at..magic_at + 2] != MAGIC {
        return Err(format!("包内文件 {} 魔数校验失败", entry.name));
    }
    Ok(blob[data_at..end].to_vec())
}

/// 从已打包的 mmap .bin 中提取业务清单 index.json（不是头部映射表）
pub fn preview_index_json_from_bin(bin_path: &str) -> Result<IndexJsonPreview, String> {
    let blob = fs::read(bin_path).map_err(|e| format!("读取失败 {bin_path}: {e}"))?;
    let preview = parse_index_from_bin_bytes(&blob, bin_path)?;
    let entry = preview
        .files
        .iter()
        .find(|e| e.name == INDEX_JSON_NAME)
        .ok_or_else(|| "该 .bin 内没有 index.json（仅含路径映射表，无业务清单）".to_string())?;
    let raw = extract_file_bytes_from_blob(&blob, entry)?;
    let text = String::from_utf8(raw).map_err(|e| format!("index.json 不是合法 UTF-8: {e}"))?;
    let content = match serde_json::from_str::<Value>(&text) {
        Ok(v) => serde_json::to_string_pretty(&v).unwrap_or(text),
        Err(_) => text,
    };
    Ok(IndexJsonPreview {
        source: "from_bin".to_string(),
        path: bin_path.to_string(),
        content,
    })
}

pub fn pack_mmap_assets(
    dir: &str,
    output_path: &str,
    auto_generate_index: bool,
) -> Result<MmapPackResult, String> {
    let root = PathBuf::from(dir);
    let (entries, index_json_source) = collect_pack_entries(&root, auto_generate_index)?;
    let (file_count, size, checksum) = pack_entries_to_bin(&entries, output_path)?;
    Ok(MmapPackResult {
        output_path: PathBuf::from(output_path).display().to_string(),
        file_count,
        size,
        checksum,
        index_json_source,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_stamp() -> u128 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    }

    #[test]
    fn pack_roundtrip_header() {
        let stamp = temp_stamp();
        let root = std::env::temp_dir().join(format!("mmap_pack_test_{stamp}"));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("img")).unwrap();
        fs::create_dir_all(root.join("audio")).unwrap();
        fs::create_dir_all(root.join("doc")).unwrap();
        let mut f = fs::File::create(root.join("img/a.png")).unwrap();
        f.write_all(b"PNGDATA").unwrap();
        let mut f2 = fs::File::create(root.join("img/b.gif")).unwrap();
        f2.write_all(b"GIFDATA").unwrap();
        let mut f3 = fs::File::create(root.join("audio/c.ogg")).unwrap();
        f3.write_all(b"OGGDATA").unwrap();
        let mut f4 = fs::File::create(root.join("doc/d.txt")).unwrap();
        f4.write_all(b"hello").unwrap();
        let mut skip = fs::File::create(root.join("config.json")).unwrap();
        skip.write_all(b"{}").unwrap();

        let out_dir = std::env::temp_dir().join(format!("mmap_pack_out_{stamp}"));
        let _ = fs::remove_dir_all(&out_dir);
        fs::create_dir_all(&out_dir).unwrap();
        let out = out_dir.join("out.bin");
        // 自动生成 index.json → 4 资源 + 1 清单
        let result =
            pack_mmap_assets(root.to_str().unwrap(), out.to_str().unwrap(), true).unwrap();
        assert_eq!(result.file_count, 5, "unexpected pack count");
        assert_eq!(result.index_json_source, "generated");
        let blob = fs::read(&out).unwrap();
        assert_eq!(&blob[0..4], &5u32.to_le_bytes());
        let from_bin = preview_mmap_index_from_bin(out.to_str().unwrap()).unwrap();
        assert!(from_bin.files.iter().any(|e| e.name == "index.json"));

        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&out_dir);
    }

    #[test]
    fn existing_index_json_kept() {
        let stamp = temp_stamp();
        let root = std::env::temp_dir().join(format!("mmap_idx_exist_{stamp}"));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let custom = "{\n  \"version\": 1,\n  \"srmodels\": \"srmodels.bin\"\n}\n";
        fs::write(root.join("index.json"), custom).unwrap();
        fs::write(root.join("srmodels.bin"), b"MODEL").unwrap();

        let preview = resolve_index_json(root.to_str().unwrap(), true).unwrap();
        assert_eq!(preview.source, "existing");
        assert!(preview.content.contains("srmodels.bin"));

        let out = std::env::temp_dir().join(format!("mmap_idx_exist_out_{stamp}.bin"));
        let result =
            pack_mmap_assets(root.to_str().unwrap(), out.to_str().unwrap(), true).unwrap();
        assert_eq!(result.index_json_source, "existing");
        assert_eq!(result.file_count, 2);

        let from_bin = preview_mmap_index_from_bin(out.to_str().unwrap()).unwrap();
        let idx = from_bin.files.iter().find(|e| e.name == "index.json").unwrap();
        // 从 bin 抽出 index.json 载荷：表后 ZZ + 内容
        let blob = fs::read(&out).unwrap();
        let table_bytes = from_bin.file_count as usize * TABLE_ENTRY_LEN;
        let payload_base = HEADER_LEN + table_bytes;
        let data_off = payload_base + idx.offset as usize + 2;
        let data = &blob[data_off..data_off + idx.size as usize];
        assert_eq!(data, custom.as_bytes());

        let extracted = preview_index_json_from_bin(out.to_str().unwrap()).unwrap();
        assert_eq!(extracted.source, "from_bin");
        assert!(extracted.content.contains("srmodels.bin"));

        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_file(&out);
    }

    #[test]
    fn auto_generate_index_json_schema() {
        let rels = vec![
            "eaf/happy1.eaf".to_string(),
            "ogg/a.ogg".to_string(),
            "img/x.png".to_string(),
            "font_puhui.bin".to_string(),
            "srmodels.bin".to_string(),
        ];
        let text = build_index_json_from_rels(&rels);
        let v: Value = serde_json::from_str(&text).unwrap();
        assert_eq!(v["version"], 1);
        assert_eq!(v["srmodels"], "srmodels.bin");
        assert_eq!(v["text_font"], "font_puhui.bin");
        let keys: Vec<&str> = v
            .as_object()
            .unwrap()
            .keys()
            .map(|k| k.as_str())
            .collect();
        assert_eq!(keys.first().copied(), Some("version"));
        let emoji = v["emoji_collection"].as_array().unwrap();
        assert!(emoji.iter().any(|e| e["file"] == "eaf/happy1.eaf" && e.get("eaf").is_some()));
        assert!(emoji.iter().any(|e| e["file"] == "img/x.png" && e.get("eaf").is_none()));
        assert!(!emoji.iter().any(|e| e["file"] == "ogg/a.ogg"));
    }
}
