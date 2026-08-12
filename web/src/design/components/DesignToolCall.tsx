import { ChevronRight } from 'lucide-react'
import { useId, useState } from 'react'
import type { ToolSurfaceModel } from '../../pigent/types'
import { projectPrototypeTool } from '../pigentToolPrototype'

export function DesignToolCall({ surface }: { surface: ToolSurfaceModel }) {
  const [open, setOpen] = useState(false)
  const detailsId = useId()
  const tool = projectPrototypeTool(surface)
  return <section className={`design-tool-call is-${tool.kind}${open ? ' is-open' : ''}`} data-tool={surface.tool}>
    <button type="button" className="design-tool-call-trigger" aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen((value) => !value)}>
      <span className="design-tool-call-badge">{tool.label}</span>
      <span className="design-tool-call-file">{tool.filename}</span>
      {tool.kind !== 'read' && <span className="design-tool-call-stats" aria-label={`${tool.additions} additions and ${tool.deletions} deletions`}><b>+{tool.additions}</b><i>-{tool.deletions}</i></span>}
      <ChevronRight className="design-tool-call-chevron" aria-hidden="true" />
    </button>
    {open && <div id={detailsId} className="design-tool-call-detail">
      <div className="design-tool-call-path">{tool.path}</div>
      <div className="design-code-preview" role="region" aria-label={`${tool.label} preview for ${tool.filename}`}>
        {tool.lines.map((line, index) => <div className={`design-code-line is-${line.tone}`} key={`${line.number ?? 'blank'}-${index}`}>
          <span className="design-code-marker">{line.tone === 'added' ? '+' : line.tone === 'removed' ? '−' : ''}</span><span className="design-code-number">{line.number ?? ''}</span>
          <code>{line.text || ' '}</code>
        </div>)}
      </div>
    </div>}
  </section>
}
