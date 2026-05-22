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
