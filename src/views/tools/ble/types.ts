/** 与 Rust ClassicBtDevice 对应 */
export interface ClassicBtDevicePayload {
  address: string;
  local_name: string;
  class_of_device: string;
  class_category: string;
  connected: boolean;
  paired: boolean;
  authenticated: boolean;
  /** RSSI in dBm; null when unavailable */
  rssi?: number | null;
}

export interface ClassicBtDeviceRecord extends ClassicBtDevicePayload {
  rssi: number | null;
  lastSeen: number;
  seenCount: number;
}

export interface ClassicBtFilterState {
  name: string;
  address: string;
  pairedOnly: boolean;
  connectedOnly: boolean;
  rssiMin: number;
}

export type BleScanMode = "ble" | "classic";
