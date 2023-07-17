// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use regex::Regex;
use serialport::available_ports;
use std::env;
use std::fs;
use std::io::Read;
use std::path::Path;
use std::process::Command;

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
fn get_plugin_list() -> Vec<Plugin> {
    let mut file_data_vec = Vec::new();
    // let path = get_current_dir() + "\\plugins";

    let path = get_current_dir() + "\\..\\src\\components\\plugins";

    if let Ok(entries) = fs::read_dir(path.clone()) {
        for entry in entries {
            if let Ok(entry) = entry {
                let file_path = entry.path();
                if let Ok(mut file) = fs::File::open(file_path.clone()) {
                    let mut contents = String::new();
                    if let Ok(_) = file.read_to_string(&mut contents) {
                        let cleaned_contents = contents.replace(" ", "").replace("\r\n", "");
                        let re = Regex::new(r#"constpluginName="([^"]+)"#).unwrap();
                        if let Some(captures) = re.captures(cleaned_contents.as_str()) {
                            let result = captures.get(1).unwrap().as_str();
                            let file_data = Plugin {
                                path: file_path.to_string_lossy().into_owned(),
                                name: result.to_string(),
                            };
                            file_data_vec.push(file_data);
                        }
                    }
                }
            }
        }
    }
    return file_data_vec;
}

#[tauri::command]
fn is_file(path: &str) -> bool {
    let metadata = fs::metadata(path).unwrap();
    metadata.is_file()
}

fn main() {
    if !Path::new("firmware").exists() {
        fs::create_dir("firmware").unwrap();
    }

    if !Path::new("esptool").exists() {
        fs::create_dir("esptool").unwrap();
    }

    if !Path::new("chip.list.json").exists() {
        let data ="[\"ESP32\",\"ESP32C2\",\"ESP32C3\",\"ESP32C6\",\"ESP32S2\",\"ESP32S3\",\"ESP32H2\",\"ESP8266\"]";
        fs::write("chip.list.json", data).unwrap();
    }

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            greet,
            get_serial_port_list,
            get_current_dir,
            open_file_in_explorer,
            get_plugin_list,
            is_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
