// Renders the SVG app icons to PNG with headless Chromium (no SVG rasteriser needed).
// usage: node tools/render_icons.mjs   (from the repo root)
const { chromium } = await import('playwright').catch(() => import('/opt/node-tools/node_modules/playwright/index.mjs'));
import { readFileSync } from 'node:fs';

const jobs = [
  ['site/icons/icon.svg', 'site/icons/icon-512.png', 512, null],
  ['site/icons/icon.svg', 'site/icons/icon-192.png', 192, null],
  ['site/icons/maskable.svg', 'site/icons/maskable-512.png', 512, null],
  ['site/icons/maskable.svg', 'site/icons/apple-touch-icon.png', 180, '#0A2430'],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [src, out, size, bg] of jobs) {
  const svg = readFileSync(src, 'utf8');
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:${bg || 'transparent'}"><img style="display:block;width:${size}px;height:${size}px" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body></html>`,
  );
  await page.waitForLoadState('load');
  await page.screenshot({ path: out, omitBackground: !bg, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', out);
}
await browser.close();
