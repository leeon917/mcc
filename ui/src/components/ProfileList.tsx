import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Profile } from '@/lib/api';

interface ProfileListProps {
  profiles: Profile[];
  currentProfile: string;
  onEdit: (profile: Profile) => void;
  onSetDefault: (name: string) => void;
  onDelete: (name: string) => void;
}

export function ProfileList({ profiles, currentProfile, onEdit, onSetDefault, onDelete }: ProfileListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profiles</CardTitle>
        <CardDescription>Your configured profiles</CardDescription>
      </CardHeader>
      <CardContent>
        {profiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No profiles yet.</p>
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

interface ProfileRowProps {
  profile: Profile;
  isCurrent: boolean;
  onEdit: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
}

function ProfileRow({ profile, isCurrent, onEdit, onSetDefault, onDelete }: ProfileRowProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-semibold text-sm">{profile.name}</span>
        {isCurrent && (
          <span className="badge-current inline-flex items-center px-2 py-0.5 text-[10px] font-medium">
            default
          </span>
        )}
        <span className="badge-default inline-flex items-center px-1.5 py-0.5 text-[10px]">
          {profile.protocol || 'anthropic'}
        </span>
      </div>

      <p className="text-xs code-faint truncate mb-3 font-mono">{profile.baseUrl}</p>

      <div className="space-y-0.5 mb-3 text-xs">
        <ModelRow label="default" value={profile.model} />
        {profile.opusModel && <ModelRow label="opus" value={profile.opusModel} />}
        {profile.sonnetModel && <ModelRow label="sonnet" value={profile.sonnetModel} />}
        {profile.haikuModel && <ModelRow label="haiku" value={profile.haikuModel} />}
      </div>

      <div className="flex items-center gap-1 pt-2 border-t border-border/50">
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onEdit}>
          Edit
        </Button>
        {!isCurrent && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onSetDefault}>
            Set default
          </Button>
        )}
        <span className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}

function ModelRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-muted-foreground w-14 shrink-0 text-right">{label}</span>
      <span className="font-mono code-mono truncate">{value}</span>
    </div>
  );
}
