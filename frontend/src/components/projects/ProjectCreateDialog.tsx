import { useId, useRef, useState, type FormEvent } from 'react'
import { ArrowUpRight, Check, Clapperboard, LayoutGrid, LoaderCircle, Sparkles } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { DramaImageStyleModal } from '../../pages/drama/DramaImageStyleModal'
import { PROJECT_EPISODE_MAX, validateProjectCreate, type ProjectCreateConstraints, type ProjectCreateDraft, type ProjectCreateErrors, type ProjectCreateValues } from '../../lib/projectCreateForm'
import './project-create.css'

export type { ProjectCreateValues } from '../../lib/projectCreateForm'

export type ProjectCreateDialogProps = ProjectCreateConstraints & {
  open: boolean
  onClose: () => void
  onSubmit: (values: ProjectCreateValues) => Promise<void>
  contextLabel?: string
  allowImageStyle?: boolean
  submitLabel?: string
  footerNote?: string
}

/** 个人、团队和自由画布共用สร้าง流程，ปิด后ล้างข้อมูลฉบับร่าง。 */
export default function ProjectCreateDialog({ open, ...props }: ProjectCreateDialogProps) {
  // Unmount the form on close so a new opening always starts with clean inputs.
  return open ? <ProjectCreateDialogForm key={`${props.kind}:${props.contextLabel || ''}`} {...props} /> : null
}

/** 故事与ชื่อโปรเจกต์为主栏， ตอน数和画风在旁栏统一配置。 */
function ProjectCreateDialogForm({
  onClose,
  onSubmit,
  kind,
  contextLabel = '个人空间',
  titleRequired = false,
  titleMaxLength = 80,
  sourceMaxLength = 2000,
  allowImageStyle = true,
  submitLabel,
  footerNote,
}: Omit<ProjectCreateDialogProps, 'open'>) {
  const formId = useId()
  const canvas = kind === 'canvas'
  /* 保留 ตอน数输入原文，允许用户ล้างข้อมูล后重新输入；ส่ง时统一校验。 */
  const [draft, setDraft] = useState<ProjectCreateDraft>({ title: canvas ? '未命名画布' : '', source: '', description: '', imageStyleId: '', episodeCount: '1' })
  const [errors, setErrors] = useState<ProjectCreateErrors>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const Icon = canvas ? LayoutGrid : Clapperboard
  const title = canvas ? 'สร้างใหม่自由画布' : 'สร้างโปรเจกต์ใหม่'
  const sourceLength = draft.source.trim().length

  /** 修改字段后清理对应错误，保留其他输入。 */
  function update<K extends keyof ProjectCreateDraft>(key: K, value: ProjectCreateDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
    if (key in errors) setErrors((current) => ({ ...current, [key]: undefined }))
    setError('')
  }

  /** 先校验并定位错误，再防重ส่ง，ล้มเหลว时保留ฉบับร่าง。 */
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting.current) return
    const result = validateProjectCreate(draft, { kind, titleRequired, titleMaxLength, sourceMaxLength })
    setErrors(result.errors)
    if (Object.keys(result.errors).length) {
      const field = Object.keys(result.errors)[0]
      const input = document.getElementById(`${formId}-${field}`)
      const details = input?.closest('details')
      if (details) details.open = true
      input?.focus()
      return
    }
    submitting.current = true
    setBusy(true)
    setError('')
    try { await onSubmit(result.values) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'สร้างล้มเหลว，请ลองใหม่') }
    finally { submitting.current = false; setBusy(false) }
  }

  const fieldError = (name: keyof ProjectCreateErrors) => errors[name] ? <span className="pf-project-create-field-error" id={`${formId}-${name}-error`} role="alert">{errors[name]}</span> : null

  return <Modal open onClose={onClose} dismissible={!busy} title={title} size="lg" className="pf-project-create-modal" footer={<>
    <p className="pf-project-create-footer-note">{footerNote || (canvas ? '先สร้าง画布，再自由เพิ่มรูปภาพ、วิดีโอ与灵感。' : '按故事与 ตอน数สร้างโปรเจกต์，เข้าสู่后继续完善分 ตอน。')}</p>
    <div className="pf-project-create-actions"><Button onClick={onClose} disabled={busy}>ยกเลิก</Button><Button variant="lime" type="submit" form={formId} disabled={busy}>{busy ? <><LoaderCircle size={16} className="pf-project-create-spinner" />正在สร้าง…</> : <>{submitLabel || (canvas ? 'สร้าง画布' : 'สร้างโปรเจกต์')}<ArrowUpRight size={16} /></>}</Button></div>
  </>}>
    <form id={formId} className="pf-project-create-form" onSubmit={submit} noValidate aria-busy={busy}>
      <div className="pf-project-create-intro">
        <span className="pf-project-create-icon"><Icon size={23} strokeWidth={1.6} aria-hidden /></span>
        <div><span className="pf-project-create-context">{contextLabel}{!canvas && <span className="pf-project-create-mode">ละครซีรีส์自建算力模式</span>}</span><h4>{canvas ? '给灵感一张自由的画布' : '从一个好故事开始'}</h4><p>{canvas ? '把รูปภาพ、วิดีโอ和想法放在一起，自由连接与创作。' : '写下故事，การตั้งค่า ตอน数与画风，开始构建你的作品。'}</p></div>
      </div>

      <div className={`pf-project-create-layout${canvas ? ' pf-project-create-layout--canvas' : ''}`}>
        <div className="pf-project-create-main">
          <label className="pf-project-create-field" htmlFor={`${formId}-title`}>
            <span className="pf-project-create-label">{canvas ? '画布名称' : 'ชื่อโปรเจกต์'}{!canvas && !titleRequired && <small>ไม่บังคับ，留空自动命名</small>}</span>
            <input id={`${formId}-title`} autoFocus value={draft.title} disabled={busy} onChange={(event) => update('title', event.target.value)} placeholder={canvas ? '为这张画布取个名字' : '例如：雨夜来信'} maxLength={titleMaxLength} aria-invalid={!!errors.title} aria-describedby={errors.title ? `${formId}-title-error` : undefined} required={canvas || titleRequired} />{fieldError('title')}
          </label>

          {!canvas && <label className="pf-project-create-field pf-project-create-story" htmlFor={`${formId}-source`}>
            <span className="pf-project-create-label">故事内容<span className="pf-project-create-required">จำเป็นต้องระบุ</span></span>
            <textarea id={`${formId}-source`} value={draft.source} disabled={busy} onChange={(event) => update('source', event.target.value)} rows={8} placeholder={'故事从谁开始？发生了什么ความขัดแย้ง？\n\n写下แนวคิด，或粘贴已有故事与剧本。'} maxLength={sourceMaxLength} aria-invalid={!!errors.source} aria-describedby={`${formId}-source-hint${errors.source ? ` ${formId}-source-error` : ''}`} required />
            <span className={`pf-project-create-input-meta${sourceLength >= 20 ? ' is-ready' : ''}`} id={`${formId}-source-hint`}><span>{sourceLength >= 20 ? <><Check size={13} />故事已就绪</> : '至少 20 字，包含人物与核心ความขัดแย้ง'}</span><span>{sourceLength.toLocaleString()} / {sourceMaxLength.toLocaleString()}</span></span>{fieldError('source')}
          </label>}

          <details className="pf-project-create-description" open={canvas || undefined}>
            <summary>{canvas ? '画布说明' : '补充โปรเจกต์คำอธิบายสั้น'}<span>ไม่บังคับ</span></summary>
            <label className="pf-project-create-field" htmlFor={`${formId}-description`}><span className="pf-project-create-sr-only">{canvas ? '画布说明' : 'โปรเจกต์คำอธิบายสั้น'}</span><textarea id={`${formId}-description`} value={draft.description} onChange={(event) => update('description', event.target.value)} rows={3} maxLength={500} disabled={busy} placeholder={canvas ? '这张画布想探索什么？' : '用一两句话概括作品，方便在รายการโปรเจกต์中识别。'} aria-invalid={!!errors.description} aria-describedby={errors.description ? `${formId}-description-error` : undefined} /><span className="pf-project-create-input-meta"><span>会显示在โปรเจกต์卡片中</span><span>{draft.description.trim().length} / 500</span></span>{fieldError('description')}</label>
          </details>
        </div>

        {!canvas && <aside className="pf-project-create-settings" aria-label="创作ตั้งค่า">
          <div className="pf-project-create-episodes">
            <label className="pf-project-create-label" htmlFor={`${formId}-episodeCount`}>初始 ตอน数<small>1–{PROJECT_EPISODE_MAX}  ตอน</small></label>
            <div className="pf-project-create-episode-presets" role="group" aria-label="常用 ตอน数">
              {[1, 3, 6, 12].map((count) => <button key={count} type="button" aria-pressed={Number(draft.episodeCount) === count} disabled={busy} onClick={() => update('episodeCount', String(count))}>{count}<span> ตอน</span></button>)}
            </div>
            <div className="pf-project-create-episode-input"><input id={`${formId}-episodeCount`} type="number" inputMode="numeric" min={1} max={PROJECT_EPISODE_MAX} step={1} value={draft.episodeCount} disabled={busy} onChange={(event) => update('episodeCount', event.target.value)} aria-invalid={!!errors.episodeCount} aria-describedby={`${formId}-episodeCount-hint${errors.episodeCount ? ` ${formId}-episodeCount-error` : ''}`} required /><span> ตอน</span></div>
            <p id={`${formId}-episodeCount-hint`}>支持กำหนดเอง ตอน数，后续可在โปรเจกต์中继续增加分 ตอน。</p>{fieldError('episodeCount')}
          </div>
          {allowImageStyle && <div className="pf-project-create-style"><span className="pf-project-create-label"><Sparkles size={14} aria-hidden />สไตล์ภาพ<small>ไม่บังคับ</small></span><DramaImageStyleModal value={draft.imageStyleId} onChange={(value) => update('imageStyleId', value)} disabled={busy} variant="field" fieldLabel="" emptyLabel="เลือกสไตล์ภาพ" /><p>为ตัวละคร和ฉากตั้งค่า统一的视觉方向。</p></div>}
        </aside>}
      </div>
      {error && <div className="pf-project-create-error" role="alert">{error}</div>}
    </form>
  </Modal>
}
