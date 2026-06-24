import { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Ui } from '@/design/icons/Ui';
import { ArcadeLogo, BootLogo } from '@/design/icons/ArcadeLogo';
import { ProfileList } from '@/components/ProfileList';
import { ProfileForm } from '@/components/ProfileForm';
import { WebSearchPanel } from '@/components/WebSearchPanel';
import { ImageAnalysisPanel } from '@/components/ImageAnalysisPanel';
import { McpServerStatusPanel } from '@/components/McpServerStatusPanel';
import { ExternalMcpPanel } from '@/components/ExternalMcpPanel';
import { PresetGallery } from '@/components/PresetGallery';
import { useProfiles } from '@/hooks/useProfiles';
import { useMcpConfig } from '@/hooks/useMcpConfig';
import { useStatus } from '@/hooks/useStatus';
import type { DashboardTab } from '@/types/domain';
import { strings } from '@/lib/strings';

export default function App() {
  const profilesCtl = useProfiles();
  const mcpCtl = useMcpConfig();
  const connected = useStatus();

  const [activeTab, setActiveTab] = useState<DashboardTab>('templates');

  // First-load nudge: if there's already at least one profile, jump straight
  // to the Profiles tab on initial render instead of Templates.
  const [autoSwitched, setAutoSwitched] = useState(false);
  if (!autoSwitched && !profilesCtl.loading && profilesCtl.profiles.length > 0) {
    setActiveTab('profiles');
    setAutoSwitched(true);
  }

  const existingProfileNames = useMemo(
    () => profilesCtl.profiles.map((p) => p.name),
    [profilesCtl.profiles]
  );

  // Surface whichever domain produced an error most recently. Two parallel
  // banners would just compete for attention.
  const error = profilesCtl.error || mcpCtl.error;
  const clearError = () => {
    profilesCtl.clearError();
    mcpCtl.clearError();
  };

  const refreshAll = () => {
    profilesCtl.reload();
    mcpCtl.reload();
  };

  if (profilesCtl.loading || mcpCtl.loading) {
    return <BootSplash />;
  }

  return (
    <div className="min-h-screen pb-16">
      <AppHeader
        connected={connected}
        currentProfile={profilesCtl.currentProfile}
        profileCount={profilesCtl.profiles.length}
        onRefresh={refreshAll}
      />

      <main className="mx-auto max-w-6xl px-5 sm:px-8">
        {error && (
          <div className="banner-error mb-4 flex items-start gap-2 px-4 py-3 text-sm">
            <Ui name="x" size={14} className="mt-0.5 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              onClick={clearError}
              className="text-current opacity-70 transition-opacity hover:opacity-100"
              aria-label={strings.errors.dismissAria}
            >
              <Ui name="x" size={12} />
            </button>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DashboardTab)}>
          <div className="mb-6 flex items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="templates">
                <Ui name="sparkle" size={14} />
                {strings.tabs.templates}
              </TabsTrigger>
              <TabsTrigger value="profiles">
                <Ui name="profile" size={14} />
                {strings.tabs.profiles}
                {profilesCtl.profiles.length > 0 && (
                  <span className="pixel-chip pixel-chip-tangerine ml-1">{profilesCtl.profiles.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="mcp">
                <Ui name="mcp" size={14} />
                {strings.tabs.mcp}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="templates">
            <PresetGallery
              presets={profilesCtl.profilePresets}
              existingProfileNames={existingProfileNames}
              onInstall={async (args) => {
                const ok = await profilesCtl.installPreset(args);
                if (ok) setActiveTab('profiles');
                return ok;
              }}
            />
          </TabsContent>

          <TabsContent value="profiles">
            {/* Clicking blank space inside the profiles tab clears the edit
                target, returning the form to "add" mode. Cards stopPropagation
                so they don't trigger this. */}
            <div
              className="grid gap-5 lg:grid-cols-5"
              onClick={() => {
                if (profilesCtl.editing) profilesCtl.setEditing(null);
              }}
            >
              <div className="lg:col-span-3">
                <ProfileList
                  profiles={profilesCtl.profiles}
                  currentProfile={profilesCtl.currentProfile}
                  editingName={profilesCtl.editing?.name ?? null}
                  onEdit={(p) => {
                    profilesCtl.setEditing(p);
                  }}
                  onSetDefault={profilesCtl.pickDefault}
                  onDelete={profilesCtl.removeProfile}
                />
              </div>
              <div className="lg:col-span-2" onClick={(e) => e.stopPropagation()}>
                <ProfileForm
                  editingProfile={profilesCtl.editing}
                  onSubmit={profilesCtl.submitProfile}
                  onCancel={() => profilesCtl.setEditing(null)}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="mcp">
            <div
              className="space-y-4"
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter' && mcpCtl.dirty && !mcpCtl.saving) {
                  const tag = (e.target as HTMLElement).tagName;
                  if (tag === 'INPUT' || tag === 'TEXTAREA') {
                    e.preventDefault();
                    mcpCtl.save();
                  }
                }
              }}
            >
              <SaveBar
                dirty={mcpCtl.dirty}
                saved={mcpCtl.saved}
                saving={mcpCtl.saving}
                onSave={mcpCtl.save}
              />

              {mcpCtl.mcpConfig && mcpCtl.presets && (
                <>
                  <WebSearchPanel
                    config={mcpCtl.mcpConfig}
                    presets={mcpCtl.presets}
                    onToggleSection={() => mcpCtl.toggleSection('websearch')}
                    onToggleProvider={(id) => mcpCtl.toggleProvider('websearch', id)}
                    onUpdateField={(id, field, value) => mcpCtl.updateField('websearch', id, field, value)}
                  />
                  <ImageAnalysisPanel
                    config={mcpCtl.mcpConfig}
                    presets={mcpCtl.presets}
                    onToggleSection={() => mcpCtl.toggleSection('imageAnalysis')}
                    onToggleProvider={(id) => mcpCtl.toggleProvider('imageAnalysis', id)}
                    onUpdateField={(id, field, value) => mcpCtl.updateField('imageAnalysis', id, field, value)}
                  />
                </>
              )}

              <McpServerStatusPanel
                servers={mcpCtl.mcpServers}
                onToggle={(name, enabled) => mcpCtl.toggleServer(name, enabled)}
              />

              <ExternalMcpPanel
                externalMcpServers={mcpCtl.externalMcpServers}
                allMcpServers={mcpCtl.allMcpServers}
                currentProfile={profilesCtl.currentProfile}
                onAdd={mcpCtl.addExternal}
                onRemove={mcpCtl.removeExternal}
                onToggle={(name, enabled, instance) => mcpCtl.toggleServer(name, enabled, instance)}
              />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <AppFooter />
    </div>
  );
}

/* ── Pieces ───────────────────────────────────────────────────────────── */

function AppHeader({
  connected,
  currentProfile,
  profileCount,
  onRefresh,
}: {
  connected: boolean;
  currentProfile: string;
  profileCount: number;
  onRefresh: () => void;
}) {
  const t = strings.header;
  const subtitle =
    profileCount === 0
      ? t.emptyHint
      : currentProfile
        ? t.currentDefault(currentProfile)
        : t.noDefault;
  return (
    <header className="px-5 pt-6 pb-8 sm:px-8 sm:pt-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <ArcadeLogo />
            <div>
              <p className="font-pixel text-xs uppercase tracking-[0.22em] text-arcade-tangerine-ink">
                {strings.app.brand}
              </p>
              <h1 className="font-rounded text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
                {strings.app.title}
              </h1>
              <p className="mt-1 text-xs text-ink-400 sm:text-sm">{subtitle}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ConnectionBadge connected={connected} />
            <Button size="sm" variant="outline" onClick={onRefresh} aria-label={strings.app.refresh}>
              <Ui name="refresh" size={14} />
              <span className="hidden sm:inline">{strings.app.refresh}</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        connected
          ? 'border-arcade-leaf bg-arcade-leaf/15 status-online'
          : 'border-arcade-hibiscus bg-arcade-hibiscus/15 status-offline'
      }`}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          connected ? 'status-online-dot' : 'status-offline-dot'
        }`}
      />
      <span className="font-pixel uppercase tracking-widest text-[10px]">
        {connected ? strings.app.online : strings.app.offline}
      </span>
    </span>
  );
}

function BootSplash() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <BootLogo />
      <p className="font-pixel text-xs uppercase tracking-[0.3em] text-ink-400">{strings.app.loading}</p>
    </div>
  );
}

function AppFooter() {
  return (
    <footer className="mx-auto mt-12 max-w-6xl px-5 sm:px-8">
      <div className="border-t border-paper-300 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-ink-400">
          <span className="font-pixel uppercase tracking-widest">{strings.app.versionFooter}</span>
          <span className="flex items-center gap-1.5">
            <Ui name="heart" size={11} className="text-arcade-hibiscus" />
            <span>{strings.app.madeFor}</span>
          </span>
        </div>
      </div>
    </footer>
  );
}

interface SaveBarProps {
  dirty: boolean;
  saved: boolean;
  saving: boolean;
  onSave: () => void;
}

function SaveBar({ dirty, saved, saving, onSave }: SaveBarProps) {
  const t = strings.saveBar;
  if (!dirty && !saved) return null;
  return (
    <div
      className={`flex items-center justify-between rounded-2xl p-3.5 ${
        saved ? 'banner-success' : 'banner-warning'
      }`}
    >
      <div className="flex items-center gap-2">
        <Ui name={saved ? 'check-bold' : 'lightning'} size={16} />
        {saved ? (
          <div>
            <span className="font-rounded text-sm font-semibold">{t.savedTitle}</span>
            <p className="mt-0.5 text-xs opacity-80">{t.savedDetail}</p>
          </div>
        ) : (
          <span className="font-rounded text-sm font-semibold">{t.dirtyTitle}</span>
        )}
      </div>
      {dirty && (
        <Button size="sm" onClick={onSave} disabled={saving}>
          <Ui name="check-bold" size={14} />
          {saving ? t.saving : t.saveButton}
        </Button>
      )}
    </div>
  );
}
