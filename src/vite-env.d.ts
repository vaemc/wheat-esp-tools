/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module "*.vrm?url" {
  const src: string;
  export default src;
}

/** Node moduleResolution 无法解析该包 exports.types，在此补声明 */
declare module "libopus-wasm" {
  export const Application: {
    readonly Voip: 2048;
    readonly Audio: 2049;
    readonly RestrictedLowDelay: 2051;
  };
  export type Application = (typeof Application)[keyof typeof Application];
  export type SampleRate = 8000 | 12000 | 16000 | 24000 | 48000;
  export type ChannelCount = 1 | 2;
  export type Bitrate = number | "auto" | "max";

  export type EncoderOptions = {
    channels?: ChannelCount;
    sampleRate?: SampleRate;
    application?: Application;
    bitrate?: Bitrate;
    complexity?: number;
    frameSize?: number;
    vbr?: boolean;
  };

  export type OpusEncoderHandle = {
    readonly frameSize: number;
    readonly sampleRate: SampleRate;
    readonly channels: ChannelCount;
    encode(pcm: Int16Array | Uint8Array): Uint8Array;
    encoderCtl(request: number, value: number): void;
    setBitrate(bitrate: Bitrate): void;
    getBitrate(): number;
    getLookahead(): number;
    free(): void;
  };

  export function createEncoder(
    options?: EncoderOptions
  ): Promise<OpusEncoderHandle>;
}
