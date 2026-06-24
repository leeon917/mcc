import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import type { McpServer } from '@/lib/api';

interface McpServerStatusPanelProps {
  servers: McpServer[];
  onToggle: (name: string, enabled: boolean) => void;
}

export function McpServerStatusPanel({ servers, onToggle }: McpServerStatusPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>MCP Server Status</CardTitle>
        <CardDescription>当前 session 中已启用的 MCP server</CardDescription>
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
                  {server.enabled ? 'Enabled' : 'Disabled'}
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
