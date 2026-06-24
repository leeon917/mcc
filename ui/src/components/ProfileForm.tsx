import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Ui } from '@/components/icons/Ui';
import type { Profile } from '@/lib/api';

export interface ProfileFormPayload {
  name: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  protocol: 'anthropic' | 'openai';
  opusModel?: string;
  sonnetModel?: string;
  haikuModel?: string;
}

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
  protocol: 'anthropic' | 'openai';
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
              Edit Profile
            </>
          ) : (
            <>
              <Ui name="plus" size={18} className="text-arcade-leaf" />
              Manual Add
            </>
          )}
        </CardTitle>
        <CardDescription>
          {isEdit
            ? `编辑 ${editingProfile?.name} —— API Key 留空则保持原值不变。`
            : '手动添加 — 大多数情况直接用 Templates 即可。'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field id="name" label="Profile 名称">
          <Input
            id="name"
            placeholder="prod / scratch / claude-coder…"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            disabled={isEdit}
          />
        </Field>

        <Field id="baseUrl" label="Base URL">
          <Input
            id="baseUrl"
            placeholder="https://api.deepseek.com/anthropic"
            value={form.baseUrl}
            onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
          />
        </Field>

        <Field id="apiKey" label="API Key">
          <div className="relative">
            <Input
              id="apiKey"
              type={revealKey ? 'text' : 'password'}
              placeholder={isEdit ? '(留空保持不变)' : 'sk-...'}
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
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
        </Field>

        <Field id="model" label="默认 Model">
          <Input
            id="model"
            placeholder="deepseek-v4-pro"
            value={form.model}
            onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
          />
        </Field>

        <Field id="protocol" label="Protocol">
          <ProtocolToggle
            value={form.protocol}
            onChange={(v) => setForm((f) => ({ ...f, protocol: v }))}
          />
        </Field>

        <details className="rounded-xl border border-paper-300 bg-paper-50 px-3 py-2.5 text-sm">
          <summary className="cursor-pointer select-none font-rounded font-semibold text-ink-900">
            <span className="mr-2">▸</span> 分层模型 (Opus / Sonnet / Haiku)
          </summary>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Field id="opus" label="Opus" compact>
              <Input
                id="opus"
                placeholder="opus"
                value={form.opus}
                onChange={(e) => setForm((f) => ({ ...f, opus: e.target.value }))}
              />
            </Field>
            <Field id="sonnet" label="Sonnet" compact>
              <Input
                id="sonnet"
                placeholder="sonnet"
                value={form.sonnet}
                onChange={(e) => setForm((f) => ({ ...f, sonnet: e.target.value }))}
              />
            </Field>
            <Field id="haiku" label="Haiku" compact>
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
            {isEdit ? '保存修改' : '添加 Profile'}
          </Button>
          {isEdit && (
            <Button variant="outline" onClick={onCancel}>
              取消
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
  value: 'anthropic' | 'openai';
  onChange: (v: 'anthropic' | 'openai') => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(['anthropic', 'openai'] as const).map((opt) => {
        const active = value === opt;
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
              <span className="font-rounded text-sm font-semibold text-ink-900">
                {opt === 'anthropic' ? 'Anthropic' : 'OpenAI'}
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-tight text-ink-400">
              {opt === 'anthropic'
                ? '直接命中 /v1/messages，0 中间层'
                : '本地 proxy 翻译为 Anthropic 协议'}
            </p>
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
