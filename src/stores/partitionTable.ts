import { defineStore } from "pinia";
import { DEFAULT_OFFSET_PART_TABLE_HEX } from "@/utils/partitionTable";

/** 全局分区表偏移（设备读取 / CSV 对齐共用，默认 0x8000） */
export const usePartitionTableStore = defineStore("partitionTable", {
  state: () => ({
    tableOffset: DEFAULT_OFFSET_PART_TABLE_HEX,
  }),
  persist: true,
});
