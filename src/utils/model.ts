export interface HistoryPath {
  ellipsis: string;
  full: string;
  name: string;
}

export interface ToolConfig {
  name: string;
  toast: string;
  cmd: string[];
  isDrop: boolean;
  drop?: {
    value: string;
    isDirectory: boolean;
    desc: string;
    help: string;
    regex: string;
  };
}
