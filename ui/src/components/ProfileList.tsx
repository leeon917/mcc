import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Ui } from '@/design/icons/Ui';
import { ProviderIcon } from '@/design/icons/ProviderIcon';
import { getProviderAccent, getProviderTint, guessProviderId } from '@/lib/providers';
import type { Profile } from '@/lib/api';
import { strings } from '@/lib/strings';

interface ProfileListProps {
  profiles: Profile[];
  currentProfile: string;
  editingName: string | null;
  onEdit: (profile: Profile) => void;
  onSetDefault: (name: string) => void;
  onDelete: (name: string) => void;
}

export function ProfileList({
  profiles,
  currentProfile,
  editingName,
  onEdit,
  onSetDefault,
  onDelete,
}: ProfileListProps) {
  const t = strings.profileList;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Ui name="profile" size={18} className="text-arcade-lagoon" />
              {t.title}
            </CardTitle>
            <CardDescription>
              {profiles.length === 0
                ? t.emptyDescription
                : t.countDescription(profiles.length, currentProfile)}
            </CardDescription>
            {profiles.length > 0 && (
              <p className="text-[11px] text-ink-400">{t.clickHint}</p>
            )}
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
                isEditing={p.name === editingName}
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
  const t = strings.profileList;
  return (
    <div className="rounded-2xl border-2 border-dashed border-paper-300 bg-paper-50 px-6 py-10 text-center">
      <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-ink-900 bg-arcade-sunshine">
        <Ui name="controller" size={24} className="text-ink-900" />
      </div>
      <p className="font-pixel text-2xs uppercase tracking-widest text-ink-400">{t.emptyKicker}</p>
      <p className="mt-1 font-rounded text-base font-semibold text-ink-900">
        {t.emptyTitle}
      </p>
      <p className="mt-1 text-xs text-ink-400">{t.emptyHint}</p>
    </div>
  );
}

interface ProfileRowProps {
  profile: Profile;
  isCurrent: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
}

function ProfileRow({ profile, isCurrent, isEditing, onEdit, onSetDefault, onDelete }: ProfileRowProps) {
  const t = strings.profileList;
  const providerId = guessProviderId(profile.baseUrl || '');
  const accent = getProviderAccent(providerId);
  const tint = getProviderTint(providerId);
  const label = profile.displayName?.trim() || profile.name;
  const showHandle = !!profile.displayName && profile.displayName !== profile.name;

  // Stop propagation so the surrounding container's "click empty area = cancel"
  // handler doesn't fire when the user actually meant to click the card itself.
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        stop(e);
        onEdit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit();
        }
      }}
      className={`group relative cursor-pointer overflow-hidden rounded-2xl border bg-paper-50 transition-all hover:border-ink-900 hover:shadow-pixel1 ${
        isEditing
          ? 'border-ink-900 shadow-pixel1 ring-2 ring-arcade-sunshine/60'
          : 'border-paper-300'
      }`}
    >
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
            <span className="font-rounded text-sm font-bold text-ink-900">{label}</span>
            {showHandle && (
              <span className="font-mono text-[11px] text-ink-400">mcc {profile.name}</span>
            )}
            {isCurrent && (
              <span className="pixel-chip pixel-chip-success">
                <Ui name="check-bold" size={9} />
                {t.defaultChip}
              </span>
            )}
            {isEditing && (
              <span className="pixel-chip pixel-chip-tangerine">
                <Ui name="edit" size={9} />
                {t.editingChip}
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

          <div className="mt-3 flex items-center gap-1" onClick={stop}>
            {!isCurrent && (
              <Button size="sm" variant="ghost" onClick={onSetDefault}>
                <Ui name="pin" size={12} />
                {t.setDefault}
              </Button>
            )}
            <span className="flex-1" />
            <button
              type="button"
              onClick={onDelete}
              aria-label={t.deleteAria}
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
