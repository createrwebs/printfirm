import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, LoaderCircle, RefreshCw } from 'lucide-react'
import { creationApi } from '../../api/creation'
import { isRequestAborted } from '../../api/http'
import AppShell from '../../components/layout/AppShell'
import Button from '../../components/ui/Button'
import BillingErrorNotice from '../../components/billing/BillingErrorNotice'
import './shortVideoCreate.css'

/** 旧会话先等待生产者退出，再安全移交普通分步เวิร์กสเตชัน。 */
export default function CreationSessionEditorBridge() {
  const { sessionId } = useParams()
  const [params] = useSearchParams()
  const projectId = Number(params.get('project')) || undefined
  const returnPath = `/studio/sessions/${sessionId}${projectId ? `?project=${projectId}` : ''}`
  const nav = useNavigate()
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [waiting, setWaiting] = useState(false)
  useEffect(() => {
    if (!sessionId) return
    if (!localStorage.getItem('token')) {
      nav(`/auth?next=${encodeURIComponent(returnPath)}`, { replace: true })
      return
    }
    let disposed = false
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    setError('')
    async function transfer() {
      try {
        const project = await creationApi.openEditor(sessionId!, controller.signal, projectId)
        if (disposed) return
        nav(project.shots.length || project.final_video_url ? `/studio/${project.id}` : `/studio/new?project=${project.id}`, { replace: true })
      } catch (cause) {
        if (disposed || isRequestAborted(cause)) return
        const status = cause && typeof cause === 'object' && 'status' in cause ? Number(cause.status) : 0
        if (status === 409 && cause instanceof Error && cause.message.includes('正在停止旧创作任务')) {
          setWaiting(true)
          timer = setTimeout(() => { void transfer() }, 2000)
        } else if (status === 401) {
          nav(`/auth?next=${encodeURIComponent(returnPath)}`, { replace: true })
        } else setError(cause instanceof Error ? cause.message : 'ไม่สามารถเปิดโปรเจกต์ได้ชั่วคราว โปรดลองใหม่อีกครั้ง')
      }
    }
    void transfer()
    return () => { disposed = true; controller.abort(); if (timer) clearTimeout(timer) }
  }, [sessionId, projectId, returnPath, nav, attempt])
  return <AppShell active="studio"><div className="sv-create-page">
    <Link to="/history" className="sv-back"><ArrowLeft size={16} /> 我的短片</Link>
    <section className="sv-panel" style={{ marginTop: 24 }}>
      <h2>เปิดเวิร์กสเปซแบบเป็นขั้นตอน</h2>
      <p>{waiting ? 'กำลังหยุดงานผลิตเดิม บทและแอสเซทที่มีอยู่จะยังคงอยู่ เมื่อออกจากงานแล้วจะเข้าสู่ตัวแก้ไขอัตโนมัติ' : 'กำลังจัดเตรียมบทและแอสเซทของโปรเจกต์ เพื่อแก้ไขต่อไป'}</p>
      {error ? <><BillingErrorNotice message={error} /><Button variant="lime" onClick={() => setAttempt(value => value + 1)}><RefreshCw size={16} /> ลองใหม่</Button></> : <div className="sv-loading"><LoaderCircle size={20} className="sv-spin" /> {waiting ? 'กำลังรองานเดิมออก…' : 'กำลังเปิด…'}</div>}
    </section>
  </div></AppShell>
}
