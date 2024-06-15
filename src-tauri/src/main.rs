// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use btleplug::api::Peripheral;
use btleplug::api::{bleuuid::BleUuid, Central, CentralEvent, Manager as _, ScanFilter};
use btleplug::platform::{Adapter, Manager};
use futures::stream::StreamExt;
use serialport::available_ports;
use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::Path;
use std::process::Command;
use std::sync::mpsc::{self, TryRecvError};
use std::time::SystemTime;
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
            CentralEvent::DeviceDiscovered(id) => {
                // println!("DeviceDiscovered: {:?}", id);
            }
            CentralEvent::DeviceConnected(id) => {
                // println!("DeviceConnected: {:?}", id);
            }
            CentralEvent::DeviceDisconnected(id) => {
                // println!("DeviceDisconnected: {:?}", id);
            }
            CentralEvent::ManufacturerDataAdvertisement {
                id,
                manufacturer_data,
            } => {
                // println!(
                //     "ManufacturerDataAdvertisement: {:?}, {:?}",
                //     id, manufacturer_data
                // );

                let peripheral = central.peripheral(&id).await;
                match peripheral {
                    Ok(peripheral) => {
                        let device = peripheral.properties().await.unwrap().expect("error");
                        let mr = BleDevice {
                            address: device.address.to_string(),
                            local_name: device.local_name.unwrap_or(String::from("")),
                            rssi: device.rssi.unwrap(),
                            manufacturer_data: device.manufacturer_data,
                            services: device.services.iter().map(|x| x.to_string()).collect(),
                            service_data: device
                                .service_data
                                .iter()
                                .map(|(x, y)| (x.to_string(), y.clone()))
                                .collect(),
                            adv: device
                                .service_data
                                .iter()
                                .flat_map(|x| x.1.clone())
                                .collect(),
                        };

                        window
                            .emit(
                                "ble_advertisement_scan_event",
                                serde_json::to_string(&mr).unwrap(),
                            )
                            .unwrap();
                    }
                    Err(_) => {}
                }
            }
            CentralEvent::ServiceDataAdvertisement { id, service_data } => {
                // println!("ServiceDataAdvertisement: {:?}, {:?}", id, service_data);
            }
            CentralEvent::ServicesAdvertisement { id, services } => {
                let services: Vec<String> =
                    services.into_iter().map(|s| s.to_short_string()).collect();
                // println!("ServicesAdvertisement: {:?}, {:?}", id, services);
            }
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
    for item in ["firmware", "partitions"].iter() {
        if !Path::new(item).exists() {
            fs::create_dir(item).unwrap();
        }
    }

    if !Path::new("chip.list.json").exists() {
        let data ="[\"ESP32\",\"ESP32C2\",\"ESP32C3\",\"ESP32C6\",\"ESP32S2\",\"ESP32S3\",\"ESP32H2\",\"ESP8266\"]";
        fs::write("chip.list.json", data).unwrap();
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
            start_ble_advertisement_scan
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
