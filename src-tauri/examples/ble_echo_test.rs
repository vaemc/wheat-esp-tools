//! 实机测试：连接 ESP32-S3-BLE，订阅 Msg Notify，写入并等待 ECHO。
//!
//! ```
//! cd src-tauri && cargo run --example ble_echo_test
//! ```

use btleplug::api::{
    bleuuid::uuid_from_u16, Central, Manager as _, Peripheral as _, ScanFilter, WriteType,
};
use btleplug::platform::Manager;
use futures::stream::StreamExt;
use std::time::Duration;

const DEVICE_NAME: &str = "ESP32-S3-BLE";
const SVC: u16 = 0x00FF;
const CHAR_MSG: u16 = 0xFF01;
const CHAR_COUNTER: u16 = 0xFF02;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("初始化蓝牙…");
    let manager = Manager::new().await?;
    let adapter = manager
        .adapters()
        .await?
        .into_iter()
        .next()
        .ok_or("未找到蓝牙适配器")?;

    println!("扫描 {DEVICE_NAME}…");
    let _ = adapter.stop_scan().await;
    adapter.start_scan(ScanFilter::default()).await?;

    let deadline = tokio::time::Instant::now() + Duration::from_secs(15);
    let mut peripheral = None;
    while tokio::time::Instant::now() < deadline {
        for p in adapter.peripherals().await? {
            if let Ok(Some(props)) = p.properties().await {
                if props
                    .local_name
                    .as_deref()
                    .is_some_and(|n| n.eq_ignore_ascii_case(DEVICE_NAME))
                {
                    println!(
                        "找到: {}  RSSI={:?}",
                        props.address,
                        props.rssi
                    );
                    peripheral = Some(p);
                    break;
                }
            }
        }
        if peripheral.is_some() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(400)).await;
    }
    let _ = adapter.stop_scan().await;
    let peripheral = peripheral.ok_or_else(|| format!("未找到设备 {DEVICE_NAME}"))?;

    println!("连接…");
    peripheral.connect().await?;
    peripheral.discover_services().await?;

    let svc = uuid_from_u16(SVC);
    let msg_uuid = uuid_from_u16(CHAR_MSG);
    let counter_uuid = uuid_from_u16(CHAR_COUNTER);

    let msg_char = peripheral
        .characteristics()
        .into_iter()
        .find(|c| c.service_uuid == svc && c.uuid == msg_uuid)
        .ok_or("缺少 Msg 特征 0xFF01")?;
    let counter_char = peripheral
        .characteristics()
        .into_iter()
        .find(|c| c.service_uuid == svc && c.uuid == counter_uuid)
        .ok_or("缺少 Counter 特征 0xFF02")?;

    let mut notifications = peripheral.notifications().await?;
    peripheral.subscribe(&msg_char).await?;
    peripheral.subscribe(&counter_char).await?;
    println!("已订阅 Msg + Counter Notify");

    let payload = b"wheat-esp-tools";
    println!("写入 Msg: {}", String::from_utf8_lossy(payload));
    peripheral
        .write(&msg_char, payload, WriteType::WithResponse)
        .await?;

    let mut got_echo = false;
    let mut counter_hits = 0u32;
    let wait_until = tokio::time::Instant::now() + Duration::from_secs(6);
    while tokio::time::Instant::now() < wait_until {
        tokio::select! {
            n = notifications.next() => {
                let Some(n) = n else { break; };
                if n.uuid == msg_uuid {
                    let text = String::from_utf8_lossy(&n.value);
                    println!("Msg Notify: {text}");
                    if text.starts_with("ECHO:") {
                        got_echo = true;
                    }
                } else if n.uuid == counter_uuid && n.value.len() >= 4 {
                    let v = u32::from_le_bytes([n.value[0], n.value[1], n.value[2], n.value[3]]);
                    println!("Counter Notify: {v}");
                    counter_hits += 1;
                }
            }
            _ = tokio::time::sleep(Duration::from_millis(50)) => {}
        }
        if got_echo && counter_hits >= 2 {
            break;
        }
    }

    let _ = peripheral.unsubscribe(&msg_char).await;
    let _ = peripheral.unsubscribe(&counter_char).await;
    let _ = peripheral.disconnect().await;

    if !got_echo {
        return Err("未收到 ECHO 回包".into());
    }
    println!("测试通过: ECHO ok, counter notifies={counter_hits}");
    Ok(())
}
