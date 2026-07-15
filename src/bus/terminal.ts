import mitt from "mitt";

type TerminalEvents = {
  writeln: string;
};

const emitter = mitt<TerminalEvents>();
export default emitter;

export function writeln(data: string) {
  emitter.emit("writeln", data);
}
