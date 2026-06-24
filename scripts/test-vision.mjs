#!/usr/bin/env node
/**
 * test-vision.mjs — 真实识图自检
 *
 * 读取 ~/.mcc/mcp-config.json 里 imageAnalysis 的每个 provider，向其真实端点
 * 发送一张「四象限定色图」（左上红 / 右上绿 / 左下蓝 / 右下黄），要求模型按序
 * 报出四个颜色。模型必须真的「看见」图才能答对 —— 纯文本模型答不出确定的四色。
 *
 * 用法：
 *   node scripts/test-vision.mjs            # 测全部填了 key 的 provider
 *   node scripts/test-vision.mjs ali kimi   # 只测指定 provider
 *
 * 退出码：全部通过 0；有失败 1。
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import zlib from 'node:zlib';

const CONFIG = join(process.env.MCC_HOME ?? join(homedir(), '.mcc'), 'mcp-config.json');
const EXPECT = ['red', 'green', 'blue', 'yellow'];
const PROMPT =
  'This image is split into 4 equal quadrants. Name the dominant color of each in order: ' +
  'top-left, top-right, bottom-left, bottom-right. Answer with just 4 color words.';

/** 纯 Node 生成四象限测试 PNG，返回 base64（无外部依赖） */
function makeTestPngBase64() {
  const W = 240, H = 240;
  const color = (x, y) => {
    const top = y < H / 2, left = x < W / 2;
    if (top && left) return [220, 30, 30];     // red
    if (top && !left) return [30, 170, 40];     // green
    if (!top && left) return [40, 80, 220];     // blue
    return [240, 210, 30];                      // yellow
  };
  const raw = Buffer.alloc(H * (1 + W * 3));
  let p = 0;
  for (let y = 0; y < H; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < W; x++) { const [r, g, b] = color(x, y); raw[p++] = r; raw[p++] = g; raw[p++] = b; }
  }
  const crcTable = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2; // 8-bit, RGB
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png.toString('base64');
}

async function callOpenAI(base, key, model, b64) {
  const r = await fetch(base.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, max_tokens: 300,
      messages: [{ role: 'user', content: [
        { type: 'text', text: PROMPT },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
      ] }],
    }),
  });
  const j = await r.json().catch(() => ({}));
  const m = j?.choices?.[0]?.message ?? {};
  const text = m.content || m.reasoning_content || JSON.stringify(j.error ?? j).slice(0, 160);
  return { status: r.status, text };
}

async function callAnthropic(base, key, model, b64) {
  const r = await fetch(base.replace(/\/$/, '') + '/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, max_tokens: 300,
      messages: [{ role: 'user', content: [
        { type: 'text', text: PROMPT },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } },
      ] }],
    }),
  });
  const j = await r.json().catch(() => ({}));
  const text = (j?.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join(' ')
    || JSON.stringify(j.error ?? j).slice(0, 160);
  return { status: r.status, text };
}

async function main() {
  let cfg;
  try { cfg = JSON.parse(readFileSync(CONFIG, 'utf8')); }
  catch { console.error(`[!] 读不到配置: ${CONFIG}`); process.exit(2); }

  const providers = cfg.imageAnalysis?.providers ?? {};
  const want = process.argv.slice(2);
  const b64 = makeTestPngBase64();
  const activeId = Object.entries(providers).find(([, p]) => p.enabled && p.apiKey && p.baseUrl)?.[0];

  const ids = Object.keys(providers).filter((id) => (want.length ? want.includes(id) : true));
  console.log(`期望答案: red / green / blue / yellow`);
  console.log(`运行时生效(第一个 enabled): ${activeId ?? '(无)'}`);
  console.log('='.repeat(56));

  let failed = 0, tested = 0;
  for (const id of ids) {
    const p = providers[id];
    if (!p.apiKey || !p.baseUrl) { console.log(`[skip] ${id} — 未填 key`); continue; }
    tested++;
    const flag = id === activeId ? ' *ACTIVE*' : '';
    try {
      const { status, text } =
        p.format === 'anthropic'
          ? await callAnthropic(p.baseUrl, p.apiKey, p.model, b64)
          : await callOpenAI(p.baseUrl, p.apiKey, p.model, b64);
      const low = String(text).toLowerCase();
      const hits = EXPECT.filter((c) => low.includes(c));
      const pass = status === 200 && hits.length === 4;
      if (!pass) failed++;
      console.log(`[${pass ? 'PASS' : 'FAIL'}] ${id} (${p.model})${flag}  HTTP ${status}  命中 ${hits.length}/4`);
      console.log(`        → ${String(text).replace(/\s+/g, ' ').trim().slice(0, 120)}`);
    } catch (e) {
      failed++;
      console.log(`[FAIL] ${id} (${p.model})${flag}  ${e.message}`);
    }
  }
  console.log('='.repeat(56));
  console.log(`测试 ${tested} 个，失败 ${failed} 个。`);
  process.exit(failed ? 1 : 0);
}
main();
