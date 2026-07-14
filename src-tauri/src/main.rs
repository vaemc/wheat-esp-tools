// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use btleplug::api::Peripheral;
use btleplug::api::{Central, CentralEvent, Manager as _, ScanFilter};
use btleplug::platform::{Adapter, Manager, PeripheralId};
use futures::stream::StreamExt;
use serialport::available_ports;
use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::Path;
use std::process::Command;
use std::sync::mpsc::{self, TryRecvError};
use std::time::SystemTime;
use esp_nvs_partition_tool::partition::{DataValue, EntryContent, NvsEntry};
use esp_nvs_partition_tool::NvsPartition;

mod classic_bluetooth;
mod serial;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct BleDevice {
    pub address: String,
    pub local_name: String,
    pub rssi: i16,
    pub manufacturer_data: HashMap<u16, Vec<u8>>,
    pub services: Vec<String>,
    pub service_data: HashMap<String, Vec<u8>>,
    pub adv: Vec<u8>,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
struct NvsKeyValue {
    namespace: String,
    key: String,
    value_type: String,
    value: String,
    /// 是否为二进制类型（前端用于禁止内联编辑，避免乱码写回）
    is_binary: bool,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
struct NvsEdit {
    /// "update" | "delete" | "add"
    op: String,
    namespace: String,
    key: String,
    /// 仅当 op = update | add 时使用；与 NvsKeyValue.value_type 同义
    value_type: Option<String>,
    /// 用户输入的字符串值（按 value_type 解析）
    value: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
struct NvsRebuildSummary {
    save_path: String,
    written_size: u64,
    entries: usize,
}

fn format_nvs_value(value: &DataValue) -> String {
    match value {
        DataValue::Binary(bytes) => {
            if bytes.iter().all(|b| b.is_ascii_graphic() || *b == b' ') {
                String::from_utf8_lossy(bytes).into_owned()
            } else {
                format!("0x{}", bytes.iter().map(|b| format!("{b:02x}")).collect::<String>())
            }
        }
        other => other.to_string(),
    }
}

fn entry_to_row(entry: &NvsEntry) -> Option<NvsKeyValue> {
    if entry.namespace.is_empty() || entry.key.is_empty() {
        return None;
    }
    match &entry.content {
        EntryContent::Data(value) => Some(NvsKeyValue {
            namespace: entry.namespace.clone(),
            key: entry.key.clone(),
            value_type: value.encoding_str().to_string(),
            value: format_nvs_value(value),
            is_binary: matches!(value, DataValue::Binary(_)),
        }),
        EntryContent::File { .. } => None,
    }
}

/// 将整数字符串（10 进制 / 0x.. / 0b..）解析为 i128，再按目标类型再做一次范围检查
fn parse_signed(s: &str) -> Result<i128, String> {
    let v = s.trim();
    let (neg, body) = match v.strip_prefix('-') {
        Some(rest) => (true, rest),
        None => (false, v),
    };
    let n = if let Some(hex) = body.strip_prefix("0x").or_else(|| body.strip_prefix("0X")) {
        i128::from_str_radix(hex, 16).map_err(|e| format!("无效的十六进制数: {e}"))?
    } else if let Some(bin) = body.strip_prefix("0b").or_else(|| body.strip_prefix("0B")) {
        i128::from_str_radix(bin, 2).map_err(|e| format!("无效的二进制数: {e}"))?
    } else {
        body.parse::<i128>()
            .map_err(|e| format!("无效的整数: {e}"))?
    };
    Ok(if neg { -n } else { n })
}

fn parse_unsigned(s: &str) -> Result<u128, String> {
    let v = s.trim();
    let body = v.strip_prefix('+').unwrap_or(v);
    if body.starts_with('-') {
        return Err("不允许的负数".into());
    }
    if let Some(hex) = body.strip_prefix("0x").or_else(|| body.strip_prefix("0X")) {
        u128::from_str_radix(hex, 16).map_err(|e| format!("无效的十六进制数: {e}"))
    } else if let Some(bin) = body.strip_prefix("0b").or_else(|| body.strip_prefix("0B")) {
        u128::from_str_radix(bin, 2).map_err(|e| format!("无效的二进制数: {e}"))
    } else {
        body.parse::<u128>().map_err(|e| format!("无效的整数: {e}"))
    }
}

fn parse_hex_bytes(s: &str) -> Result<Vec<u8>, String> {
    let raw = s.trim();
    let body = raw.strip_prefix("0x").or_else(|| raw.strip_prefix("0X")).unwrap_or(raw);
    // 允许中间空白 / 冒号 / 短横，便于粘贴 "AA:BB CC-DD"
    let cleaned: String = body
        .chars()
        .filter(|c| !c.is_whitespace() && *c != ':' && *c != '-' && *c != ',')
        .collect();
    if cleaned.len() % 2 != 0 {
        return Err("十六进制字符串长度必须为偶数".into());
    }
    let mut out = Vec::with_capacity(cleaned.len() / 2);
    let bytes = cleaned.as_bytes();
    for chunk in bytes.chunks(2) {
        let hex = std::str::from_utf8(chunk).map_err(|e| format!("无效的字符: {e}"))?;
        out.push(u8::from_str_radix(hex, 16).map_err(|e| format!("无效的十六进制: {e}"))?);
    }
    Ok(out)
}

/// 把 (value_type, raw_value) 转成 DataValue
fn parse_data_value(value_type: &str, raw_value: &str) -> Result<DataValue, String> {
    let t = value_type.trim().to_ascii_lowercase();
    match t.as_str() {
        "u8" => {
            let v = parse_unsigned(raw_value)?;
            if v > u8::MAX as u128 {
                return Err("u8 超出范围".into());
            }
            Ok(DataValue::U8(v as u8))
        }
        "i8" => {
            let v = parse_signed(raw_value)?;
            if v < i8::MIN as i128 || v > i8::MAX as i128 {
                return Err("i8 超出范围".into());
            }
            Ok(DataValue::I8(v as i8))
        }
        "u16" => {
            let v = parse_unsigned(raw_value)?;
            if v > u16::MAX as u128 {
                return Err("u16 超出范围".into());
            }
            Ok(DataValue::U16(v as u16))
        }
        "i16" => {
            let v = parse_signed(raw_value)?;
            if v < i16::MIN as i128 || v > i16::MAX as i128 {
                return Err("i16 超出范围".into());
            }
            Ok(DataValue::I16(v as i16))
        }
        "u32" => {
            let v = parse_unsigned(raw_value)?;
            if v > u32::MAX as u128 {
                return Err("u32 超出范围".into());
            }
            Ok(DataValue::U32(v as u32))
        }
        "i32" => {
            let v = parse_signed(raw_value)?;
            if v < i32::MIN as i128 || v > i32::MAX as i128 {
                return Err("i32 超出范围".into());
            }
            Ok(DataValue::I32(v as i32))
        }
        "u64" => Ok(DataValue::U64(parse_unsigned(raw_value)? as u64)),
        "i64" => Ok(DataValue::I64(parse_signed(raw_value)? as i64)),
        "string" | "str" | "sz" => Ok(DataValue::String(raw_value.to_string())),
        "binary" | "blob" | "blob_data" | "bin" => {
            // 允许 "0xAABB" 或纯十六进制
            Ok(DataValue::Binary(parse_hex_bytes(raw_value)?))
        }
        other => Err(format!("不支持的 NVS 类型: {other}")),
    }
}

fn apply_edits(partition: &mut NvsPartition, edits: &[NvsEdit]) -> Result<(), String> {
    for edit in edits {
        match edit.op.as_str() {
            "delete" => {
                partition.entries.retain(|e| {
                    !(e.namespace == edit.namespace && e.key == edit.key)
                });
            }
            "update" => {
                let value_type = edit.value_type.as_deref().ok_or("update 缺少 value_type")?;
                let raw_value = edit.value.as_deref().ok_or("update 缺少 value")?;
                let dv = parse_data_value(value_type, raw_value)
                    .map_err(|e| format!("[{}/{}] {}", edit.namespace, edit.key, e))?;
                let mut hit = false;
                for entry in &mut partition.entries {
                    if entry.namespace == edit.namespace && entry.key == edit.key {
                        entry.set_data(dv.clone());
                        hit = true;
                        break;
                    }
                }
                if !hit {
                    return Err(format!(
                        "未找到要更新的键: {}/{}",
                        edit.namespace, edit.key
                    ));
                }
            }
            "add" => {
                let value_type = edit.value_type.as_deref().ok_or("add 缺少 value_type")?;
                let raw_value = edit.value.as_deref().ok_or("add 缺少 value")?;
                let dv = parse_data_value(value_type, raw_value)
                    .map_err(|e| format!("[{}/{}] {}", edit.namespace, edit.key, e))?;
                if edit.namespace.is_empty() || edit.key.is_empty() {
                    return Err("新增条目必须填写 namespace 与 key".into());
                }
                if edit.key.len() > 15 {
                    return Err(format!("键长度超过 15: {}", edit.key));
                }
                partition
                    .entries
                    .push(NvsEntry::new_data(edit.namespace.clone(), edit.key.clone(), dv));
            }
            other => return Err(format!("未知的编辑操作: {other}")),
        }
    }
    Ok(())
}

#[tauri::command]
fn parse_nvs_partition(path: &str) -> Result<Vec<NvsKeyValue>, String> {
    let bytes = fs::read(path).map_err(|e| format!("读取文件失败: {e}"))?;
    let partition =
        NvsPartition::try_from_bytes(bytes).map_err(|e| format!("解析 NVS 分区失败: {e}"))?;
    Ok(partition
        .entries
        .iter()
        .filter_map(entry_to_row)
        .collect())
}

/// 在原 NVS 二进制基础上应用编辑，重新生成等大小的分区文件。
///
/// - source_path: 之前从设备读取或本地打开的原 NVS bin（应用未改动条目时保留所有原数据）
/// - edits: 用户在表格里的修改 / 删除 / 新增
/// - size: 目标分区大小（必须为 4096 倍数；通常等于读取时检测到的分区大小）
/// - save_path: 写入目标 .bin 路径
#[tauri::command]
fn rebuild_nvs_partition(
    source_path: &str,
    edits: Vec<NvsEdit>,
    size: u64,
    save_path: &str,
) -> Result<NvsRebuildSummary, String> {
    if size == 0 || size % 0x1000 != 0 {
        return Err("分区大小必须是 4096 (0x1000) 的整数倍".into());
    }

    let bytes = fs::read(source_path).map_err(|e| format!("读取源 NVS 失败: {e}"))?;
    let mut partition =
        NvsPartition::try_from_bytes(bytes).map_err(|e| format!("解析源 NVS 分区失败: {e}"))?;

    apply_edits(&mut partition, &edits)?;

    let entries_count = partition
        .entries
        .iter()
        .filter(|e| !e.namespace.is_empty() && !e.key.is_empty())
        .count();

    let blob = partition
        .generate_partition(size as usize)
        .map_err(|e| format!("生成 NVS 二进制失败: {e}"))?;

    if let Some(parent) = Path::new(save_path).parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {e}"))?;
        }
    }
    let written = blob.len() as u64;
    fs::write(save_path, blob).map_err(|e| format!("写入文件失败: {e}"))?;

    Ok(NvsRebuildSummary {
        save_path: save_path.to_string(),
        written_size: written,
        entries: entries_count,
    })
}

/// 从 ESP-IDF 标准 NVS CSV 直接生成新的 NVS 二进制。
///
/// CSV 列：key,type,encoding,value （第一行为 namespace 行）
#[tauri::command]
fn generate_nvs_from_csv(
    csv_path: &str,
    size: u64,
    save_path: &str,
) -> Result<NvsRebuildSummary, String> {
    if size == 0 || size % 0x1000 != 0 {
        return Err("分区大小必须是 4096 (0x1000) 的整数倍".into());
    }
    let csv = fs::read_to_string(csv_path).map_err(|e| format!("读取 CSV 失败: {e}"))?;
    let partition =
        NvsPartition::try_from_str(csv).map_err(|e| format!("解析 NVS CSV 失败: {e}"))?;

    let entries_count = partition
        .entries
        .iter()
        .filter(|e| !e.namespace.is_empty() && !e.key.is_empty())
        .count();

    let blob = partition
        .generate_partition(size as usize)
        .map_err(|e| format!("生成 NVS 二进制失败: {e}"))?;

    if let Some(parent) = Path::new(save_path).parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {e}"))?;
        }
    }
    let written = blob.len() as u64;
    fs::write(save_path, blob).map_err(|e| format!("写入文件失败: {e}"))?;

    Ok(NvsRebuildSummary {
        save_path: save_path.to_string(),
        written_size: written,
        entries: entries_count,
    })
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
struct FileInfo {
    name:String,
    is_dir: bool,
    is_file: bool,
    len: u64,
    create_time: u64,
}

async fn get_central(manager: &Manager) -> Adapter {
    let adapters = manager.adapters().await.unwrap();
    adapters.into_iter().nth(0).unwrap()
}

async fn emit_ble_device(
    window: &tauri::Window,
    central: &Adapter,
    id: &PeripheralId,
) {
    let Ok(peripheral) = central.peripheral(id).await else {
        return;
    };
    let Ok(Some(props)) = peripheral.properties().await else {
        return;
    };

    let mr = BleDevice {
        address: props.address.to_string(),
        local_name: props.local_name.unwrap_or_default(),
        rssi: props.rssi.unwrap_or(0),
        manufacturer_data: props.manufacturer_data,
        services: props.services.iter().map(|x| x.to_string()).collect(),
        service_data: props
            .service_data
            .iter()
            .map(|(uuid, data)| (uuid.to_string(), data.clone()))
            .collect(),
        adv: props
            .service_data
            .values()
            .flatten()
            .cloned()
            .collect(),
    };

    let _ = window.emit(
        "ble_advertisement_scan_event",
        serde_json::to_string(&mr).unwrap(),
    );
}

#[tauri::command]
async fn start_ble_advertisement_scan(window: tauri::Window) {
    let (tx, rx) = mpsc::channel();

    let manager = Manager::new().await.unwrap();

    // get the first bluetooth adapter
    // connect to the adapter
    let central = get_central(&manager).await;

    // Each adapter has an event stream, we fetch via events(),
    // simplifying the type, this will return what is essentially a
    // Future<Result<Stream<Item=CentralEvent>>>.
    let mut events = central.events().await.unwrap();

    // start scanning for devices
    central
        .start_scan(ScanFilter::default())
        .await
        .expect("msg");

    let listen = window.listen("stop_ble_advertisement_scan", move |_event| {
        tx.send(()).unwrap();
    });

    // Print based on whatever the event receiver outputs. Note that the event
    // receiver blocks, so in a real program, this should be run in its own
    // thread (not task, as this library does not yet use async channels).
    while let Some(event) = events.next().await {
        match rx.try_recv() {
            Ok(_) | Err(TryRecvError::Disconnected) => {
                window.unlisten(listen);
                break;
            }
            Err(TryRecvError::Empty) => {}
        }
        match event {
            CentralEvent::DeviceDiscovered(id)
            | CentralEvent::ManufacturerDataAdvertisement { id, .. }
            | CentralEvent::ServicesAdvertisement { id, .. }
            | CentralEvent::ServiceDataAdvertisement { id, .. } => {
                emit_ble_device(&window, &central, &id).await;
            }
            CentralEvent::DeviceConnected(_id) => {}
            CentralEvent::DeviceDisconnected(_id) => {}
            _ => {}
        }
    }
}

#[tauri::command]
async fn start_classic_bluetooth_scan(window: tauri::Window) {
    classic_bluetooth::start_classic_scan(window).await;
}

#[tauri::command]
fn get_serial_port_list() -> Vec<String> {
    let port_info_list = available_ports().unwrap();
    port_info_list
        .iter()
        .map(|x| x.port_name.to_string())
        .collect()
}

#[tauri::command]
fn get_serial_port_details() -> Vec<serial::port_info::SerialPortEntry> {
    serial::port_info::list_ports_with_details()
}

#[tauri::command]
fn get_current_dir() -> String {
    let path = env::current_dir().unwrap();
   path.display().to_string()
}

#[tauri::command]
fn open_file_in_explorer(path: &str) {
    let file_path = format!(r#"{}"#, path);
    Command::new("explorer")
        .arg("/select,")
        .arg(file_path)
        .status()
        .unwrap();
}

#[tauri::command]
fn open_directory_in_explorer(path: &str) {
    Command::new("explorer").arg(path).spawn().unwrap();
}

#[tauri::command]
fn get_file_info(path: &str) -> FileInfo {
    let metadata = fs::metadata(path).unwrap();
    FileInfo {
        name:Path::new(path).file_name().unwrap().to_str().unwrap().to_string(),
        is_dir: metadata.is_dir(),
        is_file: metadata.is_file(),
        len: metadata.len(),
        create_time: metadata
            .created()
            .unwrap()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    }
}

fn main() {
    for item in ["firmware"].iter() {
        if !Path::new(item).exists() {
            fs::create_dir(item).unwrap();
        }
    }

    tauri::Builder::default()
        .setup(|_app| Ok(()))
        .invoke_handler(tauri::generate_handler![
            get_serial_port_list,
            get_serial_port_details,
            get_current_dir,
            open_file_in_explorer,
            open_directory_in_explorer,
            get_file_info,
            parse_nvs_partition,
            rebuild_nvs_partition,
            generate_nvs_from_csv,
            start_ble_advertisement_scan,
            start_classic_bluetooth_scan
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
