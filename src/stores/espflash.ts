import { defineStore } from "pinia";
import {
  ensureEspflashListeners,
  formatEspflashMessage,
  onEspflashProgress,
  type EspflashProgressPayload,
} from "@/utils/espflash/events";

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
      if (this.jobId && payload.jobId !== this.jobId && this.busy) {
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
      if (payload.phase === "done" || payload.phase === "error") {
        this.busy = false;
        window.setTimeout(() => {
          if (this.jobId === payload.jobId && !this.busy) {
            this.reset();
          }
        }, 1800);
      } else {
        this.busy = true;
      }
    },

    begin(jobId: string, op: string, messageKey = "preparing") {
      this.busy = true;
      this.jobId = jobId;
      this.op = op;
      this.phase = "starting";
      this.percent = 0;
      this.message = formatEspflashMessage(messageKey);
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
    },

    reset() {
      this.busy = false;
      this.jobId = "";
      this.op = "";
      this.phase = "";
      this.percent = 0;
      this.message = "";
    },
  },
});
