// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serialport::available_ports;
use std::env;
use std::fs;
use std::path::Path;
use std::process::Command;
use std::time::SystemTime;
use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
struct Plugin {
    path: String,
    name: String,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
struct FileInfo {
    is_dir: bool,
    is_file: bool,
    len: u64,
    create_time: u64,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_serial_port_list() -> Vec<String> {
    let port_info_list = available_ports().unwrap();
    let port_list: Vec<String> = port_info_list
        .iter()
        .map(|x| x.port_name.to_string())
        .collect();
    return port_list;
}

#[tauri::command]
fn get_current_dir() -> String {
    let path = env::current_dir().unwrap();
    return path.display().to_string();
}

#[tauri::command]
fn open_file_in_explorer(path: &str) {
    let file_path = format!(r#"{}"#, path);
    Command::new("explorer")
        .arg("/select,")
        .arg(file_path)
        .status()
        .expect("failed to execute command");
}

#[tauri::command]
fn get_file_info(path: &str) -> FileInfo {
    let metadata = fs::metadata(path).unwrap();
    FileInfo {
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

#[tauri::command]
fn write_all_text(path: &str, text: &str) {
    fs::write(path, text).unwrap();
}

#[tauri::command]
fn collect_all_paths(path: &str, level: u32) -> Vec<String> {
    let mut paths: Vec<String> = Vec::new();

    if level >= 2 {
        return paths;
    }

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                let path_str = path.to_str().unwrap().to_owned();
                paths.push(path_str.clone());

                if path.is_dir() {
                    let sub_paths = collect_all_paths(path.to_str().unwrap(), level + 1);
                    paths.extend(sub_paths);
                }
            }
        }
    }

    paths
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
            write_all_text,
            collect_all_paths,
            get_file_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
