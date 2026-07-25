//! Win11 任务栏 COM 口覆盖显示（覆盖式 topmost）。

#![allow(non_snake_case)]

use std::cell::RefCell;
use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};
use std::thread;
use std::time::Duration;

use windows::core::*;
use windows::Win32::Devices::DeviceAndDriverInstallation::*;
use windows::Win32::Foundation::*;
use windows::Win32::Graphics::Gdi::*;
use windows::Win32::System::LibraryLoader::*;
use windows::Win32::System::Registry::*;
use windows::Win32::UI::HiDpi::*;
use windows::Win32::UI::WindowsAndMessaging::*;

const WINDOW_CLASS_NAME: PCWSTR = w!("WheatEspToolsTaskbarComWnd");
const WINDOW_TITLE: PCWSTR = w!("Wheat ESP Tools · COM");

const REFRESH_TIMER_ID: usize = 1;
const TOPMOST_TIMER_ID: usize = 2;
const REFRESH_INTERVAL_MS: u32 = 1000;
const TOPMOST_INTERVAL_MS: u32 = 100;

const HORIZONTAL_PADDING: i32 = 14;
const RIGHT_RESERVE_DEFAULT: i32 = 200;
const COLUMN_GAP: i32 = 12;
const TRANSPARENT_KEY: COLORREF = COLORREF(0x0001_0101);

static WANT_RUNNING: AtomicBool = AtomicBool::new(false);
static THREAD_ALIVE: AtomicBool = AtomicBool::new(false);
static HWND_RAW: AtomicIsize = AtomicIsize::new(0);

struct AppState {
    hwnd: HWND,
    dpi: u32,
    row1: Vec<String>,
    row2: Vec<String>,
    last_text: String,
    text_color: COLORREF,
    font: HFONT,
}

impl AppState {
    fn new(hwnd: HWND) -> Self {
        Self {
            hwnd,
            dpi: 96,
            row1: Vec::new(),
            row2: Vec::new(),
            last_text: String::new(),
            text_color: COLORREF(0x00FF_FFFF),
            font: HFONT(std::ptr::null_mut()),
        }
    }
}

thread_local! {
    static STATE: RefCell<Option<AppState>> = const { RefCell::new(None) };
}

fn with_state<F, R>(f: F) -> R
where
    F: FnOnce(&mut AppState) -> R,
{
    STATE.with(|cell| {
        let mut borrow = cell.borrow_mut();
        let s = borrow.as_mut().expect("AppState not initialized");
        f(s)
    })
}

fn to_wide(s: &str) -> Vec<u16> {
    OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
}

fn to_wide_no_null(s: &str) -> Vec<u16> {
    OsStr::new(s).encode_wide().collect()
}

fn from_wide(buf: &[u16]) -> String {
    let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    String::from_utf16_lossy(&buf[..end])
}

fn dpi_scale(px: i32, dpi: u32) -> i32 {
    px * dpi as i32 / 96
}

fn get_window_dpi(hwnd: HWND) -> u32 {
    unsafe {
        let dpi = GetDpiForWindow(hwnd);
        if dpi > 0 {
            return dpi;
        }
        let hdc = GetDC(Some(hwnd));
        let v = GetDeviceCaps(Some(hdc), LOGPIXELSX);
        let _ = ReleaseDC(Some(hwnd), hdc);
        if v > 0 {
            v as u32
        } else {
            96
        }
    }
}

fn is_dark_mode_preferred() -> bool {
    unsafe {
        let mut value: u32 = 1;
        let mut size: u32 = std::mem::size_of::<u32>() as u32;
        let key = w!("Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize");
        let name = w!("SystemUsesLightTheme");
        let res = RegGetValueW(
            HKEY_CURRENT_USER,
            key,
            name,
            RRF_RT_REG_DWORD,
            None,
            Some(&mut value as *mut _ as *mut std::ffi::c_void),
            Some(&mut size),
        );
        if res == ERROR_SUCCESS {
            return value == 0;
        }
        true
    }
}

fn update_theme_colors(state: &mut AppState) {
    state.text_color = if is_dark_mode_preferred() {
        COLORREF(0x00FF_FFFF)
    } else {
        COLORREF(0x0000_0000)
    };
}

fn enumerate_com_ports() -> Vec<String> {
    let mut ports: Vec<String> = Vec::new();
    unsafe {
        let Ok(dev_info) =
            SetupDiGetClassDevsW(Some(&GUID_DEVCLASS_PORTS), None, None, DIGCF_PRESENT)
        else {
            return ports;
        };

        let mut dev_info_data = SP_DEVINFO_DATA {
            cbSize: std::mem::size_of::<SP_DEVINFO_DATA>() as u32,
            ..Default::default()
        };

        let mut index = 0u32;
        while SetupDiEnumDeviceInfo(dev_info, index, &mut dev_info_data).is_ok() {
            index += 1;
            let Ok(hkey) = SetupDiOpenDevRegKey(
                dev_info,
                &dev_info_data,
                1,
                0,
                DIREG_DEV,
                KEY_READ.0 as u32,
            ) else {
                continue;
            };

            let mut port_name = [0u16; 32];
            let mut size = (port_name.len() * std::mem::size_of::<u16>()) as u32;
            let mut value_type = REG_VALUE_TYPE(0);
            let ok = RegQueryValueExW(
                hkey,
                w!("PortName"),
                None,
                Some(&mut value_type),
                Some(port_name.as_mut_ptr() as *mut u8),
                Some(&mut size),
            ) == ERROR_SUCCESS
                && value_type == REG_SZ;
            let _ = RegCloseKey(hkey);
            if !ok {
                continue;
            }

            let name = from_wide(&port_name);
            if name.starts_with("COM") {
                ports.push(name);
            }
        }

        let _ = SetupDiDestroyDeviceInfoList(dev_info);
    }

    ports.sort_by(|a, b| {
        let port_num = |s: &str| -> i32 {
            if s.len() <= 3 {
                0
            } else {
                s[3..].trim_end_matches(char::from(0)).parse().unwrap_or(0)
            }
        };
        if a.starts_with("COM") && b.starts_with("COM") {
            port_num(a).cmp(&port_num(b))
        } else {
            a.cmp(b)
        }
    });
    ports
}

fn build_port_rows(ports: Vec<String>, row1: &mut Vec<String>, row2: &mut Vec<String>) {
    row1.clear();
    row2.clear();
    if ports.is_empty() {
        row1.push("无 COM 端口".to_string());
        return;
    }
    if ports.len() == 1 {
        row1.push(ports.into_iter().next().unwrap());
        return;
    }
    let split = (ports.len() + 1) / 2;
    for (i, p) in ports.into_iter().enumerate() {
        if i < split {
            row1.push(p);
        } else {
            row2.push(p);
        }
    }
}

fn rows_snapshot(state: &AppState) -> String {
    let mut s = String::new();
    for p in &state.row1 {
        s.push_str(p);
        s.push('|');
    }
    s.push('#');
    for p in &state.row2 {
        s.push_str(p);
        s.push('|');
    }
    s
}

fn measure_text(hdc: HDC, text: &str) -> i32 {
    if text.is_empty() {
        return 0;
    }
    let wide = to_wide_no_null(text);
    let mut size = SIZE::default();
    unsafe {
        let _ = GetTextExtentPoint32W(hdc, &wide, &mut size);
    }
    size.cx
}

fn compute_column_widths(hdc: HDC, state: &AppState) -> Vec<i32> {
    let cols = state.row1.len().max(state.row2.len());
    let mut widths = vec![0i32; cols];
    for i in 0..cols {
        let w1 = state.row1.get(i).map(|s| measure_text(hdc, s)).unwrap_or(0);
        let w2 = state.row2.get(i).map(|s| measure_text(hdc, s)).unwrap_or(0);
        widths[i] = w1.max(w2);
    }
    widths
}

fn create_ui_font(state: &mut AppState) {
    unsafe {
        if !state.font.0.is_null() {
            let _ = DeleteObject(state.font.into());
            state.font = HFONT(std::ptr::null_mut());
        }
        let mut lf = LOGFONTW::default();
        lf.lfHeight = -((12 * state.dpi as i32) / 96);
        lf.lfWeight = FW_NORMAL.0 as i32;
        lf.lfCharSet = DEFAULT_CHARSET;
        lf.lfQuality = CLEARTYPE_QUALITY;
        let face = to_wide("Segoe UI");
        let n = face.len().min(lf.lfFaceName.len());
        lf.lfFaceName[..n].copy_from_slice(&face[..n]);
        state.font = CreateFontIndirectW(&lf);
    }
}

fn measure_two_row_size(state: &AppState) -> SIZE {
    unsafe {
        let hdc = GetDC(Some(state.hwnd));
        let old_font = SelectObject(hdc, state.font.into());

        let widths = compute_column_widths(hdc, state);
        let mut total: i32 = widths.iter().sum();
        if widths.len() > 1 {
            total += dpi_scale(COLUMN_GAP, state.dpi) * (widths.len() as i32 - 1);
        }

        let mut tm = TEXTMETRICW::default();
        let _ = GetTextMetricsW(hdc, &mut tm);
        let _ = SelectObject(hdc, old_font);
        let _ = ReleaseDC(Some(state.hwnd), hdc);

        SIZE {
            cx: total + dpi_scale(HORIZONTAL_PADDING, state.dpi),
            cy: tm.tmHeight * 2 + dpi_scale(2, state.dpi),
        }
    }
}

fn query_taskbar_rects() -> Option<(RECT, Option<RECT>)> {
    unsafe {
        let taskbar = FindWindowW(w!("Shell_TrayWnd"), PCWSTR::null()).ok()?;
        if taskbar.0.is_null() {
            return None;
        }
        let mut rc_taskbar = RECT::default();
        if GetWindowRect(taskbar, &mut rc_taskbar).is_err() {
            return None;
        }
        let notify = FindWindowExW(Some(taskbar), None, w!("TrayNotifyWnd"), PCWSTR::null())
            .unwrap_or_default();
        let mut rc_notify_opt = None;
        if !notify.0.is_null() {
            let mut rc_notify = RECT::default();
            if GetWindowRect(notify, &mut rc_notify).is_ok()
                && rc_notify.right > rc_notify.left
                && rc_notify.bottom > rc_notify.top
            {
                rc_notify_opt = Some(rc_notify);
            }
        }
        Some((rc_taskbar, rc_notify_opt))
    }
}

fn adjust_window_position(force: bool) {
    let Some((rc_taskbar, rc_notify_opt)) = query_taskbar_rects() else {
        return;
    };

    with_state(|state| {
        state.dpi = get_window_dpi(state.hwnd);
        let text_size = measure_two_row_size(state);
        let width = text_size.cx;
        let mut taskbar_h = rc_taskbar.bottom - rc_taskbar.top;
        if taskbar_h <= 0 {
            taskbar_h = dpi_scale(40, state.dpi);
        }
        let height = if text_size.cy > taskbar_h {
            text_size.cy
        } else {
            taskbar_h
        };

        let right_edge = match rc_notify_opt {
            Some(rc) => rc.left,
            None => rc_taskbar.right - dpi_scale(RIGHT_RESERVE_DEFAULT, state.dpi),
        };
        let mut left = right_edge - width - dpi_scale(4, state.dpi);
        let top = rc_taskbar.top;
        let min_left = rc_taskbar.left + dpi_scale(80, state.dpi);
        if left < min_left {
            left = min_left;
        }

        unsafe {
            let flags = if force {
                SWP_NOACTIVATE | SWP_SHOWWINDOW
            } else {
                SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_NOSIZE | SWP_NOMOVE
            };
            let _ = SetWindowPos(
                state.hwnd,
                Some(HWND_TOPMOST),
                left,
                top,
                width,
                height,
                flags,
            );
            if !force {
                let _ = SetWindowPos(
                    state.hwnd,
                    Some(HWND_TOPMOST),
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
                );
            }
        }
    });
}

fn force_topmost(hwnd: HWND) {
    unsafe {
        let _ = SetWindowPos(
            hwnd,
            Some(HWND_TOPMOST),
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOSENDCHANGING,
        );
    }
}

fn paint_window(hwnd: HWND) {
    unsafe {
        let mut ps = PAINTSTRUCT::default();
        let hdc = BeginPaint(hwnd, &mut ps);
        if hdc.0.is_null() {
            return;
        }

        let mut client = RECT::default();
        let _ = GetClientRect(hwnd, &mut client);

        let brush = CreateSolidBrush(TRANSPARENT_KEY);
        FillRect(hdc, &client, brush);
        let _ = DeleteObject(brush.into());

        SetBkMode(hdc, TRANSPARENT);
        with_state(|state| {
            SetTextColor(hdc, state.text_color);
            let old_font = SelectObject(hdc, state.font.into());

            let mut tm = TEXTMETRICW::default();
            let _ = GetTextMetricsW(hdc, &mut tm);
            let line_h = tm.tmHeight;
            let total_h = line_h * 2 + dpi_scale(2, state.dpi);
            let client_h = client.bottom - client.top;
            let top_y = (client_h - total_h) / 2;
            let left_pad = dpi_scale(HORIZONTAL_PADDING / 2, state.dpi);
            let gap = dpi_scale(COLUMN_GAP, state.dpi);

            let widths = compute_column_widths(hdc, state);

            let draw_row = |row: &Vec<String>, y: i32| {
                let mut x = left_pad;
                for (i, w) in widths.iter().enumerate() {
                    if let Some(text) = row.get(i) {
                        if !text.is_empty() {
                            let mut wide = to_wide_no_null(text);
                            let mut r = RECT {
                                left: x,
                                top: y,
                                right: x + *w,
                                bottom: y + line_h,
                            };
                            DrawTextW(
                                hdc,
                                &mut wide,
                                &mut r,
                                DT_LEFT | DT_TOP | DT_SINGLELINE | DT_NOPREFIX | DT_NOCLIP,
                            );
                        }
                    }
                    x += w + gap;
                }
            };

            draw_row(&state.row1, top_y);
            draw_row(&state.row2, top_y + line_h + dpi_scale(2, state.dpi));

            let _ = SelectObject(hdc, old_font);
        });

        let _ = EndPaint(hwnd, &ps);
    }
}

unsafe extern "system" fn wnd_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    match msg {
        WM_CREATE => {
            STATE.with(|cell| {
                let mut s = AppState::new(hwnd);
                s.dpi = get_window_dpi(hwnd);
                update_theme_colors(&mut s);
                create_ui_font(&mut s);
                build_port_rows(enumerate_com_ports(), &mut s.row1, &mut s.row2);
                s.last_text = rows_snapshot(&s);
                *cell.borrow_mut() = Some(s);
            });
            let _ = SetLayeredWindowAttributes(hwnd, TRANSPARENT_KEY, 0, LWA_COLORKEY);
            adjust_window_position(true);
            let _ = SetTimer(Some(hwnd), REFRESH_TIMER_ID, REFRESH_INTERVAL_MS, None);
            let _ = SetTimer(Some(hwnd), TOPMOST_TIMER_ID, TOPMOST_INTERVAL_MS, None);
            LRESULT(0)
        }
        WM_TIMER => {
            if wparam.0 == REFRESH_TIMER_ID {
                if !WANT_RUNNING.load(Ordering::SeqCst) {
                    let _ = DestroyWindow(hwnd);
                    return LRESULT(0);
                }
                let text_changed = with_state(|state| {
                    update_theme_colors(state);
                    build_port_rows(enumerate_com_ports(), &mut state.row1, &mut state.row2);
                    let snap = rows_snapshot(state);
                    let changed = snap != state.last_text;
                    state.last_text = snap;
                    changed
                });
                adjust_window_position(text_changed);
                let _ = InvalidateRect(Some(hwnd), None, false);
            } else if wparam.0 == TOPMOST_TIMER_ID {
                force_topmost(hwnd);
            }
            LRESULT(0)
        }
        WM_WINDOWPOSCHANGING => {
            let wp = lparam.0 as *mut WINDOWPOS;
            if !wp.is_null() {
                let f = (*wp).flags;
                if !f.contains(SWP_NOZORDER) {
                    (*wp).hwndInsertAfter = HWND_TOPMOST;
                }
            }
            DefWindowProcW(hwnd, msg, wparam, lparam)
        }
        WM_ACTIVATEAPP | WM_ACTIVATE => {
            force_topmost(hwnd);
            DefWindowProcW(hwnd, msg, wparam, lparam)
        }
        WM_PAINT => {
            paint_window(hwnd);
            LRESULT(0)
        }
        WM_SETTINGCHANGE | WM_THEMECHANGED => {
            with_state(|s| update_theme_colors(s));
            let _ = InvalidateRect(Some(hwnd), None, true);
            LRESULT(0)
        }
        WM_DISPLAYCHANGE | WM_DPICHANGED => {
            with_state(|s| {
                s.dpi = get_window_dpi(hwnd);
                create_ui_font(s);
            });
            adjust_window_position(true);
            let _ = InvalidateRect(Some(hwnd), None, true);
            LRESULT(0)
        }
        WM_CLOSE => {
            let _ = DestroyWindow(hwnd);
            LRESULT(0)
        }
        WM_DESTROY => {
            let _ = KillTimer(Some(hwnd), REFRESH_TIMER_ID);
            let _ = KillTimer(Some(hwnd), TOPMOST_TIMER_ID);
            HWND_RAW.store(0, Ordering::SeqCst);
            STATE.with(|cell| {
                if let Some(s) = cell.borrow_mut().as_mut() {
                    if !s.font.0.is_null() {
                        let _ = DeleteObject(s.font.into());
                        s.font = HFONT(std::ptr::null_mut());
                    }
                }
                *cell.borrow_mut() = None;
            });
            PostQuitMessage(0);
            LRESULT(0)
        }
        _ => DefWindowProcW(hwnd, msg, wparam, lparam),
    }
}

fn run_message_loop() {
    unsafe {
        let _ = SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);

        let Ok(module) = GetModuleHandleW(PCWSTR::null()) else {
            return;
        };
        let hinstance: HINSTANCE = module.into();

        let wc = WNDCLASSEXW {
            cbSize: std::mem::size_of::<WNDCLASSEXW>() as u32,
            style: WNDCLASS_STYLES(0),
            lpfnWndProc: Some(wnd_proc),
            cbClsExtra: 0,
            cbWndExtra: 0,
            hInstance: hinstance,
            hIcon: HICON::default(),
            hCursor: LoadCursorW(None, IDC_ARROW).unwrap_or_default(),
            hbrBackground: HBRUSH::default(),
            lpszMenuName: PCWSTR::null(),
            lpszClassName: WINDOW_CLASS_NAME,
            hIconSm: HICON::default(),
        };
        // 可重复注册；已存在则忽略
        let _ = RegisterClassExW(&wc);

        let ex_style = WS_EX_TOOLWINDOW
            | WS_EX_TOPMOST
            | WS_EX_NOACTIVATE
            | WS_EX_LAYERED
            | WS_EX_TRANSPARENT;

        let Ok(hwnd) = CreateWindowExW(
            ex_style,
            WINDOW_CLASS_NAME,
            WINDOW_TITLE,
            WS_POPUP,
            0,
            0,
            300,
            40,
            None,
            None,
            Some(hinstance),
            None,
        ) else {
            return;
        };

        if hwnd.0.is_null() {
            return;
        }

        HWND_RAW.store(hwnd.0 as isize, Ordering::SeqCst);
        let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
        let _ = UpdateWindow(hwnd);

        let mut msg = MSG::default();
        loop {
            let r = GetMessageW(&mut msg, None, 0, 0);
            if r.0 <= 0 {
                break;
            }
            let _ = TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    }
}

pub fn start() {
    WANT_RUNNING.store(true, Ordering::SeqCst);
    if THREAD_ALIVE
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return;
    }

    thread::spawn(|| {
        run_message_loop();
        THREAD_ALIVE.store(false, Ordering::SeqCst);
        HWND_RAW.store(0, Ordering::SeqCst);

        // 若停止期间又被重新开启，再起一轮
        if WANT_RUNNING.load(Ordering::SeqCst) {
            start();
        }
    });
}

pub fn stop() {
    WANT_RUNNING.store(false, Ordering::SeqCst);
    let raw = HWND_RAW.load(Ordering::SeqCst);
    if raw != 0 {
        unsafe {
            let hwnd = HWND(raw as *mut _);
            let _ = PostMessageW(Some(hwnd), WM_CLOSE, WPARAM(0), LPARAM(0));
        }
    }

    // 等待线程收尾，避免重复起窗
    for _ in 0..50 {
        if !THREAD_ALIVE.load(Ordering::SeqCst) {
            break;
        }
        thread::sleep(Duration::from_millis(20));
    }
}

pub fn set_enabled(enabled: bool) {
    if enabled {
        start();
    } else {
        stop();
    }
}
