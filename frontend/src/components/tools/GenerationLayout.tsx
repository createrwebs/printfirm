import type { ReactNode } from 'react'
import AppShell from '../layout/AppShell'
import { type MediaKind } from '../../lib/generationMedia'
import '../../styles/generation.css'
import '../../styles/generation-controls.css'

/** 生成เวิร์กสเตชัน与任务页共用布局，主侧栏按当前媒体ประเภท高亮。 */
export default function GenerationLayout({ children, tasks = false, kind }: { children: ReactNode; tasks?: boolean; kind?: MediaKind }) {
  return <AppShell active={tasks ? 'tasks' : kind} wide hideFooter>
    <div className="gen-layout">
      <div className="gen-main">{children}</div>
    </div>
  </AppShell>
}
