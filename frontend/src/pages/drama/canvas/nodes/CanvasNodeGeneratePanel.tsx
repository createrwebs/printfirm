/** 选中节点底部：AI คำแนะนำ词浮动面板（生图 / 生วิดีโอ） */
import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { ArrowUp, CircleHelp, Loader2, Sparkles, Wand2 } from 'lucide-react'
import { SeedanceRulesModal } from '../../../../components/drama/SeedanceRulesModal'
import { useCanvasStore } from '../CanvasStore'
import { CANVAS_GENERATABLE_KINDS, type CanvasNodeKind } from '../canvasTypes'
import {
  readImageGenerationOptions,
  type ImageGenerationOptions,
} from '../../../../lib/dramaGenerationOptions'
import {
  DEFAULT_VIDEO_GENERATION_OPTIONS,
  readVideoGenerationOptions,
  type VideoGenerationOptions,
} from '../../../../lib/dramaVideoGenerationOptions'
import { optimizePromptWithSkills } from '../../../../api/agentSkills'
import { useAgentSkillSelection } from '../../../../hooks/useAgentSkillSelection'
import { ensureStructureInPrompt } from '../../../../lib/dramaStructurePrompt'
import { DramaImageGenOptionsBar } from './DramaImageGenOptionsBar'
import { DramaSkillOptionsBar } from './DramaSkillOptionsBar'
import { DramaVideoGenOptionsBar } from './DramaVideoGenOptionsBar'
import { CanvasPromptEditor } from './CanvasPromptEditor'
import { useMediaModelsCatalog } from '../../../../hooks/useMediaModelsCatalog'

type CanvasNodeGeneratePanelProps = {
  nodeId: string
  kind: CanvasNodeKind
  generating?: boolean
  defaultPrompt?: string
  /** 节点展示名，用于过滤弱占位คำแนะนำ词 */
  label?: string
  /** 是否已有ภาพอ้างอิง（แอสเซท库/อัปโหลด） */
  hasMedia?: boolean
  /** วิดีโอ节点已บันทึก的 Seedance 参数 */
  videoOptions?: Record<string, unknown>
  /** 生图节点已บันทึก的模型/อัตราส่วน/ความคมชัด */
  imageOptions?: Record<string, unknown>
}

/** 按节点ประเภทกลับ面板文案 */
function panelCopy(kind: CanvasNodeKind, hasMedia: boolean) {
  if (kind === 'video') {
    return {
      title: hasMedia ? 'แก้ไข并重生วิดีโอ' : 'AI สร้างวิดีโอ',
      placeholder: 'คำอธิบายวิดีโอภาพ、镜头运动与氛围；键入 @ 引用已连线节点…',
      hint: 'Enter สร้างวิดีโอ · @ 仅可引用已连线节点 · Shift+Enter 换行',
    }
  }
  if (kind === 'character') {
    return {
      title: hasMedia ? 'แก้ไข并重生ตัวละคร' : 'AI 生ตัวละคร',
      placeholder: 'คำอธิบายตัวละคร外貌、服饰与气质…',
      hint: 'Enter 生成 · Shift+Enter 换行',
    }
  }
  if (kind === 'scene') {
    return {
      title: hasMedia ? 'แก้ไข并重生ฉาก' : 'AI 生ฉาก',
      placeholder: 'คำอธิบายฉาก环境、光线与氛围…',
      hint: 'Enter 生成 · Shift+Enter 换行',
    }
  }
  return {
    title: hasMedia ? 'แก้ไข并重生รูปภาพ' : 'AI 生图',
    placeholder: 'คำอธิบายภาพ内容；键入 @ 引用已连线节点…',
    hint: 'Enter 生成 · @ 仅可引用已连线节点 · Shift+Enter 换行',
  }
}

const PLACEHOLDER_PROMPT = /^(character|scene|prop|material|none|image|audio|video)\s+\S+$/i

/** 清洗ค่าเริ่มต้นคำแนะนำ词：只去掉「video 新วิดีโอ」这类占位，保留用户短คำอธิบาย与 @ 引用 */
function sanitizePrompt(raw: string, kind: CanvasNodeKind, label: string): string {
  const text = (raw || '').trim()
  if (!text) return ''
  if (PLACEHOLDER_PROMPT.test(text)) return ''
  if (label && (text === `${kind} ${label}` || text === label)) return ''
  return text
}

/** เรนเดอร์ AI คำแนะนำ词แก้ไข面板 */
export function CanvasNodeGeneratePanel({
  nodeId,
  kind,
  generating = false,
  defaultPrompt = '',
  label = '',
  hasMedia = false,
  videoOptions: savedVideoOptions,
  imageOptions: savedImageOptions,
}: CanvasNodeGeneratePanelProps) {
  const {
    projectId,
    generateNodeImage,
    generateNodeVideo,
    setErrorMessage,
    projectImageStyleId,
    updateNodePrompt,
    updateNodeVideoOptions,
    updateNodeImageOptions,
    mentionableNodes,
    edges,
  } = useCanvasStore()
  const [prompt, setPrompt] = useState(() => sanitizePrompt(defaultPrompt, kind, label))
  /*
   * busy 正在ส่ง生成
   * rulesOpen Seedance 规则弹窗
   * optimizing Skill 改写进行中
   */
  const [busy, setBusy] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const { skills, selectedIds, toggleSkill, selectAll, selectNone, uploadSkill, uploading, uploadError } =
    useAgentSkillSelection()
  // imageOptions 生图สไตล์/模型/画幅（优先恢复节点上已บันทึกเลือก）
  const [imageOptions, setImageOptions] = useState<ImageGenerationOptions>(() => {
    const saved = readImageGenerationOptions(savedImageOptions, kind)
    return {
      ...saved,
      image_style_id: saved.image_style_id || projectImageStyleId || undefined,
    }
  })
  // videoOpts Seedance ความยาว/อัตราส่วน/ความคมชัด
  const [videoOpts, setVideoOpts] = useState<VideoGenerationOptions>(() => {
    const saved = readVideoGenerationOptions(savedVideoOptions)
    return {
      ...DEFAULT_VIDEO_GENERATION_OPTIONS,
      ...saved,
      image_style_id: saved.image_style_id || projectImageStyleId || undefined,
    }
  })
  const copy = panelCopy(kind, hasMedia)
  const allowMention = kind === 'video' || kind === 'image'
  const isVideo = kind === 'video'
  const mediaCatalog = useMediaModelsCatalog()
  const selectedModelId = isVideo ? videoOpts.model_id || mediaCatalog?.defaults.video_model : imageOptions.model_id || mediaCatalog?.defaults.image_model
  const referenceLimits = (isVideo ? mediaCatalog?.video_models : mediaCatalog?.image_models)?.find(model => model.id === selectedModelId)?.reference_limits

  /* 可引用：仅已连线邻居（双向），并排除自身 */
  const mentionItems = useMemo(() => {
    const neighborIds = new Set<string>()
    for (const edge of edges) {
      if (edge.source === nodeId) neighborIds.add(edge.target)
      if (edge.target === nodeId) neighborIds.add(edge.source)
    }
    return mentionableNodes.filter(
      (n) => n.nodeId !== nodeId && neighborIds.has(n.nodeId),
    )
  }, [edges, mentionableNodes, nodeId])

  const lastNodeIdRef = useRef(nodeId)

  /* 换节点时强制同步；同一节点不要用空ค่าเริ่มต้น值清掉用户เนื้อหาหลัก */
  useEffect(() => {
    const switched = lastNodeIdRef.current !== nodeId
    lastNodeIdRef.current = nodeId
    const next = sanitizePrompt(defaultPrompt, kind, label)
    if (switched) {
      setPrompt(next)
      return
    }
    setPrompt((prev) => next || prev)
  }, [defaultPrompt, nodeId, kind, label])

  /* 仅切换节点时从节点恢复生图选项；แก้ไข过程不覆盖本地เลือก */
  useEffect(() => {
    const saved = readImageGenerationOptions(savedImageOptions, kind)
    setImageOptions({
      ...saved,
      image_style_id: saved.image_style_id || projectImageStyleId || undefined,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在换节点时恢复
  }, [nodeId, kind])

  useEffect(() => {
    const saved = readVideoGenerationOptions(savedVideoOptions)
    setVideoOpts({
      ...DEFAULT_VIDEO_GENERATION_OPTIONS,
      ...saved,
      image_style_id: saved.image_style_id || projectImageStyleId || undefined,
    })
    // 仅切换节点时恢复已บันทึก参数，避免แก้ไข选项时被回写覆盖
  }, [nodeId])

  const isBusy = busy || generating || optimizing
  const canSubmit = prompt.trim().length > 0 && !isBusy
  const canOptimize = prompt.trim().length > 0 && selectedIds.length > 0 && !isBusy

  if (!CANVAS_GENERATABLE_KINDS.has(kind)) return null

  const stopFlowEvent = (event: MouseEvent) => {
    event.stopPropagation()
  }

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    try {
      // คำแนะนำ词以框内为准（抽取/生成คำแนะนำ词时已含三视图等结构）；生图不再动态拼接
      const finalPrompt = prompt.trim()
      updateNodePrompt(nodeId, finalPrompt)
      if (isVideo) {
        updateNodeVideoOptions(nodeId, videoOpts)
        await generateNodeVideo(nodeId, finalPrompt, videoOpts)
      } else {
        updateNodeImageOptions(nodeId, imageOptions)
        await generateNodeImage(nodeId, finalPrompt, imageOptions)
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'สร้างไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    void submit()
  }

  // 按勾选 Skill 改写当前คำแนะนำ词；若优化丢掉结构前缀则补回（写入框内，非生图时静默携带）
  const optimizePrompt = async () => {
    if (!canOptimize) return
    setOptimizing(true)
    try {
      const result = await optimizePromptWithSkills({
        project_id: projectId,
        prompt,
        skill_ids: selectedIds,
        task: isVideo ? 'video_prompt' : 'image_prompt',
      })
      let next = (result.prompt || '').trim()
      if (next && !isVideo) {
        next = ensureStructureInPrompt(next, kind)
      }
      if (next) {
        setPrompt(next)
        updateNodePrompt(nodeId, next)
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'คำอธิบาย优化ล้มเหลว')
    } finally {
      setOptimizing(false)
    }
  }

  return (
    <form
      className={`fc-generate-panel nodrag nopan nowheel${hasMedia ? ' has-media' : ''}`}
      onMouseDown={stopFlowEvent}
      onPointerDown={stopFlowEvent}
      onClick={stopFlowEvent}
      onSubmit={handleSubmit}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          updateNodePrompt(nodeId, prompt)
        }
      }}
    >
      <div className="fc-generate-head">
        <span className="fc-generate-head-icon" aria-hidden="true"><Sparkles size={15} strokeWidth={1.8} /></span>
        <span>{copy.title}</span>
        {hasMedia ? <em className="fc-generate-tag">可再次生成</em> : null}
        {isVideo ? (
          <button
            type="button"
            className="fc-generate-help"
            title="Seedance 传值与使用规则"
            aria-label="Seedance 传值与使用规则"
            disabled={isBusy}
            onClick={() => setRulesOpen(true)}
          >
            <CircleHelp size={14} strokeWidth={1.8} />
          </button>
        ) : null}
      </div>
      <div className="fc-generate-prompt-meta">
        <span>คำแนะนำ词{allowMention ? <span className="fc-generate-mention-hint"> · @ 引用连线节点</span> : null}</span>
        <span className="fc-generate-count">{Array.from(prompt).length.toLocaleString()} 字</span>
      </div>
      <CanvasPromptEditor
        value={prompt}
        placeholder={copy.placeholder}
        disabled={isBusy}
        allowMention={allowMention}
        mentionItems={mentionItems}
        onChange={(next) => {
          setPrompt(next)
        }}
        onSubmit={() => void submit()}
      />
      <div className="fc-generate-settings">
        {isVideo ? (
          <DramaVideoGenOptionsBar
            value={videoOpts}
            disabled={isBusy}
            onChange={(next) => {
              setVideoOpts(next)
              updateNodeVideoOptions(nodeId, next)
            }}
          />
        ) : (
          <DramaImageGenOptionsBar
            value={imageOptions}
            disabled={isBusy}
            onChange={(next) => {
              setImageOptions(next)
              updateNodeImageOptions(nodeId, next)
            }}
          />
        )}
        <DramaSkillOptionsBar
          skills={skills}
          selectedIds={selectedIds}
          disabled={isBusy}
          onToggle={toggleSkill}
          onSelectAll={selectAll}
          onSelectNone={selectNone}
          onUpload={(file) => void uploadSkill(file)}
          uploading={uploading}
          uploadError={uploadError}
        />
        {referenceLimits ? (
          <span className="fc-generate-reference-limits" title="首尾帧和画风板计入ภาพอ้างอิง片数量；0 表示模型不支持此类参考。">
            参考上限：รูปภาพ {referenceLimits.images} · วิดีโอ {referenceLimits.videos} · เสียง {referenceLimits.audios}
          </span>
        ) : null}
      </div>
      <div className="fc-generate-actions">
        <span className="fc-generate-hint" title={copy.hint}>
          <span><kbd>Enter</kbd> 生成</span>
          <span><kbd>Shift + Enter</kbd> 换行</span>
        </span>
        <div className="fc-generate-action-btns">
          <button
            type="button"
            className="fc-generate-optimize"
            disabled={!canOptimize}
            title={
              selectedIds.length
                ? '优化คำบรรยายภาพ，并保留บทพูด与 @ 引用'
                : '请先เลือก Skill'
            }
            onClick={() => void optimizePrompt()}
          >
            {optimizing ? <Loader2 size={14} className="fc-spin" /> : <Wand2 size={14} strokeWidth={1.8} />}
            คำอธิบาย优化
          </button>
          <button type="submit" className="fc-generate-submit" disabled={!canSubmit} aria-label={generating || busy ? 'กำลังสร้าง' : '生成'}>
            <span>{generating || busy ? 'กำลังสร้าง' : '生成'}</span>
            {isBusy && !optimizing ? (
              <Loader2 size={16} className="fc-spin" />
            ) : (
              <ArrowUp size={16} strokeWidth={2} />
            )}
          </button>
        </div>
      </div>
      {isVideo ? <SeedanceRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} /> : null}
    </form>
  )
}
