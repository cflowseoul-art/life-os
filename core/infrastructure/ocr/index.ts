/**
 * OCR adapter.
 *
 * Infrastructure, implementing the seam the Home capability already defined
 * (`Ocr = (input: string) => string`). The capability does not learn which
 * implementation it is talking to, and no domain code imports this file.
 *
 * Today: macOS Vision, offline, no key, no network. Swapping in a hosted OCR
 * means replacing this file and nothing else.
 *
 * Art. 9: OCR output is *evidence*, not truth. Whatever comes back is handed to
 * the parser unchanged — this module never corrects, completes, or guesses at a
 * blurry line, because an invented item would enter inventory as a fact.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BINARY = join(HERE, "vision-ocr");

export class OcrUnavailable extends Error {
  constructor() {
    super("이 컴퓨터에서 영수증 사진을 읽을 수 없습니다.");
    this.name = "OcrUnavailable";
  }
}

export class OcrFailed extends Error {
  constructor(detail: string) {
    super(`영수증 사진에서 글자를 읽지 못했습니다: ${detail}`);
    this.name = "OcrFailed";
  }
}

export function ocrAvailable(): boolean {
  return existsSync(BINARY);
}

/**
 * Reads text out of an image.
 *
 * Throws rather than returning empty: a caller that cannot tell "no text" from
 * "OCR is broken" would record an empty receipt as a real one.
 */
export function readImage(bytes: Buffer, extension = ".jpg"): string {
  if (!ocrAvailable()) throw new OcrUnavailable();

  const dir = mkdtempSync(join(tmpdir(), "life-os-ocr-"));
  const file = join(dir, `receipt${extension}`);

  try {
    writeFileSync(file, bytes);

    const text = execFileSync(BINARY, [file], {
      encoding: "utf8",
      timeout: 30_000,
      maxBuffer: 4 * 1024 * 1024,
    });

    if (text.trim() === "") throw new OcrFailed("읽어낸 글자가 없습니다");

    return text;
  } catch (error) {
    if (error instanceof OcrFailed) throw error;
    throw new OcrFailed(error instanceof Error ? error.message.split("\n")[0] : "알 수 없는 오류");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
