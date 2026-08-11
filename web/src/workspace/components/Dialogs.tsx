import { useEffect, useRef, useState } from 'react'
import { codeThemeOptions, setAppearance, useAppearance } from '../../appearance'
import { useWorkspace } from '../store'
import { IconCheck, IconClose, IconKernel, IconRestart, IconStop, IconTerminal, IconTrash } from '../icons'
import { comboLabel, defaultKeymap, keyActionLabels, keyActionOrder, type KeyActionId, type KeyCombo } from '../keymap'

export function DialogHost() {
  const { state, actions } = useWorkspace()
  const appearance = useAppearance()
  const dialog = state.dialog
  const [value, setValue] = useState('')
  const [settingsTab, setSettingsTab] = useState<'connection' | 'appearance' | 'shortcuts'>('connection')
  const [editingAction, setEditingAction] = useState<KeyActionId | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (dialog?.kind === 'prompt') {
      setValue(dialog.initial)
      window.setTimeout(() => inputRef.current?.select(), 30)
    }
    if (dialog?.kind === 'settings') setSettingsTab('connection')
    if (dialog?.kind === 'kernels') void actions.refreshRunning()
  }, [dialog, actions])

  useEffect(() => {
    if (editingAction === null) return
    const capture = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return
      const combo: KeyCombo = {
        key: event.key,
        ctrl: event.ctrlKey && !event.metaKey ? true : undefined,
        shift: event.shiftKey || undefined,
        alt: event.altKey || undefined,
        ctrlOrMeta: event.metaKey ? true : undefined,
      }
      actions.updateKeymap(editingAction, combo)
      setEditingAction(null)
    }
    window.addEventListener('keydown', capture, true)
    return () => window.removeEventListener('keydown', capture, true)
  }, [editingAction, actions])

  if (!dialog) return null

  const close = () => {
    actions.closeDialog()
    setEditingAction(null)
  }

  if (dialog.kind === 'confirm') {
    return (
      <div className="ws-dialog-backdrop" onClick={close}>
        <div className="ws-dialog" onClick={(event) => event.stopPropagation()}>
          <div className="ws-dialog-header">
            <span>{dialog.title}</span>
            <button type="button" onClick={close}><IconClose size={13} /></button>
          </div>
          <div className="ws-dialog-body">{dialog.message}</div>
          <div className="ws-dialog-footer">
            <button type="button" className="ws-btn" onClick={close}>取消</button>
            <button
              type="button"
              className={`ws-btn ${dialog.danger ? 'ws-btn-danger' : 'ws-btn-primary'}`}
              onClick={() => {
                close()
                dialog.onConfirm()
              }}
            >
              确认
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (dialog.kind === 'prompt') {
    return (
      <div className="ws-dialog-backdrop" onClick={close}>
        <div className="ws-dialog" onClick={(event) => event.stopPropagation()}>
          <div className="ws-dialog-header">
            <span>{dialog.title}</span>
            <button type="button" onClick={close}><IconClose size={13} /></button>
          </div>
          <div className="ws-dialog-body">
            <label className="ws-dialog-label">{dialog.label}</label>
            <input
              ref={inputRef}
              className="ws-dialog-input"
              value={value}
              placeholder={dialog.placeholder}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && value.trim()) {
                  close()
                  dialog.onSubmit(value.trim())
                }
              }}
            />
          </div>
          <div className="ws-dialog-footer">
            <button type="button" className="ws-btn" onClick={close}>取消</button>
            <button
              type="button"
              className="ws-btn ws-btn-primary"
              disabled={!value.trim()}
              onClick={() => {
                close()
                dialog.onSubmit(value.trim())
              }}
            >
              确定
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (dialog.kind === 'kernels') {
    const current = state.kernels.find((kernel) => kernel.id === state.kernelId) ?? null
    const terminals = state.running?.terminals ?? []
    const demoOnly = state.mode === 'demo'
    return (
      <div className="ws-dialog-backdrop" onClick={close}>
        <div className="ws-dialog ws-dialog-wide" onClick={(event) => event.stopPropagation()}>
          <div className="ws-dialog-header">
            <span><IconKernel size={13} style={{ marginRight: 6, verticalAlign: -2 }} />Kernels</span>
            <button type="button" onClick={close}><IconClose size={13} /></button>
          </div>
          <div className="ws-dialog-body">
            <div className="ws-section-title"><span>当前 Kernel</span></div>
            {current ? (
              <div className="ws-kernel-current">
                <span className={`ws-running-state ${current.status}`}>{current.status}</span>
                <span className="ws-kernel-name">{current.name}</span>
                <span className="ws-kernel-count">executions: {current.execution_count}</span>
                <span className="ws-kernel-actions">
                  <button type="button" className="ws-btn ws-btn-small" disabled={!state.busy} onClick={() => void actions.interruptKernel()}>
                    <IconStop size={11} /> 中断
                  </button>
                  <button type="button" className="ws-btn ws-btn-small" onClick={() => void actions.restartKernel()}>
                    <IconRestart size={11} /> 重启
                  </button>
                  <button type="button" className="ws-btn ws-btn-small ws-btn-danger" onClick={() => void actions.shutdownKernel(current.id)}>
                    <IconTrash size={11} /> 关闭
                  </button>
                </span>
              </div>
            ) : (
              <div className="ws-empty-hint">未启动 Kernel —— 运行第一个 Cell 时自动启动，或从下方选择</div>
            )}

            <div className="ws-section-title ws-section-gap"><span>可用 Kernel（kernelspecs）</span></div>
            {state.kernelSpecs.length === 0 && <div className="ws-empty-hint">正在读取可用的 kernelspecs…</div>}
            {state.kernelSpecs.map((spec) => {
              const active = current?.name === spec.name
              return (
                <div key={spec.name} className={`ws-kernel-spec${active ? ' ws-kernel-spec-active' : ''}`}>
                  <span className="ws-kernel-spec-name">{spec.display_name}</span>
                  <span className="ws-kernel-spec-lang">{spec.language}{demoOnly ? ' · 演示' : ''}</span>
                  <span className="ws-kernel-spec-right">
                    {active ? (
                      <span className="ws-kernel-check"><IconCheck size={11} /> 当前</span>
                    ) : (
                      <button
                        type="button"
                        className="ws-btn ws-btn-small ws-btn-primary"
                        disabled={state.busy}
                        onClick={() => void actions.chooseKernel(spec.name)}
                      >
                        切换
                      </button>
                    )}
                  </span>
                </div>
              )
            })}

            <div className="ws-section-title ws-section-gap"><span>终端会话</span></div>
            {terminals.length === 0 && <div className="ws-empty-hint">暂无终端会话</div>}
            {terminals.map((item) => (
              <div key={item.id} className="ws-running-row">
                <IconTerminal size={13} />
                <span className="ws-running-name">{item.name}</span>
                <span className="ws-running-state connected">connected</span>
              </div>
            ))}
          </div>
          <div className="ws-dialog-footer">
            <button type="button" className="ws-btn ws-btn-primary" onClick={close}>关闭</button>
          </div>
        </div>
      </div>
    )
  }

  if (dialog.kind === 'settings') {
    return (
      <div className="ws-dialog-backdrop" onClick={close}>
        <div className="ws-dialog ws-dialog-wide" onClick={(event) => event.stopPropagation()}>
          <div className="ws-dialog-header">
            <span>设置</span>
            <button type="button" onClick={close}><IconClose size={13} /></button>
          </div>
          <div className="ws-settings-tabs">
            <button
              type="button"
              className={`ws-settings-tab${settingsTab === 'connection' ? ' ws-settings-tab-active' : ''}`}
              onClick={() => setSettingsTab('connection')}
            >
              连接
            </button>
            <button
              type="button"
              className={`ws-settings-tab${settingsTab === 'appearance' ? ' ws-settings-tab-active' : ''}`}
              onClick={() => setSettingsTab('appearance')}
            >
              外观
            </button>
            <button
              type="button"
              className={`ws-settings-tab${settingsTab === 'shortcuts' ? ' ws-settings-tab-active' : ''}`}
              onClick={() => setSettingsTab('shortcuts')}
            >
              快捷键
            </button>
          </div>
          <div className="ws-dialog-body ws-settings-body">
            {settingsTab === 'connection' ? (
              <div className="ws-about">
                <p><strong>连接</strong></p>
                <p>
                  当前模式：{state.mode === 'demo' ? '本地演示（无后端）' : state.mode === 'connecting' ? '连接中…' : 'Runtime API'}
                  {state.workspace ? ` · 工作区 ${state.workspace.name}（${state.workspace.workspace_id.slice(0, 8)}）` : ''}
                </p>
                <p><strong>说明</strong></p>
                <p>Workspace v0.1 通过 <code>/api/v1</code> 与 Runtime 通信；后端不可用时自动降级为浏览器内演示数据。所有布局与打开的文档保存在本地存储。</p>
                <button type="button" className="ws-btn" onClick={() => void actions.reconnect()}>重新连接 Runtime</button>
              </div>
            ) : settingsTab === 'appearance' ? (
              <div className="ws-appearance-settings">
                <div className="ws-setting-heading">代码渲染主题</div>
                <p className="ws-shortcuts-hint">编辑器使用 JupyterLab 同源的 CodeMirror 6 主题结构；默认保持 JupyterLab Light。</p>
                <div className="ws-code-theme-list">
                  {codeThemeOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`ws-code-theme-option${appearance.codeTheme === option.id ? ' ws-code-theme-option-active' : ''}`}
                      onClick={() => setAppearance({ codeTheme: option.id })}
                    >
                      <span className="ws-code-theme-swatch" style={{ background: option.background }}>
                        <span style={{ background: option.accent }} />
                        <span />
                      </span>
                      <span className="ws-code-theme-copy">
                        <strong>{option.label}</strong>
                        <small>{option.description}</small>
                      </span>
                      <span className="ws-code-theme-check">{appearance.codeTheme === option.id ? <IconCheck size={13} /> : null}</span>
                    </button>
                  ))}
                </div>
                <div className="ws-setting-heading ws-setting-heading-gap">Workspace 密度</div>
                <div className="ws-density-options">
                  <button
                    type="button"
                    className={`ws-density-option${appearance.density === 'comfortable' ? ' ws-density-option-active' : ''}`}
                    onClick={() => setAppearance({ density: 'comfortable' })}
                  >
                    舒适
                  </button>
                  <button
                    type="button"
                    className={`ws-density-option${appearance.density === 'compact' ? ' ws-density-option-active' : ''}`}
                    onClick={() => setAppearance({ density: 'compact' })}
                  >
                    紧凑
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="ws-shortcuts-hint">快捷键在命令模式下生效（点击 Cell 后 Esc 进入命令模式）。点击「更改」后按下新组合键即可重新绑定。</p>
                <div className="ws-shortcuts-table">
                  {keyActionOrder.map((actionId) => {
                    const combo = state.keymap[actionId]
                    const capturing = editingAction === actionId
                    return (
                      <div className="ws-shortcuts-row" key={actionId}>
                        <span className="ws-shortcuts-label">{keyActionLabels[actionId]}</span>
                        <span className={`ws-shortcuts-keys${capturing ? ' ws-shortcuts-capturing' : ''}`}>
                          {capturing ? '按下新组合键…（Esc 取消）' : comboLabel(combo)}
                        </span>
                        <span className="ws-shortcuts-actions">
                          {capturing ? (
                            <button type="button" className="ws-btn ws-btn-small" onClick={() => setEditingAction(null)}>取消</button>
                          ) : (
                            <button type="button" className="ws-btn ws-btn-small" onClick={() => setEditingAction(actionId)}>更改</button>
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="ws-shortcuts-footer">
                  <button
                    type="button"
                    className="ws-btn"
                    onClick={() => {
                      actions.resetKeymap()
                      actions.showToast('已恢复默认快捷键')
                    }}
                  >
                    恢复默认
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="ws-dialog-footer">
            <button type="button" className="ws-btn ws-btn-primary" onClick={close}>关闭</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="ws-dialog-backdrop" onClick={close}>
      <div className="ws-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="ws-dialog-header">
          <span>关于 Pipyter</span>
          <button type="button" onClick={close}><IconClose size={13} /></button>
        </div>
        <div className="ws-dialog-body ws-about">
          <p><strong>Pipyter Workspace v0.1</strong></p>
          <p>AI-native scientific computing workspace built on Jupyter 与 Pi。</p>
          <p>协议版本 0.1 · 连接状态：{state.mode === 'demo' ? '演示模式（Runtime API 不可用）' : state.mode === 'connecting' ? '连接中' : '已连接 Runtime API'}</p>
        </div>
        <div className="ws-dialog-footer">
          <button type="button" className="ws-btn ws-btn-primary" onClick={close}>关闭</button>
        </div>
      </div>
    </div>
  )
}
