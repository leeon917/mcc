import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { AllMcpServer, ExternalMcpServer } from '@/lib/api';
import { MCP_PROVIDER_REFS } from '@/lib/providers';
import { strings } from '@/lib/strings';

interface ExternalMcpPanelProps {
  externalMcpServers: ExternalMcpServer[];
  allMcpServers: AllMcpServer[];
  currentProfile: string;
  onAdd: (server: ExternalMcpServer) => Promise<void> | void;
  onRemove: (name: string) => void;
  onToggle: (name: string, enabled: boolean, instance: string) => void;
}

const DEFAULT_FORM = {
  name: '',
  displayName: '',
  description: '',
  command: 'uvx',
  args: 'minimax-coding-plan-mcp,-y',
  providerRef: 'minimax',
  enabledByDefault: false,
};

export function ExternalMcpPanel({
  externalMcpServers,
  allMcpServers,
  currentProfile,
  onAdd,
  onRemove,
  onToggle,
}: ExternalMcpPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const t = strings.externalMcp;

  async function submit() {
    if (!form.name || !form.command || !form.args) return;
    const server: ExternalMcpServer = {
      name: form.name,
      displayName: form.displayName || form.name,
      description: form.description,
      command: form.command,
      args: form.args.split(',').map((s) => s.trim()),
      envVars: form.providerRef
        ? { MINIMAX_API_KEY: `\${MCC_PROVIDER_KEY:${form.providerRef}}` }
        : {},
      enabledByDefault: form.enabledByDefault,
    };
    await onAdd(server);
    setForm(DEFAULT_FORM);
    setShowForm(false);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t.title}</CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
            {showForm ? t.cancelButton : t.addButton}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showForm && (
          <div className="mb-4 space-y-3 rounded-lg border p-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t.nameLabel}>
                <Input
                  placeholder={t.namePlaceholder}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </FormField>
              <FormField label={t.displayNameLabel}>
                <Input
                  placeholder={t.displayNamePlaceholder}
                  value={form.displayName}
                  onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                />
              </FormField>
            </div>
            <FormField label={t.descriptionLabel}>
              <Input
                placeholder={t.descriptionPlaceholder}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t.commandLabel}>
                <Input
                  placeholder={t.commandPlaceholder}
                  value={form.command}
                  onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))}
                />
              </FormField>
              <FormField label={t.argsLabel}>
                <Input
                  placeholder={t.argsPlaceholder}
                  value={form.args}
                  onChange={(e) => setForm((f) => ({ ...f, args: e.target.value }))}
                />
              </FormField>
            </div>
            <div className="flex items-center gap-4">
              <FormField label={t.providerRefLabel}>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.providerRef}
                  onChange={(e) => setForm((f) => ({ ...f, providerRef: e.target.value }))}
                >
                  {MCP_PROVIDER_REFS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                  <option value="">{t.providerRefNone}</option>
                </select>
              </FormField>
              <div className="flex items-center gap-2 pt-5">
                <Switch
                  checked={form.enabledByDefault}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, enabledByDefault: v }))}
                />
                <span className="text-xs">{t.enabledByDefault}</span>
              </div>
            </div>
            <Button className="w-full" onClick={submit}>
              {t.submit}
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {externalMcpServers.length === 0 && !showForm && (
            <p className="text-sm text-muted-foreground">{t.emptyState}</p>
          )}
          {externalMcpServers.map((server) => {
            const state = allMcpServers.find((s) => s.name === server.name);
            return (
              <div
                key={server.name}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div>
                  <p className="font-medium">{server.displayName}</p>
                  <p className="text-sm text-muted-foreground">{server.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {server.command} {server.args.join(' ')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {state && (
                    <span className="text-xs text-muted-foreground">
                      {state.enabled ? t.enabled : t.disabled}
                    </span>
                  )}
                  <Switch
                    checked={state?.enabled ?? false}
                    onCheckedChange={(checked) => onToggle(server.name, checked, currentProfile)}
                  />
                  <Button size="sm" variant="destructive" onClick={() => onRemove(server.name)}>
                    {t.deleteButton}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
