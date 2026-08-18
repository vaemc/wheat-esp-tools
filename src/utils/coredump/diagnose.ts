import type { Diagnosis } from "./types";
import { describeExccause } from "./xtensa";

export function diagnose(input: {
  panicDetails: string;
  exccause: number;
  excvaddr: number;
  pc: number;
  backtraceCorrupted: boolean;
  crashedTask: string;
  isrContext?: boolean;
}): Diagnosis {
  const exc = describeExccause(input.exccause);
  const details = input.panicDetails.toLowerCase();
  const hintKeys: string[] = [];
  let causeKey = "crash.cause.generic";
  let severity: Diagnosis["severity"] = "critical";

  if (details.includes("abort") || details.includes("assert")) {
    causeKey = "crash.cause.abort";
    hintKeys.push("crash.hint.abort");
  } else if (details.includes("watchdog") || details.includes("wdt") || details.includes("twdt")) {
    causeKey = "crash.cause.wdt";
    hintKeys.push("crash.hint.wdt");
  } else if (details.includes("stack") && (details.includes("overflow") || details.includes("canary") || details.includes("smashing"))) {
    causeKey = "crash.cause.stack";
    hintKeys.push("crash.hint.stack");
  } else if (input.exccause === 28 || input.exccause === 29) {
    const nearNull = input.excvaddr < 0x10000;
    causeKey = nearNull ? "crash.cause.nullDeref" : "crash.cause.badPtr";
    hintKeys.push(nearNull ? "crash.hint.nullDeref" : "crash.hint.badPtr");
  } else if (input.exccause === 20) {
    causeKey = "crash.cause.badPc";
    hintKeys.push("crash.hint.badPc");
  } else if (input.exccause === 9) {
    causeKey = "crash.cause.alignment";
    hintKeys.push("crash.hint.alignment");
  } else if (input.exccause === 6) {
    causeKey = "crash.cause.divZero";
    hintKeys.push("crash.hint.divZero");
  } else if (input.exccause === 0) {
    causeKey = "crash.cause.illegalInstruction";
    hintKeys.push("crash.hint.illegalInstruction");
  } else if (input.panicDetails) {
    causeKey = "crash.cause.panicDetails";
    hintKeys.push("crash.hint.panicDetails");
  } else {
    hintKeys.push("crash.hint.generic");
  }

  if (input.backtraceCorrupted) {
    hintKeys.push("crash.hint.btCorrupted");
  }
  if (input.isrContext) {
    hintKeys.push("crash.hint.isr");
    severity = "warning";
  }
  if (input.crashedTask.toLowerCase().startsWith("idle")) {
    hintKeys.push("crash.hint.idle");
    severity = "warning";
  }

  return {
    severity,
    causeKey,
    hintKeys,
    exceptionName: exc.name,
    exceptionExplainKey: exc.explainKey,
  };
}
