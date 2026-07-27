//! 芯片复位策略（进入 bootloader / 操作完成后的复位）。
//!
//! 移植自 esptool `reset.py`：
//! <https://github.com/espressif/esptool/blob/master/esptool/reset.py>
//!
//! - `ClassicReset`：经典 DTR/RTS 时序（USB 转串口桥，EN 接 RTS、IO0 接 DTR）
//! - `UnixTightReset`：Unix 下通过 ioctl 同时设置 DTR+RTS 的紧凑时序
//! - `UsbJtagSerialReset`：芯片内置 USB-Serial-JTAG 外设（PID 0x1001）的专用时序

use std::{thread::sleep, time::Duration};

use serialport::SerialPort;

use crate::connection::Port;
use crate::error::Result;

/// 芯片内置 USB-Serial-JTAG 的 USB PID。
pub const USB_SERIAL_JTAG_PID: u16 = 0x1001;

const DEFAULT_RESET_DELAY_MS: u64 = 50;
const EXTRA_RESET_DELAY_MS: u64 = 500;

/// 进入 bootloader 前的复位方式。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ResetBefore {
    /// 用 DTR/RTS 复位进 bootloader（默认）。
    #[default]
    DefaultReset,
    /// 不复位，直接发同步命令。
    NoReset,
    /// 不复位也不同步（透传场景）。
    NoResetNoSync,
    /// 强制使用 USB-Serial-JTAG 复位时序。
    UsbReset,
}

/// 操作完成后的复位方式。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ResetAfter {
    /// 硬复位（RTS 脉冲），运行用户程序（默认）。
    #[default]
    HardReset,
    /// 留在 bootloader（stub 模式下会软复位回 ROM loader）。
    NoReset,
    /// 留在 stub，不做任何复位。
    NoResetNoStub,
}

/// 单个复位策略。
pub trait ResetStrategy {
    fn reset(&self, port: &mut Port) -> Result<()>;
}

fn set_dtr(port: &mut Port, level: bool) -> Result<()> {
    port.write_data_terminal_ready(level)?;
    Ok(())
}

fn set_rts(port: &mut Port, level: bool) -> Result<()> {
    port.write_request_to_send(level)?;
    Ok(())
}

#[cfg(unix)]
fn set_dtr_rts(port: &mut Port, dtr: bool, rts: bool) -> Result<()> {
    use std::os::fd::AsRawFd;
    let fd = port.as_raw_fd();
    let mut status: i32 = 0;
    if unsafe { libc::ioctl(fd, libc::TIOCMGET, &mut status) } != 0 {
        return Err(std::io::Error::last_os_error().into());
    }
    if dtr {
        status |= libc::TIOCM_DTR;
    } else {
        status &= !libc::TIOCM_DTR;
    }
    if rts {
        status |= libc::TIOCM_RTS;
    } else {
        status &= !libc::TIOCM_RTS;
    }
    if unsafe { libc::ioctl(fd, libc::TIOCMSET, &status) } != 0 {
        return Err(std::io::Error::last_os_error().into());
    }
    Ok(())
}

/// 经典 DTR/RTS 复位时序。
pub struct ClassicReset {
    delay_ms: u64,
}

impl ClassicReset {
    pub fn new(extra_delay: bool) -> Self {
        Self {
            delay_ms: if extra_delay {
                EXTRA_RESET_DELAY_MS
            } else {
                DEFAULT_RESET_DELAY_MS
            },
        }
    }
}

impl ResetStrategy for ClassicReset {
    fn reset(&self, port: &mut Port) -> Result<()> {
        set_dtr(port, false)?; // IO0 = HIGH
        set_rts(port, true)?; // EN = LOW，芯片复位
        set_dtr(port, false)?; // Windows 下需要重复设置才能生效

        sleep(Duration::from_millis(100));

        set_dtr(port, true)?; // IO0 = LOW
        set_rts(port, false)?; // EN = HIGH，芯片退出复位
        set_dtr(port, true)?;

        sleep(Duration::from_millis(self.delay_ms));

        set_dtr(port, false)?; // IO0 = HIGH，完成
        Ok(())
    }
}

/// Unix 专用：DTR/RTS 同时切换的紧凑时序（对部分板子更可靠）。
#[cfg(unix)]
pub struct UnixTightReset {
    delay_ms: u64,
}

#[cfg(unix)]
impl UnixTightReset {
    pub fn new(extra_delay: bool) -> Self {
        Self {
            delay_ms: if extra_delay {
                EXTRA_RESET_DELAY_MS
            } else {
                DEFAULT_RESET_DELAY_MS
            },
        }
    }
}

#[cfg(unix)]
impl ResetStrategy for UnixTightReset {
    fn reset(&self, port: &mut Port) -> Result<()> {
        set_dtr_rts(port, false, false)?;
        set_dtr_rts(port, true, true)?;
        set_dtr_rts(port, false, true)?; // IO0 = HIGH, EN = LOW

        sleep(Duration::from_millis(100));

        set_dtr_rts(port, true, false)?; // IO0 = LOW, EN = HIGH

        sleep(Duration::from_millis(self.delay_ms));

        set_dtr_rts(port, false, false)?; // IO0 = HIGH，完成
        set_dtr(port, false)?;
        Ok(())
    }
}

/// USB-Serial-JTAG 外设专用复位时序。
pub struct UsbJtagSerialReset;

impl ResetStrategy for UsbJtagSerialReset {
    fn reset(&self, port: &mut Port) -> Result<()> {
        set_rts(port, false)?;
        set_dtr(port, false)?; // 空闲

        sleep(Duration::from_millis(100));

        set_dtr(port, true)?; // 拉低 IO0
        set_rts(port, false)?;

        sleep(Duration::from_millis(100));

        set_rts(port, true)?; // 复位（经由 (1,1) 状态而不是 (0,0)）
        set_dtr(port, false)?;
        set_rts(port, true)?; // Windows 上 DTR 仅在设置 RTS 时被同步

        sleep(Duration::from_millis(100));

        set_dtr(port, false)?;
        set_rts(port, false)?;
        Ok(())
    }
}

/// 硬复位（操作完成后运行用户程序）。
///
/// USB-Serial-JTAG 需要特别的时序，普通桥只需一个 RTS 脉冲。
pub fn hard_reset(port: &mut Port, usb_pid: u16) -> Result<()> {
    sleep(Duration::from_millis(100));

    if usb_pid == USB_SERIAL_JTAG_PID {
        set_dtr(port, false)?;
        sleep(Duration::from_millis(100));
        set_rts(port, true)?;
        set_dtr(port, false)?;
        set_rts(port, true)?;
        sleep(Duration::from_millis(100));
        set_rts(port, false)?;
    } else {
        set_rts(port, true)?;
        sleep(Duration::from_millis(100));
        set_rts(port, false)?;
    }
    Ok(())
}

/// 按操作系统 / 连接类型构造复位策略序列（依次尝试）。
pub fn reset_strategy_sequence(
    usb_pid: u16,
    mode: ResetBefore,
) -> Vec<Box<dyn ResetStrategy + Send>> {
    if usb_pid == USB_SERIAL_JTAG_PID || mode == ResetBefore::UsbReset {
        return vec![Box::new(UsbJtagSerialReset)];
    }

    #[cfg(unix)]
    {
        vec![
            Box::new(UnixTightReset::new(false)),
            Box::new(UnixTightReset::new(true)),
            Box::new(ClassicReset::new(false)),
            Box::new(ClassicReset::new(true)),
        ]
    }
    #[cfg(not(unix))]
    {
        vec![
            Box::new(ClassicReset::new(false)),
            Box::new(ClassicReset::new(true)),
        ]
    }
}
