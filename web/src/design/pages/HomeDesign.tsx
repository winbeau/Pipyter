import type { CSSProperties } from 'react'

export function HomeDesign() {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", minWidth: "0", fontFamily: "'Inter',sans-serif", "--bg": "#FAF7F2", "--surface": "#FFFFFF", "--surface-2": "#F1ECE2", "--border": "#E3DDCE", "--text": "#211C15", "--text-2": "#6E6656", "--text-3": "#A79C89", "--accent": "#C1622C", "--accent-soft": "#F2E1D2", "--accent-dark": "#96481C", "--dark-bg": "#1B1815", "--dark-surface": "#242019", "--dark-surface-2": "#2D281F", "--dark-border": "#3A342A", "--dark-text": "#EDE7DC", "--dark-text-2": "#A79C89", "--mono": "'IBM Plex Mono',monospace", background: "var(--bg)", color: "var(--text)" } as CSSProperties}>
      <div style={{ height: "60px", flexShrink: "0", display: "flex", alignItems: "center", gap: "20px", padding: "0 28px", borderBottom: "1px solid var(--border)", background: "var(--surface)" } as CSSProperties}>
        <div style={{ fontSize: "14px", fontWeight: "600" } as CSSProperties}>
          {"Home"}
        </div>
        <div style={{ flex: "1", display: "flex", justifyContent: "center" } as CSSProperties}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", border: "1px solid var(--border)", borderRadius: "20px", color: "var(--text-3)", fontSize: "13px", width: "340px" } as CSSProperties}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="var(--text-3)" strokeWidth="1.6">
              <circle cx="9" cy="9" r="6" />
              <path d="M13.5 13.5L17 17" />
            </svg>
            {"搜索 Notebook / Figure / 数据集… "}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" } as CSSProperties}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-2)", whiteSpace: "nowrap" } as CSSProperties}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#5FA85A", animation: "pulse-dot 2s infinite" } as CSSProperties}>
            </span>
            {"Kernel Idle"}
          </div>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="var(--text-2)" strokeWidth="1.5" style={{ cursor: "pointer", flexShrink: "0" } as CSSProperties}>
            <path d="M5 8a5 5 0 0110 0c0 3.5 1.5 4.5 1.5 4.5h-13S5 11.5 5 8z" />
            <path d="M8.3 15a1.7 1.7 0 003.4 0" />
          </svg>
        </div>
      </div>
      {/* BODY */}
      <div style={{ flex: "1", display: "flex", flexDirection: "row", minHeight: "0" } as CSSProperties}>
        {/* CENTER FEED */}
        <div style={{ flex: "1", overflow: "auto", minWidth: "0" } as CSSProperties}>
          <div style={{ maxWidth: "920px", margin: "0 auto", padding: "36px 32px 80px" } as CSSProperties}>
            <div style={{ marginBottom: "32px" } as CSSProperties}>
              <div style={{ fontSize: "26px", fontWeight: "600", letterSpacing: "-0.01em" } as CSSProperties}>
                {"早上好，王贝"}
              </div>
              <div style={{ fontSize: "14px", color: "var(--text-2)", marginTop: "5px" } as CSSProperties}>
                {"这是你在 LingBot-VA 上的研究进展"}
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", marginBottom: "40px" } as CSSProperties}>
              <div style={{ flex: "1", display: "flex", alignItems: "center", gap: "9px", padding: "13px 16px", border: "1px solid var(--border)", borderRadius: "10px", background: "var(--surface)", cursor: "pointer" } as CSSProperties}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="var(--accent-dark)" strokeWidth="1.6">
                  <path d="M10 4v12M4 10h12" />
                </svg>
                <span style={{ fontSize: "13px", fontWeight: "500" } as CSSProperties}>
                  {"新建 Notebook"}
                </span>
              </div>
              <div style={{ flex: "1", display: "flex", alignItems: "center", gap: "9px", padding: "13px 16px", border: "1px solid var(--border)", borderRadius: "10px", background: "var(--surface)", cursor: "pointer" } as CSSProperties}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="var(--text-2)" strokeWidth="1.6">
                  <rect x="3" y="4" width="14" height="12" rx="1.5" />
                  <path d="M6 12l2.5-3 2 2 3-3.5" />
                </svg>
                <span style={{ fontSize: "13px", fontWeight: "500" } as CSSProperties}>
                  {"新建 Figure"}
                </span>
              </div>
              <div style={{ flex: "1", display: "flex", alignItems: "center", gap: "9px", padding: "13px 16px", border: "1px solid var(--border)", borderRadius: "10px", background: "var(--surface)", cursor: "pointer" } as CSSProperties}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="var(--text-2)" strokeWidth="1.6">
                  <ellipse cx="10" cy="5.5" rx="6" ry="2" />
                  <path d="M4 5.5v9c0 1.1 2.7 2 6 2s6-.9 6-2v-9" />
                </svg>
                <span style={{ fontSize: "13px", fontWeight: "500" } as CSSProperties}>
                  {"导入数据集"}
                </span>
              </div>
              <div style={{ flex: "1", display: "flex", alignItems: "center", gap: "9px", padding: "13px 16px", border: "1px solid var(--border)", borderRadius: "10px", background: "var(--surface)", cursor: "pointer" } as CSSProperties}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="var(--text-2)" strokeWidth="1.6">
                  <circle cx="10" cy="10" r="6.5" />
                  <circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none" />
                </svg>
                <span style={{ fontSize: "13px", fontWeight: "500" } as CSSProperties}>
                  {"向 Pigent 下达任务"}
                </span>
              </div>
            </div>
            <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: "14px" } as CSSProperties}>
              {"最近打开"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "14px", marginBottom: "40px" } as CSSProperties}>
              <div style={{ padding: "16px", border: "1px solid var(--border)", borderRadius: "12px", background: "var(--surface)" } as CSSProperties}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" } as CSSProperties}>
                  <span style={{ fontSize: "10.5px", fontWeight: "600", color: "var(--accent-dark)", background: "var(--accent-soft)", padding: "2px 8px", borderRadius: "20px" } as CSSProperties}>
                    {"WORKSPACE"}
                  </span>
                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#5FA85A" } as CSSProperties}>
                  </span>
                </div>
                <div style={{ fontSize: "14.5px", fontWeight: "600", marginBottom: "5px" } as CSSProperties}>
                  {"LingBot-VA"}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-2)", lineHeight: "1.5", marginBottom: "12px" } as CSSProperties}>
                  {"视觉-动作模型注意力稀疏度研究与消融实验"}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11.5px", color: "var(--text-3)" } as CSSProperties}>
                  <span>
                    {"王贝 · 12 分钟前"}
                  </span>
                  <span style={{ display: "flex", gap: "5px" } as CSSProperties}>
                    <span style={{ background: "var(--surface-2)", padding: "2px 7px", borderRadius: "20px" } as CSSProperties}>
                      {"注意力"}
                    </span>
                  </span>
                </div>
              </div>
              <div style={{ padding: "16px", border: "1px solid var(--border)", borderRadius: "12px", background: "var(--surface)" } as CSSProperties}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" } as CSSProperties}>
                  <span style={{ fontSize: "10.5px", fontWeight: "600", color: "#4A6FA5", background: "#E7EDF6", padding: "2px 8px", borderRadius: "20px" } as CSSProperties}>
                    {"NOTEBOOK"}
                  </span>
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="#5FA85A" strokeWidth="1.8">
                    <path d="M3 8.5l3 3 7-8" />
                  </svg>
                </div>
                <div style={{ fontSize: "14.5px", fontWeight: "600", marginBottom: "5px" } as CSSProperties}>
                  {"sparsity_curve_analysis.ipynb"}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-2)", lineHeight: "1.5", marginBottom: "12px" } as CSSProperties}>
                  {"分析各层注意力头稀疏度分布，定位骤降区间"}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11.5px", color: "var(--text-3)" } as CSSProperties}>
                  <span>
                    {"LingBot-VA · 12 分钟前"}
                  </span>
                  <span style={{ background: "var(--surface-2)", padding: "2px 7px", borderRadius: "20px" } as CSSProperties}>
                    {"分析"}
                  </span>
                </div>
              </div>
              <div style={{ padding: "16px", border: "1px solid var(--border)", borderRadius: "12px", background: "var(--surface)" } as CSSProperties}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" } as CSSProperties}>
                  <span style={{ fontSize: "10.5px", fontWeight: "600", color: "#6B8F63", background: "#E8EFE3", padding: "2px 8px", borderRadius: "20px" } as CSSProperties}>
                    {"DATASET"}
                  </span>
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="var(--text-3)" strokeWidth="1.6" strokeLinejoin="round">
                    <path d="M10 3l2.1 4.3 4.7.7-3.4 3.3.8 4.7L10 13.8 5.8 16l.8-4.7-3.4-3.3 4.7-.7z" />
                  </svg>
                </div>
                <div style={{ fontSize: "14.5px", fontWeight: "600", marginBottom: "5px" } as CSSProperties}>
                  {"sparsity_logs.csv"}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-2)", lineHeight: "1.5", marginBottom: "12px" } as CSSProperties}>
                  {"32 层 × 4096 token 稀疏度原始日志 · 128MB"}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11.5px", color: "var(--text-3)" } as CSSProperties}>
                  <span>
                    {"LingBot-VA · 1 小时前"}
                  </span>
                  <span style={{ background: "var(--surface-2)", padding: "2px 7px", borderRadius: "20px" } as CSSProperties}>
                    {"原始数据"}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: "14px" } as CSSProperties}>
              {"最近 Figures"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "14px", marginBottom: "40px" } as CSSProperties}>
              <div style={{ border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden", background: "var(--surface)" } as CSSProperties}>
                <div style={{ aspectRatio: "16/10", background: "repeating-linear-gradient(135deg,var(--surface-2) 0px,var(--surface-2) 8px,var(--surface) 8px,var(--surface) 16px)", display: "flex", alignItems: "center", justifyContent: "center" } as CSSProperties}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: "10.5px", color: "var(--text-3)" } as CSSProperties}>
                    {"PLOT"}
                  </span>
                </div>
                <div style={{ padding: "12px 14px" } as CSSProperties}>
                  <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px" } as CSSProperties}>
                    {"Layer-wise Attention Sparsity"}
                  </div>
                  <div style={{ fontSize: "11.5px", color: "var(--text-3)" } as CSSProperties}>
                    {"sparsity_curve_analysis · 12 分钟前"}
                  </div>
                </div>
              </div>
              <div style={{ border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden", background: "var(--surface)" } as CSSProperties}>
                <div style={{ aspectRatio: "16/10", background: "repeating-linear-gradient(135deg,var(--surface-2) 0px,var(--surface-2) 8px,var(--surface) 8px,var(--surface) 16px)", display: "flex", alignItems: "center", justifyContent: "center" } as CSSProperties}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: "10.5px", color: "var(--text-3)" } as CSSProperties}>
                    {"PLOT"}
                  </span>
                </div>
                <div style={{ padding: "12px 14px" } as CSSProperties}>
                  <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px" } as CSSProperties}>
                    {"Head Sparsity Heatmap — Layer 15"}
                  </div>
                  <div style={{ fontSize: "11.5px", color: "var(--text-3)" } as CSSProperties}>
                    {"sparsity_curve_analysis · 12 分钟前"}
                  </div>
                </div>
              </div>
              <div style={{ border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden", background: "var(--surface)" } as CSSProperties}>
                <div style={{ aspectRatio: "16/10", background: "repeating-linear-gradient(135deg,var(--surface-2) 0px,var(--surface-2) 8px,var(--surface) 8px,var(--surface) 16px)", display: "flex", alignItems: "center", justifyContent: "center" } as CSSProperties}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: "10.5px", color: "var(--text-3)" } as CSSProperties}>
                    {"PLOT"}
                  </span>
                </div>
                <div style={{ padding: "12px 14px" } as CSSProperties}>
                  <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px" } as CSSProperties}>
                    {"Baseline vs LingBot-VA Sparsity"}
                  </div>
                  <div style={{ fontSize: "11.5px", color: "var(--text-3)" } as CSSProperties}>
                    {"baseline-eval · 1 天前"}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: "14px" } as CSSProperties}>
              {"最近 Agent 任务"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" } as CSSProperties}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", border: "1px solid var(--border)", borderRadius: "12px", background: "var(--surface)" } as CSSProperties}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#5FA85A" strokeWidth="1.8" style={{ flexShrink: "0" } as CSSProperties}>
                  <path d="M3 8.5l3 3 7-8" />
                </svg>
                <div style={{ flex: "1" } as CSSProperties}>
                  <div style={{ fontSize: "13.5px", fontWeight: "500" } as CSSProperties}>
                    {"调查 layer 12–20 稀疏度骤降"}
                  </div>
                  <div style={{ fontSize: "11.5px", color: "var(--text-3)", marginTop: "2px" } as CSSProperties}>
                    {"sparsity_curve_analysis.ipynb · 完成于 8 分钟前"}
                  </div>
                </div>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "#3F7A3B", background: "#E4F0E2", padding: "3px 10px", borderRadius: "20px" } as CSSProperties}>
                  {"Completed"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", border: "1px solid var(--border)", borderRadius: "12px", background: "var(--surface)" } as CSSProperties}>
                <span style={{ width: "16px", height: "16px", borderRadius: "50%", border: "2px solid var(--accent)", borderTopColor: "transparent", flexShrink: "0" } as CSSProperties}>
                </span>
                <div style={{ flex: "1" } as CSSProperties}>
                  <div style={{ fontSize: "13.5px", fontWeight: "500" } as CSSProperties}>
                    {"重新运行 baseline-eval 全部 cell"}
                  </div>
                  <div style={{ fontSize: "11.5px", color: "var(--text-3)", marginTop: "2px" } as CSSProperties}>
                    {"baseline-eval · 开始于 3 分钟前"}
                  </div>
                </div>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--accent-dark)", background: "var(--accent-soft)", padding: "3px 10px", borderRadius: "20px" } as CSSProperties}>
                  {"Running"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", border: "1px solid var(--border)", borderRadius: "12px", background: "var(--surface)" } as CSSProperties}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#B08A3E" strokeWidth="1.8" style={{ flexShrink: "0" } as CSSProperties}>
                  <circle cx="8" cy="8" r="6.5" />
                  <path d="M8 5v3.5M8 10.8v.2" />
                </svg>
                <div style={{ flex: "1" } as CSSProperties}>
                  <div style={{ fontSize: "13.5px", fontWeight: "500" } as CSSProperties}>
                    {"生成消融实验对比图"}
                  </div>
                  <div style={{ fontSize: "11.5px", color: "var(--text-3)", marginTop: "2px" } as CSSProperties}>
                    {"token-ablation · 等待确认变更"}
                  </div>
                </div>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "#8A6A22", background: "#F3E9CE", padding: "3px 10px", borderRadius: "20px" } as CSSProperties}>
                  {"Waiting approval"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", border: "1px solid var(--border)", borderRadius: "12px", background: "var(--surface)" } as CSSProperties}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#C0564A" strokeWidth="1.8" style={{ flexShrink: "0" } as CSSProperties}>
                  <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
                </svg>
                <div style={{ flex: "1" } as CSSProperties}>
                  <div style={{ fontSize: "13.5px", fontWeight: "500" } as CSSProperties}>
                    {"同步 kernel 环境依赖"}
                  </div>
                  <div style={{ fontSize: "11.5px", color: "var(--text-3)", marginTop: "2px" } as CSSProperties}>
                    {"LingBot-VA · 失败于 40 分钟前 · torch 版本冲突"}
                  </div>
                </div>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "#B03B2E", background: "#F5E1DD", padding: "3px 10px", borderRadius: "20px" } as CSSProperties}>
                  {"Failed"}
                </span>
              </div>
            </div>
          </div>
        </div>
        {/* RIGHT INFO */}
        <div style={{ width: "264px", flexShrink: "0", borderLeft: "1px solid var(--border)", padding: "24px 20px", overflow: "auto" } as CSSProperties}>
          <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "12px" } as CSSProperties}>
            {"热门标签"}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "28px" } as CSSProperties}>
            <span style={{ fontSize: "11.5px", padding: "4px 10px", borderRadius: "20px", background: "var(--surface-2)", color: "var(--text-2)" } as CSSProperties}>
              {"#注意力 12"}
            </span>
            <span style={{ fontSize: "11.5px", padding: "4px 10px", borderRadius: "20px", background: "var(--surface-2)", color: "var(--text-2)" } as CSSProperties}>
              {"#稀疏度 8"}
            </span>
            <span style={{ fontSize: "11.5px", padding: "4px 10px", borderRadius: "20px", background: "var(--surface-2)", color: "var(--text-2)" } as CSSProperties}>
              {"#消融实验 5"}
            </span>
            <span style={{ fontSize: "11.5px", padding: "4px 10px", borderRadius: "20px", background: "var(--surface-2)", color: "var(--text-2)" } as CSSProperties}>
              {"#基线对比 4"}
            </span>
          </div>
          <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "12px" } as CSSProperties}>
            {"最近活动"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "28px", fontSize: "12px", lineHeight: "1.5" } as CSSProperties}>
            <div>
              <span style={{ fontWeight: "500" } as CSSProperties}>
                {"王贝"}
              </span>
              {" 更新了 sparsity_curve_analysis.ipynb"}
              <div style={{ color: "var(--text-3)", fontSize: "11px", marginTop: "1px" } as CSSProperties}>
                {"12 分钟前"}
              </div>
            </div>
            <div>
              <span style={{ fontWeight: "500" } as CSSProperties}>
                {"Pigent"}
              </span>
              {" 完成了任务「调查稀疏度骤降」"}
              <div style={{ color: "var(--text-3)", fontSize: "11px", marginTop: "1px" } as CSSProperties}>
                {"8 分钟前"}
              </div>
            </div>
            <div>
              <span style={{ fontWeight: "500" } as CSSProperties}>
                {"周明"}
              </span>
              {" 上传了 sparsity_logs_v2.csv"}
              <div style={{ color: "var(--text-3)", fontSize: "11px", marginTop: "1px" } as CSSProperties}>
                {"1 小时前"}
              </div>
            </div>
          </div>
          <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "12px" } as CSSProperties}>
            {"活跃项目"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "28px" } as CSSProperties}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12.5px" } as CSSProperties}>
              <span>
                {"LingBot-VA"}
              </span>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#5FA85A" } as CSSProperties}>
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12.5px" } as CSSProperties}>
              <span>
                {"robotics-vla"}
              </span>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--text-3)" } as CSSProperties}>
              </span>
            </div>
          </div>
          <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "12px" } as CSSProperties}>
            {"Kernel / 算力概览"}
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "14px" } as CSSProperties}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "8px" } as CSSProperties}>
              <span style={{ color: "var(--text-2)" } as CSSProperties}>
                {"运行中 Kernel"}
              </span>
              <span style={{ fontWeight: "600" } as CSSProperties}>
                {"2"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "8px" } as CSSProperties}>
              <span style={{ color: "var(--text-2)" } as CSSProperties}>
                {"本周 GPU 时长"}
              </span>
              <span style={{ fontWeight: "600" } as CSSProperties}>
                {"42.5h"}
              </span>
            </div>
            <div style={{ height: "5px", borderRadius: "3px", background: "var(--surface-2)", overflow: "hidden" } as CSSProperties}>
              <div style={{ width: "64%", height: "100%", background: "var(--accent)" } as CSSProperties}>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
