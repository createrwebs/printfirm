import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Clapperboard, Clock3, LoaderCircle, Save, Sparkles } from 'lucide-react'
import { api, type PipelineMode, type Project, type Template, type VoicePreset } from '../../api'
import AppShell from '../../components/layout/AppShell'
import BillingErrorNotice from '../../components/billing/BillingErrorNotice'
import Button from '../../components/ui/Button'
import Stepper from '../../components/ui/Stepper'
import { MediaCostNotice } from '../../components/billing/MediaCostNotice'
import { useMediaModelsCatalog } from '../../hooks/useMediaModelsCatalog'
import { creationTemplateId } from '../../lib/creationTemplates'
import { resolveShortVideoMediaSettings, shortVideoPipelineMode } from '../../lib/shortVideoSettings'
import { isRunning, kepuSteps } from '../../lib/status'
import { dialog } from '../../lib/dialog'
import './shortVideoCreate.css'

const EXAMPLES = ['给小学生讲讲为什么天空是蓝色的', '一只胆小的小猫在雨天遇见新朋友', '用轻松的方式介绍二十四节气里的霜降']

export default function CreateProjectPage() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const editId = Number(params.get('project')) || null
  const requestedTemplate = creationTemplateId(params.get('template'))
  const requestedPipelineMode = shortVideoPipelineMode(params.get('mode'))
  const returnPath = `/studio/new${params.size ? `?${params}` : ''}`
  const [templates, setTemplates] = useState<Template[]>([])
  const [voices, setVoices] = useState<VoicePreset[]>([])
  const [project, setProject] = useState<Project | null>(null)
  const [templateId, setTemplateId] = useState(requestedTemplate)
  const [ratio, setRatio] = useState('9:16')
  const [pipelineMode, setPipelineMode] = useState<PipelineMode>(requestedPipelineMode)
  const [imageModel, setImageModel] = useState('')
  const [videoModel, setVideoModel] = useState('')
  const [imageResolution, setImageResolution] = useState('')
  const [videoResolution, setVideoResolution] = useState('')
  const mediaCatalog = useMediaModelsCatalog()
  const [duration, setDuration] = useState(60)
  const [voice, setVoice] = useState('')
  const [mode, setMode] = useState<'idea' | 'copy'>('idea')
  const [idea, setIdea] = useState('')
  const [copy, setCopy] = useState('')
  const [title, setTitle] = useState('')
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(Boolean(editId))
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [voiceError, setVoiceError] = useState(false)
  const working = useRef(false)
  const savedProject = useRef<Project | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  useEffect(() => {
    let disposed = false
    if (!localStorage.getItem('token')) {
      nav(`/auth?next=${encodeURIComponent(returnPath)}`, { replace: true })
      return
    }
    api.templates().then(rows => { if (!disposed) setTemplates(rows) }).catch(cause => { if (!disposed) setError(cause.message || 'โหลดเทมเพลตไม่สำเร็จ') })
    api.voices().then(rows => { if (!disposed) setVoices(rows) }).catch(() => { if (!disposed) setVoiceError(true) })
    return () => { disposed = true }
  }, [nav, editId, returnPath])
  useEffect(() => {
    let disposed = false
    if (!editId) {
      savedProject.current = null
      setProject(null)
      setLoading(false)
      setTemplateId(requestedTemplate)
      setRatio('9:16')
      setPipelineMode(requestedPipelineMode)
      setImageModel('')
      setVideoModel('')
      setImageResolution('')
      setVideoResolution('')
      setDuration(60)
      setVoice('')
      setMode('idea')
      setIdea('')
      setCopy('')
      setTitle('')
      setStep(0)
      return
    }
    // สร้างใหม่后อัปเดต URL 时，保留当前输入与文案。
    if (savedProject.current?.id === editId) return
    setLoading(true)
    api.getProject(editId).then(value => {
      if (disposed) return
      if (value.creation_session_id) {
        nav(`/studio/sessions/${value.creation_session_id}?project=${value.id}`, { replace: true })
        return
      }
      savedProject.current = value
      setProject(value)
      setTemplateId(creationTemplateId(value.template_id))
      setRatio(value.output_ratio || '9:16')
      setPipelineMode(shortVideoPipelineMode(value.pipeline_mode))
      setImageModel(value.image_model || '')
      setVideoModel(value.video_model || '')
      setImageResolution(value.image_resolution || '')
      setVideoResolution(value.video_resolution || '')
      setDuration(value.target_duration_sec || 60)
      setVoice(value.voice_id || '')
      setTitle(value.title)
      setIdea(value.source_text)
      if (value.source_type === 'script') {
        setCopy(value.source_text)
        setMode('copy')
        setStep(1)
      } else setStep(0)
    }).catch(cause => { if (!disposed) setError(cause.message || 'โปรเจกต์โหลดไม่สำเร็จ') })
      .finally(() => { if (!disposed) setLoading(false) })
    return () => { disposed = true }
  }, [editId, requestedTemplate, requestedPipelineMode, nav])

  const selectedTemplate = templates.find(item => item.id === templateId)
  const mediaSettings = resolveShortVideoMediaSettings(mediaCatalog, pipelineMode, { imageModel, videoModel, imageResolution, videoResolution, ratio }, project?.ref_image_url ? 3 : 2)
  const running = Boolean(project && (isRunning(project.status) || project.active_tasks?.some(task => ['pending', 'leased', 'running', 'awaiting_poll', 'awaiting_review', 'cancel_requested'].includes(task.status))))
  const disabled = Boolean(busy || loading || running)
  function payload(text: string, name: string) {
    return {
      template_id: templateId, title: name.trim().slice(0, 200) || text.trim().slice(0, 30),
      source_type: 'script' as const, source_text: text.trim(),
      pipeline_mode: pipelineMode, resolution_mode: 'hd' as const,
      output_ratio: mediaSettings.ratio || ratio, target_duration_sec: duration, voice_id: voice,
      image_model: mediaSettings.imageModel, video_model: mediaSettings.videoModel,
      image_resolution: mediaSettings.imageResolution, video_resolution: mediaSettings.videoResolution,
    }
  }
  const draftFields = payload(copy, title)
  const draftChanged = Boolean(project && (
    project.title !== draftFields.title || project.source_text !== draftFields.source_text ||
    project.template_id !== templateId || project.output_ratio !== draftFields.output_ratio ||
    shortVideoPipelineMode(project.pipeline_mode) !== pipelineMode ||
    (project.target_duration_sec || 60) !== duration || (project.voice_id || '') !== voice ||
    (project.image_model || '') !== draftFields.image_model || (project.video_model || '') !== draftFields.video_model ||
    (project.image_resolution || '') !== draftFields.image_resolution || (project.video_resolution || '') !== draftFields.video_resolution
  ))
  const canSaveDraft = !project?.shots.length && !project?.final_video_url
  async function createDraft(text: string, name: string) {
    if (savedProject.current) return savedProject.current
    const value = await api.createProject(payload(text, name))
    savedProject.current = value
    if (mounted.current) {
      setProject(value)
      nav(`/studio/new?project=${value.id}`, { replace: true })
    }
    return value
  }
  async function saveDraft(text: string, name: string) {
    const old = savedProject.current
    if (!old) return createDraft(text, name)
    // Existing generated assets are changed only after the explicit restart confirmation.
    if (old.shots.length || old.final_video_url) return old
    const value = await api.updateProject(old.id, payload(text, name))
    savedProject.current = value
    if (mounted.current) setProject(value)
    return value
  }
  async function saveCopyDraft() {
    if (!copy.trim() || disabled || working.current || !selectedTemplate || !canSaveDraft) return
    working.current = true
    setBusy('กำลังบันทึกแบบร่าง...')
    setError('')
    try {
      await saveDraft(copy, title)
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'บันทึกแบบร่างไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      working.current = false
      if (mounted.current) setBusy('')
    }
  }
  async function prepareCopy(event: FormEvent) {
    event.preventDefault()
    if (!idea.trim() || disabled || working.current || !selectedTemplate) return
    working.current = true
    setError('')
    setBusy(mode === 'idea' ? 'กำลังสร้างบท...' : 'กำลังบันทึกบท...')
    try {
      const result = mode === 'copy'
        ? { title: title || idea.trim().slice(0, 30), content: idea.trim() }
        : await api.expandContent(`${idea.trim()}\n\nข้อกำหนดการสร้าง: ความยาวประมาณ ${duration} วินาที, สไตล์ ${selectedTemplate.name}, เสียงบรรยายภาษาไทย โปรดเขียนบทที่พร้อมพากย์เสียงจริง โดยรักษาเนื้อหาให้ตรงกับความยาว`, 'script')
      if (!mounted.current) return
      setCopy(result.content)
      setTitle(result.title)
      setStep(1)
      await saveDraft(result.content, result.title)
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'สร้างบทไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      working.current = false
      if (mounted.current) setBusy('')
    }
  }
  async function generateStoryboard() {
    if (!copy.trim() || disabled || working.current || !selectedTemplate) return
    if (!mediaSettings.ready) {
      setError('โมเดลปัจจุบันไม่พร้อมใช้งานหรือรูปภาพอ้างอิงไม่เพียงพอ กรุณาเลือกโมเดลรูปภาพและวิดีโอ ความละเอียด และอัตราส่วนภาพใหม่')
      return
    }
    working.current = true
    try {
      const old = savedProject.current
      if (old?.shots.length) {
        const confirmed = await dialog.confirm({ title: 'สร้างสตอรี่บอร์ดใหม่', message: 'บทและการตั้งค่าใหม่จะสร้างสตอรี่บอร์ดใหม่ และแทนที่รูปภาพ วิดีโอช็อต เสียงพากย์ และวิดีโอที่มีอยู่ของโปรเจกต์นี้', confirmText: 'สร้างใหม่', tone: 'danger' })
        if (!confirmed || !mounted.current) return
      }
      setBusy('กำลังบันทึกและสร้างสตอรี่บอร์ด...')
      setError('')
      let value = await createDraft(copy, title)
      value = await api.updateProject(value.id, payload(copy, title))
      savedProject.current = value
      setProject(value)
      await api.generate(value.id, { restart: Boolean(value.shots.length) })
      if (mounted.current) nav(`/studio/${value.id}`)
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'สร้างสตอรี่บอร์ดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      working.current = false
      if (mounted.current) setBusy('')
    }
  }

  return <AppShell active="studio">
    <div className="sv-create-page">
      <header className="sv-create-header">
        <div><Link className="sv-back" to="/history"><ArrowLeft size={16} /> วิดีโอสั้นของฉัน</Link><h1>{editId ? 'แก้ไขวิดีโอสั้น' : 'สร้างวิดีโอสั้น'}</h1><p>เริ่มต้นจากไอเดีย ทุกขั้นตอนสามารถดูตัวอย่างและปรับแต่งได้</p></div>
        <Stepper steps={kepuSteps(pipelineMode)} current={pipelineMode === 'full' && step === 1 ? 2 : step} />
      </header>
      {error && <BillingErrorNotice message={error} />}
      {loading ? <div className="sv-loading"><LoaderCircle className="sv-spin" size={20} /> กำลังโหลดโปรเจกต์...</div> : <>
        {running && <div className="sv-running-note">โปรเจกต์กำลังอยู่ระหว่างการสร้าง กรุณาดูความคืบหน้าหรือหยุดงานในเวิร์กสเตชัน <Link to={`/studio/${project!.id}`}>ดูเวิร์กสเตชัน <ArrowRight size={15} /></Link></div>}
        <div className="sv-create-grid">
          <main>
            {step === 0 ? <form onSubmit={prepareCopy}>
              <section className="sv-panel">
                <div className="sv-section-heading"><span>01</span><div><h2>เลือกสไตล์ภาพ</h2><p>สไตล์แอนิเมชันและภาพประกอบ ใช้ภาพอ้างอิงสไตล์ในการสร้างภาพเพื่อรักษาตัวละครและสไตล์ภาพในทุกช็อต</p></div></div>
                <div className="sv-style-grid" role="group" aria-label="สไตล์ภาพ">
                  {templates.map(item => <button key={item.id} type="button" className={`sv-style-card${item.id === templateId ? ' is-selected' : ''}`} disabled={disabled} aria-pressed={item.id === templateId} onClick={() => setTemplateId(item.id)}>
                    <img src={api.assetUrl(item.preview_cover)} alt="" /><div><strong>{item.name}</strong><p>{item.description}</p></div>
                    {item.id === templateId && <span className="sv-style-check"><Check size={14} /></span>}
                  </button>)}
                </div>
              </section>
              <section className="sv-panel">
                <div className="sv-section-heading"><span>02</span><div><h2>เขียนเนื้อหาที่คุณต้องการนำเสนอ</h2><p>อธิบายหัวข้อ กลุ่มเป้าหมาย และประเด็นสำคัญ หรือวางบทที่มีอยู่แล้วได้โดยตรง</p></div></div>
                <div className="sv-input-tabs"><button type="button" className={mode === 'idea' ? 'is-active' : ''} onClick={() => setMode('idea')} disabled={disabled}>输入想法</button><button type="button" className={mode === 'copy' ? 'is-active' : ''} onClick={() => setMode('copy')} disabled={disabled}>已有文案</button></div>
                <label className="sv-field"><span>{mode === 'idea' ? 'ไอเดียวิดีโอสั้น' : 'บทฉบับเต็ม'}</span><textarea aria-label={mode === 'idea' ? 'ไอเดียวิดีโอสั้น' : 'บทฉบับเต็ม'} value={idea} onChange={event => setIdea(event.target.value)} rows={6} maxLength={20000} disabled={disabled} placeholder={mode === 'idea' ? 'เช่น: อธิบายให้เด็กประถมฟังว่าทำไมท้องฟ้าถึงเป็นสีฟ้าด้วยแอนิเมชัน 3D น้ำเสียงเป็นกันเอง ความยาวประมาณ 60 วินาที' : 'วางบทที่สามารถนำไปพากย์เสียงได้โดยตรง สามารถแก้ไขต่อในขั้นตอนถัดไป'} required /></label>
                {mode === 'idea' && <div className="sv-examples">{EXAMPLES.map(example => <button type="button" key={example} onClick={() => setIdea(example)} disabled={disabled}>{example}</button>)}</div>}
                <div className="sv-actions"><span>บทสามารถแก้ไขได้หลังจากสร้างเสร็จ ก่อนดำเนินการสร้างสตอรี่บอร์ดต่อ</span><div className="sv-action-buttons">{copy.trim() && <Button variant="outline" disabled={disabled} onClick={() => setStep(1)}>แก้ไขบทที่มีอยู่</Button>}<Button type="submit" variant="lime" disabled={disabled || !idea.trim() || !selectedTemplate}>{busy ? <LoaderCircle size={16} className="sv-spin" /> : <Sparkles size={16} />}{busy || (mode === 'idea' ? 'สร้างบท' : 'ถัดไป: ตรวจสอบบท')}<ArrowRight size={16} /></Button></div></div>
              </section>
            </form> : <section className="sv-panel">
              <div className="sv-section-heading"><span>02</span><div><h2>ตรวจสอบบทก่อนสร้างสตอรี่บอร์ด</h2><p>บทนี้จะใช้เป็นเสียงบรรยาย หลังจากยืนยันเนื้อหาแล้ว ระบบจะแบ่งเป็นภาพและช็อต</p></div></div>
              <label className="sv-field"><span>短片名称</span><input value={title} onChange={event => setTitle(event.target.value)} maxLength={200} disabled={disabled} /></label>
              <label className="sv-field"><span>บทเสียงพากย์ <small>{copy.length} ตัวอักษร</small></span><textarea aria-label="บทเสียงพากย์" value={copy} onChange={event => setCopy(event.target.value)} rows={13} maxLength={20000} disabled={disabled} /></label>
              <div className="sv-actions"><Button variant="outline" disabled={disabled} onClick={() => setStep(0)}><ArrowLeft size={15} /> ย้อนกลับไปแก้ไข</Button><div className="sv-action-buttons">{canSaveDraft && <Button variant="outline" disabled={disabled || !copy.trim() || !selectedTemplate || Boolean(project && !draftChanged)} onClick={() => { void saveCopyDraft() }}><Save size={15} />บันทึกแบบร่าง</Button>}<Button variant="lime" disabled={disabled || !copy.trim() || !selectedTemplate} onClick={() => { void generateStoryboard() }}>{busy ? <LoaderCircle size={16} className="sv-spin" /> : <Clapperboard size={16} />}{busy || 'สร้างบทสตอรี่บอร์ด'}<ArrowRight size={16} /></Button></div></div>
              {project && <p className="sv-saved-note">{draftChanged ? canSaveDraft ? 'มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก สามารถบันทึกแบบร่างก่อน หรือบันทึกพร้อมกับการสร้างสตอรี่บอร์ด' : 'การแก้ไขจะถูกบันทึกเมื่อสร้างช็อตใหม่' : canSaveDraft ? 'บันทึกแบบร่างแล้ว' : 'โหลดบทของโปรเจกต์แล้ว'}<Link to={`/studio/${project.id}`}>เปิดเวิร์กสเปซของโปรเจกต์</Link></p>}
            </section>}
          </main>
          <aside className="sv-panel sv-settings">
            <h2>ตั้งค่าคลิปสั้น</h2><p>ใช้การตั้งค่าเริ่มต้น หรือปรับแต่งตามต้องการ</p>
            <div className="sv-field"><span>รูปแบบคลิปสำเร็จรูป</span><div className="sv-output-modes" role="group" aria-label="รูปแบบคลิปสำเร็จรูป">{([{ id: 'full', label: 'AI วิดีโอ', desc: 'ภาพอ้างอิงสร้างภาพ → ภาพสร้างวิดีโอ → เรนเดอร์รวมคลิป' }, { id: 'image_text', label: 'ภาพนิ่งเป็นคลิป', desc: 'ภาพอ้างอิงสร้างภาพ → ภาพเคลื่อนไหวและพากย์เสียง' }] as const).map(item => <button key={item.id} type="button" className={pipelineMode === item.id ? 'is-selected' : ''} aria-pressed={pipelineMode === item.id} disabled={disabled} onClick={() => setPipelineMode(item.id)}><strong>{item.label}</strong><span>{item.desc}</span>{pipelineMode === item.id && <Check size={14} />}</button>)}</div></div>
            <label className="sv-field"><span>อัตราส่วนภาพ</span><select value={mediaSettings.ratio} onChange={event => setRatio(event.target.value)} disabled={disabled || !mediaSettings.ratios.length}>{!mediaSettings.ratios.length && <option value="">ไม่มีอัตราส่วนภาพที่รองรับร่วมกัน</option>}{mediaSettings.ratios.map(value => <option key={value} value={value}>{value}{value === '9:16' ? ' แนวตั้ง (9:16)' : value === '16:9' ? ' แนวนอน (16:9)' : value === '1:1' ? ' สี่เหลี่ยมจัตุรัส (1:1)' : ''}</option>)}</select></label>
            <label className="sv-field"><span>ความยาวเป้าหมาย</span><select value={duration} onChange={event => setDuration(Number(event.target.value))} disabled={disabled}>{[...new Set([30, 60, 90, 120, 180, duration])].sort((a, b) => a - b).map(value => <option key={value} value={value}>ประมาณ {value} วินาที</option>)}</select></label>
            {pipelineMode === 'image_text' ? <>
              <label className="sv-field"><span>เสียงบรรยายน้ำเสียง</span><select value={voice} onChange={event => setVoice(event.target.value)} disabled={disabled}><option value="">เสียงบรรยายเริ่มต้น</option>{voice && !voices.some(item => (item.speaker || item.id) === voice) && <option value={voice}>เสียงเดิมของโปรเจกต์</option>}{voices.map(item => <option key={item.id} value={item.speaker || item.id}>{item.label}</option>)}</select></label>
              {voiceError && <p className="sv-saved-note">รายการเสียงยังโหลดไม่สำเร็จ ยังสามารถใช้เสียงพากย์เริ่มต้นได้</p>}
            </> : <p className="sv-saved-note">โมเดลวิดีโอจะสร้างเสียงบรรยายและเอฟเฟกต์เสียง</p>}
            <details className="sv-model-settings" open={pipelineMode === 'full'}><summary>โมเดลและคุณภาพการสร้าง</summary>
              <label className="sv-field"><span>โมเดลสร้างภาพจากภาพอ้างอิง</span><select value={mediaSettings.imageModel} disabled={disabled || !mediaSettings.imageOptions.length} onChange={event => setImageModel(event.target.value)}>{mediaSettings.imageSelectionUnavailable && <option value={mediaSettings.imageModel} disabled>{mediaSettings.imageModel}(ไม่พร้อมใช้งานในขณะนี้)</option>}{!mediaSettings.imageOptions.length && !mediaSettings.imageSelectionUnavailable && <option value="">{mediaCatalog ? 'ไม่มีโมเดลภาพอ้างอิงที่พร้อมใช้งาน' : 'กำลังโหลดโมเดล...'}</option>}{mediaSettings.imageOptions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              <label className="sv-field"><span>ความละเอียดของภาพ</span><select value={mediaSettings.imageResolution} disabled={disabled || !mediaSettings.imageResolutions.length} onChange={event => setImageResolution(event.target.value)}>{!mediaSettings.imageResolutions.length && <option value={mediaSettings.imageResolution}>{mediaSettings.imageResolution || 'กรุณาเลือกโมเดลที่พร้อมใช้งาน'}</option>}{mediaSettings.imageResolutions.map(value => <option key={value} value={value}>{value}</option>)}</select><MediaCostNotice modelId={mediaSettings.imageModel} resolution={mediaSettings.imageResolution} /></label>
              {pipelineMode === 'full' && <><label className="sv-field"><span>โมเดลสร้างวิดีโอจากภาพ</span><select value={mediaSettings.videoModel} disabled={disabled || !mediaSettings.videoOptions.length} onChange={event => setVideoModel(event.target.value)}>{mediaSettings.videoSelectionUnavailable && <option value={mediaSettings.videoModel} disabled>{mediaSettings.videoModel}(ไม่พร้อมใช้งานในขณะนี้)</option>}{!mediaSettings.videoOptions.length && !mediaSettings.videoSelectionUnavailable && <option value="">{mediaCatalog ? 'ไม่มีโมเดลสร้างวิดีโอจากภาพที่พร้อมใช้งาน' : 'กำลังโหลดโมเดล...'}</option>}{mediaSettings.videoOptions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
                <label className="sv-field"><span>ความละเอียดของวิดีโอ</span><select value={mediaSettings.videoResolution} disabled={disabled || !mediaSettings.videoResolutions.length} onChange={event => setVideoResolution(event.target.value)}>{!mediaSettings.videoResolutions.length && <option value={mediaSettings.videoResolution}>{mediaSettings.videoResolution || 'กรุณาเลือกโมเดลที่พร้อมใช้งาน'}</option>}{mediaSettings.videoResolutions.map(value => <option key={value} value={value}>{value}</option>)}</select><MediaCostNotice modelId={mediaSettings.videoModel} resolution={mediaSettings.videoResolution} seconds={1} /></label></>}
              {mediaCatalog && !mediaSettings.ready && <p className="sv-model-error" role="status">กรุณาเลือกโมเดลที่พร้อมใช้งาน การสร้างภาพต้องรองรับภาพอ้างอิง {project?.ref_image_url ? 3 : 2} ภาพ{pipelineMode === 'full' ? ' และวิดีโอต้องรองรับภาพอ้างอิง 2 ภาพ' : ''} พร้อมตรวจสอบความละเอียดและอัตราส่วนภาพ</p>}
            </details>
            <div className="sv-setting-summary"><Clapperboard size={17} /><div><strong>{selectedTemplate?.name || 'แอนิเมชัน 3D'}</strong><span>{pipelineMode === 'full' ? 'ภาพเป็นวิดีโอ' : 'ภาพนิ่งเคลื่อนไหว'} · เสียงบรรยาย · คำบรรยาย</span><span>ใช้ภาพอ้างอิงสไตล์ และอ้างอิงช็อตก่อนหน้าเพื่อความต่อเนื่อง</span></div></div>
            <div className="sv-workflow-hint"><Clock3 size={17} /><p>{pipelineMode === 'full' ? 'หลังยืนยันสตอรี่บอร์ดจะสร้างภาพอ้างอิงก่อน จากนั้นสร้างเป็นวิดีโอทีละช็อต และตรวจสอบช็อตก่อนตัดต่อรวมเป็นวิดีโอ' : 'หลังตรวจสอบสตอรี่บอร์ดจะสร้างภาพและเสียงพากย์ เมื่อสื่อพร้อมแล้วจึงรวมเป็นวิดีโอ'}</p></div>
          </aside>
        </div>
      </>}
    </div>
  </AppShell>
}
