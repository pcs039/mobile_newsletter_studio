declare module "fontkit" {
  export function create(bytes: Uint8Array): {
    familyName: string;
    subfamilyName: string;
    fullName: string;
    version: string;
    numGlyphs: number;
    variationAxes: Record<string, unknown>;
    directory: { tables: Record<string, unknown> };
    "OS/2"?: { usWeightClass: number; fsSelection: { italic?: boolean } };
  };
}
