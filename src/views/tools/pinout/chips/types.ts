/**
 * Multi-chip data model.
 * Each chip in the ESP32 family has its own package, pin count, and pinout.
 */

export interface PinFunction {
  /** F0 / F1 / F2 ... */
  f: string;
  /** Function name, e.g. "U0RXD", "GPIO12", "SPICLK" */
  name: string;
  /** Direction / type, e.g. "I/O/T", "I1", "O" */
  type: string;
}

/**
 * Strapping (boot-mode) information for a pin.
 *
 * Strapping pins are sampled by hardware right after a reset to choose the
 * boot mode, the VDD_SPI voltage, ROM-message verbosity, JTAG signal source,
 * etc.  Their state must be valid for ~tens of milliseconds after the
 * CHIP_PU rising edge — that's why these GPIOs need extra care when used
 * as regular IO.
 */
export interface PinStrapping {
  /** Default level latched at reset, when nothing else drives the pin. */
  default?: 0 | 1;
  /** Short Chinese description of what the pin selects at boot. */
  purpose: string;
}

export interface PinInfo {
  /** Physical pin number (1-based) */
  number: number;
  /** Primary pin name (e.g. "GPIO0", "VDD3P3", "GND") */
  name: string;
  /** Type, e.g. "IO", "Power", "Analog" */
  type: string;
  /** Power supply domain, e.g. "VDD3P3_RTC" */
  supply: string;
  /** Reset state at hardware reset, e.g. "IE, WPU" */
  resetAt: string;
  /** Reset state after release, e.g. "IE" */
  resetAfter: string;
  /** Per-function IO MUX entries (F0..Fn) */
  iomux: PinFunction[];
  /** Per-function LP IO MUX entries (low-power domain) */
  lpio: PinFunction[];
  /** Analog functions (ADC channel, USB_D+, XTAL, etc.) */
  analog: string[];
  /** Boot/strapping role, if any. Absent for normal IOs. */
  strapping?: PinStrapping;
}

export type PinSide = "left" | "bottom" | "right" | "top" | "center";

/**
 * QFN-style layout descriptor.
 *
 * Pin 1 sits in the top-left corner; numbering proceeds counter-clockwise.
 * `pinsPerSide` is total package pin count divided by 4.
 *
 * Some packages (like the ESP32-P4 QFN-104) also have a center thermal
 * GND pad — modeled as `centerPin` with pin number = pinsPerSide*4 + 1.
 */
export interface PackageLayout {
  type: "QFN";
  /** Total pin count exposed on the chip outline (excluding center pad). */
  pinCount: number;
  /** Number of pins on each side of the QFN package. */
  pinsPerSide: number;
  /** If non-null, an extra center-pad pin number (e.g. 105 for QFN-104). */
  centerPin: number | null;
  /** Compact name like "QFN-32", "QFN-40", "QFN-48", "QFN-56", "QFN-104". */
  packageName: string;
}

/**
 * One “version”/“revision” of a chip's pin overview.
 * Most chips have a single version; ESP32-P4 has v3.x and v1.x.
 * ESP32-C6 has QFN40 and QFN32 variants modeled as separate versions.
 */
export interface ChipVariant {
  /** Stable id, e.g. "default", "v3", "v1", "qfn40", "qfn32". */
  id: string;
  /** Human-readable label, e.g. "v3.x" or "QFN-40". */
  label: string;
  layout: PackageLayout;
  pins: PinInfo[];
}

export interface ChipDefinition {
  /** Stable id, e.g. "esp32", "esp32-s3", "esp32-c3" */
  id: string;
  /** Display name, e.g. "ESP32-S3" */
  name: string;
  /** Short marketing tagline */
  tagline: string;
  /** Architecture: "Xtensa LX6" / "Xtensa LX7" / "RISC-V" / "RISC-V + LP RISC-V" */
  cpu: string;
  /** Default variant id when chip is selected */
  defaultVariant: string;
  variants: ChipVariant[];
  /** Link to official datasheet (or null) */
  datasheetUrl: string;
  /** True if pin overview is fully verified against the datasheet */
  verified: boolean;
  /** Optional notes shown in the detail panel */
  notes?: string;
  /** Lower numbers come first in the chip picker. Default: 100. */
  displayOrder?: number;
}
