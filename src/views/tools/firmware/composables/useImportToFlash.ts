import { useRouter } from "vue-router";
import prettyBytes from "pretty-bytes";
import { useToolsStore } from "@/stores/Tool";
import {
  getFileInfo,
  getIDFArgsConfig,
  getPlatformIOArgsConfig,
} from "@/utils/common";
import { basename } from "@/utils/path";

export function useImportToFlash() {
  const router = useRouter();
  const store = useToolsStore();

  async function importConfig(path: string): Promise<boolean> {
    const filename = basename(path);
    let config;

    if (filename === "flasher_args.json") {
      config = await getIDFArgsConfig(path);
    } else if (filename === "idedata.json") {
      config = await getPlatformIOArgsConfig(path);
    } else {
      return false;
    }

    store.firmwareList = config.flashFiles;
    store.selectedChipType = config.chip;

    await Promise.all(
      store.firmwareList.map(async (item) => {
        const fileInfo = await getFileInfo(item.path);
        item.size = prettyBytes(fileInfo.len);
      })
    );

    store.selectedKeys = ["flash"];
    await router.push({ name: "flash" });
    return true;
  }

  return { importConfig };
}
