import type { CSSProperties, ReactNode } from 'react'

type IconProps = { size?: number; style?: CSSProperties }

function Svg({ size = 14, style, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const IconPlay = (props: IconProps) => (
  <Svg {...props}>
    <path d="M6 4.5v11l9-5.5z" fill="currentColor" stroke="none" />
  </Svg>
)

export const IconStop = (props: IconProps) => (
  <Svg {...props}>
    <rect x="5" y="5" width="10" height="10" rx="1.5" fill="currentColor" stroke="none" />
  </Svg>
)

export const IconSave = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 3.5h10l2 2v11H4z" />
    <path d="M7 3.5v4h6v-4M7 16.5v-5h6v5" />
  </Svg>
)

export const IconPlus = (props: IconProps) => (
  <Svg {...props}>
    <path d="M10 4v12M4 10h12" />
  </Svg>
)

export const IconClose = (props: IconProps) => (
  <Svg {...props}>
    <path d="M5 5l10 10M15 5L5 15" />
  </Svg>
)

export const IconChevronRight = (props: IconProps) => (
  <Svg {...props}>
    <path d="M7 4l6 6-6 6" />
  </Svg>
)

export const IconChevronDown = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 7l6 6 6-6" />
  </Svg>
)

export const IconFolder = (props: IconProps) => (
  <Svg {...props}>
    <path d="M2.5 5.5a1.5 1.5 0 0 1 1.5-1.5h3.2l1.8 2h7a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5z" />
  </Svg>
)

export const IconFile = (props: IconProps) => (
  <Svg {...props}>
    <path d="M5 2.5h6.5L15 6v11.5H5z" />
    <path d="M11.5 2.5V6H15" />
  </Svg>
)

export const IconNotebook = (props: IconProps) => (
  <Svg {...props}>
    <rect x="2.5" y="2.5" width="11" height="15" rx="1" />
    <path d="M5.5 6h5.5M5.5 9h5.5M5.5 12h3.5" />
  </Svg>
)

export const IconImage = (props: IconProps) => (
  <Svg {...props}>
    <rect x="2.5" y="3.5" width="15" height="13" rx="1.5" />
    <path d="M5.5 13.5l3-3.5 2.5 2.5 3.5-4.5" />
  </Svg>
)

export const IconRefresh = (props: IconProps) => (
  <Svg {...props}>
    <path d="M15.5 8A5.5 5.5 0 1 1 4.7 6.2M15.5 3v4.5H11" />
  </Svg>
)

export const IconTrash = (props: IconProps) => (
  <Svg {...props}>
    <path d="M3.5 5h13M8 5V3.5h4V5M5 5l.6 11h8.8L15 5M8.5 8.5v4.5M11.5 8.5v4.5" />
  </Svg>
)

export const IconRestart = (props: IconProps) => (
  <Svg {...props}>
    <path d="M16 10a6 6 0 1 1-1.8-4.3M16 3v3.5h-3.5" />
  </Svg>
)

export const IconKernel = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="10" cy="10" r="6" />
    <path d="M10 4v12M4 10h12" />
  </Svg>
)

export const IconTerminal = (props: IconProps) => (
  <Svg {...props}>
    <rect x="2.5" y="4" width="15" height="12" rx="1.5" />
    <path d="M6 8l2.5 2L6 12M10.5 12h3.5" />
  </Svg>
)

export const IconSearch = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="9" cy="9" r="5.5" />
    <path d="M13.5 13.5L17 17" />
  </Svg>
)

export const IconUpload = (props: IconProps) => (
  <Svg {...props}>
    <path d="M10 13V4M6.5 7.5L10 4l3.5 3.5M4 13.5v2h12v-2" />
  </Svg>
)

export const IconDots = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="5" cy="10" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="10" cy="10" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="10" r="1.2" fill="currentColor" stroke="none" />
  </Svg>
)

export const IconCopy = (props: IconProps) => (
  <Svg {...props}>
    <rect x="6.5" y="6.5" width="9" height="9" rx="1.5" />
    <path d="M4 13.5V4.5h9" />
  </Svg>
)

export const IconCut = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="6" cy="6" r="2.4" />
    <circle cx="6" cy="14" r="2.4" />
    <path d="M8 7.4L16.5 16M8 12.6L16.5 4" />
  </Svg>
)

export const IconPaste = (props: IconProps) => (
  <Svg {...props}>
    <rect x="5" y="4" width="10" height="13" rx="1.5" />
    <path d="M8 4V2.8h4V4" />
  </Svg>
)

export const IconChevronsUp = (props: IconProps) => (
  <Svg {...props}>
    <path d="M5 11l5-5 5 5M5 15l5-5 5 5" />
  </Svg>
)

export const IconChevronsDown = (props: IconProps) => (
  <Svg {...props}>
    <path d="M5 9l5 5 5-5M5 5l5 5 5-5" />
  </Svg>
)

export const IconCollapse = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 10h12M8 6l-4 4 4 4M12 6l4 4-4 4" />
  </Svg>
)

export const IconExpand = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 10h12M8 6l4 4-4 4M12 6l4 4-4 4" />
  </Svg>
)

export const IconPilot = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="10" cy="10" r="6.5" />
    <circle cx="10" cy="10" r="1.7" fill="currentColor" stroke="none" />
    <path d="M10 1.8v1.8M10 16.4v1.8M1.8 10h1.8M16.4 10h1.8" />
  </Svg>
)

export const IconSpinner = ({ size = 14, style }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    style={{ flexShrink: 0, animation: 'spin 0.9s linear infinite', ...style }}
    aria-hidden="true"
  >
    <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2.4" opacity="0.25" />
    <path d="M17 10a7 7 0 0 0-7-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
)

export const IconFileType = ({ kind, size, style }: { kind: 'directory' | 'notebook' | 'file' | 'image' } & IconProps) => {
  if (kind === 'directory') return <IconFolder size={size} style={{ color: '#C9A56B', ...style }} />
  if (kind === 'notebook') return <IconNotebook size={size} style={{ color: '#96481C', ...style }} />
  if (kind === 'image') return <IconImage size={size} style={{ color: '#6E8F5A', ...style }} />
  return <IconFile size={size} style={{ color: '#A79C89', ...style }} />
}
