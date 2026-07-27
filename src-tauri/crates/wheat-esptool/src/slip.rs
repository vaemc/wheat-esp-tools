//! SLIP 帧编解码（esptool 串口协议的底层封包格式）。
//!
//! 参考: <https://docs.espressif.com/projects/esptool/en/latest/esp32/advanced-topics/serial-protocol.html#low-level-protocol>
//!
//! - 帧以 `0xC0` 开始 / 结束
//! - 数据中的 `0xC0` 转义为 `0xDB 0xDC`
//! - 数据中的 `0xDB` 转义为 `0xDB 0xDD`

use std::io::Read;

use crate::error::{Error, Result};

const END: u8 = 0xC0;
const ESC: u8 = 0xDB;
const ESC_END: u8 = 0xDC;
const ESC_ESC: u8 = 0xDD;

/// 将 payload 编码为一个完整 SLIP 帧。
pub fn encode_frame(payload: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(payload.len() + 8);
    out.push(END);
    for &b in payload {
        match b {
            END => out.extend_from_slice(&[ESC, ESC_END]),
            ESC => out.extend_from_slice(&[ESC, ESC_ESC]),
            _ => out.push(b),
        }
    }
    out.push(END);
    out
}

/// 增量 SLIP 解码器。
///
/// 内部缓冲串口读到的字节，`read_frame` 每次返回一个完整帧（已去转义）。
/// 一次串口读取可能带回多个帧（例如 READ_FLASH 的数据流），缓冲区会保留
/// 未消费的字节供下一次调用使用。
#[derive(Debug, Default)]
pub struct SlipDecoder {
    buf: Vec<u8>,
    pos: usize,
}

impl SlipDecoder {
    pub fn new() -> Self {
        Self::default()
    }

    /// 丢弃所有缓冲数据（对应串口 clear input）。
    pub fn clear(&mut self) {
        self.buf.clear();
        self.pos = 0;
    }

    /// 从 `reader` 读取直到解出一个完整帧。
    ///
    /// 超时等 IO 错误原样向上传递（超时由串口自身 timeout 控制）。
    pub fn read_frame<R: Read>(&mut self, reader: &mut R) -> Result<Vec<u8>> {
        let mut frame: Vec<u8> = Vec::new();
        let mut started = false;
        let mut in_escape = false;

        loop {
            while self.pos < self.buf.len() {
                let b = self.buf[self.pos];
                self.pos += 1;

                if !started {
                    if b == END {
                        started = true;
                    }
                    // 帧外噪声直接丢弃
                    continue;
                }

                if in_escape {
                    match b {
                        ESC_END => frame.push(END),
                        ESC_ESC => frame.push(ESC),
                        other => {
                            return Err(Error::InvalidResponse(format!(
                                "bad_slip_escape:0x{other:02X}"
                            )))
                        }
                    }
                    in_escape = false;
                    continue;
                }

                match b {
                    END => {
                        if frame.is_empty() {
                            // 连续的 0xC0（空帧）：视为新帧开始
                            continue;
                        }
                        self.compact();
                        return Ok(frame);
                    }
                    ESC => in_escape = true,
                    _ => frame.push(b),
                }
            }

            // 缓冲耗尽，继续从串口读
            self.compact();
            let mut chunk = [0u8; 1024];
            let n = reader.read(&mut chunk)?;
            if n == 0 {
                return Err(Error::Io(std::io::Error::new(
                    std::io::ErrorKind::TimedOut,
                    "serial returned 0 bytes",
                )));
            }
            self.buf.extend_from_slice(&chunk[..n]);
        }
    }

    fn compact(&mut self) {
        if self.pos > 0 {
            self.buf.drain(..self.pos);
            self.pos = 0;
        }
    }
}
