import mitt from "mitt";
const emitter = mitt();
export default emitter;

export function writeln(data: string) {
  emitter.emit("writeln", data);
}
