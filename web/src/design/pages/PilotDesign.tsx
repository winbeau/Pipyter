import type { CSSProperties } from 'react'

export type PilotDesignProps = {
  panelToggleStyle: CSSProperties
  togglePanel: () => void
  panelOpen: boolean
}

export function PilotDesign({
  panelOpen,
  panelToggleStyle,
  togglePanel,
}: PilotDesignProps) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "row", minWidth: "0", fontFamily: "'Inter',sans-serif", "--bg": "#FAF7F2", "--surface": "#FFFFFF", "--surface-2": "#F1ECE2", "--border": "#E3DDCE", "--text": "#211C15", "--text-2": "#6E6656", "--text-3": "#A79C89", "--accent": "#C1622C", "--accent-soft": "#F2E1D2", "--accent-dark": "#96481C", "--dark-bg": "#1B1815", "--dark-surface": "#242019", "--dark-surface-2": "#2D281F", "--dark-border": "#3A342A", "--dark-text": "#EDE7DC", "--dark-text-2": "#A79C89", "--mono": "'IBM Plex Mono',monospace", background: "var(--bg)", color: "var(--text)" } as CSSProperties}>
      <div style={{ width: "236px", flexShrink: "0", borderRight: "1px solid var(--border)", background: "var(--surface)", display: "flex", flexDirection: "column" } as CSSProperties}>
        <div style={{ padding: "16px 16px 8px" } as CSSProperties}>
          <div style={{ fontSize: "10.5px", fontWeight: "600", color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "6px" } as CSSProperties}>
            {"当前 Workspace"}
          </div>
          <div style={{ fontSize: "13.5px", fontWeight: "600" } as CSSProperties}>
            {"LingBot-VA"}
          </div>
          <div style={{ fontSize: "11.5px", color: "var(--text-3)", marginTop: "2px" } as CSSProperties}>
            {"attention_sparsity"}
          </div>
        </div>
        <div style={{ padding: "16px", flex: "1", overflow: "auto" } as CSSProperties}>
          <div style={{ fontSize: "10.5px", fontWeight: "600", color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "10px" } as CSSProperties}>
            {"最近 Agent Sessions"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" } as CSSProperties}>
            <div style={{ padding: "10px 12px", borderRadius: "9px", background: "var(--accent-soft)" } as CSSProperties}>
              <div style={{ fontSize: "12.5px", fontWeight: "600", color: "var(--accent-dark)", lineHeight: "1.4" } as CSSProperties}>
                {"修复稀疏度骤降渲染"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "6px" } as CSSProperties}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent)", animation: "pulse-dot 2s infinite", flexShrink: "0" } as CSSProperties}>
                </span>
                <span style={{ fontSize: "11px", color: "var(--accent-dark)" } as CSSProperties}>
                  {"Running"}
                </span>
              </div>
            </div>
            <div style={{ padding: "10px 12px", borderRadius: "9px", cursor: "pointer" } as CSSProperties}>
              <div style={{ fontSize: "12.5px", fontWeight: "500" } as CSSProperties}>
                {"生成消融实验对比图"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "4px" } as CSSProperties}>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="#5FA85A" strokeWidth="1.8">
                  <path d="M3 8.5l3 3 7-8" />
                </svg>
                <span style={{ fontSize: "11px", color: "var(--text-3)" } as CSSProperties}>
                  {"Completed · 8 分钟前"}
                </span>
              </div>
            </div>
            <div style={{ padding: "10px 12px", borderRadius: "9px", cursor: "pointer" } as CSSProperties}>
              <div style={{ fontSize: "12.5px", fontWeight: "500" } as CSSProperties}>
                {"同步 kernel 环境依赖"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "4px" } as CSSProperties}>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="#C0564A" strokeWidth="1.8">
                  <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
                </svg>
                <span style={{ fontSize: "11px", color: "var(--text-3)" } as CSSProperties}>
                  {"Failed · 40 分钟前"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* CENTER: AGENT WORKING FEED */}
      <div style={{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column" } as CSSProperties}>
        <div style={{ flex: "1", overflow: "auto" } as CSSProperties}>
          <div style={{ maxWidth: "820px", margin: "0 auto", padding: "32px 32px 40px" } as CSSProperties}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" } as CSSProperties}>
              <div style={{ fontSize: "20px", fontWeight: "600" } as CSSProperties}>
                {"修复 plot_pipeline 稀疏度骤降渲染"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" } as CSSProperties}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", fontWeight: "600", color: "var(--accent-dark)", background: "var(--accent-soft)", padding: "4px 12px", borderRadius: "20px" } as CSSProperties}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent)", animation: "pulse-dot 2s infinite" } as CSSProperties}>
                  </span>
                  {"Running"}
                </span>
                <div style={panelToggleStyle} onClick={togglePanel}>
                  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <rect x="2.5" y="3" width="15" height="14" rx="2" />
                    <path d="M13.5 3v14" />
                  </svg>
                  <span style={{ fontSize: "12px", fontWeight: "500" } as CSSProperties}>
                    {"详情"}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ fontSize: "12.5px", color: "var(--text-3)", marginBottom: "14px" } as CSSProperties}>
              {"LingBot-VA / attention_sparsity"}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "7px", marginBottom: "28px" } as CSSProperties}>
              <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 11px", background: "var(--surface-2)", borderRadius: "20px", fontSize: "11.5px", color: "var(--text-2)" } as CSSProperties}>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="2.5" y="2" width="11" height="12" rx="1" />
                </svg>
                {"plot_pipeline.ipynb"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 11px", background: "var(--surface-2)", borderRadius: "20px", fontSize: "11.5px", color: "var(--text-2)" } as CSSProperties}>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="2.5" y="2" width="11" height="12" rx="1" />
                </svg>
                {"compute_sparsity.py"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 11px", background: "var(--surface-2)", borderRadius: "20px", fontSize: "11.5px", color: "var(--text-2)" } as CSSProperties}>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
                  <path d="M2 9l3-3.5 2 2 3.5-4.5" />
                  <rect x="2" y="2" width="12" height="12" rx="1.5" />
                </svg>
                {"layer_sparsity_curve.png"}
              </div>
            </div>
            {/* TASK TIMELINE */}
            <div style={{ border: "1px solid var(--border)", borderRadius: "12px", padding: "18px 20px", marginBottom: "22px" } as CSSProperties}>
              <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "14px" } as CSSProperties}>
                {"Plan"}
              </div>
              <div style={{ display: "flex", flexDirection: "column" } as CSSProperties}>
                <div style={{ display: "flex", gap: "12px" } as CSSProperties}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" } as CSSProperties}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#5FA85A" strokeWidth="1.8">
                      <circle cx="8" cy="8" r="6.5" />
                      <path d="M5 8l2 2 4-4.5" />
                    </svg>
                    <div style={{ width: "1.5px", flex: "1", background: "#5FA85A", marginTop: "2px" } as CSSProperties}>
                    </div>
                  </div>
                  <div style={{ paddingBottom: "16px" } as CSSProperties}>
                    <div style={{ fontSize: "13px", fontWeight: "600" } as CSSProperties}>
                      {"Tasks"}
                    </div>
                    <div style={{ fontSize: "11.5px", color: "var(--text-3)", marginTop: "1px" } as CSSProperties}>
                      {"4 项子任务 · 已规划"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "12px" } as CSSProperties}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" } as CSSProperties}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#5FA85A" strokeWidth="1.8">
                      <circle cx="8" cy="8" r="6.5" />
                      <path d="M5 8l2 2 4-4.5" />
                    </svg>
                    <div style={{ width: "1.5px", flex: "1", background: "#5FA85A", marginTop: "2px" } as CSSProperties}>
                    </div>
                  </div>
                  <div style={{ paddingBottom: "16px" } as CSSProperties}>
                    <div style={{ fontSize: "13px", fontWeight: "600" } as CSSProperties}>
                      {"Planning"}
                    </div>
                    <div style={{ fontSize: "11.5px", color: "var(--text-3)", marginTop: "1px" } as CSSProperties}>
                      {"定位 window 参数为骤降根因"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "12px" } as CSSProperties}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" } as CSSProperties}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#5FA85A" strokeWidth="1.8">
                      <circle cx="8" cy="8" r="6.5" />
                      <path d="M5 8l2 2 4-4.5" />
                    </svg>
                    <div style={{ width: "1.5px", flex: "1", background: "#5FA85A", marginTop: "2px" } as CSSProperties}>
                    </div>
                  </div>
                  <div style={{ paddingBottom: "16px" } as CSSProperties}>
                    <div style={{ fontSize: "13px", fontWeight: "600" } as CSSProperties}>
                      {"Updating"}
                    </div>
                    <div style={{ fontSize: "11.5px", color: "var(--text-3)", marginTop: "1px" } as CSSProperties}>
                      {"compute_sparsity.py · plot_pipeline.ipynb"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "12px" } as CSSProperties}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" } as CSSProperties}>
                    <span style={{ width: "16px", height: "16px", borderRadius: "50%", border: "2px solid var(--accent)", borderTopColor: "transparent", animation: "spin 1s linear infinite" } as CSSProperties}>
                    </span>
                    <div style={{ width: "1.5px", flex: "1", background: "var(--border)", marginTop: "2px" } as CSSProperties}>
                    </div>
                  </div>
                  <div style={{ paddingBottom: "16px" } as CSSProperties}>
                    <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--accent-dark)" } as CSSProperties}>
                      {"Running"}
                    </div>
                    <div style={{ fontSize: "11.5px", color: "var(--text-3)", marginTop: "1px" } as CSSProperties}>
                      {"重新计算 layer 12–20 稀疏度"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "12px" } as CSSProperties}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" } as CSSProperties}>
                    <span style={{ width: "16px", height: "16px", borderRadius: "50%", border: "1.5px solid var(--border)" } as CSSProperties}>
                    </span>
                    <div style={{ width: "1.5px", flex: "1", background: "var(--border)", marginTop: "2px" } as CSSProperties}>
                    </div>
                  </div>
                  <div style={{ paddingBottom: "16px" } as CSSProperties}>
                    <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--text-3)" } as CSSProperties}>
                      {"Inspecting"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "12px" } as CSSProperties}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" } as CSSProperties}>
                    <span style={{ width: "16px", height: "16px", borderRadius: "50%", border: "1.5px solid var(--border)" } as CSSProperties}>
                    </span>
                    <div style={{ width: "1.5px", flex: "1", background: "var(--border)", marginTop: "2px" } as CSSProperties}>
                    </div>
                  </div>
                  <div style={{ paddingBottom: "16px" } as CSSProperties}>
                    <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--text-3)" } as CSSProperties}>
                      {"Testing"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "12px" } as CSSProperties}>
                  <span style={{ width: "16px", height: "16px", borderRadius: "50%", border: "1.5px solid var(--border)" } as CSSProperties}>
                  </span>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--text-3)" } as CSSProperties}>
                      {"Completed"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* APPROVAL: RUN COMMAND */}
            <div style={{ border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 18px", marginBottom: "22px", background: "var(--surface)" } as CSSProperties}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" } as CSSProperties}>
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="var(--accent-dark)" strokeWidth="1.6">
                  <circle cx="10" cy="10" r="6.5" />
                  <circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none" />
                </svg>
                <span style={{ fontSize: "13.5px", fontWeight: "600" } as CSSProperties}>
                  {"Pi 想要运行以下命令"}
                </span>
              </div>
              <div style={{ background: "var(--dark-bg)", borderRadius: "8px", padding: "10px 14px", fontFamily: "var(--mono)", fontSize: "12px", color: "var(--dark-text)", marginBottom: "12px", overflow: "auto" } as CSSProperties}>
                {"python3 notebooks/attention_sparsity/compute_sparsity.py --layers 12-20"}
              </div>
              <div style={{ display: "flex", gap: "8px" } as CSSProperties}>
                <div style={{ padding: "7px 14px", background: "var(--text)", color: "var(--bg)", borderRadius: "7px", fontSize: "12px", fontWeight: "600", cursor: "pointer" } as CSSProperties}>
                  {"Allow once"}
                </div>
                <div style={{ padding: "7px 14px", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "12px", fontWeight: "500", cursor: "pointer" } as CSSProperties}>
                  {"Allow workspace"}
                </div>
                <div style={{ padding: "7px 14px", border: "1px solid var(--border)", color: "#B03B2E", borderRadius: "7px", fontSize: "12px", fontWeight: "500", cursor: "pointer" } as CSSProperties}>
                  {"Reject"}
                </div>
              </div>
            </div>
            {/* FILE DIFF */}
            <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "8px" } as CSSProperties}>
              {"File Diff · compute_sparsity.py"}
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden", marginBottom: "22px" } as CSSProperties}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 14px", borderBottom: "1px solid var(--border)", background: "var(--surface)" } as CSSProperties}>
                <span style={{ fontFamily: "var(--mono)", fontSize: "11.5px" } as CSSProperties}>
                  {"compute_sparsity.py"}
                </span>
                <span style={{ fontFamily: "var(--mono)", fontSize: "11px" } as CSSProperties}>
                  <span style={{ color: "#5FA85A" } as CSSProperties}>
                    {"+3"}
                  </span>
                  <span style={{ color: "#C0564A" } as CSSProperties}>
                    {"-1"}
                  </span>
                </span>
              </div>
              <div style={{ background: "var(--dark-bg)", padding: "12px 14px", fontFamily: "var(--mono)", fontSize: "12px", lineHeight: "1.7", color: "var(--dark-text-2)", overflow: "auto" } as CSSProperties}>
                <div>
                  {"…"}
                </div>
                <div style={{ background: "rgba(224,108,90,.15)", color: "#E39A85", padding: "2px 6px" } as CSSProperties}>
                  {"-127 curve = layer_sparsity(logs, window=4)"}
                </div>
                <div style={{ background: "rgba(127,187,106,.15)", color: "#9FCB8F", padding: "2px 6px" } as CSSProperties}>
                  {"+127 curve = layer_sparsity(logs, window=8)"}
                </div>
                <div>
                  {"…"}
                </div>
              </div>
            </div>
            {/* NOTEBOOK CELL DIFF */}
            <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "8px" } as CSSProperties}>
              {"Notebook Diff · plot_pipeline.ipynb · Cell [4]"}
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden", marginBottom: "22px" } as CSSProperties}>
              <div style={{ padding: "9px 14px", borderBottom: "1px solid var(--border)", background: "var(--surface)", fontFamily: "var(--mono)", fontSize: "11.5px", color: "var(--text-2)" } as CSSProperties}>
                {"Update(plot_pipeline.ipynb) · Cell 4"}
              </div>
              <div style={{ background: "var(--dark-bg)", padding: "12px 14px", fontFamily: "var(--mono)", fontSize: "12px", lineHeight: "1.7", color: "var(--dark-text-2)", overflow: "auto" } as CSSProperties}>
                <div>
                  {"axis=\"both\", pad=0.7, labelsize=7,"}
                </div>
                <div style={{ background: "rgba(224,108,90,.15)", color: "#E39A85", padding: "2px 6px" } as CSSProperties}>
                  {"-514 labelbottom=row == grid_rows - 1,"}
                </div>
                <div style={{ background: "rgba(127,187,106,.15)", color: "#9FCB8F", padding: "2px 6px" } as CSSProperties}>
                  {"+514 labelbottom=row == grid_rows - 1 and column % 2 == 0,"}
                </div>
                <div>
                  {"labelleft=column == 0,"}
                </div>
              </div>
            </div>
            {/* TERMINAL */}
            <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "8px" } as CSSProperties}>
              {"Terminal"}
            </div>
            <div style={{ background: "var(--dark-bg)", borderRadius: "12px", padding: "14px 16px", marginBottom: "22px", fontFamily: "var(--mono)", fontSize: "12px", lineHeight: "1.7", color: "var(--dark-text-2)", overflow: "auto" } as CSSProperties}>
              <div style={{ color: "var(--dark-text)" } as CSSProperties}>
                {"$ python3 notebooks/attention_sparsity/compute_sparsity.py --layers 12-20"}
              </div>
              <div>
                {"layer 12 sparsity 0.71"}
              </div>
              <div>
                {"layer 15 sparsity 0.68"}
              </div>
              <div>
                {"layer 18 sparsity 0.66"}
              </div>
              <div>
                {"layer 20 sparsity 0.69"}
              </div>
              <div style={{ color: "#9FCB8F" } as CSSProperties}>
                {"✓ exited 0 · 2.4s"}
              </div>
            </div>
            {/* TOOL ACTIVITY */}
            <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "8px" } as CSSProperties}>
              {"Tool Activity"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "22px" } as CSSProperties}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "8px", fontFamily: "var(--mono)", fontSize: "11.5px" } as CSSProperties}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#5FA85A" strokeWidth="1.8" style={{ flexShrink: "0" } as CSSProperties}>
                  <path d="M3 8.5l3 3 7-8" />
                </svg>
                <span style={{ flex: "1" } as CSSProperties}>
                  {"Read(compute_sparsity.py)"}
                </span>
                <span style={{ color: "var(--text-3)" } as CSSProperties}>
                  {"10:41"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "8px", fontFamily: "var(--mono)", fontSize: "11.5px" } as CSSProperties}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#5FA85A" strokeWidth="1.8" style={{ flexShrink: "0" } as CSSProperties}>
                  <path d="M3 8.5l3 3 7-8" />
                </svg>
                <span style={{ flex: "1" } as CSSProperties}>
                  {"Update(compute_sparsity.py)"}
                </span>
                <span style={{ color: "var(--text-3)" } as CSSProperties}>
                  {"10:42"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "8px", fontFamily: "var(--mono)", fontSize: "11.5px" } as CSSProperties}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#5FA85A" strokeWidth="1.8" style={{ flexShrink: "0" } as CSSProperties}>
                  <path d="M3 8.5l3 3 7-8" />
                </svg>
                <span style={{ flex: "1" } as CSSProperties}>
                  {"Grep(layer_sparsity)"}
                </span>
                <span style={{ color: "var(--text-3)" } as CSSProperties}>
                  {"10:42"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "8px", fontFamily: "var(--mono)", fontSize: "11.5px" } as CSSProperties}>
                <span style={{ width: "12px", height: "12px", borderRadius: "50%", border: "1.6px solid var(--accent)", borderTopColor: "transparent", animation: "spin 1s linear infinite", flexShrink: "0" } as CSSProperties}>
                </span>
                <span style={{ flex: "1" } as CSSProperties}>
                  {"Bash(python3 compute_sparsity.py --layers 12-20)"}
                </span>
                <span style={{ color: "var(--text-3)" } as CSSProperties}>
                  {"10:43"}
                </span>
              </div>
            </div>
            {/* APPROVAL: MODIFY NOTEBOOK */}
            <div style={{ border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 18px", background: "var(--surface)" } as CSSProperties}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" } as CSSProperties}>
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="var(--accent-dark)" strokeWidth="1.6">
                  <circle cx="10" cy="10" r="6.5" />
                  <circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none" />
                </svg>
                <span style={{ fontSize: "13.5px", fontWeight: "600" } as CSSProperties}>
                  {"Pi 想要修改 plot_pipeline.ipynb"}
                </span>
              </div>
              <div style={{ fontSize: "12.5px", color: "var(--text-2)", marginBottom: "12px" } as CSSProperties}>
                {"在 Cell 4 中为奇数列添加坐标轴标签，避免骤降区间图例重叠。"}
              </div>
              <div style={{ display: "flex", gap: "8px" } as CSSProperties}>
                <div style={{ padding: "7px 14px", background: "var(--text)", color: "var(--bg)", borderRadius: "7px", fontSize: "12px", fontWeight: "600", cursor: "pointer" } as CSSProperties}>
                  {"Apply"}
                </div>
                <div style={{ padding: "7px 14px", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "12px", fontWeight: "500", cursor: "pointer" } as CSSProperties}>
                  {"Revert"}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ flexShrink: "0", padding: "14px 32px 20px", borderTop: "1px solid var(--border)", background: "var(--bg)" } as CSSProperties}>
          <div style={{ maxWidth: "820px", margin: "0 auto", display: "flex", alignItems: "center", gap: "10px", border: "1px solid var(--border)", background: "var(--surface)", borderRadius: "22px", padding: "9px 16px" } as CSSProperties}>
            <span style={{ flex: "1", fontSize: "12.5px", color: "var(--text-3)" } as CSSProperties}>
              {"向 Pi 下达任务或提问…"}
            </span>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="var(--text-2)" strokeWidth="1.6">
              <path d="M4 10h12M11 5l5 5-5 5" />
            </svg>
          </div>
        </div>
      </div>
      {/* RIGHT: DETAIL PANEL (opens on demand) */}
      {panelOpen && (
        <>
          <div style={{ width: "320px", flexShrink: "0", borderLeft: "1px solid var(--border)", background: "var(--surface)", display: "flex", flexDirection: "column" } as CSSProperties}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid var(--border)" } as CSSProperties}>
              <div style={{ fontSize: "13.5px", fontWeight: "600" } as CSSProperties}>
                {"详情"}
              </div>
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="var(--text-2)" strokeWidth="1.6" style={{ cursor: "pointer" } as CSSProperties} onClick={togglePanel}>
                <path d="M6 6l8 8M14 6l-8 8" />
              </svg>
            </div>
            <div style={{ flex: "1", overflow: "auto" } as CSSProperties}>
              <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)" } as CSSProperties}>
                <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "10px" } as CSSProperties}>
                  {"Context"}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" } as CSSProperties}>
                  <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: "var(--surface-2)", color: "var(--text-2)" } as CSSProperties}>
                    {"LingBot-VA"}
                  </span>
                  <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: "var(--surface-2)", color: "var(--text-2)" } as CSSProperties}>
                    {"plot_pipeline.ipynb"}
                  </span>
                  <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: "var(--surface-2)", color: "var(--text-2)" } as CSSProperties}>
                    {"compute_sparsity.py"}
                  </span>
                  <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: "var(--surface-2)", color: "var(--text-2)" } as CSSProperties}>
                    {"layer_sparsity_curve.png"}
                  </span>
                </div>
              </div>
              <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)" } as CSSProperties}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", marginBottom: "8px" } as CSSProperties}>
                  <span style={{ color: "var(--text-2)" } as CSSProperties}>
                    {"模型"}
                  </span>
                  <span style={{ fontWeight: "600" } as CSSProperties}>
                    {"Pilot Reasoning"}
                  </span>
                </div>
                <div style={{ fontSize: "12.5px", color: "var(--text-2)", marginBottom: "6px" } as CSSProperties}>
                  {"已授权工具"}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" } as CSSProperties}>
                  <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", border: "1px solid var(--border)", fontFamily: "var(--mono)" } as CSSProperties}>
                    {"Read"}
                  </span>
                  <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", border: "1px solid var(--border)", fontFamily: "var(--mono)" } as CSSProperties}>
                    {"Update"}
                  </span>
                  <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", border: "1px solid var(--border)", fontFamily: "var(--mono)" } as CSSProperties}>
                    {"Bash"}
                  </span>
                  <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", border: "1px solid var(--border)", fontFamily: "var(--mono)" } as CSSProperties}>
                    {"Grep"}
                  </span>
                </div>
              </div>
              <div style={{ padding: "16px 18px" } as CSSProperties}>
                <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "10px" } as CSSProperties}>
                  {"推荐下一步"}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" } as CSSProperties}>
                  <div style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12.5px", cursor: "pointer" } as CSSProperties}>
                    {"运行完整消融测试"}
                  </div>
                  <div style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12.5px", cursor: "pointer" } as CSSProperties}>
                    {"生成对比图并归档到 Figures"}
                  </div>
                  <div style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12.5px", cursor: "pointer" } as CSSProperties}>
                    {"同步结果到 baseline-eval"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
