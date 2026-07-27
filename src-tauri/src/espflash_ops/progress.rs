use tauri::{Emitter, WebviewWindow};
use wheat_esptool::{ProgressEvent, ProgressSink};

use super::types::{hex_addr, p, EspflashLogEvent, EspflashProgressEvent, MsgParams};

pub const PROGRESS_EVENT: &str = "espflash_progress";
pub const LOG_EVENT: &str = "espflash_log";

/// 向 UI 推送进度（messageKey，由前端 i18n）。
pub struct ProgressEmitter {
    window: WebviewWindow,
    job_id: String,
    op: String,
}

impl ProgressEmitter {
    pub fn new(window: WebviewWindow, job_id: impl Into<String>, op: impl Into<String>) -> Self {
        Self {
            window,
            job_id: job_id.into(),
            op: op.into(),
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn emit(
        &self,
        phase: &str,
        percent: f64,
        message_key: &str,
        params: MsgParams,
        addr: Option<u32>,
        current: Option<u64>,
        total: Option<u64>,
        to_terminal: bool,
    ) {
        let percent = percent.clamp(0.0, 100.0);
        let event = EspflashProgressEvent {
            job_id: self.job_id.clone(),
            op: self.op.clone(),
            phase: phase.to_string(),
            percent,
            message_key: message_key.to_string(),
            params: params.clone(),
            addr,
            current,
            total,
        };
        let _ = self.window.emit(PROGRESS_EVENT, &event);
        if to_terminal {
            self.log_key(message_key, params);
        }
    }

    pub fn log_key(&self, message_key: &str, params: MsgParams) {
        let event = EspflashLogEvent {
            job_id: self.job_id.clone(),
            message_key: message_key.to_string(),
            params,
        };
        let _ = self.window.emit(LOG_EVENT, &event);
    }

    pub fn phase(&self, phase: &str, percent: f64, message_key: &str) {
        self.emit(
            phase,
            percent,
            message_key,
            MsgParams::new(),
            None,
            None,
            None,
            true,
        );
    }

    pub fn phase_params(&self, phase: &str, percent: f64, message_key: &str, params: MsgParams) {
        self.emit(phase, percent, message_key, params, None, None, None, true);
    }
}

/// 字节数 → 人类可读（进度条 / 终端展示用）。
pub fn fmt_bytes(bytes: u64) -> String {
    if bytes >= 1024 * 1024 {
        format!("{:.2}MB", bytes as f64 / (1024.0 * 1024.0))
    } else if bytes >= 1024 {
        format!("{:.1}KB", bytes as f64 / 1024.0)
    } else {
        format!("{bytes}B")
    }
}

/// 把 wheat-esptool 的进度事件翻译成本项目的 `espflash_progress` / `espflash_log`。
///
/// 一个 OpsSink 服务一次完整操作（连接 + 烧录/读取/擦除），
/// 内部维护跨段的字节权重换算，保证进度条整体单调。
pub struct OpsSink<'a> {
    emitter: &'a ProgressEmitter,
    // 写入进度换算
    write_base: f64,
    write_span: f64,
    total_write_bytes: u64,
    completed_bytes: u64,
    current_addr: u32,
    current_total: u64,
    last_percent: f64,
    // 写入流程内嵌整片擦除时的进度点
    erase_start_percent: f64,
    erase_done_percent: f64,
    // 写入终端日志节流（约每 5% 一条，避免刷屏）
    write_log_bucket: i32,
    // 读取进度换算
    read_base: f64,
    read_span: f64,
    read_last_bucket: i32,
}

impl<'a> OpsSink<'a> {
    pub fn new(emitter: &'a ProgressEmitter) -> Self {
        Self {
            emitter,
            write_base: 15.0,
            write_span: 80.0,
            total_write_bytes: 1,
            completed_bytes: 0,
            current_addr: 0,
            current_total: 0,
            last_percent: -1.0,
            erase_start_percent: 25.0,
            erase_done_percent: 30.0,
            write_log_bucket: -1,
            read_base: 20.0,
            read_span: 75.0,
            read_last_bucket: -1,
        }
    }

    /// 配置整片擦除事件的进度落点（独立擦除命令用大区间；写入内嵌擦除用小区间）。
    pub fn set_erase_points(&mut self, start: f64, done: f64) {
        self.erase_start_percent = start;
        self.erase_done_percent = done;
    }

    /// 配置写入操作的进度区间与总字节数。
    pub fn set_write_profile(
        &mut self,
        base: f64,
        span: f64,
        total_bytes: u64,
        erase_start: f64,
        erase_done: f64,
    ) {
        self.write_base = base;
        self.write_span = span;
        self.total_write_bytes = total_bytes.max(1);
        self.erase_start_percent = erase_start;
        self.erase_done_percent = erase_done;
    }

    fn write_percent(&self, written_in_segment: u64) -> f64 {
        let done = self.completed_bytes + written_in_segment.min(self.current_total);
        let ratio = (done as f64 / self.total_write_bytes as f64).clamp(0.0, 1.0);
        self.write_base + self.write_span * ratio
    }

    /// 写入进度条推送：百分比变化 ≥0.3 或强制时才推，避免刷爆前端。
    fn push_write_bar(
        &mut self,
        phase: &str,
        written: u64,
        message_key: &str,
        params: MsgParams,
        force: bool,
    ) {
        let percent = self.write_percent(written);
        if !force && (percent - self.last_percent).abs() < 0.3 && percent < 99.5 {
            return;
        }
        self.last_percent = percent;
        self.emitter.emit(
            phase,
            percent,
            message_key,
            params,
            Some(self.current_addr),
            Some(written),
            Some(self.current_total.max(1)),
            false, // 块进度只走进度条，终端由 log_key 单独控制
        );
    }
}

impl ProgressSink for OpsSink<'_> {
    fn event(&mut self, event: ProgressEvent) {
        match event {
            ProgressEvent::OpeningPort { port } => {
                self.emitter
                    .phase_params("connecting", 2.0, "openPort", p(&[("port", port)]));
            }
            ProgressEvent::Connecting { use_stub } => {
                self.emitter.phase(
                    "connecting",
                    8.0,
                    if use_stub {
                        "connectingStub"
                    } else {
                        "connectingRom"
                    },
                );
            }
            // 连接细节不单独占进度点；chipInfo 由命令层在连接完成后统一打一条
            ProgressEvent::ChipDetected { .. }
            | ProgressEvent::StubReady
            | ProgressEvent::BaudChanged { .. }
            | ProgressEvent::FlashDetected { .. } => {}

            ProgressEvent::EraseAllStart => {
                self.emitter
                    .phase("erasing", self.erase_start_percent, "eraseAllRunning");
            }
            ProgressEvent::EraseAllDone => {
                self.emitter
                    .phase("erasing", self.erase_done_percent, "eraseAllDone");
            }

            ProgressEvent::SegmentStart {
                addr,
                total_bytes,
                blocks,
                ..
            } => {
                self.current_addr = addr;
                self.current_total = total_bytes;
                self.write_log_bucket = -1;
                self.emitter.log_key(
                    "writeInit",
                    p(&[("addr", hex_addr(addr)), ("blocks", blocks.to_string())]),
                );
                self.push_write_bar(
                    "writing",
                    0,
                    "writeProgress",
                    p(&[
                        ("addr", hex_addr(addr)),
                        ("current", fmt_bytes(0)),
                        ("total", fmt_bytes(total_bytes)),
                    ]),
                    true,
                );
            }
            ProgressEvent::WriteProgress {
                addr,
                written_bytes,
                total_bytes,
            } => {
                let params = p(&[
                    ("addr", hex_addr(addr)),
                    ("current", fmt_bytes(written_bytes)),
                    ("total", fmt_bytes(total_bytes)),
                ]);
                // 终端约每 5% 打一条（末块必打）；进度条仍逐块刷新
                let seg_ratio = written_bytes as f64 / total_bytes.max(1) as f64;
                let bucket = (seg_ratio * 20.0).floor() as i32;
                if written_bytes >= total_bytes || bucket > self.write_log_bucket {
                    self.write_log_bucket = bucket;
                    self.emitter.log_key("writeProgress", params.clone());
                }
                self.push_write_bar(
                    "writing",
                    written_bytes,
                    "writeProgress",
                    params,
                    written_bytes >= total_bytes,
                );
            }
            ProgressEvent::Verifying { addr } => {
                let params = p(&[("addr", hex_addr(addr))]);
                self.emitter.log_key("writeVerifying", params.clone());
                self.push_write_bar("verifying", self.current_total, "writeVerifying", params, true);
            }
            ProgressEvent::SegmentDone { addr, skipped } => {
                self.completed_bytes = self.completed_bytes.saturating_add(self.current_total);
                let key = if skipped {
                    "writeSkipped"
                } else {
                    "writeSegmentDone"
                };
                self.emitter.log_key(key, p(&[("addr", hex_addr(addr))]));
                let percent = self.write_base
                    + self.write_span
                        * (self.completed_bytes as f64 / self.total_write_bytes as f64)
                            .clamp(0.0, 1.0);
                self.last_percent = percent;
                self.emitter.emit(
                    "writing",
                    percent,
                    key,
                    p(&[("addr", hex_addr(addr))]),
                    Some(addr),
                    Some(self.completed_bytes),
                    Some(self.total_write_bytes),
                    false,
                );
            }

            // readRunning / readDone 由命令层负责（需要 baud / 路径等上下文）
            ProgressEvent::ReadStart { .. } | ProgressEvent::ReadDone { .. } => {}
            ProgressEvent::ReadProgress {
                addr,
                read_bytes,
                total_bytes,
            } => {
                let percent =
                    self.read_base + self.read_span * (read_bytes as f64 / total_bytes.max(1) as f64);
                let bucket = (percent / 5.0).floor() as i32;
                // 进度条每包更新；终端约每 5% 打一条
                let to_terminal = read_bytes >= total_bytes || bucket > self.read_last_bucket;
                if to_terminal {
                    self.read_last_bucket = bucket;
                }
                self.emitter.emit(
                    "reading",
                    percent,
                    "readProgress",
                    p(&[
                        ("addr", hex_addr(addr)),
                        ("current", fmt_bytes(read_bytes)),
                        ("total", fmt_bytes(total_bytes)),
                    ]),
                    Some(addr),
                    Some(read_bytes),
                    Some(total_bytes),
                    to_terminal,
                );
            }
        }
    }
}
