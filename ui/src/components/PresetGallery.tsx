import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetBody, SheetFooter, SheetHeader } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Ui } from '@/design/icons/Ui';
import { ProviderIcon } from '@/design/icons/ProviderIcon';
import {
  getProviderAccent,
  getProviderTint,
  type ProviderId,
} from '@/lib/providers';
import type { ProfilePreset } from '@/lib/api';
import type { Protocol, PresetInstallArgs } from '@/types/domain';
import { strings } from '@/lib/strings';

/**
 * Templates module — gallery of pre-baked provider profiles. Click a card,
 * fill an API key, get a working profile.
 */
interface Props {
  presets: ProfilePreset[];
  existingProfileNames: string[];
  /** Resolves true on success, false on rejection */
  onInstall: (args: PresetInstallArgs) => Promise<boolean>;
}

export function PresetGallery({ presets, existingProfileNames, onInstall }: Props) {
  const [query, setQuery] = useState('');
  const [activePreset, setActivePreset] = useState<ProfilePreset | null>(null);
  const t = strings.presets;

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
          <p className="section-kicker">{t.kickerLabel}</p>
          <h2 className="section-title">{t.title}</h2>
          <p className="section-sub max-w-lg">{t.description(presets.length)}</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Ui
            name="search"
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <Input
            placeholder={t.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </header>

      {featured.length > 0 && (
        <PresetGroup
          kicker={t.groupFeatured.kicker}
          title={t.groupFeatured.title}
          subtitle={t.groupFeatured.subtitle}
          presets={featured}
          onPick={setActivePreset}
        />
      )}
      {recommended.length > 0 && (
        <PresetGroup
          kicker={t.groupRecommended.kicker}
          title={t.groupRecommended.title}
          subtitle={t.groupRecommended.subtitle}
          presets={recommended}
          onPick={setActivePreset}
        />
      )}
      {alternative.length > 0 && (
        <PresetGroup
          kicker={t.groupAlternative.kicker}
          title={t.groupAlternative.title}
          subtitle={t.groupAlternative.subtitle}
          presets={alternative}
          onPick={setActivePreset}
        />
      )}

      {featured.length + recommended.length + alternative.length === 0 && (
        <div className="arcade-card-soft rounded-2xl p-10 text-center">
          <div className="font-pixel text-2xs uppercase tracking-widest text-ink-400">
            no_result.txt
          </div>
          <p className="mt-2 font-rounded text-lg text-ink-900">{t.emptyTitle}</p>
          <p className="mt-1 text-sm text-ink-400">{t.emptyHint}</p>
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
  const t = strings.presets;
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
            <span className="pixel-chip pixel-chip-success">{t.noKey}</span>
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
            {t.insertCoin}
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
  onInstall: (args: PresetInstallArgs) => Promise<boolean>;
}

function PresetInstallSheet({ preset, existingNames, onClose, onInstall }: InstallSheetProps) {
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [revealKey, setRevealKey] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const t = strings.install;

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
  const protocol: Protocol = inferProtocol(preset);

  async function submit() {
    if (!preset) return;
    if (!name.trim()) {
      setErr(t.errEmptyName);
      return;
    }
    if (existingNames.includes(name.trim())) {
      setErr(t.errNameTaken(name));
      return;
    }
    if (preset.requiresApiKey && !apiKey.trim()) {
      setErr(t.errMissingKey);
      return;
    }
    if (!baseUrl.trim()) {
      setErr(t.errEmptyBaseUrl);
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
      opusModel: preset.opusModel,
      sonnetModel: preset.sonnetModel,
      haikuModel: preset.haikuModel,
    });
    setInstalling(false);
    if (ok) onClose();
    else setErr(t.errInstallFailed);
  }

  return (
    <Sheet open={!!preset} onClose={onClose} label={t.sheetLabel(preset.name)}>
      <SheetHeader onClose={onClose} accent={accent}>
        <div className="flex items-center gap-3 pt-1">
          <div className="provider-halo" style={{ background: tint }}>
            <ProviderIcon id={preset.id as ProviderId} size={36} />
          </div>
          <div>
            <p className="font-pixel text-2xs uppercase tracking-widest text-ink-400">
              {t.titlePrefix}{preset.id}
            </p>
            <h3 className="font-rounded text-xl font-bold tracking-tight text-ink-900">
              {preset.name}
            </h3>
            <p className="mt-1 max-w-sm text-xs text-ink-400">{preset.description}</p>
          </div>
        </div>
      </SheetHeader>

      <SheetBody className="space-y-4">
        <FormRow label={t.nameLabel} hint={t.nameHint}>
          <Input
            value={name}
            autoFocus
            placeholder={preset.defaultProfileName}
            onChange={(e) => setName(e.target.value)}
          />
        </FormRow>

        <FormRow
          label={t.apiKeyLabel}
          hint={preset.requiresApiKey ? preset.apiKeyHint : t.apiKeyOptionalHint}
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
            <span className="mr-2">▸</span> {t.advancedSummary}
          </summary>
          <div className="mt-3 space-y-3">
            <FormRow label={t.baseUrlLabel}>
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
            </FormRow>
            <FormRow label={t.modelLabel}>
              <Input value={model} onChange={(e) => setModel(e.target.value)} />
            </FormRow>
            <div className="flex items-center gap-2 text-xs text-ink-400">
              <span className="pixel-chip pixel-chip-info">
                {protocol === 'openai' ? t.protocolOpenai : t.protocolAnthropic}
              </span>
              <span>{t.protocolHint}</span>
            </div>
          </div>
        </details>

        {err && (
          <div className="banner-error px-3 py-2 text-xs font-medium">{err}</div>
        )}
      </SheetBody>

      <SheetFooter>
        <Button variant="ghost" onClick={onClose} disabled={installing}>
          {t.cancel}
        </Button>
        <Button onClick={submit} disabled={installing}>
          <Ui name="rocket" size={14} />
          {installing ? t.installing : t.install}
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

function inferProtocol(preset: ProfilePreset): Protocol {
  // Anthropic-compatible endpoints terminate in /anthropic; everything else
  // (including OpenRouter, HuggingFace, DashScope OpenAI mode, llama.cpp,
  // BigModel /v4, Ollama local) goes through the translator proxy.
  const url = preset.baseUrl.toLowerCase();
  if (!url) return 'anthropic'; // anthropic direct (key only)
  if (url.includes('/anthropic')) return 'anthropic';
  if (url.includes('api.anthropic.com')) return 'anthropic';
  return 'openai';
}
