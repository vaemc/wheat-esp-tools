import mitt from "mitt";
const emitter = mitt();
export default emitter;

export function terminalWrite(data:string) {
  emitter.emit("terminalWrite", data);
}

export function terminalWriteLine(data:string) {
  emitter.emit("terminalWriteLine", data);
}

export function refreshFirmwareList() {
  emitter.emit("refreshFirmwareList");
}
