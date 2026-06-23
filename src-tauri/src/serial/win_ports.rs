use std::io;
use windows::core::GUID;
use windows::Win32::Devices::DeviceAndDriverInstallation::{
    SetupDiDestroyDeviceInfoList, SetupDiEnumDeviceInfo, SetupDiGetClassDevsW,
    SetupDiGetDeviceInstanceIdW, SetupDiGetDevicePropertyW, SetupDiGetDeviceRegistryPropertyW,
    SetupDiOpenDevRegKey, CM_Get_Device_IDW, CM_Get_Parent, CONFIGRET, CR_SUCCESS,
    DIGCF_DEVICEINTERFACE, DIGCF_PRESENT, DIREG_DEV, HDEVINFO, SETUP_DI_REGISTRY_PROPERTY,
    SP_DEVINFO_DATA,
};
use windows::Win32::Devices::Properties::{
    DEVPKEY_Device_BusReportedDeviceDesc, DEVPROP_TYPE_STRING,
};
use windows::Win32::Foundation::{
    DEVPROPKEY, ERROR_INSUFFICIENT_BUFFER, ERROR_NO_MORE_ITEMS,
};
use windows::Win32::System::Registry::{
    RegCloseKey, RegOpenKeyExW, RegQueryValueExW, HKEY, HKEY_LOCAL_MACHINE, KEY_READ, REG_SZ,
};

const SPDRP_FRIENDLYNAME: SETUP_DI_REGISTRY_PROPERTY = SETUP_DI_REGISTRY_PROPERTY(0x0000000C);
const SPDRP_HARDWAREID: SETUP_DI_REGISTRY_PROPERTY = SETUP_DI_REGISTRY_PROPERTY(0x00000001);

#[derive(Debug, Clone)]
pub struct PortInfo {
    pub port_name: String,
    pub friendly_name: String,
    pub bus_reported_desc: Option<String>,
    pub serial_number: Option<String>,
}

pub fn list_ports() -> io::Result<Vec<PortInfo>> {
    let guid = GUID_DEVINTERFACE_COMPORT;
    let device_info_set = unsafe {
        SetupDiGetClassDevsW(
            Some(&guid),
            None,
            None,
            DIGCF_PRESENT | DIGCF_DEVICEINTERFACE,
        )
    }
    .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;

    if device_info_set == HDEVINFO::default() {
        return Ok(Vec::new());
    }

    let _guard = DeviceInfoGuard(device_info_set);
    let mut ports = Vec::new();
    let mut index = 0u32;

    loop {
        let mut dev_info_data = SP_DEVINFO_DATA::default();
        dev_info_data.cbSize = std::mem::size_of::<SP_DEVINFO_DATA>() as u32;

        let result = unsafe { SetupDiEnumDeviceInfo(device_info_set, index, &mut dev_info_data) };
        match result {
            Ok(()) => {}
            Err(e) if e.code() == ERROR_NO_MORE_ITEMS.to_hresult() => break,
            Err(e) => return Err(io::Error::new(io::ErrorKind::Other, e.to_string())),
        }

        let Some(port_name) = read_port_name(device_info_set, &dev_info_data) else {
            index += 1;
            continue;
        };

        if port_name.starts_with("LPT") {
            index += 1;
            continue;
        }

        let friendly_name = read_registry_string(
            device_info_set,
            &dev_info_data,
            SPDRP_FRIENDLYNAME,
        )
        .unwrap_or_default();
        let hardware_id = read_registry_string(
            device_info_set,
            &dev_info_data,
            SPDRP_HARDWAREID,
        )
        .unwrap_or_default();
        let bus_reported_desc = read_device_property(
            device_info_set,
            &dev_info_data,
            &DEVPKEY_Device_BusReportedDeviceDesc,
        );
        let serial_number = read_serial_number(device_info_set, &dev_info_data, &hardware_id);

        ports.push(PortInfo {
            port_name,
            friendly_name,
            bus_reported_desc,
            serial_number,
        });

        index += 1;
    }

    ports.sort_by(|a, b| a.port_name.cmp(&b.port_name));
    Ok(ports)
}

fn read_serial_number(
    device_info_set: HDEVINFO,
    dev_info_data: &SP_DEVINFO_DATA,
    hardware_id: &str,
) -> Option<String> {
    serial_from_instance_id(&read_instance_id(device_info_set, dev_info_data).unwrap_or_default())
        .or_else(|| serial_from_devinst_parents(dev_info_data.DevInst))
        .or_else(|| serial_from_hardware_id(hardware_id))
        .or_else(|| read_registry_serial(device_info_set, dev_info_data))
}

fn serial_from_devinst_parents(start: u32) -> Option<String> {
    let mut devinst = start;
    for _ in 0..8 {
        if let Some(id) = read_devinst_instance_id(devinst) {
            if let Some(serial) = serial_from_instance_id(&id) {
                return Some(serial);
            }
            if let Some(serial) = read_serial_from_enum_registry(&id) {
                return Some(serial);
            }
        }

        let mut parent = 0u32;
        let result: CONFIGRET = unsafe { CM_Get_Parent(&mut parent, devinst, 0) };
        if result != CR_SUCCESS {
            break;
        }
        devinst = parent;
    }
    None
}

fn read_serial_from_enum_registry(instance_id: &str) -> Option<String> {
    let path: Vec<u16> = format!("SYSTEM\\CurrentControlSet\\Enum\\{instance_id}")
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();

    let mut key = HKEY::default();
    let open_result = unsafe {
        RegOpenKeyExW(
            HKEY_LOCAL_MACHINE,
            windows::core::PCWSTR(path.as_ptr()),
            Some(0),
            KEY_READ,
            &mut key,
        )
    };
    if open_result.is_err() || key == HKEY::default() {
        return None;
    }

    let _guard = RegKeyGuard(key);
    normalize_optional(read_reg_value(key, "SerialNumber"))
}

fn read_devinst_instance_id(devinst: u32) -> Option<String> {
    let mut buffer = vec![0u16; 512];
    let result: CONFIGRET = unsafe { CM_Get_Device_IDW(devinst, &mut buffer, 0) };
    if result != CR_SUCCESS {
        return None;
    }
    Some(wide_to_string(&buffer))
}

fn read_instance_id(device_info_set: HDEVINFO, dev_info_data: &SP_DEVINFO_DATA) -> Option<String> {
    let mut buffer = vec![0u16; 512];
    unsafe {
        SetupDiGetDeviceInstanceIdW(
            device_info_set,
            dev_info_data,
            Some(&mut buffer),
            None,
        )
    }
    .ok()?;
    Some(wide_to_string(&buffer))
}

fn read_registry_serial(device_info_set: HDEVINFO, dev_info_data: &SP_DEVINFO_DATA) -> Option<String> {
    let key = unsafe {
        SetupDiOpenDevRegKey(
            device_info_set,
            dev_info_data,
            1,
            0,
            DIREG_DEV,
            KEY_READ.0 as u32,
        )
    }
    .ok()?;

    if key == HKEY::default() {
        return None;
    }

    let _guard = RegKeyGuard(key);
    normalize_optional(read_reg_value(key, "SerialNumber"))
}

struct DeviceInfoGuard(HDEVINFO);

impl Drop for DeviceInfoGuard {
    fn drop(&mut self) {
        unsafe {
            let _ = SetupDiDestroyDeviceInfoList(self.0);
        }
    }
}

fn read_port_name(device_info_set: HDEVINFO, dev_info_data: &SP_DEVINFO_DATA) -> Option<String> {
    let key = unsafe {
        SetupDiOpenDevRegKey(
            device_info_set,
            dev_info_data,
            1,
            0,
            DIREG_DEV,
            KEY_READ.0 as u32,
        )
    }
    .ok()?;

    if key == HKEY::default() {
        return None;
    }

    let _guard = RegKeyGuard(key);
    read_reg_value(key, "PortName")
}

struct RegKeyGuard(HKEY);

impl Drop for RegKeyGuard {
    fn drop(&mut self) {
        unsafe {
            let _ = RegCloseKey(self.0);
        }
    }
}

fn read_reg_value(key: HKEY, value_name: &str) -> Option<String> {
    let value_name: Vec<u16> = value_name.encode_utf16().chain(std::iter::once(0)).collect();
    let mut buffer = vec![0u16; 256];
    let mut size = (buffer.len() * 2) as u32;
    let mut kind = REG_SZ;

    let result = unsafe {
        RegQueryValueExW(
            key,
            windows::core::PCWSTR(value_name.as_ptr()),
            None,
            Some(&mut kind),
            Some(buffer.as_mut_ptr() as *mut u8),
            Some(&mut size),
        )
    };

    if result.is_err() {
        return None;
    }

    Some(wide_to_string(&buffer))
}

fn read_registry_string(
    device_info_set: HDEVINFO,
    dev_info_data: &SP_DEVINFO_DATA,
    property: SETUP_DI_REGISTRY_PROPERTY,
) -> Option<String> {
    let mut buffer = vec![0u16; 512];
    let mut required = 0u32;

    let ok = unsafe {
        SetupDiGetDeviceRegistryPropertyW(
            device_info_set,
            dev_info_data,
            property,
            None,
            Some(std::slice::from_raw_parts_mut(
                buffer.as_mut_ptr() as *mut u8,
                buffer.len() * 2,
            )),
            Some(&mut required),
        )
    };

    if ok.is_err() {
        return None;
    }

    Some(wide_to_string(&buffer))
}

fn read_device_property(
    device_info_set: HDEVINFO,
    dev_info_data: &SP_DEVINFO_DATA,
    property_key: &DEVPROPKEY,
) -> Option<String> {
    let mut buffer = vec![0u16; 512];
    let mut property_type = DEVPROP_TYPE_STRING;
    let mut required = 0u32;

    let result = unsafe {
        SetupDiGetDevicePropertyW(
            device_info_set,
            dev_info_data,
            property_key,
            &mut property_type,
            Some(std::slice::from_raw_parts_mut(
                buffer.as_mut_ptr() as *mut u8,
                buffer.len() * 2,
            )),
            Some(&mut required),
            0,
        )
    };

    match result {
        Ok(()) => normalize_optional(Some(wide_to_string(&buffer))),
        Err(e) if e.code() == ERROR_INSUFFICIENT_BUFFER.to_hresult() => {
            let char_count = required.div_ceil(2) as usize;
            buffer.resize(char_count.max(1), 0);
            unsafe {
                SetupDiGetDevicePropertyW(
                    device_info_set,
                    dev_info_data,
                    property_key,
                    &mut property_type,
                    Some(std::slice::from_raw_parts_mut(
                        buffer.as_mut_ptr() as *mut u8,
                        buffer.len() * 2,
                    )),
                    Some(&mut required),
                    0,
                )
            }
            .ok()?;
            normalize_optional(Some(wide_to_string(&buffer)))
        }
        Err(_) => None,
    }
}

fn wide_to_string(buffer: &[u16]) -> String {
    let len = buffer.iter().position(|&c| c == 0).unwrap_or(buffer.len());
    String::from_utf16_lossy(&buffer[..len])
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

fn serial_from_instance_id(instance_id: &str) -> Option<String> {
    if instance_id.is_empty() {
        return None;
    }

    let parts: Vec<&str> = instance_id.split('\\').collect();
    if parts.len() >= 3 && parts[0].eq_ignore_ascii_case("USB") {
        let instance = parts[2].trim();
        if !instance.is_empty() && !instance.contains('&') {
            return Some(instance.to_string());
        }
    }
    None
}

fn serial_from_hardware_id(hardware_id: &str) -> Option<String> {
    for line in hardware_id.lines() {
        if let Some(serial) = serial_from_instance_id(line.trim()) {
            return Some(serial);
        }
    }
    None
}

const GUID_DEVINTERFACE_COMPORT: GUID = GUID::from_u128(0x86E0D1E0_8089_11D0_9CE4_08003E301F73);
