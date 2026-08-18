//! 用 ELF 里的 DWARF 调试信息做 addr2line（文件:行号），不依赖交叉工具链。

use addr2line::Loader;
use serde::Serialize;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Addr2lineFrame {
    pub function: String,
    pub file: String,
    pub line: Option<u32>,
    pub column: Option<u32>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Addr2lineHit {
    pub address: u32,
    pub frames: Vec<Addr2lineFrame>,
}

#[tauri::command]
pub async fn coredump_addr2line(
    elf_path: String,
    addresses: Vec<u32>,
) -> Result<Vec<Addr2lineHit>, String> {
    tokio::task::spawn_blocking(move || resolve_addr2line(&elf_path, &addresses))
        .await
        .map_err(|e| format!("task_join_failed:{e}"))?
}

fn resolve_addr2line(path: &str, addresses: &[u32]) -> Result<Vec<Addr2lineHit>, String> {
    let loader = Loader::new(path).map_err(|e| e.to_string())?;
    Ok(addresses
        .iter()
        .map(|&address| Addr2lineHit {
            address,
            frames: lookup_frames(&loader, address),
        })
        .collect())
}

fn lookup_frames(loader: &Loader, addr: u32) -> Vec<Addr2lineFrame> {
    // 崩溃 PC 用原值；调用点常指向下一条指令，再试 addr-1 / addr-3（Xtensa CALL 常见 3 字节）
    for probe in [addr as u64, addr.saturating_sub(1) as u64, addr.saturating_sub(3) as u64] {
        let frames = collect_frames(loader, probe);
        if !frames.is_empty() {
            return frames;
        }
    }
    Vec::new()
}

fn collect_frames(loader: &Loader, probe: u64) -> Vec<Addr2lineFrame> {
    let mut out = Vec::new();
    let Ok(mut iter) = loader.find_frames(probe) else {
        return fallback_location(loader, probe);
    };
    while let Ok(Some(frame)) = iter.next() {
        let function = frame
            .function
            .as_ref()
            .and_then(|f| f.demangle().ok().or_else(|| f.raw_name().ok()))
            .map(|s| s.into_owned())
            .or_else(|| loader.find_symbol(probe).map(str::to_string))
            .unwrap_or_default();
        let (file, line, column) = match frame.location {
            Some(loc) => (
                loc.file.unwrap_or("").to_string(),
                loc.line,
                loc.column,
            ),
            None => (String::new(), None, None),
        };
        if function.is_empty() && file.is_empty() && line.is_none() {
            continue;
        }
        out.push(Addr2lineFrame {
            function,
            file,
            line,
            column,
        });
    }
    if out.is_empty() {
        return fallback_location(loader, probe);
    }
    out
}

fn fallback_location(loader: &Loader, probe: u64) -> Vec<Addr2lineFrame> {
    let Ok(Some(loc)) = loader.find_location(probe) else {
        return Vec::new();
    };
    let file = loc.file.unwrap_or("").to_string();
    if file.is_empty() && loc.line.is_none() {
        return Vec::new();
    }
    vec![Addr2lineFrame {
        function: loader.find_symbol(probe).unwrap_or("").to_string(),
        file,
        line: loc.line,
        column: loc.column,
    }]
}
