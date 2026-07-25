//! BLE GATT 连接与读写 / Notify。
//! 面向通用 GATT；测试外设：ESP32-S3-BLE（Service 0x00FF / Msg 0xFF01 / Counter 0xFF02）。

use btleplug::api::{
    bleuuid::{uuid_from_u16, uuid_from_u32},
    Central, CharPropFlags, Characteristic, Manager as _, Peripheral as _, ScanFilter,
    WriteType,
};
use btleplug::platform::{Adapter, Manager, Peripheral};
use futures::stream::StreamExt;
use serde::Serialize;
use std::collections::HashMap;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;
use uuid::Uuid;

const SCAN_FIND_TIMEOUT: Duration = Duration::from_secs(12);
const SCAN_POLL: Duration = Duration::from_millis(400);

#[derive(Default)]
pub struct BleGattState {
    inner: Mutex<Option<BleSession>>,
}

struct BleSession {
    /// 保持 Manager / Adapter 存活，否则 Windows 上连接会掉
    _manager: Manager,
    _adapter: Adapter,
    peripheral: Peripheral,
    address: String,
    name: String,
    notify_task: Option<tokio::task::JoinHandle<()>>,
}

#[derive(Serialize, Clone, Debug)]
pub struct BleCharDto {
    pub uuid: String,
    pub properties: Vec<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct BleServiceDto {
    pub uuid: String,
    pub characteristics: Vec<BleCharDto>,
}

#[derive(Serialize, Clone, Debug)]
pub struct BleConnectResult {
    pub address: String,
    pub name: String,
    pub services: Vec<BleServiceDto>,
}

#[derive(Serialize, Clone, Debug)]
pub struct BleNotifyEvent {
    pub service_uuid: String,
    pub char_uuid: String,
    pub value: Vec<u8>,
}

fn props_to_strings(flags: CharPropFlags) -> Vec<String> {
    let mut out = Vec::new();
    if flags.contains(CharPropFlags::BROADCAST) {
        out.push("broadcast".into());
    }
    if flags.contains(CharPropFlags::READ) {
        out.push("read".into());
    }
    if flags.contains(CharPropFlags::WRITE_WITHOUT_RESPONSE) {
        out.push("write_without_response".into());
    }
    if flags.contains(CharPropFlags::WRITE) {
        out.push("write".into());
    }
    if flags.contains(CharPropFlags::NOTIFY) {
        out.push("notify".into());
    }
    if flags.contains(CharPropFlags::INDICATE) {
        out.push("indicate".into());
    }
    out
}

fn parse_uuid(raw: &str) -> Result<Uuid, String> {
    let s = raw.trim();
    if s.is_empty() {
        return Err("UUID 为空".into());
    }
    if let Ok(u) = Uuid::parse_str(s) {
        return Ok(u);
    }
    let hex = s
        .strip_prefix("0x")
        .or_else(|| s.strip_prefix("0X"))
        .unwrap_or(s)
        .replace('-', "");
    if hex.len() <= 4 {
        let v = u16::from_str_radix(&hex, 16).map_err(|e| format!("无效的 16-bit UUID: {e}"))?;
        return Ok(uuid_from_u16(v));
    }
    if hex.len() <= 8 {
        let v = u32::from_str_radix(&hex, 16).map_err(|e| format!("无效的 32-bit UUID: {e}"))?;
        return Ok(uuid_from_u32(v));
    }
    Err(format!("无法解析 UUID: {raw}"))
}

fn uuid_eq(a: Uuid, b: Uuid) -> bool {
    a == b
}

fn addr_eq(a: &str, b: &str) -> bool {
    let norm = |s: &str| {
        s.chars()
            .filter(|c| c.is_ascii_hexdigit())
            .flat_map(|c| c.to_lowercase())
            .collect::<String>()
    };
    !a.is_empty() && norm(a) == norm(b)
}

async fn get_adapter(manager: &Manager) -> Result<Adapter, String> {
    let adapters = manager
        .adapters()
        .await
        .map_err(|e| format!("获取蓝牙适配器失败: {e}"))?;
    adapters
        .into_iter()
        .next()
        .ok_or_else(|| "未找到蓝牙适配器".to_string())
}

async fn find_peripheral(
    adapter: &Adapter,
    address: &str,
    name_hint: Option<&str>,
) -> Result<Peripheral, String> {
    let _ = adapter.stop_scan().await;
    adapter
        .start_scan(ScanFilter::default())
        .await
        .map_err(|e| format!("扫描失败（用于定位设备）: {e}"))?;

    let deadline = tokio::time::Instant::now() + SCAN_FIND_TIMEOUT;
    let mut found: Option<Peripheral> = None;

    while tokio::time::Instant::now() < deadline {
        let peripherals = adapter
            .peripherals()
            .await
            .map_err(|e| format!("枚举外设失败: {e}"))?;

        for p in peripherals {
            let Ok(Some(props)) = p.properties().await else {
                continue;
            };
            let addr = props.address.to_string();
            let local = props.local_name.clone().unwrap_or_default();
            if addr_eq(&addr, address)
                || name_hint.is_some_and(|n| !n.is_empty() && local.eq_ignore_ascii_case(n))
            {
                found = Some(p);
                break;
            }
        }
        if found.is_some() {
            break;
        }
        tokio::time::sleep(SCAN_POLL).await;
    }

    let _ = adapter.stop_scan().await;
    found.ok_or_else(|| {
        format!(
            "未找到设备 {}{}",
            address,
            name_hint
                .filter(|n| !n.is_empty())
                .map(|n| format!(" / {n}"))
                .unwrap_or_default()
        )
    })
}

fn build_service_tree(chars: &[Characteristic]) -> Vec<BleServiceDto> {
    let mut map: HashMap<String, Vec<BleCharDto>> = HashMap::new();
    for c in chars {
        let svc = c.service_uuid.to_string();
        map.entry(svc).or_default().push(BleCharDto {
            uuid: c.uuid.to_string(),
            properties: props_to_strings(c.properties),
        });
    }
    let mut services: Vec<BleServiceDto> = map
        .into_iter()
        .map(|(uuid, mut characteristics)| {
            characteristics.sort_by(|a, b| a.uuid.cmp(&b.uuid));
            BleServiceDto {
                uuid,
                characteristics,
            }
        })
        .collect();
    services.sort_by(|a, b| a.uuid.cmp(&b.uuid));
    services
}

async fn find_characteristic(
    peripheral: &Peripheral,
    service_uuid: Uuid,
    char_uuid: Uuid,
) -> Result<Characteristic, String> {
    let chars = peripheral.characteristics();
    chars
        .into_iter()
        .find(|c| uuid_eq(c.service_uuid, service_uuid) && uuid_eq(c.uuid, char_uuid))
        .ok_or_else(|| {
            format!(
                "未找到特征 service={} char={}",
                service_uuid, char_uuid
            )
        })
}

async fn abort_session(session: &mut BleSession) {
    if let Some(handle) = session.notify_task.take() {
        handle.abort();
    }
    let _ = session.peripheral.disconnect().await;
}

#[tauri::command]
pub async fn ble_connect(
    app: AppHandle,
    state: State<'_, BleGattState>,
    address: String,
    name: Option<String>,
) -> Result<BleConnectResult, String> {
    let address = address.trim().to_string();
    if address.is_empty() && name.as_deref().unwrap_or("").is_empty() {
        return Err("请提供设备地址或名称".into());
    }

    {
        let mut guard = state.inner.lock().await;
        if let Some(mut old) = guard.take() {
            abort_session(&mut old).await;
        }
    }

    let manager = Manager::new()
        .await
        .map_err(|e| format!("初始化蓝牙失败: {e}"))?;
    let adapter = get_adapter(&manager).await?;
    let peripheral = find_peripheral(
        &adapter,
        &address,
        name.as_deref().filter(|s| !s.is_empty()),
    )
    .await?;

    peripheral
        .connect()
        .await
        .map_err(|e| format!("连接失败: {e}"))?;
    peripheral
        .discover_services()
        .await
        .map_err(|e| format!("发现服务失败: {e}"))?;

    let props = peripheral.properties().await.ok().flatten();
    let resolved_addr = props
        .as_ref()
        .map(|p| p.address.to_string())
        .unwrap_or_else(|| address.clone());
    let resolved_name = props
        .and_then(|p| p.local_name)
        .or(name)
        .unwrap_or_default();

    let services = build_service_tree(
        &peripheral.characteristics().into_iter().collect::<Vec<_>>(),
    );

    let peri_for_notify = peripheral.clone();
    let app_for_notify = app.clone();
    let notify_task = tokio::spawn(async move {
        let Ok(mut stream) = peri_for_notify.notifications().await else {
            return;
        };
        while let Some(n) = stream.next().await {
            let payload = BleNotifyEvent {
                service_uuid: String::new(), // btleplug ValueNotification 无 service
                char_uuid: n.uuid.to_string(),
                value: n.value,
            };
            let _ = app_for_notify.emit("ble_notification", &payload);
        }
        let _ = app_for_notify.emit(
            "ble_disconnected",
            &serde_json::json!({ "reason": "notify_stream_ended" }),
        );
    });

    let session = BleSession {
        _manager: manager,
        _adapter: adapter,
        peripheral,
        address: resolved_addr.clone(),
        name: resolved_name.clone(),
        notify_task: Some(notify_task),
    };

    *state.inner.lock().await = Some(session);

    Ok(BleConnectResult {
        address: resolved_addr,
        name: resolved_name,
        services,
    })
}

#[tauri::command]
pub async fn ble_disconnect(state: State<'_, BleGattState>) -> Result<(), String> {
    let mut guard = state.inner.lock().await;
    if let Some(mut session) = guard.take() {
        abort_session(&mut session).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn ble_is_connected(state: State<'_, BleGattState>) -> Result<Option<BleConnectResult>, String> {
    let guard = state.inner.lock().await;
    let Some(session) = guard.as_ref() else {
        return Ok(None);
    };
    let connected = session
        .peripheral
        .is_connected()
        .await
        .unwrap_or(false);
    if !connected {
        return Ok(None);
    }
    let services = build_service_tree(
        &session
            .peripheral
            .characteristics()
            .into_iter()
            .collect::<Vec<_>>(),
    );
    Ok(Some(BleConnectResult {
        address: session.address.clone(),
        name: session.name.clone(),
        services,
    }))
}

#[tauri::command]
pub async fn ble_read(
    state: State<'_, BleGattState>,
    service_uuid: String,
    char_uuid: String,
) -> Result<Vec<u8>, String> {
    let svc = parse_uuid(&service_uuid)?;
    let ch = parse_uuid(&char_uuid)?;
    let guard = state.inner.lock().await;
    let session = guard.as_ref().ok_or_else(|| "未连接 BLE 设备".to_string())?;
    let characteristic = find_characteristic(&session.peripheral, svc, ch).await?;
    session
        .peripheral
        .read(&characteristic)
        .await
        .map_err(|e| format!("读取失败: {e}"))
}

#[tauri::command]
pub async fn ble_write(
    state: State<'_, BleGattState>,
    service_uuid: String,
    char_uuid: String,
    data: Vec<u8>,
    without_response: Option<bool>,
) -> Result<(), String> {
    let svc = parse_uuid(&service_uuid)?;
    let ch = parse_uuid(&char_uuid)?;
    let guard = state.inner.lock().await;
    let session = guard.as_ref().ok_or_else(|| "未连接 BLE 设备".to_string())?;
    let characteristic = find_characteristic(&session.peripheral, svc, ch).await?;
    let write_type = if without_response.unwrap_or(false) {
        WriteType::WithoutResponse
    } else if characteristic.properties.contains(CharPropFlags::WRITE) {
        WriteType::WithResponse
    } else {
        WriteType::WithoutResponse
    };
    session
        .peripheral
        .write(&characteristic, &data, write_type)
        .await
        .map_err(|e| format!("写入失败: {e}"))
}

#[tauri::command]
pub async fn ble_subscribe(
    state: State<'_, BleGattState>,
    service_uuid: String,
    char_uuid: String,
) -> Result<(), String> {
    let svc = parse_uuid(&service_uuid)?;
    let ch = parse_uuid(&char_uuid)?;
    let guard = state.inner.lock().await;
    let session = guard.as_ref().ok_or_else(|| "未连接 BLE 设备".to_string())?;
    let characteristic = find_characteristic(&session.peripheral, svc, ch).await?;
    if !characteristic.properties.contains(CharPropFlags::NOTIFY)
        && !characteristic.properties.contains(CharPropFlags::INDICATE)
    {
        return Err("该特征不支持 Notify/Indicate".into());
    }
    session
        .peripheral
        .subscribe(&characteristic)
        .await
        .map_err(|e| format!("订阅失败: {e}"))
}

#[tauri::command]
pub async fn ble_unsubscribe(
    state: State<'_, BleGattState>,
    service_uuid: String,
    char_uuid: String,
) -> Result<(), String> {
    let svc = parse_uuid(&service_uuid)?;
    let ch = parse_uuid(&char_uuid)?;
    let guard = state.inner.lock().await;
    let session = guard.as_ref().ok_or_else(|| "未连接 BLE 设备".to_string())?;
    let characteristic = find_characteristic(&session.peripheral, svc, ch).await?;
    session
        .peripheral
        .unsubscribe(&characteristic)
        .await
        .map_err(|e| format!("取消订阅失败: {e}"))
}
