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

pub fn list_ports_with_details() -> Result<Vec<SerialPortEntry>, String> {
    #[cfg(windows)]
    {
        match crate::serial::win_ports::list_ports() {
            Ok(ports) if !ports.is_empty() => {
                // 仅当 SetupAPI 缺序列号时，才回退一次 available_ports
                let need_usb_fallback = ports.iter().any(|p| {
                    p.serial_number
                        .as_ref()
                        .map(|s| s.trim().is_empty())
                        .unwrap_or(true)
                });
                let usb_serials = if need_usb_fallback {
                    usb_serial_map()
                } else {
                    HashMap::new()
                };
                return Ok(ports
                    .into_iter()
                    .map(|port| {
                        let serial_number = normalize_optional(port.serial_number).or_else(|| {
                            usb_serials
                                .get(&port.port_name)
                                .cloned()
                                .flatten()
                                .and_then(|s| normalize_optional(Some(s)))
                        });
                        SerialPortEntry {
                            port_name: port.port_name,
                            friendly_name: normalize_optional(Some(port.friendly_name)),
                            description: port.bus_reported_desc,
                            serial_number,
                        }
                    })
                    .collect());
            }
            Ok(_) => {}
            Err(e) => {
                eprintln!("[serial] SetupAPI 枚举失败，回退 serialport: {e}");
            }
        }

        return available_ports()
            .map(|list| {
                list.into_iter()
                    .map(|port| {
                        let (description, serial_number) = match port.port_type {
                            SerialPortType::UsbPort(usb) => (
                                normalize_optional(usb.product.or(usb.manufacturer)),
                                normalize_optional(usb.serial_number),
                            ),
                            _ => (None, None),
                        };
                        SerialPortEntry {
                            port_name: port.port_name,
                            friendly_name: None,
                            description,
                            serial_number,
                        }
                    })
                    .collect()
            })
            .map_err(|e| format!("枚举串口失败: {e}"));
    }

    #[cfg(not(windows))]
    {
        available_ports()
            .map(|list| list.into_iter().map(build_entry).collect())
            .map_err(|e| format!("枚举串口失败: {e}"))
    }
}

#[cfg(not(windows))]
fn build_entry(port: SerialPortInfo) -> SerialPortEntry {
    let mut description = None;
    let mut serial_number = None;

    if let SerialPortType::UsbPort(usb) = port.port_type {
        description = normalize_optional(usb.product.or(usb.manufacturer));
        serial_number = normalize_optional(usb.serial_number);
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
                Some((port.port_name, usb.serial_number))
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
