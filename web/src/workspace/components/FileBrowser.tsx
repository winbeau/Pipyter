import { useRef, useState } from 'react'
import type { FileEntry } from '../types'
import { useWorkspace } from '../store'
import {
  IconChevronDown,
  IconChevronRight,
  IconDownload,
  IconFileType,
  IconFilter,
  IconFolder,
  IconFolderNew,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconUpload,
} from '../icons'

function Breadcrumbs() {
  const { state, actions } = useWorkspace()
  const segments = state.cwd ? state.cwd.split('/') : []
  const rootName = state.workspace?.root_name ?? 'workspace'
  const compact = segments.length > 1

  return (
    <div className="ws-path-row" aria-label="当前目录" title={`/${rootName}${state.cwd ? `/${state.cwd}` : ''}/`}>
      <button
        type="button"
        className="ws-root-folder-button"
        title={state.cwd ? `返回工作区根目录（${rootName}）` : `${rootName}（工作区根目录）`}
        onClick={() => actions.setCwd('')}
      >
        <IconFolder size={16} />
      </button>
      <div className="ws-breadcrumbs">
        {compact ? (
          <>
            <button
              type="button"
              className="ws-crumb ws-crumb-ellipsis"
              title="上级目录"
              onClick={() => actions.setCwd(segments.slice(0, -1).join('/'))}
            >
              ...
            </button>
            <span className="ws-crumb-sep">/</span>
            <button type="button" className="ws-crumb ws-crumb-current" onClick={() => actions.setCwd(state.cwd)}>
              {segments[segments.length - 1]}
            </button>
            <span className="ws-crumb-sep">/</span>
          </>
        ) : (
          <>
            <span className="ws-crumb-sep">/</span>
            <button type="button" className={`ws-crumb${segments.length === 0 ? ' ws-crumb-current' : ''}`} onClick={() => actions.setCwd('')}>
              {rootName}
            </button>
            {segments.map((segment) => (
              <span key={segment} className="ws-breadcrumb-part">
                <span className="ws-crumb-sep">/</span>
                <button type="button" className="ws-crumb ws-crumb-current" onClick={() => actions.setCwd(state.cwd)}>
                  {segment}
                </button>
              </span>
            ))}
            <span className="ws-crumb-sep">/</span>
          </>
        )}
      </div>
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
      if (!children) setChildren(await actions.listFiles(entry.path))
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

  return (
    <>
      <div
        className={`ws-tree-row${state.active === entry.path ? ' ws-tree-row-active' : ''}`}
        style={{ paddingLeft: 7 + depth * 14 }}
        onClick={open}
      >
        <span
          className="ws-tree-chevron"
          onClick={(event) => {
            event.stopPropagation()
            void toggle()
          }}
        >
          {isDirectory ? (expanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />) : null}
        </span>
        <IconFileType kind={entry.type} name={entry.name} size={15} />
        <span className="ws-tree-name" title={entry.name}>{entry.name}</span>
        <span className="ws-tree-menu" onClick={(event) => event.stopPropagation()}>
          {!isDirectory && (
            <button type="button" title="下载" onClick={() => actions.downloadPath(entry.path)}>
              <IconDownload size={12} />
            </button>
          )}
          <button type="button" title="重命名" onClick={rename}>
            <IconPencil size={12} />
          </button>
          <button type="button" title="删除" onClick={remove}>
            <IconTrash size={12} />
          </button>
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
  const [filterOpen, setFilterOpen] = useState(false)
  const entries = (state.entries ?? []).filter((entry) => entry.name.toLowerCase().includes(state.filter.toLowerCase()))
  const flatRoot = state.cwd === ''

  return (
    <div className="ws-files">
      <div className="ws-file-toolbar">
        <button
          type="button"
          className="ws-new-file-primary"
          title="新建文件"
          aria-label="新建文件"
          onClick={() => actions.showPrompt('新建文件', '文件名', 'untitled.py', (name) => void actions.newFile(state.cwd, name))}
        >
          <IconPlus size={15} />
        </button>
        <span className="ws-panel-actions ws-file-toolbar-actions">
          <button type="button" title="新建文件夹" onClick={() => actions.showPrompt('新建文件夹', '文件夹名', 'untitled', (name) => void actions.newFolder(state.cwd, name))}>
            <IconFolderNew size={16} />
          </button>
          <button type="button" title="上传文件" onClick={() => uploadRef.current?.click()}>
            <IconUpload size={16} />
          </button>
          <button type="button" title="刷新" onClick={() => void actions.refreshTree()}>
            <IconRefresh size={16} />
          </button>
          <button
            type="button"
            title="过滤文件"
            className={filterOpen || state.filter ? 'ws-file-action-active' : ''}
            onClick={() => setFilterOpen((open) => !open)}
          >
            <IconFilter size={16} />
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
      <Breadcrumbs />
      {(filterOpen || state.filter) && (
        <div className="ws-filter-row">
          <IconSearch size={13} />
          <input
            className="ws-filter-input"
            placeholder="过滤文件…"
            value={state.filter}
            autoFocus={filterOpen}
            onChange={(event) => actions.setFilter(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !state.filter) setFilterOpen(false)
            }}
          />
        </div>
      )}
      <div className="ws-tree">
        {entries.map((entry) => (
          <TreeRow key={entry.path} entry={entry} depth={0} />
        ))}
        {entries.length === 0 && (
          <div className="ws-empty-hint">{flatRoot ? '工作区为空' : '当前目录无文件'}</div>
        )}
      </div>
    </div>
  )
}
