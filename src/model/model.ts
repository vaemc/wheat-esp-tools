export interface FileInfo {
  isDir: boolean;
  isFile: boolean;
  len: number;
  createTime: number;
}

export interface Firmware {
  size: string;
  check: boolean;
  path: string;
  address: string;
}

interface BluetoothDevice {
  address: string;
  local_name: string;
  rssi: number;
  manufacturer_data: any;
  services: string[];
  service_data: any;
  adv: number[];
}
