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
use tauri::Manager as TauriManager;

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
        }),
        EntryContent::File { .. } => None,
    }
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

        // thread::sleep(Duration::from_millis(100));
    }
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
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
    for item in ["firmware", "partitions", "nvs"].iter() {
        if !Path::new(item).exists() {
            fs::create_dir(item).unwrap();
        }
    }

    tauri::Builder::default()
        .setup(|app| {
            let _window = app.get_window("main").unwrap();

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_serial_port_list,
            get_current_dir,
            open_file_in_explorer,
            open_directory_in_explorer,
            get_file_info,
            parse_nvs_partition,
            start_ble_advertisement_scan
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
