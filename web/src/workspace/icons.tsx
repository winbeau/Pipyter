import type { CSSProperties } from 'react'
import { Icon as Iconify } from '@iconify/react'
import jupyterLogo from '@iconify-icons/logos/jupyter'
import markdownLogo from '@iconify-icons/logos/markdown'
import pythonLogo from '@iconify-icons/logos/python'
import { TbFileTypeCsv } from 'react-icons/tb'
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Clipboard,
  Code2,
  Copy,
  Cpu,
  Download,
  FileText,
  Folder,
  FolderPlus,
  Image,
  ListFilter,
  LoaderCircle,
  MoreHorizontal,
  NotebookPen,
  Orbit,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Pilcrow,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Scissors,
  Search,
  Square,
  Terminal,
  Trash2,
  UploadCloud,
  X,
  type LucideIcon,
} from 'lucide-react'

type IconProps = { size?: number; style?: CSSProperties; className?: string }

function lucide(Icon: LucideIcon, defaultSize = 14) {
  return function WorkspaceIcon({ size = defaultSize, style, className }: IconProps) {
    return (
      <Icon
        size={size}
        strokeWidth={1.7}
        aria-hidden="true"
        className={className}
        style={{ flexShrink: 0, ...style }}
      />
    )
  }
}

export const IconPlay = lucide(Play)
export const IconSave = lucide(Save)
export const IconPlus = lucide(Plus)
export const IconClose = lucide(X)
export const IconCheck = lucide(Check)
export const IconChevronRight = lucide(ChevronRight)
export const IconChevronDown = lucide(ChevronDown)
export const IconFolder = lucide(Folder)
export const IconFolderNew = lucide(FolderPlus)
export const IconFile = lucide(FileText)
export const IconNotebook = lucide(NotebookPen)
export const IconImage = lucide(Image)
export const IconRefresh = lucide(RefreshCw)
export const IconTrash = lucide(Trash2)
export const IconRestart = lucide(RotateCcw)
export const IconKernel = lucide(Cpu)
export const IconTerminal = lucide(Terminal)
export const IconSearch = lucide(Search)
export const IconFilter = lucide(ListFilter)
export const IconUpload = lucide(UploadCloud)
export const IconDots = lucide(MoreHorizontal)
export const IconCopy = lucide(Copy)
export const IconCut = lucide(Scissors)
export const IconPaste = lucide(Clipboard)
export const IconCode = lucide(Code2)
export const IconMarkdown = lucide(Pilcrow)
export const IconChevronsUp = lucide(ChevronsUp)
export const IconChevronsDown = lucide(ChevronsDown)
export const IconCollapse = lucide(PanelLeftClose)
export const IconExpand = lucide(PanelLeftOpen)
export const IconPigent = lucide(Orbit)
export const IconDownload = lucide(Download)
export const IconPencil = lucide(Pencil)

export const IconStop = ({ size = 14, style, className }: IconProps) => (
  <Square
    size={size}
    strokeWidth={1.4}
    fill="currentColor"
    aria-hidden="true"
    className={className}
    style={{ flexShrink: 0, ...style }}
  />
)

export const IconSpinner = ({ size = 14, style, className }: IconProps) => (
  <LoaderCircle
    size={size}
    strokeWidth={1.8}
    aria-hidden="true"
    className={className}
    style={{ flexShrink: 0, animation: 'spin 0.9s linear infinite', ...style }}
  />
)

export const IconFileType = ({
  kind,
  name = '',
  size = 14,
  style,
}: { kind: 'directory' | 'notebook' | 'file' | 'image'; name?: string } & IconProps) => {
  const extension = name.toLowerCase().split('.').pop() ?? ''
  const brandStyle = { flexShrink: 0, ...style }
  if (kind === 'directory') return <IconFolder size={size} style={{ color: '#C9A56B', ...style }} />
  if (extension === 'ipynb') return <Iconify icon={jupyterLogo} width={size} height={size} style={brandStyle} aria-hidden="true" />
  if (extension === 'py') return <Iconify icon={pythonLogo} width={size} height={size} style={brandStyle} aria-hidden="true" />
  if (extension === 'md' || extension === 'markdown') return <Iconify icon={markdownLogo} width={size} height={size} style={brandStyle} aria-hidden="true" />
  if (extension === 'csv') return <TbFileTypeCsv size={size + 1} color="#A79C89" style={brandStyle} aria-hidden="true" />
  if (kind === 'notebook') return <IconNotebook size={size} style={{ color: '#96481C', ...style }} />
  if (kind === 'image') return <IconImage size={size} style={{ color: '#6E8F5A', ...style }} />
  return <IconFile size={size} style={{ color: '#A79C89', ...style }} />
}
