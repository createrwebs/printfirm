import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { CheckCircle2, Film, Loader2 } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { request } from './api'
import { internalReturn, withReturn } from './ui'
import { publishSelection, sourceRelation, type DramaPublishContext, type DramaPublishResult } from './dramaPublishing'
import './dramaPublishing.css'

/** HTTP 页面没有 randomUUID，改用随机字节拼一个不少于 8 位的幂等键。 */
function publishKey() {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID()
  if (typeof crypto?.getRandomValues === 'function') return Array.from(crypto.getRandomValues(new Uint32Array(4)), part => part.toString(16).padStart(8, '0')).join('')
  return `pf${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`
}

type Props = {
  projectId: number; initialEpisodeId?: number; targetSeriesId?: number; selectReady?: boolean
  onClose: () => void; onPublished?: (result: DramaPublishResult) => void
}

// ละครซีรีส์卡片、分集ดูตัวอย่าง和市场แก้ไข页共用同一发布流程，只ส่ง服务端校验过的编号与版本。
export default function DramaPublishModal({ projectId, initialEpisodeId, targetSeriesId, selectReady = false, onClose, onPublished }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const [context, setContext] = useState<DramaPublishContext | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [updates, setUpdates] = useState<number[]>([])
  const [targetId, setTargetId] = useState(targetSeriesId ? String(targetSeriesId) : 'new')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const requestKey = useRef({ signature: '', key: '' })
  const submitting = useRef(false)
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    request<DramaPublishContext>(`/printfilm/dramas/${projectId}/publish-context`).then(value => {
      if (!active) return
      setContext(value)
      setTitle(current => current || value.project.title)
      setSelected(current => {
        const readyIds = value.episodes.filter(item => item.ready).map(item => item.id)
        if (current.length) return current.filter(id => readyIds.includes(id))
        if (initialEpisodeId && readyIds.includes(initialEpisodeId)) return [initialEpisodeId]
        return selectReady ? readyIds : []
      })
      setUpdates([])
    }).catch(err => { if (active) setError((err as Error).message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [projectId, initialEpisodeId, selectReady, reload])
  const target = context?.series.find(item => String(item.id) === targetId)
  const changed = context?.episodes.filter(item => selected.includes(item.id) && sourceRelation(item, target).changed) || []
  const missingUpdates = changed.some(item => !updates.includes(item.id))
  const storageReady = context?.storage_configured === true
  async function publish() {
    if (!context || !storageReady || submitting.current || !selected.length) return
    submitting.current = true; setBusy(true); setError('')
    try {
      if (targetId !== 'new' && !target) throw new Error('目标系列已变化，请รีเฟรช后重新เลือก')
      const episodes = publishSelection(context, selected, updates, target)
      const payload = { episodes, series_id: target?.id ?? null, ...(target ? { series_version: target.version } : { title: title.trim() || context.project.title }) }
      const signature = JSON.stringify(payload)
      // 网络超时后保留同一个幂等键；只有用户改变发布内容才สร้าง新批次。
      if (requestKey.current.signature !== signature) requestKey.current = { signature, key: publishKey() }
      const result = await request<DramaPublishResult>(`/printfilm/dramas/${projectId}/publish`, 'POST', { ...payload, idempotency_key: requestKey.current.key })
      if (onPublished) onPublished(result)
      else navigate(withReturn(`/marketplace/series/${result.series_id}/edit`, internalReturn(`${location.pathname}${location.search}`)))
      onClose()
    } catch (err) { setError((err as Error).message) }
    finally { submitting.current = false; setBusy(false) }
  }
  return <Modal open title="เผยแพร่สู่ตลาดดิจิทัลแอสเซท" size="lg" className="pf-drama-publish" onClose={onClose} dismissible={!busy} footer={<>
    <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>ยกเลิก</Button>
    <Button type="button" variant="lime" disabled={loading || busy || !storageReady || !selected.length || missingUpdates || (targetId !== 'new' && !target)} onClick={() => void publish()}>{busy ? <><Loader2 size={16} className="pf-drama-publish-spin" />正在สร้าง同步任务…</> : '同步并继续แก้ไข'}</Button>
  </>}>
    <p className="pf-drama-publish-intro">选中的完整分集会同步到市场独立บันทึก。随后补充封面和价格，确认版权信息后一并ส่ง审核；有效账号授权函会自动关联。</p>
    {loading ? <p role="status">正在检查分集和市场สถานะ…</p> : context ? <>
      {!storageReady && <p className="pf-drama-publish-warning" role="alert">文件服务暂未配置，暂时无法同步วิดีโอ。请联系ผู้ดูแลระบบ (Admin)เสร็จสิ้น文件服务配置后ลองใหม่。</p>}
      <div className="pf-drama-publish-project"><Film size={20} /><div><strong>{context.project.title}</strong><span>{context.episodes.length} 集 · 仅完整生成的分集可发布</span></div></div>
      <div className="pf-drama-publish-episodes" aria-label="เลือก发布分集">{context.episodes.map(episode => {
        const relation = sourceRelation(episode, target)
        return <div key={episode.id} className={`pf-drama-publish-episode${!episode.ready ? ' is-disabled' : ''}`}>
          <label><input type="checkbox" disabled={busy || !episode.ready || !storageReady} checked={selected.includes(episode.id)} onChange={event => { setSelected(value => event.target.checked ? [...value, episode.id] : value.filter(id => id !== episode.id)); setUpdates(value => value.filter(id => id !== episode.id)) }} /><span><strong>第 {episode.episode_number} 集 · {episode.name}</strong><small>{episode.completed_count}/{episode.fragment_count} 镜เสร็จสมบูรณ์{!episode.ready ? ` · ${episode.reason || '成片未就绪'}` : relation.existing ? relation.changed ? ' · 发现新版本' : ' · 已同步，此版本将直接复用' : ''}</small></span></label>
          {relation.changed && selected.includes(episode.id) && <label className="pf-drama-publish-update"><input type="checkbox" disabled={busy} checked={updates.includes(episode.id)} onChange={event => setUpdates(value => event.target.checked ? [...value, episode.id] : value.filter(id => id !== episode.id))} />确认更新为新的完整分集</label>}
        </div>
      })}{context.episodes.length === 0 && <p>这个โปรเจกต์还没有分集。</p>}</div>
      <label className="pf-drama-publish-field">发布到<select disabled={busy || Boolean(targetSeriesId)} value={targetId} onChange={event => { setTargetId(event.target.value); setUpdates([]) }}><option value="new">สร้างใหม่市场ละครสั้น</option>{context.series.map(item => <option key={item.id} value={item.id}>{item.title}{item.listed ? '（เผยแพร่แล้ว）' : ''}</option>)}</select></label>
      {targetId === 'new' ? <label className="pf-drama-publish-field">市场ละครสั้น名称<input value={title} disabled={busy} maxLength={200} onChange={event => setTitle(event.target.value)} placeholder={context.project.title} /></label> : <p className="pf-drama-publish-hint">保留已有系列的介绍、封面和收益ตั้งค่า；新分集接续目标系列集号。</p>}
      {(changed.length > 0 || (target && (target.listed || target.audit_status === 'approved' || target.audit_status === 'pending'))) && <p className="pf-drama-publish-warning">同步更新或追加分集后，系列将退回ฉบับร่าง并暂停公开销售，需要重新ส่ง审核。历史买家仍可播放已购买版本。</p>}
      <p className="pf-drama-publish-hint"><CheckCircle2 size={15} />{context.authorization_ready ? '当前授权函有效，同步后自动关联，无需逐集签署。' : '可先同步并บันทึกแบบร่าง，ส่ง系列审核前统一签署一次 PrintFilm 授权函。'}</p>
    </> : null}
    {error && <div className="pf-drama-publish-error" role="alert"><p>{error}</p><button type="button" disabled={busy || loading} onClick={() => setReload(value => value + 1)}>รีเฟรช分集สถานะ</button></div>}
  </Modal>
}
