import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import AssetPicker from './AssetPicker'
import { request, type Handoff } from './api'
import { FormSection, PageHeading, PublishGuide } from './ui'
import Button from '../../components/ui/Button'
import { useCategories } from './useCategories'
import { dialog } from '../../lib/dialog'
import AuthorizationPanel from './AuthorizationPanel'
import DramaPublishModal from './DramaPublishModal'
import { handoffLabel, isHandoffActive, latestEpisodeHandoffs, mergeSyncedCover, mergeSyncedEpisodes } from './dramaPublishing'
import { isFreeEpisode, previewStatusLabel } from './playbackPolicy'
import { explainMarketplaceError } from './messages'

type EpisodeDraft = { id?: number; version?: number; episode_no: number; title: string; description?: string; asset_id: number | null; cover_asset_id: number | null; copyright_price_fen: number; unlock_price_fen: number; share_bps?: number | null; source?: 'printfilm' | 'external' | 'original' | 'ai' | 'authorized'; preview_status?: string; preview_error?: string }
type SeriesDraft = { id: number; version: number; title: string; description: string; category: string; tags: string[]; cover_asset_id?: number | null; sale_type: 'free' | 'copyright_contact' | 'platform_unlock'; copyright_price_fen: number; free_episode_count?: number; audit_status?: string; listed?: boolean; episodes: EpisodeDraft[]; authorization_ready?: boolean; sync_in_progress?: boolean; pending_handoffs?: Handoff[] }
type ImportSource = { id: number; title: string; episodes: { id: number; name: string; ready: boolean }[] }

function EpisodePanel({ episode, count, free, open, saleType, seriesId, busy, videoLabel, videoLocked, lockVideoUntilPreview, toggle, update, remove, goRights }: {
  episode: EpisodeDraft; count: number; free: boolean; open: boolean; saleType: SeriesDraft['sale_type']; seriesId?: string; busy: boolean; videoLabel: string; videoLocked: boolean; lockVideoUntilPreview: boolean
  toggle: () => void; update: (patch: Partial<EpisodeDraft>) => void; remove: () => void; goRights: () => void
}) {
  return <article className={`pf-episode-fold${open ? ' is-open' : ''}`}>
    <button type="button" className="pf-episode-fold-head" aria-expanded={open} onClick={toggle}>
      <span>{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}第 {episode.episode_no} 集 · {episode.title || '未命名'}</span>
      <em>{free ? '免费' : '收费'} · {videoLabel}</em>
    </button>
    {open && <div className="pf-episode-fold-body">
      <p role="status">ตัวอย่างทดลองชม: {previewStatusLabel(episode.preview_status, free)}</p>
      {!free && episode.preview_error && <p role="alert">{explainMarketplaceError(episode.preview_error)}</p>}
      <label>ชื่อตอน<span className="pf-req-mark">จำเป็นต้องระบุ</span><input required value={episode.title} onChange={event => update({ title: event.target.value })} /></label>
      <label>คำแนะนำประจำตอน<textarea value={episode.description || ''} maxLength={5000} onChange={event => update({ description: event.target.value })} placeholder="แนะนำเนื้อหาของตอนนี้" /></label>
      <label>แหล่งที่มาของเนื้อหา<select disabled={videoLocked} value={episode.source || 'external'} onChange={event => update({ source: event.target.value as EpisodeDraft['source'] })}><option value="printfilm">สร้างจาก PrintFilm</option><option value="external">สร้างจากแพลตฟอร์มอื่น</option></select></label>
      <AssetPicker kind="video" value={episode.asset_id} onChange={asset_id => update({ asset_id })} title="วิดีโอประจำตอน" required locked={videoLocked} lockUntilPreview={lockVideoUntilPreview} />
      <AssetPicker kind="image" required value={episode.cover_asset_id} onChange={cover_asset_id => update({ cover_asset_id })} title="ภาพหน้าปกประจำตอน (สามารถใช้ภาพหน้าปกของซีรีส์ได้)" />
      {saleType !== 'free' && <label>ราคาอ้างอิงประจำตอนนี้ (บาท)<input type="number" min="0" step="0.01" value={(episode.copyright_price_fen / 100) || ''} onChange={event => update({ copyright_price_fen: Math.round(Number(event.target.value || 0) * 100) })} /></label>}
      {episode.source === 'printfilm' ? <p className="pf-market-notice">สร้างจาก PrintFilm: ซีรีส์นี้ใช้หนังสือมอบอำนาจของบัญชีร่วมกัน ไม่จำเป็นต้องลงนามหรืออัปโหลดใบรับรองทีละตอน</p> : episode.asset_id && (seriesId ? <button type="button" disabled={busy} onClick={goRights}>กรอกเอกสารสิทธิ์ตอนที่ {episode.episode_no}</button> : <p>โปรดบันทึกแบบร่างก่อน แล้วจึงกรอกเอกสารสิทธิ์ของตอนนี้ หลังจากบันทึกแล้วจะกลับมาที่หน้านี้</p>)}
      {saleType === 'platform_unlock' && <><label>ราคาปลดล็อกสำหรับผู้ชมในตอนนี้ (บาท)<input type="number" min="0.01" step="0.01" value={(episode.unlock_price_fen / 100) || ''} onChange={event => update({ unlock_price_fen: Math.round(Number(event.target.value || 0) * 100) })} /></label><label>อัตราส่วนแบ่งของแพลตฟอร์มสำหรับตอนนี้ (เว้นว่างไว้เพื่อใช้ค่าเริ่มต้นของแพลตฟอร์ม)<input type="number" min="0" max="10000" step="1" value={episode.share_bps ?? ''} onChange={event => update({ share_bps: event.target.value === '' ? null : Number(event.target.value) })} placeholder="ตัวอย่างเช่น 2000 หมายถึง แพลตฟอร์ม 20%, ครีเอเตอร์ 80%" /><small>10000 หมายถึง 100%; หากไม่ได้ตั้งค่าในตอนนี้จะใช้สัดส่วนเริ่มต้นของแพลตฟอร์ม</small></label></>}
      {count > 1 && <button type="button" disabled={busy} onClick={remove}>ลบตอนนี้</button>}
    </div>}
  </article>
}

export default function SeriesEditor() {
  const { id } = useParams(); const navigate = useNavigate()
  const { names: categories, error: categoryError } = useCategories()
  const [series, setSeries] = useState<SeriesDraft | null>(null)
  const [saleType, setSaleType] = useState<'free' | 'copyright_contact' | 'platform_unlock'>('copyright_contact')
  const [freeEpisodeCount, setFreeEpisodeCount] = useState(0)
  const [category, setCategory] = useState('')
  const [coverId, setCoverId] = useState<number | null>(null)
  const [episodes, setEpisodes] = useState<EpisodeDraft[]>([])
  const [removedEpisodeIds, setRemovedEpisodeIds] = useState<number[]>([])
  const [sources, setSources] = useState<ImportSource[]>([]); const [sourceId, setSourceId] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [handoffs, setHandoffs] = useState<Handoff[]>([])
  const [handoffsLoaded, setHandoffsLoaded] = useState(!id)
  const [handoffError, setHandoffError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState('')
  const [previewPollError, setPreviewPollError] = useState('')
  const savedEpisodes = useRef<EpisodeDraft[]>([])
  const savedCoverId = useRef<number | null>(null)
  const coverEdited = useRef(false)
  const [poll, setPoll] = useState(0)
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set([0]))
  const episodeHandoffs = latestEpisodeHandoffs(handoffs)
  const hasSyncFailure = episodeHandoffs.some(item => item.status === 'failed')
  const syncing = Boolean(series?.sync_in_progress) || episodeHandoffs.some(isHandoffActive)
  const syncBlocked = syncing || Boolean(id && !handoffsLoaded)
  const previewActive = Boolean(series?.episodes.some(episode => !isFreeEpisode(series, episode.episode_no) && (episode.preview_status === 'pending' || episode.preview_status === 'running')))
  const previewFailed = Boolean(series?.episodes.some(episode => !isFreeEpisode(series, episode.episode_no) && episode.preview_status === 'failed'))
  function acceptSaved(value: SeriesDraft) {
    setSeries(value); setSaleType(value.sale_type); setFreeEpisodeCount(value.free_episode_count || 0); setCategory(value.category || '其他'); setCoverId(value.cover_asset_id ?? null)
    savedCoverId.current = value.cover_asset_id ?? null; coverEdited.current = false
    const normalized = value.episodes.map(item => ({ ...item, asset_id: item.asset_id ?? null, cover_asset_id: item.cover_asset_id ?? null }))
    setEpisodes(normalized); savedEpisodes.current = normalized; setRemovedEpisodeIds([]); setDirty(false)
    if (value.pending_handoffs) setHandoffs(current => [...value.pending_handoffs!, ...current.filter(item => !value.pending_handoffs!.some(pending => pending.id === item.id))])
  }
  // 同步封面以已加载的远端值为基线，避免บันทึกแบบร่าง时把后台刚回填的封面ล้างข้อมูล。
  function acceptSyncedCover(value: SeriesDraft) {
    const previous = savedCoverId.current, remote = value.cover_asset_id ?? null, edited = coverEdited.current
    setCoverId(current => mergeSyncedCover(current, remote, previous, edited))
    savedCoverId.current = remote
  }
  useEffect(() => {
    if (!id) { setEpisodes([{ episode_no: 1, title: '第1集', asset_id: null, cover_asset_id: null, copyright_price_fen: 0, unlock_price_fen: 0 }]); return }
    let active = true
    setHandoffsLoaded(false)
    request<SeriesDraft>(`/series/${id}`).then(value => { if (active) acceptSaved(value) }).catch(e => { if (active) setError(e.message) })
    return () => { active = false }
  }, [id])
  useEffect(() => { if (id) request<{ items: ImportSource[] }>('/series/import-sources').then(value => setSources(value.items)).catch(() => {}) }, [id])
  useEffect(() => {
    if (!id || (series?.audit_status !== 'processing' && !previewActive)) return
    let active = true
    const timer = window.setInterval(() => {
      request<SeriesDraft>(`/series/${id}`).then(fresh => {
        if (!active) return
        setPreviewPollError('')
        setSeries(current => current ? { ...current, audit_status: fresh.audit_status, listed: fresh.listed, episodes: fresh.episodes } : fresh)
        setEpisodes(current => current.map(episode => {
          const remote = fresh.episodes.find(item => item.id === episode.id && item.version === episode.version && item.asset_id === episode.asset_id)
          return remote ? { ...episode, preview_status: remote.preview_status, preview_error: remote.preview_error } : episode
        }))
      }).catch(() => { if (active) setPreviewPollError('ยังไม่สามารถอ่านความคืบหน้าตัวอย่างสั้นได้ กำลังลองใหม่ เนื้อหาที่กรอกไว้จะยังคงอยู่') })
    }, 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [id, series?.audit_status, previewActive])
  useEffect(() => {
    if (!id) return
    let stop = false
    let timer = 0
    async function tick() {
      try {
        const value = await request<{ items: Handoff[] }>(`/handoffs?series_id=${id}`)
        if (stop) return
        const items = value.items
        let activeSync = latestEpisodeHandoffs(items).some(isHandoffActive)
        setHandoffs(items)
        setHandoffsLoaded(true); setHandoffError('')
        if (items.length) {
          const fresh = await request<SeriesDraft>(`/series/${id}`)
          if (stop) return
          activeSync = activeSync || Boolean(fresh.sync_in_progress)
          if (fresh.pending_handoffs?.length) setHandoffs([...fresh.pending_handoffs, ...items.filter(item => !fresh.pending_handoffs!.some(pending => pending.id === item.id))])
          const previous = savedEpisodes.current
          setEpisodes(current => mergeSyncedEpisodes(current, fresh.episodes, previous))
          savedEpisodes.current = fresh.episodes
          acceptSyncedCover(fresh)
          // Worker 也会推进父系列版本和封面；表单仍保留用户正在填写的内容。
          setSeries(current => current ? { ...current, cover_asset_id: fresh.cover_asset_id, version: fresh.version, audit_status: fresh.audit_status, listed: fresh.listed, authorization_ready: fresh.authorization_ready, sync_in_progress: fresh.sync_in_progress } : fresh)
        }
        if (activeSync) timer = window.setTimeout(() => setPoll(value => value + 1), 3000)
      } catch { if (!stop) { setHandoffError('ยังไม่สามารถอ่านความคืบหน้าการซิงค์ได้ กำลังลองใหม่ เนื้อหาที่กรอกไว้จะยังคงอยู่'); timer = window.setTimeout(() => setPoll(value => value + 1), 5000) } }
    }
    void tick()
    return () => { stop = true; window.clearTimeout(timer) }
  }, [id, poll])
  const syncingEpisodes = episodeHandoffs.filter(isHandoffActive).map(item => item.episode_id).join(',')
  const episodeIdList = episodes.map(item => item.id ?? 0).join(',')
  useEffect(() => {
    if (!syncingEpisodes) return
    const syncing = new Set(syncingEpisodes.split(',').map(Number))
    const indexes = episodeIdList.split(',').flatMap((value, index) => syncing.has(Number(value)) ? [index] : [])
    if (indexes.length) setExpanded(new Set(indexes))
  }, [syncingEpisodes, episodeIdList])
  useEffect(() => { if (!id && !category && categories.length) setCategory(categories.includes('其他') ? '其他' : categories[0]) }, [id, category, categories])
  function update(index: number, patch: Partial<EpisodeDraft>) { setDirty(true); setEpisodes(value => value.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)) }
  function episodeBody(episode: EpisodeDraft) {
    return { episode_no: episode.episode_no, title: episode.title, description: episode.description || '', asset_id: episode.asset_id, cover_asset_id: episode.cover_asset_id, copyright_price_fen: episode.copyright_price_fen || 0, unlock_price_fen: episode.unlock_price_fen || 0, share_bps: episode.share_bps ?? null, source: episode.source || 'external' }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage(''); if (syncBlocked || hasSyncFailure) { setBusy(false); setError('กรุณารอให้การซิงค์เสร็จสิ้นหรือลองใหม่งานที่ล้มเหลวก่อนบันทึก ข้อมูลที่ป้อนไว้จะยังคงอยู่'); return } const missing = episodes.findIndex(item => !item.title.trim()); if (missing >= 0) { setExpanded(new Set([missing])); setBusy(false); setError(`ยังไม่ได้กรอกชื่อตอนที่ ${missing + 1}`); return } const form = new FormData(event.currentTarget)
    try {
      const payload = { title: form.get('title'), description: form.get('description'), category: category || '其他', tags: String(form.get('tags') || '').split(/[,，]/).map(value => value.trim()).filter(Boolean), sale_type: saleType, copyright_price_fen: Math.round(Number(form.get('copyright_price') || 0) * 100), free_episode_count: freeEpisodeCount, cover_asset_id: coverId, ...(id ? { version: series?.version } : {}) }
      const saved = await request<SeriesDraft>(id ? `/series/${id}` : '/series', id ? 'PATCH' : 'POST', payload)
      if (!id) for (const episode of episodes) await request(`/series/${saved.id}/episodes`, 'POST', episodeBody(episode))
      else {
        // 先ลบ再改编号，避免同一系列的集数唯一约束冲突。只ส่ง可แก้ไข字段。
        for (const episodeId of removedEpisodeIds) await request(`/series/${id}/episodes/${episodeId}`, 'DELETE')
        for (const episode of episodes) {
          if (episode.id) await request(`/series/${id}/episodes/${episode.id}`, 'PATCH', { ...episodeBody(episode), version: saved.episodes.find(remote => remote.id === episode.id)?.version ?? episode.version })
          else await request(`/series/${id}/episodes`, 'POST', episodeBody(episode))
        }
      }
      if (!id) navigate(`/marketplace/series/${saved.id}/edit`)
      else { acceptSaved(await request<SeriesDraft>(`/series/${saved.id}`)); setMessage('บันทึกฉบับร่างซีรีส์แล้ว') }
    } catch (err) {
      setError((err as Error).message)
      // 分集逐条บันทึกไม่สำเร็จ时，รีเฟรช已推进的版本，但保留未บันทึก输入供用户ลองใหม่。
      if (id) try {
        const fresh = await request<SeriesDraft>(`/series/${id}`)
        setSeries(current => current ? { ...current, version: fresh.version, audit_status: fresh.audit_status, listed: fresh.listed } : fresh)
        setEpisodes(current => current.map(episode => ({ ...episode, version: fresh.episodes.find(remote => remote.id === episode.id)?.version ?? episode.version })))
      } catch { /* 保留原始บันทึก错误 */ }
    } finally { setBusy(false) }
  }
  async function retryHandoff(handoff: Handoff) {
    setBusy(true); setError('')
    try {
      const next = await request<Handoff>(`/handoffs/${handoff.id}/retry`, 'POST')
      setHandoffs(value => value.map(row => row.id === next.id ? next : row)); setPoll(value => value + 1)
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  async function submit() {
    if (!id || !series) return
    if (syncBlocked || dirty || episodeHandoffs.some(item => item.status === 'failed')) { setError('กรุณารอให้การซิงค์เสร็จสิ้น จัดการงานที่ล้มเหลว และบันทึกการเปลี่ยนแปลงก่อนส่งตรวจทาน'); return }
    setBusy(true); setError('')
    try { const updated = await request<SeriesDraft>(`/series/${id}/submit`, 'POST', { version: series.version }); acceptSaved(updated); setMessage(updated.audit_status === 'processing' ? 'กำลังเตรียมตัวอย่างสั้น เมื่อเสร็จแล้วจะเข้าสู่สถานะรอตรวจทานโดยอัตโนมัติ' : 'ซีรีส์สั้นและเอกสารลิขสิทธิ์ถูกส่งแล้ว รอผู้ดูแลระบบตรวจทาน') }
    catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  async function removeSeries() {
    if (!id) return
    const ok = await dialog.confirm({ title: 'ลบละครสั้น', message: 'หลังจากลบ ซีรีส์สั้นทั้งเรื่องจะถูกนำออกจากผลงานของฉันและตลาดผลงาน ข้อมูลตอนและประวัติตรวจทานจะยังคงอยู่ แต่จะไม่แสดงอีกต่อไป', confirmText: 'ลบ', tone: 'danger' })
    if (!ok) return
    setBusy(true); setError('')
    try { await request(`/series/${id}`, 'DELETE'); navigate('/marketplace/mine') } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  async function retryPreviews() {
    if (!id || !series || busy || dirty || previewActive) return
    setBusy(true); setError(''); setMessage('')
    try {
      acceptSaved(await request<SeriesDraft>(`/series/${id}/preview/retry`, 'POST', { version: series.version }))
      setMessage('จัดคิวสร้างตัวอย่างสั้นใหม่แล้ว สามารถดูความคืบหน้าในแต่ละตอนได้')
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  async function toggleListing() {
    if (!id || !series || series.audit_status !== 'approved') return
    setBusy(true); setError('')
    try {
      const updated = await request<SeriesDraft>(`/series/${id}/listing?listed=${!series.listed}`, 'POST', { version: series.version })
      setSeries(updated); setEpisodes(updated.episodes); setMessage(updated.listed ? 'เผยแพร่ซีรีส์ไปยังตลาดผลงานแล้ว' : 'นำซีรีส์ลงแล้ว ประวัติตรวจทานยังคงอยู่')
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  const current = series
  if (id && !series && !error) return <p role="status">กำลังโหลดซีรีส์…</p>
  return <><PageHeading title={id ? 'แก้ไขซีรีส์สั้น' : 'เผยแพร่ซีรีส์สั้น'} description="ซีรีส์สั้นจะแสดงในตลาดผลงานเช่นเดียวกับวิดีโอเดี่ยว สามารถเพิ่มตอนในหน้านี้ได้ กฎลิขสิทธิ์เหมือนกับวิดีโอเดี่ยว" back="/marketplace" /><div className="pf-market-editor-layout"><form className="pf-market-editor-main pf-market-form" onSubmit={save} onChangeCapture={event => { if (!(event.target as HTMLElement).closest('.pf-market-authorization, [data-market-transient]')) setDirty(true) }}>
    <FormSection step="01" title="ข้อมูลซีรีส์" description="สร้างซีรีส์ก่อน แล้วจึงอัปโหลดหรือนำเข้าวิดีโอทีละตอน"><label>ชื่อซีรีส์<span className="pf-req-mark">จำเป็นต้องระบุ</span><input name="title" required maxLength={200} placeholder="ตัวอย่างเช่น: แสงไฟในเมืองใหญ่" defaultValue={current?.title} /></label><label>เรื่องย่อ<textarea name="description" maxLength={5000} defaultValue={current?.description} placeholder="แนะนำธีมและเนื้อหาของซีรีส์สั้นทั้งเรื่อง" /></label><div className="pf-market-field-row"><label>หมวดหมู่<span className="pf-req-mark">จำเป็นต้องระบุ</span><select name="category" required value={category || current?.category || ''} onChange={event => setCategory(event.target.value)} disabled={!categories.length}><option value="" disabled>โปรดเลือกหมวดหมู่ซีรีส์</option>{current?.category && !categories.includes(current.category) && <option value={current.category}>{current.category} (หมวดหมู่เดิม)</option>}{categories.map(name => <option key={name} value={name}>{name}</option>)}</select>{categoryError && <span role="alert">{categoryError}</span>}</label><label>แท็ก<input name="tags" defaultValue={current?.tags?.join(', ')} placeholder="ชีวิตในเมือง, ซีรีส์สั้น" /></label></div><AssetPicker kind="image" value={coverId} onChange={value => { coverEdited.current = true; setCoverId(value); setDirty(true) }} title="ภาพหน้าปกซีรีส์ (ต้องอัปโหลดที่หน้าปกซีรีส์หรือหน้าปกประจำตอนอย่างน้อยหนึ่งแห่ง)" /></FormSection>
    <FormSection step="02" title="รูปแบบรายได้" description="เผยแพร่ฟรีเพื่อรับชมเต็มเรื่อง; ขายลิขสิทธิ์ผ่านการเจรจากับฝ่ายบริการลูกค้า; วางจำหน่ายบนแพลตฟอร์มโดยปลดล็อกทีละตอนและแบ่งรายได้"><select value={saleType} onChange={event => setSaleType(event.target.value as typeof saleType)}><option value="free">เผยแพร่ฟรี</option><option value="copyright_contact">รายได้จากการขายลิขสิทธิ์</option><option value="platform_unlock">รายได้จากการปลดล็อกบนแพลตฟอร์ม</option></select><label>ราคาอ้างอิง (บาท)<input name="copyright_price" type="number" min="0" step="0.01" defaultValue={current?.copyright_price_fen ? current.copyright_price_fen / 100 : ''} /></label><label>จำนวนตอนที่เปิดให้ชมฟรี<span className="pf-req-mark">ตอนแรกๆ ชมฟรี</span><input type="number" min="0" max="10000" step="1" value={freeEpisodeCount} onChange={event => setFreeEpisodeCount(Math.max(0, Number(event.target.value) || 0))} /></label><p className="pf-market-notice">เมื่อเลือก "เผยแพร่ฟรี" ทุกตอนจะเล่นฉบับเต็มโดยไม่ต้องมีตัวอย่างทดลองชม สำหรับรูปแบบรายได้อื่น สามารถตั้งค่าให้ตอนแรกๆ รับชมฟรีได้ ส่วนตอนที่เหลือจะมีตัวอย่างสั้นแบบไม่มีลายน้ำความยาวไม่เกิน 15 วินาที (และไม่เกิน 30% ของความยาวเรื่อง) ราคาอ้างอิงความร่วมมือด้านลิขสิทธิ์ไม่ได้หมายความว่ารวมค่าธรรมเนียมการโอนสิทธิ์ โปรดยืนยันรายละเอียดกับฝ่ายบริการลูกค้า การวางจำหน่ายบนแพลตฟอร์มจะกำหนดราคาเป็นรายตอน ผู้ชมที่ปลดล็อกจะได้รับสิทธิ์ในการรับชมออนไลน์ตลอดไปโดยไม่รวมการโอนลิขสิทธิ์ และต้องเปิดใช้งานระบบส่วนแบ่งรายได้บนแพลตฟอร์มก่อนจึงจะส่งตรวจทานได้ หากแก้ไขรูปแบบรายได้หรือจำนวนตอนฟรี ระบบจะตรวจสอบสถานะความพร้อมในการเล่นใหม่อีกครั้ง</p></FormSection>
    <FormSection step="03" title="เนื้อหาแต่ละตอน" description="แต่ละตอนมีวิดีโอฉบับเต็มและภาพหน้าปก สามารถกรอกข้อมูลระหว่างซิงค์และบันทึกหลังเสร็จสิ้น">
      <div className="pf-episode-tools"><button type="button" onClick={() => setExpanded(new Set(episodes.map((_, index) => index)))}>ขยายทั้งหมด</button><button type="button" onClick={() => setExpanded(new Set())}>ย่อทั้งหมด</button><span>ทั้งหมด {episodes.length} ตอน</span></div>
      {syncBlocked && <p className="pf-market-notice" role="status">{syncing ? 'วิดีโอกำลังซิงค์ในเบื้องหลัง สามารถกรอกชื่อและราคาไว้ก่อนได้ เมื่อซิงค์เสร็จสิ้นแล้วจึงบันทึกและส่ง การปิดหน้านี้ไม่มีผลต่องาน' : 'กำลังตรวจสอบสถานะการซิงค์...'}</p>}
      {hasSyncFailure && <p className="pf-market-notice" role="alert">การซิงค์วิดีโอบางส่วนล้มเหลว ข้อมูลที่ป้อนไว้ยังคงอยู่ กรุณาลองซิงค์ใหม่หรือเลือกเวอร์ชันต้นทางใหม่ แล้วจึงบันทึก</p>}
      {handoffError && <p role="alert">{handoffError}</p>}
      <div className="pf-market-episodes">{episodes.map((episode, index) => {
        const handoff = episodeHandoffs.find(item => item.episode_id === episode.id)
        const syncingVideo = Boolean(handoff && isHandoffActive(handoff))
        const fromPrintfilm = episode.source === 'printfilm'
        const videoLabel = handoff ? handoffLabel(handoff) : episode.asset_id ? 'วิดีโอพร้อมแล้ว' : 'ยังไม่มีวิดีโอ'
        return <div key={episode.id ?? `new-${index}`}>
          <EpisodePanel episode={episode} count={episodes.length} free={isFreeEpisode({ sale_type: saleType, free_episode_count: freeEpisodeCount }, episode.episode_no)} open={expanded.has(index)} saleType={saleType} seriesId={id} busy={busy || syncBlocked || hasSyncFailure} videoLabel={videoLabel} videoLocked={syncingVideo || (fromPrintfilm && !episode.asset_id)} lockVideoUntilPreview={fromPrintfilm}
            toggle={() => setExpanded(value => { const next = new Set(value); if (next.has(index)) next.delete(index); else next.add(index); return next })}
            update={patch => update(index, patch)}
            remove={() => { setDirty(true); if (episode.id) setRemovedEpisodeIds(value => [...value, episode.id as number]); setEpisodes(value => value.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, episode_no: itemIndex + 1 }))); setExpanded(new Set([Math.max(0, index - 1)])) }}
            goRights={() => { if (dirty) { setError('กรุณาบันทึกแบบร่างก่อน แล้วจึงกรอกเอกสารสิทธิ์ของผลงานภายนอก'); return } navigate(`/marketplace/assets/${episode.asset_id}/rights?source=${episode.source || 'external'}&return=${encodeURIComponent(`/marketplace/series/${id}/edit`)}`) }} />
          {handoff && handoff.status !== 'ready' && <p className="pf-market-notice" role={handoff.status === 'failed' ? 'alert' : 'status'}>ตอนที่ {episode.episode_no} · {handoffLabel(handoff)}{handoff.error ? `：${explainMarketplaceError(handoff.error)}` : ''}
            {handoff.status === 'failed' && handoff.retryable !== false && <button type="button" disabled={busy} onClick={() => void retryHandoff(handoff)}>ซิงค์ใหม่</button>}
            {handoff.status === 'failed' && handoff.retryable === false && <span>กรุณาเลือกตอนของซีรีส์ใหม่ด้านล่าง และยืนยันเวอร์ชันต้นทางล่าสุดก่อนซิงค์</span>}
          </p>}
        </div>
      })}</div>
      <button type="button" disabled={busy || syncBlocked || hasSyncFailure} onClick={() => { setDirty(true); setEpisodes(value => [...value, { episode_no: value.length + 1, title: `ตอนที่ ${value.length + 1}`, asset_id: null, cover_asset_id: null, copyright_price_fen: 0, unlock_price_fen: 0, source: 'external' }]); setExpanded(new Set([episodes.length])) }}>+ เพิ่มตอนถัดไป</button>
    </FormSection>
    {id && <FormSection step="04" title="นำเข้าจากซีรีส์ PrintFilm ของฉัน" description="หลังเลือกโปรเจกต์ สามารถเลือกตอนฉบับเต็มในหน้าต่างเดียวกัน เวอร์ชันต้นทางใหม่ต้องได้รับการยืนยันก่อนอัปเดต">
      <select data-market-transient value={sourceId} disabled={busy || syncBlocked} onChange={event => setSourceId(event.target.value)}><option value="">เลือกโปรเจกต์ละครซีรีส์</option>{sources.map(source => <option key={source.id} value={source.id}>{source.title}</option>)}</select>
      <button type="button" disabled={busy || syncBlocked || !sourceId || (dirty && !hasSyncFailure)} onClick={() => setImportOpen(true)}>เลือกตอนและซิงค์มายังซีรีส์นี้</button>
      {dirty && !hasSyncFailure && <p className="pf-market-notice">กรุณาบันทึกการแก้ไขปัจจุบันก่อนนำเข้าตอน</p>}
    </FormSection>}
    {episodes.some(item => item.source === 'printfilm') && <FormSection step="05" title="การยืนยันสิทธิ์ PrintFilm" description="บัญชีเดียวกันลงนามเพียงครั้งเดียวตามข้อกำหนดปัจจุบัน เมื่อส่งตรวจทานจะเชื่อมโยงทุกตอนของ PrintFilm โดยอัตโนมัติ">
      <AuthorizationPanel onSigned={() => { setSeries(value => value ? { ...value, authorization_ready: true } : value); setMessage('ลงนามหนังสือมอบอำนาจแล้ว เมื่อส่งตรวจทานจะเชื่อมโยงตอนของ PrintFilm ในซีรีส์นี้โดยอัตโนมัติ') }} />
    </FormSection>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {previewPollError && (series?.audit_status === 'processing' || previewActive) && <p role="status">{previewPollError}</p>}
    <div className="pf-market-form-actions">
      <Button variant="lime" type="submit" disabled={busy || syncBlocked || hasSyncFailure || !categories.length || !category}>{busy ? 'กำลังประมวลผล…' : 'บันทึกฉบับร่างซีรีส์'}</Button>
      {id && (series?.audit_status === 'draft' || series?.audit_status === 'rejected' || series?.audit_status === 'preview_failed') && <button type="button" disabled={busy || syncBlocked || dirty || episodeHandoffs.some(item => item.status === 'failed') || (episodes.some(item => item.source === 'printfilm') && series.authorization_ready === false)} onClick={() => void submit()}>{series?.audit_status === 'preview_failed' ? 'ลองสร้างตัวอย่างสั้นใหม่และส่ง' : 'ส่งตรวจทานซีรีส์'}</button>}
      {id && dirty && <p role="status">มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก กรุณาบันทึกแบบร่างก่อนส่งตรวจทาน</p>}
      {id && series?.audit_status === 'processing' && <p role="status">กำลังสร้างตัวอย่างสั้น เมื่อเสร็จแล้วจะเข้าสู่สถานะรอตรวจทานโดยอัตโนมัติ</p>}
      {id && series?.audit_status === 'approved' && <button type="button" disabled={busy || syncBlocked || dirty} onClick={() => void toggleListing()}>{series.listed ? 'นำซีรีส์ลง' : 'วางจำหน่ายในตลาดผลงาน'}</button>}
      {id && series?.audit_status === 'approved' && (previewFailed || previewActive) && <button type="button" disabled={busy || syncBlocked || dirty || previewActive} onClick={() => void retryPreviews()}>{previewActive ? 'กำลังสร้างตัวอย่างสั้น...' : 'ลองสร้างตัวอย่างสั้นใหม่'}</button>}
      {id && <button type="button" disabled={busy || syncBlocked} onClick={() => void removeSeries()}>ลบละครสั้น</button>}
    </div>
  </form><PublishGuide saleType={saleType} /></div>
  {importOpen && id && sourceId && <DramaPublishModal projectId={Number(sourceId)} targetSeriesId={Number(id)} onClose={() => setImportOpen(false)} onPublished={() => {
    setBusy(true)
    request<SeriesDraft>(`/series/${id}`).then(fresh => {
      const previous = savedEpisodes.current
      setEpisodes(current => [...mergeSyncedEpisodes(current, fresh.episodes, previous), ...fresh.episodes.filter(item => !current.some(local => local.id === item.id))])
      savedEpisodes.current = fresh.episodes
      acceptSyncedCover(fresh)
      setSeries(current => current ? { ...current, cover_asset_id: fresh.cover_asset_id, version: fresh.version, audit_status: fresh.audit_status, listed: fresh.listed, authorization_ready: fresh.authorization_ready, sync_in_progress: fresh.sync_in_progress } : fresh)
      setPoll(value => value + 1); setExpanded(new Set(fresh.episodes.map((_, index) => index))); setMessage('สร้างงานซิงค์แล้ว เมื่อเสร็จสิ้นจะใส่วิดีโอฉบับเต็มโดยอัตโนมัติ ข้อมูลที่กรอกไว้ยังคงอยู่')
    }).catch(err => setError((err as Error).message)).finally(() => setBusy(false))
  }} />}
  </>
}
