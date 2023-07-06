// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serialport::available_ports;
use std::env;
use std::fs;
use std::path::Path;
use std::process::Command;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
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
    let platform = env::consts::OS.to_string();
    let mut program = "explorer";
    if platform == "windows".to_string() {
        program = "explorer";
    }
    if platform == "macos".to_string() {
        program = "open";
    }
    if platform == "linux".to_string() {
        program = "xdg-open";
    }
    Command::new(program).arg(path).spawn().unwrap();
}

fn main() {
    if !Path::new("firmware").exists() {
        fs::create_dir("firmware").unwrap();
    }

    if !Path::new("esptool").exists() {
        fs::create_dir("esptool").unwrap();
    }

    if !Path::new("tools.config.json").exists() {
        let data = "[\n    {\n        \"name\": \"合并build目录的固件\",\n        \"toast\": null,\n        \"cmd\": [\n            \"--chip\",\n            \"${chip}\",\n            \"merge_bin\",\n            \"-o\",\n            \"${appName}\",\n            \"${flashArgs}\"\n        ],\n        \"isDrop\": true,\n        \"drop\": {\n            \"value\": \"mergeBin\",\n            \"isDirectory\": true,\n            \"desc\": \"选择或者拖拽build目录到此\",\n            \"help\": \"请在执行idf.py build后再使用\",\n            \"regex\": \"(build)$\"\n        }\n    },\n    {\n        \"name\": \"烧录build目录的固件\",\n        \"toast\": \"烧录未合并的固件\",\n        \"cmd\": [\n            \"--chip\",\n            \"${chip}\",\n            \"-p\",\n            \"${port}\",\n            \"-b\",\n            \"1152000\",\n            \"--before=default_reset\",\n            \"--after=hard_reset\",\n            \"write_flash\",\n            \"${flashArgs}\"\n        ],\n        \"isDrop\": true,\n        \"drop\": {\n            \"value\": \"flash\",\n            \"isDirectory\": true,\n            \"desc\": \"选择或者拖拽build目录到此\",\n            \"help\": \"请在执行idf.py build后再使用\",\n            \"regex\": \"(build)$\"\n        }\n    },\n    {\n        \"name\": \"烧录地址为0x0的固件\",\n        \"toast\": \"烧录合并后的固件\",\n        \"cmd\": [\n            \"-p\",\n            \"${port}\",\n            \"-b\",\n            \"1152000\",\n            \"write_flash\",\n            \"0x0\",\n            \"${path}\"\n        ],\n        \"isDrop\": true,\n        \"drop\": {\n            \"value\": \"flashSingle\",\n            \"isDirectory\": false,\n            \"desc\": \"选择或者拖拽bin文件到此\",\n            \"help\": \"烧录地址为0x0的固件\",\n            \"regex\": \".(bin)$\"\n        }\n    },\n    {\n        \"name\": \"擦除固件\",\n        \"toast\": \"擦除固件\",\n        \"isDrop\": false,\n        \"cmd\": [\n            \"-p\",\n            \"${port}\",\n            \"erase_flash\"\n        ]\n    },\n    {\n        \"name\": \"获取flash大小\",\n        \"toast\": \"获取flash大小\",\n        \"isDrop\": false,\n        \"cmd\": [\n            \"-p\",\n            \"${port}\",\n            \"flash_id\"\n        ]\n    }\n]";
        fs::write("tools.config.json", data).unwrap();
    }

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            greet,
            get_serial_port_list,
            get_current_dir,
            open_file_in_explorer
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
