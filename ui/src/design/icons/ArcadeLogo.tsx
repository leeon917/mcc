/**
 * The pixel-art MCC wordmark used in the app header.
 *
 * Three stacked block letters (M·C·C) in the arcade tangerine/lagoon/hibiscus
 * trio. Lives in design/icons so the visual asset isn't buried inside App.tsx
 * (where it pretended to be application code).
 */

interface Props {
  size?: number;
}

export function ArcadeLogo({ size = 32 }: Props) {
  return (
    <div className="provider-halo crt-scanline" aria-label="MCC logo">
      <svg viewBox="0 0 32 32" width={size} height={size} shapeRendering="crispEdges">
        <rect x="3" y="6" width="2" height="20" fill="var(--arcade-tangerine)" />
        <rect x="5" y="6" width="2" height="2" fill="var(--arcade-tangerine)" />
        <rect x="9" y="6" width="2" height="2" fill="var(--arcade-tangerine)" />
        <rect x="7" y="8" width="2" height="2" fill="var(--arcade-tangerine)" />
        <rect x="11" y="6" width="2" height="20" fill="var(--arcade-tangerine)" />

        <rect x="15" y="6" width="2" height="20" fill="var(--arcade-lagoon)" />
        <rect x="17" y="6" width="6" height="2" fill="var(--arcade-lagoon)" />
        <rect x="17" y="24" width="6" height="2" fill="var(--arcade-lagoon)" />

        <rect x="25" y="6" width="2" height="20" fill="var(--arcade-hibiscus)" />
        <rect x="27" y="6" width="2" height="2" fill="var(--arcade-hibiscus)" />
        <rect x="27" y="24" width="2" height="2" fill="var(--arcade-hibiscus)" />
      </svg>
    </div>
  );
}

/**
 * Boot splash variant — a single filled tangerine tile with a paper-white
 * inset and ink dot, used during initial app load.
 */
export function BootLogo({ size = 36 }: Props) {
  return (
    <div className="provider-halo crt-scanline">
      <svg viewBox="0 0 32 32" width={size} height={size} shapeRendering="crispEdges">
        <rect x="6" y="6" width="20" height="20" fill="var(--arcade-tangerine)" />
        <rect x="10" y="10" width="12" height="12" fill="var(--paper-50)" />
        <rect x="14" y="14" width="4" height="4" fill="var(--ink-900)" />
      </svg>
    </div>
  );
}
