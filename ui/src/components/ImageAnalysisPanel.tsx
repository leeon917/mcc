import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { McpConfig, ProviderPresets } from '@/lib/api';

interface ImageAnalysisPanelProps {
  config: McpConfig;
  presets: ProviderPresets;
  onToggleSection: () => void;
  onToggleProvider: (id: string) => void;
  onUpdateField: (id: string, field: string, value: unknown) => void;
}

export function ImageAnalysisPanel({
  config,
  presets,
  onToggleSection,
  onToggleProvider,
  onUpdateField,
}: ImageAnalysisPanelProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Image Analysis</CardTitle>
            <CardDescription>视觉模型 provider，第一个启用且填了 Key 的会被使用</CardDescription>
          </div>
          <Switch checked={config.imageAnalysis.enabled} onCheckedChange={onToggleSection} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(presets.imageAnalysis).map(([id, preset]) => {
            const provider = config.imageAnalysis.providers[id];
            if (!provider) return null;
            const datalistId = `ia-model-${id}`;
            return (
              <div key={id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{preset.name}</p>
                    <p className="text-xs text-muted-foreground">Format: {preset.format}</p>
                  </div>
                  <Switch
                    checked={provider.enabled}
                    onCheckedChange={() => onToggleProvider(id)}
                    disabled={!config.imageAnalysis.enabled}
                  />
                </div>
                {provider.enabled && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <Label className="text-xs">Endpoint (Base URL)</Label>
                      <Input
                        placeholder={preset.baseUrl}
                        value={provider.baseUrl}
                        onChange={(e) => onUpdateField(id, 'baseUrl', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">API Key</Label>
                      <Input
                        type="password"
                        placeholder="Enter API key..."
                        value={provider.apiKey}
                        onChange={(e) => onUpdateField(id, 'apiKey', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Model</Label>
                      <Input
                        list={datalistId}
                        placeholder="Select or type model name..."
                        value={provider.model}
                        onChange={(e) => onUpdateField(id, 'model', e.target.value)}
                        className="mt-1"
                      />
                      <datalist id={datalistId}>
                        {preset.models.map((m) => (
                          <option key={m} value={m} />
                        ))}
                      </datalist>
                    </div>
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
