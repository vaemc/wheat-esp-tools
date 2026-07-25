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
/// 托盘「显示隐藏的图标」箭头（^）预留宽度，避免盖住
const CHEVRON_RESERVE: i32 = 36;
const EDGE_GAP: i32 = 6;
const COLUMN_GAP: i32 = 12;

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
    // 四舍五入，避免高 DPI 下累计偏小导致发虚
    (px * dpi as i32 + 48) / 96
}

fn get_hwnd_dpi(hwnd: HWND) -> u32 {
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

/// 以任务栏窗口 DPI 为准（覆盖窗创建时可能还在错误监视器上）
fn get_taskbar_dpi(fallback_hwnd: HWND) -> u32 {
    unsafe {
        if let Ok(taskbar) = FindWindowW(w!("Shell_TrayWnd"), PCWSTR::null()) {
            if !taskbar.0.is_null() {
                let dpi = get_hwnd_dpi(taskbar);
                if dpi > 0 {
                    return dpi;
                }
            }
        }
    }
    get_hwnd_dpi(fallback_hwnd)
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

fn make_ui_font(dpi: u32, scale: i32) -> HFONT {
    unsafe {
        let mut lf = LOGFONTW::default();
        // 逻辑 12px * scale（超采样时放大绘制）
        lf.lfHeight = -((12 * dpi as i32 * scale + 48) / 96);
        lf.lfWeight = FW_NORMAL.0 as i32;
        lf.lfCharSet = DEFAULT_CHARSET;
        lf.lfOutPrecision = OUT_TT_PRECIS;
        lf.lfClipPrecision = CLIP_DEFAULT_PRECIS;
        lf.lfPitchAndFamily = DEFAULT_PITCH.0 as u8 | FF_DONTCARE.0 as u8;
        lf.lfQuality = ANTIALIASED_QUALITY;
        let face = to_wide("Segoe UI");
        let n = face.len().min(lf.lfFaceName.len());
        lf.lfFaceName[..n].copy_from_slice(&face[..n]);
        CreateFontIndirectW(&lf)
    }
}

fn create_ui_font(state: &mut AppState) {
    unsafe {
        if !state.font.0.is_null() {
            let _ = DeleteObject(state.font.into());
            state.font = HFONT(std::ptr::null_mut());
        }
        state.font = make_ui_font(state.dpi, 1);
    }
}

fn ensure_dpi_font(state: &mut AppState) {
    let dpi = get_taskbar_dpi(state.hwnd);
    if dpi != state.dpi || state.font.0.is_null() {
        state.dpi = dpi;
        create_ui_font(state);
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

fn compute_overlay_geometry(state: &AppState) -> Option<(i32, i32, i32, i32)> {
    let (rc_taskbar, rc_notify_opt) = query_taskbar_rects()?;
    let text_size = measure_two_row_size(state);
    let mut taskbar_h = rc_taskbar.bottom - rc_taskbar.top;
    if taskbar_h <= 0 {
        taskbar_h = dpi_scale(40, state.dpi);
    }
    let height = if text_size.cy > taskbar_h {
        text_size.cy
    } else {
        taskbar_h
    };

    let notify_left = match rc_notify_opt {
        Some(rc) => rc.left,
        None => rc_taskbar.right - dpi_scale(RIGHT_RESERVE_DEFAULT, state.dpi),
    };
    let right_limit = notify_left - dpi_scale(CHEVRON_RESERVE + EDGE_GAP, state.dpi);
    let min_left = rc_taskbar.left + dpi_scale(80, state.dpi);
    let max_width = (right_limit - min_left).max(dpi_scale(48, state.dpi));
    let width = text_size.cx.min(max_width);
    let mut left = right_limit - width;
    if left < min_left {
        left = min_left;
    }
    let width = width.min((right_limit - left).max(dpi_scale(48, state.dpi)));
    let top = rc_taskbar.top;
    Some((left, top, width, height))
}

fn pixel_coverage(px: u32) -> u32 {
    let b = px & 0xff;
    let g = (px >> 8) & 0xff;
    let r = (px >> 16) & 0xff;
    // Rec.601 亮度，比 max(R,G,B) 边缘更顺
    (r * 30 + g * 59 + b * 11) / 100
}

fn smooth_coverage(a: u32) -> u32 {
    if a == 0 {
        return 0;
    }
    if a >= 255 {
        return 255;
    }
    // 抬高中间覆盖率，暗色任务栏上边缘更柔和
    let f = a as f32 / 255.0;
    let g = f.powf(0.70);
    (g * 255.0 + 0.5) as u32
}

fn pack_premultiplied(a: u32, text_color: COLORREF) -> u32 {
    if a == 0 {
        return 0;
    }
    let tr = (text_color.0 & 0xff) as u32;
    let tg = ((text_color.0 >> 8) & 0xff) as u32;
    let tb = ((text_color.0 >> 16) & 0xff) as u32;
    let pr = (tr * a + 127) / 255;
    let pg = (tg * a + 127) / 255;
    let pb = (tb * a + 127) / 255;
    (a << 24) | (pr << 16) | (pg << 8) | pb
}

/// 超采样图下采样为 1x 预乘 Alpha
fn downsample_to_premultiplied(
    ss: &[u32],
    ss_w: i32,
    scale: i32,
    out: &mut [u32],
    out_w: i32,
    out_h: i32,
    text_color: COLORREF,
) {
    let s = scale as usize;
    let ss_w = ss_w as usize;
    let samples = (s * s) as u32;
    for y in 0..out_h as usize {
        for x in 0..out_w as usize {
            let mut sum = 0u32;
            for dy in 0..s {
                for dx in 0..s {
                    let sx = x * s + dx;
                    let sy = y * s + dy;
                    sum += pixel_coverage(ss[sy * ss_w + sx]);
                }
            }
            let a = smooth_coverage(sum / samples);
            out[y * out_w as usize + x] = pack_premultiplied(a, text_color);
        }
    }
}

fn draw_rows_to_dc(
    hdc: HDC,
    state: &AppState,
    width: i32,
    height: i32,
    font: HFONT,
    scale: i32,
) {
    unsafe {
        let brush = CreateSolidBrush(COLORREF(0));
        let rc = RECT {
            left: 0,
            top: 0,
            right: width,
            bottom: height,
        };
        FillRect(hdc, &rc, brush);
        let _ = DeleteObject(brush.into());

        SetBkMode(hdc, TRANSPARENT);
        SetTextColor(hdc, COLORREF(0x00FF_FFFF));
        let old_font = SelectObject(hdc, font.into());

        let mut tm = TEXTMETRICW::default();
        let _ = GetTextMetricsW(hdc, &mut tm);
        let line_h = tm.tmHeight;
        let row_gap = dpi_scale(2, state.dpi) * scale;
        let total_h = line_h * 2 + row_gap;
        let top_y = (height - total_h) / 2;
        let left_pad = dpi_scale(HORIZONTAL_PADDING / 2, state.dpi) * scale;
        let gap = dpi_scale(COLUMN_GAP, state.dpi) * scale;
        let widths = compute_column_widths(hdc, state);

        let draw_row = |row: &Vec<String>, y: i32| {
            let mut x = left_pad;
            for (i, w) in widths.iter().enumerate() {
                if let Some(text) = row.get(i) {
                    if !text.is_empty() {
                        let wide = to_wide_no_null(text);
                        let _ = TextOutW(hdc, x, y, &wide);
                    }
                }
                x += w + gap;
            }
        };

        draw_row(&state.row1, top_y);
        draw_row(&state.row2, top_y + line_h + row_gap);
        let _ = SelectObject(hdc, old_font);
    }
}

fn create_topdown_dib(
    hdc: HDC,
    width: i32,
    height: i32,
) -> Option<(HBITMAP, *mut u32, usize)> {
    unsafe {
        let bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                biSizeImage: (width * height * 4) as u32,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [RGBQUAD::default()],
        };
        let mut bits: *mut core::ffi::c_void = std::ptr::null_mut();
        let dib = CreateDIBSection(Some(hdc), &bmi, DIB_RGB_COLORS, &mut bits, None, 0).ok()?;
        if bits.is_null() {
            let _ = DeleteObject(dib.into());
            return None;
        }
        let count = (width as usize).saturating_mul(height as usize);
        Some((dib, bits as *mut u32, count))
    }
}

/// 2× 超采样 + 下采样 Alpha，文字边缘明显更平滑
fn present_overlay() {
    const SS: i32 = 2;

    let Some((left, top, width, height, dpi, text_color, hwnd)) = with_state(|state| {
        ensure_dpi_font(state);
        update_theme_colors(state);
        let geo = compute_overlay_geometry(state)?;
        Some((
            geo.0,
            geo.1,
            geo.2,
            geo.3,
            state.dpi,
            state.text_color,
            state.hwnd,
        ))
    }) else {
        return;
    };

    if width <= 0 || height <= 0 {
        return;
    }

    let ss_w = width * SS;
    let ss_h = height * SS;

    unsafe {
        let screen_dc = GetDC(None);
        let mem_dc = CreateCompatibleDC(Some(screen_dc));
        if mem_dc.0.is_null() {
            let _ = ReleaseDC(None, screen_dc);
            return;
        }

        let ss_font = make_ui_font(dpi, SS);
        if ss_font.0.is_null() {
            let _ = DeleteDC(mem_dc);
            let _ = ReleaseDC(None, screen_dc);
            return;
        }

        let Some((ss_dib, ss_bits, ss_count)) = create_topdown_dib(mem_dc, ss_w, ss_h) else {
            let _ = DeleteObject(ss_font.into());
            let _ = DeleteDC(mem_dc);
            let _ = ReleaseDC(None, screen_dc);
            return;
        };
        let ss_pixels = std::slice::from_raw_parts_mut(ss_bits, ss_count);
        ss_pixels.fill(0);

        let old_bmp = SelectObject(mem_dc, ss_dib.into());
        with_state(|state| {
            draw_rows_to_dc(mem_dc, state, ss_w, ss_h, ss_font, SS);
        });

        let Some((out_dib, out_bits, out_count)) = create_topdown_dib(mem_dc, width, height) else {
            let _ = SelectObject(mem_dc, old_bmp);
            let _ = DeleteObject(ss_dib.into());
            let _ = DeleteObject(ss_font.into());
            let _ = DeleteDC(mem_dc);
            let _ = ReleaseDC(None, screen_dc);
            return;
        };
        let out_pixels = std::slice::from_raw_parts_mut(out_bits, out_count);
        downsample_to_premultiplied(ss_pixels, ss_w, SS, out_pixels, width, height, text_color);

        // 把下采样结果选入 DC 提交
        let _ = SelectObject(mem_dc, out_dib.into());

        let blend = BLENDFUNCTION {
            BlendOp: AC_SRC_OVER as u8,
            BlendFlags: 0,
            SourceConstantAlpha: 255,
            AlphaFormat: AC_SRC_ALPHA as u8,
        };
        let pt_dst = POINT { x: left, y: top };
        let size = SIZE {
            cx: width,
            cy: height,
        };
        let pt_src = POINT { x: 0, y: 0 };

        let _ = UpdateLayeredWindow(
            hwnd,
            Some(screen_dc),
            Some(&pt_dst),
            Some(&size),
            Some(mem_dc),
            Some(&pt_src),
            COLORREF(0),
            Some(&blend),
            ULW_ALPHA,
        );

        let _ = SetWindowPos(
            hwnd,
            Some(HWND_TOPMOST),
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
        );

        let _ = SelectObject(mem_dc, old_bmp);
        let _ = DeleteObject(out_dib.into());
        let _ = DeleteObject(ss_dib.into());
        let _ = DeleteObject(ss_font.into());
        let _ = DeleteDC(mem_dc);
        let _ = ReleaseDC(None, screen_dc);
    }
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
                s.dpi = get_taskbar_dpi(hwnd);
                update_theme_colors(&mut s);
                create_ui_font(&mut s);
                build_port_rows(enumerate_com_ports(), &mut s.row1, &mut s.row2);
                s.last_text = rows_snapshot(&s);
                *cell.borrow_mut() = Some(s);
            });
            // 不用 LWA_COLORKEY：色键会吃掉抗锯齿边缘，部分机器表现为明显锯齿
            present_overlay();
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
                let _ = with_state(|state| {
                    update_theme_colors(state);
                    build_port_rows(enumerate_com_ports(), &mut state.row1, &mut state.row2);
                    state.last_text = rows_snapshot(state);
                });
                present_overlay();
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
            // 内容由 UpdateLayeredWindow 提交；这里只清除 paint 标记
            let mut ps = PAINTSTRUCT::default();
            let _ = BeginPaint(hwnd, &mut ps);
            let _ = EndPaint(hwnd, &ps);
            LRESULT(0)
        }
        WM_ERASEBKGND => LRESULT(1),
        WM_SETTINGCHANGE | WM_THEMECHANGED => {
            with_state(|s| update_theme_colors(s));
            present_overlay();
            LRESULT(0)
        }
        WM_DISPLAYCHANGE | WM_DPICHANGED => {
            with_state(|s| {
                s.dpi = 0;
                ensure_dpi_font(s);
            });
            present_overlay();
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
