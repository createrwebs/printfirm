import { useTeamReadOnly } from '../../features/teams/readOnlyContext'
import { TeamEpisodeEditingBoundary } from '../../features/teams/TeamEditingBoundary'
/** 分 ตอนแก้ไข：复刻原โปรเจกต์四栏布局（แอสเซท / สคริปต์ / ดูตัวอย่าง / 故事板） */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  dramaApi,
  resolveDramaMediaUrl,
  type DramaAsset,
  type DramaEpisode,
  type DramaFragment,
} from '../../api/drama'
import { type ImageStyleId } from '../../lib/dramaImageStyles'
import {
  RATIO_OPTIONS,
  buildFragmentRefStripItems,
  collectFragmentAssetIds,
  extractAssetIds,
  filterEpisodeAssets,
  formatFragLabel,
  fragmentQueueBadgeLabel,
  isFragmentGenerationBusy,
  normalizeAssetTab,
  readFragmentGenerationStatus,
  readFragmentVideoVersions,
  resolveFragmentDurationSec,
  type AssetScope,
  type AssetTab,
} from './dramaEpisodeEditUtils'
import {
  enqueueEpisodeVideoJobs,
  ensureEpisodeVideoStatusPoll,
  subscribeEpisodeGenerateStatus,
  syncEpisodeVideoJobs,
  useDramaGenQueue,
  videoJobId,
  type DramaGenJob,
} from '../../lib/dramaGenQueue'
import {
  collectDramaGenerateGateIssues,
  formatDramaGateMessage,
} from '../../lib/dramaEpisodeScriptValidate'
import { isMinimaxH3Model } from '../../lib/dramaMediaModelMeta'
import { DRAMA_VOICE_BINDING_ENABLED } from '../../lib/dramaVoiceBinding'
import BillingErrorNotice from '../../components/billing/BillingErrorNotice'
import { dialog } from '../../lib/dialog'
import {
  formatProjectOutputLabel,
  readEpisodeAspectRatio,
  readEpisodeResolution,
} from '../../lib/dramaProjectOutputSettings'
import { DramaFragmentClipSpec } from '../../components/drama/DramaFragmentClipSpec'
import { FragmentPlanSkillModal } from '../../components/drama/FragmentPlanSkillModal'
import { DramaGenTaskDetail } from '../../components/drama/DramaGenTaskDetail'
import { CircleAlert } from 'lucide-react'
import { useDramaImageGenQueue } from '../../hooks/useDramaImageGenQueue'
import { resolveCatalogModelSelection, useMediaModelsCatalog } from '../../hooks/useMediaModelsCatalog'
import { enqueueDramaImageGen } from '../../lib/dramaImageGenQueue'
import { defaultOptionsForAssetKind } from '../../lib/dramaGenerationOptions'
import { dramaAssetImageGenButtonLabel } from '../../lib/dramaAssetImage'
import { readVisualPrompt } from '../../lib/dramaVisualPrompt'
import { generateAndBindCharacterVoice } from '../../lib/characterVoiceGenerate'
import { getImageStyleId } from './dramaWorkspaceUtils'
import { EpisodeEditAssetPanel } from './EpisodeEditAssetPanel'
import { EpisodeEditHeaderControls } from './EpisodeEditHeaderControls'
import { EpisodeEditPromptEditor } from './EpisodeEditPromptEditor'
import { EpisodeEditReferenceStrip } from './EpisodeEditReferenceStrip'
import { EpisodeEditSidePane } from './EpisodeEditSidePane'
import {
  GlobalAssetPickerModal,
  importGlobalAssetToProject,
} from './GlobalAssetPickerModal'
import {
  applySubtitleModeToFragments,
  subtitleModeUsesModelOutput,
  type DramaSubtitleMode,
} from '../../lib/dramaSubtitleSettings'
import {
  applyCharacterIntroModeToFragments,
  characterIntroModeEnabled,
  type DramaCharacterIntroMode,
} from '../../lib/dramaCharacterIntro'
import {
  readEffectiveCharacterIntroMode,
  readEffectiveSubtitleMode,
} from '../../lib/dramaProjectGlobalSettings'
import {
  CharacterVoiceBindModal,
  readAssetVoiceBinding,
} from './CharacterVoiceBindModal'
import { EditableAssetDetailDialog } from '../../components/assets/EditableAssetDetailDialog'
import { buildEpisodeDirItems, DramaEpisodeDir } from './DramaEpisodeDir'
import RequireAuth from './RequireAuth'
import './drama.css'

export default function EpisodeEditPage() {
  return (
    <RequireAuth>
      <TeamEpisodeEditingBoundary><EpisodeEditInner /></TeamEpisodeEditingBoundary>
    </RequireAuth>
  )
}

function readFragmentPlanStatus(ep: DramaEpisode | null): string {
  // 优先读取统一任务中心中的วางแผนสตอรี่บอร์ด任务；旧 params สถานะ作为兜底
  const active = (ep?.active_tasks || []).find((task) => task.task_type === 'fragment_plan')
  if (
    active &&
    !active.cancel_requested &&
    ['pending', 'leased', 'running', 'awaiting_poll', 'awaiting_review'].includes(active.status)
  ) {
    return 'generating'
  }
  const st = ep?.params?.fragment_plan_status
  return typeof st === 'string' ? st : ''
}

// 统一แยกวิเคราะห์โปรเจกต์参数里的布尔值，เข้ากันได้历史字符串/数字วิธีการเขียน。
function coerceProjectBool(value: unknown, defaultValue: boolean): boolean {
  if (value == null) return defaultValue
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
    if (['0', 'false', 'no', 'off', ''].includes(normalized)) return false
  }
  return Boolean(value)
}

// 分 ตอนแก้ไข页主体
function EpisodeEditInner() {
  const readOnly = useTeamReadOnly()
  const { projectId, episodeId } = useParams()
  const pid = Number(projectId)
  const eid = Number(episodeId)
  const navigate = useNavigate()
  /*
   * episode 分 ตอน
   * fragments 分ช็อตที่ 
   * assets แอสเซท
   * selectedIndex ปัจจุบัน分ช็อตที่ 
   * assetScope / assetTab 侧栏ตัวกรอง
   * editing 是否แก้ไข模式
   * videoStyleId / modelId / aspectRatio 生成参数（UI）
   * busy / status / error สถานะ
   */
  const [episode, setEpisode] = useState<DramaEpisode | null>(null)
  const [episodeList, setEpisodeList] = useState<DramaEpisode[]>([])
  const [fragments, setFragments] = useState<DramaFragment[]>([])
  const [assets, setAssets] = useState<DramaAsset[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [assetScope, setAssetScope] = useState<AssetScope>('episode')
  const [assetTab, setAssetTab] = useState<AssetTab | null>('character')
  const [editing, setEditing] = useState(false)
  const [videoStyleId, setVideoStyleId] = useState<ImageStyleId | ''>('')
  const [modelId, setModelId] = useState('')
  const mediaCatalog = useMediaModelsCatalog()
  const [aspectRatio, setAspectRatio] = useState<(typeof RATIO_OPTIONS)[number]>('9:16')
  // subtitleMode 本 ตอนคำบรรยาย (ซับไตเติล)方式：模型自出 / 后期拼接（ค่าเริ่มต้น后期）
  const [subtitleMode, setSubtitleMode] = useState<DramaSubtitleMode>('post')
  // characterIntroMode 本 ตอนข้อความแนะนำตัวละคร：模型叠字 / ปิด（ค่าเริ่มต้นปิด）
  const [characterIntroMode, setCharacterIntroMode] = useState<DramaCharacterIntroMode>('off')
  // linkLastFrame 是否用上一ช็อตที่ 尾帧作本ช็อตที่ เฟรมแรก（เขียนลงไป project.params，ค่าเริ่มต้น开启）
  const [linkLastFrame, setLinkLastFrame] = useState(true)
  // projectParams โปรเจกต์ params 缓存（การเชื่อมต่อระหว่างช็อต + 分 ตอนข้อกำหนดผลลัพธ์ถูกคืนค่า）
  const [projectParams, setProjectParams] = useState<Record<string, unknown>>({})
  // episodeParams 分 ตอน params 缓存（画幅 / ความคมชัดเขียนที่นี่）
  const [episodeParams, setEpisodeParams] = useState<Record<string, unknown>>({})
  // planModalOpen AI ยืนยันช็อตใหม่（含 Skill 勾选）
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [characterVoiceBusyIds, setCharacterVoiceBusyIds] = useState<Set<number>>(() => new Set())
  /*
   * detailAsset 左侧รายละเอียดแอสเซท（แก้ไข/สร้างใหม่/อัปโหลด）
   * voiceBindAsset น้ำเสียงเชื่อมโยงเป้าหมายของป็อปอัป
   * imageGenQueue ทั่วไปสแนปชอตของคิวการสร้างภาพ
   */
  const [detailAsset, setDetailAsset] = useState<DramaAsset | null>(null)
  const [voiceBindAsset, setVoiceBindAsset] = useState<DramaAsset | null>(null)
  /** failReasonJob เปิดจากไอคอนเครื่องหมายอัศเจรีย์สตอรี่บอร์ดด้านล่างล้มเหลวเหตุผล */
  const [failReasonJob, setFailReasonJob] = useState<DramaGenJob | null>(null)
  // assetCreateBusy / libraryPickerOpen 侧栏สร้างใหม่与นำเข้า
  const [assetCreateBusy, setAssetCreateBusy] = useState(false)
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false)
  const imageGenQueue = useDramaImageGenQueue()
  const dramaGenQueue = useDramaGenQueue()
  const applyStatusRef = useRef<(st: Awaited<ReturnType<typeof dramaApi.generateStatus>>) => Awaited<
    ReturnType<typeof dramaApi.generateStatus>
  >>(() => ({ episode_id: 0, done: 0, failed: 0, running: 0, total: 0, tasks: [], fragments: [] }))
  const reloadRef = useRef<() => Promise<void>>(async () => {})
  const projectParamsRef = useRef<Record<string, unknown>>({})
  const episodeParamsRef = useRef<Record<string, unknown>>({})

  useEffect(() => {
    // 目录到达后，เปลี่ยนเดิม Kie/อาร์ก id เปลี่ยนเป็นพื้นหลังค่าเริ่มต้นวิดีโอ模型
    if (!mediaCatalog) return
    setModelId(previous => resolveCatalogModelSelection(mediaCatalog, 'video', previous))
  }, [mediaCatalog])

  const selected = fragments[selectedIndex] || null
  const selectedDuration = selected?.duration_sec ?? 8
  // generatingIds ปัจจุบัน分 ตอน排队/กำลังสร้าง的分ช็อตที่  id
  const generatingIds = useMemo(() => {
    const ids = new Set<number>()
    for (const task of episode?.active_tasks || []) {
      if (
        typeof task.episode_id === 'number' &&
        task.episode_id > 0 &&
        task.episode_id !== eid
      ) {
        continue
      }
      if (
        task.task_type === 'fragment_video' &&
        typeof task.fragment_id === 'number' &&
        !task.cancel_requested &&
        ['pending', 'leased', 'running', 'awaiting_poll', 'awaiting_review'].includes(task.status)
      ) {
        // ผลการแก้ไขแล้ว done：忽略เหลือค้างงานที่กำลังดำเนินการ，หลีกเลี่ยงโลโกในระยะยาว「กำลังสร้าง」
        const frag = fragments.find((f) => f.id === task.fragment_id)
        if (frag && readFragmentGenerationStatus(frag).status === 'done') continue
        if (!frag) continue
        ids.add(task.fragment_id)
      }
    }
    for (const frag of fragments) {
      if (!frag.id) continue
      const st = readFragmentGenerationStatus(frag).status
      if (st === 'done') continue
      if (isFragmentGenerationBusy(st)) ids.add(frag.id)
    }
    return ids
  }, [eid, fragments, episode?.active_tasks])
  // anyFragmentGenerating 本 ตอน是否有分ช็อตที่ 在排队/生成（不锁แก้ไข，仅锁สร้างพร้อมกัน）
  const anyFragmentGenerating = generatingIds.size > 0
  // selectedIsGenerating ปัจจุบัน选中ช็อตที่ 是否กำลัง生成
  const selectedIsGenerating = Boolean(selected?.id && generatingIds.has(selected.id))
  // selectedHasVideo ว่าช็อตปัจจุบันมีสินค้าแล้วหรือไม่（用于「สร้างใหม่」文案）
  const selectedHasVideo = Boolean(selected?.video)
  // selectedVersions ปัจจุบันช็อตที่ 历史成片
  const selectedVersions = useMemo(() => readFragmentVideoVersions(selected), [selected])
  // previewVersion ปัจจุบัน选中待ดูตัวอย่าง的历史成片
  const previewVersion = useMemo(
    () => selectedVersions.find((ver) => ver.id === previewVersionId) ?? null,
    [previewVersionId, selectedVersions],
  )
  const previewVideoUrl = previewVersion ? resolveDramaMediaUrl(previewVersion.video) : null
  const previewPosterUrl = previewVersion?.cover ? resolveDramaMediaUrl(previewVersion.cover) : null
  // generateAllLocked 仅ส่งล็อคเมื่อเข้าคิว，生成过程不阻塞แก้ไข
  const generateAllLocked = readOnly || busy
  // planFragmentsLocked 仅本 ตอน有วิดีโอ生成或 AI 分ช็อตที่ 进行中时锁定
  const planFragmentsLocked =
    readOnly || busy || anyFragmentGenerating || readFragmentPlanStatus(episode) === 'generating'
  const selectedRefIds = useMemo(
    () => new Set(collectFragmentAssetIds(selected)),
    [selected],
  )
  const selectedRefItems = useMemo(
    () =>
      buildFragmentRefStripItems(selected, assets, resolveDramaMediaUrl, (asset) => {
        const voice = readAssetVoiceBinding(asset)
        return voice ? { label: voice.label, url: voice.url } : null
      }),
    [selected, assets],
  )
  // selectedGateBlocking / selectedGateIssues ปัจจุบันช็อตที่ สคริปต์/แอสเซทระบบควบคุมการเข้าออก
  const selectedGateBlocking = useMemo(
    () => collectDramaGenerateGateIssues(selected, assets).blocking,
    [selected, assets],
  )
  const selectedGateIssues = useMemo(() => {
    const { blocking, warnings } = collectDramaGenerateGateIssues(selected, assets)
    return [...blocking, ...warnings]
  }, [selected, assets])

  // prevLastFrameUrl 上一ช็อตที่ 已落盘尾帧（เงื่อนไขการเชื่อมต่อและทริกเกอร์；เข้ากันได้ generation / ช่องเวอร์ชันประวัติ）
  const prevLastFrameUrl = useMemo(() => {
    if (selectedIndex <= 0) return ''
    const prev = fragments[selectedIndex - 1]
    const params = prev?.params
    if (!params || typeof params !== 'object') return ''
    const rec = params as Record<string, unknown>
    const fromTop = rec.lastFrameUrl
    if (typeof fromTop === 'string' && fromTop.trim()) return fromTop.trim()
    const gen = rec.generation
    if (gen && typeof gen === 'object') {
      const fromGen = (gen as Record<string, unknown>).lastFrameUrl
      if (typeof fromGen === 'string' && fromGen.trim()) return fromGen.trim()
    }
    const versions = readFragmentVideoVersions(prev)
    for (const ver of versions) {
      if (ver.lastFrameUrl && ver.lastFrameUrl.trim()) return ver.lastFrameUrl.trim()
    }
    return ''
  }, [fragments, selectedIndex])

  // 开启尾帧衔接时：仅上一ช็อตที่ 从未生成过才ห้าม；ช็อตก่อนหน้าอยู่ในการสร้าง/เมื่อเข้าคิวช็อตนี้สามารถเข้าคิวรอได้
  const continuityBlockedReason = useMemo(() => {
    if (!linkLastFrame || selectedIndex <= 0) return ''
    const prev = fragments[selectedIndex - 1]
    if (!prev) return 'ไม่มีช็อตก่อนหน้า ไม่สามารถเชื่อมต่อได้'
    if (prev.id && generatingIds.has(prev.id)) {
      return ''
    }
    const prevDone =
      Boolean((prev.video || '').trim()) ||
      readFragmentGenerationStatus(prev).status === 'done' ||
      Boolean(prevLastFrameUrl)
    if (!prevDone) {
      return 'โปรดสร้างช็อตก่อนหน้าและรอให้เฟรมท้ายพร้อม'
    }
    return ''
  }, [linkLastFrame, selectedIndex, fragments, generatingIds, prevLastFrameUrl])

  const continuityQueueHint = useMemo(() => {
    if (!linkLastFrame || selectedIndex <= 0) return ''
    const prev = fragments[selectedIndex - 1]
    if (!prev?.id || !generatingIds.has(prev.id)) return ''
    return 'ช็อตก่อนหน้ากำลังสร้าง ช็อตนี้จะเข้าคิวรอจนกว่าช็อตก่อนหน้าจะสร้างเสร็จ'
  }, [linkLastFrame, selectedIndex, fragments, generatingIds])

  // selectedGenerateLocked 锁ปัจจุบันช็อตที่ 「生成」：忙/กำลังสร้าง/衔接/缺ภาพอ้างอิง等硬ระบบควบคุมการเข้าออก
  const selectedGenerateLocked =
    readOnly ||
    busy ||
    selectedIsGenerating ||
    Boolean(continuityBlockedReason) ||
    selectedGateBlocking.length > 0

  // เก็บการเชื่อมต่อระหว่างช็อตไปยังโปรเจกต์ params，并让后端重排未开始任务
  async function handleLinkLastFrameChange(enabled: boolean) {
    if (readOnly) return
    const prevEnabled = linkLastFrame
    const prevParams = projectParams
    const nextParams = { ...projectParams, linkLastFrame: enabled }
    setLinkLastFrame(enabled)
    setProjectParams(nextParams)
    try {
      const updated = await dramaApi.updateProject(pid, { params: nextParams })
      const updatedParams =
        updated.params && typeof updated.params === 'object'
          ? (updated.params as Record<string, unknown>)
          : (nextParams as Record<string, unknown>)
      setProjectParams(updatedParams)
      setLinkLastFrame(coerceProjectBool(updatedParams.linkLastFrame ?? updatedParams.link_last_frame, enabled))
      // รีเฟรช本 ตอน任务态，让底部分ช็อตที่ 条立刻反映串行/并行调整
      try {
        const ep = await dramaApi.getEpisode(eid)
        setEpisode(ep)
        if (Array.isArray(ep.fragments)) setFragments(ep.fragments)
      } catch {
        /* ignore refresh errors */
      }
      setStatus(
        enabled
          ? 'เปิดใช้งานการเชื่อมต่อเฟรมท้ายแล้ว: งานที่ยังไม่เริ่มจะเข้าคิวตามลำดับช็อต งานที่กำลังดำเนินการอยู่จะไม่ได้รับผลกระทบ'
          : 'ปิดใช้งานการเชื่อมต่อเฟรมท้ายแล้ว: งานที่ยังไม่เริ่มสามารถสร้างพร้อมกันได้ งานที่กำลังดำเนินการอยู่จะไม่ได้รับผลกระทบ',
      )
    } catch (err) {
      setLinkLastFrame(prevEnabled)
      setProjectParams(prevParams)
      setError(err instanceof Error ? err.message : 'บันทึกการตั้งค่าการเชื่อมต่อล้มเหลว')
    }
  }

  // บันทึกถาวร本 ตอน画幅 / ความคมชัด到 episode.params；เมื่อมีเนื้อหาสำเร็จแล้วคำแนะนำสร้างใหม่（quiet=เงียบเมื่อโมเดลจำกัดอัตโนมัติ）
  async function handleEpisodeOutputChange(
    nextParams: Record<string, unknown>,
    opts?: { quiet?: boolean },
  ) {
    if (readOnly) return
    const prevRatio = readEpisodeAspectRatio(episodeParams, projectParams)
    const prevRes = readEpisodeResolution(episodeParams, projectParams)
    const nextRatio = readEpisodeAspectRatio(nextParams, projectParams)
    const nextRes = readEpisodeResolution(nextParams, projectParams)
    if (prevRatio === nextRatio && prevRes === nextRes) return

    const prevLabel = formatProjectOutputLabel(prevRatio, prevRes)
    const nextLabel = formatProjectOutputLabel(nextRatio, nextRes)
    const generatedCount = fragments.filter((frag) => Boolean(frag.video)).length
    const quiet = Boolean(opts?.quiet)

    if (!quiet) {
      const ok = await dialog.confirm({
        title: 'เปลี่ยนสัดส่วนภาพ / ความละเอียด',
        message:
          generatedCount > 0
            ? `เปลี่ยนสัดส่วนตอนปัจจุบันจาก ${prevLabel} เป็น ${nextLabel} ช็อตที่สร้างไปแล้ว ${generatedCount} ช็อตจะไม่อัปเดตอัตโนมัติ ต้องกดสร้างใหม่จึงจะได้ตามสัดส่วนใหม่`
            : `เปลี่ยนสัดส่วนตอนปัจจุบันจาก ${prevLabel} เป็น ${nextLabel} ช็อตที่จะสร้างหลังจากนี้จะใช้สัดส่วนใหม่นี้`,
        confirmText: generatedCount > 0 ? 'บันทึกและสร้างใหม่' : 'บันทึก',
        cancelText: 'ยกเลิก',
        tone: generatedCount > 0 ? 'danger' : 'default',
      })
      if (!ok) return
    }

    const prevParams = episodeParams
    setEpisodeParams(nextParams)
    episodeParamsRef.current = nextParams
    setAspectRatio(nextRatio)
    try {
      const updated = await dramaApi.updateEpisode(eid, { params: nextParams })
      const updatedParams =
        updated.params && typeof updated.params === 'object' && !Array.isArray(updated.params)
          ? (updated.params as Record<string, unknown>)
          : nextParams
      setEpisode(updated)
      setEpisodeParams(updatedParams)
      episodeParamsRef.current = updatedParams
      setAspectRatio(readEpisodeAspectRatio(updatedParams, projectParams))
      if (!quiet) {
        setStatus(
          generatedCount > 0
            ? `อัปเดตสเปกของตอนนี้เป็น ${nextLabel} เรียบร้อยแล้ว กำลังจัดคิวใหม่ตามสเปกใหม่…`
            : `อัปเดตสเปกของตอนนี้เป็น ${nextLabel} เรียบร้อยแล้ว`,
        )
        setError('')
        if (generatedCount > 0) {
          await generateAll({ forceRegen: true, skipConfirm: true })
        }
      } else if (generatedCount > 0) {
        // 模型能力自动钳制：ไม่ปรากฏหน้าต่างยืนยัน、ไม่เข้าคิวใหม่，但คำแนะนำช็อตที่สร้างแล้วต้องด้วยตนเองสร้างใหม่
        setStatus(`ปรับสเปกตามโมเดลปัจจุบันเป็น ${nextLabel} เรียบร้อยแล้ว ช็อตที่สร้างแล้วต้องกดสร้างใหม่จึงจะได้ตามสเปกใหม่`)
      }
    } catch (err) {
      setEpisodeParams(prevParams)
      episodeParamsRef.current = prevParams
      setAspectRatio(readEpisodeAspectRatio(prevParams, projectParams))
      setError(err instanceof Error ? err.message : 'บันทึกสเปกผลลัพธ์ของตอนนี้ไม่สำเร็จ')
      throw err
    }
  }

  // บันทึกถาวร本 ตอนคำบรรยาย (ซับไตเติล)方式，并动态改写ปัจจุบัน分ช็อตที่ 里的คำบรรยาย (ซับไตเติล)คำแนะนำ词
  async function handleEpisodeSubtitleChange(mode: DramaSubtitleMode) {
    if (readOnly) return
    if (mode === subtitleMode) return
    const prevParams = episodeParams
    const prevFragments = fragments
    const nextParams = {
      ...episodeParams,
      subtitleMode: mode,
      subtitleEnabled: subtitleModeUsesModelOutput(mode),
    }
    const nextFragments = applySubtitleModeToFragments(fragments, mode)
    setSubtitleMode(mode)
    setEpisodeParams(nextParams)
    episodeParamsRef.current = nextParams
    setFragments(nextFragments)
    try {
      const updated = await dramaApi.updateEpisode(eid, { params: nextParams })
      const updatedParams =
        updated.params && typeof updated.params === 'object' && !Array.isArray(updated.params)
          ? (updated.params as Record<string, unknown>)
          : nextParams
      setEpisode(updated)
      setEpisodeParams(updatedParams)
      episodeParamsRef.current = updatedParams
      setSubtitleMode(readEffectiveSubtitleMode(updatedParams, projectParamsRef.current))
      const contentChanged = nextFragments.some(
        (frag, index) => frag.content !== prevFragments[index]?.content,
      )
      if (contentChanged) {
        const ep = await dramaApi.saveFragments(
          eid,
          nextFragments.map((f, i) => {
            const prevFragParams =
              f.params && typeof f.params === 'object' && !Array.isArray(f.params)
                ? (f.params as Record<string, unknown>)
                : {}
            return {
              id: typeof f.id === 'number' && f.id > 0 ? f.id : undefined,
              sort_order: i,
              content: f.content,
              cover: f.cover,
              video: f.video,
              duration_sec: resolveFragmentDurationSec(f.content, f.duration_sec),
              params: { ...prevFragParams, user_edited: true },
              asset_ids: f.asset_ids || [],
            }
          }),
        )
        setEpisode(ep)
        setFragments(ep.fragments || nextFragments)
      }
      setStatus(
        mode === 'model'
          ? 'สลับเป็นโมเดลสร้างซับไตเติลโดยตรง และเพิ่มคำสั่งซับไตเติลลงในช็อตเรียบร้อยแล้ว'
          : 'สลับเป็นใส่ซับไตเติลในขั้นตอนตัดต่อภายหลัง และนำคำสั่งซับไตเติลออกจากช็อตเรียบร้อยแล้ว',
      )
      setError('')
    } catch (err) {
      setSubtitleMode(readEffectiveSubtitleMode(prevParams, projectParamsRef.current))
      setEpisodeParams(prevParams)
      episodeParamsRef.current = prevParams
      setFragments(prevFragments)
      setError(err instanceof Error ? err.message : 'บันทึกรูปแบบซับไตเติลของตอนนี้ไม่สำเร็จ')
    }
  }

  // บันทึกถาวร本 ตอนข้อความแนะนำตัวละคร开关，并动态去掉ปัจจุบัน分ช็อตที่ 里的介绍行
  async function handleEpisodeCharacterIntroChange(mode: DramaCharacterIntroMode) {
    if (readOnly) return
    if (mode === characterIntroMode) return
    const prevParams = episodeParams
    const prevFragments = fragments
    const nextParams = {
      ...episodeParams,
      characterIntroMode: mode,
      characterIntroEnabled: characterIntroModeEnabled(mode),
    }
    const nextFragments = applyCharacterIntroModeToFragments(fragments, mode)
    setCharacterIntroMode(mode)
    setEpisodeParams(nextParams)
    episodeParamsRef.current = nextParams
    setFragments(nextFragments)
    try {
      const updated = await dramaApi.updateEpisode(eid, { params: nextParams })
      const updatedParams =
        updated.params && typeof updated.params === 'object' && !Array.isArray(updated.params)
          ? (updated.params as Record<string, unknown>)
          : nextParams
      setEpisode(updated)
      setEpisodeParams(updatedParams)
      episodeParamsRef.current = updatedParams
      setCharacterIntroMode(readEffectiveCharacterIntroMode(updatedParams, projectParamsRef.current))
      const contentChanged = nextFragments.some(
        (frag, index) => frag.content !== prevFragments[index]?.content,
      )
      if (contentChanged) {
        const ep = await dramaApi.saveFragments(
          eid,
          nextFragments.map((f, i) => {
            const prevFragParams =
              f.params && typeof f.params === 'object' && !Array.isArray(f.params)
                ? (f.params as Record<string, unknown>)
                : {}
            return {
              id: typeof f.id === 'number' && f.id > 0 ? f.id : undefined,
              sort_order: i,
              content: f.content,
              cover: f.cover,
              video: f.video,
              duration_sec: resolveFragmentDurationSec(f.content, f.duration_sec),
              params: { ...prevFragParams, user_edited: true },
              asset_ids: f.asset_ids || [],
            }
          }),
        )
        setEpisode(ep)
        setFragments(ep.fragments || nextFragments)
      }
      setStatus(
        mode === 'model'
          ? 'เปิดใช้งานตัวอักษรแนะนำตัวละครแล้ว เมื่อแบ่งสตอรี่บอร์ดใหม่จะใส่ข้อความแนะนำตัวละครให้อัตโนมัติ'
          : 'ปิดการแนะนำตัวละครแล้ว และนำข้อความแนะนำตัวละครออกจากช็อตเรียบร้อยแล้ว',
      )
      setError('')
    } catch (err) {
      setCharacterIntroMode(readEffectiveCharacterIntroMode(prevParams, projectParamsRef.current))
      setEpisodeParams(prevParams)
      episodeParamsRef.current = prevParams
      setFragments(prevFragments)
      setError(err instanceof Error ? err.message : 'บันทึกการตั้งค่าแนะนำตัวละครของตอนนี้ไม่สำเร็จ')
    }
  }

  const referencedIds = useMemo(() => {
    const set = new Set<number>()
    for (const f of fragments) {
      for (const id of extractAssetIds(f.content || '')) set.add(id)
      for (const id of f.asset_ids || []) set.add(id)
    }
    return set
  }, [fragments])

  const filteredAssets = useMemo(
    () => filterEpisodeAssets(assets, assetScope, assetTab, referencedIds),
    [assets, assetScope, assetTab, referencedIds],
  )

  // 应用后端ความคืบหน้าการสร้างและซิงค์สตอรี่บอร์ดสถานะ + ทั่วไป队列
  function applyGenerateStatus(st: Awaited<ReturnType<typeof dramaApi.generateStatus>>) {
    setStatus(`เสร็จสิ้น ${st.done}/${st.total} · กำลังดำเนินการ ${st.running} · ล้มเหลว ${st.failed}`)
    const byId = new Map(st.fragments.map((f) => [f.fragment_id, f.status]))
    setFragments((prev) => {
      const next = prev.map((f) => {
        if (!f.id) return f
        const genStatus = byId.get(f.id)
        if (!genStatus) return f
        const item = st.fragments.find((x) => x.fragment_id === f.id) as
          | {
              fragment_id: number
              status: string
              video?: string
              cover?: string
              message?: string
              phase?: string
              error?: string
            }
          | undefined
        return {
          ...f,
          video: item?.video || f.video,
          cover: item?.cover || f.cover,
          params: {
            ...(f.params || {}),
            generation: {
              status: genStatus,
              video: item?.video,
              cover: item?.cover,
              message: item?.message,
              phase: item?.phase,
              error: item?.error,
            },
          },
        }
      })
      syncEpisodeVideoJobs({
        projectId: pid,
        episodeId: eid,
        episodeName: episode?.name,
        fragments: next.map((f) => ({
          id: f.id,
          sort_order: f.sort_order,
          content: f.content,
        })),
        statusItems: st.fragments.map((f) => {
          const row = f as {
            fragment_id: number
            status: string
            message?: string
            phase?: string
            error?: string
            video?: string
            cover?: string
          }
          return {
            fragment_id: row.fragment_id,
            status: row.status,
            message: row.message,
            phase: row.phase,
            error: row.error,
            video: row.video,
            cover: row.cover,
          }
        }),
        taskItems: st.tasks,
      })
      return next
    })
    return st
  }

  applyStatusRef.current = applyGenerateStatus

  // 进页检查是否有进行中的生成任务或 AI 分ช็อตที่ 
  async function resumeGenerateIfNeeded() {
    let resumingPlan = false
    try {
      const ep = await dramaApi.getEpisode(eid)
      if (readFragmentPlanStatus(ep) === 'generating') {
        resumingPlan = true
        setPlanning(true)
        setBusy(true)
        setStatus('AI กำลังวางแผนสตอรี่บอร์ด · กำลังรอผลลัพธ์จากโมเดลข้อความ…')
        const started = Date.now()
        while (Date.now() - started < 10 * 60 * 1000) {
          await new Promise((r) => setTimeout(r, 2500))
          const cur = await dramaApi.getEpisode(eid)
          const st = readFragmentPlanStatus(cur)
          if (st === 'completed') {
            setEpisode(cur)
            setFragments(cur.fragments || [])
            setSelectedIndex(0)
            setStatus(`แบ่งสตอรี่บอร์ดเสร็จสิ้น · ${(cur.fragments || []).length} ช็อต`)
            setBusy(false)
            return
          }
          if (st === 'failed') {
            setError(String(cur.params?.fragment_plan_error || 'AI แบ่งสตอรี่บอร์ดล้มเหลว'))
            setBusy(false)
            return
          }
          setStatus('AI กำลังวางแผนสตอรี่บอร์ด · กำลังรอผลลัพธ์จากโมเดลข้อความ…')
        }
        setBusy(false)
        return
      }
      const st = applyGenerateStatus(await dramaApi.generateStatus(eid))
      if (st.running > 0) ensureEpisodeVideoStatusPoll()
    } catch {
      /* ignore */
    } finally {
      if (resumingPlan) { setPlanning(false); setBusy(false) }
    }
  }

  // 打开全屏分ช็อตที่ 故事板แคนวาส
  function openEpisodeStoryboard() {
    navigate(`/drama/projects/${pid}/episodes/${eid}/canvas`)
  }

  // โหลดใหม่分 ตอน
  async function reload() {
    const ep = await dramaApi.getEpisode(eid)
    setEpisode(ep)
    const epParams =
      ep.params && typeof ep.params === 'object' && !Array.isArray(ep.params)
        ? (ep.params as Record<string, unknown>)
        : {}
    setEpisodeParams(epParams)
    episodeParamsRef.current = epParams
    setSubtitleMode(readEffectiveSubtitleMode(epParams, projectParamsRef.current))
    setCharacterIntroMode(readEffectiveCharacterIntroMode(epParams, projectParamsRef.current))
    setAspectRatio(readEpisodeAspectRatio(epParams, projectParamsRef.current))
    setFragments(ep.fragments || [])
    if ((ep.fragments || []).length === 0) {
      setFragments([
        {
          id: 0,
          episode_id: eid,
          sort_order: 0,
          content: '',
          cover: '',
          video: '',
          duration_sec: 8,
          asset_ids: [],
        },
      ])
    }
    await resumeGenerateIfNeeded()
  }

  reloadRef.current = reload

  // นำกลับมาใช้ใหม่ทั่วไป generate_status 轮询，หลีกเลี่ยงจาก dramaGenQueue คำขออีกครั้ง
  useEffect(() => {
    return subscribeEpisodeGenerateStatus(async (episodeId, st) => {
      if (episodeId !== eid) return
      const result = applyStatusRef.current(st)
      if (result.running === 0) {
        await reloadRef.current()
      }
    })
  }, [eid])

  // 切换分ช็อตที่ 时退出เวอร์ชันก่อนหน้าดูตัวอย่าง
  useEffect(() => {
    setPreviewVersionId(null)
  }, [selectedIndex, selected?.id])

  useEffect(() => {
    if (!eid || !pid) return
    setBusy(false)
    setStatus('')
    setError('')
    reload().catch((err) => setError(err instanceof Error ? err.message : 'โหลดไม่สำเร็จ'))
    dramaApi
      .listAssets(pid)
      .then(setAssets)
      .catch(() => setAssets([]))
    dramaApi
      .listEpisodes(pid)
      .then((rows) => setEpisodeList(rows))
      .catch(() => setEpisodeList([]))
    // 加载โปรเจกต์ค่าเริ่มต้นสไตล์ภาพ / การเชื่อมต่อระหว่างช็อต等到顶栏
    dramaApi
      .getProject(pid)
      .then((project) => {
        const styleId = getImageStyleId(project.script, project)
        if (styleId) setVideoStyleId(styleId as ImageStyleId)
        const params =
          project.params && typeof project.params === 'object' && !Array.isArray(project.params)
            ? (project.params as Record<string, unknown>)
            : {}
        setProjectParams(params)
        projectParamsRef.current = params
        const linkRaw = params.linkLastFrame ?? params.link_last_frame
        setLinkLastFrame(coerceProjectBool(linkRaw, true))
        setSubtitleMode(readEffectiveSubtitleMode(episodeParamsRef.current, params))
        setCharacterIntroMode(readEffectiveCharacterIntroMode(episodeParamsRef.current, params))
        setAspectRatio(readEpisodeAspectRatio(episodeParamsRef.current, params))
      })
      .catch(() => {
        /* ignore */
      })
  }, [eid, pid])

  // อัปเดตปัจจุบัน分ช็อตที่ 
  function updateSelected(patch: Partial<DramaFragment>) {
    if (readOnly) return
    setFragments((prev) =>
      prev.map((f, i) => (i === selectedIndex ? { ...f, ...patch } : f)),
    )
  }

  // แทรกช็อตเปล่า
  function insertFrag(at: number) {
    if (readOnly) return
    setFragments((prev) => {
      const next = [...prev]
      next.splice(at, 0, {
        id: 0,
        episode_id: eid,
        sort_order: at,
        content: '',
        cover: '',
        video: '',
        duration_sec: 8,
        asset_ids: [],
      })
      return next
    })
    setSelectedIndex(at)
    setEditing(true)
  }

  // คัดลอก分ช็อตที่ 
  function duplicateFrag(index: number) {
    if (readOnly) return
    const source = fragments[index]
    if (!source) return
    setFragments((prev) => {
      const next = [...prev]
      next.splice(index + 1, 0, {
        ...source,
        id: 0,
        sort_order: index + 1,
      })
      return next
    })
    setSelectedIndex(index + 1)
  }

  // ลบสตอรี่บอร์ด
  function deleteFrag(index: number) {
    if (readOnly) return
    if (fragments.length <= 1) return
    setFragments((prev) => prev.filter((_, i) => i !== index))
    setSelectedIndex((cur) => {
      if (cur === index) return Math.max(0, index - 1)
      if (cur > index) return cur - 1
      return cur
    })
  }

  // บันทึกทั้งหมด分ช็อตที่ （带 id อัปเดต，หลีกเลี่ยงการสร้างใหม่ทุกครั้ง id ขัดจังหวะการสร้างที่กำลังดำเนิน；ทำเครื่องหมาย user_edited 防自动重切覆盖）
  async function save() {
    if (readOnly) throw new Error('ขณะนี้อยู่ในโหมดอ่านอย่างเดียว ไม่สามารถบันทึกสตอรี่บอร์ดได้')
    setBusy(true)
    setError('')
    try {
      const ep = await dramaApi.saveFragments(
        eid,
        fragments.map((f, i) => {
          const prevParams =
            f.params && typeof f.params === 'object' && !Array.isArray(f.params)
              ? (f.params as Record<string, unknown>)
              : {}
          return {
            id: typeof f.id === 'number' && f.id > 0 ? f.id : undefined,
            sort_order: i,
            content: f.content,
            cover: f.cover,
            video: f.video,
            duration_sec: resolveFragmentDurationSec(f.content, f.duration_sec),
            params: { ...prevParams, user_edited: true },
            asset_ids: f.asset_ids || [],
          }
        }),
      )
      setEpisode(ep)
      setFragments(ep.fragments || [])
      setStatus('บันทึกเรียบร้อยแล้ว')
      setEditing(false)
      return ep
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ')
      throw err
    } finally {
      setBusy(false)
    }
  }

  // 判断「สร้างพร้อมกัน」时是否可安全跳过：仅跳过未改动且已有成片的旧分ช็อตที่ 
  function shouldSkipGenerateAllFragment(frag: DramaFragment): boolean {
    if (!frag.video || !frag.id) return false
    const prev = (episode?.fragments || []).find((item) => item.id === frag.id)
    if (!prev?.video) return false
    const sameContent = (prev.content || '') === (frag.content || '')
    const sameCover = (prev.cover || '') === (frag.cover || '')
    const sameDuration =
      resolveFragmentDurationSec(prev.content || '', prev.duration_sec) ===
      resolveFragmentDurationSec(frag.content || '', frag.duration_sec)
    const prevAssetIds = [...(prev.asset_ids || [])].sort((a, b) => a - b)
    const nextAssetIds = [...(frag.asset_ids || [])].sort((a, b) => a - b)
    const sameAssets =
      prevAssetIds.length === nextAssetIds.length &&
      prevAssetIds.every((id, index) => id === nextAssetIds[index])
    return sameContent && sameCover && sameDuration && sameAssets
  }

  // สร้างเฉพาะสตอรี่บอร์ดที่เลือกปัจจุบัน（บันทึก按 id อัปเดต，生成前仍用บันทึก后กลับ的 id）
  async function generateSelected() {
    if (readOnly) return
    if (!selected) {
      setError('กรุณาเลือกช็อตก่อน')
      return
    }
    if (selectedGenerateLocked) {
      if (selectedGateBlocking.length > 0) {
        setError(selectedGateBlocking.map((i) => i.message).join('；'))
        await dialog.alert({
          title: 'ไม่สามารถสร้างได้',
          message: formatDramaGateMessage(
            selectedGateBlocking,
            [],
            'กรุณาสร้างหรืออัปโหลดภาพอ้างอิงสำหรับตัวละคร ฉาก หรือพร็อพที่เกี่ยวข้องก่อน',
          ),
        })
      } else if (continuityBlockedReason) {
        setError(continuityBlockedReason)
        await dialog.alert({
          title: 'ไม่สามารถสร้างได้',
          message: `${continuityBlockedReason} เมื่อเปิด «เชื่อมต่อเฟรมท้าย» ต้องสร้างช็อตก่อนหน้าให้เสร็จก่อน จึงจะสร้างช็อตนี้ตามลำดับได้`, 
        })
      } else if (selectedIsGenerating) {
        setError('ช็อตปัจจุบันกำลังสร้างอยู่ กรุณารอให้เสร็จสิ้นก่อนลองอีกครั้ง')
      } else {
        setError('กรุณารอให้การดำเนินการปัจจุบันเสร็จสิ้นก่อนลองอีกครั้ง')
      }
      return
    }

    const { blocking, warnings } = collectDramaGenerateGateIssues(selected, assets)
    if (blocking.length > 0) {
      setError(blocking.map((i) => i.message).join('；'))
      await dialog.alert({
        title: 'ไม่สามารถสร้างได้',
        message: formatDramaGateMessage(blocking, warnings, 'กรุณาแก้ไขบทตามกฎก่อนแล้วลองใหม่อีกครั้ง'),
      })
      return
    }

    const fragLabel = formatFragLabel(selectedIndex, selectedDuration)
    const isRegen = Boolean(selected.video)
    const ok = await dialog.confirm({
      title: isRegen ? 'สร้างวิดีโอสตอรี่บอร์ดใหม่' : 'สร้างวิดีโอสตอรี่บอร์ด',
      message: formatDramaGateMessage(
        [],
        warnings,
        isRegen
          ? `จะบันทึกและสร้างใหม่ «${fragLabel}» วิดีโอปัจจุบันจะถูกเก็บไว้เป็นเวอร์ชันก่อนหน้า หลังเข้าคิวสามารถดูความคืบหน้าที่คิวมุมขวาล่างได้`
          : linkLastFrame
            ? continuityQueueHint
              ? `จะบันทึก «${fragLabel}» และส่งเข้าคิว ${continuityQueueHint}`
              : `จะบันทึกและสร้างตามลำดับช็อต «${fragLabel}» หลังเข้าคิวสามารถแก้ไขบทต่อได้ ช็อตนี้จะใช้เฟรมท้ายของช็อตก่อนหน้าเป็นภาพอ้างอิงการเชื่อมต่อ`
            : `จะบันทึกและสร้าง «${fragLabel}» หลังเข้าคิวสามารถแก้ไขบทต่อได้ ช็อตนี้จะสร้างแบบอิสระเนื่องจากไม่ได้เปิดการเชื่อมต่อเฟรมท้าย`, 
      ),
      confirmText: warnings.length > 0 ? 'ยืนยันสร้างต่อ' : isRegen ? 'สร้างใหม่' : 'เริ่มสร้าง',
    })
    if (!ok) return
    setBusy(true)
    setError('')
    setStatus(isRegen ? 'บันทึกและส่งเข้าคิวสร้างใหม่…' : 'บันทึกและส่งเข้าคิวสร้างสตอรี่บอร์ดปัจจุบัน…')
    try {
      const ep = await save()
      setBusy(true)
      const frag = (ep.fragments || [])[selectedIndex]
      if (!frag?.id) {
        throw new Error('บันทึกแล้วแต่ไม่พบสตอรี่บอร์ดปัจจุบัน กรุณารีเฟรชแล้วลองใหม่อีกครั้ง')
      }
      await dramaApi.generateEpisode(eid, [frag.id], modelId)
      // 乐观เขียนลงไป排队态，避免旧 video 把สถานะ盖成เสร็จสมบูรณ์
      setFragments((prev) =>
        prev.map((f) =>
          f.id === frag.id
            ? {
                ...f,
                params: {
                  ...(f.params || {}),
                  generation: { status: 'queued', message: 'เข้าคิวแล้ว' },
                },
              }
            : f,
        ),
      )
      enqueueEpisodeVideoJobs({
        projectId: pid,
        episodeId: eid,
        episodeName: ep.name || episode?.name,
        fragments: (ep.fragments || []).map((f, i) => ({
          id: f.id,
          sort_order: f.sort_order ?? i,
        })),
        fragmentIds: [frag.id],
      })
      setBusy(false)
      setStatus(isRegen ? `«${fragLabel}» เข้าคิวสร้างใหม่เรียบร้อยแล้ว สามารถดูคิวได้ที่มุมขวาล่าง` : `«${fragLabel}» เข้าคิวเรียบร้อยแล้ว สามารถดูคิวได้ที่มุมขวาล่าง`)
      ensureEpisodeVideoStatusPoll()
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : 'สร้างไม่สำเร็จ')
    }
  }

  // สลับสินค้าประวัติเป็นปัจจุบันดูตัวอย่างวิดีโอ
  async function activateVideoVersion(versionId: string) {
    if (readOnly) return
    if (!selected?.id || selectedIsGenerating) return
    const ok = await dialog.confirm({
      title: 'สลับเวอร์ชันประวัติ',
      message: 'จะนำวิดีโอเวอร์ชันก่อนหน้านี้มาแสดงแทนวิดีโอปัจจุบัน วิดีโอปัจจุบันจะถูกย้ายไปอยู่ในรายการเวอร์ชันก่อนหน้า',
      confirmText: 'สลับ',
    })
    if (!ok) return
    setBusy(true)
    setError('')
    try {
      const result = await dramaApi.activateFragmentVideoVersion(selected.id, versionId)
      setFragments((prev) =>
        prev.map((f) =>
          f.id === selected.id
            ? {
                ...f,
                video: result.video,
                cover: result.cover || '',
                params: {
                  ...(f.params || {}),
                  video_versions: result.video_versions,
                  lastFrameUrl: result.lastFrameUrl || undefined,
                  generation: {
                    status: 'done',
                    video: result.video,
                    cover: result.cover,
                    lastFrameUrl: result.lastFrameUrl,
                  },
                },
              }
            : f,
        ),
      )
      setPreviewVersionId(null)
      setStatus('สลับเวอร์ชันประวัติเรียบร้อยแล้ว')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'สลับเวอร์ชันล้มเหลว')
    } finally {
      setBusy(false)
    }
  }

  // สร้างพร้อมกัน：入队本 ตอน分ช็อตที่ （forceRegen เขียนทับผลลัพธ์ที่มีอยู่；入口仅 MiniMax-H3）
  async function generateAll(opts?: { forceRegen?: boolean; skipConfirm?: boolean }) {
    if (readOnly) return
    if (fragments.length === 0) {
      setError('ไม่มีช็อตที่สามารถสร้างได้')
      return
    }
    if (generateAllLocked) {
      setError('กำลังส่งข้อมูล กรุณารอสักครู่')
      return
    }

    const allBlocking: string[] = []
    const allWarnings: string[] = []
    const doneIndices: number[] = []
    for (let i = 0; i < fragments.length; i++) {
      if (!opts?.forceRegen && shouldSkipGenerateAllFragment(fragments[i])) {
        doneIndices.push(i)
        continue
      }
      const { blocking, warnings } = collectDramaGenerateGateIssues(fragments[i], assets)
      const label = formatFragLabel(i, fragments[i]?.duration_sec)
      for (const issue of blocking) allBlocking.push(`${label}：${issue.message}`)
      for (const issue of warnings) allWarnings.push(`${label}：${issue.message}`)
    }
    const pendingCount = fragments.length - doneIndices.length
    if (pendingCount <= 0) {
      setStatus('ช็อตทั้งหมดในตอนนี้สร้างเสร็จแล้ว ระบบจึงข้ามโดยอัตโนมัติ')
      return
    }
    if (allBlocking.length > 0) {
      setError(allBlocking[0] || 'บทสตอรี่บอร์ดการตรวจสอบไม่ผ่าน')
      await dialog.alert({
        title: 'ไม่สามารถสร้างพร้อมกันได้',
        message: ['กรุณาแก้ไขปัญหาต่อไปนี้ก่อน:', '', ...allBlocking.slice(0, 8).map((m) => `· ${m}`)].join(
          '\n',
        ),
      })
      return
    }

    if (!opts?.skipConfirm) {
      const ok = await dialog.confirm({
        title: opts?.forceRegen ? 'สร้างใหม่ตามสเปกใหม่' : 'สร้างวิดีโอสตอรี่บอร์ดพร้อมกัน',
        message: formatDramaGateMessage(
          [],
          allWarnings.slice(0, 8).map((message) => ({ level: 'warn' as const, message })),
          opts?.forceRegen
            ? `จะสร้างใหม่ ${pendingCount} ช็อตตามสัดส่วนภาพและความละเอียดปัจจุบัน วิดีโอปัจจุบันจะถูกเก็บไว้เป็นเวอร์ชันก่อนหน้า`
            : linkLastFrame
              ? `จะสร้าง ${pendingCount} ช็อตที่เหลือตามลำดับ (ข้าม ${doneIndices.length} ช็อตที่สร้างเสร็จแล้ว) สามารถแก้ไขบทต่อได้หลังเข้าคิว ช็อตถัดไปจะรอจนกว่าเฟรมท้ายของช็อตก่อนหน้าจะพร้อม`
              : `จะสร้าง ${pendingCount} ช็อตที่เหลือพร้อมกัน (ข้าม ${doneIndices.length} ช็อตที่สร้างเสร็จแล้ว) สามารถแก้ไขบทต่อได้หลังเข้าคิว แต่ละช็อตจะสร้างเป็นอิสระต่อกัน`, 
        ),
        confirmText: allWarnings.length > 0 ? 'ยืนยันสร้างพร้อมกัน' : opts?.forceRegen ? 'สร้างใหม่ทั้งหมด' : 'สร้างพร้อมกัน',
        tone: 'danger',
      })
      if (!ok) return
    }
    setBusy(true)
    setError('')
    setStatus(`บันทึกและส่งเข้าคิวสร้าง ${pendingCount} ช็อตที่เหลือ…`)
    try {
      const ep = await save()
      setBusy(true)
      const ids = (ep.fragments || [])
        .filter((_, index) => !doneIndices.includes(index))
        .map((f) => f.id)
        .filter((id): id is number => typeof id === 'number' && id > 0)
      if (ids.length === 0) {
        setStatus('บันทึกแล้วพบว่าทุกช็อตสร้างเสร็จสิ้นแล้ว จึงข้ามโดยอัตโนมัติ')
        setBusy(false)
        return
      }
      const genResult = await dramaApi.generateEpisode(eid, ids, modelId)
      const queuedIds =
        Array.isArray(genResult.fragment_ids) && genResult.fragment_ids.length > 0
          ? genResult.fragment_ids
          : ids
      enqueueEpisodeVideoJobs({
        projectId: pid,
        episodeId: eid,
        episodeName: ep.name || episode?.name,
        fragments: (ep.fragments || []).map((f, i) => ({
          id: f.id,
          sort_order: f.sort_order ?? i,
        })),
        fragmentIds: queuedIds,
      })
      const deferred = Number(genResult.deferred_count || 0)
      const limit = Number(genResult.user_job_limit || 0)
      if (deferred > 0 && limit > 0) {
        setStatus(
          `เข้าคิวแล้ว ${queuedIds.length} ช็อต: สร้างพร้อมกันได้สูงสุด ${limit} ช็อต และมีอีก ${deferred} ช็อตกำลังรอคิว`,
        )
      } else {
        setStatus(`ส่งเข้าคิวแล้ว ${queuedIds.length} ช็อต กำลังสร้าง…`)
      }
      setBusy(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'สร้างพร้อมกันล้มเหลว')
      setBusy(false)
    }
  }

  // กลับโครงเรื่องหลัก
  function handleBack() {
    navigate(`/drama/projects/${pid}`, { state: { activeStep: 'outline' } })
  }

  // 左侧目录切换分 ตอน
  function handleSelectEpisode(nextId: number) {
    if (nextId === eid) return
    navigate(`/drama/projects/${pid}/episodes/${nextId}`)
  }

  // 单 ตอน LLM แบ่งสตอรี่บอร์ดใหม่：确认并勾选 Skill หลังเข้าคิว
  function planFragmentsWithLlm() {
    if (readOnly) return
    if (planFragmentsLocked) {
      setError('ขณะนี้มีงานสร้างวิดีโอกำลังดำเนินอยู่ กรุณารอสักครู่ก่อนแบ่งสตอรี่บอร์ดใหม่')
      return
    }
    setPlanModalOpen(true)
  }

  // 文字 LLM 立即执行，页面轮询规划进度（คำบรรยาย (ซับไตเติล)วิธีการใช้ปัจจุบันของแถบด้านบนตั้งค่า）。
  async function startPlanFragments(skillIds: number[]) {
    if (readOnly) return
    setPlanModalOpen(false)
    setBusy(true)
    setPlanning(true)
    setError('')
    setStatus('AI กำลังวางแผนสตอรี่บอร์ด · กำลังรอผลลัพธ์จากโมเดลข้อความ…')
    try {
      await dramaApi.planEpisodeFragments(eid, {
        force: true,
        fallback_rules: true,
        skill_ids: skillIds,
        subtitle_enabled: subtitleModeUsesModelOutput(subtitleMode),
      })
      const started = Date.now()
      while (Date.now() - started < 10 * 60 * 1000) {
        await new Promise((r) => setTimeout(r, 2500))
        const ep = await dramaApi.getEpisode(eid)
        const st = readFragmentPlanStatus(ep)
        if (st === 'completed') {
          setEpisode(ep)
          const nextParams = (ep.params as Record<string, unknown>) || {}
          setEpisodeParams(nextParams)
          episodeParamsRef.current = nextParams
          setFragments(ep.fragments || [])
          setSelectedIndex(0)
          setEditing(false)
          const mode = String(ep.params?.fragment_plan_mode || 'llm')
          const count = Number(ep.params?.fragment_plan_count) || (ep.fragments || []).length
          setStatus(
            mode === 'rules_fallback'
              ? `แบ่งสตอรี่บอร์ดเสร็จสิ้น (โมเดลล้มเหลวจึงใช้การแบ่งตามกฎแทน) · ${count} ช็อต`
              : `แบ่งสตอรี่บอร์ดเสร็จสิ้น · ${count} ช็อต`, 
          )
          setBusy(false)
          return
        }
        if (st === 'failed') {
          const msg = String(ep.params?.fragment_plan_error || 'AI แบ่งสตอรี่บอร์ดล้มเหลว')
          setError(msg)
          setBusy(false)
          return
        }
        setStatus('AI กำลังวางแผนสตอรี่บอร์ด · กำลังรอผลลัพธ์จากโมเดลข้อความ…')
      }
      throw new Error('AI แบ่งสตอรี่บอร์ดเกินเวลาที่กำหนด กรุณารีเฟรชเพื่อตรวจสอบอีกครั้งในภายหลัง')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI แบ่งสตอรี่บอร์ดล้มเหลว')
      setBusy(false)
    } finally {
      setPlanning(false)
      setBusy(false)
    }
  }

  // 点击แอสเซท插入 @ 引用
  function mentionAsset(asset: DramaAsset) {
    if (readOnly) return
    if (!selected) return
    const mention = `@asset:${asset.id}`
    const raw = selected.content || ''
    const already = new RegExp(`@asset:${asset.id}(?!\\d)`).test(raw)
    const content = already ? raw : raw ? `${raw.trimEnd()}\n${mention}` : mention
    const ids = Array.from(new Set([...(selected.asset_ids || []), asset.id]))
    updateSelected({ content, asset_ids: ids })
    setEditing(true)
  }

  // แยกวิเคราะห์侧栏ปัจจุบัน要สร้างใหม่的แอสเซทประเภท（เมื่อไม่ได้เลือกหมวดหมู่ค่าเริ่มต้นตัวละคร）
  function resolveCreateAssetTab(): AssetTab {
    return assetTab || 'character'
  }

  // สร้างใหม่แล้วติดตั้งไปยังสตอรี่บอร์ดปัจจุบันและเปิดรายละเอียด，便于本 ตอนรายชื่อสามารถมองเห็นได้ทันที
  function adoptCreatedAsset(created: DramaAsset, kind: AssetTab) {
    setAssets((prev) => (prev.some((a) => a.id === created.id) ? prev : [...prev, created]))
    setAssetTab(kind)
    mentionAsset(created)
    if ((created.type || '').toLowerCase() !== 'voice') {
      setDetailAsset(created)
    }
  }

  // กำหนดเองสร้างใหม่ตัวละคร / ฉาก / อุปกรณ์/พร็อพ
  async function handleCreateSideAsset() {
    if (readOnly) return
    const kind = resolveCreateAssetTab()
    const label = kind === 'scene' ? 'ฉาก' : kind === 'prop' ? 'อุปกรณ์/พร็อพ' : 'ตัวละคร'
    const name = await dialog.prompt({
      title: `สร้างใหม่${label}`,
      message: `กรอกชื่อ${label} หลังจากสร้างจะแทรกลงในช็อตปัจจุบันทันที และสามารถสร้างรูปภาพหรืออัปโหลดภาพต่อได้`, 
      placeholder: kind === 'scene' ? 'เช่น: สวนอุทยานหลวง' : kind === 'prop' ? 'เช่น: ป้ายหยก' : 'เช่น: มังกรขาว', 
      confirmText: 'สร้าง',
    })
    if (!name?.trim()) return
    setAssetCreateBusy(true)
    setError('')
    try {
      const created = await dramaApi.createAsset({
        project_id: pid,
        type: kind,
        asset_type: 'image',
        name: name.trim(),
        params: { kind },
      })
      adoptCreatedAsset(created, kind)
      setStatus(`สร้าง${label} «${created.name}» และแทรกลงในช็อตปัจจุบันเรียบร้อยแล้ว`)
    } catch (err) {
      setError(err instanceof Error ? err.message : `สร้าง${label}ล้มเหลว`)
    } finally {
      setAssetCreateBusy(false)
    }
  }

  // 从ทั่วไปแอสเซทนำเข้าไลบรารีไปยังเครื่องนี้โปรเจกต์และเชื่อมต่อกับช็อตปัจจุบัน
  async function handleImportSideAsset(source: DramaAsset) {
    if (readOnly) return
    const kind = normalizeAssetTab(source.type) || resolveCreateAssetTab()
    setAssetCreateBusy(true)
    setError('')
    try {
      const created = await importGlobalAssetToProject(pid, source)
      adoptCreatedAsset(created, kind)
      setLibraryPickerOpen(false)
      setStatus(`นำเข้า «${created.name}» และแทรกลงในช็อตปัจจุบันเรียบร้อยแล้ว`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'นำเข้าแอสเซทล้มเหลว')
      throw err
    } finally {
      setAssetCreateBusy(false)
    }
  }

  // 仅ยกเลิกช็อตปัจจุบันต่อแอสเซท的关联（不ลบโปรเจกต์แอสเซท）
  function unlinkSelectedAsset(assetId: number) {
    if (readOnly) return
    if (!selected) return
    const content = (selected.content || '')
      .replace(new RegExp(`\\s*@asset:${assetId}(?!\\d)`, 'g'), ' ')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    const asset_ids = (selected.asset_ids || []).filter((id) => id !== assetId)
    updateSelected({ content, asset_ids })
    setEditing(true)
    const name = assets.find((a) => a.id === assetId)?.name
    setStatus(
      name
        ? `ยกเลิกการเชื่อมโยงช็อตนี้กับ «${name}» แล้ว แอสเซทยังคงอยู่ในโปรเจกต์ (สลับไปที่ «ทุกตอน» เพื่อดูได้)`
        : 'ยกเลิกการเชื่อมโยงกับช็อตนี้แล้ว แอสเซทยังคงอยู่ในโปรเจกต์ (สลับไปที่ «ทุกตอน» เพื่อดูได้)', 
    )
  }

  // 从关联条跳到对应分类并打开รายละเอียดแอสเซท
  function focusLinkedAsset(assetId: number) {
    const asset = assets.find((a) => a.id === assetId)
    if (!asset) return
    const tab = normalizeAssetTab(asset.type)
    if (tab) setAssetTab(tab)
    setAssetScope('series')
    if ((asset.type || '').toLowerCase() !== 'voice') {
      setDetailAsset(asset)
    }
  }

  // อัปเดตแอสเซท（น้ำเสียง绑定 / อัปโหลด / หลังสร้างรูปรีเฟรชรายการและรายละเอียด）
  function handleCharacterUpdated(updated: DramaAsset) {
    setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
    setDetailAsset((prev) => (prev?.id === updated.id ? updated : prev))
  }

  // ปัจจุบัน排队/กำลังสร้าง的แอสเซท生图 id
  const imageBusyIds = useMemo(() => {
    const ids = new Set<number>()
    for (const job of imageGenQueue) {
      if (job.status === 'queued' || job.status === 'running') ids.add(job.assetId)
    }
    return ids
  }, [imageGenQueue])

  // รายละเอียดข้อความปุ่มสร้างภาพในป๊อปอัป
  function assetImageGenLabel(asset: DramaAsset): string {
    const job = imageGenQueue.find(
      (j) =>
        j.assetId === asset.id && (j.status === 'queued' || j.status === 'running'),
    )
    let queueLabel: string | null = null
    if (job) {
      if (job.status === 'running') queueLabel = 'กำลังสร้าง…'
      else {
        const queuedOnly = imageGenQueue.filter(
          (j) => j.status === 'queued' || j.status === 'running',
        )
        const pos = queuedOnly.findIndex((j) => j.id === job.id) + 1
        queueLabel = pos > 1 ? `คิวที่ #${pos}` : 'กำลังรอคิว…'
      }
    }
    return dramaAssetImageGenButtonLabel(asset, queueLabel)
  }

  // 将แอสเซท生图เพิ่มเข้าทั่วไป队列
  function enqueueAssetImage(asset: DramaAsset) {
    if (readOnly) return
    if (imageBusyIds.has(asset.id)) return
    const options = {
      ...defaultOptionsForAssetKind(asset.type),
      image_style_id: videoStyleId || undefined,
    }
    void enqueueDramaImageGen({
      projectId: pid,
      assetId: asset.id,
      assetName: asset.name || undefined,
      assetType: asset.type,
      prompt: readVisualPrompt(asset),
      options,
      onAssetUpdate: handleCharacterUpdated,
    })
      .then((updated) => handleCharacterUpdated(updated))
      .catch((err) => setError(err instanceof Error ? err.message : 'สร้างภาพไม่สำเร็จ'))
  }

  // 打开分ช็อตที่ ล้มเหลวเหตุผล（งานคิวลำดับความสำคัญ，否则用分ช็อตที่  params.generation.error）
  function openFragmentFailReason(frag: DramaFragment, index: number) {
    if (!frag.id) return
    const fromQueue = dramaGenQueue.find(
      (j) => j.id === videoJobId(frag.id!) || (j.kind === 'video' && j.targetId === frag.id),
    )
    const gen = readFragmentGenerationStatus(frag)
    const title = `${episode?.name || 'ตอนนี้'} · ${formatFragLabel(index, frag.duration_sec)}`
    setFailReasonJob({
      id: fromQueue?.id || videoJobId(frag.id),
      kind: 'video',
      projectId: pid,
      targetId: frag.id,
      episodeId: eid || undefined,
      taskId: fromQueue?.taskId,
      title: fromQueue?.title || title,
      subtype: 'วิดีโอสตอรี่บอร์ด',
      status: 'failed',
      error: fromQueue?.error || gen.error || 'สร้างไม่สำเร็จ',
      createdAt: fromQueue?.createdAt || Date.now(),
    })
  }

  // 一键 AI 生成ตัวละครน้ำเสียงและผูกมัด（各ตัวละครอิสระ busy，互不阻塞）
  async function handleGenerateCharacterVoice(asset: DramaAsset) {
    if (readOnly) return
    if (characterVoiceBusyIds.has(asset.id)) return
    setCharacterVoiceBusyIds((prev) => new Set(prev).add(asset.id))
    setError('')
    try {
      const { character, voice } = await generateAndBindCharacterVoice(pid, asset)
      handleCharacterUpdated(character)
      setAssets((prev) => (prev.some((a) => a.id === voice.id) ? prev : [...prev, voice]))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'น้ำเสียงสร้างไม่สำเร็จ')
    } finally {
      setCharacterVoiceBusyIds((prev) => {
        const next = new Set(prev)
        next.delete(asset.id)
        return next
      })
    }
  }

  if (!episode) {
    return (
      <div className="drama-ep-fullscreen drama-ep-center">
        {error || 'กำลังโหลด…'}
      </div>
    )
  }

  // ปัจจุบันดูตัวอย่าง/选中分ช็อตที่  id（พร้อมกับแถบช็อตด้านล่าง、สคริปต์แก้ไข联动）
  const playingFragmentId = selected?.id ?? null

  // 切换ดูตัวอย่าง分ช็อตที่ 时同步底部分ช็อตที่ 选中态
  function handlePlayingFragmentChange(fragmentId: number) {
    const index = fragments.findIndex((f) => f.id === fragmentId)
    if (index >= 0) {
      setSelectedIndex(index)
    }
  }

  return (
    <div className="drama-ep-fullscreen">
      <header className="drama-ep-header">
        <div className="drama-ep-header-left">
          <button type="button" className="drama-ep-icon-btn" aria-label="กลับ" onClick={handleBack}>
            ‹
          </button>
          <h1>{episode.name}</h1>
        </div>
        <div className="drama-ep-header-controls">
          <button
            type="button"
            className="drama-ep-btn-ghost"
            onClick={openEpisodeStoryboard}
          >
            เข้าสู่แคนวาส
          </button>
          <EpisodeEditHeaderControls
            styleId={videoStyleId}
            modelId={modelId}
            episodeParams={episodeParams}
            projectParams={projectParams}
            linkLastFrame={linkLastFrame}
            subtitleMode={subtitleMode}
            characterIntroMode={characterIntroMode}
            onStyleChange={setVideoStyleId}
            onModelChange={setModelId}
            onEpisodeOutputChange={handleEpisodeOutputChange}
            onLinkLastFrameChange={(enabled) => void handleLinkLastFrameChange(enabled)}
            onSubtitleModeChange={(mode) => void handleEpisodeSubtitleChange(mode)}
            onCharacterIntroModeChange={(mode) => void handleEpisodeCharacterIntroChange(mode)}
            disabled={readOnly || busy}
            globalSettingsReadOnly
          />
          <button
            type="button"
            className="drama-ep-btn-ghost"
            disabled={planFragmentsLocked}
            onClick={() => void planFragmentsWithLlm()}
          >
            {planning
              ? 'AI ในสตอรี่บอร์ด…'
              : 'AI แบ่งสตอรี่บอร์ดใหม่'}
          </button>
          {/* MiniMax-H3 รองรับการส่งทุกช็อตที่เหลือในตอนนี้เข้าคิวในครั้งเดียว โมเดลวิดีโออื่นจะสร้างทีละช็อต */}
          {isMinimaxH3Model(modelId) ? (
            <button
              type="button"
              className="drama-ep-btn-dark drama-ep-header-gen-all"
              disabled={generateAllLocked || fragments.length === 0}
              onClick={() => void generateAll()}
            >
              {busy && !planning ? 'ในคิว…' : 'สร้างพร้อมกัน'}
            </button>
          ) : null}
        </div>
      </header>

      {(status || error) && (
        <div className="drama-ep-banner">
          {error ? <BillingErrorNotice message={error} className="drama-ep-banner-error" inline /> : null}
          {!error && status ? <span>{status}</span> : null}
        </div>
      )}

      <div className="drama-ep-body">
        <DramaEpisodeDir
          items={buildEpisodeDirItems(episodeList.length ? episodeList : episode ? [episode] : [])}
          activeId={eid}
          onSelect={handleSelectEpisode}
        />
        <div className="drama-ep-workspace">
        <EpisodeEditAssetPanel
          readOnly={readOnly}
          scope={assetScope}
          tab={assetTab}
          assets={filteredAssets}
          activeIds={selectedRefIds}
          imageBusyIds={imageBusyIds}
          createBusy={assetCreateBusy}
          onScopeChange={setAssetScope}
          onTabChange={setAssetTab}
          onOpenCanvas={openEpisodeStoryboard}
          onOpenAsset={setDetailAsset}
          onMention={mentionAsset}
          onUnlinkAsset={unlinkSelectedAsset}
          onGenerateVoice={
            DRAMA_VOICE_BINDING_ENABLED
              ? (asset) => void handleGenerateCharacterVoice(asset)
              : undefined
          }
          voiceBusyIds={characterVoiceBusyIds}
          onVoiceError={(message) => setError(message)}
          onCreateAsset={() => void handleCreateSideAsset()}
          onImportAsset={() => setLibraryPickerOpen(true)}
        />

        <section className="drama-ep-editor">
          <div className="drama-ep-editor-head">
            <div>
              <strong>{formatFragLabel(selectedIndex, selectedDuration)}</strong>
              <MediaCostNotice modelId={modelId} resolution={readEpisodeResolution(episodeParams, projectParams)} seconds={selectedDuration} />
              <p>
                ด้านบนแสดงแอสเซทที่เกี่ยวข้องในช็อตนี้; พิมพ์ @ เพื่ออ้างอิงแอสเซทหรือแทรกแท็กความยาว ·{' '}
                {formatProjectOutputLabel(
                  readEpisodeAspectRatio(episodeParams, projectParams),
                  readEpisodeResolution(episodeParams, projectParams),
                )}
              </p>
            </div>
            <label className="drama-ep-duration">
              ความยาว
              <input
                type="number"
                min={mediaCatalog?.video_models.find(item => item.id === modelId)?.duration_min ?? 4}
                max={mediaCatalog?.video_models.find(item => item.id === modelId)?.duration_max ?? 30}
                value={selectedDuration}
                disabled={readOnly || (!editing && !selected)}
                onChange={(e) =>
                  updateSelected({ duration_sec: Number(e.target.value) || 8 })
                }
              />
              s
            </label>
          </div>

          <EpisodeEditReferenceStrip items={selectedRefItems} onSelect={focusLinkedAsset} />

          <div className={`drama-ep-editor-box ${editing ? 'editing' : ''}`}>
            <EpisodeEditPromptEditor
              content={selected?.content || ''}
              assets={assets}
              referencedIds={referencedIds}
              editing={editing && !readOnly}
              onOpenAsset={focusLinkedAsset}
              onContentChange={(nextContent) => {
                const fromContent = extractAssetIds(nextContent)
                const prevContentIds = extractAssetIds(selected?.content || '')
                const removed = prevContentIds.filter((id) => !fromContent.includes(id))
                /* เนื้อหาหลักลบการอ้างอิงที่ถูกลบออกไปแบบซิงค์ asset_ids；仅存在于 asset_ids 的额外关联保留 */
                const prevContentIdSet = new Set(prevContentIds)
                const keptExtra = (selected?.asset_ids || []).filter(
                  (id) => !prevContentIdSet.has(id) || fromContent.includes(id),
                )
                updateSelected({
                  content: nextContent,
                  asset_ids: Array.from(new Set([...keptExtra, ...fromContent])),
                })
                if (removed.length > 0) {
                  setStatus('ยกเลิกการเชื่อมโยงกับช็อตนี้แล้ว แอสเซทยังคงอยู่ในโปรเจกต์ (สลับไปที่ «ทุกตอน» เพื่อดูได้)')
                }
              }}
            />

          {selectedGateIssues.length > 0 ? (
            <ul className="drama-ep-script-issues" aria-live="polite">
              {selectedGateIssues.map((issue) => (
                <li
                  key={`${issue.level}:${issue.message}`}
                  className={
                    issue.level === 'error'
                      ? 'drama-ep-script-issue is-error'
                      : 'drama-ep-script-issue is-warn'
                  }
                >
                  {issue.message}
                </li>
              ))}
            </ul>
          ) : null}

          {linkLastFrame && selectedIndex > 0 ? (
            <p
              className={`drama-ep-continuity-hint${
                !continuityBlockedReason ? ' is-ready' : ' is-wait'
              }`}
            >
              {continuityBlockedReason
                ? `เปิดใช้งานการเชื่อมต่อเฟรมท้าย: ${continuityBlockedReason}`
                : continuityQueueHint
                  ? continuityQueueHint
                  : prevLastFrameUrl
                    ? 'จะใช้เฟรมท้ายของช็อตก่อนหน้าเป็นภาพอ้างอิงการเชื่อมต่อ (ส่งไปพร้อมกับภาพอ้างอิงตัวละคร)'
                    : 'ช็อตก่อนหน้าสร้างเสร็จแล้ว: ระบบจะดึงเฟรมท้ายมาเป็นภาพอ้างอิงการเชื่อมต่ออัตโนมัติขณะสร้าง'}
            </p>
          ) : !linkLastFrame ? (
            <p className="drama-ep-continuity-hint">
              ขณะนี้ยังไม่ได้เปิดการเชื่อมต่อเฟรมท้าย: สตอรี่บอร์ดจะสร้างแบบเป็นอิสระและพร้อมกัน เหมาะสำหรับการสร้างวิดีโอปริมาณมากอย่างรวดเร็ว
            </p>
          ) : null}

          <div className="drama-ep-editor-actions">
            {editing ? (
              <>
                <button
                  type="button"
                  className="drama-ep-btn-ghost"
                  disabled={readOnly || busy}
                  onClick={() => {
                    setEditing(false)
                    void reload()
                  }}
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  className="drama-ep-btn-dark"
                  disabled={readOnly || busy}
                  onClick={() => void save()}
                >
                  {busy ? 'กำลังบันทึก…' : 'บันทึก'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="drama-ep-btn-ghost"
                  disabled={readOnly || !selected || selectedIsGenerating || busy}
                  onClick={() => setEditing(true)}
                >
                  แก้ไข
                </button>
                <button
                  type="button"
                  className="drama-ep-btn-dark"
                  disabled={selectedGenerateLocked || !selected}
                  title={
                    selectedGateBlocking[0]?.message ||
                    continuityBlockedReason ||
                    continuityQueueHint ||
                    (selectedIsGenerating ? 'ช็อตปัจจุบันกำลังสร้าง' : undefined)
                  }
                  onClick={() => void generateSelected()}
                >
                  {selectedIsGenerating
                    ? 'กำลังสร้าง…'
                    : busy
                      ? 'กำลังประมวลผล…'
                      : selectedGateBlocking.length > 0
                        ? 'เพิ่มภาพอ้างอิงก่อน'
                        : continuityQueueHint
                          ? 'เข้าคิวสร้าง'
                          : continuityBlockedReason
                            ? 'รอช็อตก่อนหน้า'
                            : selectedHasVideo
                              ? 'สร้างใหม่'
                              : 'สร้าง'}
                </button>
              </>
            )}
          </div>
          </div>

          {selectedVersions.length > 0 && selected?.id ? (
            <div className="drama-ep-versions">
              <span className="drama-ep-versions-label">เวอร์ชันก่อนหน้า</span>
              <div className="drama-ep-versions-list">
                {selectedHasVideo && selected.video ? (
                  <button
                    type="button"
                    className={`drama-ep-version is-active${!previewVersionId ? ' is-current' : ''}`}
                    disabled={busy || selectedIsGenerating}
                    title="ชิ้นงานปัจจุบัน"
                    onClick={() => setPreviewVersionId(null)}
                  >
                    {selected.cover ? (
                      <img src={resolveDramaMediaUrl(selected.cover)} alt="" />
                    ) : (
                      <video src={resolveDramaMediaUrl(selected.video)} muted />
                    )}
                    <em>ปัจจุบัน</em>
                  </button>
                ) : null}
                {selectedVersions.map((ver, index) => {
                  const cover = ver.cover ? resolveDramaMediaUrl(ver.cover) : ''
                  const video = resolveDramaMediaUrl(ver.video)
                  const versionNo = selectedVersions.length - index
                  return (
                    <button
                      key={ver.id}
                      type="button"
                      className={`drama-ep-version${previewVersionId === ver.id ? ' is-previewing' : ''}`}
                      disabled={busy || selectedIsGenerating}
                      title="คลิกเพื่อดูตัวอย่าง สามารถตั้งเป็นเวอร์ชันปัจจุบันได้ที่แถบด้านขวา"
                      onClick={() => setPreviewVersionId(ver.id)}
                    >
                      {cover ? <img src={cover} alt="" /> : <video src={video} muted />}
                      <em>v{versionNo}</em>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </section>

        <EpisodeEditSidePane
          fragments={fragments}
          playingFragmentId={playingFragmentId}
          onPlayingFragmentChange={handlePlayingFragmentChange}
          aspectRatio={aspectRatio}
          episodeId={episode?.id}
          projectId={projectId}
          episodeName={episode?.name || 'ตอนนี้'}
          onOpenStoryboard={openEpisodeStoryboard}
          previewVideoUrl={previewVideoUrl}
          previewPosterUrl={previewPosterUrl}
          previewLabel={
            previewVersion
              ? `v${
                  selectedVersions.length -
                  selectedVersions.findIndex((ver) => ver.id === previewVersion.id)
                }`
              : ''
          }
          onClearPreview={() => setPreviewVersionId(null)}
          onActivatePreview={
            previewVersionId && !readOnly
              ? () => {
                  void activateVideoVersion(previewVersionId)
                }
              : undefined
          }
        />
        </div>
      </div>

      <footer className="drama-ep-storyboard">
        <div className="drama-ep-storyboard-row">
          <button
            type="button"
            className="drama-ep-insert"
            aria-label="แทรกช็อตที่จุดเริ่มต้น"
            disabled={readOnly}
            onClick={() => insertFrag(0)}
          >
            +
          </button>
          {fragments.map((frag, index) => {
            const genInfo = readFragmentGenerationStatus(frag)
            const fragStatus = genInfo.status
            const activeVideoTask = (episode?.active_tasks || []).find(
              (task) =>
                task.task_type === 'fragment_video' &&
                task.fragment_id === frag.id &&
                !task.cancel_requested &&
                ['pending', 'leased', 'running', 'awaiting_poll', 'awaiting_review'].includes(
                  task.status,
                ),
            )
            // 终态优先；仅在进行中时才用平台任务态覆盖（避免 done 仍被僵尸任务刷成กำลังสร้าง）
            const displayStatus =
              fragStatus === 'done' ||
              fragStatus === 'failed' ||
              fragStatus === 'cancelled'
                ? fragStatus
                : activeVideoTask
                  ? activeVideoTask.status === 'pending' || activeVideoTask.status === 'leased'
                    ? 'queued'
                    : 'running'
                  : fragStatus
            const fragBusy =
              Boolean(frag.id && generatingIds.has(frag.id)) &&
              displayStatus !== 'done' &&
              displayStatus !== 'failed' &&
              displayStatus !== 'cancelled'
            const badge = fragmentQueueBadgeLabel(displayStatus)
            const clipVideo = frag.video ? resolveDramaMediaUrl(frag.video) : ''
            const clipCover = frag.cover ? resolveDramaMediaUrl(frag.cover) : ''
            const showFailHint = displayStatus === 'failed' && !fragBusy
            const fragParams =
              frag.params && typeof frag.params === 'object' && !Array.isArray(frag.params)
                ? (frag.params as Record<string, unknown>)
                : {}
            return (
            <div key={`${frag.id}-${index}`} className="drama-ep-clip-wrap">
              <div
                className={`drama-ep-clip-shell ${selectedIndex === index ? 'active' : ''}${
                  fragBusy ? ' is-generating' : ''
                }${displayStatus === 'queued' ? ' is-queued' : ''}${
                  displayStatus === 'failed' ? ' is-failed' : ''
                }`}
              >
                <button
                  type="button"
                  className="drama-ep-clip"
                  onClick={() => setSelectedIndex(index)}
                >
                  {clipCover ? (
                    <img src={clipCover} alt="" />
                  ) : clipVideo ? (
                    <video src={clipVideo} muted />
                  ) : (
                    <span className="drama-ep-clip-empty">
                      {fragBusy ? '…' : showFailHint ? (
                        <CircleAlert size={22} strokeWidth={2} aria-hidden />
                      ) : (
                        '+'
                      )}
                    </span>
                  )}
                  {badge ? <span className="drama-ep-clip-badge">{badge}</span> : null}
                  <em>
                    {formatFragLabel(index, frag.duration_sec)}
                    <DramaFragmentClipSpec
                      fragmentParams={fragParams}
                      episodeParams={episodeParams}
                      projectParams={projectParams}
                      videoUrl={clipVideo}
                    />
                  </em>
                </button>
                {showFailHint ? (
                  <button
                    type="button"
                    className="drama-ep-clip-fail-btn"
                    title="ดูสาเหตุที่ล้มเหลว"
                    aria-label={`ดูสาเหตุที่ช็อต ${index + 1} ล้มเหลว`}
                    onClick={() => openFragmentFailReason(frag, index)}
                  >
                    <CircleAlert size={14} strokeWidth={2.25} aria-hidden />
                  </button>
                ) : null}
              </div>
              <div className="drama-ep-clip-ops">
                <button type="button" aria-label="แทรก" onClick={() => insertFrag(index + 1)} disabled={readOnly || busy}>
                  +
                </button>
                <button type="button" aria-label="คัดลอก" onClick={() => duplicateFrag(index)} disabled={readOnly || busy}>
                  ⧉
                </button>
                <button
                  type="button"
                  aria-label="ลบ"
                  disabled={readOnly || busy || fragments.length <= 1}
                  onClick={() => deleteFrag(index)}
                >
                  ⌫
                </button>
              </div>
            </div>
            )
          })}
        </div>
      </footer>

      <FragmentPlanSkillModal
        open={planModalOpen && !readOnly}
        message="ระบบจะเรียกโมเดล AI เพื่อวางแผนสตอรี่บอร์ดใหม่ตามบทของตอนนี้ (จะเขียนทับสตอรี่บอร์ดเดิมและวิดีโอที่สร้างไว้) ปกติใช้เวลาประมาณ 10-30 วินาที สามารถเลือกทักษะ (Skill) ที่ต้องการใช้ได้ รูปแบบซับไตเติลจะใช้ตามการตั้งค่าแถบด้านบน"
        onCancel={() => setPlanModalOpen(false)}
        onConfirm={(skillIds) => void startPlanFragments(skillIds)}
      />

      {detailAsset && (detailAsset.type || '').toLowerCase() !== 'voice' ? (
        <EditableAssetDetailDialog
          asset={detailAsset}
          readOnly={readOnly}
          open
          busy={imageBusyIds.has(detailAsset.id)}
          genLabel={assetImageGenLabel(detailAsset)}
          onClose={() => setDetailAsset(null)}
          onUpdated={handleCharacterUpdated}
          onGenerate={(a) => enqueueAssetImage(a)}
          onBindVoice={DRAMA_VOICE_BINDING_ENABLED ? (a) => setVoiceBindAsset(a) : undefined}
          onError={(message) => setError(message)}
        />
      ) : null}

      {!readOnly && DRAMA_VOICE_BINDING_ENABLED && voiceBindAsset ? (
        <CharacterVoiceBindModal
          asset={voiceBindAsset}
          projectId={pid}
          open
          onClose={() => setVoiceBindAsset(null)}
          onBound={(updated) => {
            handleCharacterUpdated(updated)
            setVoiceBindAsset(null)
          }}
          onError={(message) => setError(message)}
        />
      ) : null}

      <GlobalAssetPickerModal
        open={libraryPickerOpen && !readOnly}
        onClose={() => setLibraryPickerOpen(false)}
        projectId={pid}
        defaultTab={resolveCreateAssetTab()}
        allowedTypes={
          resolveCreateAssetTab() === 'prop'
            ? ['prop', 'material', 'none']
            : [resolveCreateAssetTab()]
        }
        title={`นำเข้า${resolveCreateAssetTab() === 'scene' ? 'ฉาก' : resolveCreateAssetTab() === 'prop' ? 'อุปกรณ์/พร็อพ' : 'ตัวละคร'}`}
        confirmLabel="นำเข้าไปยังเครื่องนี้ ตอน"
        onPick={handleImportSideAsset}
      />

      {failReasonJob ? (
        <div className="drama-ep-fail-reason-pop">
          <DramaGenTaskDetail job={failReasonJob} onClose={() => setFailReasonJob(null)} />
        </div>
      ) : null}
    </div>
  )
}
import { MediaCostNotice } from '../../components/billing/MediaCostNotice'
