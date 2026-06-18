//! Classic Bluetooth (BR/EDR) discovery via WinRT DeviceWatcher.
//! Matches the approach in python/BleScanner (ble_scanner.py ClassicScannerWorker).

use std::sync::mpsc;
use std::thread;

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct ClassicBtDevice {
    pub address: String,
    pub local_name: String,
    pub class_of_device: String,
    pub class_category: String,
    pub connected: bool,
    pub paired: bool,
    pub authenticated: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rssi: Option<i16>,
}

#[cfg(windows)]
mod win {
    use super::ClassicBtDevice;
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex, mpsc};
    use std::thread;
    use std::time::Duration;
    use tauri::Window;
    use windows::core::{Interface, Ref, HSTRING, IInspectable};
    use windows::Devices::Enumeration::{
        DeviceInformation, DeviceInformationKind, DeviceInformationUpdate, DeviceWatcher,
    };
    use windows::Foundation::{IPropertyValue, PropertyType, TypedEventHandler};
    use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};
    use windows::Win32::System::WinRT::{RoInitialize, RO_INIT_MULTITHREADED};
    use windows_collections::{IMapView, IVectorView};

    /// Bluetooth Classic AEP — same as BleScanner.py `AEP_PROTOCOL_CLASSIC`
    const AEP_PROTOCOL_CLASSIC: &str = "{e0cbf06c-cd8b-4647-bb8a-263b43f0f974}";
    const PROP_ADDRESS: &str = "System.Devices.Aep.DeviceAddress";
    const PROP_RSSI: &str = "System.Devices.Aep.SignalStrength";
    const PROP_PAIRED: &str = "System.Devices.Aep.IsPaired";
    const PROP_CONNECTED: &str = "System.Devices.Aep.IsConnected";

    #[derive(Clone, Debug)]
    struct CachedEntry {
        address: String,
        name: String,
        rssi: Option<i16>,
        paired: bool,
        connected: bool,
    }

    struct WatcherContext {
        window: Window,
        by_id: Mutex<HashMap<String, CachedEntry>>,
    }

    fn init_runtime() {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            let _ = RoInitialize(RO_INIT_MULTITHREADED);
        }
    }

    fn normalize_mac(raw: &str) -> String {
        let hex: String = raw
            .chars()
            .filter(|c| c.is_ascii_hexdigit())
            .collect::<String>()
            .to_uppercase();
        if hex.len() >= 12 {
            let h = &hex[hex.len() - 12..];
            format!(
                "{}:{}:{}:{}:{}:{}",
                &h[0..2],
                &h[2..4],
                &h[4..6],
                &h[6..8],
                &h[8..10],
                &h[10..12]
            )
        } else {
            raw.trim().to_uppercase()
        }
    }

    fn addr_from_id(dev_id: &str) -> String {
        let mut last = String::new();
        let mut i = 0;
        let bytes = dev_id.as_bytes();
        while i + 17 <= bytes.len() {
            if bytes[i].is_ascii_hexdigit()
                && bytes[i + 1].is_ascii_hexdigit()
                && bytes[i + 2] == b':'
                && bytes[i + 5].is_ascii_hexdigit()
                && bytes[i + 8] == b':'
                && bytes[i + 11] == b':'
                && bytes[i + 14] == b':'
            {
                last = dev_id[i..i + 17].to_uppercase();
            }
            i += 1;
        }
        last
    }

    fn normalize_addr(raw: Option<String>, dev_id: &str) -> Option<String> {
        raw.filter(|s| !s.is_empty())
            .map(|s| normalize_mac(&s))
            .filter(|s| !s.is_empty())
            .or_else(|| {
                let a = addr_from_id(dev_id);
                if a.is_empty() {
                    None
                } else {
                    Some(a)
                }
            })
    }

    fn read_prop_i16(props: &IMapView<HSTRING, IInspectable>, key: &str) -> Option<i16> {
        let value = props.Lookup(&HSTRING::from(key)).ok()?;
        let prop: IPropertyValue = value.cast().ok()?;
        match prop.Type().ok()? {
            PropertyType::Int16 => prop.GetInt16().ok().map(i16::from),
            PropertyType::Int32 => prop
                .GetInt32()
                .ok()
                .map(|v| v.clamp(i16::MIN as i32, i16::MAX as i32) as i16),
            PropertyType::UInt16 => prop.GetUInt16().ok().map(|v| v as i16),
            PropertyType::UInt32 => prop
                .GetUInt32()
                .ok()
                .map(|v| v.clamp(0, i16::MAX as u32) as i16),
            _ => None,
        }
    }

    fn read_prop_string(props: &IMapView<HSTRING, IInspectable>, key: &str) -> Option<String> {
        let value = props.Lookup(&HSTRING::from(key)).ok()?;
        let prop: IPropertyValue = value.cast().ok()?;
        match prop.Type().ok()? {
            PropertyType::String => prop.GetString().ok().map(|s| s.to_string()),
            _ => None,
        }
    }

    fn read_prop_bool(props: &IMapView<HSTRING, IInspectable>, key: &str) -> Option<bool> {
        let value = props.Lookup(&HSTRING::from(key)).ok()?;
        let prop: IPropertyValue = value.cast().ok()?;
        match prop.Type().ok()? {
            PropertyType::Boolean => prop.GetBoolean().ok(),
            _ => None,
        }
    }

    fn has_key(props: &IMapView<HSTRING, IInspectable>, key: &str) -> bool {
        props.HasKey(&HSTRING::from(key)).unwrap_or(false)
    }

    fn entry_to_device(entry: &CachedEntry) -> ClassicBtDevice {
        ClassicBtDevice {
            address: entry.address.clone(),
            local_name: entry.name.clone(),
            class_of_device: "0x000000".to_string(),
            class_category: "Misc".to_string(),
            connected: entry.connected,
            paired: entry.paired,
            authenticated: entry.paired,
            rssi: entry.rssi,
        }
    }

    fn emit_entry(window: &Window, entry: &CachedEntry) {
        let device = entry_to_device(entry);
        if let Ok(json) = serde_json::to_string(&device) {
            let _ = window.emit("classic_bluetooth_scan_event", json);
        }
    }

    fn merge_rssi(current: Option<i16>, next: Option<i16>) -> Option<i16> {
        match (current, next) {
            (None, v) | (v, None) => v,
            (Some(a), Some(b)) => Some(a.max(b)),
        }
    }

    fn handle_added(ctx: &Arc<WatcherContext>, info: &DeviceInformation) {
        let Ok(dev_id) = info.Id() else {
            return;
        };
        let dev_id = dev_id.to_string();
        let Ok(props) = info.Properties() else {
            return;
        };
        let Some(addr) = normalize_addr(read_prop_string(&props, PROP_ADDRESS), &dev_id) else {
            return;
        };
        let rssi = if has_key(&props, PROP_RSSI) {
            read_prop_i16(&props, PROP_RSSI)
        } else {
            None
        };
        let paired = if has_key(&props, PROP_PAIRED) {
            read_prop_bool(&props, PROP_PAIRED).unwrap_or(false)
        } else {
            false
        };
        let connected = if has_key(&props, PROP_CONNECTED) {
            read_prop_bool(&props, PROP_CONNECTED).unwrap_or(false)
        } else {
            false
        };
        let name = info.Name().ok().map(|n| n.to_string()).unwrap_or_default();
        let entry = CachedEntry {
            address: addr,
            name,
            rssi,
            paired,
            connected,
        };
        ctx.by_id
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(dev_id, entry.clone());
        emit_entry(&ctx.window, &entry);
    }

    fn handle_updated(ctx: &Arc<WatcherContext>, upd: &DeviceInformationUpdate) {
        let Ok(dev_id) = upd.Id() else {
            return;
        };
        let dev_id = dev_id.to_string();
        let Ok(props) = upd.Properties() else {
            return;
        };

        let mut entry = ctx
            .by_id
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(&dev_id)
            .unwrap_or(CachedEntry {
                address: normalize_addr(None, &dev_id).unwrap_or_default(),
                name: String::new(),
                rssi: None,
                paired: false,
                connected: false,
            });

        if has_key(&props, PROP_ADDRESS) {
            if let Some(addr) = normalize_addr(read_prop_string(&props, PROP_ADDRESS), &dev_id) {
                entry.address = addr;
            }
        }
        if entry.address.is_empty() {
            if let Some(addr) = normalize_addr(None, &dev_id) {
                entry.address = addr;
            }
        }
        if entry.address.is_empty() {
            return;
        }
        if has_key(&props, PROP_RSSI) {
            let new_rssi = read_prop_i16(&props, PROP_RSSI);
            entry.rssi = merge_rssi(entry.rssi, new_rssi);
        }
        if has_key(&props, PROP_PAIRED) {
            entry.paired = read_prop_bool(&props, PROP_PAIRED).unwrap_or(entry.paired);
        }
        if has_key(&props, PROP_CONNECTED) {
            entry.connected = read_prop_bool(&props, PROP_CONNECTED).unwrap_or(entry.connected);
        }

        ctx.by_id
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(dev_id, entry.clone());
        emit_entry(&ctx.window, &entry);
    }

    fn handle_removed(ctx: &Arc<WatcherContext>, upd: &DeviceInformationUpdate) {
        if let Ok(id) = upd.Id() {
            ctx.by_id
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .remove(&id.to_string());
        }
    }

    fn watcher_properties() -> IVectorView<HSTRING> {
        IVectorView::from(vec![
            HSTRING::from(PROP_ADDRESS),
            HSTRING::from(PROP_RSSI),
            HSTRING::from(PROP_PAIRED),
            HSTRING::from(PROP_CONNECTED),
        ])
    }

    pub fn run_watcher(window: Window, stop_rx: mpsc::Receiver<()>) {
        init_runtime();

        let ctx = Arc::new(WatcherContext {
            window: window.clone(),
            by_id: Mutex::new(HashMap::new()),
        });

        let aqs = HSTRING::from(format!(
            r#"System.Devices.Aep.ProtocolId:="{AEP_PROTOCOL_CLASSIC}""#
        ));
        let props = watcher_properties();

        let watcher = match DeviceInformation::CreateWatcherWithKindAqsFilterAndAdditionalProperties(
            &aqs,
            &props,
            DeviceInformationKind::AssociationEndpoint,
        ) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("[classic-bt] CreateWatcher failed: {e:?}");
                return;
            }
        };

        let ctx_added = ctx.clone();
        let _token_added = watcher
            .Added(&TypedEventHandler::new(
                move |_watcher: Ref<DeviceWatcher>, info: Ref<DeviceInformation>| {
                    if let Some(info) = info.as_ref() {
                        handle_added(&ctx_added, info);
                    }
                    Ok(())
                },
            ))
            .ok();

        let ctx_updated = ctx.clone();
        let _token_updated = watcher
            .Updated(&TypedEventHandler::new(
                move |_watcher: Ref<DeviceWatcher>, upd: Ref<DeviceInformationUpdate>| {
                    if let Some(upd) = upd.as_ref() {
                        handle_updated(&ctx_updated, upd);
                    }
                    Ok(())
                },
            ))
            .ok();

        let ctx_removed = ctx.clone();
        let _token_removed = watcher
            .Removed(&TypedEventHandler::new(
                move |_watcher: Ref<DeviceWatcher>, upd: Ref<DeviceInformationUpdate>| {
                    if let Some(upd) = upd.as_ref() {
                        handle_removed(&ctx_removed, upd);
                    }
                    Ok(())
                },
            ))
            .ok();

        if let Err(e) = watcher.Start() {
            eprintln!("[classic-bt] watcher.Start failed: {e:?}");
            return;
        }

        loop {
            if stop_rx.try_recv().is_ok() {
                let _ = watcher.Stop();
                break;
            }
            thread::sleep(Duration::from_millis(100));
        }
    }
}

#[cfg(windows)]
pub async fn start_classic_scan(window: tauri::Window) {
    let (tx, rx) = mpsc::channel();

    let listen = window.listen("stop_classic_bluetooth_scan", move |_event| {
        let _ = tx.send(());
    });

    thread::spawn(move || {
        win::run_watcher(window.clone(), rx);
        window.unlisten(listen);
    });
}

#[cfg(not(windows))]
pub async fn start_classic_scan(_window: tauri::Window) {}
