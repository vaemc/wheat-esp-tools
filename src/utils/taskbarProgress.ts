import {
  getCurrentWindow,
  ProgressBarStatus,
} from "@tauri-apps/api/window";

type TaskbarSnapshot = {
  status: ProgressBarStatus;
  progress: number;
};

let last: TaskbarSnapshot | null = null;
let pending: Promise<void> | null = null;

async function apply(snapshot: TaskbarSnapshot): Promise<void> {
  if (
    last &&
    last.status === snapshot.status &&
    last.progress === snapshot.progress
  ) {
    return;
  }
  last = snapshot;
  try {
    await getCurrentWindow().setProgressBar({
      status: snapshot.status,
      progress: snapshot.progress,
    });
  } catch {
    // 非桌面环境 / 权限缺失时静默忽略
  }
}

/**
 * 将 Flash / 分区等 espflash 进度同步到系统任务栏进度条（Win10/11 等）。
 * 调用可频繁触发；相同状态会被去重。
 */
export function syncTaskbarProgress(state: {
  busy: boolean;
  percent: number;
  phase: string;
}): void {
  const percent = Math.round(Math.min(100, Math.max(0, state.percent)));
  let snapshot: TaskbarSnapshot;

  if (state.phase === "error") {
    snapshot = { status: ProgressBarStatus.Error, progress: percent };
  } else if (state.busy || state.phase === "done") {
    snapshot = { status: ProgressBarStatus.Normal, progress: percent };
  } else {
    snapshot = { status: ProgressBarStatus.None, progress: 0 };
  }

  const run = () => apply(snapshot);
  pending = (pending ?? Promise.resolve()).then(run, run);
}

/** 强制清空任务栏进度（例如应用退出前）。 */
export function clearTaskbarProgress(): void {
  syncTaskbarProgress({ busy: false, percent: 0, phase: "" });
}
