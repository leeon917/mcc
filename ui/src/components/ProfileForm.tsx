import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    if (!isEdit && !form.apiKey) return; // require key on create

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
        <CardTitle>{isEdit ? 'Edit Profile' : 'Add Profile'}</CardTitle>
        <CardDescription>
          {isEdit ? `Editing: ${editingProfile?.name}` : 'Configure a new profile'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Field id="name" label="Profile Name">
          <Input
            id="name"
            placeholder="e.g. prod"
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
          <Input
            id="apiKey"
            type="password"
            placeholder={isEdit ? '(unchanged if empty)' : 'sk-...'}
            value={form.apiKey}
            onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
          />
        </Field>
        <Field id="model" label="Default Model">
          <Input
            id="model"
            placeholder="e.g. deepseek-chat"
            value={form.model}
            onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
          />
        </Field>
        <Field id="protocol" label="Protocol">
          <select
            id="protocol"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={form.protocol}
            onChange={(e) =>
              setForm((f) => ({ ...f, protocol: e.target.value as 'anthropic' | 'openai' }))
            }
          >
            <option value="anthropic">Anthropic (direct)</option>
            <option value="openai">OpenAI-compatible (translation proxy)</option>
          </select>
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field id="opus" label="Opus">
            <Input
              id="opus"
              placeholder="Opus model"
              value={form.opus}
              onChange={(e) => setForm((f) => ({ ...f, opus: e.target.value }))}
            />
          </Field>
          <Field id="sonnet" label="Sonnet">
            <Input
              id="sonnet"
              placeholder="Sonnet model"
              value={form.sonnet}
              onChange={(e) => setForm((f) => ({ ...f, sonnet: e.target.value }))}
            />
          </Field>
          <Field id="haiku" label="Haiku">
            <Input
              id="haiku"
              placeholder="Haiku model"
              value={form.haiku}
              onChange={(e) => setForm((f) => ({ ...f, haiku: e.target.value }))}
            />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={handleSubmit}>
            {isEdit ? 'Update Profile' : 'Add Profile'}
          </Button>
          {isEdit && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
