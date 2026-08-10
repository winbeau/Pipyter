import type { CSSProperties } from 'react'

export type WorkspaceDesignProps = {
  pilotToggleStyle: CSSProperties
  togglePilot: () => void
  pilotCollapsed: boolean
  pilotOpen: boolean
}

export function WorkspaceDesign({
  pilotCollapsed,
  pilotOpen,
  pilotToggleStyle,
  togglePilot,
}: WorkspaceDesignProps) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "row", minWidth: "0", fontFamily: "'Inter',sans-serif", "--bg": "#FAF7F2", "--surface": "#FFFFFF", "--surface-2": "#F1ECE2", "--border": "#E3DDCE", "--text": "#211C15", "--text-2": "#6E6656", "--text-3": "#A79C89", "--accent": "#C1622C", "--accent-soft": "#F2E1D2", "--accent-dark": "#96481C", "--dark-bg": "#1B1815", "--dark-surface": "#242019", "--dark-surface-2": "#2D281F", "--dark-border": "#3A342A", "--dark-text": "#EDE7DC", "--dark-text-2": "#A79C89", "--mono": "'IBM Plex Mono',monospace", background: "var(--bg)", color: "var(--text)" } as CSSProperties}>
      {/* FILE TREE */}
      <div style={{ width: "230px", flexShrink: "0", borderRight: "1px solid var(--border)", background: "var(--surface)", display: "flex", flexDirection: "column" } as CSSProperties}>
        <div style={{ padding: "16px 14px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" } as CSSProperties}>
          <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".05em" } as CSSProperties}>
            {"LingBot-VA"}
          </div>
          <div style={{ display: "flex", gap: "4px", color: "var(--text-3)" } as CSSProperties}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ cursor: "pointer" } as CSSProperties}>
              <path d="M8 3v10M3 8h10" />
            </svg>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ cursor: "pointer" } as CSSProperties}>
              <path d="M8 2v8M5 7l3 3 3-3" />
              <path d="M3 13h10" />
            </svg>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ cursor: "pointer" } as CSSProperties}>
              <path d="M13.5 8a5.5 5.5 0 11-1.6-3.9M13.5 3v4h-4" />
            </svg>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ cursor: "pointer" } as CSSProperties}>
              <path d="M3 5h10M5 5V3.5h6V5M4 5l.6 8a1 1 0 001 .9h4.8a1 1 0 001-.9L12 5" />
            </svg>
          </div>
        </div>
        <div style={{ padding: "0 10px 12px", flex: "1", overflow: "auto", fontSize: "12.5px" } as CSSProperties}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 8px", color: "var(--text-2)", fontWeight: "500" } as CSSProperties}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="var(--text-3)">
              <path d="M2 3l4 4 4-4z" />
            </svg>
            {"notebooks"}
          </div>
          <div style={{ marginLeft: "15px" } as CSSProperties}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 8px", color: "var(--text-2)", fontWeight: "500" } as CSSProperties}>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="var(--text-3)">
                <path d="M2 3l4 4 4-4z" />
              </svg>
              {"attention_sparsity"}
            </div>
            <div style={{ marginLeft: "15px" } as CSSProperties}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", borderRadius: "6px", background: "var(--accent-soft)", color: "var(--accent-dark)", fontWeight: "500" } as CSSProperties}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <rect x="2.5" y="2" width="11" height="12" rx="1" />
                  <path d="M5 5.5h6M5 8h6M5 10.5h3.5" />
                </svg>
                {"sparsity_curve_analysis.ipynb "}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", borderRadius: "6px", color: "var(--text)", cursor: "pointer" } as CSSProperties}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--text-3)" strokeWidth="1.4">
                  <rect x="2.5" y="2" width="11" height="12" rx="1" />
                  <path d="M5.5 5.5l1.5 1.5-1.5 1.5M8.5 8.5h2" />
                </svg>
                {"compute_sparsity.py "}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 8px", color: "var(--text-2)", fontWeight: "500", marginTop: "2px" } as CSSProperties}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="var(--text-3)">
              <path d="M2 3l4 4 4-4z" />
            </svg>
            {"figures"}
          </div>
          <div style={{ marginLeft: "15px" } as CSSProperties}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", borderRadius: "6px", color: "var(--text)", cursor: "pointer" } as CSSProperties}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--text-3)" strokeWidth="1.4">
                <rect x="2.5" y="2.5" width="11" height="11" rx="1" />
                <path d="M5 9l2-2.5 1.8 1.8 2.5-3" />
              </svg>
              {"layer_sparsity_curve.png"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 8px", color: "var(--text-2)", fontWeight: "500", marginTop: "2px" } as CSSProperties}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="var(--text-3)">
              <path d="M4 2l4 4-4 4z" />
            </svg>
            {"data"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 8px", color: "var(--text-2)", fontWeight: "500" } as CSSProperties}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="var(--text-3)">
              <path d="M4 2l4 4-4 4z" />
            </svg>
            {"scripts"}
          </div>
        </div>
      </div>
      {/* NOTEBOOK MAIN */}
      <div style={{ flex: "1", display: "flex", flexDirection: "column", minWidth: "0" } as CSSProperties}>
        <div style={{ height: "54px", flexShrink: "0", display: "flex", alignItems: "center", gap: "18px", padding: "0 20px", borderBottom: "1px solid var(--border)" } as CSSProperties}>
          <div style={{ fontSize: "13px", color: "var(--text-2)", whiteSpace: "nowrap" } as CSSProperties}>
            {"LingBot-VA / attention_sparsity / "}
            <span style={{ color: "var(--text)", fontWeight: "600" } as CSSProperties}>
              {"sparsity_curve_analysis.ipynb"}
            </span>
          </div>
          <div style={{ flex: "1", display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", border: "1px solid var(--border)", borderRadius: "20px", color: "var(--text-3)", fontSize: "12.5px", maxWidth: "280px", minWidth: "180px", whiteSpace: "nowrap", overflow: "hidden" } as CSSProperties}>
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="var(--text-3)" strokeWidth="1.6">
              <circle cx="9" cy="9" r="6" />
              <path d="M13.5 13.5L17 17" />
            </svg>
            {"搜索文件 / 命令…"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--text-2)", whiteSpace: "nowrap" } as CSSProperties}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#5FA85A" strokeWidth="1.6">
              <path d="M3 8.5l3 3 7-8" />
            </svg>
            {"已同步"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: "var(--text-2)", padding: "5px 10px", border: "1px solid var(--border)", borderRadius: "20px", whiteSpace: "nowrap" } as CSSProperties}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#5FA85A", animation: "pulse-dot 2s infinite" } as CSSProperties}>
            </span>
            {"Python 3.11 · Idle"}
          </div>
        </div>
        <div style={{ height: "44px", flexShrink: "0", display: "flex", alignItems: "center", gap: "16px", padding: "0 20px", borderBottom: "1px solid var(--border)" } as CSSProperties}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" } as CSSProperties}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="var(--text)" style={{ cursor: "pointer" } as CSSProperties}>
              <path d="M6 4l10 6-10 6z" />
            </svg>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="var(--text-2)" strokeWidth="1.7" style={{ cursor: "pointer" } as CSSProperties}>
              <path d="M4 6h12M8 6v9M12 6v9" />
              <rect x="6" y="3" width="8" height="3" rx="1" />
            </svg>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="var(--text-2)" strokeWidth="1.6" style={{ cursor: "pointer" } as CSSProperties}>
              <rect x="5" y="5" width="10" height="10" rx="1.5" />
            </svg>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="var(--text-2)" strokeWidth="1.6" style={{ cursor: "pointer" } as CSSProperties}>
              <path d="M15.5 8A5.5 5.5 0 114.7 6.2M15.5 3v4.5H11" />
            </svg>
          </div>
          <div style={{ width: "1px", height: "20px", background: "var(--border)" } as CSSProperties}>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" } as CSSProperties}>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="var(--text-2)" strokeWidth="1.6" style={{ cursor: "pointer" } as CSSProperties}>
              <path d="M10 4v12M4 10h12" />
            </svg>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="var(--text-2)" strokeWidth="1.6" style={{ cursor: "pointer" } as CSSProperties}>
              <path d="M14 6l-8 8M6 6l8 8" />
            </svg>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="var(--text-2)" strokeWidth="1.6" style={{ cursor: "pointer" } as CSSProperties}>
              <path d="M6 5l-3 3 3 3M14 5l3 3-3 3" />
            </svg>
          </div>
          <div style={{ flex: "1" } as CSSProperties}>
          </div>
          <div style={pilotToggleStyle} onClick={togglePilot}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="10" cy="10" r="6.5" />
              <circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none" />
            </svg>
            <span style={{ fontSize: "12px", fontWeight: "500" } as CSSProperties}>
              {"Pilot"}
            </span>
          </div>
        </div>
        <div style={{ flex: "1", overflow: "auto" } as CSSProperties}>
          <div style={{ maxWidth: "840px", margin: "0 auto", padding: "36px 28px 100px" } as CSSProperties}>
            <div style={{ fontSize: "22px", fontWeight: "600", marginBottom: "4px" } as CSSProperties}>
              {"sparsity_curve_analysis.ipynb"}
            </div>
            <div style={{ fontSize: "12.5px", color: "var(--text-3)", marginBottom: "32px" } as CSSProperties}>
              {"最后编辑于 12 分钟前 · 由 Pilot 协作"}
            </div>
            <div style={{ display: "flex", gap: "14px", marginBottom: "6px" } as CSSProperties}>
              <div style={{ width: "22px", flexShrink: "0" } as CSSProperties}>
              </div>
              <div style={{ flex: "1", fontSize: "14.5px", lineHeight: "1.75" } as CSSProperties}>
                <p style={{ margin: "0 0 10px" } as CSSProperties}>
                  {"本 Notebook 分析 LingBot-VA 各层注意力头的稀疏度分布，重点关注 "}
                  <strong>
                    {"layer 12–20"}
                  </strong>
                  {" 区间出现的稀疏度骤降现象。"}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "14px", marginBottom: "8px" } as CSSProperties}>
              <div style={{ width: "22px", flexShrink: "0", paddingTop: "14px", fontFamily: "var(--mono)", fontSize: "11px", color: "var(--text-3)" } as CSSProperties}>
                {"[1]"}
              </div>
              <div style={{ flex: "1", background: "var(--dark-bg)", borderRadius: "10px", overflow: "hidden" } as CSSProperties}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", borderBottom: "1px solid var(--dark-border)" } as CSSProperties}>
                  <span style={{ fontSize: "11px", color: "var(--dark-text-2)", fontFamily: "var(--mono)" } as CSSProperties}>
                    {"Python"}
                  </span>
                  <div style={{ display: "flex", gap: "8px", color: "var(--dark-text-2)" } as CSSProperties}>
                    <svg width="13" height="13" viewBox="0 0 20 20" fill="var(--dark-text)" style={{ cursor: "pointer" } as CSSProperties}>
                      <path d="M6 4l10 6-10 6z" />
                    </svg>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ cursor: "pointer" } as CSSProperties}>
                      <rect x="4" y="4" width="8" height="8" rx="1" />
                      <path d="M6 4V2.5h6V4" />
                    </svg>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ cursor: "pointer" } as CSSProperties}>
                      <path d="M3 4h10M6 4V2.5h4V4M4.5 4l.5 8.5a1 1 0 001 .9h4a1 1 0 001-.9L11.5 4" />
                    </svg>
                  </div>
                </div>
                <div style={{ padding: "14px 16px", fontFamily: "var(--mono)", fontSize: "12.5px", lineHeight: "1.75", color: "var(--dark-text)" } as CSSProperties}>
                  <div>
                    <span style={{ color: "#8FA6D6" } as CSSProperties}>
                      {"import"}
                    </span>
                    {" numpy "}
                    <span style={{ color: "#8FA6D6" } as CSSProperties}>
                      {"as"}
                    </span>
                    {" np"}
                  </div>
                  <div>
                    <span style={{ color: "#8FA6D6" } as CSSProperties}>
                      {"from"}
                    </span>
                    {" compute_sparsity "}
                    <span style={{ color: "#8FA6D6" } as CSSProperties}>
                      {"import"}
                    </span>
                    {" layer_sparsity"}
                  </div>
                  <div style={{ marginTop: "8px" } as CSSProperties}>
                    {"logs = np.loadtxt("}
                    <span style={{ color: "#C9A56B" } as CSSProperties}>
                      {"\"sparsity_logs.csv\""}
                    </span>
                    {", delimiter="}
                    <span style={{ color: "#C9A56B" } as CSSProperties}>
                      {"\",\""}
                    </span>
                    {")"}
                  </div>
                  <div>
                    {"curve = layer_sparsity(logs, window="}
                    <span style={{ color: "#C9A56B" } as CSSProperties}>
                      {"8"}
                    </span>
                    {")"}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "14px", marginBottom: "24px" } as CSSProperties}>
              <div style={{ width: "22px", flexShrink: "0", paddingTop: "2px", fontFamily: "var(--mono)", fontSize: "11px", color: "var(--text-3)" } as CSSProperties}>
                {"[1]"}
              </div>
              <div style={{ flex: "1", border: "1px solid var(--border)", borderRadius: "10px", padding: "18px" } as CSSProperties}>
                <div style={{ aspectRatio: "16/7", borderRadius: "8px", background: "repeating-linear-gradient(135deg,var(--surface-2) 0px,var(--surface-2) 8px,var(--surface) 8px,var(--surface) 16px)", display: "flex", alignItems: "center", justifyContent: "center" } as CSSProperties}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: "11.5px", color: "var(--text-3)" } as CSSProperties}>
                    {"PLOT PLACEHOLDER — layer_sparsity_curve.png"}
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-2)", marginTop: "10px" } as CSSProperties}>
                  {"Fig 1. Layer-wise attention sparsity, layers 0–31 (window=8)"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "14px", marginBottom: "8px" } as CSSProperties}>
              <div style={{ width: "22px", flexShrink: "0", paddingTop: "14px", fontFamily: "var(--mono)", fontSize: "11px", color: "var(--text-3)" } as CSSProperties}>
                {"[2]"}
              </div>
              <div style={{ flex: "1", background: "var(--dark-bg)", borderRadius: "10px", overflow: "hidden" } as CSSProperties}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", borderBottom: "1px solid var(--dark-border)" } as CSSProperties}>
                  <span style={{ fontSize: "11px", color: "var(--dark-text-2)", fontFamily: "var(--mono)" } as CSSProperties}>
                    {"Python"}
                  </span>
                  <div style={{ display: "flex", gap: "8px", color: "var(--dark-text-2)" } as CSSProperties}>
                    <svg width="13" height="13" viewBox="0 0 20 20" fill="var(--dark-text)" style={{ cursor: "pointer" } as CSSProperties}>
                      <path d="M6 4l10 6-10 6z" />
                    </svg>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ cursor: "pointer" } as CSSProperties}>
                      <rect x="4" y="4" width="8" height="8" rx="1" />
                      <path d="M6 4V2.5h6V4" />
                    </svg>
                  </div>
                </div>
                <div style={{ padding: "14px 16px", fontFamily: "var(--mono)", fontSize: "12.5px", lineHeight: "1.75", color: "var(--dark-text)" } as CSSProperties}>
                  <div>
                    {"print("}
                    <span style={{ color: "#C9A56B" } as CSSProperties}>
                      {"f\"drop region mean: {curve[12:20].mean():.3f}\""}
                    </span>
                    {")"}
                  </div>
                  <div style={{ color: "var(--dark-text-2)", marginTop: "8px" } as CSSProperties}>
                    {"drop region mean: 0.612"}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "14px", color: "var(--text-3)", fontSize: "13px", padding: "8px 0", cursor: "pointer" } as CSSProperties}>
              <div style={{ width: "22px", flexShrink: "0" } as CSSProperties}>
              </div>
              <div style={{ flex: "1", padding: "10px 14px", border: "1px dashed var(--border)", borderRadius: "8px" } as CSSProperties}>
                {"+ 添加 Cell"}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* PILOT SIDEBAR */}
      {pilotOpen && (
        <>
          <div style={{ width: "400px", flexShrink: "0", background: "var(--dark-bg)", borderLeft: "1px solid var(--dark-border)", display: "flex", flexDirection: "column", color: "var(--dark-text)" } as CSSProperties}>
            <div style={{ height: "54px", flexShrink: "0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", borderBottom: "1px solid var(--dark-border)" } as CSSProperties}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" } as CSSProperties}>
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="var(--dark-text)" strokeWidth="1.6">
                  <circle cx="10" cy="10" r="6.5" />
                  <circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none" />
                </svg>
                <span style={{ fontSize: "13.5px", fontWeight: "600" } as CSSProperties}>
                  {"Pilot"}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#9FCB8F", marginLeft: "4px" } as CSSProperties}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#7FB77E", animation: "pulse-dot 2s infinite" } as CSSProperties}>
                  </span>
                  {"Active"}
                </span>
              </div>
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="var(--dark-text-2)" strokeWidth="1.6" style={{ cursor: "pointer" } as CSSProperties} onClick={togglePilot}>
                <path d="M13 4l-6 6 6 6" />
              </svg>
            </div>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--dark-border)", display: "flex", flexWrap: "wrap", gap: "6px" } as CSSProperties}>
              <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 9px", background: "var(--dark-surface-2)", borderRadius: "20px", fontSize: "11px", color: "var(--dark-text-2)" } as CSSProperties}>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="2.5" y="2" width="11" height="12" rx="1" />
                </svg>
                {"sparsity_curve_analysis.ipynb"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 9px", background: "var(--dark-surface-2)", borderRadius: "20px", fontSize: "11px", color: "var(--dark-text-2)" } as CSSProperties}>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="2.5" y="2" width="11" height="12" rx="1" />
                </svg>
                {"compute_sparsity.py"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 9px", background: "var(--dark-surface-2)", borderRadius: "20px", fontSize: "11px", color: "var(--dark-text-2)" } as CSSProperties}>
                {"Cell [1]"}
              </div>
            </div>
            <div style={{ flex: "1", overflow: "auto", padding: "16px 18px", fontSize: "12px", lineHeight: "1.7" } as CSSProperties}>
              <div style={{ fontSize: "10.5px", fontWeight: "600", color: "var(--dark-text-2)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "8px" } as CSSProperties}>
                {"当前任务"}
              </div>
              <div style={{ background: "var(--dark-surface)", borderRadius: "10px", padding: "12px 14px", marginBottom: "18px" } as CSSProperties}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" } as CSSProperties}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: "11.5px", fontWeight: "600" } as CSSProperties}>
                    {"sparsity_drop_investigation"}
                  </span>
                  <span style={{ fontSize: "10.5px", color: "var(--dark-text-2)" } as CSSProperties}>
                    {"2 / 4"}
                  </span>
                </div>
                <div style={{ height: "4px", borderRadius: "2px", background: "var(--dark-surface-2)", overflow: "hidden", marginBottom: "10px" } as CSSProperties}>
                  <div style={{ width: "50%", height: "100%", background: "var(--accent)" } as CSSProperties}>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "5px", color: "#9FCB8F" } as CSSProperties}>
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 8.5l3 3 7-8" />
                  </svg>
                  <span style={{ textDecoration: "line-through", color: "var(--dark-text-2)" } as CSSProperties}>
                    {"定位骤降层区间"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "5px", color: "#9FCB8F" } as CSSProperties}>
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 8.5l3 3 7-8" />
                  </svg>
                  <span style={{ textDecoration: "line-through", color: "var(--dark-text-2)" } as CSSProperties}>
                    {"读取 compute_sparsity.py"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "5px" } as CSSProperties}>
                  <span style={{ width: "11px", height: "11px", border: "1.5px solid var(--dark-text-2)", borderRadius: "3px", flexShrink: "0" } as CSSProperties}>
                  </span>
                  {"调整滑动窗口并重新运行"}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "7px" } as CSSProperties}>
                  <span style={{ width: "11px", height: "11px", border: "1.5px solid var(--dark-text-2)", borderRadius: "3px", flexShrink: "0" } as CSSProperties}>
                  </span>
                  {"验证相邻层稀疏度一致性"}
                </div>
              </div>
              <div style={{ fontSize: "10.5px", fontWeight: "600", color: "var(--dark-text-2)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "8px" } as CSSProperties}>
                {"建议操作"}
              </div>
              <div style={{ background: "var(--dark-surface)", borderRadius: "10px", padding: "12px 14px", marginBottom: "18px" } as CSSProperties}>
                <div style={{ marginBottom: "10px" } as CSSProperties}>
                  {"将 "}
                  <span style={{ fontFamily: "var(--mono)" } as CSSProperties}>
                    {"window"}
                  </span>
                  {" 从 4 改为 8，重新计算 layer 12–20 的稀疏度。"}
                </div>
                <div style={{ display: "flex", gap: "8px" } as CSSProperties}>
                  <div style={{ padding: "6px 14px", background: "var(--accent)", color: "#fff", borderRadius: "7px", fontSize: "11.5px", fontWeight: "600", cursor: "pointer" } as CSSProperties}>
                    {"采纳"}
                  </div>
                  <div style={{ padding: "6px 14px", border: "1px solid var(--dark-border)", color: "var(--dark-text-2)", borderRadius: "7px", fontSize: "11.5px", cursor: "pointer" } as CSSProperties}>
                    {"忽略"}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: "10.5px", fontWeight: "600", color: "var(--dark-text-2)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "8px" } as CSSProperties}>
                {"Diff · compute_sparsity.py"}
              </div>
              <div style={{ background: "var(--dark-surface)", borderRadius: "10px", padding: "10px 12px", marginBottom: "18px", fontFamily: "var(--mono)", fontSize: "11px", overflow: "auto" } as CSSProperties}>
                <div style={{ color: "var(--dark-text-2)" } as CSSProperties}>
                  {"…"}
                </div>
                <div style={{ background: "rgba(224,108,90,.15)", color: "#E39A85", padding: "2px 6px" } as CSSProperties}>
                  {"-127 curve = layer_sparsity(logs, window=4)"}
                </div>
                <div style={{ background: "rgba(127,187,106,.15)", color: "#9FCB8F", padding: "2px 6px" } as CSSProperties}>
                  {"+127 curve = layer_sparsity(logs, window=8)"}
                </div>
                <div style={{ color: "var(--dark-text-2)" } as CSSProperties}>
                  {"…"}
                </div>
              </div>
              <div style={{ fontSize: "10.5px", fontWeight: "600", color: "var(--dark-text-2)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "8px" } as CSSProperties}>
                {"终端输出"}
              </div>
              <div style={{ background: "var(--dark-surface)", borderRadius: "10px", padding: "10px 12px", marginBottom: "18px", fontFamily: "var(--mono)", fontSize: "11px", color: "var(--dark-text-2)", overflow: "auto" } as CSSProperties}>
                <div>
                  {"$ python3 compute_sparsity.py --layers 12-20"}
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
                <div style={{ color: "#9FCB8F" } as CSSProperties}>
                  {"✓ exited 0"}
                </div>
              </div>
              <div style={{ fontSize: "10.5px", fontWeight: "600", color: "var(--dark-text-2)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "8px" } as CSSProperties}>
                {"工具调用"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" } as CSSProperties}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "var(--dark-surface)", borderRadius: "8px", fontFamily: "var(--mono)", fontSize: "11px", color: "var(--dark-text-2)" } as CSSProperties}>
                  <span>
                    {"Read(compute_sparsity.py)"}
                  </span>
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M4 6l4 4 4-4" />
                  </svg>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "var(--dark-surface)", borderRadius: "8px", fontFamily: "var(--mono)", fontSize: "11px", color: "var(--dark-text-2)" } as CSSProperties}>
                  <span>
                    {"Update(compute_sparsity.py)"}
                  </span>
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M4 6l4 4 4-4" />
                  </svg>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "var(--dark-surface)", borderRadius: "8px", fontFamily: "var(--mono)", fontSize: "11px", color: "var(--dark-text-2)" } as CSSProperties}>
                  <span>
                    {"Bash(python3 compute_sparsity.py)"}
                  </span>
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M4 6l4 4 4-4" />
                  </svg>
                </div>
              </div>
            </div>
            <div style={{ flexShrink: "0", padding: "14px 18px 18px", borderTop: "1px solid var(--dark-border)" } as CSSProperties}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "var(--dark-surface)", border: "1px solid var(--dark-border)", borderRadius: "22px", padding: "9px 14px" } as CSSProperties}>
                <span style={{ flex: "1", fontSize: "12.5px", color: "var(--dark-text-2)" } as CSSProperties}>
                  {"向 Pilot 提问或下达任务…"}
                </span>
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="var(--dark-text-2)" strokeWidth="1.6">
                  <path d="M4 10h12M11 5l5 5-5 5" />
                </svg>
              </div>
            </div>
          </div>
        </>
      )}
      {pilotCollapsed && (
        <>
          <div style={{ width: "40px", flexShrink: "0", background: "var(--surface-2)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "16px", gap: "10px", cursor: "pointer" } as CSSProperties} onClick={togglePilot}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="var(--text-2)" strokeWidth="1.6">
              <circle cx="10" cy="10" r="6.5" />
              <circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none" />
            </svg>
            <span style={{ writingMode: "vertical-rl", fontSize: "11px", color: "var(--text-2)", letterSpacing: ".05em" } as CSSProperties}>
              {"PILOT"}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
