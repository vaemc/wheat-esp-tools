declare module "lv_font_conv/lib/convert.js" {
  type ConvertFiles = Record<string, string | Uint8Array | Buffer>;
  type ConvertFn = (args: Record<string, unknown>) => Promise<ConvertFiles>;
  const convert: ConvertFn;
  export default convert;
  export const formats: string[];
}
