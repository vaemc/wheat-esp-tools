//! Classic Bluetooth (BR/EDR) discovery via WinRT DeviceWatcher.
//! Matches the approach in python/BleScanner (ble_scanner.py ClassicScannerWorker).

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

static CLASSIC_SCANNING: AtomicBool = AtomicBool::new(false);

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
    use std::sync::{mpsc, Arc, Mutex};
    use std::time::Duration;
    use tauri::{Emitter, WebviewWindow};
    use windows::core::{IInspectable, Interface, Ref, HSTRING};
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
        window: WebviewWindow,
        by_id: Mutex<HashMap<String, CachedEntry>>,
    }

    fn init_runtime() -> Result<(), String> {
        // 仅接受 S_OK(0) / S_FALSE(1)。RPC_E_CHANGED_MODE 表示公寓模型冲突，不应继续。
        unsafe {
            let hr = CoInitializeEx(None, COINIT_MULTITHREADED);
            let code = hr.0;
            if code != 0 && code != 1 {
                return Err(format!("CoInitializeEx 失败: HRESULT(0x{code:08X})"));
            }
            match RoInitialize(RO_INIT_MULTITHREADED) {
                Ok(()) => {}
                Err(e) if e.code().0 == 1 => {} // S_FALSE：已初始化
                Err(e) => return Err(format!("RoInitialize 失败: {e:?}")),
            }
        }
        Ok(())
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

    fn emit_entry(window: &WebviewWindow, entry: &CachedEntry) {
        let device = entry_to_device(entry);
        let _ = window.emit("classic_bluetooth_scan_event", &device);
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

    pub fn run_watcher(
        window: WebviewWindow,
        stop_rx: mpsc::Receiver<()>,
        ready_tx: mpsc::Sender<Result<(), String>>,
    ) {
        if let Err(e) = init_runtime() {
            let _ = window.emit("classic_bluetooth_scan_error", &e);
            let _ = ready_tx.send(Err(e));
            return;
        }

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
                let msg = format!("CreateWatcher 失败: {e:?}");
                let _ = window.emit("classic_bluetooth_scan_error", &msg);
                let _ = ready_tx.send(Err(msg));
                return;
            }
        };

        let ctx_added = ctx.clone();
        if watcher
            .Added(&TypedEventHandler::new(
                move |_watcher: Ref<DeviceWatcher>, info: Ref<DeviceInformation>| {
                    if let Some(info) = info.as_ref() {
                        handle_added(&ctx_added, info);
                    }
                    Ok(())
                },
            ))
            .is_err()
        {
            let msg = "注册 Added 失败".to_string();
            let _ = window.emit("classic_bluetooth_scan_error", &msg);
            let _ = ready_tx.send(Err(msg));
            return;
        }

        let ctx_updated = ctx.clone();
        if watcher
            .Updated(&TypedEventHandler::new(
                move |_watcher: Ref<DeviceWatcher>, upd: Ref<DeviceInformationUpdate>| {
                    if let Some(upd) = upd.as_ref() {
                        handle_updated(&ctx_updated, upd);
                    }
                    Ok(())
                },
            ))
            .is_err()
        {
            let msg = "注册 Updated 失败".to_string();
            let _ = window.emit("classic_bluetooth_scan_error", &msg);
            let _ = ready_tx.send(Err(msg));
            return;
        }

        let ctx_removed = ctx.clone();
        if watcher
            .Removed(&TypedEventHandler::new(
                move |_watcher: Ref<DeviceWatcher>, upd: Ref<DeviceInformationUpdate>| {
                    if let Some(upd) = upd.as_ref() {
                        handle_removed(&ctx_removed, upd);
                    }
                    Ok(())
                },
            ))
            .is_err()
        {
            let msg = "注册 Removed 失败".to_string();
            let _ = window.emit("classic_bluetooth_scan_error", &msg);
            let _ = ready_tx.send(Err(msg));
            return;
        }

        if let Err(e) = watcher.Start() {
            let msg = format!("启动经典蓝牙扫描失败: {e:?}");
            let _ = window.emit("classic_bluetooth_scan_error", &msg);
            let _ = ready_tx.send(Err(msg));
            return;
        }

        let _ = ready_tx.send(Ok(()));

        loop {
            match stop_rx.recv_timeout(Duration::from_millis(200)) {
                Ok(_) | Err(mpsc::RecvTimeoutError::Disconnected) => {
                    let _ = watcher.Stop();
                    break;
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {}
            }
        }
    }
}

#[cfg(windows)]
pub async fn start_classic_scan(window: tauri::WebviewWindow) -> Result<(), String> {
    use std::panic::{catch_unwind, AssertUnwindSafe};
    use tauri::{Emitter, Listener};

    if CLASSIC_SCANNING.swap(true, Ordering::SeqCst) {
        return Err("经典蓝牙扫描已在进行中".into());
    }

    let (tx, rx) = mpsc::channel();
    let stop_tx = tx.clone();
    let (ready_tx, ready_rx) = mpsc::channel::<Result<(), String>>();

    let listen = window.listen("stop_classic_bluetooth_scan", move |_event| {
        let _ = tx.send(());
    });

    // 阻塞等待放在独立线程，避免占住 async runtime；门闩仅在 worker 退出时清除（禁止强制清）
    thread::spawn(move || {
        let result = catch_unwind(AssertUnwindSafe(|| {
            win::run_watcher(window.clone(), rx, ready_tx);
        }));
        if let Err(payload) = result {
            eprintln!("[classic-bt] watcher thread panicked: {payload:?}");
            let _ = window.emit(
                "classic_bluetooth_scan_error",
                "经典蓝牙扫描线程异常退出",
            );
        }
        window.unlisten(listen);
        CLASSIC_SCANNING.store(false, Ordering::SeqCst);
    });

    /// 等待 worker 退出清标志；绝不 force-clear（否则会叠第二路扫描）
    fn wait_scan_idle() {
        for _ in 0..1500 {
            // 最长约 30s
            if !CLASSIC_SCANNING.load(Ordering::SeqCst) {
                return;
            }
            thread::sleep(Duration::from_millis(20));
        }
        eprintln!("[classic-bt] worker still running after wait; keeping scan lock");
    }

    // 在 blocking 池等待 ready，避免卡住 Tokio worker
    let ready = tauri::async_runtime::spawn_blocking(move || {
        ready_rx.recv_timeout(Duration::from_secs(5))
    })
    .await
    .map_err(|e| format!("等待扫描启动失败: {e}"))?;

    match ready {
        Ok(Ok(())) => Ok(()),
        Ok(Err(e)) => {
            let _ = stop_tx.send(());
            let _ = tauri::async_runtime::spawn_blocking(wait_scan_idle).await;
            Err(e)
        }
        Err(_) => {
            let _ = stop_tx.send(());
            let _ = tauri::async_runtime::spawn_blocking(wait_scan_idle).await;
            Err("启动经典蓝牙扫描超时".into())
        }
    }
}

#[cfg(not(windows))]
pub async fn start_classic_scan(_window: tauri::WebviewWindow) -> Result<(), String> {
    Err("经典蓝牙扫描仅支持 Windows".into())
}
