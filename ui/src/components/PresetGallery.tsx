import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetBody, SheetFooter, SheetHeader } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Ui } from '@/components/icons/Ui';
import {
  ProviderIcon,
  getProviderAccent,
  getProviderTint,
  type ProviderId,
} from '@/components/icons/ProviderIcon';
import type { ProfilePreset } from '@/lib/api';

/**
 * Templates module — gallery of pre-baked provider profiles. Click a card,
 * fill an API key, get a working profile.
 */
interface Props {
  presets: ProfilePreset[];
  existingProfileNames: string[];
  /** Resolves true on success, false on rejection */
  onInstall: (args: {
    name: string;
    baseUrl: string;
    apiKey: string;
    model: string;
    protocol: 'anthropic' | 'openai';
  }) => Promise<boolean>;
}

export function PresetGallery({ presets, existingProfileNames, onInstall }: Props) {
  const [query, setQuery] = useState('');
  const [activePreset, setActivePreset] = useState<ProfilePreset | null>(null);

  const { featured, recommended, alternative } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? presets.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.id.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.baseUrl.toLowerCase().includes(q)
        )
      : presets;
    return {
      featured: filtered.filter((p) => p.featured),
      recommended: filtered.filter((p) => !p.featured && p.category === 'recommended'),
      alternative: filtered.filter((p) => p.category === 'alternative'),
    };
  }, [presets, query]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <p className="section-kicker">▸ Templates</p>
          <h2 className="section-title">挑一个 Provider，开打。</h2>
          <p className="section-sub max-w-lg">
            预置 {presets.length} 家国内外大模型 Provider —— 阿里通义、DeepSeek、Kimi、智谱、MiniMax、
            小米 MiMo、OpenRouter… 选一个、填 Key、就能在 Claude Code 里跑。
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Ui
            name="search"
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <Input
            placeholder="搜索 provider / 模型…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </header>

      {featured.length > 0 && (
        <PresetGroup
          kicker="★ Featured"
          title="主推 Provider"
          subtitle="覆盖了大多数日常需求 — 直接选这几个就好。"
          presets={featured}
          onPick={setActivePreset}
        />
      )}
      {recommended.length > 0 && (
        <PresetGroup
          kicker="◆ Recommended"
          title="推荐选项"
          subtitle="经过实战检验的稳定 Provider。"
          presets={recommended}
          onPick={setActivePreset}
        />
      )}
      {alternative.length > 0 && (
        <PresetGroup
          kicker="▢ Alternative"
          title="其他可选"
          subtitle="国内域名 / 特殊用例 / 实验性后端。"
          presets={alternative}
          onPick={setActivePreset}
        />
      )}

      {featured.length + recommended.length + alternative.length === 0 && (
        <div className="arcade-card-soft rounded-2xl p-10 text-center">
          <div className="font-pixel text-2xs uppercase tracking-widest text-ink-400">
            no_result.txt
          </div>
          <p className="mt-2 font-rounded text-lg text-ink-900">没有匹配的 Provider</p>
          <p className="mt-1 text-sm text-ink-400">试试别的关键词，或者直接在 Profiles 里手动添加。</p>
        </div>
      )}

      <PresetInstallSheet
        preset={activePreset}
        existingNames={existingProfileNames}
        onClose={() => setActivePreset(null)}
        onInstall={onInstall}
      />
    </div>
  );
}

interface GroupProps {
  kicker: string;
  title: string;
  subtitle: string;
  presets: ProfilePreset[];
  onPick: (p: ProfilePreset) => void;
}

function PresetGroup({ kicker, title, subtitle, presets, onPick }: GroupProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline gap-3">
        <p className="section-kicker">{kicker}</p>
        <h3 className="font-rounded text-lg font-bold tracking-tight text-ink-900">{title}</h3>
        <span className="text-xs text-ink-400">— {subtitle}</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {presets.map((p) => (
          <PresetCard key={p.id} preset={p} onPick={() => onPick(p)} />
        ))}
      </div>
    </section>
  );
}

interface CardProps {
  preset: ProfilePreset;
  onPick: () => void;
}

function PresetCard({ preset, onPick }: CardProps) {
  const accent = getProviderAccent(preset.id as ProviderId);
  const tint = getProviderTint(preset.id as ProviderId);

  return (
    <button
      type="button"
      onClick={onPick}
      className="arcade-card arcade-card-press group relative flex h-full flex-col items-stretch overflow-hidden p-0 text-left"
    >
      {/* color stripe at top */}
      <div className="relative h-14 w-full" style={{ background: tint }}>
        <div
          className="absolute inset-x-0 bottom-0 h-1.5"
          style={{ background: accent }}
          aria-hidden
        />
        <div className="absolute right-3 top-3 flex gap-1.5">
          {preset.badge && (
            <span
              className="pixel-chip"
              style={{
                background: 'var(--paper-50)',
                borderColor: 'var(--ink-900)',
                color: 'var(--ink-900)',
              }}
            >
              {preset.badge}
            </span>
          )}
        </div>
        <div className="absolute -bottom-5 left-4 provider-halo">
          <ProviderIcon id={preset.id as ProviderId} size={36} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4 pt-7">
        <div className="flex items-center gap-2">
          <h4 className="font-rounded text-base font-bold tracking-tight text-ink-900">
            {preset.name}
          </h4>
          {!preset.requiresApiKey && (
            <span className="pixel-chip pixel-chip-success">No Key</span>
          )}
        </div>
        <p className="line-clamp-2 text-xs text-ink-400">{preset.description}</p>

        <dl className="mt-1 space-y-1 text-[11px]">
          <Row label="model" value={preset.defaultModel} />
          {preset.baseUrl && <Row label="host" value={shortenHost(preset.baseUrl)} mono />}
        </dl>

        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="font-pixel text-2xs uppercase tracking-widest text-ink-400">
            {preset.id}
          </span>
          <span
            className="inline-flex items-center gap-1 font-rounded text-xs font-semibold text-ink-900 transition-transform group-hover:translate-x-0.5"
            style={{ color: accent }}
          >
            Insert coin
            <Ui name="arrow-right" size={12} />
          </span>
        </div>
      </div>
    </button>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="w-12 shrink-0 text-right font-pixel text-2xs uppercase tracking-widest text-ink-400">
        {label}
      </dt>
      <dd className={`truncate ${mono ? 'code-mono text-[11px]' : 'text-ink-600'}`}>{value}</dd>
    </div>
  );
}

function shortenHost(url: string): string {
  try {
    const u = new URL(url);
    return u.host + (u.pathname && u.pathname !== '/' ? u.pathname.replace(/\/$/, '') : '');
  } catch {
    return url.replace(/^https?:\/\//, '');
  }
}

/* ── Install Sheet ────────────────────────────────────────────────────── */

interface InstallSheetProps {
  preset: ProfilePreset | null;
  existingNames: string[];
  onClose: () => void;
  onInstall: (args: {
    name: string;
    baseUrl: string;
    apiKey: string;
    model: string;
    protocol: 'anthropic' | 'openai';
  }) => Promise<boolean>;
}

function PresetInstallSheet({ preset, existingNames, onClose, onInstall }: InstallSheetProps) {
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [revealKey, setRevealKey] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Reset state whenever a new preset is opened
  useEffect(() => {
    if (preset) {
      const candidate = uniqueName(preset.defaultProfileName, existingNames);
      setName(candidate);
      setApiKey('');
      setModel(preset.defaultModel);
      setBaseUrl(preset.baseUrl);
      setErr(null);
      setRevealKey(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  if (!preset) return null;

  const accent = getProviderAccent(preset.id as ProviderId);
  const tint = getProviderTint(preset.id as ProviderId);
  const protocol: 'anthropic' | 'openai' = inferProtocol(preset);

  async function submit() {
    if (!preset) return;
    if (!name.trim()) {
      setErr('Profile 名称不能为空');
      return;
    }
    if (existingNames.includes(name.trim())) {
      setErr(`Profile "${name}" 已存在，请换个名字`);
      return;
    }
    if (preset.requiresApiKey && !apiKey.trim()) {
      setErr('这个 Provider 需要 API Key');
      return;
    }
    if (!baseUrl.trim()) {
      setErr('Base URL 不能为空');
      return;
    }
    setErr(null);
    setInstalling(true);
    const ok = await onInstall({
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim() || preset.apiKeyPlaceholder, // local-only Ollama uses placeholder
      model: model.trim() || preset.defaultModel,
      protocol,
    });
    setInstalling(false);
    if (ok) onClose();
    else setErr('安装失败，请稍后重试');
  }

  return (
    <Sheet open={!!preset} onClose={onClose} label={`Install ${preset.name}`}>
      <SheetHeader onClose={onClose} accent={accent}>
        <div className="flex items-center gap-3 pt-1">
          <div className="provider-halo" style={{ background: tint }}>
            <ProviderIcon id={preset.id as ProviderId} size={36} />
          </div>
          <div>
            <p className="font-pixel text-2xs uppercase tracking-widest text-ink-400">
              install · {preset.id}
            </p>
            <h3 className="font-rounded text-xl font-bold tracking-tight text-ink-900">
              {preset.name}
            </h3>
            <p className="mt-1 max-w-sm text-xs text-ink-400">{preset.description}</p>
          </div>
        </div>
      </SheetHeader>

      <SheetBody className="space-y-4">
        <FormRow label="Profile 名称" hint="登录命令里使用的别名：mcc <name>">
          <Input
            value={name}
            autoFocus
            placeholder={preset.defaultProfileName}
            onChange={(e) => setName(e.target.value)}
          />
        </FormRow>

        <FormRow
          label="API Key"
          hint={preset.requiresApiKey ? preset.apiKeyHint : '本地 / 无需 Key — 留空即可'}
        >
          <div className="relative">
            <Input
              type={revealKey ? 'text' : 'password'}
              placeholder={preset.apiKeyPlaceholder}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setRevealKey((v) => !v)}
              aria-label={revealKey ? 'Hide key' : 'Show key'}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-400 transition-colors hover:bg-paper-200 hover:text-ink-900"
            >
              <Ui name={revealKey ? 'eye-off' : 'eye'} size={14} />
            </button>
          </div>
        </FormRow>

        <details className="rounded-xl border border-paper-300 bg-paper-50 px-3 py-2.5 text-sm">
          <summary className="cursor-pointer select-none font-rounded font-semibold text-ink-900">
            <span className="mr-2">▸</span> 高级 — 自定义 Base URL / 模型
          </summary>
          <div className="mt-3 space-y-3">
            <FormRow label="Base URL">
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
            </FormRow>
            <FormRow label="默认 Model">
              <Input value={model} onChange={(e) => setModel(e.target.value)} />
            </FormRow>
            <div className="flex items-center gap-2 text-xs text-ink-400">
              <span className="pixel-chip pixel-chip-info">
                {protocol === 'openai' ? 'OpenAI proxy' : 'Anthropic'}
              </span>
              <span>协议根据 base URL 自动判定</span>
            </div>
          </div>
        </details>

        {err && (
          <div className="banner-error px-3 py-2 text-xs font-medium">{err}</div>
        )}
      </SheetBody>

      <SheetFooter>
        <Button variant="ghost" onClick={onClose} disabled={installing}>
          取消
        </Button>
        <Button onClick={submit} disabled={installing}>
          <Ui name="rocket" size={14} />
          {installing ? '安装中…' : '安装 Profile'}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}

function FormRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="font-pixel text-2xs uppercase tracking-widest text-ink-600">
        {label}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-ink-400">{hint}</p>}
    </div>
  );
}

function uniqueName(base: string, existing: string[]): string {
  if (!existing.includes(base)) return base;
  let i = 2;
  while (existing.includes(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

function inferProtocol(preset: ProfilePreset): 'anthropic' | 'openai' {
  // Anthropic-compatible endpoints terminate in /anthropic; everything else
  // (including OpenRouter, HuggingFace, DashScope OpenAI mode, llama.cpp,
  // BigModel /v4, Ollama local) goes through the translator proxy.
  const url = preset.baseUrl.toLowerCase();
  if (!url) return 'anthropic'; // anthropic direct (key only)
  if (url.includes('/anthropic')) return 'anthropic';
  if (url.includes('api.anthropic.com')) return 'anthropic';
  return 'openai';
}
