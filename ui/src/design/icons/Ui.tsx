/**
 * Monochrome pixel UI sprites. All paths drawn on a 16×16 implied grid then
 * scaled to whatever `size` the caller asks for. shape-rendering: crispEdges
 * keeps the 1px stroke razor-sharp at any size.
 */
import type { SVGProps } from 'react';

export type UiIconName =
  | 'refresh'
  | 'plus'
  | 'edit'
  | 'trash'
  | 'check'
  | 'check-bold'
  | 'x'
  | 'search'
  | 'key'
  | 'sparkle'
  | 'star'
  | 'link'
  | 'eye'
  | 'eye-off'
  | 'arrow-right'
  | 'chevron-down'
  | 'chevron-right'
  | 'dot'
  | 'shield'
  | 'profile'
  | 'mcp'
  | 'rocket'
  | 'globe'
  | 'lightning'
  | 'gear'
  | 'controller'
  | 'heart'
  | 'sun'
  | 'cloud'
  | 'pin'
  | 'copy';

interface Props extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: UiIconName;
  size?: number;
}

const PATHS: Record<UiIconName, JSX.Element> = {
  // Each icon is a set of <rect> blocks on a 16×16 grid, currentColor.
  refresh: (
    <g>
      <path
        d="M3 8a5 5 0 0 1 8.5-3.5L10 6h3V3l-1.4 1.4A6.5 6.5 0 0 0 1.5 8h1.5Zm10 0a5 5 0 0 1-8.5 3.5L6 10H3v3l1.4-1.4A6.5 6.5 0 0 0 14.5 8H13Z"
        fill="currentColor"
      />
    </g>
  ),
  plus: (
    <g fill="currentColor">
      <rect x="7" y="2" width="2" height="12" />
      <rect x="2" y="7" width="12" height="2" />
    </g>
  ),
  edit: (
    <g fill="currentColor">
      <path d="M11 1 4 8v3h3l7-7-3-3Zm-7 9v1h1v-1H4Zm-2 4h12v1H2v-1Z" />
    </g>
  ),
  trash: (
    <g fill="currentColor">
      <rect x="6" y="1" width="4" height="1" />
      <rect x="3" y="3" width="10" height="1" />
      <rect x="4" y="5" width="1" height="9" />
      <rect x="11" y="5" width="1" height="9" />
      <rect x="7" y="5" width="1" height="9" />
      <rect x="4" y="14" width="8" height="1" />
    </g>
  ),
  check: (
    <g fill="currentColor">
      <path d="M14 4 6 12 2 8l1.5-1.5L6 9l6.5-6.5L14 4Z" />
    </g>
  ),
  'check-bold': (
    <g fill="currentColor">
      <path d="M13 3 6 10 3 7 1 9l5 5 9-9-2-2Z" />
    </g>
  ),
  x: (
    <g fill="currentColor">
      <path d="M4 2 2 4l4 4-4 4 2 2 4-4 4 4 2-2-4-4 4-4-2-2-4 4-4-4Z" />
    </g>
  ),
  search: (
    <g fill="currentColor">
      <path d="M7 1a5 5 0 1 0 3.2 8.8l3 3 1.4-1.4-3-3A5 5 0 0 0 7 1Zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />
    </g>
  ),
  key: (
    <g fill="currentColor">
      <path d="M10 2a4 4 0 0 0-3.9 5L1 12v3h3l1-1v-1h1v-1h1L7 10A4 4 0 1 0 10 2Zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" />
    </g>
  ),
  sparkle: (
    <g fill="currentColor">
      <path d="M8 1 9.4 6.6 15 8l-5.6 1.4L8 15l-1.4-5.6L1 8l5.6-1.4L8 1Zm5 8 .5 1.5L15 11l-1.5.5L13 13l-.5-1.5L11 11l1.5-.5L13 9Zm-10 2 .5 1.5L5 13l-1.5.5L3 15l-.5-1.5L1 13l1.5-.5L3 11Z" />
    </g>
  ),
  star: (
    <g fill="currentColor">
      <path d="M8 1 10 6h5l-4 3 1.5 5L8 11l-4.5 3L5 9 1 6h5L8 1Z" />
    </g>
  ),
  link: (
    <g fill="currentColor">
      <path d="M6 3h3v1H6v1H5V4a1 1 0 0 1 1-1Zm4 0h3a1 1 0 0 1 1 1v3h-1V4h-3V3ZM3 6h1v3H3V7a1 1 0 0 1 0-1Zm9 4h1v3a1 1 0 0 1-1 1H9v-1h3v-3ZM4 12v1h3v1H4a1 1 0 0 1-1-1v-1h1Z" />
      <rect x="5" y="7" width="6" height="2" />
    </g>
  ),
  eye: (
    <g fill="currentColor">
      <path d="M8 3C4 3 1 8 1 8s3 5 7 5 7-5 7-5-3-5-7-5Zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
    </g>
  ),
  'eye-off': (
    <g fill="currentColor">
      <path d="M2 2 14 14l-1 1L11.5 13A8 8 0 0 1 8 13c-4 0-7-5-7-5a13 13 0 0 1 2.5-3L1 3l1-1Zm6 3a3 3 0 0 1 3 3l-2-2a1 1 0 0 0-1-1L6 5a3 3 0 0 1 2 0ZM8 3c4 0 7 5 7 5a14 14 0 0 1-1.8 2.5l-2-2A3 3 0 0 0 8 5 3 3 0 0 0 6.5 5.3l-2-2A8 8 0 0 1 8 3Z" />
    </g>
  ),
  'arrow-right': (
    <g fill="currentColor">
      <path d="M9 3 7.5 4.5 11 8H2v2h9l-3.5 3.5L9 15l6-7-6-5Z" />
    </g>
  ),
  'chevron-down': (
    <g fill="currentColor">
      <path d="m4 5 4 4 4-4 1.5 1.5L8 12 2.5 6.5 4 5Z" />
    </g>
  ),
  'chevron-right': (
    <g fill="currentColor">
      <path d="m5 4 1.5-1.5L11 7 6.5 11.5 5 10l3-3-3-3Z" />
    </g>
  ),
  dot: (
    <g fill="currentColor">
      <rect x="6" y="6" width="4" height="4" />
    </g>
  ),
  shield: (
    <g fill="currentColor">
      <path d="M8 1 2 3v5c0 4 6 7 6 7s6-3 6-7V3L8 1Zm0 2.2 4 1.3V8c0 2.5-3.5 4.6-4 4.8C7.5 12.6 4 10.5 4 8V4.5l4-1.3Z" />
      <path d="m7 9 4-4-1-1-3 3-1.5-1.5L4 7l3 2Z" />
    </g>
  ),
  profile: (
    <g fill="currentColor">
      <path d="M8 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-6 12c0-3 3-5 6-5s6 2 6 5v1H2v-1Z" />
    </g>
  ),
  mcp: (
    <g fill="currentColor">
      <rect x="2" y="2" width="3" height="3" />
      <rect x="11" y="2" width="3" height="3" />
      <rect x="2" y="11" width="3" height="3" />
      <rect x="11" y="11" width="3" height="3" />
      <rect x="6" y="6" width="4" height="4" />
      <rect x="4" y="3" width="1" height="3" transform="rotate(0)" />
      <path d="M5 3h3v1H5zM8 5h3v1H8zM5 12h3v1H5zM8 10h3v1H8zM5 5v3h1V5zM10 8h1v3h-1Z" />
    </g>
  ),
  rocket: (
    <g fill="currentColor">
      <path d="M10 1 6 5 3 4 1 6l3 1-1 4 4-1 1 3 2-2-1-3 4-4-3 1Zm-2 5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
      <rect x="2" y="12" width="2" height="2" />
      <rect x="12" y="12" width="2" height="2" />
    </g>
  ),
  globe: (
    <g fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
      <path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12" />
    </g>
  ),
  lightning: (
    <g fill="currentColor">
      <path d="M9 1 3 9h4l-1 6 6-8H8l1-6Z" />
    </g>
  ),
  gear: (
    <g fill="currentColor">
      <path d="M7 1h2v2l1.5.5L12 2l1.5 1.5-1.5 1.5.5 1.5H15v2h-2.5L12 10l1.5 1.5L12 13l-1.5-1.5L9 12v2H7v-2l-1.5-.5L4 13l-1.5-1.5L4 10l-.5-1.5H1V7h2.5L4 5.5 2.5 4 4 2.5 5.5 4 7 3.5V1Zm1 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
    </g>
  ),
  controller: (
    <g fill="currentColor">
      <path d="M4 5h8a3 3 0 0 1 3 3v3a2 2 0 0 1-3.5 1.3L11 11H5l-.5 1.3A2 2 0 0 1 1 11V8a3 3 0 0 1 3-3Zm1 2v1H4v1h1v1h1V9h1V8H6V7H5Zm6 1a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
    </g>
  ),
  heart: (
    <g fill="currentColor">
      <path d="M8 13S2 9 2 5.5A2.5 2.5 0 0 1 6.5 4L8 5.5 9.5 4A2.5 2.5 0 0 1 14 5.5C14 9 8 13 8 13Z" />
    </g>
  ),
  sun: (
    <g fill="currentColor">
      <circle cx="8" cy="8" r="3" />
      <path d="M7 1h2v2H7zM7 13h2v2H7zM1 7h2v2H1zM13 7h2v2h-2zM3 3l1.5 1.5L3 6 1.5 4.5 3 3Zm10 0 1.5 1.5L13 6l-1.5-1.5L13 3Zm0 7 1.5 1.5L13 13l-1.5-1.5L13 10Zm-10 0 1.5 1.5L3 13l-1.5-1.5L3 10Z" />
    </g>
  ),
  cloud: (
    <g fill="currentColor">
      <path d="M5 5a4 4 0 0 1 7.5 1.5A3 3 0 0 1 12 12H4a3 3 0 0 1-1-5.5A4 4 0 0 1 5 5Z" />
    </g>
  ),
  pin: (
    <g fill="currentColor">
      <path d="M11 1 9 3l1 2-4 4-2-1-1 2 3 3-3 3 4-1 3-3-1-2 4-4 2 1 2-2-6-4Z" />
    </g>
  ),
  copy: (
    <g fill="currentColor">
      <rect x="4" y="1" width="9" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="4" width="9" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </g>
  ),
};

export function Ui({ name, size = 16, className, style, ...rest }: Props) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={className}
      style={{ display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
