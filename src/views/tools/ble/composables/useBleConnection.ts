import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { onUnmounted, ref, shallowRef } from "vue";
import { message } from "ant-design-vue";

/** 与测试固件一致：Service 0x00FF / Msg 0xFF01 / Counter 0xFF02 */
export const ESP_TEST_SERVICE = "000000ff-0000-1000-8000-00805f9b34fb";
export const ESP_TEST_CHAR_MSG = "0000ff01-0000-1000-8000-00805f9b34fb";
export const ESP_TEST_CHAR_COUNTER = "0000ff02-0000-1000-8000-00805f9b34fb";

export interface BleCharInfo {
  uuid: string;
  properties: string[];
}

export interface BleServiceInfo {
  uuid: string;
  characteristics: BleCharInfo[];
}

export interface BleConnectInfo {
  address: string;
  name: string;
  services: BleServiceInfo[];
}

export interface BleNotifyPayload {
  service_uuid: string;
  char_uuid: string;
  value: number[];
}

export interface BleLogLine {
  id: number;
  at: number;
  kind: "tx" | "rx" | "info" | "error";
  text: string;
}

function bytesToUtf8(bytes: number[]): string {
  try {
    return new TextDecoder().decode(Uint8Array.from(bytes));
  } catch {
    return "";
  }
}

function bytesToHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join(" ");
}

function formatNotifyValue(charUuid: string, value: number[]): string {
  const u = charUuid.toLowerCase();
  if (u.includes("ff02") && value.length >= 4) {
    const n =
      value[0]! |
      (value[1]! << 8) |
      (value[2]! << 16) |
      (value[3]! << 24);
    return `counter=${n >>> 0}`;
  }
  const text = bytesToUtf8(value);
  if (text && /^[\x20-\x7E]*$/.test(text)) {
    return text;
  }
  return bytesToHex(value);
}

let logSeq = 0;

export function useBleConnection() {
  const connected = ref(false);
  const connecting = ref(false);
  const busy = ref(false);
  const info = shallowRef<BleConnectInfo | null>(null);
  const logs = ref<BleLogLine[]>([]);
  const subscribed = ref<Set<string>>(new Set());
  const lastCounter = ref<number | null>(null);

  let unlistenNotify: UnlistenFn | null = null;
  let unlistenDisc: UnlistenFn | null = null;

  function pushLog(kind: BleLogLine["kind"], text: string) {
    logs.value = [
      ...logs.value.slice(-199),
      { id: ++logSeq, at: Date.now(), kind, text },
    ];
  }

  function clearLogs() {
    logs.value = [];
  }

  async function ensureListeners() {
    if (!unlistenNotify) {
      unlistenNotify = await listen<BleNotifyPayload>("ble_notification", (e) => {
        const { char_uuid, value } = e.payload;
        const formatted = formatNotifyValue(char_uuid, value);
        pushLog("rx", `Notify ${shortUuid(char_uuid)}: ${formatted}`);
        if (char_uuid.toLowerCase().includes("ff02") && value.length >= 4) {
          lastCounter.value =
            (value[0]! |
              (value[1]! << 8) |
              (value[2]! << 16) |
              (value[3]! << 24)) >>>
            0;
        }
      });
    }
    if (!unlistenDisc) {
      unlistenDisc = await listen("ble_disconnected", () => {
        connected.value = false;
        info.value = null;
        subscribed.value = new Set();
        pushLog("info", "设备已断开");
      });
    }
  }

  async function connect(address: string, name?: string) {
    if (connecting.value || busy.value) {
      return;
    }
    connecting.value = true;
    try {
      await ensureListeners();
      const result = await invoke<BleConnectInfo>("ble_connect", {
        address,
        name: name || null,
      });
      info.value = result;
      connected.value = true;
      subscribed.value = new Set();
      pushLog(
        "info",
        `已连接 ${result.name || "(unnamed)"} ${result.address}，服务 ${result.services.length} 个`
      );
      message.success("BLE 已连接");
    } catch (err) {
      const msg = typeof err === "string" ? err : String(err ?? "连接失败");
      pushLog("error", msg);
      message.error(msg);
      throw err;
    } finally {
      connecting.value = false;
    }
  }

  async function disconnect() {
    try {
      await invoke("ble_disconnect");
    } catch {
      /* ignore */
    }
    connected.value = false;
    info.value = null;
    subscribed.value = new Set();
    pushLog("info", "已断开连接");
  }

  async function read(serviceUuid: string, charUuid: string) {
    busy.value = true;
    try {
      const data = await invoke<number[]>("ble_read", {
        serviceUuid,
        charUuid,
      });
      pushLog(
        "rx",
        `Read ${shortUuid(charUuid)}: ${formatNotifyValue(charUuid, data)}`
      );
      return data;
    } catch (err) {
      const msg = typeof err === "string" ? err : String(err ?? "读取失败");
      pushLog("error", msg);
      message.error(msg);
      throw err;
    } finally {
      busy.value = false;
    }
  }

  async function write(
    serviceUuid: string,
    charUuid: string,
    text: string,
    withoutResponse = false
  ) {
    busy.value = true;
    try {
      const data = Array.from(new TextEncoder().encode(text));
      await invoke("ble_write", {
        serviceUuid,
        charUuid,
        data,
        withoutResponse,
      });
      pushLog("tx", `Write ${shortUuid(charUuid)}: ${text}`);
    } catch (err) {
      const msg = typeof err === "string" ? err : String(err ?? "写入失败");
      pushLog("error", msg);
      message.error(msg);
      throw err;
    } finally {
      busy.value = false;
    }
  }

  async function subscribe(serviceUuid: string, charUuid: string) {
    busy.value = true;
    try {
      await invoke("ble_subscribe", { serviceUuid, charUuid });
      const next = new Set(subscribed.value);
      next.add(charUuid.toLowerCase());
      subscribed.value = next;
      pushLog("info", `已订阅 ${shortUuid(charUuid)}`);
    } catch (err) {
      const msg = typeof err === "string" ? err : String(err ?? "订阅失败");
      pushLog("error", msg);
      message.error(msg);
      throw err;
    } finally {
      busy.value = false;
    }
  }

  async function unsubscribe(serviceUuid: string, charUuid: string) {
    busy.value = true;
    try {
      await invoke("ble_unsubscribe", { serviceUuid, charUuid });
      const next = new Set(subscribed.value);
      next.delete(charUuid.toLowerCase());
      subscribed.value = next;
      pushLog("info", `已取消订阅 ${shortUuid(charUuid)}`);
    } catch (err) {
      const msg = typeof err === "string" ? err : String(err ?? "取消订阅失败");
      pushLog("error", msg);
      message.error(msg);
      throw err;
    } finally {
      busy.value = false;
    }
  }

  /** 一键对接 ESP32-S3-BLE 测试固件：订阅 Msg+Counter，写一条消息 */
  async function runEspTestEcho(text = "hello") {
    if (!connected.value) {
      throw new Error("未连接");
    }
    await subscribe(ESP_TEST_SERVICE, ESP_TEST_CHAR_MSG);
    await subscribe(ESP_TEST_SERVICE, ESP_TEST_CHAR_COUNTER);
    await write(ESP_TEST_SERVICE, ESP_TEST_CHAR_MSG, text);
  }

  function isSubscribed(charUuid: string) {
    return subscribed.value.has(charUuid.toLowerCase());
  }

  onUnmounted(() => {
    unlistenNotify?.();
    unlistenDisc?.();
    unlistenNotify = null;
    unlistenDisc = null;
  });

  return {
    connected,
    connecting,
    busy,
    info,
    logs,
    lastCounter,
    clearLogs,
    connect,
    disconnect,
    read,
    write,
    subscribe,
    unsubscribe,
    runEspTestEcho,
    isSubscribed,
  };
}

export function shortUuid(uuid: string): string {
  const u = uuid.replace(/-/g, "").toLowerCase();
  if (u.length >= 8 && u.startsWith("0000") && u.endsWith("00001000800000805f9b34fb")) {
    return "0x" + u.slice(4, 8).toUpperCase();
  }
  if (uuid.length > 12) {
    return uuid.slice(0, 8) + "…";
  }
  return uuid;
}
