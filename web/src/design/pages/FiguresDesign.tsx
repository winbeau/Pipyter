import type { CSSProperties } from 'react'

export type FiguresDesignProps = {
  formatPdfStyle: CSSProperties
  formatPngStyle: CSSProperties
  formatSvgStyle: CSSProperties
  frameToggleKnobStyle: CSSProperties
  frameToggleStyle: CSSProperties
  layerLegendStyle: CSSProperties
  layerLine1Style: CSSProperties
  layerLine2Style: CSSProperties
  layerScatterStyle: CSSProperties
  layerXAxisStyle: CSSProperties
  layerYAxisStyle: CSSProperties
  pilotToggleStyle: CSSProperties
  selectedLineLabelStyle: CSSProperties
  tightToggleKnobStyle: CSSProperties
  tightToggleStyle: CSSProperties
  transparentToggleKnobStyle: CSSProperties
  transparentToggleStyle: CSSProperties
  selectLegend: () => void
  selectLine1: () => void
  selectLine2: () => void
  selectScatter: () => void
  selectXAxis: () => void
  selectYAxis: () => void
  setFormatPdf: () => void
  setFormatPng: () => void
  setFormatSvg: () => void
  toggleFrame: () => void
  togglePilot: () => void
  toggleTight: () => void
  toggleTransparent: () => void
  pilotOpen: boolean
  selectedLineName: string
}

export function FiguresDesign({
  formatPdfStyle,
  formatPngStyle,
  formatSvgStyle,
  frameToggleKnobStyle,
  frameToggleStyle,
  layerLegendStyle,
  layerLine1Style,
  layerLine2Style,
  layerScatterStyle,
  layerXAxisStyle,
  layerYAxisStyle,
  pilotOpen,
  pilotToggleStyle,
  selectLegend,
  selectLine1,
  selectLine2,
  selectScatter,
  selectXAxis,
  selectYAxis,
  selectedLineLabelStyle,
  selectedLineName,
  setFormatPdf,
  setFormatPng,
  setFormatSvg,
  tightToggleKnobStyle,
  tightToggleStyle,
  toggleFrame,
  togglePilot,
  toggleTight,
  toggleTransparent,
  transparentToggleKnobStyle,
  transparentToggleStyle,
}: FiguresDesignProps) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", minWidth: "0", fontFamily: "'Inter',sans-serif", "--bg": "#FAF7F2", "--surface": "#FFFFFF", "--surface-2": "#F1ECE2", "--border": "#E3DDCE", "--text": "#211C15", "--text-2": "#6E6656", "--text-3": "#A79C89", "--accent": "#C1622C", "--accent-soft": "#F2E1D2", "--accent-dark": "#96481C", "--dark-bg": "#1B1815", "--dark-surface": "#242019", "--dark-surface-2": "#2D281F", "--dark-border": "#3A342A", "--dark-text": "#EDE7DC", "--dark-text-2": "#A79C89", "--mono": "'IBM Plex Mono',monospace", background: "var(--bg)", color: "var(--text)" } as CSSProperties}>
      {/* TOP BAR */}
      <div style={{ height: "58px", flexShrink: "0", display: "flex", alignItems: "center", gap: "16px", padding: "0 20px", borderBottom: "1px solid var(--border)", background: "var(--surface)" } as CSSProperties}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: "600" } as CSSProperties}>
            {"layer_sparsity_curve.png"}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-3)" } as CSSProperties}>
            {"LingBot-VA / attention_sparsity / sparsity_curve_analysis.ipynb · Cell [1]"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 10px", border: "1px solid var(--border)", borderRadius: "20px", fontSize: "11.5px", color: "var(--text-2)", cursor: "pointer" } as CSSProperties}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 4l6 4-6 4z" />
          </svg>
          {"Open Source "}
        </div>
        <div style={{ flex: "1" } as CSSProperties}>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" } as CSSProperties}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="var(--text-2)" strokeWidth="1.6" style={{ cursor: "pointer" } as CSSProperties}>
            <path d="M8 6L4 10l4 4" />
            <path d="M4 10h8a4 4 0 010 8h-1" />
          </svg>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="var(--text-2)" strokeWidth="1.6" style={{ cursor: "pointer" } as CSSProperties}>
            <path d="M12 6l4 4-4 4" />
            <path d="M16 10H8a4 4 0 000 8h1" />
          </svg>
        </div>
        <div style={{ width: "1px", height: "22px", background: "var(--border)" } as CSSProperties}>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12.5px", fontWeight: "500", cursor: "pointer" } as CSSProperties}>
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="var(--text-2)" strokeWidth="1.6">
            <path d="M4 13v3h12v-3" />
            <path d="M10 3v9M6.5 9l3.5 3.5L13.5 9" />
          </svg>
          {"Export "}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", background: "var(--text)", color: "var(--bg)", borderRadius: "8px", fontSize: "12.5px", fontWeight: "600", cursor: "pointer" } as CSSProperties}>
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M4 10.5l4 4 8-9" />
          </svg>
          {"Apply to Code "}
        </div>
        <div style={pilotToggleStyle} onClick={togglePilot}>
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="10" cy="10" r="6.5" />
            <circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none" />
          </svg>
          {"Ask Pilot "}
        </div>
      </div>
      <div style={{ flex: "1", display: "flex", flexDirection: "row", minHeight: "0" } as CSSProperties}>
        {/* LEFT: LAYERS TREE */}
        <div style={{ width: "216px", flexShrink: "0", borderRight: "1px solid var(--border)", background: "var(--surface)", padding: "16px 12px", overflow: "auto" } as CSSProperties}>
          <div style={{ fontSize: "10.5px", fontWeight: "600", color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".05em", padding: "0 6px 10px" } as CSSProperties}>
            {"图层"}
          </div>
          <div style={{ fontSize: "12.5px" } as CSSProperties}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px", padding: "6px 8px", fontWeight: "600" } as CSSProperties}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--text-2)" strokeWidth="1.5">
                <rect x="2" y="2" width="12" height="12" rx="1.5" />
              </svg>
              {"Figure"}
            </div>
            <div style={{ marginLeft: "14px" } as CSSProperties}>
              <div style={{ display: "flex", alignItems: "center", gap: "7px", padding: "6px 8px", fontWeight: "600" } as CSSProperties}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--text-2)" strokeWidth="1.5">
                  <rect x="2.5" y="2.5" width="11" height="11" rx="1" />
                  <path d="M2.5 10h11M6 13.5V2.5" />
                </svg>
                {"Axes 1"}
              </div>
              <div style={{ marginLeft: "14px", display: "flex", flexDirection: "column", gap: "1px" } as CSSProperties}>
                <div style={layerLine1Style} onClick={selectLine1}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M2 12l4-6 4 3 4-7" />
                  </svg>
                  {"Line 1"}
                </div>
                <div style={layerLine2Style} onClick={selectLine2}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M2 12l4-6 4 3 4-7" />
                  </svg>
                  {"Line 2"}
                </div>
                <div style={layerScatterStyle} onClick={selectScatter}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <circle cx="4" cy="5" r="1" />
                    <circle cx="8" cy="9" r="1" />
                    <circle cx="12" cy="4" r="1" />
                    <circle cx="10" cy="12" r="1" />
                  </svg>
                  {"Scatter"}
                </div>
                <div style={layerLegendStyle} onClick={selectLegend}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <rect x="2" y="3" width="12" height="8" rx="1" />
                    <path d="M4.5 6h7M4.5 8.5h5" />
                  </svg>
                  {"Legend"}
                </div>
                <div style={layerXAxisStyle} onClick={selectXAxis}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M2 8h12M10 5l3 3-3 3" />
                  </svg>
                  {"X Axis"}
                </div>
                <div style={layerYAxisStyle} onClick={selectYAxis}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M8 14V2M5 5l3-3 3 3" />
                  </svg>
                  {"Y Axis"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "7px", padding: "6px 8px", fontWeight: "600", marginTop: "2px" } as CSSProperties}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--text-2)" strokeWidth="1.5" strokeLinejoin="round">
                <path d="M4 2l6 6-6 6" />
              </svg>
              {"Annotations"}
            </div>
          </div>
        </div>
        {/* CENTER: CANVAS */}
        <div style={{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column", background: "var(--surface-2)" } as CSSProperties}>
          <div style={{ flex: "1", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px", overflow: "auto" } as CSSProperties}>
            <div style={{ width: "100%", maxWidth: "780px", background: "#FFFFFF", border: "1px solid var(--border)", boxShadow: "0 2px 14px rgba(33,28,21,0.06)", borderRadius: "4px", padding: "20px" } as CSSProperties}>
              <div style={{ aspectRatio: "12/5", background: "repeating-linear-gradient(135deg,var(--surface-2) 0px,var(--surface-2) 8px,#ffffff 8px,#ffffff 16px)", display: "flex", alignItems: "center", justifyContent: "center" } as CSSProperties}>
                <span style={{ fontFamily: "var(--mono)", fontSize: "12px", color: "var(--text-3)" } as CSSProperties}>
                  {"FIGURE CANVAS — layer_sparsity_curve.png (12 × 5 in @ 300 DPI)"}
                </span>
              </div>
            </div>
          </div>
          <div style={{ flexShrink: "0", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", padding: "10px", borderTop: "1px solid var(--border)", background: "var(--surface)" } as CSSProperties}>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="var(--text-2)" strokeWidth="1.6" style={{ cursor: "pointer" } as CSSProperties}>
              <circle cx="9" cy="9" r="6.5" />
              <path d="M13.5 13.5L17 17" />
              <path d="M6.5 9h5" />
            </svg>
            <span style={{ fontSize: "12.5px", color: "var(--text-2)", width: "44px", textAlign: "center" } as CSSProperties}>
              {"100%"}
            </span>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="var(--text-2)" strokeWidth="1.6" style={{ cursor: "pointer" } as CSSProperties}>
              <circle cx="9" cy="9" r="6.5" />
              <path d="M13.5 13.5L17 17" />
              <path d="M9 6.5v5M6.5 9h5" />
            </svg>
            <div style={{ width: "1px", height: "16px", background: "var(--border)" } as CSSProperties}>
            </div>
            <span style={{ fontSize: "12px", color: "var(--text-2)", cursor: "pointer" } as CSSProperties}>
              {"Fit"}
            </span>
            <span style={{ fontSize: "12px", color: "var(--text-3)", cursor: "pointer" } as CSSProperties}>
              {"100%"}
            </span>
          </div>
        </div>
        {/* RIGHT: INSPECTOR */}
        <div style={{ width: "320px", flexShrink: "0", borderLeft: "1px solid var(--border)", background: "var(--surface)", display: "flex", flexDirection: "column" } as CSSProperties}>
          <div style={{ flex: "1", overflow: "auto", padding: "18px 20px" } as CSSProperties}>
            <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "12px" } as CSSProperties}>
              {"Figure Inspector"}
            </div>
            <div style={{ fontSize: "10.5px", fontWeight: "600", color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "8px" } as CSSProperties}>
              {"Canvas"}
            </div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" } as CSSProperties}>
              <div style={{ flex: "1" } as CSSProperties}>
                <div style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "3px" } as CSSProperties}>
                  {"Width"}
                </div>
                <div style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "12.5px" } as CSSProperties}>
                  {"12 in"}
                </div>
              </div>
              <div style={{ flex: "1" } as CSSProperties}>
                <div style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "3px" } as CSSProperties}>
                  {"Height"}
                </div>
                <div style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "12.5px" } as CSSProperties}>
                  {"5 in"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "20px" } as CSSProperties}>
              <div style={{ flex: "1" } as CSSProperties}>
                <div style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "3px" } as CSSProperties}>
                  {"DPI"}
                </div>
                <div style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "12.5px" } as CSSProperties}>
                  {"300"}
                </div>
              </div>
              <div style={{ flex: "1" } as CSSProperties}>
                <div style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "3px" } as CSSProperties}>
                  {"Aspect Ratio"}
                </div>
                <div style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "12.5px", color: "var(--text-2)" } as CSSProperties}>
                  {"2.4 : 1 · 锁定"}
                </div>
              </div>
            </div>
            <div style={{ fontSize: "10.5px", fontWeight: "600", color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "8px" } as CSSProperties}>
              {"Axes"}
            </div>
            <div style={{ marginBottom: "8px" } as CSSProperties}>
              <div style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "3px" } as CSSProperties}>
                {"Title"}
              </div>
              <div style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "12.5px" } as CSSProperties}>
                {"Layer-wise Attention Sparsity"}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" } as CSSProperties}>
              <div style={{ flex: "1" } as CSSProperties}>
                <div style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "3px" } as CSSProperties}>
                  {"X Label"}
                </div>
                <div style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "12.5px" } as CSSProperties}>
                  {"Layer index"}
                </div>
              </div>
              <div style={{ flex: "1" } as CSSProperties}>
                <div style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "3px" } as CSSProperties}>
                  {"Y Label"}
                </div>
                <div style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "12.5px" } as CSSProperties}>
                  {"Sparsity ratio"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" } as CSSProperties}>
              <div style={{ flex: "1" } as CSSProperties}>
                <div style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "3px" } as CSSProperties}>
                  {"X Limits"}
                </div>
                <div style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "12.5px" } as CSSProperties}>
                  {"0 – 31"}
                </div>
              </div>
              <div style={{ flex: "1" } as CSSProperties}>
                <div style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "3px" } as CSSProperties}>
                  {"Y Limits"}
                </div>
                <div style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "12.5px" } as CSSProperties}>
                  {"0 – 1"}
                </div>
              </div>
            </div>
            <div style={{ marginBottom: "8px" } as CSSProperties}>
              <div style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "4px" } as CSSProperties}>
                {"Scale"}
              </div>
              <div style={{ display: "flex", gap: "6px" } as CSSProperties}>
                <div style={{ flex: "1", textAlign: "center", padding: "6px", borderRadius: "6px", background: "var(--accent-soft)", color: "var(--accent-dark)", fontSize: "12px", fontWeight: "600" } as CSSProperties}>
                  {"Linear"}
                </div>
                <div style={{ flex: "1", textAlign: "center", padding: "6px", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "12px", color: "var(--text-2)" } as CSSProperties}>
                  {"Log"}
                </div>
              </div>
            </div>
            <div style={{ marginBottom: "20px" } as CSSProperties}>
              <div style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "4px" } as CSSProperties}>
                {"Ticks"}
              </div>
              <div style={{ display: "flex", gap: "6px" } as CSSProperties}>
                <div style={{ flex: "1", textAlign: "center", padding: "6px", borderRadius: "6px", background: "var(--accent-soft)", color: "var(--accent-dark)", fontSize: "12px", fontWeight: "600" } as CSSProperties}>
                  {"Auto"}
                </div>
                <div style={{ flex: "1", textAlign: "center", padding: "6px", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "12px", color: "var(--text-2)" } as CSSProperties}>
                  {"Manual"}
                </div>
              </div>
            </div>
            <div style={{ fontSize: "10.5px", fontWeight: "600", color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "8px" } as CSSProperties}>
              {"Typography"}
            </div>
            <div style={{ marginBottom: "8px" } as CSSProperties}>
              <div style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "3px" } as CSSProperties}>
                {"Font Family"}
              </div>
              <div style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "12.5px", display: "flex", justifyContent: "space-between" } as CSSProperties}>
                {"IBM Plex Sans"}
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="var(--text-3)" strokeWidth="1.6">
                  <path d="M4 6l4 4 4-4" />
                </svg>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "20px" } as CSSProperties}>
              <div style={{ flex: "1" } as CSSProperties}>
                <div style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "3px" } as CSSProperties}>
                  {"Font Size"}
                </div>
                <div style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "12.5px" } as CSSProperties}>
                  {"11"}
                </div>
              </div>
              <div style={{ flex: "1" } as CSSProperties}>
                <div style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "3px" } as CSSProperties}>
                  {"Label Size"}
                </div>
                <div style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "12.5px" } as CSSProperties}>
                  {"12"}
                </div>
              </div>
              <div style={{ flex: "1" } as CSSProperties}>
                <div style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "3px" } as CSSProperties}>
                  {"Tick Size"}
                </div>
                <div style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "12.5px" } as CSSProperties}>
                  {"9"}
                </div>
              </div>
            </div>
            <div style={{ fontSize: "10.5px", fontWeight: "600", color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "8px" } as CSSProperties}>
              {"Lines · "}
              <span style={selectedLineLabelStyle}>
                {selectedLineName}
              </span>
            </div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" } as CSSProperties}>
              <div style={{ flex: "1" } as CSSProperties}>
                <div style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "3px" } as CSSProperties}>
                  {"Line Width"}
                </div>
                <div style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "12.5px" } as CSSProperties}>
                  {"1.8"}
                </div>
              </div>
              <div style={{ flex: "1" } as CSSProperties}>
                <div style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "3px" } as CSSProperties}>
                  {"Alpha"}
                </div>
                <div style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "12.5px" } as CSSProperties}>
                  {"0.9"}
                </div>
              </div>
            </div>
            <div style={{ marginBottom: "8px" } as CSSProperties}>
              <div style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "4px" } as CSSProperties}>
                {"Line Style"}
              </div>
              <div style={{ display: "flex", gap: "6px" } as CSSProperties}>
                <div style={{ flex: "1", textAlign: "center", padding: "6px", borderRadius: "6px", background: "var(--accent-soft)", color: "var(--accent-dark)", fontSize: "12px", fontWeight: "600" } as CSSProperties}>
                  {"Solid"}
                </div>
                <div style={{ flex: "1", textAlign: "center", padding: "6px", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "12px", color: "var(--text-2)" } as CSSProperties}>
                  {"Dashed"}
                </div>
                <div style={{ flex: "1", textAlign: "center", padding: "6px", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "12px", color: "var(--text-2)" } as CSSProperties}>
                  {"Dotted"}
                </div>
              </div>
            </div>
            <div style={{ marginBottom: "20px" } as CSSProperties}>
              <div style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "3px" } as CSSProperties}>
                {"Marker"}
              </div>
              <div style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "12.5px", display: "flex", justifyContent: "space-between" } as CSSProperties}>
                {"None"}
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="var(--text-3)" strokeWidth="1.6">
                  <path d="M4 6l4 4 4-4" />
                </svg>
              </div>
            </div>
            <div style={{ fontSize: "10.5px", fontWeight: "600", color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "8px" } as CSSProperties}>
              {"Legend"}
            </div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" } as CSSProperties}>
              <div style={{ flex: "1" } as CSSProperties}>
                <div style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "3px" } as CSSProperties}>
                  {"Location"}
                </div>
                <div style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "12.5px" } as CSSProperties}>
                  {"Upper right"}
                </div>
              </div>
              <div style={{ flex: "1" } as CSSProperties}>
                <div style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "3px" } as CSSProperties}>
                  {"Columns"}
                </div>
                <div style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "12.5px" } as CSSProperties}>
                  {"1"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" } as CSSProperties}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px" } as CSSProperties}>
                {"Frame"}
                <div style={frameToggleStyle} onClick={toggleFrame}>
                  <div style={frameToggleKnobStyle}>
                  </div>
                </div>
              </div>
              <div style={{ width: "80px" } as CSSProperties}>
                <div style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "3px" } as CSSProperties}>
                  {"Font Size"}
                </div>
                <div style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "12.5px" } as CSSProperties}>
                  {"10"}
                </div>
              </div>
            </div>
            <div style={{ fontSize: "10.5px", fontWeight: "600", color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "8px" } as CSSProperties}>
              {"Layout"}
            </div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" } as CSSProperties}>
              <div style={{ flex: "1" } as CSSProperties}>
                <div style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "3px" } as CSSProperties}>
                  {"Margins"}
                </div>
                <div style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "12.5px" } as CSSProperties}>
                  {"0.08"}
                </div>
              </div>
              <div style={{ flex: "1" } as CSSProperties}>
                <div style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "3px" } as CSSProperties}>
                  {"Padding"}
                </div>
                <div style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "12.5px" } as CSSProperties}>
                  {"0.04"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", marginBottom: "20px" } as CSSProperties}>
              {"Tight Layout"}
              <div style={tightToggleStyle} onClick={toggleTight}>
                <div style={tightToggleKnobStyle}>
                </div>
              </div>
            </div>
            <div style={{ fontSize: "10.5px", fontWeight: "600", color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "8px" } as CSSProperties}>
              {"Export"}
            </div>
            <div style={{ display: "flex", gap: "6px", marginBottom: "10px" } as CSSProperties}>
              <div style={formatPngStyle} onClick={setFormatPng}>
                {"PNG"}
              </div>
              <div style={formatSvgStyle} onClick={setFormatSvg}>
                {"SVG"}
              </div>
              <div style={formatPdfStyle} onClick={setFormatPdf}>
                {"PDF"}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "10px" } as CSSProperties}>
              <div style={{ flex: "1" } as CSSProperties}>
                <div style={{ fontSize: "11px", color: "var(--text-3)", marginBottom: "3px" } as CSSProperties}>
                  {"DPI"}
                </div>
                <div style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: "7px", fontSize: "12.5px" } as CSSProperties}>
                  {"300"}
                </div>
              </div>
              <div style={{ flex: "1", display: "flex", alignItems: "flex-end", paddingBottom: "2px" } as CSSProperties}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" } as CSSProperties}>
                  {"透明背景"}
                  <div style={transparentToggleStyle} onClick={toggleTransparent}>
                    <div style={transparentToggleKnobStyle}>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ padding: "9px", textAlign: "center", background: "var(--text)", color: "var(--bg)", borderRadius: "8px", fontSize: "12.5px", fontWeight: "600", cursor: "pointer" } as CSSProperties}>
              {"导出 Figure"}
            </div>
          </div>
          {/* PILOT MINI PANEL */}
          {pilotOpen && (
            <>
              <div style={{ flexShrink: "0", background: "var(--dark-bg)", color: "var(--dark-text)", borderTop: "1px solid var(--dark-border)", padding: "14px 18px" } as CSSProperties}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" } as CSSProperties}>
                  <div style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "12.5px", fontWeight: "600" } as CSSProperties}>
                    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <circle cx="10" cy="10" r="6.5" />
                      <circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none" />
                    </svg>
                    {"Ask Pilot"}
                  </div>
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="var(--dark-text-2)" strokeWidth="1.6" style={{ cursor: "pointer" } as CSSProperties} onClick={togglePilot}>
                    <path d="M6 6l8 8M14 6l-8 8" />
                  </svg>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" } as CSSProperties}>
                  <div style={{ padding: "8px 10px", background: "var(--dark-surface)", borderRadius: "8px", fontSize: "11.5px", cursor: "pointer" } as CSSProperties}>
                    {"Make this figure publication-ready for NeurIPS"}
                  </div>
                  <div style={{ padding: "8px 10px", background: "var(--dark-surface)", borderRadius: "8px", fontSize: "11.5px", cursor: "pointer" } as CSSProperties}>
                    {"Improve label readability"}
                  </div>
                  <div style={{ padding: "8px 10px", background: "var(--dark-surface)", borderRadius: "8px", fontSize: "11.5px", cursor: "pointer" } as CSSProperties}>
                    {"Match the style of Figure 3"}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--dark-surface)", border: "1px solid var(--dark-border)", borderRadius: "18px", padding: "8px 12px" } as CSSProperties}>
                  <span style={{ flex: "1", fontSize: "11.5px", color: "var(--dark-text-2)" } as CSSProperties}>
                    {"向 Pilot 描述你想要的调整…"}
                  </span>
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="var(--dark-text-2)" strokeWidth="1.6">
                    <path d="M4 10h12M11 5l5 5-5 5" />
                  </svg>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
