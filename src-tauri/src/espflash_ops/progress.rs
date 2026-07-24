use tauri::{Emitter, WebviewWindow};

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

    pub fn phase_params(
        &self,
        phase: &str,
        percent: f64,
        message_key: &str,
        params: MsgParams,
    ) {
        self.emit(phase, percent, message_key, params, None, None, None, true);
    }
}

/// espflash 的 ProgressCallbacks 按「块」回调；用各段字节权重换算整体进度条。
pub struct WriteProgress<'a> {
    emitter: &'a ProgressEmitter,
    /// 各段原始字节数（与写入顺序一致）
    segment_bytes: Vec<u64>,
    segment_index: usize,
    completed_bytes: u64,
    total_bytes: u64,
    current_addr: u32,
    chunk_total: u64,
    base_percent: f64,
    span_percent: f64,
    last_emitted_percent: f64,
}

impl<'a> WriteProgress<'a> {
    pub fn new(
        emitter: &'a ProgressEmitter,
        segment_bytes: Vec<u64>,
        base_percent: f64,
        span_percent: f64,
    ) -> Self {
        let total_bytes = segment_bytes.iter().sum::<u64>().max(1);
        Self {
            emitter,
            segment_bytes,
            segment_index: 0,
            completed_bytes: 0,
            total_bytes,
            current_addr: 0,
            chunk_total: 0,
            base_percent,
            span_percent,
            last_emitted_percent: -1.0,
        }
    }

    fn current_segment_bytes(&self) -> u64 {
        self.segment_bytes
            .get(self.segment_index)
            .copied()
            .unwrap_or(0)
    }

    /// chunks_done / chunk_total 映射到当前段字节进度，再叠加已完成段。
    fn percent_for(&self, chunks_done: u64) -> f64 {
        let seg = self.current_segment_bytes() as f64;
        let within = if self.chunk_total == 0 {
            1.0
        } else {
            (chunks_done as f64 / self.chunk_total as f64).clamp(0.0, 1.0)
        };
        let bytes_done = self.completed_bytes as f64 + seg * within;
        let ratio = (bytes_done / self.total_bytes as f64).clamp(0.0, 1.0);
        self.base_percent + self.span_percent * ratio
    }

    /// 进度条更新；仅当百分比变化 ≥0.3 或强制时推送，避免刷爆前端。
    fn push_bar(
        &mut self,
        phase: &str,
        chunks_done: u64,
        message_key: &str,
        params: MsgParams,
        force: bool,
    ) {
        let percent = self.percent_for(chunks_done);
        if !force && (percent - self.last_emitted_percent).abs() < 0.3 && percent < 99.5 {
            return;
        }
        self.last_emitted_percent = percent;
        self.emitter.emit(
            phase,
            percent,
            message_key,
            params,
            Some(self.current_addr),
            Some(chunks_done),
            Some(self.chunk_total.max(1)),
            false, // 块进度只走进度条，不刷终端
        );
    }
}

impl espflash::target::ProgressCallbacks for WriteProgress<'_> {
    fn init(&mut self, addr: u32, total: usize) {
        self.current_addr = addr;
        self.chunk_total = total as u64;
        // 终端只打一行概要；细粒度走进度条
        self.emitter.log_key(
            "writeInit",
            p(&[
                ("addr", hex_addr(addr)),
                ("blocks", total.to_string()),
            ]),
        );
        self.push_bar(
            "writing",
            0,
            "writeProgress",
            p(&[
                ("addr", hex_addr(addr)),
                ("current", "0".into()),
                ("total", total.to_string()),
            ]),
            true,
        );
    }

    fn update(&mut self, current: usize) {
        let cur = current as u64;
        let params = p(&[
            ("addr", hex_addr(self.current_addr)),
            ("current", cur.to_string()),
            ("total", self.chunk_total.to_string()),
        ]);
        // 逐块进度同时写终端（带 ANSI 级别配色）
        self.emitter.log_key("writeProgress", params.clone());
        self.push_bar(
            "writing",
            cur,
            "writeProgress",
            params,
            cur >= self.chunk_total,
        );
    }

    fn verifying(&mut self) {
        let params = p(&[("addr", hex_addr(self.current_addr))]);
        self.emitter.log_key("writeVerifying", params.clone());
        self.push_bar(
            "verifying",
            self.chunk_total,
            "writeVerifying",
            params,
            true,
        );
    }

    fn finish(&mut self, skipped: bool) {
        self.completed_bytes = self
            .completed_bytes
            .saturating_add(self.current_segment_bytes());
        self.segment_index = self.segment_index.saturating_add(1);

        let key = if skipped {
            "writeSkipped"
        } else {
            "writeSegmentDone"
        };
        // 段完成：终端一行 + 进度条对齐到已完成字节
        self.emitter.log_key(key, p(&[("addr", hex_addr(self.current_addr))]));
        let percent = self.base_percent
            + self.span_percent
                * (self.completed_bytes as f64 / self.total_bytes as f64).clamp(0.0, 1.0);
        self.last_emitted_percent = percent;
        self.emitter.emit(
            "writing",
            percent,
            key,
            p(&[("addr", hex_addr(self.current_addr))]),
            Some(self.current_addr),
            Some(self.completed_bytes),
            Some(self.total_bytes),
            false,
        );
    }
}
