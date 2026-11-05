import { Navigate, useSearchParams } from 'react-router-dom'
import { legacyStudioEntryPath } from '../lib/shortVideoRoutes'

/** 旧วิดีโอสั้น首页也เข้าสู่โปรเจกต์卡片列表，明确的สร้างใหม่/โปรเจกต์链接保留。 */
export default function StudioPage() {
  const [params] = useSearchParams()
  return <Navigate to={legacyStudioEntryPath({ project: params.get('project'), template: params.get('template'), mode: params.get('mode') })} replace />
}
