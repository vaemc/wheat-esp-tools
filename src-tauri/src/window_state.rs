
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    AppHandle, Manager, PhysicalPosition, PhysicalSize, RunEvent, WebviewWindow, WindowEvent,
};

const PREFS_FILE: &str = "ui-prefs.json";
const GEOMETRY_FILE: &str = "window-geometry.json";

static REMEMBER: AtomicBool = AtomicBool::new(true);

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UiPrefs {
    #[serde(default = "default_remember")]
    remember_window_state: bool,
}

fn default_remember() -> bool {
    true
}

impl Default for UiPrefs {
    fn default() -> Self {
        Self {
            remember_window_state: default_remember(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WindowGeometry {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    #[serde(default)]
    maximized: bool,
}

fn config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map_err(|e| format!("获取配置目录失败: {e}"))
}

fn prefs_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(config_dir(app)?.join(PREFS_FILE))
}

fn geometry_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(config_dir(app)?.join(GEOMETRY_FILE))
}

fn load_prefs(app: &AppHandle) -> UiPrefs {
    let Ok(path) = prefs_path(app) else {
        return UiPrefs::default();
    };
    let Ok(bytes) = fs::read(&path) else {
        return UiPrefs::default();
    };
    serde_json::from_slice(&bytes).unwrap_or_default()
}

fn save_prefs(app: &AppHandle, prefs: &UiPrefs) -> Result<(), String> {
    let dir = config_dir(app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("创建配置目录失败: {e}"))?;
    let path = dir.join(PREFS_FILE);
    let bytes = serde_json::to_vec_pretty(prefs).map_err(|e| e.to_string())?;
    fs::write(&path, bytes).map_err(|e| format!("写入窗口偏好失败: {e}"))
}

fn clear_geometry(app: &AppHandle) {
    if let Ok(path) = geometry_path(app) {
        let _ = fs::remove_file(path);
    }
}

fn load_geometry(app: &AppHandle) -> Option<WindowGeometry> {
    let path = geometry_path(app).ok()?;
    let bytes = fs::read(path).ok()?;
    serde_json::from_slice(&bytes).ok()
}

fn save_geometry(window: &WebviewWindow) -> Result<(), String> {
    let app = window.app_handle();
    let dir = config_dir(app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("创建配置目录失败: {e}"))?;

    let maximized = window.is_maximized().unwrap_or(false);
    let minimized = window.is_minimized().unwrap_or(false);

    if minimized {
        return Ok(());
    }

    let position = window
        .outer_position()
        .map_err(|e| format!("读取窗口位置失败: {e}"))?;
    let size = window
        .inner_size()
        .map_err(|e| format!("读取窗口大小失败: {e}"))?;

    if size.width == 0 || size.height == 0 {
        return Ok(());
    }

    let geometry = WindowGeometry {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        maximized,
    };

    let path = dir.join(GEOMETRY_FILE);
    let bytes = serde_json::to_vec_pretty(&geometry).map_err(|e| e.to_string())?;
    fs::write(&path, bytes).map_err(|e| format!("写入窗口几何失败: {e}"))
}

fn position_visible_on_any_monitor(window: &WebviewWindow, geometry: &WindowGeometry) -> bool {
    let position = PhysicalPosition::new(geometry.x, geometry.y);
    let size = PhysicalSize::new(geometry.width, geometry.height);
    let Ok(monitors) = window.available_monitors() else {
        return true;
    };
    if monitors.is_empty() {
        return true;
    }
    monitors.iter().any(|m| {
        let mp = *m.position();
        let ms = *m.size();
        let left = mp.x;
        let top = mp.y;
        let right = mp.x + ms.width as i32;
        let bottom = mp.y + ms.height as i32;
        [
            (position.x, position.y),
            (position.x + size.width as i32, position.y),
            (position.x, position.y + size.height as i32),
            (
                position.x + size.width as i32,
                position.y + size.height as i32,
            ),
        ]
        .into_iter()
        .any(|(x, y)| x >= left && x < right && y >= top && y < bottom)
    })
}

fn restore_geometry(window: &WebviewWindow, geometry: &WindowGeometry) {
    if geometry.width > 0 && geometry.height > 0 {
        let _ = window.set_size(PhysicalSize {
            width: geometry.width,
            height: geometry.height,
        });
    }

    if position_visible_on_any_monitor(window, geometry) {
        let _ = window.set_position(PhysicalPosition {
            x: geometry.x,
            y: geometry.y,
        });
    }

    if geometry.maximized {
        let _ = window.maximize();
    }
}

pub fn attach(app: &AppHandle) {
    let prefs = load_prefs(app);
    REMEMBER.store(prefs.remember_window_state, Ordering::SeqCst);

    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    if prefs.remember_window_state {
        if let Some(geometry) = load_geometry(app) {
            restore_geometry(&window, &geometry);
        }
    }

    let _ = window.show();
    let _ = window.set_focus();

    let window_for_event = window.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { .. } = event {
            if REMEMBER.load(Ordering::SeqCst) {
                let _ = save_geometry(&window_for_event);
            }
        }
    });
}

/// 退出时再保存一次（部分平台可能不经过 CloseRequested）。
pub fn on_run_event(app: &AppHandle, event: &RunEvent) {
    if matches!(
        event,
        RunEvent::Exit | RunEvent::ExitRequested { .. }
    ) {
        for label in ["pet", "pet-bubble"] {
            if let Some(win) = app.get_webview_window(label) {
                let _ = win.destroy();
            }
        }
    }

    if !matches!(event, RunEvent::Exit) {
        return;
    }
    if !REMEMBER.load(Ordering::SeqCst) {
        return;
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = save_geometry(&window);
    }
}

#[tauri::command]
pub fn get_remember_window_state(app: AppHandle) -> bool {
    let prefs = load_prefs(&app);
    REMEMBER.store(prefs.remember_window_state, Ordering::SeqCst);
    prefs.remember_window_state
}

#[tauri::command]
pub fn set_remember_window_state(app: AppHandle, enabled: bool) -> Result<(), String> {
    REMEMBER.store(enabled, Ordering::SeqCst);
    save_prefs(
        &app,
        &UiPrefs {
            remember_window_state: enabled,
        },
    )?;
    if !enabled {
        clear_geometry(&app);
    } else if let Some(window) = app.get_webview_window("main") {
        let _ = save_geometry(&window);
    }
    Ok(())
}
