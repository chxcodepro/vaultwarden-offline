/**
 * 生成 Chrome 应用商店宣传图块。
 *
 * 商店要求：小型图块 440×280、顶部图块 1400×560，JPEG 或 **24 位 PNG（无 alpha）**。
 *
 * 管线：HTML → 无头 Chrome 截图（2 倍分辨率）→ sips 缩放到目标尺寸。
 * 页面背景不透明，Chrome 直接输出颜色类型 2（24 位 RGB）的 PNG，
 * sips 缩放也保持该类型——正好满足"无 alpha"的要求，无需额外转换。
 *
 * 为什么用浏览器渲染而不是像图标那样手写光栅：图块上有中英文字，
 * 自己实现字形排版不现实，而 Chrome 本来就在手边。
 *
 * 图标不重画一份，直接调用 lib/icon-art.mjs 的 renderIcon——
 * 宣传图与扩展图标必须是同一枚盾牌，各存一份几何迟早漂移。
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { THEMES, renderIcon } from "./lib/icon-art.mjs";

const OUT_DIR = resolve(import.meta.dirname, "../store/promo");

const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/** 渲染倍率。2 倍后再缩回，文字与盾牌边缘明显更干净。 */
const SCALE = 2;

// --- 视觉常量 --------------------------------------------------------------

const COBALT = "#0047AB";
const COBALT_LIGHT = "#0B57C4";
const COBALT_DARK = "#00337D";
const EMERALD = "#6EE7B7";

const FONT_STACK =
  '-apple-system, "SF Pro Display", "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", Arial, sans-serif';

/**
 * 盾牌 PNG（data URI）。
 *
 * 用 rounded:false 只画盾牌本体：圆角外框内是纯钴蓝，叠在渐变背景上会显出
 * 一块方形色斑；只留盾牌则边缘按 alpha 与任意背景干净合成。
 */
const SHIELD_DATA_URI = `data:image/png;base64,${renderIcon(640, THEMES.normal, {
  rounded: false,
}).toString("base64")}`;

// --- 图块定义 --------------------------------------------------------------

/** 页面骨架：统一背景与字体，各图块只提供内容。 */
function page(width, height, body, extraCss = "") {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: ${width}px;
    height: ${height}px;
    overflow: hidden;
  }
  body {
    font-family: ${FONT_STACK};
    /* 顶部偏亮的径向高光 + 整体钴蓝渐变：避免大面积纯色显得死板。 */
    background:
      radial-gradient(120% 90% at 22% 8%, ${COBALT_LIGHT} 0%, ${COBALT} 46%, ${COBALT_DARK} 100%);
    color: #fff;
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
  }
  .shield { display: block; }
  .wordmark {
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.05;
    white-space: nowrap;
  }
  .zh { font-weight: 600; letter-spacing: 0.01em; }
  .en {
    color: ${EMERALD};
    font-weight: 500;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }
${extraCss}
</style></head><body>${body}</body></html>`;
}

const TILES = [
  {
    name: "small-tile-440x280",
    width: 440,
    height: 280,
    html: () =>
      page(
        440,
        280,
        `<div class="wrap">
           <div class="top">
             <img class="shield" src="${SHIELD_DATA_URI}" alt="">
             <div class="titles">
               <div class="wordmark">Vaultwarden</div>
               <div class="wordmark">Offline</div>
             </div>
           </div>
           <div class="bottom">
             <div class="zh">完全离线的密码库</div>
             <div class="en">No account · No sync · Zero telemetry</div>
           </div>
         </div>`,
        `
  .wrap {
    height: 100%;
    padding: 0 34px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 24px;
  }
  .top { display: flex; align-items: center; gap: 14px; }
  /* 盾牌只占画布中段，容器给 116px 才得到约 82px 的视觉高度；
     负外边距抵掉画布上下的空白，让盾牌与字块真正对齐。 */
  .shield { width: 116px; height: 116px; margin: -16px 0 -16px -14px; }
  .wordmark { font-size: 31px; }
  .bottom { display: flex; flex-direction: column; gap: 8px; }
  .zh { font-size: 19px; }
  .en { font-size: 12.5px; }
`,
      ),
  },
  {
    name: "marquee-1400x560",
    width: 1400,
    height: 560,
    html: () =>
      page(
        1400,
        560,
        `<div class="wrap">
           <img class="shield" src="${SHIELD_DATA_URI}" alt="">
           <div class="col">
             <div class="wordmark">Vaultwarden Offline</div>
             <div class="zh">完全离线的密码库</div>
             <div class="en">No account · No sync · Zero telemetry</div>
             <div class="chips">
               <span class="chip">Bitwarden 格式互通</span>
               <span class="chip">AES-256 本地加密</span>
               <span class="chip">GPL-3.0 开源</span>
             </div>
           </div>
         </div>`,
        `
  /* 商店会在不同版位裁切顶部图块，内容留足安全边距并整体居中。 */
  .wrap {
    height: 100%;
    padding: 0 90px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 40px;
  }
  .shield { width: 330px; height: 330px; flex: none; margin: 0 -46px; }
  .col { display: flex; flex-direction: column; gap: 16px; }
  .wordmark { font-size: 76px; }
  .zh { font-size: 33px; color: rgba(255,255,255,.94); }
  .en { font-size: 21px; }
  .chips { display: flex; gap: 12px; margin-top: 14px; }
  .chip {
    font-size: 17px;
    font-weight: 500;
    padding: 9px 18px;
    border-radius: 999px;
    border: 1px solid rgba(110,231,183,.45);
    color: ${EMERALD};
    white-space: nowrap;
  }
`,
      ),
  },
];

// --- 渲染 ------------------------------------------------------------------

function renderTile(tile, workDir) {
  const htmlFile = join(workDir, `${tile.name}.html`);
  const pngFile = resolve(OUT_DIR, `${tile.name}.png`);

  writeFileSync(htmlFile, tile.html());

  execFileSync(
    CHROME,
    [
      "--headless",
      "--disable-gpu",
      "--hide-scrollbars",
      `--force-device-scale-factor=${String(SCALE)}`,
      `--window-size=${String(tile.width)},${String(tile.height)}`,
      // 给字体与布局留出结算时间，否则偶尔截到未完成排版的一帧。
      "--virtual-time-budget=3000",
      `--screenshot=${pngFile}`,
      `file://${htmlFile}`,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );

  // Chrome 按 2 倍出图，缩回目标尺寸。sips 的 -z 参数顺序是「高 宽」。
  execFileSync("sips", ["-z", String(tile.height), String(tile.width), pngFile], {
    stdio: ["ignore", "ignore", "pipe"],
  });

  return pngFile;
}

/** 校验产物确实是商店要求的 24 位无 alpha PNG。 */
function verify(file, tile) {
  const info = execFileSync(
    "sips",
    ["-g", "pixelWidth", "-g", "pixelHeight", "-g", "hasAlpha", file],
    { encoding: "utf8" },
  );

  const read = (key) => info.match(new RegExp(`${key}: (\\S+)`))?.[1];
  const width = Number(read("pixelWidth"));
  const height = Number(read("pixelHeight"));
  const hasAlpha = read("hasAlpha");

  const problems = [];
  if (width !== tile.width || height !== tile.height) {
    problems.push(`尺寸 ${String(width)}×${String(height)}，应为 ${String(tile.width)}×${String(tile.height)}`);
  }
  if (hasAlpha !== "no") {
    problems.push("含 alpha 通道，商店只接受 24 位无透明层的 PNG");
  }
  return problems;
}

// --- 主流程 ----------------------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true });
const workDir = mkdtempSync(join(tmpdir(), "vwo-promo-"));

try {
  const failures = [];

  for (const tile of TILES) {
    const file = renderTile(tile, workDir);
    const problems = verify(file, tile);

    if (problems.length > 0) {
      failures.push(`${tile.name}: ${problems.join("；")}`);
    } else {
      console.log(`✓ ${tile.name}.png  ${String(tile.width)}×${String(tile.height)}  24 位无 alpha`);
    }
  }

  if (failures.length > 0) {
    console.error(`\n✗ 产物不符合商店要求:\n  ${failures.join("\n  ")}`);
    process.exit(1);
  }

  console.log(`\n宣传图块 → store/promo/`);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
