import mitt from "mitt";
const emitter = mitt();
export default emitter;

export function write(data: string) {
  emitter.emit("write", data);
}

export function writeln(data: string) {
  emitter.emit("writeln", data);
}
