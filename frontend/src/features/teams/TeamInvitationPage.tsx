import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AppShell from '../../components/layout/AppShell'
import Button from '../../components/ui/Button'
import { teamsApi } from '../../api/teams'
import { useTeamPreview } from './useTeamPreview'
import RequireAuth from '../../pages/drama/RequireAuth'
import './teams.css'

/** 加入页面要求真实登录，邮箱匹配由服务器再次校验。 */
export default function TeamInvitationPage() { return <RequireAuth><InvitationInner /></RequireAuth> }
/** token 不存储、不输出到日志，仅通过 POST 请求体传递。 */
function InvitationInner() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()
  const { reload, selectTeam } = useTeamPreview()
  /* invitation 检查结果；loading/busy/error 校验与ส่ง反馈。 */
  const [invitation, setInvitation] = useState<{ team_name: string; email: string; expires_at: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { let active = true; setLoading(true); setError(''); setInvitation(null); if (!token) { setError('邀请链接缺少令牌'); setLoading(false); return }; void teamsApi.inspectInvitation(token).then((data) => { if (active) setInvitation(data) }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : '邀请已失效') }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [token])
  /** 明确点击后消费邀请，加入สำเร็จ替换 URL 清除令牌。 */
  async function accept() { setBusy(true); setError(''); try { const team = await teamsApi.acceptInvitation(token); selectTeam(team.id); navigate(`/teams/${team.id}`, { replace: true }); void reload() } catch (cause) { setError(cause instanceof Error ? cause.message : 'เข้าร่วมทีมล้มเหลว โปรดลองใหม่อีกครั้ง') } finally { setBusy(false) } }
  return <AppShell active="team"><section className="pf-team-panel pf-team-empty"><h1>เข้าร่วมทีมสร้างสรรค์</h1>{loading ? <p role="status">กำลังตรวจสอบคำเชิญ…</p> : invitation ? <><h2>{invitation.team_name}</h2><p>อีเมลที่ได้รับเชิญ: {invitation.email}</p><p className="pf-team-muted">ใช้ได้ถึง {new Date(invitation.expires_at).toLocaleDateString('th-TH')}</p><Button variant="lime" onClick={accept} disabled={busy}>{busy ? 'กำลังเข้าร่วม…' : 'ยอมรับคำเชิญและเข้าร่วมทีม'}</Button></> : null}{error && <p className="pf-team-alert" role="alert">{error}</p>}<Button to="/teams">กลับไปที่ทีมของฉัน</Button></section></AppShell>
}
