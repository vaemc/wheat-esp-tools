use serde::Serialize;
use std::collections::HashMap;

#[cfg(windows)]
use serialport::{available_ports, SerialPortType};

#[cfg(not(windows))]
use serialport::{available_ports, SerialPortInfo, SerialPortType};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SerialPortEntry {
    pub port_name: String,
    pub friendly_name: Option<String>,
    pub description: Option<String>,
    pub serial_number: Option<String>,
}

pub fn list_ports_with_details() -> Vec<SerialPortEntry> {
    #[cfg(windows)]
    {
        let usb_serials = usb_serial_map();
        return crate::serial::win_ports::list_ports()
            .unwrap_or_default()
            .into_iter()
            .map(|port| {
                let serial_number = port
                    .serial_number
                    .or_else(|| usb_serials.get(&port.port_name).cloned().flatten());
                SerialPortEntry {
                    port_name: port.port_name,
                    friendly_name: normalize_optional(Some(port.friendly_name)),
                    description: port.bus_reported_desc,
                    serial_number,
                }
            })
            .collect();
    }

    #[cfg(not(windows))]
    available_ports()
        .unwrap_or_default()
        .into_iter()
        .map(build_entry)
        .collect()
}

#[cfg(not(windows))]
fn build_entry(port: SerialPortInfo) -> SerialPortEntry {
    let mut description = None;
    let mut serial_number = None;

    if let SerialPortType::UsbPort(usb) = port.port_type {
        description = usb.product.clone().or(usb.manufacturer.clone());
        serial_number = usb.serial_number.clone();
    }

    SerialPortEntry {
        port_name: port.port_name,
        friendly_name: None,
        description,
        serial_number,
    }
}

#[cfg(windows)]
fn usb_serial_map() -> HashMap<String, Option<String>> {
    available_ports()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|port| {
            if let SerialPortType::UsbPort(usb) = port.port_type {
                Some((port.port_name, usb.serial_number.clone()))
            } else {
                None
            }
        })
        .collect()
}

fn normalize_optional(value: Option<String>) -> Option<String> {
    value.and_then(|text| {
        let trimmed = text.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}
