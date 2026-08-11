import type { CSSProperties } from 'react'
import { ChevronDown } from 'lucide-react'
import type { CodeThemeId, CodeThemeOption, WorkspaceDensity } from '../../appearance'

export type SettingsDesignProps = {
  autosaveKnobStyle: CSSProperties
  autosaveToggleStyle: CSSProperties
  ctxFigureKnobStyle: CSSProperties
  ctxFigureToggleStyle: CSSProperties
  ctxNotebookKnobStyle: CSSProperties
  ctxNotebookToggleStyle: CSSProperties
  ctxTerminalKnobStyle: CSSProperties
  ctxTerminalToggleStyle: CSSProperties
  hiddenKnobStyle: CSSProperties
  hiddenToggleStyle: CSSProperties
  indexingKnobStyle: CSSProperties
  indexingToggleStyle: CSSProperties
  navAccountStyle: CSSProperties
  navAgentStyle: CSSProperties
  navAppearanceStyle: CSSProperties
  navFiguresStyle: CSSProperties
  navGeneralStyle: CSSProperties
  navKernelsStyle: CSSProperties
  navPermissionsStyle: CSSProperties
  navProvidersStyle: CSSProperties
  navWorkspaceStyle: CSSProperties
  goAccount: () => void
  goAgent: () => void
  goAppearance: () => void
  goFigures: () => void
  goGeneral: () => void
  goKernels: () => void
  goPermissions: () => void
  goProviders: () => void
  goWorkspace: () => void
  toggleAutosave: () => void
  toggleCtxFigure: () => void
  toggleCtxNotebook: () => void
  toggleCtxTerminal: () => void
  toggleHidden: () => void
  toggleIndexing: () => void
  isAccount: boolean
  isAgent: boolean
  isAppearance: boolean
  isFigures: boolean
  isGeneral: boolean
  isKernels: boolean
  isPermissions: boolean
  isProviders: boolean
  isWorkspace: boolean
  codeTheme: CodeThemeId
  codeThemeOptions: ReadonlyArray<CodeThemeOption>
  density: WorkspaceDensity
  onCodeThemeChange: (theme: CodeThemeId) => void
  onDensityChange: (density: WorkspaceDensity) => void
}

export function SettingsDesign({
  autosaveKnobStyle,
  autosaveToggleStyle,
  ctxFigureKnobStyle,
  ctxFigureToggleStyle,
  ctxNotebookKnobStyle,
  ctxNotebookToggleStyle,
  ctxTerminalKnobStyle,
  ctxTerminalToggleStyle,
  goAccount,
  goAgent,
  goAppearance,
  goFigures,
  goGeneral,
  goKernels,
  goPermissions,
  goProviders,
  goWorkspace,
  hiddenKnobStyle,
  hiddenToggleStyle,
  indexingKnobStyle,
  indexingToggleStyle,
  isAccount,
  isAgent,
  isAppearance,
  isFigures,
  isGeneral,
  isKernels,
  isPermissions,
  isProviders,
  isWorkspace,
  navAccountStyle,
  navAgentStyle,
  navAppearanceStyle,
  navFiguresStyle,
  navGeneralStyle,
  navKernelsStyle,
  navPermissionsStyle,
  navProvidersStyle,
  navWorkspaceStyle,
  toggleAutosave,
  toggleCtxFigure,
  toggleCtxNotebook,
  toggleCtxTerminal,
  toggleHidden,
  toggleIndexing,
  codeTheme,
  codeThemeOptions,
  density,
  onCodeThemeChange,
  onDensityChange,
}: SettingsDesignProps) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", minWidth: "0", fontFamily: "'Inter',sans-serif", "--bg": "#F7F6F3", "--surface": "#FFFFFF", "--surface-2": "#F7F6F3", "--border": "#EDECE9", "--text": "#37352F", "--text-2": "#787774", "--text-3": "#9B9A97", "--accent": "#2383E2", "--accent-soft": "#E3F2FD", "--accent-dark": "#0D47A1", "--dark-bg": "#1B1815", "--dark-surface": "#242019", "--dark-surface-2": "#2D281F", "--dark-border": "#3A342A", "--dark-text": "#EDE7DC", "--dark-text-2": "#A79C89", "--mono": "'IBM Plex Mono',monospace", background: "var(--bg)", color: "var(--text)" } as CSSProperties}>
      <div style={{ flex: "1", display: "flex", flexDirection: "row", minHeight: "0" } as CSSProperties}>
        {/* LEFT NAV */}
        <div style={{ width: "220px", flexShrink: "0", borderRight: "1px solid var(--border)", background: "var(--surface)", padding: "20px 14px", overflow: "auto" } as CSSProperties}>
          <div style={navGeneralStyle} onClick={goGeneral}>
            {"General"}
          </div>
          <div style={navWorkspaceStyle} onClick={goWorkspace}>
            {"Workspace"}
          </div>
          <div style={navKernelsStyle} onClick={goKernels}>
            {"Kernels"}
          </div>
          <div style={navFiguresStyle} onClick={goFigures}>
            {"Figures"}
          </div>
          <div style={navAgentStyle} onClick={goAgent}>
            {"Agent"}
          </div>
          <div style={navProvidersStyle} onClick={goProviders}>
            {"AI Providers"}
          </div>
          <div style={navPermissionsStyle} onClick={goPermissions}>
            {"Permissions"}
          </div>
          <div style={navAppearanceStyle} onClick={goAppearance}>
            {"Appearance"}
          </div>
          <div style={navAccountStyle} onClick={goAccount}>
            {"Account"}
          </div>
        </div>
        {/* CONTENT */}
        <div style={{ flex: "1", overflow: "auto", padding: "40px 48px" } as CSSProperties}>
          <div style={{ maxWidth: "640px" } as CSSProperties}>
            {isGeneral && (
              <>
                <div style={{ fontSize: "20px", fontWeight: "600", marginBottom: "24px" } as CSSProperties}>
                  {"General"}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid var(--border)" } as CSSProperties}>
                  <div style={{ flexShrink: "0", marginRight: "16px" } as CSSProperties}>
                    <div style={{ fontSize: "13.5px", fontWeight: "500" } as CSSProperties}>
                      {"界面语言"}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-2)", marginTop: "2px" } as CSSProperties}>
                      {"应用于所有页面的显示语言"}
                    </div>
                  </div>
                  <div style={{ padding: "7px 12px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12.5px", display: "flex", alignItems: "center", gap: "6px", flexShrink: "0", whiteSpace: "nowrap" } as CSSProperties}>
                    {"简体中文"}
                    <ChevronDown size={11} strokeWidth={1.7} color="var(--text-3)" aria-hidden="true" />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid var(--border)" } as CSSProperties}>
                  <div style={{ flexShrink: "0", marginRight: "16px" } as CSSProperties}>
                    <div style={{ fontSize: "13.5px", fontWeight: "500" } as CSSProperties}>
                      {"自动保存"}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-2)", marginTop: "2px" } as CSSProperties}>
                      {"每 30 秒自动保存 Notebook 与文件"}
                    </div>
                  </div>
                  <div style={autosaveToggleStyle} onClick={toggleAutosave}>
                    <div style={autosaveKnobStyle}>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0" } as CSSProperties}>
                  <div style={{ flexShrink: "0", marginRight: "16px" } as CSSProperties}>
                    <div style={{ fontSize: "13.5px", fontWeight: "500" } as CSSProperties}>
                      {"启动行为"}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-2)", marginTop: "2px" } as CSSProperties}>
                      {"打开 Pipyter 时默认进入的页面"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexShrink: "0" } as CSSProperties}>
                    <div style={{ padding: "7px 12px", borderRadius: "7px", background: "var(--accent-soft)", color: "var(--accent-dark)", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap" } as CSSProperties}>
                      {"上次的 Workspace"}
                    </div>
                    <div style={{ padding: "7px 12px", borderRadius: "7px", border: "1px solid var(--border)", fontSize: "12px", color: "var(--text-2)", whiteSpace: "nowrap" } as CSSProperties}>
                      {"Home 页面"}
                    </div>
                  </div>
                </div>
              </>
            )}
            {isWorkspace && (
              <>
                <div style={{ fontSize: "20px", fontWeight: "600", marginBottom: "24px" } as CSSProperties}>
                  {"Workspace"}
                </div>
                <div style={{ marginBottom: "16px" } as CSSProperties}>
                  <div style={{ fontSize: "12.5px", color: "var(--text-2)", marginBottom: "6px" } as CSSProperties}>
                    {"Workspace 根目录"}
                  </div>
                  <div style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12.5px", fontFamily: "var(--mono)" } as CSSProperties}>
                    {"/Users/wangbei/pipyter/LingBot-VA"}
                  </div>
                </div>
                <div style={{ marginBottom: "16px" } as CSSProperties}>
                  <div style={{ fontSize: "12.5px", color: "var(--text-2)", marginBottom: "6px" } as CSSProperties}>
                    {"默认项目目录"}
                  </div>
                  <div style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12.5px", fontFamily: "var(--mono)" } as CSSProperties}>
                    {"notebooks/"}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderTop: "1px solid var(--border)" } as CSSProperties}>
                  <div>
                    <div style={{ fontSize: "13.5px", fontWeight: "500" } as CSSProperties}>
                      {"文件索引"}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-2)", marginTop: "2px" } as CSSProperties}>
                      {"支持全文搜索 Notebook / 脚本 / 数据文件"}
                    </div>
                  </div>
                  <div style={indexingToggleStyle} onClick={toggleIndexing}>
                    <div style={indexingKnobStyle}>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderTop: "1px solid var(--border)" } as CSSProperties}>
                  <div>
                    <div style={{ fontSize: "13.5px", fontWeight: "500" } as CSSProperties}>
                      {"显示隐藏文件"}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-2)", marginTop: "2px" } as CSSProperties}>
                      {"在文件树中显示以 . 开头的文件"}
                    </div>
                  </div>
                  <div style={hiddenToggleStyle} onClick={toggleHidden}>
                    <div style={hiddenKnobStyle}>
                    </div>
                  </div>
                </div>
              </>
            )}
            {isKernels && (
              <>
                <div style={{ fontSize: "20px", fontWeight: "600", marginBottom: "24px" } as CSSProperties}>
                  {"Kernels"}
                </div>
                <div style={{ marginBottom: "20px" } as CSSProperties}>
                  <div style={{ fontSize: "12.5px", color: "var(--text-2)", marginBottom: "6px" } as CSSProperties}>
                    {"默认 Python Kernel"}
                  </div>
                  <div style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12.5px", display: "flex", justifyContent: "space-between" } as CSSProperties}>
                    {"Python 3.11 (venv)"}
                    <ChevronDown size={11} strokeWidth={1.7} color="var(--text-3)" aria-hidden="true" />
                  </div>
                </div>
                <div style={{ fontSize: "12.5px", color: "var(--text-2)", marginBottom: "8px" } as CSSProperties}>
                  {"检测到的环境"}
                </div>
                <div style={{ border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden", marginBottom: "12px" } as CSSProperties}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", borderBottom: "1px solid var(--border)" } as CSSProperties}>
                    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#5FA85A", flexShrink: "0" } as CSSProperties}>
                    </span>
                    <div style={{ flex: "1" } as CSSProperties}>
                      <div style={{ fontSize: "13px", fontWeight: "500" } as CSSProperties}>
                        {"venv · LingBot-VA"}
                      </div>
                      <div style={{ fontSize: "11.5px", color: "var(--text-3)" } as CSSProperties}>
                        {"Python 3.11.7"}
                      </div>
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "#3F7A3B", background: "#E4F0E2", padding: "3px 10px", borderRadius: "20px" } as CSSProperties}>
                      {"Active"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", borderBottom: "1px solid var(--border)" } as CSSProperties}>
                    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--text-3)", flexShrink: "0" } as CSSProperties}>
                    </span>
                    <div style={{ flex: "1" } as CSSProperties}>
                      <div style={{ fontSize: "13px", fontWeight: "500" } as CSSProperties}>
                        {"conda · base"}
                      </div>
                      <div style={{ fontSize: "11.5px", color: "var(--text-3)" } as CSSProperties}>
                        {"Python 3.10.4"}
                      </div>
                    </div>
                    <span style={{ fontSize: "12px", color: "var(--accent-dark)", cursor: "pointer" } as CSSProperties}>
                      {"使用"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px" } as CSSProperties}>
                    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--text-3)", flexShrink: "0" } as CSSProperties}>
                    </span>
                    <div style={{ flex: "1" } as CSSProperties}>
                      <div style={{ fontSize: "13px", fontWeight: "500" } as CSSProperties}>
                        {"uv · fast-eval"}
                      </div>
                      <div style={{ fontSize: "11.5px", color: "var(--text-3)" } as CSSProperties}>
                        {"Python 3.12.1"}
                      </div>
                    </div>
                    <span style={{ fontSize: "12px", color: "var(--accent-dark)", cursor: "pointer" } as CSSProperties}>
                      {"使用"}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-2)" } as CSSProperties}>
                  {"运行中 Kernel：2 个 · 空闲 1 个"}
                </div>
              </>
            )}
            {isFigures && (
              <>
                <div style={{ fontSize: "20px", fontWeight: "600", marginBottom: "24px" } as CSSProperties}>
                  {"Figures"}
                </div>
                <div style={{ display: "flex", gap: "12px", marginBottom: "16px" } as CSSProperties}>
                  <div style={{ flex: "1" } as CSSProperties}>
                    <div style={{ fontSize: "12.5px", color: "var(--text-2)", marginBottom: "6px" } as CSSProperties}>
                      {"默认 DPI"}
                    </div>
                    <div style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12.5px" } as CSSProperties}>
                      {"300"}
                    </div>
                  </div>
                  <div style={{ flex: "1" } as CSSProperties}>
                    <div style={{ fontSize: "12.5px", color: "var(--text-2)", marginBottom: "6px" } as CSSProperties}>
                      {"默认导出格式"}
                    </div>
                    <div style={{ display: "flex", gap: "6px" } as CSSProperties}>
                      <div style={{ flex: "1", textAlign: "center", padding: "9px", borderRadius: "8px", background: "var(--accent-soft)", color: "var(--accent-dark)", fontSize: "12.5px", fontWeight: "600" } as CSSProperties}>
                        {"PNG"}
                      </div>
                      <div style={{ flex: "1", textAlign: "center", padding: "9px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "12.5px", color: "var(--text-2)" } as CSSProperties}>
                        {"SVG"}
                      </div>
                      <div style={{ flex: "1", textAlign: "center", padding: "9px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "12.5px", color: "var(--text-2)" } as CSSProperties}>
                        {"PDF"}
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ marginBottom: "16px" } as CSSProperties}>
                  <div style={{ fontSize: "12.5px", color: "var(--text-2)", marginBottom: "6px" } as CSSProperties}>
                    {"字体"}
                  </div>
                  <div style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12.5px", display: "flex", justifyContent: "space-between" } as CSSProperties}>
                    {"IBM Plex Sans"}
                    <ChevronDown size={11} strokeWidth={1.7} color="var(--text-3)" aria-hidden="true" />
                  </div>
                </div>
                <div style={{ marginBottom: "16px" } as CSSProperties}>
                  <div style={{ fontSize: "12.5px", color: "var(--text-2)", marginBottom: "6px" } as CSSProperties}>
                    {"纸张预设"}
                  </div>
                  <div style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12.5px", display: "flex", justifyContent: "space-between" } as CSSProperties}>
                    {"NeurIPS 单栏 (3.25 in)"}
                    <ChevronDown size={11} strokeWidth={1.7} color="var(--text-3)" aria-hidden="true" />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "12px", marginBottom: "16px" } as CSSProperties}>
                  <div style={{ flex: "1" } as CSSProperties}>
                    <div style={{ fontSize: "12.5px", color: "var(--text-2)", marginBottom: "6px" } as CSSProperties}>
                      {"图像宽度"}
                    </div>
                    <div style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12.5px" } as CSSProperties}>
                      {"6 in"}
                    </div>
                  </div>
                  <div style={{ flex: "1" } as CSSProperties}>
                    <div style={{ fontSize: "12.5px", color: "var(--text-2)", marginBottom: "6px" } as CSSProperties}>
                      {"图像高度"}
                    </div>
                    <div style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12.5px" } as CSSProperties}>
                      {"4 in"}
                    </div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "12.5px", color: "var(--text-2)", marginBottom: "6px" } as CSSProperties}>
                    {"输出目录"}
                  </div>
                  <div style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12.5px", fontFamily: "var(--mono)" } as CSSProperties}>
                    {"figures/"}
                  </div>
                </div>
              </>
            )}
            {isAgent && (
              <>
                <div style={{ fontSize: "20px", fontWeight: "600", marginBottom: "24px" } as CSSProperties}>
                  {"Agent"}
                </div>
                <div style={{ marginBottom: "16px" } as CSSProperties}>
                  <div style={{ fontSize: "12.5px", color: "var(--text-2)", marginBottom: "6px" } as CSSProperties}>
                    {"默认模型"}
                  </div>
                  <div style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12.5px", display: "flex", justifyContent: "space-between" } as CSSProperties}>
                    {"Pilot Reasoning"}
                    <ChevronDown size={11} strokeWidth={1.7} color="var(--text-3)" aria-hidden="true" />
                  </div>
                </div>
                <div style={{ marginBottom: "20px" } as CSSProperties}>
                  <div style={{ fontSize: "12.5px", color: "var(--text-2)", marginBottom: "6px" } as CSSProperties}>
                    {"推理模式"}
                  </div>
                  <div style={{ display: "flex", gap: "6px" } as CSSProperties}>
                    <div style={{ flex: "1", textAlign: "center", padding: "9px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "12.5px", color: "var(--text-2)" } as CSSProperties}>
                      {"快速"}
                    </div>
                    <div style={{ flex: "1", textAlign: "center", padding: "9px", borderRadius: "8px", background: "var(--accent-soft)", color: "var(--accent-dark)", fontSize: "12.5px", fontWeight: "600" } as CSSProperties}>
                      {"平衡"}
                    </div>
                    <div style={{ flex: "1", textAlign: "center", padding: "9px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "12.5px", color: "var(--text-2)" } as CSSProperties}>
                      {"深度"}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: "12.5px", color: "var(--text-2)", marginBottom: "8px" } as CSSProperties}>
                  {"自动上下文"}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderTop: "1px solid var(--border)" } as CSSProperties}>
                  <div style={{ fontSize: "13.5px" } as CSSProperties}>
                    {"当前 Notebook 上下文"}
                  </div>
                  <div style={ctxNotebookToggleStyle} onClick={toggleCtxNotebook}>
                    <div style={ctxNotebookKnobStyle}>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderTop: "1px solid var(--border)" } as CSSProperties}>
                  <div style={{ fontSize: "13.5px" } as CSSProperties}>
                    {"当前 Figure 上下文"}
                  </div>
                  <div style={ctxFigureToggleStyle} onClick={toggleCtxFigure}>
                    <div style={ctxFigureKnobStyle}>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" } as CSSProperties}>
                  <div style={{ fontSize: "13.5px" } as CSSProperties}>
                    {"终端上下文"}
                  </div>
                  <div style={ctxTerminalToggleStyle} onClick={toggleCtxTerminal}>
                    <div style={ctxTerminalKnobStyle}>
                    </div>
                  </div>
                </div>
              </>
            )}
            {isProviders && (
              <>
                <div style={{ fontSize: "20px", fontWeight: "600", marginBottom: "24px" } as CSSProperties}>
                  {"AI Providers"}
                </div>
                <div style={{ border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden", marginBottom: "24px" } as CSSProperties}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "13px 16px", borderBottom: "1px solid var(--border)" } as CSSProperties}>
                    <div style={{ flex: "1", fontSize: "13.5px", fontWeight: "500" } as CSSProperties}>
                      {"OpenAI"}
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "#3F7A3B", background: "#E4F0E2", padding: "3px 10px", borderRadius: "20px" } as CSSProperties}>
                      {"已连接"}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--text-2)", cursor: "pointer" } as CSSProperties}>
                      {"配置"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "13px 16px", borderBottom: "1px solid var(--border)" } as CSSProperties}>
                    <div style={{ flex: "1", fontSize: "13.5px", fontWeight: "500" } as CSSProperties}>
                      {"Anthropic"}
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "#3F7A3B", background: "#E4F0E2", padding: "3px 10px", borderRadius: "20px" } as CSSProperties}>
                      {"已连接"}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--text-2)", cursor: "pointer" } as CSSProperties}>
                      {"配置"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "13px 16px", borderBottom: "1px solid var(--border)" } as CSSProperties}>
                    <div style={{ flex: "1", fontSize: "13.5px", fontWeight: "500" } as CSSProperties}>
                      {"Google"}
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-2)", background: "var(--surface-2)", padding: "3px 10px", borderRadius: "20px" } as CSSProperties}>
                      {"未连接"}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--accent-dark)", cursor: "pointer" } as CSSProperties}>
                      {"连接"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "13px 16px", borderBottom: "1px solid var(--border)" } as CSSProperties}>
                    <div style={{ flex: "1", fontSize: "13.5px", fontWeight: "500" } as CSSProperties}>
                      {"OpenRouter"}
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-2)", background: "var(--surface-2)", padding: "3px 10px", borderRadius: "20px" } as CSSProperties}>
                      {"未连接"}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--accent-dark)", cursor: "pointer" } as CSSProperties}>
                      {"连接"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "13px 16px" } as CSSProperties}>
                    <div style={{ flex: "1", fontSize: "13.5px", fontWeight: "500" } as CSSProperties}>
                      {"自定义 OpenAI 兼容端点"}
                    </div>
                    <span style={{ fontSize: "12px", color: "var(--accent-dark)", cursor: "pointer" } as CSSProperties}>
                      {"添加端点"}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "10px" } as CSSProperties}>
                  {"API Key 管理"}
                </div>
                <div style={{ border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden", marginBottom: "14px" } as CSSProperties}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderBottom: "1px solid var(--border)" } as CSSProperties}>
                    <div style={{ flex: "1" } as CSSProperties}>
                      <div style={{ fontSize: "13px", fontWeight: "500" } as CSSProperties}>
                        {"OpenAI"}
                      </div>
                      <div style={{ fontFamily: "var(--mono)", fontSize: "11.5px", color: "var(--text-3)", marginTop: "2px" } as CSSProperties}>
                        {"sk-••••••••••••1a2b"}
                      </div>
                    </div>
                    <span style={{ fontSize: "12px", color: "var(--text-2)", cursor: "pointer" } as CSSProperties}>
                      {"Test connection"}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--text-2)", cursor: "pointer" } as CSSProperties}>
                      {"Replace"}
                    </span>
                    <span style={{ fontSize: "12px", color: "#B03B2E", cursor: "pointer" } as CSSProperties}>
                      {"Remove"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px" } as CSSProperties}>
                    <div style={{ flex: "1" } as CSSProperties}>
                      <div style={{ fontSize: "13px", fontWeight: "500" } as CSSProperties}>
                        {"Anthropic"}
                      </div>
                      <div style={{ fontFamily: "var(--mono)", fontSize: "11.5px", color: "var(--text-3)", marginTop: "2px" } as CSSProperties}>
                        {"sk-ant-••••••••88f0"}
                      </div>
                    </div>
                    <span style={{ fontSize: "12px", color: "var(--text-2)", cursor: "pointer" } as CSSProperties}>
                      {"Test connection"}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--text-2)", cursor: "pointer" } as CSSProperties}>
                      {"Replace"}
                    </span>
                    <span style={{ fontSize: "12px", color: "#B03B2E", cursor: "pointer" } as CSSProperties}>
                      {"Remove"}
                    </span>
                  </div>
                </div>
                <div style={{ display: "inline-block", padding: "8px 16px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "13px", fontWeight: "500", cursor: "pointer" } as CSSProperties}>
                  {"添加 API Key"}
                </div>
              </>
            )}
            {isPermissions && (
              <>
                <div style={{ fontSize: "20px", fontWeight: "600", marginBottom: "6px" } as CSSProperties}>
                  {"Permissions"}
                </div>
                <div style={{ fontSize: "12.5px", color: "var(--text-2)", marginBottom: "20px" } as CSSProperties}>
                  {"控制 Pilot Agent 在此 Workspace 中可以执行的操作"}
                </div>
                <div style={{ border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden" } as CSSProperties}>
                  <div style={{ display: "flex", alignItems: "center", padding: "13px 16px", borderBottom: "1px solid var(--border)" } as CSSProperties}>
                    <span style={{ flex: "1", fontSize: "13.5px" } as CSSProperties}>
                      {"Read Files"}
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "#3F7A3B", background: "#E4F0E2", padding: "4px 11px", borderRadius: "20px" } as CSSProperties}>
                      {"Always allow"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", padding: "13px 16px", borderBottom: "1px solid var(--border)" } as CSSProperties}>
                    <span style={{ flex: "1", fontSize: "13.5px" } as CSSProperties}>
                      {"Write Files"}
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--accent-dark)", background: "var(--accent-soft)", padding: "4px 11px", borderRadius: "20px" } as CSSProperties}>
                      {"Allow in workspace"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", padding: "13px 16px", borderBottom: "1px solid var(--border)" } as CSSProperties}>
                    <span style={{ flex: "1", fontSize: "13.5px" } as CSSProperties}>
                      {"Modify Notebook"}
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--accent-dark)", background: "var(--accent-soft)", padding: "4px 11px", borderRadius: "20px" } as CSSProperties}>
                      {"Allow in workspace"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", padding: "13px 16px", borderBottom: "1px solid var(--border)" } as CSSProperties}>
                    <span style={{ flex: "1", fontSize: "13.5px" } as CSSProperties}>
                      {"Execute Python"}
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-2)", background: "var(--surface-2)", padding: "4px 11px", borderRadius: "20px" } as CSSProperties}>
                      {"Ask every time"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", padding: "13px 16px", borderBottom: "1px solid var(--border)" } as CSSProperties}>
                    <span style={{ flex: "1", fontSize: "13.5px" } as CSSProperties}>
                      {"Run Terminal"}
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-2)", background: "var(--surface-2)", padding: "4px 11px", borderRadius: "20px" } as CSSProperties}>
                      {"Ask every time"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", padding: "13px 16px", borderBottom: "1px solid var(--border)" } as CSSProperties}>
                    <span style={{ flex: "1", fontSize: "13.5px" } as CSSProperties}>
                      {"Network Access"}
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "#B03B2E", background: "#F5E1DD", padding: "4px 11px", borderRadius: "20px" } as CSSProperties}>
                      {"Deny"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", padding: "13px 16px" } as CSSProperties}>
                    <span style={{ flex: "1", fontSize: "13.5px" } as CSSProperties}>
                      {"Dangerous Commands"}
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "#B03B2E", background: "#F5E1DD", padding: "4px 11px", borderRadius: "20px" } as CSSProperties}>
                      {"Deny"}
                    </span>
                  </div>
                </div>
              </>
            )}
            {isAppearance && (
              <>
                <div style={{ fontSize: "20px", fontWeight: "600", marginBottom: "6px" } as CSSProperties}>
                  {"Appearance"}
                </div>
                <div style={{ fontSize: "12.5px", color: "var(--text-2)", marginBottom: "24px" } as CSSProperties}>
                  {"编辑区沿用 JupyterLab CodeMirror 6，外层使用 Pipyter 的轻量交互样式。"}
                </div>
                <div style={{ marginBottom: "26px" } as CSSProperties}>
                  <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px" } as CSSProperties}>
                    {"代码渲染主题"}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-2)", marginBottom: "10px" } as CSSProperties}>
                    {"所有主题均为浅色背景；默认值与 JupyterLab Light 一致。"}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px" } as CSSProperties}>
                    {codeThemeOptions.map((option) => {
                      const active = codeTheme === option.id
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => onCodeThemeChange(option.id)}
                          style={{
                            padding: "10px",
                            borderRadius: "5px",
                            border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                            background: active ? "var(--accent-soft)" : "var(--surface)",
                            color: "var(--text)",
                            textAlign: "left",
                            cursor: "pointer",
                            boxShadow: active ? "0 0 0 1px rgba(35, 131, 226, .08)" : "none",
                          } as CSSProperties}
                        >
                          <span style={{ display: "block", height: "32px", borderRadius: "3px", background: option.background, border: "1px solid var(--border)", marginBottom: "8px", position: "relative", overflow: "hidden" } as CSSProperties}>
                            <span style={{ position: "absolute", left: "8px", top: "8px", width: "42%", height: "3px", borderRadius: "1px", background: option.accent } as CSSProperties} />
                            <span style={{ position: "absolute", left: "8px", top: "16px", width: "64%", height: "3px", borderRadius: "1px", background: "var(--text-3)", opacity: ".55" } as CSSProperties} />
                          </span>
                          <span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", marginBottom: "3px" } as CSSProperties}>
                            {option.label}
                          </span>
                          <span style={{ display: "block", fontSize: "11px", lineHeight: "1.45", color: "var(--text-2)" } as CSSProperties}>
                            {option.description}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px" } as CSSProperties}>
                    {"Workspace 密度"}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-2)", marginBottom: "10px" } as CSSProperties}>
                    {"紧凑模式会缩短 Cell 间距与工具栏留白。"}
                  </div>
                  <div style={{ display: "flex", gap: "8px" } as CSSProperties}>
                    {([['comfortable', '舒适'], ['compact', '紧凑']] as const).map(([value, label]) => {
                      const active = density === value
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => onDensityChange(value)}
                          style={{
                            padding: "7px 14px",
                            borderRadius: "4px",
                            border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                            background: active ? "var(--accent-soft)" : "var(--surface)",
                            color: active ? "var(--accent-dark)" : "var(--text-2)",
                            fontSize: "12.5px",
                            fontWeight: active ? "600" : "500",
                            cursor: "pointer",
                          } as CSSProperties}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
            {isAccount && (
              <>
                <div style={{ fontSize: "20px", fontWeight: "600", marginBottom: "24px" } as CSSProperties}>
                  {"Account"}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px" } as CSSProperties}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--accent-soft)", color: "var(--accent-dark)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px", fontWeight: "600" } as CSSProperties}>
                    {"王"}
                  </div>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: "600" } as CSSProperties}>
                      {"王贝"}
                    </div>
                    <div style={{ fontSize: "12.5px", color: "var(--text-2)" } as CSSProperties}>
                      {"wangbei@lingbot-va.ai"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", marginBottom: "24px" } as CSSProperties}>
                  <div>
                    <div style={{ fontSize: "13.5px", fontWeight: "500" } as CSSProperties}>
                      {"当前方案"}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-2)", marginTop: "2px" } as CSSProperties}>
                      {"Research Pro · 续订于 2027-01-12"}
                    </div>
                  </div>
                  <div style={{ padding: "7px 14px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12.5px", fontWeight: "500", cursor: "pointer" } as CSSProperties}>
                    {"管理订阅"}
                  </div>
                </div>
                <div style={{ display: "inline-block", padding: "8px 16px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "13px", fontWeight: "500", cursor: "pointer" } as CSSProperties}>
                  {"退出登录"}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
