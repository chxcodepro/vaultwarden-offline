/**
 * 生成扩展图标 PNG。
 *
 * 几何与配色在 lib/icon-art.mjs，本文件只负责按尺寸批量输出。
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { THEMES, renderIcon } from "./lib/icon-art.mjs";

const OUT_DIR = resolve(import.meta.dirname, "../public/images");

const SIZES = [16, 19, 32, 38, 48, 96, 128];
const LOCKED_SIZES = [19, 38];

mkdirSync(OUT_DIR, { recursive: true });

const written = [];

for (const size of SIZES) {
  const file = resolve(OUT_DIR, `icon${size}.png`);
  writeFileSync(file, renderIcon(size, THEMES.normal));
  written.push(`icon${size}.png`);
}

for (const size of LOCKED_SIZES) {
  const file = resolve(OUT_DIR, `icon${size}_locked.png`);
  writeFileSync(file, renderIcon(size, THEMES.locked));
  written.push(`icon${size}_locked.png`);
}

console.log(`✓ 已生成 ${written.length} 个图标 → public/images/`);
