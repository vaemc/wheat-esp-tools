//! Windows 任务栏 COM 口覆盖显示（来自 wheat-serial-port-show）。
//! 非 Windows 平台提供空实现；由设置开关控制启停。

#[cfg(windows)]
mod win;

#[cfg(windows)]
pub use win::{set_enabled, start, stop};

#[cfg(not(windows))]
pub fn start() {}

#[cfg(not(windows))]
pub fn stop() {}

#[cfg(not(windows))]
pub fn set_enabled(enabled: bool) {
    if enabled {
        start();
    } else {
        stop();
    }
}

#[tauri::command]
pub fn is_windows_platform() -> bool {
    cfg!(windows)
}

#[tauri::command]
pub fn get_taskbar_com_ports_enabled(app: tauri::AppHandle) -> bool {
    crate::window_state::get_show_taskbar_com_ports(&app)
}

#[tauri::command]
pub fn set_taskbar_com_ports_enabled(
    app: tauri::AppHandle,
    enabled: bool,
) -> Result<(), String> {
    if enabled && !cfg!(windows) {
        return Err("任务栏 COM 显示仅支持 Windows".into());
    }
    crate::window_state::set_show_taskbar_com_ports(&app, enabled)?;
    set_enabled(enabled);
    Ok(())
}
