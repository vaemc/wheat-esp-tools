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
