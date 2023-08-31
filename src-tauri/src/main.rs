// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use regex::Regex;
use serde_json::Value;
use serialport::available_ports;
use std::env;
use std::fs;
use std::io::Read;
use std::path::Path;
use std::process::Command;
use std::thread;
use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
struct Plugin {
    path: String,
    name: String,
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
fn is_file(path: &str) -> bool {
    let metadata = fs::metadata(path).unwrap();
    metadata.is_file()
}

#[tauri::command]
fn write_all_text(path: &str, text: &str) {
    fs::write(path, text).unwrap();
}

#[tauri::command]
fn get_full_partition_table(text: &str) -> String {
    fs::write(format!("{}\\partitions\\temp.csv", get_current_dir()), text).unwrap();

    let gen_esp32part_path = format!("{}\\tools\\gen_esp32part.exe", get_current_dir());
    let csv_path = format!("{}\\partitions\\temp.csv", get_current_dir());
    let bin_path = format!("{}\\partitions\\temp.bin", get_current_dir());

    let mut output = Command::new(&gen_esp32part_path)
        .arg(&csv_path)
        .arg(&bin_path)
        .output()
        .expect("error");

    if String::from_utf8_lossy(&output.stderr).contains("Verifying table...") {
        output = Command::new(&gen_esp32part_path)
            .arg(&bin_path)
            .arg(&csv_path)
            .output()
            .expect("error");
        if String::from_utf8_lossy(&output.stderr).contains("Verifying table...") {
            fs::read_to_string(&csv_path).expect("error")
        } else {
            String::from_utf8_lossy(&output.stderr).to_string()
        }
    } else {
        String::from_utf8_lossy(&output.stderr).to_string()
    }
}

fn main() {
    for item in ["firmware", "tools", "partitions"].iter() {
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
            let window = app.get_window("main").unwrap();
            let window_clone = window.clone();

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_serial_port_list,
            get_current_dir,
            open_file_in_explorer,
            is_file,
            write_all_text,
            get_full_partition_table
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
