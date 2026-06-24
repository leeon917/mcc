import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { McpConfig, ProviderPresets } from '@/lib/api';

interface WebSearchPanelProps {
  config: McpConfig;
  presets: ProviderPresets;
  onToggleSection: () => void;
  onToggleProvider: (id: string) => void;
  onUpdateField: (id: string, field: string, value: unknown) => void;
}

export function WebSearchPanel({
  config,
  presets,
  onToggleSection,
  onToggleProvider,
  onUpdateField,
}: WebSearchPanelProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>WebSearch</CardTitle>
            <CardDescription>Web 搜索提供商，按需启用一家或多家</CardDescription>
          </div>
          <Switch checked={config.websearch.enabled} onCheckedChange={onToggleSection} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Object.entries(presets.websearch).map(([id, preset]) => {
            const provider = config.websearch.providers[id];
            if (!provider) return null;
            return (
              <div key={id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{preset.name}</p>
                    <p className="text-xs text-muted-foreground">{preset.description}</p>
                  </div>
                  <Switch
                    checked={provider.enabled}
                    onCheckedChange={() => onToggleProvider(id)}
                    disabled={!config.websearch.enabled}
                  />
                </div>
                {preset.needsApiKey && provider.enabled && (
                  <div className="mt-3">
                    <Label className="text-xs">API Key</Label>
                    <Input
                      type="password"
                      placeholder="Enter API key..."
                      value={provider.apiKey || ''}
                      onChange={(e) => onUpdateField(id, 'apiKey', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
