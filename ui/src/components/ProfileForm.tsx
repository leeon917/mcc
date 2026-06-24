import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Ui } from '@/design/icons/Ui';
import type { Profile } from '@/lib/api';
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
  baseUrl: '',
  apiKey: '',
  model: '',
  protocol: 'anthropic',
  opus: '',
  sonnet: '',
  haiku: '',
};

export function ProfileForm({ editingProfile, onSubmit, onCancel }: ProfileFormProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [revealKey, setRevealKey] = useState(false);
  const t = strings.profileForm;

  useEffect(() => {
    if (editingProfile) {
      setForm({
        name: editingProfile.name,
        baseUrl: editingProfile.baseUrl,
        apiKey: '',
        model: editingProfile.model,
        protocol: editingProfile.protocol || 'anthropic',
        opus: editingProfile.opusModel || '',
        sonnet: editingProfile.sonnetModel || '',
        haiku: editingProfile.haikuModel || '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [editingProfile]);

  const isEdit = !!editingProfile;

  async function handleSubmit() {
    if (!form.name || !form.baseUrl || !form.model) return;
    if (!isEdit && !form.apiKey) return;

    await onSubmit({
      name: form.name,
      baseUrl: form.baseUrl,
      apiKey: form.apiKey || undefined,
      model: form.model,
      protocol: form.protocol,
      opusModel: form.opus || undefined,
      sonnetModel: form.sonnet || undefined,
      haikuModel: form.haiku || undefined,
    });

    if (!isEdit) setForm(EMPTY_FORM);
  }

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
            ? t.editDescription(editingProfile.name)
            : t.addDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field id="name" label={t.nameLabel}>
          <Input
            id="name"
            placeholder={t.namePlaceholder}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            disabled={isEdit}
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
              placeholder={isEdit ? t.apiKeyPlaceholderEdit : t.apiKeyPlaceholderAdd}
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              className="pr-10"
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

        <Field id="model" label={t.modelLabel}>
          <Input
            id="model"
            placeholder={t.modelPlaceholder}
            value={form.model}
            onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
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
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Field id="opus" label={t.opusLabel} compact>
              <Input
                id="opus"
                placeholder="opus"
                value={form.opus}
                onChange={(e) => setForm((f) => ({ ...f, opus: e.target.value }))}
              />
            </Field>
            <Field id="sonnet" label={t.sonnetLabel} compact>
              <Input
                id="sonnet"
                placeholder="sonnet"
                value={form.sonnet}
                onChange={(e) => setForm((f) => ({ ...f, sonnet: e.target.value }))}
              />
            </Field>
            <Field id="haiku" label={t.haikuLabel} compact>
              <Input
                id="haiku"
                placeholder="haiku"
                value={form.haiku}
                onChange={(e) => setForm((f) => ({ ...f, haiku: e.target.value }))}
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
  children,
  compact,
}: {
  id: string;
  label: string;
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
    </div>
  );
}

// Re-export the payload type for back-compat with any caller still
// importing it from this file. New callers should import from @/types/domain.
export type { ProfileFormPayload };
