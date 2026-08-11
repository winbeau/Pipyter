import { useRef, useState } from 'react'
import type { FileEntry } from '../types'
import { useWorkspace } from '../store'
import { IconChevronDown, IconChevronRight, IconFileType, IconPlus, IconRefresh, IconSearch, IconTrash, IconUpload } from '../icons'

function Breadcrumbs() {
  const { state, actions } = useWorkspace()
  const segments = state.cwd ? state.cwd.split('/') : []
  const parts = [{ label: state.workspace?.root_name ?? 'workspace', path: '' }]
  let accumulated = ''
  for (const segment of segments) {
    accumulated = accumulated ? `${accumulated}/${segment}` : segment
    parts.push({ label: segment, path: accumulated })
  }
  return (
    <div className="ws-breadcrumbs">
      {parts.map((part, index) => (
        <span key={part.path}>
          {index > 0 && <span className="ws-crumb-sep">/</span>}
          <button
            type="button"
            className={`ws-crumb${index === parts.length - 1 ? ' ws-crumb-current' : ''}`}
            onClick={() => actions.setCwd(part.path)}
          >
            {part.label}
          </button>
        </span>
      ))}
    </div>
  )
}

function TreeRow({ entry, depth }: { entry: FileEntry; depth: number }) {
  const { state, actions } = useWorkspace()
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<FileEntry[] | null>(null)
  const isDirectory = entry.type === 'directory'

  const toggle = async () => {
    if (!isDirectory) return
    if (!expanded) {
      setExpanded(true)
      if (!children) {
        const fetched = await actions.listFiles(entry.path)
        setChildren(fetched)
      }
    } else {
      setExpanded(false)
    }
  }

  const open = () => {
    if (isDirectory) {
      actions.setCwd(entry.path)
      void toggle()
      return
    }
    const kind = entry.type === 'notebook' ? 'notebook' : entry.type === 'image' ? 'image' : 'text'
    void actions.openDoc(entry.path, kind)
  }

  const rename = () =>
    actions.showPrompt('重命名', '新名称', entry.name, (name) => void actions.renamePath(entry.path, name))
  const remove = () =>
    actions.showConfirm(
      `删除 ${entry.name}`,
      isDirectory ? '目录及其所有内容将被永久删除。' : '文件将被永久删除。',
      () => void actions.deletePath(entry.path),
      true,
    )
  const download = () => actions.downloadPath(entry.path)

  return (
    <>
      <div
        className={`ws-tree-row${state.active === entry.path ? ' ws-tree-row-active' : ''}`}
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={open}
      >
        <span className="ws-tree-chevron" onClick={(event) => { event.stopPropagation(); void toggle() }}>
          {isDirectory ? (expanded ? <IconChevronDown size={11} /> : <IconChevronRight size={11} />) : null}
        </span>
        <IconFileType kind={entry.type} size={14} />
        <span className="ws-tree-name" title={entry.name}>{entry.name}</span>
        <span className="ws-tree-menu" onClick={(event) => event.stopPropagation()}>
          {!isDirectory && (
            <button type="button" title="下载" onClick={download}>↓</button>
          )}
          <button type="button" title="重命名" onClick={rename}>✎</button>
          <button type="button" title="删除" onClick={remove}><IconTrash size={12} /></button>
        </span>
      </div>
      {isDirectory && expanded && children && (
        <div className="ws-tree-children">
          {children.map((child) => (
            <TreeRow key={child.path} entry={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </>
  )
}

export function FileBrowser() {
  const { state, actions } = useWorkspace()
  const uploadRef = useRef<HTMLInputElement>(null)
  const entries = (state.entries ?? []).filter((entry) => entry.name.toLowerCase().includes(state.filter.toLowerCase()))
  const flatRoot = state.cwd === ''

  return (
    <div className="ws-files">
      <div className="ws-panel-header">
        <Breadcrumbs />
        <span className="ws-panel-actions">
          <button type="button" title="新建文件" onClick={() => actions.showPrompt('新建文件', '文件名', 'untitled.py', (name) => void actions.newFile(state.cwd, name))}>
            <IconPlus size={13} />
          </button>
          <button type="button" title="新建文件夹" onClick={() => actions.showPrompt('新建文件夹', '文件夹名', 'untitled', (name) => void actions.newFolder(state.cwd, name))}>
            <IconFolderNew />
          </button>
          <button type="button" title="上传文件" onClick={() => uploadRef.current?.click()}>
            <IconUpload size={13} />
          </button>
          <button type="button" title="刷新" onClick={() => void actions.refreshTree()}>
            <IconRefresh size={13} />
          </button>
          <input
            ref={uploadRef}
            type="file"
            multiple
            hidden
            onChange={(event) => void actions.uploadFiles(event.target.files)}
          />
        </span>
      </div>
      <div className="ws-filter-row">
        <IconSearch size={12} />
        <input
          className="ws-filter-input"
          placeholder="过滤文件…"
          value={state.filter}
          onChange={(event) => actions.setFilter(event.target.value)}
        />
      </div>
      <div className="ws-tree">
        {entries.length === 0 && !flatRoot && (
          <button type="button" className="ws-up-link" onClick={() => actions.setCwd(state.cwd.slice(0, state.cwd.lastIndexOf('/')))}>
            ↑ 上级目录
          </button>
        )}
        {entries.map((entry) => (
          <TreeRow key={entry.path} entry={entry} depth={0} />
        ))}
        {entries.length === 0 && (
          <div className="ws-empty-hint">{flatRoot ? '工作区为空' : '（空目录）'}</div>
        )}
      </div>
    </div>
  )
}

function IconFolderNew() {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M2.5 5.5a1.5 1.5 0 0 1 1.5-1.5h3.2l1.8 2h7a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5z" />
      <path d="M10 9v5M7.5 11.5h5" />
    </svg>
  )
}
