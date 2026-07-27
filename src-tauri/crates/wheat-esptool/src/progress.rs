//! 进度回调接口。
//!
//! 库内所有耗时操作都通过 [`ProgressSink`] 推送结构化事件，
//! 由调用方（Tauri 命令层）翻译成 UI 进度条 / 终端日志。
//! 事件全部携带字节级数据，方便上层计算百分比、速度与 ETA。

/// 烧录 / 读取 / 擦除过程中的进度事件。
#[derive(Debug, Clone)]
pub enum ProgressEvent {
    /// 正在打开串口。
    OpeningPort { port: String },
    /// 正在复位并同步（use_stub 表示随后会加载 stub）。
    Connecting { use_stub: bool },
    /// 芯片识别完成。
    ChipDetected {
        chip: &'static str,
        revision: Option<(u32, u32)>,
    },
    /// stub 加载完成。
    StubReady,
    /// 波特率已切换。
    BaudChanged { baud: u32 },
    /// Flash 容量探测完成。
    FlashDetected { size_bytes: u32 },

    /// 整片擦除开始 / 结束。
    EraseAllStart,
    EraseAllDone,

    /// 开始写一个段。`total_bytes` 为原始（未压缩）大小。
    SegmentStart {
        index: usize,
        count: usize,
        addr: u32,
        total_bytes: u64,
        /// 实际传输的压缩后大小（stub 模式），ROM 模式等于原始大小。
        transfer_bytes: u64,
        /// 传输块数。
        blocks: usize,
    },
    /// 写入进度（`written_bytes` 是未压缩口径的已写字节，单调递增）。
    WriteProgress {
        addr: u32,
        written_bytes: u64,
        total_bytes: u64,
    },
    /// 正在做 MD5 校验。
    Verifying { addr: u32 },
    /// 段完成。`skipped` 表示内容一致跳过了写入。
    SegmentDone { addr: u32, skipped: bool },

    /// 读取开始。
    ReadStart { addr: u32, total_bytes: u64 },
    /// 读取进度。
    ReadProgress {
        addr: u32,
        read_bytes: u64,
        total_bytes: u64,
    },
    /// 读取完成（已通过 MD5 校验）。
    ReadDone { total_bytes: u64 },
}

/// 进度事件接收器。
pub trait ProgressSink {
    fn event(&mut self, event: ProgressEvent);
}

/// 忽略所有事件的空实现。
pub struct NoProgress;

impl ProgressSink for NoProgress {
    fn event(&mut self, _event: ProgressEvent) {}
}
