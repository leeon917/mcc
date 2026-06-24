import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Ui } from '@/design/icons/Ui';
import { getProfileKey, testProfile, type Profile } from '@/lib/api';
import type { Protocol, ProfileFormPayload } from '@/types/domain';
import { strings } from '@/lib/strings';

interface ProfileFormProps {
  /** Profile being edited; null = add mode. */
  editingProfile: Profile | null;
  onSubmit: (payload: ProfileFormPayload) => Promise<void> | void;
  onCancel: () => void;
}

interface FormState {
  name: string;
  displayName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  protocol: Protocol;
  opus: string;
  sonnet: string;
  haiku: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  displayName: '',
  baseUrl: '',
  apiKey: '',
  model: '',
  protocol: 'anthropic',
  opus: '',
  sonnet: '',
  haiku: '',
};

interface TestState {
  status: 'idle' | 'loading' | 'ok' | 'error';
  latencyMs?: number;
  error?: string;
  models: string[];
}

const INITIAL_TEST: TestState = { status: 'idle', models: [] };

export function ProfileForm({ editingProfile, onSubmit, onCancel }: ProfileFormProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [revealKey, setRevealKey] = useState(false);
  const [keyLoading, setKeyLoading] = useState(false);
  const [test, setTest] = useState<TestState>(INITIAL_TEST);
  const t = strings.profileForm;

  // Tracks the latest profile we requested a key for so that an in-flight
  // fetch (from a previous selection) can't overwrite the form for the
  // currently selected profile.
  const keyRequestId = useRef(0);

  useEffect(() => {
    setTest(INITIAL_TEST);
    setRevealKey(false);
    if (editingProfile) {
      setForm({
        name: editingProfile.name,
        displayName: editingProfile.displayName ?? '',
        baseUrl: editingProfile.baseUrl,
        apiKey: '',
        model: editingProfile.model,
        protocol: editingProfile.protocol || 'anthropic',
        opus: editingProfile.opusModel || '',
        sonnet: editingProfile.sonnetModel || '',
        haiku: editingProfile.haikuModel || '',
      });
      // Pre-fill the stored API key so the user can see (masked) what's saved
      // and choose to reveal/replace it. Dashboard is localhost-only.
      const reqId = ++keyRequestId.current;
      setKeyLoading(true);
      getProfileKey(editingProfile.name)
        .then((key) => {
          if (reqId === keyRequestId.current) {
            setForm((f) => ({ ...f, apiKey: key }));
          }
        })
        .catch(() => {
          // Profile may exist without a key (legacy state); leave field blank.
        })
        .finally(() => {
          if (reqId === keyRequestId.current) setKeyLoading(false);
        });
    } else {
      keyRequestId.current++;
      setKeyLoading(false);
      setForm(EMPTY_FORM);
    }
  }, [editingProfile]);

  const isEdit = !!editingProfile;

  async function handleSubmit() {
    if (!form.name || !form.baseUrl || !form.model) return;
    if (!isEdit && !form.apiKey) return;

    await onSubmit({
      name: form.name,
      displayName: form.displayName.trim() || undefined,
      baseUrl: form.baseUrl,
      apiKey: form.apiKey || undefined,
      model: form.model,
      protocol: form.protocol,
      opusModel: form.opus || undefined,
      sonnetModel: form.sonnet || undefined,
      haikuModel: form.haiku || undefined,
    });

    if (!isEdit) {
      setForm(EMPTY_FORM);
      setTest(INITIAL_TEST);
    }
  }

  async function handleTest() {
    if (!form.baseUrl || !form.apiKey) return;
    setTest((s) => ({ ...s, status: 'loading' }));
    try {
      const result = await testProfile({
        baseUrl: form.baseUrl,
        protocol: form.protocol,
        apiKey: form.apiKey,
        profileName: editingProfile?.name,
      });
      setTest({
        status: result.ok ? 'ok' : 'error',
        latencyMs: result.latencyMs,
        error: result.error,
        models: result.models,
      });
    } catch (e) {
      setTest({
        status: 'error',
        error: e instanceof Error ? e.message : 'request failed',
        models: [],
      });
    }
  }

  const canTest = !!form.baseUrl && !!form.apiKey && test.status !== 'loading';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isEdit ? (
            <>
              <Ui name="edit" size={18} className="text-arcade-sunshine" />
              {t.editTitle}
            </>
          ) : (
            <>
              <Ui name="plus" size={18} className="text-arcade-leaf" />
              {t.addTitle}
            </>
          )}
        </CardTitle>
        <CardDescription>
          {isEdit && editingProfile
            ? t.editDescription(editingProfile.displayName?.trim() || editingProfile.name)
            : t.addDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field id="name" label={t.nameLabel} hint={t.nameHint}>
          <Input
            id="name"
            placeholder={t.namePlaceholder}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            disabled={isEdit}
          />
        </Field>

        <Field id="displayName" label={t.displayNameLabel} hint={t.displayNameHint}>
          <Input
            id="displayName"
            placeholder={t.displayNamePlaceholder}
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
          />
        </Field>

        <Field id="baseUrl" label={t.baseUrlLabel}>
          <Input
            id="baseUrl"
            placeholder={t.baseUrlPlaceholder}
            value={form.baseUrl}
            onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
          />
        </Field>

        <Field id="apiKey" label={t.apiKeyLabel}>
          <div className="relative">
            <Input
              id="apiKey"
              type={revealKey ? 'text' : 'password'}
              placeholder={
                keyLoading
                  ? t.apiKeyLoading
                  : isEdit
                    ? t.apiKeyPlaceholderEdit
                    : t.apiKeyPlaceholderAdd
              }
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              className="pr-10"
              disabled={keyLoading}
            />
            <button
              type="button"
              onClick={() => setRevealKey((v) => !v)}
              aria-label={revealKey ? t.apiKeyHideAria : t.apiKeyShowAria}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-400 transition-colors hover:bg-paper-200 hover:text-ink-900"
            >
              <Ui name={revealKey ? 'eye-off' : 'eye'} size={14} />
            </button>
          </div>
        </Field>

        <TestPanel test={test} canTest={canTest} onTest={handleTest} />

        <Field id="model" label={t.modelLabel}>
          <ModelSelect
            id="model"
            value={form.model}
            models={test.models}
            placeholder={t.modelPlaceholder}
            onChange={(v) => setForm((f) => ({ ...f, model: v }))}
          />
        </Field>

        <Field id="protocol" label={t.protocolLabel}>
          <ProtocolToggle
            value={form.protocol}
            onChange={(v) => setForm((f) => ({ ...f, protocol: v }))}
          />
        </Field>

        <details className="rounded-xl border border-paper-300 bg-paper-50 px-3 py-2.5 text-sm">
          <summary className="cursor-pointer select-none font-rounded font-semibold text-ink-900">
            <span className="mr-2">▸</span> {t.tieredModelsSummary}
          </summary>
          <p className="mt-2 text-[11px] text-ink-400">{t.tieredModelsHint}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Field id="opus" label={t.opusLabel} compact>
              <ModelSelect
                id="opus"
                value={form.opus}
                models={test.models}
                placeholder="opus"
                onChange={(v) => setForm((f) => ({ ...f, opus: v }))}
              />
            </Field>
            <Field id="sonnet" label={t.sonnetLabel} compact>
              <ModelSelect
                id="sonnet"
                value={form.sonnet}
                models={test.models}
                placeholder="sonnet"
                onChange={(v) => setForm((f) => ({ ...f, sonnet: v }))}
              />
            </Field>
            <Field id="haiku" label={t.haikuLabel} compact>
              <ModelSelect
                id="haiku"
                value={form.haiku}
                models={test.models}
                placeholder="haiku"
                onChange={(v) => setForm((f) => ({ ...f, haiku: v }))}
              />
            </Field>
          </div>
        </details>

        <div className="flex gap-2 pt-2">
          <Button className="flex-1" onClick={handleSubmit}>
            <Ui name={isEdit ? 'check-bold' : 'plus'} size={14} />
            {isEdit ? t.submitEdit : t.submitAdd}
          </Button>
          {isEdit && (
            <Button variant="outline" onClick={onCancel}>
              {t.cancel}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface TestPanelProps {
  test: TestState;
  canTest: boolean;
  onTest: () => void;
}

function TestPanel({ test, canTest, onTest }: TestPanelProps) {
  const t = strings.profileForm;
  return (
    <div className="rounded-xl border border-paper-300 bg-paper-50 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onTest}
          disabled={!canTest}
          aria-label={t.testButton}
        >
          <Ui name="lightning" size={12} />
          {test.status === 'loading' ? t.testRunning : t.testButton}
        </Button>
        {test.status === 'ok' && test.latencyMs !== undefined && (
          <span className="pixel-chip pixel-chip-success">
            <Ui name="check-bold" size={9} />
            {t.testOk(test.latencyMs)}
          </span>
        )}
        {test.status === 'error' && (
          <span
            className="pixel-chip"
            style={{
              background: 'var(--paper-50)',
              borderColor: 'var(--arcade-hibiscus)',
              color: 'var(--arcade-hibiscus)',
            }}
          >
            <Ui name="x" size={9} />
            {t.testFail}
          </span>
        )}
        {test.status === 'idle' && !canTest && (
          <span className="text-[11px] text-ink-400">{t.testNeedKey}</span>
        )}
        {test.models.length > 0 && (
          <span className="text-[11px] text-ink-400">
            {t.modelPickerCount(test.models.length)} · {t.modelPickerHint}
          </span>
        )}
      </div>

      {test.status === 'error' && test.error && (
        <p className="mt-2 break-all text-[11px] text-arcade-hibiscus">{test.error}</p>
      )}
    </div>
  );
}

interface ModelSelectProps {
  id: string;
  value: string;
  models: string[];
  placeholder?: string;
  onChange: (v: string) => void;
}

/**
 * Free-text input plus an explicit dropdown trigger. We deliberately don't
 * use <datalist>: the browser filters its options to only matches of the
 * current value, which means once you pick "glm-5.2" the dropdown only ever
 * shows that one row again and you can't switch without manually clearing
 * the field. The custom panel below always shows the full fetched list.
 */
function ModelSelect({ id, value, models, placeholder, onChange }: ModelSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hasModels = models.length > 0;

  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocPointer);
    return () => document.removeEventListener('mousedown', onDocPointer);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={hasModels ? 'pr-8' : ''}
      />
      {hasModels && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Show models"
          aria-expanded={open}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-400 transition-colors hover:bg-paper-200 hover:text-ink-900"
        >
          <Ui name="chevron-down" size={12} />
        </button>
      )}
      {open && hasModels && (
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border-2 border-ink-900 bg-paper-50 shadow-pixel1">
          {models.map((m) => {
            const active = m === value;
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  onChange(m);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 border-b border-paper-300 px-3 py-1.5 text-left font-mono text-[11px] last:border-b-0 transition-colors ${
                  active ? 'bg-arcade-sunshine/30 text-ink-900' : 'text-ink-600 hover:bg-paper-200'
                }`}
              >
                <span className="truncate">{m}</span>
                {active && <Ui name="check-bold" size={10} className="shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProtocolToggle({
  value,
  onChange,
}: {
  value: Protocol;
  onChange: (v: Protocol) => void;
}) {
  const t = strings.profileForm;
  return (
    <div className="grid grid-cols-2 gap-2">
      {(['anthropic', 'openai'] as const).map((opt) => {
        const active = value === opt;
        const label = opt === 'anthropic' ? t.protocolAnthropicLabel : t.protocolOpenaiLabel;
        const hint = opt === 'anthropic' ? t.protocolAnthropicHint : t.protocolOpenaiHint;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded-xl border-2 p-2.5 text-left transition-all ${
              active
                ? 'border-ink-900 bg-arcade-lagoon/15 shadow-pixel1'
                : 'border-paper-300 bg-paper-50 hover:border-ink-400'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  active ? 'bg-arcade-lagoon' : 'bg-paper-400'
                }`}
              />
              <span className="font-rounded text-sm font-semibold text-ink-900">{label}</span>
            </div>
            <p className="mt-1 text-[11px] leading-tight text-ink-400">{hint}</p>
          </button>
        );
      })}
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  children,
  compact,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      <Label
        htmlFor={id}
        className="font-pixel text-2xs uppercase tracking-widest text-ink-600"
      >
        {label}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-ink-400">{hint}</p>}
    </div>
  );
}

// Re-export the payload type for back-compat with any caller still
// importing it from this file. New callers should import from @/types/domain.
export type { ProfileFormPayload };
