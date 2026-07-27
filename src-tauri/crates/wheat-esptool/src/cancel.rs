//! 协作式取消令牌。
//!
//! 由上层创建并通过 [`crate::Flasher::set_cancel_token`] 注入；
//! 传输循环（写入逐块 / 读取逐包 / 多段之间）在包边界检查该令牌，
//! 命中后以 [`crate::Error::Cancelled`] 中止当前操作。
//!
//! 注意：正在执行中的单条命令（如整片擦除）无法被中断——
//! 芯片一旦开始擦除，断开串口也不会停止；取消只在包边界生效。

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

/// 可跨线程共享的取消令牌（clone 共享同一状态）。
#[derive(Debug, Clone, Default)]
pub struct CancelToken(Arc<AtomicBool>);

impl CancelToken {
    pub fn new() -> Self {
        Self::default()
    }

    /// 请求取消；对应操作会在下一个包边界返回 `Error::Cancelled`。
    pub fn cancel(&self) {
        self.0.store(true, Ordering::Relaxed);
    }

    pub fn is_cancelled(&self) -> bool {
        self.0.load(Ordering::Relaxed)
    }
}
