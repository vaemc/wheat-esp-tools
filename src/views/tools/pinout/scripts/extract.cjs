/**
 * ESP32 family pin data extractor.
 *
 * Reads official datasheet text dumps in ./datasheets/<chip>.txt
 * and writes one JSON per chip to ./out/<chip>.json
 *
 *   node scripts/extract.cjs            # all chips
 *   node scripts/extract.cjs esp32-c3   # one chip
 *
 * Strategy:
 *   1. Read the whole datasheet text as a single string.
 *   2. For each table of interest (Pin Overview, IO MUX Functions, LP IO MUX
 *      Functions, Analog Functions) find the table region by string search,
 *      cropped at the next footnote / next table header.
 *   3. Tokenize the region and walk pin-by-pin, classifying each token as
 *      a field (type / supply / reset / func-set marker / function name +
 *      type pair / analog-name).
 *   4. Merge into an array of PinInfo and emit JSON.
 *
 * This works for both PDF text dumps (newline-separated) and HTML dumps
 * (one giant line) because we treat content as a flat token stream.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "datasheets");
const OUT_DIR = path.join(__dirname, "out");

const CHIPS = ["esp32", "esp32-s3", "esp32-c3", "esp32-c6", "esp32-c5"];

/* ===================================================================== */
/*  Generic helpers                                                       */
/* ===================================================================== */

const readWhole = (file) => {
  let text = fs
    .readFileSync(file, "utf8")
    .replace(/\r/g, "")
    .replace(/[\u00A0\u200B]/g, " ") // NBSP / zero-width
    .replace(/&nbsp;/g, " ");
  // Strip markdown table decoration so cells flow into a normal token stream.
  text = text.replace(/^\s*\|+/gm, " ").replace(/\|+/g, " ").replace(/^[-\s]+$/gm, "");
  return text;
};

/** Pre-merge multi-word tokens like "IO MUX", "RTC IO MUX", "LP IO MUX",
 *  "WPU, IE", "IE, WPU", "VDD_SPI / VDD3P3_CPU", into single tokens. */
function tokenize(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];

    if (w === "RTC" && words[i + 1] === "IO" && words[i + 2] === "MUX") {
      out.push("RTC IO MUX");
      i += 2;
      continue;
    }
    if (w === "LP" && words[i + 1] === "IO" && words[i + 2] === "MUX") {
      out.push("LP IO MUX");
      i += 2;
      continue;
    }
    if (w === "IO" && words[i + 1] === "MUX") {
      out.push("IO MUX");
      i += 1;
      continue;
    }
    // Merge "WPU, IE" / "IE, WPU" / "WPD, IE" / etc.
    if (
      /^(IE|OE|WPU|WPD|USB_PU),$/.test(w) &&
      /^(IE|OE|WPU|WPD|USB_PU)$/.test(words[i + 1] || "")
    ) {
      out.push(w + " " + words[i + 1]);
      i += 1;
      continue;
    }
    // Merge "VDD_SPI / VDD3P3_CPU"
    if (
      /^[A-Z][A-Z0-9_]*$/.test(w) &&
      words[i + 1] === "/" &&
      /^[A-Z][A-Z0-9_]*$/.test(words[i + 2] || "")
    ) {
      out.push(w + "/" + words[i + 2]);
      i += 2;
      continue;
    }
    out.push(w);
  }
  return out;
}

/** Crop a substring starting at `start` and ending before any of `stops`. */
function crop(content, startStr, ...stops) {
  const i = content.indexOf(startStr);
  if (i < 0) return null;
  let end = content.length;
  for (const stop of stops) {
    const re = stop instanceof RegExp ? stop : new RegExp(stop);
    re.lastIndex = i + startStr.length;
    const m = re.exec(content.slice(i + startStr.length));
    if (m) {
      const candidate = i + startStr.length + m.index;
      if (candidate < end) end = candidate;
    }
  }
  return content.slice(i, end);
}

/* ===================================================================== */
/*  Pin Overview parser                                                   */
/* ===================================================================== */

const TYPE_TOKENS = new Set(["IO", "Power", "Analog", "Power/IO"]);
const FUNCSET_TOKENS = new Set([
  "IO MUX",
  "RTC IO MUX",
  "LP IO MUX",
  "Analog",
]);
const SETTING_RE = /^(IE|OE|WPU|WPD|USB_PU)(\s+(IE|OE|WPU|WPD|USB_PU))*$/;
const SUPPLY_RE = /^(VDD[A-Z0-9_]*|VANA|VRTC|VIO|VSDIO)(\/(VDD[A-Z0-9_]*|VANA|VRTC|VIO|VSDIO))?$/;
const PIN_NAME_RE = /^[A-Z][A-Z0-9_]*$/;

/** Scan the whole file for pin-overview rows.
 *  A row is detected by a regex: "<num> <NAME> (IO|Power|Analog|Power/IO) ..."
 *  Then we walk forward until the next row-like start to grab supply/reset.
 */
function parsePinOverviewWholeFile(text, expectedCount) {
  const map = new Map();

  // Step 1: find every "<num> <NAME> [<footnote>] <Type>" anchor.
  // Pin name can contain "/" (e.g. "SPICS0/NC" on ESP32-C5) and may start
  // with a digit (e.g. "32K_XP" on ESP32).  An optional footnote-digit may
  // sit between name and type (e.g. "SPICS0/NC 6 IO ...").
  const rowRe =
    /(?:^|\s)(\d{1,3})\s+([A-Za-z0-9][A-Za-z0-9_/]*)\s+(?:\d{1,2}\s+)?(IO|Power|Analog|Power\/IO)\b/g;
  let m;
  while ((m = rowRe.exec(text))) {
    const num = Number(m[1]);
    if (num < 1 || num > expectedCount + 5) continue;
    const name = m[2];
    const type = m[3];
    // Take up to 180 chars after the type but DON'T consume them in the regex.
    const tailStart = m.index + m[0].length;
    const tail = text.slice(tailStart, tailStart + 180);
    const tokens = tokenize(tail);

    // Walk forward, picking up supply (first VDDxxx) and settings.
    let supply = "";
    const settings = [];
    for (const t of tokens) {
      if (TYPE_TOKENS.has(t)) continue;
      if (FUNCSET_TOKENS.has(t)) continue;
      // Stop if we run into the next pin row inside the tail
      if (
        /^\d{1,3}$/.test(t) &&
        Number(t) !== num &&
        Number(t) <= expectedCount + 5
      ) {
        break;
      }
      if (SUPPLY_RE.test(t) && !supply) {
        supply = t;
        continue;
      }
      if (SETTING_RE.test(t)) {
        settings.push(t);
        continue;
      }
    }
    // Only set if we don't already have a row for this pin (first match wins).
    if (!map.has(num)) {
      map.set(num, {
        number: num,
        name,
        type,
        supply,
        resetAt: settings[0] || "",
        resetAfter: settings[1] || "",
      });
    }
  }
  return map;
}

function parsePinOverview(region) {
  const tokens = tokenize(region);
  const pins = new Map();

  // Drop everything before the first numeric pin id
  let i = 0;
  while (i < tokens.length && !/^\d+$/.test(tokens[i])) i++;

  while (i < tokens.length) {
    const num = Number(tokens[i]);
    if (!Number.isFinite(num) || num <= 0) {
      i++;
      continue;
    }
    // Look ahead for a valid name
    if (i + 1 >= tokens.length) break;
    if (!PIN_NAME_RE.test(tokens[i + 1])) {
      i++;
      continue;
    }
    const number = num;
    const name = tokens[i + 1];
    let j = i + 2;

    // Walk forward, accumulating tokens into fields, until we hit the next
    // pin number (a numeric token followed by a name-like token).
    let type = "";
    let supply = "";
    const settings = []; // [resetAt, resetAfter]
    while (j < tokens.length) {
      const t = tokens[j];
      // Lookahead: is this the start of the next pin row?
      if (
        /^\d+$/.test(t) &&
        Number(t) !== number &&
        Number(t) >= 1 &&
        Number(t) <= 200 &&
        j + 1 < tokens.length &&
        PIN_NAME_RE.test(tokens[j + 1]) &&
        // Either the next token's number is sequential, or its name matches a known pin pattern
        Math.abs(Number(t) - number) < 100
      ) {
        break;
      }

      if (TYPE_TOKENS.has(t)) {
        if (!type) type = t;
      } else if (FUNCSET_TOKENS.has(t)) {
        // ignore here — they're not part of the per-pin info we keep
      } else if (SUPPLY_RE.test(t) && !supply) {
        supply = t;
      } else if (SETTING_RE.test(t)) {
        settings.push(t);
      }
      // else: footnote markers ("4", "5"), table-header words, etc. — skip
      j++;
    }

    pins.set(number, {
      number,
      name,
      type,
      supply,
      resetAt: settings[0] || "",
      resetAfter: settings[1] || "",
    });
    i = j;
  }
  return pins;
}

/* ===================================================================== */
/*  IO MUX Functions parser                                               */
/* ===================================================================== */
/* Each row format (e.g. ESP32-C3 Table 2-4):
 *   "<pinNo> <gpioName> <F0name> <F0type> <F1name> <F1type> [<F2name> <F2type>]"
 *
 * Type strings: I, O, T, IE, OE, I0, I1, I/O/T, I0/O/T, I1/O/T, O/T, I/T
 */
function isType(t) {
  return /^(I|O|T|I0|I1|IE|OE|I\/O\/T|I0\/O\/T|I1\/O\/T|O\/T|I\/T)$/.test(t);
}

function parseIomuxRows(region, pinNumbers) {
  const tokens = tokenize(region);
  const map = new Map();

  // Find each pin number in the token stream, then walk forward
  let i = 0;
  while (i < tokens.length) {
    if (!/^\d+$/.test(tokens[i])) {
      i++;
      continue;
    }
    const num = Number(tokens[i]);
    if (!pinNumbers.has(num)) {
      i++;
      continue;
    }
    if (
      i + 1 >= tokens.length ||
      !/^GPIO\d+$|^MTCK$|^MTDI$|^MTDO$|^MTMS$|^U0[RT]XD$|^SPI[A-Z]+\d?$|^SPICLK_[NP]$|^XTAL_/.test(
        tokens[i + 1]
      )
    ) {
      i++;
      continue;
    }
    const gpioName = tokens[i + 1];
    let j = i + 2;
    const funcs = [];
    let fIdx = 0;
    while (j < tokens.length && fIdx < 6) {
      // Stop if we see a new pin row "(num) (gpio-like name)"
      if (
        /^\d+$/.test(tokens[j]) &&
        Number(tokens[j]) !== num &&
        pinNumbers.has(Number(tokens[j])) &&
        j + 1 < tokens.length &&
        /^GPIO\d+$|^MTCK$|^MTDI$|^MTDO$|^MTMS$|^U0[RT]XD$|^SPI/.test(
          tokens[j + 1]
        )
      ) {
        break;
      }
      // Collect name tokens until type
      const nameTokens = [];
      while (j < tokens.length && !isType(tokens[j])) {
        // Stop early on a numeric token that's a new pin
        if (
          /^\d+$/.test(tokens[j]) &&
          pinNumbers.has(Number(tokens[j])) &&
          j + 1 < tokens.length &&
          /^GPIO\d+$|^MTCK$|^MTDI$|^MTDO$|^MTMS$|^U0[RT]XD$|^SPI/.test(
            tokens[j + 1]
          )
        ) {
          break;
        }
        nameTokens.push(tokens[j]);
        j++;
      }
      if (nameTokens.length === 0) break;
      if (j >= tokens.length || !isType(tokens[j])) break;
      const type = tokens[j];
      j++;
      // Validate the function name looks valid
      const fname = nameTokens.join(" ");
      if (!/^[A-Z][A-Z0-9_]*(\s+[A-Z][A-Z0-9_]*)*$/.test(fname)) break;
      funcs.push({ f: "F" + fIdx, name: fname, type });
      fIdx++;
    }
    if (funcs.length > 0) {
      if (!map.has(num)) map.set(num, funcs);
    }
    i = j > i ? j : i + 1;
  }
  return map;
}

/* ===================================================================== */
/*  LP IO MUX Functions parser                                            */
/* ===================================================================== */
function parseLpioRows(region, pinNumbers) {
  const tokens = tokenize(region);
  const map = new Map();

  let i = 0;
  while (i < tokens.length) {
    if (!/^\d+$/.test(tokens[i])) {
      i++;
      continue;
    }
    const num = Number(tokens[i]);
    if (!pinNumbers.has(num)) {
      i++;
      continue;
    }
    if (i + 1 >= tokens.length || !/^LP_GPIO\d+$/.test(tokens[i + 1])) {
      i++;
      continue;
    }
    const lpName = tokens[i + 1];
    const f0 = tokens[i + 2] || "";
    const f1 = tokens[i + 3] || "";
    const funcs = [];
    if (/^[A-Z][A-Z0-9_]*$/.test(f0)) funcs.push({ f: "F0", name: f0, type: "I/O/T" });
    if (/^[A-Z][A-Z0-9_]*$/.test(f1) && !/^\d+$/.test(f1)) {
      funcs.push({ f: "F1", name: f1, type: "I/O/T" });
    }
    if (funcs.length && !map.has(num)) map.set(num, funcs);
    i += 2 + funcs.length;
  }
  return map;
}

/* ===================================================================== */
/*  Analog Functions parser                                               */
/* ===================================================================== */
function parseAnalogRows(region, pinNumbers, twoPackageColumns = false) {
  const tokens = tokenize(region);
  const map = new Map();

  let i = 0;
  while (i < tokens.length) {
    if (!/^\d+$/.test(tokens[i])) {
      i++;
      continue;
    }
    const num = Number(tokens[i]);
    if (!pinNumbers.has(num)) {
      i++;
      continue;
    }
    let j = i + 1;
    if (twoPackageColumns) {
      // Skip the second package's pin number column ("8 8 GPIO2 ...")
      if (
        j < tokens.length &&
        (/^\d+$/.test(tokens[j]) || tokens[j] === "—")
      ) {
        j++;
      }
    }
    if (j >= tokens.length || !/^GPIO\d+$|^LNA_IN$/.test(tokens[j])) {
      i++;
      continue;
    }
    j++; // gpio name consumed
    const analog = [];
    while (j < tokens.length) {
      const t = tokens[j];
      // Stop on next pin number
      if (
        /^\d+$/.test(t) &&
        pinNumbers.has(Number(t)) &&
        j + 1 < tokens.length &&
        (/^GPIO\d+$|^LNA_IN$/.test(tokens[j + 1]) ||
          /^\d+$|^—$/.test(tokens[j + 1]))
      ) {
        break;
      }
      if (/^[A-Z][A-Z0-9_+\-/]*$/.test(t)) {
        analog.push(t);
      } else {
        // skip stray tokens
      }
      j++;
    }
    if (analog.length && !map.has(num)) map.set(num, analog);
    i = j > i ? j : i + 1;
  }
  return map;
}

/* ===================================================================== */
/*  ESP32 (uses dedicated pin list PDF — different format)                */
/* ===================================================================== */
function extractEsp32() {
  // The dedicated Pin List PDF (esp32-pinlist.txt) has all 48 pins on a
  // single page in plain text, with up to 3 analog functions and 6 IO MUX
  // functions per pin.
  const text = readWhole(path.join(DATA_DIR, "esp32-pinlist.txt"));
  const pins = new Map();

  // Look for each pin anchor "<n> <NAME> <powerDomain>" — name must look
  // like an actual ESP32 pin (UPPER_SNAKE / digits, never lowercase words).
  // Using a lookahead so that the regex's lastIndex doesn't skip past the
  // next pin on the same source line.  Also rejects accidental matches like
  // "Note 5 These VRTC ..." (the "Note 5" footnote tail).
  const lineRe =
    /(?:^|\s)(\d{1,2})\s+(?!Note|These|This|page|column)([A-Z0-9][A-Z0-9_]*)\s+(VANA|VRTC|VIO|VSDIO)\b/g;
  let m;
  while ((m = lineRe.exec(text))) {
    const number = Number(m[1]);
    if (number < 1 || number > 48) continue;
    const name = m[2];
    const supply = m[3];
    if (pins.has(number)) continue;

    const tailStart = m.index + m[0].length;
    // Tail goes until the next pin anchor or 220 chars, whichever is shorter.
    const tail = text.slice(tailStart, tailStart + 220);
    const tokens = tail.split(/\s+/).filter(Boolean);

    // Analog functions (ADC*, TOUCH*, RTC_GPIO*, XTAL_*, DAC_*, SENSOR_*, VDET_*)
    const analog = [];
    let k = 0;
    while (k < tokens.length) {
      const t = tokens[k];
      if (
        /^(ADC[12]?_CH\d+|ADC_H|TOUCH\d+|RTC_GPIO\d+|XTAL_(32K_)?[NP]|DAC_\d|SENSOR_(VP|VN|CAPP|CAPN)|VDET_\d)$/.test(
          t
        )
      ) {
        analog.push(t);
        k++;
      } else break;
    }

    // Function 1..6: <name> <type> pairs (some pins skip directly to settings)
    const iomux = [];
    let fIdx = 0;
    while (k + 1 < tokens.length && fIdx < 6) {
      const tName = tokens[k];
      const tType = tokens[k + 1];
      if (!PIN_NAME_RE.test(tName)) break;
      if (!isType(tType)) break;
      iomux.push({ f: "F" + fIdx, name: tName, type: tType });
      fIdx++;
      k += 2;
    }

    // Whether this line is a "power"-only row (e.g. "supply in")
    const isPower =
      iomux.length === 0 && /\b(in|out|supply)\b/.test(tail);

    let type = "IO";
    if (isPower || /^VDD/.test(name) || /^VBAT/.test(name)) type = "Power";
    if (/^XTAL_|^CHIP_PU$|^LNA_IN$|^CAP\d$/.test(name)) type = "Analog";

    pins.set(number, {
      number,
      name,
      type,
      supply,
      resetAt: "",
      resetAfter: "",
      iomux,
      lpio: [],
      analog,
    });
  }

  // Force-add any missing power-only pins (ESP32 has 48 total)
  const expected = {
    1: { name: "VDDA", supply: "VANA", type: "Power" },
    2: { name: "LNA_IN", supply: "VANA", type: "Analog" },
    3: { name: "VDD3P3", supply: "VANA", type: "Power" },
    4: { name: "VDD3P3", supply: "VANA", type: "Power" },
    9: { name: "CHIP_PU", supply: "VRTC", type: "Analog" },
    19: { name: "VDD3P3_RTC", supply: "VRTC", type: "Power" },
    26: { name: "VDD_SDIO", supply: "VSDIO", type: "Power" },
    37: { name: "VDD3P3_CPU", supply: "VIO", type: "Power" },
    43: { name: "VDDA", supply: "VANA", type: "Power" },
    44: { name: "XTAL_N", supply: "VANA", type: "Analog" },
    45: { name: "XTAL_P", supply: "VANA", type: "Analog" },
    46: { name: "VDDA", supply: "VANA", type: "Power" },
    47: { name: "CAP2", supply: "VANA", type: "Analog" },
    48: { name: "CAP1", supply: "VANA", type: "Analog" },
  };
  for (const [k, info] of Object.entries(expected)) {
    const num = Number(k);
    if (!pins.has(num)) {
      pins.set(num, {
        number: num,
        name: info.name,
        type: info.type,
        supply: info.supply,
        resetAt: "",
        resetAfter: "",
        iomux: [],
        lpio: [],
        analog: [],
      });
    }
  }

  return Array.from(pins.values()).sort((a, b) => a.number - b.number);
}

/* ===================================================================== */
/*  Common chip extractor for S3/C3/C6/C5                                 */
/* ===================================================================== */
function extractCommon(chipId, expectedCount, opts = {}) {
  const text = readWhole(path.join(DATA_DIR, chipId + ".txt"));

  // 1. Pin Overview: collect ALL rows in the file that look like:
  //    "<num> <NAME> <type> [<supply>] [<resetAt>] [<resetAfter>] ..."
  //    where <type> is IO/Power/Analog/Power/IO. This works regardless of
  //    whether the table is markdown or plain text and avoids fragile
  //    region cropping.
  const overviewMap = parsePinOverviewWholeFile(text, expectedCount);

  const pinNumbers = new Set();
  for (let n = 1; n <= expectedCount; n++) pinNumbers.add(n);
  for (const [k] of overviewMap) pinNumbers.add(k);

  // 2. IO MUX Functions table (label varies between chips)
  const ioRegion = (() => {
    for (const heading of [
      "Table 2-4. QFN40 IO MUX Pin Functions",
      "Table 2-4. QFN56 IO MUX Pin Functions",
      "Table 2-4. IO MUX Pin Functions",
      "Table 2-4. IO MUX Functions",
      "Table 2-3. IO MUX Functions",
      "Table 2-3. IO MUX Pin Functions",
      "Table 2-2. IO MUX Functions",
    ]) {
      const r = crop(
        text,
        heading,
        /\n?\s*1\s*\.?\s*Bold marks/,
        /\n?\s*1\s+Bold marks/,
        /Table\s+2-[5-9]/,
        /Table\s+2-\d{2}/
      );
      if (r && r.length > heading.length + 30) return r;
    }
    return null;
  })();
  const iomuxMap = ioRegion ? parseIomuxRows(ioRegion, pinNumbers) : new Map();

  // 3. LP IO MUX (only present on C6 / C5 / P4)
  const lpRegion = crop(
    text,
    "Table 2-7. LP IO MUX Functions",
    /\n?\s*1\s*\.?\s*Bold marks/,
    /\n?\s*1\s+Bold marks/,
    /Table\s+2-/
  );
  const lpioMap = lpRegion ? parseLpioRows(lpRegion, pinNumbers) : new Map();

  // 4. Analog Functions
  const analogRegion = (() => {
    for (const heading of [
      "Table 2-9. Analog Functions",
      "Table 2-8. Analog Functions",
      "Table 2-6. Analog Functions",
    ]) {
      const r = crop(
        text,
        heading,
        /\n?\s*1\s*\.?\s*Bold marks/,
        /\n?\s*1\s+Bold marks/,
        /Table\s+2-/
      );
      if (r && r.length > heading.length + 30) return { region: r, heading };
    }
    return null;
  })();
  const analogMap = analogRegion
    ? parseAnalogRows(analogRegion.region, pinNumbers, opts.twoColumnAnalog)
    : new Map();

  const pins = [];
  for (let n = 1; n <= expectedCount; n++) {
    const ov = overviewMap.get(n);
    if (!ov) {
      pins.push({
        number: n,
        name: "?",
        type: "",
        supply: "",
        resetAt: "",
        resetAfter: "",
        iomux: [],
        lpio: [],
        analog: [],
      });
      continue;
    }
    pins.push({
      number: ov.number,
      name: ov.name,
      type: ov.type,
      supply: ov.supply,
      resetAt: ov.resetAt,
      resetAfter: ov.resetAfter,
      iomux: iomuxMap.get(n) || [],
      lpio: lpioMap.get(n) || [],
      analog: analogMap.get(n) || [],
    });
  }
  return pins;
}

/* ===================================================================== */
/*  Driver                                                                */
/* ===================================================================== */

const CHIP_META = {
  esp32: {
    name: "ESP32",
    expected: 48,
    extract: extractEsp32,
  },
  "esp32-s3": {
    name: "ESP32-S3",
    expected: 57,
    extract: () => extractCommon("esp32-s3", 57),
  },
  "esp32-c3": {
    name: "ESP32-C3",
    expected: 33,
    extract: () => extractCommon("esp32-c3", 33),
  },
  "esp32-c6": {
    name: "ESP32-C6",
    expected: 41,
    extract: () => extractCommon("esp32-c6", 41, { twoColumnAnalog: true }),
  },
  "esp32-c5": {
    name: "ESP32-C5",
    expected: 41,
    extract: () => extractCommon("esp32-c5", 41),
  },
};

function emitJson(chipId, pins) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, chipId + ".json");
  fs.writeFileSync(file, JSON.stringify(pins, null, 2), "utf8");
  return file;
}

function summary(chipId, pins) {
  return {
    chipId,
    total: pins.length,
    named: pins.filter((p) => p.name && p.name !== "?").length,
    withIomux: pins.filter((p) => p.iomux.length > 0).length,
    withLpio: pins.filter((p) => p.lpio.length > 0).length,
    withAnalog: pins.filter((p) => p.analog.length > 0).length,
  };
}

const argv = process.argv.slice(2);
const targets = argv.length ? argv : CHIPS;

const summaries = [];
for (const chipId of targets) {
  const meta = CHIP_META[chipId];
  if (!meta) {
    console.error("Unknown chip:", chipId);
    continue;
  }
  console.log(`[${meta.name}] extracting...`);
  let pins;
  try {
    pins = meta.extract();
  } catch (err) {
    console.error("  FAILED:", err.message);
    continue;
  }
  const file = emitJson(chipId, pins);
  summaries.push(summary(chipId, pins));
  console.log(`  -> ${file}`);
}

console.log("\nSummary:");
console.table(summaries);

// Chain into the chips-data builder so a single command refreshes the
// JSON files actually consumed by the app.
console.log("\nBuilding chips-data/ JSON files...");
require("./build-chips-data.cjs");
