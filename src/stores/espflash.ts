import { defineStore } from "pinia";
import {
  ensureEspflashListeners,
  formatEspflashMessage,
  onEspflashProgress,
  type EspflashProgressPayload,
} from "@/utils/espflash/events";
import { syncTaskbarProgress } from "@/utils/taskbarProgress";

function pushTaskbar(store: {
  busy: boolean;
  percent: number;
  phase: string;
}) {
  syncTaskbarProgress({
    busy: store.busy,
    percent: store.percent,
    phase: store.phase,
  });
}

export const useEspflashStore = defineStore("espflash", {
  state: () => ({
    busy: false,
    jobId: "" as string,
    op: "" as string,
    phase: "" as string,
    percent: 0,
    message: "",
    _bound: false,
  }),

  getters: {
    visible: (state) => state.busy || (state.percent > 0 && state.percent < 100),
  },

  actions: {
    async bind() {
      if (this._bound) {
        return;
      }
      this._bound = true;
      await ensureEspflashListeners();
      onEspflashProgress((payload) => this.applyProgress(payload));
    },

    applyProgress(payload: EspflashProgressPayload) {
      // 始终过滤非当前任务；无活跃任务时忽略迟到事件
      if (this.jobId) {
        if (payload.jobId !== this.jobId) {
          return;
        }
      } else if (!this.busy) {
        return;
      }

      this.jobId = payload.jobId;
      this.op = payload.op;
      this.phase = payload.phase;
      this.percent = Math.round(Math.min(100, Math.max(0, payload.percent)));
      this.message = formatEspflashMessage(
        payload.messageKey,
        payload.params ?? {}
      );
      // busy 只由 begin/end 管理，与 Rust FLASH_LOCK 对齐；
      // progress 的 done/error 只更新展示，不提前释放 busy
      if (payload.phase !== "done" && payload.phase !== "error") {
        this.busy = true;
      }
      pushTaskbar(this);
    },

    begin(jobId: string, op: string, messageKey = "preparing") {
      this.busy = true;
      this.jobId = jobId;
      this.op = op;
      this.phase = "starting";
      this.percent = 0;
      this.message = formatEspflashMessage(messageKey);
      pushTaskbar(this);
    },

    end(jobId: string, ok: boolean, message?: string) {
      // 忽略过期任务的收尾，避免交叉覆盖当前进度
      if (this.jobId && this.jobId !== jobId) {
        return;
      }
      this.busy = false;
      this.phase = ok ? "done" : "error";
      this.percent = ok ? 100 : this.percent;
      if (message) {
        this.message = message;
      }
      pushTaskbar(this);
      window.setTimeout(() => {
        if (this.jobId === jobId && !this.busy) {
          this.reset();
        }
      }, 1800);
    },

    reset() {
      this.busy = false;
      this.jobId = "";
      this.op = "";
      this.phase = "";
      this.percent = 0;
      this.message = "";
      pushTaskbar(this);
    },
  },
});
