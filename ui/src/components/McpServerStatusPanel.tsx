import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import type { McpServer } from '@/lib/api';
import { strings } from '@/lib/strings';

interface McpServerStatusPanelProps {
  servers: McpServer[];
  onToggle: (name: string, enabled: boolean) => void;
}

export function McpServerStatusPanel({ servers, onToggle }: McpServerStatusPanelProps) {
  const t = strings.mcpStatus;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {servers.map((server) => (
            <div
              key={server.name}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div>
                <p className="font-medium">{server.displayName}</p>
                <p className="text-sm text-muted-foreground">{server.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {server.enabled ? t.enabled : t.disabled}
                </span>
                <Switch
                  checked={server.enabled}
                  onCheckedChange={(checked) => onToggle(server.name, checked)}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
