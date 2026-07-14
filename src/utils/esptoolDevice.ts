import { runEsptoolCollect } from "@/utils/esptoolCli";

export interface EspDeviceInfo {
  chipType: string;
  chipDetail: string;
  revision: string;
  mac: string;
  crystal: string;
  features: string;
  flashSize: string;
  flashType: string;
  flashManufacturer: string;
  flashDevice: string;
  psram: string;
  security: string;
}

export const EMPTY_DEVICE_INFO: EspDeviceInfo = {
  chipType: "",
  chipDetail: "",
  revision: "",
  mac: "",
  crystal: "",
  features: "",
  flashSize: "",
  flashType: "",
  flashManufacturer: "",
  flashDevice: "",
  psram: "",
  security: "",
};

const CHIP_COMMANDS = ["chip-id", "flash-id", "read-mac", "get-security-info"] as const;

/** 解析 esptool chip-id / flash-id / read-mac 等命令输出 */
function parseEsptoolDeviceOutput(log: string): EspDeviceInfo {
  const info: EspDeviceInfo = { ...EMPTY_DEVICE_INFO };

  for (const rawLine of log.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    let m = /Detecting chip type\.\.\.\s*(.+)/i.exec(line);
    if (m) {
      info.chipType = m[1].trim();
      continue;
    }

    m = /Chip is\s+(.+)/i.exec(line);
    if (m) {
      info.chipDetail = m[1].trim();
      if (!info.chipType) {
        info.chipType = m[1].split("(")[0].trim();
      }
      const rev = /revision\s+([^)]+)/i.exec(m[1]);
      if (rev) {
        info.revision = rev[1].trim();
      }
      continue;
    }

    m = /MAC:\s*([0-9A-Fa-f:]{17})/i.exec(line);
    if (m) {
      info.mac = m[1].toUpperCase();
      continue;
    }

    m = /Crystal is\s+(.+)/i.exec(line);
    if (m) {
      info.crystal = m[1].trim();
      continue;
    }

    m = /Features:\s*(.+)/i.exec(line);
    if (m) {
      info.features = m[1].trim();
      const psramInFeatures =
        /(?:Embedded\s+)?PSRAM\s+([\d.]+\s*[KMGT]B)/i.exec(m[1]) ||
        /PSRAM\s*([\d.]+\s*[KMGT]B)/i.exec(m[1]);
      if (psramInFeatures) {
        info.psram = psramInFeatures[1].replace(/\s+/g, "");
      }
      continue;
    }

    m = /Detected flash size:\s*(.+)/i.exec(line);
    if (m) {
      info.flashSize = m[1].trim();
      continue;
    }

    m = /Flash memory type:\s*(.+)/i.exec(line);
    if (m) {
      info.flashType = m[1].trim();
      continue;
    }

    m = /Manufacturer:\s*(\S+)/i.exec(line);
    if (m) {
      info.flashManufacturer = m[1].trim();
      continue;
    }

    m = /Device:\s*(\S+)/i.exec(line);
    if (m && !/^0x/i.test(m[1])) {
      info.flashDevice = m[1].trim();
      continue;
    }

    m = /PSRAM\s*([\d.]+\s*[KMGT]B)/i.exec(line);
    if (m && !info.psram) {
      info.psram = m[1].replace(/\s+/g, "");
      continue;
    }

    if (/security|flash encryption|secure boot/i.test(line)) {
      info.security = info.security
        ? `${info.security}; ${line}`
        : line;
    }
  }

  return info;
}

/** 通过 esptool 读取设备信息（多命令合并解析） */
export async function fetchDeviceInfo(
  port: string,
  baud = "115200"
): Promise<EspDeviceInfo> {
  const chunks: string[] = [];

  for (const cmd of CHIP_COMMANDS) {
    try {
      const out = await runEsptoolCollect(port, baud, cmd);
      chunks.push(out);
    } catch {
      // 部分芯片可能不支持个别子命令，继续尝试其余命令
    }
  }

  if (chunks.length === 0) {
    throw new Error("ESPTOOL_FAILED");
  }

  return parseEsptoolDeviceOutput(chunks.join("\n"));
}
