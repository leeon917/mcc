/**
 * Pixel-art provider logos. Each is hand-authored on a 32×32 implied grid,
 * uses the provider brand color, and renders with shape-rendering: crispEdges
 * so the blocky character holds at any scale. Trademark-respectful stylizations
 * (not pixel reproductions of the official wordmark).
 *
 * Adding a new provider:
 *   1. Add a key in PROVIDER_SPRITES with `accent` (brand color) and `body` JSX
 *      built from <rect x y width height>.
 *   2. The catalog id is the lookup key — set in provider-preset-catalog.ts.
 */
import type { SVGProps } from 'react';

export type ProviderId =
  | 'openrouter'
  | 'alibaba-coding-plan'
  | 'huggingface'
  | 'ollama'
  | 'llamacpp'
  | 'anthropic'
  | 'glm'
  | 'km'
  | 'foundry'
  | 'mm'
  | 'deepseek'
  | 'qwen'
  | 'xiaomi-mimo'
  | 'ollama-cloud'
  | 'novita'
  | 'bigmodel'
  | 'generic';

interface Sprite {
  accent: string;
  bg: string;
  body: JSX.Element;
}

// Helper: P() turns coordinates into a fill="currentColor" rect grid more
// compact than typing out <rect> everywhere — values are space-separated
// "x,y,w,h" tuples.
function P(spec: string, fill: string) {
  return (
    <g fill={fill}>
      {spec
        .trim()
        .split(/\s+/)
        .map((tuple, i) => {
          const [x, y, w = '1', h = '1'] = tuple.split(',');
          return <rect key={i} x={x} y={y} width={w} height={h} />;
        })}
    </g>
  );
}

const INK = 'var(--ink-900)';
const WHITE = '#ffffff';

const PROVIDER_SPRITES: Record<ProviderId, Sprite> = {
  // ── Anthropic (official tone: terracotta on cream, simple "A" mark) ─────
  anthropic: {
    accent: '#d97706',
    bg: '#fbeed3',
    body: (
      <>
        {P(
          '14,4,4 12,5,2 16,5,2 10,7,2 18,7,2 8,9,2 20,9,2 6,11,2 22,11,2 5,13,3 21,13,3 4,15,4 20,15,4 4,17,4 20,17,4 4,19,4 20,19,4 6,21,16 4,23,2 22,23,2',
          '#d97706'
        )}
      </>
    ),
  },

  // ── DeepSeek (whale silhouette, deep blue) ──────────────────────────────
  deepseek: {
    accent: '#1e6bf1',
    bg: '#cfe1ff',
    body: (
      <>
        {P(
          '10,8,8 8,10,12 6,12,16 5,14,18 4,16,18 5,18,16 6,20,12 8,22,8 12,24,4',
          '#1e6bf1'
        )}
        {P('22,12,2 24,11,2 22,14,2', '#1e6bf1')}
        {P('14,12,2 17,12,2', WHITE)}
      </>
    ),
  },

  // ── Qwen (Alibaba purple Q-glyph) ───────────────────────────────────────
  qwen: {
    accent: '#615ced',
    bg: '#dad7ff',
    body: (
      <>
        {P(
          '10,6,12 8,8,2 22,8,2 6,10,2 24,10,2 6,12,2 24,12,2 6,14,2 24,14,2 6,16,2 24,16,2 6,18,2 22,18,2 8,20,2 18,20,4 10,22,10',
          '#615ced'
        )}
        {P('18,18,2 20,20,2 22,22,2 24,24,2 26,26,2', '#615ced')}
      </>
    ),
  },

  // ── Alibaba Coding Plan (alibaba orange "A" with terminal cursor) ──────
  'alibaba-coding-plan': {
    accent: '#ff6a00',
    bg: '#ffd6b0',
    body: (
      <>
        {P(
          '14,4,4 12,6,2 16,6,2 10,8,2 18,8,2 8,10,2 20,10,2 6,12,2 22,12,2 6,14,18 4,16,2 24,16,2 4,18,2 24,18,2 4,20,2 24,20,2',
          '#ff6a00'
        )}
        {P('8,24,12 12,26,4', INK)}
      </>
    ),
  },

  // ── Kimi (Moonshot crescent moon, midnight blue) ────────────────────────
  km: {
    accent: '#0b1f3a',
    bg: '#bcd0ec',
    body: (
      <>
        {P(
          '12,4,8 8,6,4 20,6,4 6,8,2 22,8,2 4,10,2 4,12,2 4,14,2 4,16,2 4,18,2 6,20,2 8,22,4 12,24,8',
          '#0b1f3a'
        )}
        {/* crescent cutout */}
        {P('12,8,8 10,10,8 8,12,8 8,14,8 8,16,8 10,18,8 12,20,8', '#bcd0ec')}
      </>
    ),
  },

  // ── GLM / Z.AI (lightning Z) ────────────────────────────────────────────
  glm: {
    accent: '#1b6dff',
    bg: '#c9dcff',
    body: (
      <>
        {P(
          '6,5,20 8,7,18 10,9,16 14,11,12 18,13,8 14,15,8 10,17,8 6,19,8 4,21,20 6,23,20',
          '#1b6dff'
        )}
      </>
    ),
  },

  // ── MiniMax (M monogram, magenta) ───────────────────────────────────────
  mm: {
    accent: '#e91e63',
    bg: '#fbc6d8',
    body: (
      <>
        {P(
          '4,6,4 24,6,4 4,8,4 8,8,2 22,8,2 24,8,4 4,10,4 10,10,2 20,10,2 24,10,4 4,12,4 12,12,2 18,12,2 24,12,4 4,14,4 14,14,4 24,14,4 4,16,4 24,16,4 4,18,4 24,18,4 4,20,4 24,20,4 4,22,4 24,22,4 4,24,4 24,24,4',
          '#e91e63'
        )}
      </>
    ),
  },

  // ── Xiaomi MiMo (orange Mi) ─────────────────────────────────────────────
  'xiaomi-mimo': {
    accent: '#ff6900',
    bg: '#ffd2ad',
    body: (
      <>
        {P(
          '5,7,4 13,7,2 23,7,4 5,9,4 11,9,4 19,9,4 23,9,4 5,11,4 9,11,2 13,11,2 19,11,2 23,11,4 5,13,4 23,13,4 5,15,4 23,15,4 5,17,4 23,17,4 5,19,4 23,19,4 5,21,4 23,21,4 5,23,4 23,23,4',
          '#ff6900'
        )}
        {P('13,11,2 13,13,2 13,15,2 13,17,2 13,19,2', '#ff6900')}
      </>
    ),
  },

  // ── OpenRouter (multi-color router rings) ───────────────────────────────
  openrouter: {
    accent: '#7a5af8',
    bg: '#dccff8',
    body: (
      <>
        {P('5,15,4 5,16,4 5,17,4', '#7a5af8')}
        {P('11,8,4 11,9,4 11,10,4', '#22c55e')}
        {P('11,22,4 11,23,4 11,24,4', '#f59e0b')}
        {P('17,15,4 17,16,4 17,17,4', '#ec4899')}
        {P('22,8,4 22,9,4 22,10,4', '#06b6d4')}
        {P('22,22,4 22,23,4 22,24,4', '#a855f7')}
        {/* lines */}
        {P('9,16,2 9,17,2', INK)}
        {P('15,9,2 15,10,2 15,11,2 15,12,2 15,13,2 15,14,2 15,15,2 15,16,2 15,17,2 15,18,2 15,19,2 15,20,2 15,21,2 15,22,2 15,23,2', INK)}
        {P('20,16,2 20,17,2', INK)}
      </>
    ),
  },

  // ── Ollama (llama silhouette, cream) ────────────────────────────────────
  ollama: {
    accent: '#1b1b1b',
    bg: '#f3eee3',
    body: (
      <>
        {P(
          '10,4,2 14,4,2 18,4,2 9,6,4 15,6,5 8,8,16 7,10,18 7,12,18 7,14,18 8,16,16 9,18,4 14,18,2 18,18,4 9,20,4 18,20,4 9,22,4 18,22,4 9,24,4 18,24,4',
          INK
        )}
        {P('11,10,2 19,10,2', WHITE)}
      </>
    ),
  },

  // ── llama.cpp (terminal box with llama) ─────────────────────────────────
  llamacpp: {
    accent: '#10b981',
    bg: '#c2efdf',
    body: (
      <>
        {P('4,6,24 4,8,2 26,8,2 4,10,2 26,10,2 4,12,2 26,12,2 4,14,2 26,14,2 4,16,2 26,16,2 4,18,2 26,18,2 4,20,2 26,20,2 4,22,2 26,22,2 4,24,24', INK)}
        {P('8,12,2 11,12,1 8,14,3 8,16,2 11,16,1 8,18,2', '#10b981')}
        {P('16,14,6 16,16,2 20,16,2 16,18,6', '#10b981')}
      </>
    ),
  },

  // ── HuggingFace (smiling yellow face) ───────────────────────────────────
  huggingface: {
    accent: '#facc15',
    bg: '#fde68a',
    body: (
      <>
        {P('10,4,12 8,6,2 22,6,2 6,8,2 24,8,2 4,10,2 26,10,2 4,12,2 26,12,2 4,14,2 26,14,2 4,16,2 26,16,2 4,18,2 26,18,2 6,20,2 24,20,2 8,22,2 22,22,2 10,24,12', '#facc15')}
        {P('10,12,2 20,12,2', INK)}
        {P('10,18,2 12,20,2 14,20,4 18,20,2 20,18,2', INK)}
      </>
    ),
  },

  // ── Azure Foundry (cloud + bolt) ────────────────────────────────────────
  foundry: {
    accent: '#0078d4',
    bg: '#c6e2f6',
    body: (
      <>
        {P('10,10,4 8,12,12 6,14,16 6,16,16 6,18,18 8,20,16', '#0078d4')}
        {P('16,8,4 14,10,2 18,12,4 14,14,6 18,16,2 14,18,4', '#facc15')}
      </>
    ),
  },

  // ── Novita (purple "N" gradient) ────────────────────────────────────────
  novita: {
    accent: '#6366f1',
    bg: '#d0d3ff',
    body: (
      <>
        {P('5,4,4 5,6,4 5,8,4 5,10,4 5,12,4 5,14,4 5,16,4 5,18,4 5,20,4 5,22,4 5,24,4', '#6366f1')}
        {P('23,4,4 23,6,4 23,8,4 23,10,4 23,12,4 23,14,4 23,16,4 23,18,4 23,20,4 23,22,4 23,24,4', '#6366f1')}
        {P('9,6,2 11,8,2 13,10,2 15,12,2 17,14,2 19,16,2 21,18,2 23,20,2', '#6366f1')}
      </>
    ),
  },

  // ── BigModel / Zhipu (cube with sparkle) ────────────────────────────────
  bigmodel: {
    accent: '#3b82f6',
    bg: '#bedaff',
    body: (
      <>
        {P('8,8,16 6,10,2 24,10,2 6,12,2 24,12,2 6,14,2 24,14,2 6,16,2 24,16,2 6,18,2 24,18,2 6,20,2 24,20,2 8,22,16', '#3b82f6')}
        {P('12,11,8 11,13,10 11,15,10 12,17,8', WHITE)}
        {P('14,5,4 13,7,2 17,7,2', '#facc15')}
      </>
    ),
  },

  // ── Ollama Cloud (cloud + dots) ─────────────────────────────────────────
  'ollama-cloud': {
    accent: '#0ea5e9',
    bg: '#bae6fd',
    body: (
      <>
        {P('10,10,4 8,12,2 14,12,8 6,14,2 14,14,8 6,16,18 6,18,20 8,20,18', '#0ea5e9')}
        {P('10,22,2 14,22,2 18,22,2 22,22,2', '#0ea5e9')}
      </>
    ),
  },

  // ── Fallback (paper square with star) ───────────────────────────────────
  generic: {
    accent: 'var(--arcade-tangerine)',
    bg: 'var(--arcade-tangerine-soft)',
    body: (
      <>
        {P('6,6,20 6,8,2 24,8,2 6,10,2 24,10,2 6,12,2 24,12,2 6,14,2 24,14,2 6,16,2 24,16,2 6,18,2 24,18,2 6,20,2 24,20,2 6,22,2 24,22,2 6,24,20', INK)}
        {P('14,10,4 12,14,8 12,16,8 14,18,4 13,20,6', 'var(--arcade-tangerine)')}
      </>
    ),
  },
};

// 'azure' / 'foundry' share visuals — azure not in catalog ids but keep for safety
PROVIDER_SPRITES.foundry.body = (
  <>
    {/* cloud */}
    {(() => {
      const blocks = [
        '10,8,2',
        '12,7,4',
        '16,7,4',
        '20,8,2',
        '8,9,4',
        '12,9,12',
        '20,9,4',
        '6,11,22',
        '4,13,24',
        '4,15,24',
        '4,17,24',
        '6,19,22',
        '8,21,18',
      ];
      return (
        <g fill="#0078d4">
          {blocks.map((s, i) => {
            const [x, y, w] = s.split(',');
            return <rect key={i} x={x} y={y} width={w} height="1" />;
          })}
        </g>
      );
    })()}
    {/* bolt */}
    <g fill="#facc15">
      <rect x="14" y="12" width="3" height="2" />
      <rect x="13" y="14" width="3" height="2" />
      <rect x="12" y="16" width="6" height="2" />
      <rect x="14" y="18" width="3" height="2" />
      <rect x="15" y="20" width="2" height="2" />
    </g>
  </>
);

interface Props extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  id: ProviderId | string;
  size?: number;
  /** show the brand color tile background */
  withTile?: boolean;
}

export function ProviderIcon({ id, size = 32, withTile = false, className, style, ...rest }: Props) {
  const sprite = (PROVIDER_SPRITES as Record<string, Sprite>)[id] || PROVIDER_SPRITES.generic;
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={className}
      style={{ display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
      {...rest}
    >
      {withTile && <rect x="0" y="0" width="32" height="32" fill={sprite.bg} rx="3" />}
      {sprite.body}
    </svg>
  );
}

export function getProviderAccent(id: string): string {
  return ((PROVIDER_SPRITES as Record<string, Sprite>)[id] || PROVIDER_SPRITES.generic).accent;
}

export function getProviderTint(id: string): string {
  return ((PROVIDER_SPRITES as Record<string, Sprite>)[id] || PROVIDER_SPRITES.generic).bg;
}

/**
 * Map a baseUrl to a provider id (best-effort, used to badge existing
 * profiles whose preset origin isn't recorded).
 */
export function guessProviderId(baseUrl: string): ProviderId | 'generic' {
  const u = baseUrl.toLowerCase();
  if (!u) return 'anthropic';
  if (u.includes('openrouter')) return 'openrouter';
  if (u.includes('dashscope.aliyuncs') && u.includes('coding-intl')) return 'alibaba-coding-plan';
  if (u.includes('dashscope.aliyuncs')) return 'qwen';
  if (u.includes('huggingface')) return 'huggingface';
  if (u.includes('ollama.com')) return 'ollama-cloud';
  if (u.includes('localhost:11434') || u.includes('11434')) return 'ollama';
  if (u.includes(':8080')) return 'llamacpp';
  if (u.includes('anthropic.com') || u === '') return 'anthropic';
  if (u.includes('z.ai')) return 'glm';
  if (u.includes('kimi') || u.includes('moonshot')) return 'km';
  if (u.includes('azure')) return 'foundry';
  if (u.includes('minimaxi') || u.includes('minimax')) return 'mm';
  if (u.includes('deepseek')) return 'deepseek';
  if (u.includes('xiaomimimo') || u.includes('xiaomi')) return 'xiaomi-mimo';
  if (u.includes('novita')) return 'novita';
  if (u.includes('bigmodel')) return 'bigmodel';
  return 'generic';
}
