import { Check, Circle, LoaderCircle, OctagonX } from 'lucide-react'
import type { TaskNode, TasksSnapshot } from '../types'
function flatten(node: TaskNode): TaskNode[] { return node.children?.length ? node.children.flatMap((item) => [item, ...flatten(item)]) : [] }
export function TaskCard({ snapshot, density = 'comfortable' }: { snapshot: TasksSnapshot; density?: 'comfortable' | 'compact' }) {
  const tasks = flatten(snapshot.root); const done = tasks.filter((item) => item.status === 'done').length
  return <section className={`pigent-card pigent-task-card is-${density}`}><header><strong>Tasks</strong><span>{done} / {tasks.length || 1}</span></header><div className="pigent-progress"><i style={{ width: `${tasks.length ? done / tasks.length * 100 : 0}%` }} /></div>
    <div className="pigent-task-list">{(tasks.length ? tasks : [snapshot.root]).map((task) => <div key={task.id} className={`is-${task.status}`}>{task.status === 'done' ? <Check /> : task.status === 'running' ? <LoaderCircle className="spin" /> : task.status === 'failed' ? <OctagonX /> : <Circle />}<span>{task.title}</span></div>)}</div></section>
}
