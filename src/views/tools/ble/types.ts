/** 与 Rust BleDevice 对应 */
export interface BleDevicePayload {
  address: string;
  local_name: string;
  rssi: number;
  manufacturer_data: Record<string, number[]>;
  services: string[];
  service_data: Record<string, number[]>;
  adv: number[];
}

export interface BleDeviceRecord extends BleDevicePayload {
  lastSeen: number;
  seenCount: number;
}

export interface BleFilterState {
  name: string;
  address: string;
  adv: string;
  uuid: string;
  rssiMin: number;
}

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
