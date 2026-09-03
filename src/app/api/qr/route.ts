import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type QrVersionConfig = {
  version: number;
  size: number;
  dataCodewords: number;
  ecCodewords: number;
};

const qrConfigs: QrVersionConfig[] = [
  { version: 1, size: 21, dataCodewords: 19, ecCodewords: 7 },
  { version: 2, size: 25, dataCodewords: 34, ecCodewords: 10 },
  { version: 3, size: 29, dataCodewords: 55, ecCodewords: 15 },
  { version: 4, size: 33, dataCodewords: 80, ecCodewords: 20 },
  { version: 5, size: 37, dataCodewords: 108, ecCodewords: 26 },
];

const gfExp = new Array<number>(512);
const gfLog = new Array<number>(256);

function initializeGaloisField() {
  let value = 1;

  for (let index = 0; index < 255; index += 1) {
    gfExp[index] = value;
    gfLog[value] = index;
    value <<= 1;

    if (value & 0x100) {
      value ^= 0x11d;
    }
  }

  for (let index = 255; index < 512; index += 1) {
    gfExp[index] = gfExp[index - 255];
  }
}

initializeGaloisField();

function gfMultiply(left: number, right: number) {
  if (left === 0 || right === 0) {
    return 0;
  }

  return gfExp[gfLog[left] + gfLog[right]];
}

function makeGeneratorPolynomial(degree: number) {
  let polynomial = [1];

  for (let index = 0; index < degree; index += 1) {
    const next = new Array<number>(polynomial.length + 1).fill(0);

    polynomial.forEach((coefficient, coefficientIndex) => {
      next[coefficientIndex] ^= coefficient;
      next[coefficientIndex + 1] ^= gfMultiply(coefficient, gfExp[index]);
    });

    polynomial = next;
  }

  return polynomial;
}

function makeErrorCorrectionCodewords(data: number[], ecCodewords: number) {
  const generator = makeGeneratorPolynomial(ecCodewords);
  const result = new Array<number>(ecCodewords).fill(0);

  for (const byte of data) {
    const factor = byte ^ result[0];
    result.copyWithin(0, 1);
    result[result.length - 1] = 0;

    for (let index = 0; index < ecCodewords; index += 1) {
      result[index] ^= gfMultiply(generator[index + 1], factor);
    }
  }

  return result;
}

function pushBits(bits: number[], value: number, length: number) {
  for (let index = length - 1; index >= 0; index -= 1) {
    bits.push((value >>> index) & 1);
  }
}

function makeDataCodewords(bytes: Uint8Array, config: QrVersionConfig) {
  const bits: number[] = [];

  pushBits(bits, 0b0100, 4);
  pushBits(bits, bytes.length, 8);

  for (const byte of bytes) {
    pushBits(bits, byte, 8);
  }

  const capacityBits = config.dataCodewords * 8;
  const terminatorLength = Math.min(4, capacityBits - bits.length);

  pushBits(bits, 0, terminatorLength);

  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const codewords: number[] = [];

  for (let index = 0; index < bits.length; index += 8) {
    let codeword = 0;

    for (let offset = 0; offset < 8; offset += 1) {
      codeword = (codeword << 1) | bits[index + offset];
    }

    codewords.push(codeword);
  }

  for (let padIndex = 0; codewords.length < config.dataCodewords; padIndex += 1) {
    codewords.push(padIndex % 2 === 0 ? 0xec : 0x11);
  }

  return codewords;
}

function chooseConfig(bytesLength: number) {
  return qrConfigs.find((config) => bytesLength <= config.dataCodewords - 2) ?? null;
}

function makeMatrix(size: number, defaultValue = false) {
  return Array.from({ length: size }, () => new Array<boolean>(size).fill(defaultValue));
}

function makeFormatBits() {
  const errorCorrectionLow = 0b01;
  const mask = 0;
  const data = (errorCorrectionLow << 3) | mask;
  let bits = data << 10;

  for (let index = 14; index >= 10; index -= 1) {
    if (((bits >>> index) & 1) !== 0) {
      bits ^= 0x537 << (index - 10);
    }
  }

  return ((data << 10) | (bits & 0x3ff)) ^ 0x5412;
}

function drawFormatBits(size: number, modules: boolean[][], isFunction: boolean[][]) {
  const bits = makeFormatBits();

  function set(x: number, y: number, isDark: boolean) {
    modules[y][x] = isDark;
    isFunction[y][x] = true;
  }

  for (let index = 0; index < 15; index += 1) {
    const isDark = ((bits >>> index) & 1) === 1;

    if (index < 6) {
      set(8, index, isDark);
    } else if (index < 8) {
      set(8, index + 1, isDark);
    } else {
      set(14 - index, 8, isDark);
    }

    if (index < 8) {
      set(size - 1 - index, 8, isDark);
    } else {
      set(8, size - 15 + index, isDark);
    }
  }
}

function makeQrMatrix(value: string) {
  const bytes = new TextEncoder().encode(value);
  const config = chooseConfig(bytes.length);

  if (!config) {
    return null;
  }

  const qrConfig = config;
  const modules = makeMatrix(qrConfig.size);
  const isFunction = makeMatrix(qrConfig.size);

  function setFunctionModule(x: number, y: number, isDark: boolean) {
    if (x < 0 || y < 0 || x >= qrConfig.size || y >= qrConfig.size) {
      return;
    }

    modules[y][x] = isDark;
    isFunction[y][x] = true;
  }

  function drawFinderPattern(x: number, y: number) {
    for (let dy = -1; dy <= 7; dy += 1) {
      for (let dx = -1; dx <= 7; dx += 1) {
        const distanceX = Math.abs(dx - 3);
        const distanceY = Math.abs(dy - 3);
        const isDark = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6 && Math.max(distanceX, distanceY) !== 2;

        setFunctionModule(x + dx, y + dy, isDark);
      }
    }
  }

  function drawAlignmentPattern(centerX: number, centerY: number) {
    if (isFunction[centerY]?.[centerX]) {
      return;
    }

    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        setFunctionModule(centerX + dx, centerY + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  drawFinderPattern(0, 0);
  drawFinderPattern(qrConfig.size - 7, 0);
  drawFinderPattern(0, qrConfig.size - 7);

  if (qrConfig.version > 1) {
    const center = qrConfig.size - 7;

    drawAlignmentPattern(center, center);
  }

  for (let index = 8; index < qrConfig.size - 8; index += 1) {
    setFunctionModule(6, index, index % 2 === 0);
    setFunctionModule(index, 6, index % 2 === 0);
  }

  setFunctionModule(8, qrConfig.size - 8, true);

  for (let index = 0; index < 9; index += 1) {
    if (index !== 6) {
      setFunctionModule(8, index, false);
      setFunctionModule(index, 8, false);
    }
  }

  for (let index = 0; index < 8; index += 1) {
    setFunctionModule(qrConfig.size - 1 - index, 8, false);
    setFunctionModule(8, qrConfig.size - 1 - index, false);
  }

  const dataCodewords = makeDataCodewords(bytes, qrConfig);
  const allCodewords = [...dataCodewords, ...makeErrorCorrectionCodewords(dataCodewords, qrConfig.ecCodewords)];
  const dataBits: number[] = [];

  for (const codeword of allCodewords) {
    pushBits(dataBits, codeword, 8);
  }

  let bitIndex = 0;
  let upward = true;

  for (let right = qrConfig.size - 1; right >= 1; right -= 2) {
    if (right === 6) {
      right -= 1;
    }

    for (let vertical = 0; vertical < qrConfig.size; vertical += 1) {
      const y = upward ? qrConfig.size - 1 - vertical : vertical;

      for (let columnOffset = 0; columnOffset < 2; columnOffset += 1) {
        const x = right - columnOffset;

        if (isFunction[y][x]) {
          continue;
        }

        let isDark = bitIndex < dataBits.length ? dataBits[bitIndex] === 1 : false;

        if ((x + y) % 2 === 0) {
          isDark = !isDark;
        }

        modules[y][x] = isDark;
        bitIndex += 1;
      }
    }

    upward = !upward;
  }

  drawFormatBits(qrConfig.size, modules, isFunction);

  return modules;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function makeQrSvg(value: string) {
  const matrix = makeQrMatrix(value);

  if (!matrix) {
    return null;
  }

  const quietZone = 4;
  const size = matrix.length + quietZone * 2;
  const darkModules: string[] = [];

  matrix.forEach((row, y) => {
    row.forEach((isDark, x) => {
      if (isDark) {
        darkModules.push(`<rect x="${x + quietZone}" y="${y + quietZone}" width="1" height="1"/>`);
      }
    });
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="${escapeXml(value)}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <g fill="#092046">
    ${darkModules.join("\n    ")}
  </g>
</svg>`;
}

function makeFilename(value: string) {
  return (
    value
      .replace(/^https?:\/\//, "")
      .replace(/[^a-zA-Z0-9-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "newsletter-qr"
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const value = url.searchParams.get("value")?.trim() || url.searchParams.get("url")?.trim() || "";

  if (!value) {
    return NextResponse.json({ ok: false, message: "QR로 만들 공개 URL이 필요합니다." }, { status: 400 });
  }

  const svg = makeQrSvg(value);

  if (!svg) {
    return NextResponse.json(
      { ok: false, message: "QR로 만들 URL이 너무 깁니다. 공개 주소를 더 짧게 조정하세요." },
      { status: 400 },
    );
  }

  return new Response(svg, {
    headers: {
      "Content-Disposition": `attachment; filename="${makeFilename(value)}.svg"`,
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
