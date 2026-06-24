import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Ui } from '@/components/icons/Ui';
import {
  ProviderIcon,
  getProviderAccent,
  getProviderTint,
  guessProviderId,
} from '@/components/icons/ProviderIcon';
import type { Profile } from '@/lib/api';

interface ProfileListProps {
  profiles: Profile[];
  currentProfile: string;
  onEdit: (profile: Profile) => void;
  onSetDefault: (name: string) => void;
  onDelete: (name: string) => void;
}

export function ProfileList({
  profiles,
  currentProfile,
  onEdit,
  onSetDefault,
  onDelete,
}: ProfileListProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Ui name="profile" size={18} className="text-arcade-lagoon" />
              My Profiles
            </CardTitle>
            <CardDescription>
              {profiles.length === 0
                ? '还没有 profile — 去 Templates 选一个开始吧。'
                : `${profiles.length} 个已配置的 profile · 默认 ${currentProfile || '未指定'}`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {profiles.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {profiles.map((p) => (
              <ProfileRow
                key={p.name}
                profile={p}
                isCurrent={p.name === currentProfile}
                onEdit={() => onEdit(p)}
                onSetDefault={() => onSetDefault(p.name)}
                onDelete={() => onDelete(p.name)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-paper-300 bg-paper-50 px-6 py-10 text-center">
      <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-ink-900 bg-arcade-sunshine">
        <Ui name="controller" size={24} className="text-ink-900" />
      </div>
      <p className="font-pixel text-2xs uppercase tracking-widest text-ink-400">no profile yet</p>
      <p className="mt-1 font-rounded text-base font-semibold text-ink-900">
        从 Templates 标签页开始
      </p>
      <p className="mt-1 text-xs text-ink-400">挑一个 Provider，填 Key，就能在 Claude Code 里跑。</p>
    </div>
  );
}

interface ProfileRowProps {
  profile: Profile;
  isCurrent: boolean;
  onEdit: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
}

function ProfileRow({ profile, isCurrent, onEdit, onSetDefault, onDelete }: ProfileRowProps) {
  const providerId = guessProviderId(profile.baseUrl || '');
  const accent = getProviderAccent(providerId);
  const tint = getProviderTint(providerId);

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-paper-300 bg-paper-50 transition-all hover:border-ink-900 hover:shadow-pixel1">
      {isCurrent && (
        <div
          className="absolute left-0 top-0 h-full w-1.5"
          style={{ background: accent }}
          aria-hidden
        />
      )}
      <div className="flex items-start gap-3 p-3.5">
        <div className="provider-halo provider-halo-sm" style={{ background: tint }}>
          <ProviderIcon id={providerId} size={26} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-rounded text-sm font-bold text-ink-900">{profile.name}</span>
            {isCurrent && (
              <span className="pixel-chip pixel-chip-success">
                <Ui name="check-bold" size={9} />
                default
              </span>
            )}
            <span className="pixel-chip">{profile.protocol || 'anthropic'}</span>
          </div>

          <p className="mt-1 truncate font-mono text-[11px] text-ink-400">{profile.baseUrl}</p>

          <dl className="mt-2 space-y-0.5">
            <ModelLine label="model" value={profile.model} />
            {profile.opusModel && <ModelLine label="opus" value={profile.opusModel} />}
            {profile.sonnetModel && <ModelLine label="sonnet" value={profile.sonnetModel} />}
            {profile.haikuModel && <ModelLine label="haiku" value={profile.haikuModel} />}
          </dl>

          <div className="mt-3 flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Ui name="edit" size={12} />
              Edit
            </Button>
            {!isCurrent && (
              <Button size="sm" variant="ghost" onClick={onSetDefault}>
                <Ui name="pin" size={12} />
                Set default
              </Button>
            )}
            <span className="flex-1" />
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete profile"
              className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-arcade-hibiscus/15 hover:text-arcade-hibiscus"
            >
              <Ui name="trash" size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModelLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="font-pixel text-2xs uppercase tracking-widest text-ink-400">{label}</dt>
      <dd className="truncate font-mono text-[11px] text-ink-600">{value}</dd>
    </div>
  );
}
