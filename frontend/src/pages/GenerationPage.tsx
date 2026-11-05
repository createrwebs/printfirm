import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, AudioLines, Check, Clock3, Download, Eye, ImagePlus, Layers, Loader2, Mic, Plus, RectangleHorizontal, RectangleVertical, Sparkles, Square, X } from 'lucide-react'
import { getGenerationConfig, listToolRuns, resolveToolMediaUrl, runStudioTool, type ToolRunRecord } from '../api/tools'
import BillingErrorNotice from '../components/billing/BillingErrorNotice'
import GenerationLayout from '../components/tools/GenerationLayout'
import GenerationSelect from '../components/tools/GenerationSelect'
import GenerationReferences from '../components/tools/GenerationReferences'
import PromptMentionPopover from '../components/tools/PromptMentionPopover'
import { AssetDetailDialog } from '../components/assets/AssetDetailDialog'
import { useToolRunDetail } from '../hooks/useToolRunDetail'
import { mediaIcons, type MediaKind, useGenerationText } from '../lib/generationMedia'
import { formatGenerationErrorMessage } from '../lib/generationError'
import { fetchMediaBlob, triggerBlobDownload } from '../lib/clientDownload'
import { useMediaModelsCatalog } from '../hooks/useMediaModelsCatalog'
import { MediaCostNotice } from '../components/billing/MediaCostNotice'
import { useGenerationEstimate } from '../hooks/useGenerationEstimate'
import { generationReferenceLimits, serializeGenerationReferences, validateGenerationReferences, type GenerationReference, type VideoGenerationMode } from '../lib/generationReferences'
import { detectPromptMentionTrigger, measureTextareaCaretRect, type MentionCaretRect } from '../lib/promptMention'

/** รูปภาพ、วิดีโอ、เสียง使用明确的独立生成入口。 */
export default function GenerationPage({ kind }: { kind: MediaKind }) {
  if (!localStorage.getItem('token')) return <Navigate to={`/auth?next=${encodeURIComponent(`/tools/${kind}`)}`} replace />
  return <GenerationWorkspace kind={kind} key={kind} />
}

function GenerationWorkspace({ kind }: { kind: MediaKind }) {
  const text = useGenerationText()
  const Icon = mediaIcons[kind]
  const [prompt, setPrompt] = useState('')
  const [ratio, setRatio] = useState(kind === 'image' ? '1:1' : '9:16')
  const [duration, setDuration] = useState('5s')
  const [voice, setVoice] = useState('narrator_calm')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  // 每种วิดีโอ模式保留各自素材，切换模式不会把首帧误当普通参考或丢失เลือก。
  const [videoMode, setVideoMode] = useState<VideoGenerationMode>('text_to_video')
  const [videoReferences, setVideoReferences] = useState<Record<VideoGenerationMode, GenerationReference[]>>({ text_to_video: [], first_last_frame: [], omni_reference: [] })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // @ 引用：触发位置与光标锚点、键盘高亮项（候选来自已加入的参考资料）
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const [mention, setMention] = useState<{ start: number; query: string; rect: MentionCaretRect } | null>(null)
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0)
  const [recent, setRecent] = useState<ToolRunRecord[]>([])
  const [recentTotal, setRecentTotal] = useState(0)
  // รายละเอียด仅编排数据与任务สถานะ，界面复用ทั่วไปแอสเซท组件。
  const { detail, asset: detailAsset, error: detailError, resultIndex, selectResult, openDetail, closeDetail } = useToolRunDetail()
  const [historyError, setHistoryError] = useState('')
  const [model, setModel] = useState('')
  const [resolution, setResolution] = useState(kind === 'image' ? '2K' : '480p')
  const catalog = useMediaModelsCatalog()
  const models = useMemo(() => (kind === 'image' ? catalog?.image_models : catalog?.video_models) ?? [], [catalog, kind])
  const selectedModel = models.find(item => item.id === model)
  const referenceImageLimit = selectedModel?.reference_limits?.images ?? 9
  // memo 化：引用稳定，避免作为 effect 依赖时每次เรนเดอร์都รันใหม่
  const referenceLimits = useMemo(() => generationReferenceLimits(selectedModel?.reference_limits), [selectedModel])
  const currentReferences = videoReferences[videoMode]
  const serializedReferences = useMemo(() => serializeGenerationReferences(currentReferences), [currentReferences])
  const referenceError = kind === 'video' ? validateGenerationReferences(videoMode, currentReferences, referenceLimits) : null
  // @ 提及候选：当前模式已加入的参考资料，按 @ 后的词本地过滤，不请求แอสเซท库
  const mentionItems = useMemo(() => {
    if (!mention) return []
    const needle = mention.query.trim().toLowerCase()
    return currentReferences.filter(item => !needle || item.name.toLowerCase().includes(needle))
  }, [mention, currentReferences])
  const allowedResolutions = selectedModel?.available_resolutions ?? selectedModel?.allowed_resolutions ?? []
  const invalidParameters = kind !== 'audio' && (!catalog || !selectedModel || selectedModel.available === false || !allowedResolutions.includes(resolution) || !selectedModel.allowed_aspect_ratios?.includes(ratio) || (kind === 'video' && (Number(duration.replace('s', '')) < (selectedModel.duration_min ?? 4) || Number(duration.replace('s', '')) > (selectedModel.duration_max ?? 30))))
  const { quote, error: estimateError, loading: estimating, retry: retryEstimate } = useGenerationEstimate(kind === 'video' && !invalidParameters && !referenceError ? {
    tool_id: 't2v', model_id: model, video_mode: videoMode, resolution, ratio, duration, references: serializedReferences.references,
  } : null)
  const [revision, setRevision] = useState(0)
  const [downloading, setDownloading] = useState<number | null>(null)
  const upload = useRef<HTMLInputElement>(null)
  const maxLength = kind === 'audio' ? 2000 : 7000
  useEffect(() => {
    let disposed = false
    getGenerationConfig().then(data => { if (!disposed && kind === 'audio') setModel(data.models[kind] || '') }).catch(() => {})
    return () => { disposed = true }
  }, [kind])
  useEffect(() => {
    if (catalog && kind !== 'audio' && !models.some(item => item.id === model && item.available !== false)) {
      const defaultId = kind === 'image' ? catalog.defaults.image_model : catalog.defaults.video_model
      setModel(models.find(item => item.id === defaultId && item.available !== false)?.id || models.find(item => item.available !== false)?.id || '')
    }
  }, [catalog, model, kind, models])
  useEffect(() => {
    if (!selectedModel || kind === 'audio') return
    const resolutions = selectedModel.available_resolutions ?? selectedModel.allowed_resolutions ?? []
    const ratios = selectedModel.allowed_aspect_ratios ?? []
    if (resolutions.length && !resolutions.includes(resolution)) setResolution(resolutions.includes(selectedModel.defaults?.resolution || '') ? selectedModel.defaults!.resolution : resolutions[0])
    if (ratios.length && !ratios.includes(ratio)) setRatio(ratios.includes(selectedModel.defaults?.aspect_ratio || '') ? selectedModel.defaults!.aspect_ratio : ratios[0])
    if (kind === 'video') {
      const seconds = Number(duration.replace('s', ''))
      const next = Math.min(selectedModel.duration_max ?? 30, Math.max(selectedModel.duration_min ?? 4, seconds))
      if (next !== seconds) setDuration(`${next}s`)
    }
  }, [selectedModel, kind, resolution, ratio, duration])
  useEffect(() => {
    let disposed = false
    let timer: ReturnType<typeof setTimeout>
    async function refresh() {
      try {
        const data = await listToolRuns(1, 6, { kind })
        if (disposed) return
        setRecent(data.items); setRecentTotal(data.total); setHistoryError('')
      } catch (err) { if (!disposed) setHistoryError(err instanceof Error ? err.message : text('โหลดไม่สำเร็จ', 'Loading failed')) }
      finally { if (!disposed) timer = setTimeout(refresh, 5000) }
    }
    void refresh()
    return () => { disposed = true; clearTimeout(timer) }
  }, [kind, revision, text])
  useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file))
    setPreviews(urls)
    return () => urls.forEach(url => URL.revokeObjectURL(url))
  }, [files])

  function pickFiles(incoming: File[]) {
    const limit = referenceImageLimit
    if (incoming.some(file => file.size > 40 * 1024 * 1024)) { setError(text('单个文件不能超过 40MB', 'Each file must be under 40 MB')); return }
    if (files.length + incoming.length > limit) { setError(text(`最多เลือก ${limit} 个参考文件`, `Choose up to ${limit} reference files`)); return }
    setFiles(previous => [...previous, ...incoming]); setError('')
  }

  // 输入或光标移动后同步 @ 触发态；仅支持参考资料的วิดีโอ模式启用
  function syncMention() {
    const textarea = promptRef.current
    if (kind !== 'video' || videoMode === 'text_to_video' || !textarea) { setMention(null); return }
    const trigger = detectPromptMentionTrigger(textarea.value, textarea.selectionStart)
    if (!trigger) { setMention(null); return }
    setMention({ ...trigger, rect: measureTextareaCaretRect(textarea, textarea.selectionStart) })
    setMentionActiveIndex(0)
  }

  // 插入 @ 提及词，指向参考资料面板中已绑定的该份资料
  function selectMention(reference: GenerationReference) {
    const textarea = promptRef.current
    if (!textarea || !mention) return
    const caret = textarea.selectionStart
    const token = `@${reference.name} `
    setPrompt(`${prompt.slice(0, mention.start)}${token}${prompt.slice(caret)}`)
    setMention(null)
    setError('')
    const caretPos = mention.start + token.length
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(caretPos, caretPos)
    })
  }

  // 提及弹层打开时接管方向键 / 回车 / Esc
  function onPromptKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!mention) return
    if (event.key === 'Escape') { event.preventDefault(); setMention(null); return }
    if (!mentionItems.length) return
    if (event.key === 'ArrowDown') { event.preventDefault(); setMentionActiveIndex(index => Math.min(index + 1, mentionItems.length - 1)) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setMentionActiveIndex(index => Math.max(index - 1, 0)) }
    else if (event.key === 'Enter') { event.preventDefault(); selectMention(mentionItems[Math.min(mentionActiveIndex, mentionItems.length - 1)]) }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting || !prompt.trim()) return
    if (invalidParameters) { setError(text('请先เลือก有效的生成模型和参数', 'Choose a valid model and settings first')); return }
    if (kind === 'video' && (referenceError || !quote || estimating || estimateError)) {
      setError(referenceError || estimateError || text('请等待预计消耗计算เสร็จสิ้น', 'Wait for the cost estimate before generating'))
      return
    }
    if (kind === 'image' && files.length > referenceImageLimit) {
      setError(text(`所选模型最多支持 ${referenceImageLimit} 个参考文件，请移除多余文件`, `The selected model supports up to ${referenceImageLimit} reference files. Remove the extra files.`))
      return
    }
    setSubmitting(true); setError(''); setNotice('')
    try {
      const result = await runStudioTool({ toolId: kind === 'audio' ? 'audio' : kind === 'video' ? 't2v' : files.length ? 'i2i' : 't2i',
        prompt, files: kind === 'video' ? serializedReferences.files : files, ratio, duration, voice, modelId: model, resolution,
        ...(kind === 'video' ? { videoMode, references: serializedReferences.references, priceVersion: quote?.price_version ?? 0 } : {}) })
      setNotice(text(`任务 ${result.task_id} 已ส่ง，离开页面后仍会继续生成。`, `Task ${result.task_id} queued. Generation continues after you leave.`))
      setRevision(value => value + 1)
    } catch (err) { setError(err instanceof Error ? err.message : text('ส่งล้มเหลว', 'Submission failed')) }
    finally { setSubmitting(false) }
  }
  async function download(item: ToolRunRecord) {
    setDownloading(item.id); setError('')
    try {
      const url = resolveToolMediaUrl(item.urls[0])
      triggerBlobDownload(await fetchMediaBlob(url), `printfilm_${kind}_${item.id}.${kind === 'video' ? 'mp4' : kind === 'audio' ? 'mp3' : 'png'}`)
    } catch (err) { setError(err instanceof Error ? err.message : text('ดาวน์โหลดล้มเหลว', 'Download failed')) }
    finally { setDownloading(null) }
  }
  const titles = {
    video: [text('一句话，', 'One idea.'), text('生成你的下一幕', 'Your next scene.')],
    image: [text('一句话，', 'One idea.'), text('画出你的想象', 'Bring it to life.')],
    audio: [text('一段文字，', 'Your words.'), text('让故事开口', 'A voice to tell them.')],
  }
  const placeholder = kind === 'audio' ? text('输入你想朗读的文字…', 'Enter the text you want to read…') : kind === 'image'
    ? text('คำอธิบาย你想生成的รูปภาพ，或说明如何修改ภาพอ้างอิง。试试：午后阳光穿过玻璃，桌上一枝白色郁金香，胶片质感。', 'Describe an image or the changes to your references…')
    : text('คำอธิบาย你想生成的วิดีโอ：主体 + 动作 + 环境 + 运镜。输入 @ 可提及下方已加入的ภาพอ้างอิง、วิดีโอ或เสียง。', 'Describe your video: subject, action, setting, camera movement. Type @ to mention a reference you added below.')

  return <GenerationLayout kind={kind}>
    <header className={`gen-hero gen-hero-${kind}`}>
      <div className="gen-eyebrow"><Icon size={22} />{text(kind === 'video' ? 'AI วิดีโอ' : kind === 'image' ? 'AI รูปภาพ' : 'AI เสียง', `AI ${kind.toUpperCase()}`)}</div>
      <h1>{titles[kind][0]}<span>{titles[kind][1]}</span></h1>
      <p>{kind === 'audio' ? text('选一款น้ำเสียง，为你的文字注入อารมณ์与温度。', 'Choose a voice and give your words warmth.') : text('从一个想法开始，让灵感自然发生。', 'Start with an idea. Let inspiration happen.')}</p>
      <div className="gen-hero-art" aria-hidden>{kind === 'audio' ? <><AudioLines className="gen-wave" /><Mic /></> : <Icon />}</div>
    </header>
    <form className="gen-composer" onSubmit={submit}>
      {kind === 'image' && catalog?.billing_mode === 'fixed_media' && <div className="gen-price-summary">
        <MediaCostNotice modelId={model} resolution={resolution} />
      </div>}
      {catalog && invalidParameters && <p className="gen-inline-error" role="alert">{text('当前模型不支持所选参数，请重新เลือกความละเอียด、画幅或ความยาว。', 'These settings are not supported by the selected model. Please adjust them.')}</p>}
      <div className="gen-composer-heading"><span><Sparkles size={15} />{text(kind === 'audio' ? '朗读内容' : '创作คำอธิบาย', kind === 'audio' ? 'Your script' : 'Your creative brief')}</span><small>{text('把想象，写成下一件作品', 'A little detail goes a long way')}</small></div>
      <div className="gen-input-area">
        {kind === 'video' && <GenerationReferences mode={videoMode} limits={referenceLimits} value={currentReferences}
          onChange={value => { setVideoReferences(previous => ({ ...previous, [videoMode]: value })); setError(''); setNotice('') }} onError={setError} disabled={submitting} />}
        {kind === 'image' && <div className={`gen-references ${files.length ? 'has-files' : ''}`}>
          <span className="gen-ref-count"><ImagePlus size={14} />{files.length}/{referenceImageLimit}</span>
          <div className="gen-ref-grid">
            {previews.map((url, index) => <div className="gen-ref-item" key={url}>
              <img src={url} alt={text('ภาพอ้างอิง', 'Reference')} />
              <button type="button" aria-label={text('移除参考文件', 'Remove reference')} onClick={() => setFiles(items => items.filter((_, i) => i !== index))}><X size={13} /></button>
            </div>)}
            {files.length < referenceImageLimit && <button type="button" className="gen-upload" onClick={() => upload.current?.click()}
              onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); pickFiles(Array.from(event.dataTransfer.files)) }}>
              <Plus size={24} /><span>{text('เลือกภาพอ้างอิง', 'Add reference')}</span>
            </button>}
          </div>
          <input type="file" hidden ref={upload} multiple accept="image/png,image/jpeg,image/webp" onChange={event => { pickFiles(Array.from(event.target.files || [])); event.target.value = '' }} />
        </div>}
        <div className="gen-prompt-wrap">
          <textarea ref={promptRef} aria-label={text('生成内容', 'Generation prompt')} placeholder={placeholder} maxLength={maxLength} value={prompt}
            onChange={event => { setPrompt(event.target.value); setNotice(''); syncMention() }}
            onKeyDown={onPromptKeyDown} onKeyUp={syncMention} onClick={syncMention} onBlur={() => window.setTimeout(() => setMention(null), 120)} />
          <span className="gen-counter">{prompt.length.toLocaleString()} / {maxLength.toLocaleString()}{kind === 'audio' ? text(` · 约 ${Math.ceil(prompt.length / 4)} วินาที`, ` · ~${Math.ceil(prompt.length / 4)} sec`) : ''}</span>
        </div>
      </div>
      <div className="gen-toolbar">
        {kind === 'video' && <GenerationSelect label={text('生成方式', 'Generation mode')} icon={<Sparkles size={18} />} value={videoMode} disabled={submitting}
          onChange={value => { setVideoMode(value as VideoGenerationMode); setError(''); setNotice(''); setMention(null) }} options={[
            { value: 'text_to_video', label: text('文生วิดีโอ', 'Text to video'), description: text('只写一句话，ภาพ由模型生成', 'Describe your idea without reference media') },
            { value: 'first_last_frame', label: text('首尾帧', 'First / last frame'), description: text('指定首帧，可选尾帧，补全中间运动', 'Choose the first frame and an optional final frame') },
            { value: 'omni_reference', label: text('全能参考', 'Omni reference'), description: text(`รูปภาพ ${referenceLimits.images} 张 / วิดีโอ ${referenceLimits.videos} 段 / เสียง ${referenceLimits.audios} 段 · 最多 12 份`, `${referenceLimits.images} images / ${referenceLimits.videos} videos / ${referenceLimits.audios} audio clips · 12 total`) },
          ]} />}
        {kind === 'audio' ? <span className="gen-control gen-model">{model || text('站点ค่าเริ่มต้น模型', 'Default model')}</span> : <GenerationSelect label={text('生成模型', 'Model')} icon={<Icon size={19} />} value={model} onChange={setModel} options={models.filter(item => item.available !== false).map(item => ({ value: item.id, label: item.label, description: item.pricing_hint }))} />}
        {kind === 'audio' ? <GenerationSelect label={text('น้ำเสียง', 'Voice')} icon={<Mic size={18} />} value={voice} onChange={setVoice} options={[
          { value: 'narrator_calm', label: text('沉静เสียงบรรยาย', 'Calm narrator'), description: text('นุ่มนวลมั่นคง自然，适合故事เสียงบรรยาย', 'Steady and natural, for narration') },
          { value: 'warm_storyteller', label: text('温暖讲述', 'Warm storyteller'), description: text('柔和亲切，适合温馨叙事', 'Warm and gentle, for storytelling') },
          { value: 'teacher_clear', label: text('清晰เสียงผู้ชาย', 'Clear male voice'), description: text('清楚明快，适合知识讲解', 'Clear and bright, for explainers') },
        ]} /> : <>
          <GenerationSelect label={text('ความละเอียด', 'Resolution')} value={resolution} onChange={setResolution} options={allowedResolutions.map(value => ({ value, label: value, description: selectedModel?.prices?.[value] ? `¥${selectedModel.prices[value]}/${kind === 'video' ? 'วินาที' : '张'}` : '' }))} />
          <GenerationSelect label={text('画幅', 'Aspect ratio')} value={ratio} onChange={setRatio} options={(selectedModel?.allowed_aspect_ratios ?? []).map(value => ({ value, label: value, icon: value === '1:1' ? <Square size={19} /> : value === '9:16' || value === '3:4' ? <RectangleVertical size={19} /> : <RectangleHorizontal size={21} /> }))} />
          {kind === 'video' && <GenerationSelect label={text('วิดีโอความยาว', 'Duration')} icon={<Clock3 size={18} />} value={duration} onChange={setDuration} options={Array.from({ length: (selectedModel?.duration_max ?? 30) - (selectedModel?.duration_min ?? 4) + 1 }, (_, index) => (selectedModel?.duration_min ?? 4) + index).map(value => ({ value: `${value}s`, label: text(`${value} วินาที`, `${value} sec`), description: text(`${resolution} · 单次生成一个片段`, `${resolution} · One video per request`) }))} />}
          <span className="gen-control gen-output-count"><Layers size={17} /><span><small>{text('生成数量', 'Output')}</small><strong>× 1</strong></span></span>
        </>}
        {kind === 'video' && <PromptMentionPopover open={Boolean(mention)} items={mentionItems} anchorRect={mention?.rect ?? null}
          activeIndex={mentionActiveIndex} onActiveIndexChange={setMentionActiveIndex} onSelect={selectMention} onClose={() => setMention(null)} />}
        <div className="gen-submit-group">
          {kind === 'video' ? <div className="gen-estimate" aria-live="polite">
            {estimateError ? <><strong>{text('预计消耗暂不可用', 'Estimate unavailable')}</strong><button type="button" onClick={retryEstimate}>{text('重新计算', 'Retry estimate')}</button></> : quote ? <>
              <span>{text('预计消耗', 'Estimated cost')} <strong>{quote.billing_enabled ? `¥${(quote.estimate_fen / 100).toFixed(2)}` : text('本次不扣费', 'No charge')}</strong></span>
              <small>{text(quote.billing_enabled ? quote.billing_mode === 'fixed_media' ? `${duration.replace('s', '')} วินาที × 1 条 · 按当前价格结算` : '按当前配置估算，最终按实际用量结算' : '当前站点未开启计费', quote.billing_enabled ? quote.billing_mode === 'fixed_media' ? `${duration.replace('s', '')} sec × 1 video · Current pricing` : 'Estimated; settled on actual usage' : 'Billing is disabled on this site')}</small>
            </> : <span>{text(estimating ? '正在计算预计消耗…' : referenceError || 'เลือก模型和参数后显示预计消耗', estimating ? 'Estimating cost…' : referenceError ? 'Add valid reference media to estimate cost' : 'Choose a model and settings to estimate cost')}</span>}
          </div> : <span>{text('生成记录自动บันทึก', 'Creations saved automatically')}</span>}
          <button className="gen-primary" disabled={submitting || !prompt.trim() || invalidParameters || (kind === 'video' && Boolean(referenceError || !quote || estimating || estimateError))} type="submit">{submitting ? <Loader2 className="gen-spin" size={18} /> : <Icon size={18} />}{text(submitting ? 'ส่ง中' : kind === 'audio' ? 'สร้างเสียงพูด' : '创作', submitting ? 'Submitting' : 'Generate')}</button>
        </div>
      </div>
    </form>
    {referenceError && <p className="gen-inline-error" role="alert">{referenceError}</p>}
    {estimateError && <p className="gen-inline-error" role="alert">{estimateError}</p>}
    {error && <BillingErrorNotice message={error} />}
    {notice && <div className="gen-notice" role="status"><Check size={18} />{notice}<Link to={`/tasks?kind=${kind}`}>{text('ดู任务', 'View task')}<ArrowRight size={15} /></Link></div>}
    <section className="gen-recent">
      <header><h2>{text('最近生成', 'Recent creations')}</h2><Link to={`/tasks?kind=${kind}`}>{text(`ดู全部 ${recentTotal} 个`, `View all ${recentTotal}`)}<ArrowRight size={17} /></Link></header>
      {historyError && <p className="gen-inline-error" role="alert">{historyError}</p>}
      {!recent.length && !historyError ? <div className="gen-empty"><Icon size={34} /><strong>{text('你的灵感，从这里开始', 'Your next idea starts here')}</strong><p>{text('ส่งตอนที่ 一个生成任务，作品会自动出现在这里。', 'Submit your first generation. Your creations will appear here.')}</p></div> : <div className="gen-gallery">
        {recent.map(item => <article key={item.id} className="gen-gallery-item">
          <button type="button" className="gen-gallery-preview" onClick={() => openDetail(item)} aria-label={text(`ดู生成รายละเอียด：${item.prompt || '未命名创作'}`, `View generation details: ${item.prompt || 'Untitled creation'}`)}>
            {kind === 'image' && (item.preview_url || item.urls[0]) ? <img src={resolveToolMediaUrl(item.preview_url || item.urls[0])} alt={item.prompt} /> : kind === 'video' && item.urls[0] ? <video src={resolveToolMediaUrl(item.urls[0])} poster={resolveToolMediaUrl(item.preview_url)} muted preload="metadata" /> : kind === 'video' && item.preview_url ? <img src={resolveToolMediaUrl(item.preview_url)} alt={item.prompt} /> : <Icon size={38} />}
            <span className={`gen-result-status is-${item.status}`}>{text(item.status === 'succeeded' ? 'เสร็จสมบูรณ์' : item.status === 'failed' ? 'ล้มเหลว' : item.status === 'cancelled' ? 'ยกเลิกแล้ว' : 'กำลังประมวลผล', item.status)}</span>
            <span className="gen-cover-overlay" aria-hidden><Eye size={20} /><span>{text('ดูรายละเอียด', 'View details')}</span></span>
          </button>
          {kind === 'audio' && item.urls[0] && <audio controls src={resolveToolMediaUrl(item.urls[0])} preload="metadata" />}
          <div className="gen-gallery-caption"><button type="button" className="gen-gallery-title" title={item.prompt} onClick={() => openDetail(item)}>{item.prompt || text('未命名创作', 'Untitled creation')}</button>{item.status === 'succeeded' && item.urls[0] && <button type="button" className="gen-icon-button" disabled={downloading === item.id} onClick={() => void download(item)} aria-label={text('ดาวน์โหลด', 'Download')}><Download size={16} /></button>}</div>
        </article>)}
      </div>}
    </section>
    {detail && detailAsset && <AssetDetailDialog asset={detailAsset} onClose={closeDetail}
      notice={<section className="pf-asset-detail-prompt"><div className="pf-asset-detail-text">
        <p role="status">{text(detail.status === 'succeeded' ? 'เสร็จสมบูรณ์' : detail.status === 'failed' ? 'สร้างไม่สำเร็จ' : detail.status === 'cancelled' ? 'ยกเลิกแล้ว' : '正在生成，结果会自动อัปเดต。', detail.status === 'succeeded' ? 'Completed' : detail.status === 'failed' ? 'Generation failed' : detail.status === 'cancelled' ? 'Cancelled' : 'Generating. Results will update automatically.')}</p>
        {(detail.error || detailError) && <p role="alert">{formatGenerationErrorMessage(detail.error || detailError)}</p>}
      </div></section>}
      actions={detail.urls.length > 1 && <div className="pf-asset-detail-utilities" role="group" aria-label={text('生成结果', 'Generation results')}>
        {detail.urls.map((url, index) => <button type="button" key={url} className="pf-btn pf-btn-sm" aria-pressed={resultIndex === index} onClick={() => selectResult(index)}>{text(`结果 ${index + 1}`, `Result ${index + 1}`)}</button>)}
      </div>}>
    </AssetDetailDialog>}
  </GenerationLayout>
}
