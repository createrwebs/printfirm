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
      <p role="status">试看：{previewStatusLabel(episode.preview_status, free)}</p>
      {!free && episode.preview_error && <p role="alert">{explainMarketplaceError(episode.preview_error)}</p>}
      <label>集标题<span className="pf-req-mark">จำเป็นต้องระบุ</span><input required value={episode.title} onChange={event => update({ title: event.target.value })} /></label>
      <label>分集简介<textarea value={episode.description || ''} maxLength={5000} onChange={event => update({ description: event.target.value })} placeholder="介绍这一集的内容" /></label>
      <label>内容来源<select disabled={videoLocked} value={episode.source || 'external'} onChange={event => update({ source: event.target.value as EpisodeDraft['source'] })}><option value="printfilm">PrintFilm 生成</option><option value="external">其他平台生成</option></select></label>
      <AssetPicker kind="video" value={episode.asset_id} onChange={asset_id => update({ asset_id })} title="分集วิดีโอ" required locked={videoLocked} lockUntilPreview={lockVideoUntilPreview} />
      <AssetPicker kind="image" required value={episode.cover_asset_id} onChange={cover_asset_id => update({ cover_asset_id })} title="分集封面（可使用系列封面）" />
      {saleType !== 'free' && <label>本集参考价（元）<input type="number" min="0" step="0.01" value={(episode.copyright_price_fen / 100) || ''} onChange={event => update({ copyright_price_fen: Math.round(Number(event.target.value || 0) * 100) })} /></label>}
      {episode.source === 'printfilm' ? <p className="pf-market-notice">PrintFilm 生成：本系列统一引用账号授权函，无需逐集签署或อัปโหลด证书。</p> : episode.asset_id && (seriesId ? <button type="button" disabled={busy} onClick={goRights}>填写第 {episode.episode_no} 集权属材料</button> : <p>请先บันทึกแบบร่าง，再填写这一集的权属材料。บันทึก后会回到这个页面。</p>)}
      {saleType === 'platform_unlock' && <><label>本集观众解锁价（元）<input type="number" min="0.01" step="0.01" value={(episode.unlock_price_fen / 100) || ''} onChange={event => update({ unlock_price_fen: Math.round(Number(event.target.value || 0) * 100) })} /></label><label>本集平台抽成比例（万分比，可留空使用平台ค่าเริ่มต้น）<input type="number" min="0" max="10000" step="1" value={episode.share_bps ?? ''} onChange={event => update({ share_bps: event.target.value === '' ? null : Number(event.target.value) })} placeholder="例如 2000，表示平台20%、ผู้สร้างสรรค์ (Creator)80%" /><small>10000 表示 100%；本集未ตั้งค่า时使用平台ค่าเริ่มต้น比例。</small></label></>}
      {count > 1 && <button type="button" disabled={busy} onClick={remove}>ลบ本集</button>}
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
      }).catch(() => { if (active) setPreviewPollError('短试看进度暂时无法读取，正在ลองใหม่。当前填写内容会保留。') })
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
      } catch { if (!stop) { setHandoffError('同步进度暂时无法读取，正在ลองใหม่。当前填写的内容已保留。'); timer = window.setTimeout(() => setPoll(value => value + 1), 5000) } }
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
    event.preventDefault(); setBusy(true); setError(''); setMessage(''); if (syncBlocked || hasSyncFailure) { setBusy(false); setError('请等待同步เสร็จสิ้น或ลองใหม่งานที่ล้มเหลว后再บันทึก，当前输入会保留'); return } const missing = episodes.findIndex(item => !item.title.trim()); if (missing >= 0) { setExpanded(new Set([missing])); setBusy(false); setError(`第 ${missing + 1} 集标题未填写`); return } const form = new FormData(event.currentTarget)
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
      else { acceptSaved(await request<SeriesDraft>(`/series/${saved.id}`)); setMessage('系列ฉบับร่าง已บันทึก。') }
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
    if (syncBlocked || dirty || episodeHandoffs.some(item => item.status === 'failed')) { setError('请等待同步เสร็จสิ้น、处理งานที่ล้มเหลว并บันทึกการเปลี่ยนแปลง后，再ส่ง审核'); return }
    setBusy(true); setError('')
    try { const updated = await request<SeriesDraft>(`/series/${id}/submit`, 'POST', { version: series.version }); acceptSaved(updated); setMessage(updated.audit_status === 'processing' ? '正在准备短试看，เสร็จสิ้น后自动进入待审核。' : 'ละครสั้น与版权材料已ส่ง，等待ผู้ดูแลระบบ (Admin)统一审核。') }
    catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  async function removeSeries() {
    if (!id) return
    const ok = await dialog.confirm({ title: 'ลบละครสั้น', message: 'ลบ后整部ละครสั้น会从我的作品和作品广场撤下。分集和审核记录会保留，但不能再展示。', confirmText: 'ลบ', tone: 'danger' })
    if (!ok) return
    setBusy(true); setError('')
    try { await request(`/series/${id}`, 'DELETE'); navigate('/marketplace/mine') } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  async function retryPreviews() {
    if (!id || !series || busy || dirty || previewActive) return
    setBusy(true); setError(''); setMessage('')
    try {
      acceptSaved(await request<SeriesDraft>(`/series/${id}/preview/retry`, 'POST', { version: series.version }))
      setMessage('已重新排队生成短试看，可在各分集ดู处理进度。')
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  async function toggleListing() {
    if (!id || !series || series.audit_status !== 'approved') return
    setBusy(true); setError('')
    try {
      const updated = await request<SeriesDraft>(`/series/${id}/listing?listed=${!series.listed}`, 'POST', { version: series.version })
      setSeries(updated); setEpisodes(updated.episodes); setMessage(updated.listed ? '系列เผยแพร่แล้ว到作品广场。' : '系列นำลงแล้ว，历史审核记录仍保留。')
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  const current = series
  if (id && !series && !error) return <p role="status">正在加载系列…</p>
  return <><PageHeading title={id ? 'แก้ไขละครสั้น' : '发布ละครสั้น'} description="ละครสั้น和单条วิดีโอ一样出现在作品广场。在这一页เพิ่ม分集，版权规则与单วิดีโอ相同。" back="/marketplace" /><div className="pf-market-editor-layout"><form className="pf-market-editor-main pf-market-form" onSubmit={save} onChangeCapture={event => { if (!(event.target as HTMLElement).closest('.pf-market-authorization, [data-market-transient]')) setDirty(true) }}>
    <FormSection step="01" title="系列信息" description="先建立系列，再逐集อัปโหลด或导入成片。"><label>系列标题<span className="pf-req-mark">จำเป็นต้องระบุ</span><input name="title" required maxLength={200} placeholder="例如：城市里的光" defaultValue={current?.title} /></label><label>简介<textarea name="description" maxLength={5000} defaultValue={current?.description} placeholder="介绍整部ละครสั้น的主题和内容" /></label><div className="pf-market-field-row"><label>分类<span className="pf-req-mark">จำเป็นต้องระบุ</span><select name="category" required value={category || current?.category || ''} onChange={event => setCategory(event.target.value)} disabled={!categories.length}><option value="" disabled>请เลือก系列分类</option>{current?.category && !categories.includes(current.category) && <option value={current.category}>{current.category}（历史分类）</option>}{categories.map(name => <option key={name} value={name}>{name}</option>)}</select>{categoryError && <span role="alert">{categoryError}</span>}</label><label>标签<input name="tags" defaultValue={current?.tags?.join('，')} placeholder="都市，ละครสั้น" /></label></div><AssetPicker kind="image" value={coverId} onChange={value => { coverEdited.current = true; setCoverId(value); setDirty(true) }} title="系列封面（与分集封面至少อัปโหลด一处）" /></FormSection>
    <FormSection step="02" title="收益方式" description="免费公开供完整观看；版权出售通过客服洽谈；平台投放按集解锁并分成。"><select value={saleType} onChange={event => setSaleType(event.target.value as typeof saleType)}><option value="free">免费公开</option><option value="copyright_contact">版权出售收益</option><option value="platform_unlock">平台投放收益</option></select><label>参考价（元）<input name="copyright_price" type="number" min="0" step="0.01" defaultValue={current?.copyright_price_fen ? current.copyright_price_fen / 100 : ''} /></label><label>免费集数<span className="pf-req-mark">前几集免费</span><input type="number" min="0" max="10000" step="1" value={freeEpisodeCount} onChange={event => setFreeEpisodeCount(Math.max(0, Number(event.target.value) || 0))} /></label><p className="pf-market-notice">เลือก“免费公开”时ทุกตอน播放原片，无需试看；其他收益方式可将前几集设为免费，其余分集提供最长15วินาที且不超过原片30%的无水印短试看。版权合作参考价不代表已包含版权转让手续等额外费用，具体事项请与客服确认。平台投放按集定价，观众解锁仅获得永久在线播放权益，不包含版权转让；需在平台启用分成后才能ส่ง审核。修改收益方式或免费集数后，将重新检查播放准备สถานะ。</p></FormSection>
    <FormSection step="03" title="分集内容" description="每集一个完整วิดีโอ和封面。同步期间可以填写信息，เสร็จสิ้น后再บันทึก。">
      <div className="pf-episode-tools"><button type="button" onClick={() => setExpanded(new Set(episodes.map((_, index) => index)))}>ขยาย全部</button><button type="button" onClick={() => setExpanded(new Set())}>ย่อเก็บ全部</button><span>共 {episodes.length} 集</span></div>
      {syncBlocked && <p className="pf-market-notice" role="status">{syncing ? '成片正在后台同步，可先填写标题与价格。同步เสร็จสิ้น后即可บันทึก和ส่ง；ปิด页面不影响任务。' : '正在确认同步สถานะ…'}</p>}
      {hasSyncFailure && <p className="pf-market-notice" role="alert">部分成片同步ล้มเหลว。当前输入已保留，请先ลองใหม่同步或重新เลือก源版本，เสร็จสิ้น后再บันทึก。</p>}
      {handoffError && <p role="alert">{handoffError}</p>}
      <div className="pf-market-episodes">{episodes.map((episode, index) => {
        const handoff = episodeHandoffs.find(item => item.episode_id === episode.id)
        const syncingVideo = Boolean(handoff && isHandoffActive(handoff))
        const fromPrintfilm = episode.source === 'printfilm'
        const videoLabel = handoff ? handoffLabel(handoff) : episode.asset_id ? 'วิดีโอ已就绪' : '缺วิดีโอ'
        return <div key={episode.id ?? `new-${index}`}>
          <EpisodePanel episode={episode} count={episodes.length} free={isFreeEpisode({ sale_type: saleType, free_episode_count: freeEpisodeCount }, episode.episode_no)} open={expanded.has(index)} saleType={saleType} seriesId={id} busy={busy || syncBlocked || hasSyncFailure} videoLabel={videoLabel} videoLocked={syncingVideo || (fromPrintfilm && !episode.asset_id)} lockVideoUntilPreview={fromPrintfilm}
            toggle={() => setExpanded(value => { const next = new Set(value); if (next.has(index)) next.delete(index); else next.add(index); return next })}
            update={patch => update(index, patch)}
            remove={() => { setDirty(true); if (episode.id) setRemovedEpisodeIds(value => [...value, episode.id as number]); setEpisodes(value => value.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, episode_no: itemIndex + 1 }))); setExpanded(new Set([Math.max(0, index - 1)])) }}
            goRights={() => { if (dirty) { setError('请先บันทึกแบบร่าง，再填写外部作品的权属材料'); return } navigate(`/marketplace/assets/${episode.asset_id}/rights?source=${episode.source || 'external'}&return=${encodeURIComponent(`/marketplace/series/${id}/edit`)}`) }} />
          {handoff && handoff.status !== 'ready' && <p className="pf-market-notice" role={handoff.status === 'failed' ? 'alert' : 'status'}>第 {episode.episode_no} 集 · {handoffLabel(handoff)}{handoff.error ? `：${explainMarketplaceError(handoff.error)}` : ''}
            {handoff.status === 'failed' && handoff.retryable !== false && <button type="button" disabled={busy} onClick={() => void retryHandoff(handoff)}>重新同步</button>}
            {handoff.status === 'failed' && handoff.retryable === false && <span>请在下方重新เลือกละครซีรีส์分集，确认最新源版本后同步。</span>}
          </p>}
        </div>
      })}</div>
      <button type="button" disabled={busy || syncBlocked || hasSyncFailure} onClick={() => { setDirty(true); setEpisodes(value => [...value, { episode_no: value.length + 1, title: `第${value.length + 1}集`, asset_id: null, cover_asset_id: null, copyright_price_fen: 0, unlock_price_fen: 0, source: 'external' }]); setExpanded(new Set([episodes.length])) }}>+ เพิ่ม下一集</button>
    </FormSection>
    {id && <FormSection step="04" title="从我的 PrintFilm ละครซีรีส์导入" description="เลือกโปรเจกต์后，在同一个发布弹窗里เลือก完整分集；新源版本必须明确确认后才能更新。">
      <select data-market-transient value={sourceId} disabled={busy || syncBlocked} onChange={event => setSourceId(event.target.value)}><option value="">เลือกโปรเจกต์ละครซีรีส์</option>{sources.map(source => <option key={source.id} value={source.id}>{source.title}</option>)}</select>
      <button type="button" disabled={busy || syncBlocked || !sourceId || (dirty && !hasSyncFailure)} onClick={() => setImportOpen(true)}>เลือก分集并同步到此系列</button>
      {dirty && !hasSyncFailure && <p className="pf-market-notice">请先บันทึก当前修改，再导入分集。</p>}
    </FormSection>}
    {episodes.some(item => item.source === 'printfilm') && <FormSection step="05" title="PrintFilm 授权确认" description="同一账号按当前条款签署一次，ส่ง系列审核时自动关联全部 PrintFilm 分集。">
      <AuthorizationPanel onSigned={() => { setSeries(value => value ? { ...value, authorization_ready: true } : value); setMessage('授权函已签署，ส่ง审核时将自动关联本系列的 PrintFilm 分集。') }} />
    </FormSection>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {previewPollError && (series?.audit_status === 'processing' || previewActive) && <p role="status">{previewPollError}</p>}
    <div className="pf-market-form-actions">
      <Button variant="lime" type="submit" disabled={busy || syncBlocked || hasSyncFailure || !categories.length || !category}>{busy ? 'กำลังประมวลผล…' : 'บันทึก系列ฉบับร่าง'}</Button>
      {id && (series?.audit_status === 'draft' || series?.audit_status === 'rejected' || series?.audit_status === 'preview_failed') && <button type="button" disabled={busy || syncBlocked || dirty || episodeHandoffs.some(item => item.status === 'failed') || (episodes.some(item => item.source === 'printfilm') && series.authorization_ready === false)} onClick={() => void submit()}>{series?.audit_status === 'preview_failed' ? 'ลองใหม่生成短试看并ส่ง' : 'ส่ง系列审核'}</button>}
      {id && dirty && <p role="status">有未บันทึกการเปลี่ยนแปลง，请先บันทึกแบบร่าง再ส่ง审核。</p>}
      {id && series?.audit_status === 'processing' && <p role="status">正在生成短试看，เสร็จสิ้น后自动进入待审核。</p>}
      {id && series?.audit_status === 'approved' && <button type="button" disabled={busy || syncBlocked || dirty} onClick={() => void toggleListing()}>{series.listed ? '下架系列' : '上架到作品广场'}</button>}
      {id && series?.audit_status === 'approved' && (previewFailed || previewActive) && <button type="button" disabled={busy || syncBlocked || dirty || previewActive} onClick={() => void retryPreviews()}>{previewActive ? '正在生成短试看…' : 'ลองใหม่生成短试看'}</button>}
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
      setPoll(value => value + 1); setExpanded(new Set(fresh.episodes.map((_, index) => index))); setMessage('同步任务已สร้าง，เสร็จสิ้น后会自动填入完整วิดีโอ。当前填写的内容已保留。')
    }).catch(err => setError((err as Error).message)).finally(() => setBusy(false))
  }} />}
  </>
}
