/** แอสเซท库步骤：首次无แอสเซท时自动 seed，分类 Tab + 生图队列 + ตัวละครน้ำเสียง绑定 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Boxes } from 'lucide-react'
import { AssetBanner, AssetCard, AssetEmpty, AssetGrid, AssetTypeFilter } from '../../components/assets/AssetLibrary'
import { dramaApi, resolveDramaAssetPreviewUrl, type DramaAsset, type DramaProject } from '../../api/drama'
import { api, type BillingPreflight } from '../../api'
import { useDramaImageGenQueue } from '../../hooks/useDramaImageGenQueue'
import { enqueueDramaImageGen, resumeDramaImageGensFromAssets } from '../../lib/dramaImageGenQueue'
import {
  defaultOptionsForAssetKind,
  type ImageGenerationOptions,
} from '../../lib/dramaGenerationOptions'
import { getImageStyleId } from './dramaWorkspaceUtils'
import { DramaImageGenOptionsBar } from './canvas/nodes/DramaImageGenOptionsBar'
import {
  CharacterVoiceBindModal,
  readAssetVoiceBinding,
  readVoicePrompt,
} from './CharacterVoiceBindModal'
import { CharacterVoicePreviewButton } from '../../components/drama/CharacterVoicePreviewButton'
import { generateAndBindCharacterVoice } from '../../lib/characterVoiceGenerate'
import { NarratorVoiceBindModal } from './NarratorVoiceBindModal'
import { EditableAssetDetailDialog } from '../../components/assets/EditableAssetDetailDialog'
import { AssetDetailDialog } from '../../components/assets/AssetDetailDialog'
import { GlobalAssetPickerModal, importGlobalAssetToProject } from './GlobalAssetPickerModal'
import { DramaVoiceAssetCard } from './DramaVoiceAssetCard'
import Pagination from '../../components/ui/Pagination'
import { dialog } from '../../lib/dialog'
import { handleBillingError, isBillingError } from '../../lib/billingError'
import { alertDramaGenError, formatDramaGenError, isUpstreamAccountError } from '../../lib/dramaGenError'
import { pageCountOf } from '../../lib/pagination'
import { readVisualPrompt } from '../../lib/dramaVisualPrompt'
import { filterDramaLibraryAssets } from '../../lib/dramaLibraryAssets'
import { DRAMA_VOICE_BINDING_ENABLED } from '../../lib/dramaVoiceBinding'
import { useCharacterVoiceGenerationEnabled } from '../../hooks/usePublicCapabilities'
import { VOICE_GENERATION_DISABLED_MESSAGE } from '../../lib/publicCapabilities'
import {
  dramaAssetImageGenButtonLabel,
  dramaAssetNeedsImageGeneration,
} from '../../lib/dramaAssetImage'

type AssetTabKey = 'character' | 'scene' | 'prop' | 'voice'

const ASSET_TABS: Array<{ key: AssetTabKey; label: string }> = [
  { key: 'character', label: 'ตัวละคร' },
  { key: 'scene', label: 'ฉาก' },
  { key: 'prop', label: 'อุปกรณ์' },
  ...(DRAMA_VOICE_BINDING_ENABLED ? [{ key: 'voice' as const, label: 'โทนเสียง' }] : []),
]

const PAGE_SIZE_DEFAULT = 12
const PAGE_SIZE_OPTIONS = [12, 24, 36] as const

// 跨 StrictMode 重挂载共享，หลีกเลี่ยงคิวว่างและสำเร็จพร้อมกัน seed
const seedingProjectIds = new Set<number>()

type AssetsStepProps = {
  projectId: number
  onError: (m: string) => void
}

// อินเทอร์เฟซกลับ规范为แอสเซทอาร์เรย์，避免 undefined.filter ล่มสลาย
function normalizeAssetList(value: unknown): DramaAsset[] {
  return filterDramaLibraryAssets(Array.isArray(value) ? (value as DramaAsset[]) : [])
}

// 判断แอสเซทยังไม่มีภาพหรือไม่（无有效封面/主图，อัปโหลด或 AI 生成均视为已出图）
function needsImageGeneration(asset: DramaAsset): boolean {
  return dramaAssetNeedsImageGeneration(asset)
}

// เรนเดอร์แอสเซท库步骤
export function AssetsStep({ projectId, onError }: AssetsStepProps) {
  const voiceGenerationEnabled = useCharacterVoiceGenerationEnabled()
  /*
   * assets โปรเจกต์แอสเซท
   * tab ปัจจุบัน分类
   * loading 首次加载
   * batchBusy 一键ในคิว
   * genOptions ตัวเลือกสร้างรูปภาพ
   * voiceAsset 打开น้ำเสียง弹窗的ตัวละคร
   * detailAsset 打开รายละเอียดการดำเนินการ框的แอสเซท
   * lightbox รูปภาพขยายขนาดดูตัวอย่าง
   * batchVoiceBusy สร้างพร้อมกันน้ำเสียง中
   * page ปัจจุบัน页码
   * pageSize 每页条数
   * genQueue ทั่วไป生图队列
   */
  const [assets, setAssets] = useState<DramaAsset[]>([])
  const [tab, setTab] = useState<AssetTabKey>('character')
  const [loading, setLoading] = useState(true)
  const [batchBusy, setBatchBusy] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT)
  const [genOptions, setGenOptions] = useState<ImageGenerationOptions>(() =>
    defaultOptionsForAssetKind('character'),
  )
  const [voiceAsset, setVoiceAsset] = useState<DramaAsset | null>(null)
  const [detailAsset, setDetailAsset] = useState<DramaAsset | null>(null)
  const [previewAsset, setPreviewAsset] = useState<DramaAsset | null>(null)
  const [voiceSynthBusyId, setVoiceSynthBusyId] = useState<number | null>(null)
  const [voicePromptDrafts, setVoicePromptDrafts] = useState<Record<number, string>>({})
  const [pickerOpen, setPickerOpen] = useState(false)
  const [reseedBusy, setReseedBusy] = useState(false)
  const [project, setProject] = useState<DramaProject | null>(null)
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<number[]>([])
  const [characterVoiceBusyIds, setCharacterVoiceBusyIds] = useState<Set<number>>(() => new Set())
  const [batchVoiceBusy, setBatchVoiceBusy] = useState(false)
  const [narratorVoiceOpen, setNarratorVoiceOpen] = useState(false)
  const genQueue = useDramaImageGenQueue()

  useEffect(() => {
    async function enter() {
      setLoading(true)
      try {
        const p = await dramaApi.getProject(projectId).catch(() => null)
        setProject(p)
        const styleId = p ? getImageStyleId(p.script, p) : ''
        setGenOptions((prev) => ({
          ...defaultOptionsForAssetKind(tab),
          image_style_id: styleId || prev.image_style_id,
          model_id: prev.model_id,
          resolution: prev.resolution,
        }))
        let list = normalizeAssetList(
          await dramaApi.listAssets(projectId, { libraryOnly: true }),
        )
        // 仅首次（แอสเซทไลบรารีว่างเปล่าและมีแล้วสรุปเรื่องย่อ）自动从剧本抽取；之后需ด้วยตนเอง点「重新抽取แอสเซท」
        if (list.length === 0 && p?.script?.summary && !seedingProjectIds.has(projectId)) {
          seedingProjectIds.add(projectId)
          try {
            const seededResult = await dramaApi.seedAssets(projectId)
            list = normalizeAssetList(seededResult?.assets)
          } finally {
            seedingProjectIds.delete(projectId)
          }
        }
        setAssets(list)
        resumeDramaImageGensFromAssets(projectId, list, (next) => {
          setAssets((prev) => (prev ?? []).map((a) => (a.id === next.id ? next : a)))
        })
      } catch (err) {
        onError(err instanceof Error ? err.message : 'แอสเซทโหลดไม่สำเร็จ')
        try {
          const list = normalizeAssetList(await dramaApi.listAssets(projectId, { libraryOnly: true }))
          setAssets(list)
          resumeDramaImageGensFromAssets(projectId, list, (next) => {
          setAssets((prev) => (prev ?? []).map((a) => (a.id === next.id ? next : a)))
        })
        } catch {
          /* ignore */
        }
      } finally {
        setLoading(false)
      }
    }
    void enter()
  }, [projectId, onError])

  useEffect(() => {
    setGenOptions((prev) => ({
      ...defaultOptionsForAssetKind(tab),
      image_style_id: prev.image_style_id,
      model_id: prev.model_id,
      resolution: prev.resolution,
    }))
  }, [tab])

  useEffect(() => {
    if (tab !== 'character') {
      setSelectedCharacterIds([])
    }
    setPage(1)
  }, [tab])

  useEffect(() => {
    setPage(1)
  }, [pageSize])

  // 队列เสร็จสิ้น时把最新封面写回卡片
  useEffect(() => {
    const projectJobs = genQueue.filter((j) => j.projectId === projectId)
    const doneIds = new Set(
      projectJobs.filter((j) => j.status === 'done' || j.status === 'running').map((j) => j.assetId),
    )
    if (doneIds.size === 0) return
    let cancelled = false
    dramaApi
      .listAssets(projectId, { libraryOnly: true })
      .then((list) => {
        if (cancelled) return
        const next = normalizeAssetList(list)
        setAssets(next)
        setDetailAsset((prev) => (prev ? next.find((a) => a.id === prev.id) || prev : null))
      })
      .catch(() => {
        /* ignore */
      })
    return () => {
      cancelled = true
    }
  }, [genQueue, projectId])

  const assetList = assets ?? []
  const narrationVoiceLabel =
    project?.params && typeof project.params === 'object'
      ? String(
          ((project.params as Record<string, unknown>).narrationVoiceAudio as Record<string, unknown> | undefined)?.label ||
            'ยังไม่ได้ตั้งค่า',
        )
      : 'ยังไม่ได้ตั้งค่า'
  const filtered = assetList.filter((a) => {
    const t = (a.type || '').toLowerCase()
    if (tab === 'voice') return t === 'voice'
    return t === tab
  })
  const selectedCharacterAssets = assetList.filter(
    (a) => (a.type || '').toLowerCase() === 'character' && selectedCharacterIds.includes(a.id),
  )
  const busyAssetIds = new Set(
    genQueue
      .filter(
        (j) =>
          j.projectId === projectId && (j.status === 'queued' || j.status === 'running'),
      )
      .map((j) => j.assetId),
  )
  // 未出图：无有效 cover/url，且ปัจจุบัน未在队列中
  const pending = filtered.filter((a) => needsImageGeneration(a) && !busyAssetIds.has(a.id))
  const queueBusy = busyAssetIds.size > 0
  const pageCount = pageCountOf(filtered.length, pageSize)
  const safePage = Math.min(page, pageCount)
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, safePage, pageSize])

  // บันทึกถาวรโปรเจกต์สไตล์ภาพ
  async function persistStyle(styleId: string) {
    try {
      await dramaApi.updateScript(projectId, { image_style_id: styleId })
    } catch (err) {
      onError(err instanceof Error ? err.message : 'บันทึกสไตล์ล้มเหลว')
    }
  }

  // 入队前校验余额（批量/单项共用）；สำเร็จ时กลับ预检明细（含单张估算）
  async function ensureImageGenBalance(count: number): Promise<BillingPreflight | null> {
    try {
      return await api.billingPreflight({
        domain: 'drama',
        task_type: 'asset_image',
        count,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err || '')
      if (isBillingError(message)) { onError(message); return null }
      if (await handleBillingError(err)) return null
      onError(message || 'ตรวจสอบยอดเงินคงเหลือไม่สำเร็จ')
      return null
    }
  }

  async function notifyImageGenFailure(err: unknown) {
    const message = err instanceof Error ? err.message : String(err || '')
    if (isBillingError(message)) { onError(message); return }
    if (isUpstreamAccountError(message)) {
      await alertDramaGenError(err)
      onError(formatDramaGenError(message).message)
      return
    }
    if (await handleBillingError(err)) return
    const view = formatDramaGenError(message)
    if (view.upstreamAccountBlocked || view.billingBlocked) {
      await alertDramaGenError(err)
    }
    onError(view.message || message || 'สร้างภาพไม่สำเร็จ')
  }

  // เพิ่มเข้าทั่วไป生图队列（不互相顶掉）
  function enqueueOne(asset: DramaAsset, options = genOptions) {
    if (busyAssetIds.has(asset.id)) return
    void (async () => {
      if (!(await ensureImageGenBalance(1))) return
      try {
        const updated = await enqueueDramaImageGen({
          projectId,
          assetId: asset.id,
          assetName: asset.name || undefined,
          assetType: asset.type,
          prompt: readVisualPrompt(asset),
          options,
          onAssetUpdate: (next) => {
            setAssets((prev) => (prev ?? []).map((a) => (a.id === next.id ? next : a)))
          },
        })
        setAssets((prev) => (prev ?? []).map((a) => (a.id === updated.id ? updated : a)))
      } catch (err) {
        await notifyImageGenFailure(err)
      }
    })()
  }

  // 一键只入队「ยังไม่มีภาพในหมวดหมู่ปัจจุบัน」的แอสเซท（已有图 / กำลังรอคิว跳过）
  async function batchGenerate() {
    const targets = filtered.filter(
      (a) => needsImageGeneration(a) && !busyAssetIds.has(a.id),
    )
    if (targets.length === 0) {
      onError('หมวดหมู่ปัจจุบันไม่มีที่ยังไม่ได้สร้างแอสเซท')
      return
    }
    const pre = await ensureImageGenBalance(targets.length)
    if (!pre) return
    const unitYuan = pre.unit_estimate_yuan ?? pre.unit_estimate_fen / 100
    const totalYuan = pre.requested_total_yuan ?? pre.requested_total_fen / 100
    const balanceYuan = pre.balance_yuan ?? (typeof pre.balance_fen === 'number' ? pre.balance_fen / 100 : undefined)
    const balanceText = balanceYuan === undefined ? 'การใช้งานจะหักจากยอดเงินของทีมหรือส่วนบุคคล' : `ยอดคงเหลือปัจจุบัน ¥${balanceYuan.toFixed(2)}`
    const ok = await dialog.confirm({
      title: 'สร้างพร้อมกันภาพลักษณ์',
      message:
        `จะเริ่มสร้างรูปภาพสำหรับ ${targets.length} แอสเซทที่ยังไม่มีรูปในหมวดหมู่ «${ASSET_TABS.find((t) => t.key === tab)?.label || 'หมวดหมู่'}» (ส่งพร้อมกัน)\n\n` +
        `ประมาณการภาพละ ¥${unitYuan.toFixed(2)} รวมประมาณ ¥${totalYuan.toFixed(2)} (${balanceText})\n\nต้องการดำเนินการต่อหรือไม่?`,
      confirmText: 'เริ่มสร้าง',
    })
    if (!ok) return
    setBatchBusy(true)
    const tasks = targets.map((asset) =>
      enqueueDramaImageGen({
        projectId,
        assetId: asset.id,
        assetName: asset.name || undefined,
        assetType: asset.type,
        prompt: readVisualPrompt(asset),
        options: {
          ...genOptions,
          ...defaultOptionsForAssetKind(asset.type),
          image_style_id: genOptions.image_style_id,
          model_id: genOptions.model_id,
          resolution: genOptions.resolution,
        },
        onAssetUpdate: (next) => {
          setAssets((prev) => (prev ?? []).map((a) => (a.id === next.id ? next : a)))
        },
      }).then((updated) => {
        setAssets((prev) => (prev ?? []).map((a) => (a.id === updated.id ? updated : a)))
      }),
    )
    void Promise.allSettled(tasks).then(async (results) => {
      setBatchBusy(false)
      const failed = results.find((r) => r.status === 'rejected')
      if (failed && failed.status === 'rejected') {
        await notifyImageGenFailure(failed.reason)
      }
    })
  }

  // น้ำเสียง绑定สำเร็จ后รีเฟรช列表项
  function handleVoiceBound(updated: DramaAsset) {
    setAssets((prev) => (prev ?? []).map((a) => (a.id === updated.id ? updated : a)))
  }

  function handleVoiceCreated(voice: DramaAsset) {
    setAssets((prev) => {
      const list = prev ?? []
      if (list.some((a) => a.id === voice.id)) return list
      return [...list, voice]
    })
  }

  // 一键 AI 生成น้ำเสียงและผูกมัด（各ตัวละครอิสระ busy，互不阻塞）
  async function handleGenerateCharacterVoice(asset: DramaAsset) {
    if (!voiceGenerationEnabled) { onError(VOICE_GENERATION_DISABLED_MESSAGE); return }
    if (characterVoiceBusyIds.has(asset.id) || batchVoiceBusy) return
    setCharacterVoiceBusyIds((prev) => new Set(prev).add(asset.id))
    try {
      const { character, voice } = await generateAndBindCharacterVoice(projectId, asset)
      handleVoiceBound(character)
      handleVoiceCreated(voice)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'น้ำเสียงสร้างไม่สำเร็จ')
    } finally {
      setCharacterVoiceBusyIds((prev) => {
        const next = new Set(prev)
        next.delete(asset.id)
        return next
      })
    }
  }

  // จำนวนมากตามการตั้งค่าบทบาทตัวละคร生成น้ำเสียง
  async function batchGenerateCharacterVoices() {
    if (!voiceGenerationEnabled) { onError(VOICE_GENERATION_DISABLED_MESSAGE); return }
    if (batchVoiceBusy || selectedCharacterAssets.length === 0) return
    const ok = await dialog.confirm({
      title: 'สร้างพร้อมกันน้ำเสียง',
      message: `จะสร้างและผูกเสียงด้วย AI ให้กับ ${selectedCharacterAssets.length} ตัวละครที่เลือก ต้องการดำเนินการต่อหรือไม่?`,
      confirmText: 'เริ่มสร้าง',
    })
    if (!ok) return
    setBatchVoiceBusy(true)
    let failCount = 0
    for (const asset of selectedCharacterAssets) {
      setCharacterVoiceBusyIds((prev) => new Set(prev).add(asset.id))
      try {
        const { character, voice } = await generateAndBindCharacterVoice(projectId, asset)
        handleVoiceBound(character)
        handleVoiceCreated(voice)
      } catch {
        failCount += 1
      } finally {
        setCharacterVoiceBusyIds((prev) => {
          const next = new Set(prev)
          next.delete(asset.id)
          return next
        })
      }
    }
    setBatchVoiceBusy(false)
    setSelectedCharacterIds([])
    if (failCount > 0) {
      onError(`สร้างเสียงตัวละครไม่สำเร็จ ${failCount} รายการ`)
    }
  }

  // 从ทั่วไปแอสเซทนำเข้าไลบรารีไปยังปัจจุบันโปรเจกต์
  async function handleImportFromLibrary(source: DramaAsset) {
    const dup = assetList.some(
      (a) =>
        (a.name || '').trim() === (source.name || '').trim() &&
        (a.type || '') === (source.type || ''),
    )
    if (dup) {
      const ok = await dialog.confirm({
        title: 'อาจมีรายการซ้ำ',
        message: `ปัจจุบันโปรเจกต์มีชื่อเดียวกันอยู่แล้ว「${source.name}」แอสเซท，ยังต้องการนำเข้าสำเนาหนึ่งฉบับหรือไม่？`,
        confirmText: 'ยืนยันการนำเข้า',
      })
      if (!ok) throw new Error('ยกเลิกแล้ว')
    }
    const created = await importGlobalAssetToProject(projectId, source)
    setAssets((prev) => [...(prev ?? []), created])
  }

  // 新增น้ำเสียงแอสเซท
  async function handleAddVoice() {
    const name = await dialog.prompt({
      title: 'เพิ่มเสียง',
      message: 'กรอกชื่อเสียง',
      placeholder: 'เช่น: ลีมินแจ-เสียงสุขุมนุ่มลึก',
      confirmText: 'สร้าง',
    })
    if (!name?.trim()) return
    try {
      const created = await dramaApi.createAsset({
        project_id: projectId,
        type: 'voice',
        asset_type: 'audio',
        name: name.trim(),
        params: { voicePrompt: '' },
      })
      setAssets((prev) => [...(prev ?? []), created])
      setVoicePromptDrafts((prev) => ({ ...prev, [created.id]: '' }))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'สร้างน้ำเสียงล้มเหลว')
    }
  }

  // บันทึกน้ำเสียงคำอธิบาย到แอสเซท params
  async function persistVoicePrompt(asset: DramaAsset, prompt: string) {
    const nextParams = { ...(asset.params || {}), voicePrompt: prompt.trim() }
    const updated = await dramaApi.updateAsset(asset.id, { params: nextParams })
    setAssets((prev) => (prev ?? []).map((a) => (a.id === updated.id ? updated : a)))
  }

  // 按คำแนะนำ词合成 voice แอสเซท试听
  async function handleSynthVoice(asset: DramaAsset) {
    if (!voiceGenerationEnabled) { onError(VOICE_GENERATION_DISABLED_MESSAGE); return }
    const prompt = (voicePromptDrafts[asset.id] ?? readVoicePrompt(asset)).trim()
    if (!prompt) {
      onError('กรุณากรอกคำอธิบายลักษณะเสียงก่อน')
      return
    }
    setVoiceSynthBusyId(asset.id)
    try {
      await persistVoicePrompt(asset, prompt)
      const result = await dramaApi.generateVoice({
        project_id: projectId,
        asset_id: asset.id,
        voice_prompt: prompt,
      })
      setAssets((prev) => (prev ?? []).map((a) => (a.id === asset.id ? result.asset : a)))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'สังเคราะห์เสียงไม่สำเร็จ')
    } finally {
      setVoiceSynthBusyId(null)
    }
  }

  // ลบน้ำเสียงแอสเซท
  async function handleDeleteVoice(asset: DramaAsset) {
    const ok = await dialog.confirm({
      title: 'ลบน้ำเสียง',
      message: `ยืนยันการลบเสียง «${asset.name || 'ไม่มีชื่อ'}» หรือไม่?`,
      tone: 'danger',
      confirmText: 'ลบ',
    })
    if (!ok) return
    try {
      await dramaApi.deleteAsset(asset.id)
      setAssets((prev) => (prev ?? []).filter((a) => a.id !== asset.id))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'ลบไม่สำเร็จ')
    }
  }

  // เพิ่มตัวละคร
  async function handleAddCharacter() {
    const name = await dialog.prompt({
      title: 'เพิ่มตัวละคร',
      message: 'กรอกชื่อตัวละคร',
      placeholder: 'เช่น: ลีมินแจ',
      confirmText: 'สร้าง',
    })
    if (!name?.trim()) return
    try {
      const created = await dramaApi.createAsset({
        project_id: projectId,
        type: 'character',
        asset_type: 'image',
        name: name.trim(),
        params: { kind: 'character' },
      })
      setAssets((prev) => [...(prev ?? []), created])
    } catch (err) {
      onError(err instanceof Error ? err.message : 'สร้างตัวละครล้มเหลว')
    }
  }

  // ลบตัวละคร
  async function handleDeleteCharacter(asset: DramaAsset) {
    const ok = await dialog.confirm({
      title: 'ลบตัวละคร',
      message: `ยืนยันการลบตัวละคร «${asset.name || 'ไม่มีชื่อ'}» หรือไม่? การดำเนินการนี้ไม่สามารถกู้คืนได้`,
      tone: 'danger',
      confirmText: 'ลบ',
    })
    if (!ok) return
    if (busyAssetIds.has(asset.id)) {
      onError('ตัวละครนี้กำลังสร้างภาพอยู่ กรุณารอสักครู่ก่อนลบ')
      return
    }
    try {
      await dramaApi.deleteAsset(asset.id)
      setAssets((prev) => (prev ?? []).filter((a) => a.id !== asset.id))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'ลบไม่สำเร็จ')
    }
  }

  // 重新从剧本抽取แอสเซท并 AI รีเฟรชทั้งหมด生图คำแนะนำ词
  async function handleReseedAssets() {
    if (reseedBusy || batchBusy) return
    const ok = await dialog.confirm({
      title: 'สกัดแอสเซทใหม่',
      message:
        'ระบบจะดึงตัวละครและฉากใหม่ตามสรุปเรื่องย่อล่าสุด และใช้ AI สร้างคำสั่งพร้อมท์รูปภาพใหม่สำหรับทุกตัวละคร ฉาก และพร็อพ โดยรูปภาพและเสียงที่ผูกไว้เดิมจะไม่ถูกลบ ต้องการดำเนินการต่อหรือไม่?',
      confirmText: 'เริ่มสกัด',
      tone: 'danger',
    })
    if (!ok) return
    setReseedBusy(true)
    try {
      const result = await dramaApi.seedAssets(projectId, {
        refreshPrompts: true,
        reextractProps: true,
      })
      if (result.status === 'generating') {
        let seedStatus = 'generating'
        for (let i = 0; i < 90; i += 1) {
          await new Promise((r) => window.setTimeout(r, 2000))
          const p = await dramaApi.getProject(projectId)
          seedStatus = String(
            (p.params as Record<string, unknown> | undefined)?.assets_seed_status || '',
          )
          if (seedStatus === 'done' || seedStatus === 'failed') break
        }
        if (seedStatus !== 'done' && seedStatus !== 'failed') {
          await dialog.alert({
            title: 'สกัดแอสเซทยังไม่เสร็จ',
            message: 'หมดเวลารอ worker กรุณาตรวจสอบสถานะแล้วลองใหม่อีกครั้ง',
            tone: 'danger',
          })
          return
        }
        const list = normalizeAssetList(
          await dramaApi.listAssets(projectId, { libraryOnly: true }),
        )
        setAssets(list)
        const p = await dramaApi.getProject(projectId)
        const params = (p.params || {}) as Record<string, unknown>
        const created = Number(params.assets_seed_created ?? 0)
        const refreshed = Number(params.assets_seed_refreshed ?? 0)
        const propsUpdated = Number(params.assets_seed_props_updated ?? 0)
        const llmErrors = Array.isArray(params.assets_seed_llm_errors)
          ? (params.assets_seed_llm_errors as string[])
          : []
        const failed = seedStatus === 'failed'
        const parts = [`สร้างใหม่ ${created} รายการ`, `อัปเดตคำสั่งพร้อมท์ ${refreshed} รายการ`]
        if (propsUpdated > 0) {
          parts.push(`อัปเดตพร็อพ ${propsUpdated} รายการ`)
        }
        let detail = failed
          ? String(params.assets_seed_error || 'สกัดแอสเซทล้มเหลว')
          : `${parts.join('，')}。`
        if (!failed && created === 0 && refreshed === 0 && llmErrors.length === 0) {
          detail +=
            'ตัวละครหรือฉากที่มีอยู่แล้วจะไม่สร้างซ้ำ และไม่มีการอัปเดตคำสั่งพร้อมท์ใหม่ กรุณาตรวจสอบว่ามีสรุปเรื่องย่อและบทของแต่ละตอนแล้วจึงลองอีกครั้ง'
        } else if (!failed && llmErrors.length > 0) {
          detail += `\n\nแอสเซทต่อไปนี้อัปเดตไม่สำเร็จ:\n${llmErrors.slice(0, 5).join('\n')}${llmErrors.length > 5 ? `\n…รวม ${llmErrors.length} รายการ` : ''}`
        } else if (!failed) {
          detail += 'สามารถดูคำสั่งพร้อมท์บนแคนวาสหรือกด «สร้างภาพ» เพื่อตรวจสอบได้'
        }
        await dialog.alert({
          title: failed || llmErrors.length > 0 ? 'สกัดแอสเซทเสร็จสิ้น (บางส่วนล้มเหลว)' : 'สกัดแอสเซทเสร็จสิ้น',
          message: detail,
          tone: failed || llmErrors.length > 0 ? 'danger' : 'success',
        })
        return
      }
      setAssets(normalizeAssetList(result?.assets))
      const created = result.created_count ?? 0
      const refreshed = result.prompts_refreshed ?? 0
      const propsUpdated = result.props_updated ?? 0
      const llmErrors = Array.isArray(result.llm_errors) ? result.llm_errors : []
      const parts = [`สร้างใหม่ ${created} รายการ`, `อัปเดตคำสั่งพร้อมท์ ${refreshed} รายการ`]
      if (propsUpdated > 0) {
        parts.push(`อัปเดตพร็อพ ${propsUpdated} รายการ`)
      }
      let detail = `${parts.join('，')}。`
      if (created === 0 && refreshed === 0 && llmErrors.length === 0) {
        detail +=
          'ตัวละครหรือฉากที่มีอยู่แล้วจะไม่สร้างซ้ำ และไม่มีการอัปเดตคำสั่งพร้อมท์ใหม่ กรุณาตรวจสอบว่ามีสรุปเรื่องย่อและบทของแต่ละตอนแล้วจึงลองอีกครั้ง'
      } else if (llmErrors.length > 0) {
        detail += `\n\nแอสเซทต่อไปนี้อัปเดตไม่สำเร็จ:\n${llmErrors.slice(0, 5).join('\n')}${llmErrors.length > 5 ? `\n…รวม ${llmErrors.length} รายการ` : ''}`
      } else {
        detail += 'สามารถดูคำสั่งพร้อมท์บนแคนวาสหรือกด «สร้างภาพ» เพื่อตรวจสอบได้'
      }
      await dialog.alert({
        title: llmErrors.length > 0 ? 'สกัดแอสเซทเสร็จสิ้น (บางส่วนล้มเหลว)' : 'สกัดแอสเซทเสร็จสิ้น',
        message: detail,
        tone: llmErrors.length > 0 ? 'danger' : 'success',
      })
    } catch (err) {
      onError(err instanceof Error ? err.message : 'สกัดแอสเซทใหม่ล้มเหลว')
    } finally {
      setReseedBusy(false)
    }
  }

  // ข้อความปุ่มการ์ด（แสดงเมื่อมีภาพแล้ว「สร้างใหม่ภาพลักษณ์」）
  function genButtonLabel(asset: DramaAsset): string {
    const job = genQueue.find(
      (j) =>
        j.assetId === asset.id && (j.status === 'queued' || j.status === 'running'),
    )
    let queueLabel: string | null = null
    if (job) {
      if (job.status === 'running') queueLabel = 'กำลังสร้าง…'
      else {
        const queuedOnly = genQueue.filter((j) => j.status === 'queued' || j.status === 'running')
        const pos = queuedOnly.findIndex((j) => j.id === job.id) + 1
        queueLabel = pos > 0 ? (pos > 1 ? `คิวที่ #${pos}` : 'กำลังรอคิว…') : 'กำลังรอคิว…'
      }
    }
    return dramaAssetImageGenButtonLabel(asset, queueLabel)
  }

  const imageAssetCount = assetList.filter((a) => {
    const t = (a.type || '').toLowerCase()
    return !['voice', 'video', 'audio', 'text'].includes(t)
  }).length

  return (
    <div className="drama-assets-step">
      <header className="drama-assets-hero">
        <div className="drama-step-hero-main">
          <div className="drama-step-hero-icon" aria-hidden>
            <Boxes size={22} strokeWidth={1.75} />
          </div>
          <div>
            <h2>คลังแอสเซท</h2>
            <p className="drama-step-hero-sub">
              รวม <strong>{assetList.length}</strong> แอสเซท · หมวดหมู่นี้{' '}
              <strong>{filtered.length}</strong> รายการ · รอสร้างรูป <strong>{pending.length}</strong>
            </p>
          </div>
        </div>
      </header>

      <AssetBanner title="สั่งสมตัวละครและฉาก เพื่อเรื่องราวที่สมบูรณ์">จัดการตัวละคร ฉาก และพร็อพได้ตลอดเวลา เมื่อยืนยันบทละครของแต่ละตอน ระบบจะสกัดแอสเซทที่เกี่ยวข้องมาให้โดยอัตโนมัติ และสามารถสร้างหรือเพิ่มรูปภาพได้ที่นี่</AssetBanner>

      <div className="pf-library-toolbar">
        <AssetTypeFilter options={ASSET_TABS.map((item) => ({ value: item.key, label: item.label }))} value={tab} onChange={setTab} />
        <div className="drama-actions">
          {tab === 'character' ? (
            <button type="button" className="pf-btn" onClick={() => void handleAddCharacter()}>
              เพิ่มตัวละคร
            </button>
          ) : null}
          {DRAMA_VOICE_BINDING_ENABLED && tab === 'voice' ? (
            <button type="button" className="pf-btn" onClick={() => void handleAddVoice()}>
              เพิ่มเสียง
            </button>
          ) : null}
          {DRAMA_VOICE_BINDING_ENABLED && tab !== 'voice' ? (
            <button
              type="button"
              className="pf-btn"
              onClick={() => setNarratorVoiceOpen(true)}
              title="ทั่วไปเสียงบรรยายน้ำเสียง（ใช้สำหรับทุกช็อตเสียงบรรยาย reference_audio ความต่อเนื่องสม่ำเสมอ）"
              disabled={!project}
            >
              เสียงบรรยายน้ำเสียง：{narrationVoiceLabel}
            </button>
          ) : null}
          <button type="button" className="pf-btn" onClick={() => setPickerOpen(true)}>
            เลือกจากคลังแอสเซท
          </button>
          <Link className="pf-btn" to="/drama/assets">
            เรียกดูคลังแอสเซท
          </Link>
          <button
            type="button"
            className="pf-btn"
            disabled={reseedBusy || batchBusy}
            onClick={() => void handleReseedAssets()}
          >
            {reseedBusy
              ? `AI กำลังสกัดแอสเซท… (ประมาณ ${Math.max(imageAssetCount, 1)} รายการ ใช้เวลา 1–3 นาที)`
              : 'สกัดแอสเซทใหม่'}
          </button>
          {/* สร้างภาพที่ยังไม่มีในคลิกเดียว: ซ่อนไว้ชั่วคราว */}
          {tab !== 'voice' && false ? (
            <button
              type="button"
              className="drama-btn-primary"
              disabled={batchBusy || pending.length === 0}
              onClick={() => void batchGenerate()}
              title={
                pending.length > 0
                  ? `สร้างเฉพาะ ${pending.length} รายการที่ยังไม่มีภาพในหมวดหมู่นี้ (สูงสุดพร้อมกัน 3 คิว)`
                  : 'หมวดหมู่ปัจจุบันไม่มีที่ยังไม่ได้สร้างภาพแอสเซท'
              }
            >
              {batchBusy || queueBusy
                ? `กำลังสร้าง ${busyAssetIds.size}`
                : pending.length > 0
                  ? `สร้างภาพที่ยังไม่มีในคลิกเดียว (${pending.length})`
                  : 'สร้างภาพที่ยังไม่มีในคลิกเดียว'}
            </button>
          ) : null}

          {DRAMA_VOICE_BINDING_ENABLED && voiceGenerationEnabled && tab === 'character' ? (
            <button
              type="button"
              className="pf-btn pf-btn-lime"
              disabled={batchBusy || batchVoiceBusy || selectedCharacterIds.length === 0}
              onClick={() => void batchGenerateCharacterVoices()}
              title="สร้างและผูกเสียงแยกตามการตั้งค่าของแต่ละตัวละคร"
            >
              {batchVoiceBusy
                ? 'กำลังสร้างพร้อมกัน…'
                : `สร้างพร้อมกันน้ำเสียง（${selectedCharacterIds.length}）`}
            </button>
          ) : null}
          <Link className="pf-btn" to={`/drama/projects/${projectId}/canvas`}>
            เปิดผืนผ้าใบ
          </Link>
        </div>
      </div>

      {tab !== 'voice' ? (
        <div className="drama-assets-gen-opts">
          <DramaImageGenOptionsBar
            value={genOptions}
            onChange={setGenOptions}
            disabled={batchBusy}
            onStylePersist={persistStyle}
          />
        </div>
      ) : null}

      {loading ? <p className="drama-muted">กำลังสกัดแอสเซทจากบทละคร (รวมพร็อพและอุปกรณ์)…</p> : null}

      {!loading && filtered.length > 0 ? (
        <p className="drama-muted drama-assets-page-meta">
          หน้า {safePage} / {pageCount} · หมวดนี้มีทั้งหมด {filtered.length} รายการ
        </p>
      ) : null}

      <AssetGrid>
        {pageItems.map((asset) => {
          if (tab === 'voice') {
            const promptValue = voicePromptDrafts[asset.id] ?? readVoicePrompt(asset)
            const synthBusy = voiceSynthBusyId === asset.id
            return (
              <DramaVoiceAssetCard
                key={asset.id}
                asset={asset}
                promptValue={promptValue}
                synthBusy={synthBusy}
                onPromptChange={(value) =>
                  setVoicePromptDrafts((prev) => ({
                    ...prev,
                    [asset.id]: value,
                  }))
                }
                onPromptBlur={() => {
                  const draft = (voicePromptDrafts[asset.id] ?? '').trim()
                  if (draft && draft !== readVoicePrompt(asset)) {
                    void persistVoicePrompt(asset, draft).catch((err) =>
                      onError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ'),
                    )
                  }
                }}
                onSynth={voiceGenerationEnabled ? () => void handleSynthVoice(asset) : undefined}
                onDelete={() => void handleDeleteVoice(asset)}
                onError={onError}
              />
            )
          }

          const mediaSrc = resolveDramaAssetPreviewUrl(asset)
          const voice = readAssetVoiceBinding(asset)
          const isCharacter = (asset.type || '').toLowerCase() === 'character'
          const busy = busyAssetIds.has(asset.id)
          return (
            <AssetCard
              key={asset.id}
              asset={asset}
              subtitle={isCharacter && voice ? voice.label : `โปรเจกต์ #${projectId}`}
              footer="โปรเจกต์แอสเซท"
              updatedAt={asset.updated_at}
              busy={busy}
              onOpen={() => setDetailAsset(asset)}
              actions={<>
                {mediaSrc && <button type="button" className="pf-btn pf-btn-sm" onClick={() => setPreviewAsset(asset)}>ดูภาพใหญ่</button>}
                {voiceGenerationEnabled && tab === 'character' && isCharacter ? (
                  <label
                    className="drama-voice-multi-select"
                    style={{ display: 'inline-flex', gap: 8, alignItems: 'center', marginRight: 8, cursor: 'pointer' }}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCharacterIds.includes(asset.id)}
                      onChange={(e) => {
                        e.stopPropagation()
                        setSelectedCharacterIds((prev) =>
                          prev.includes(asset.id) ? prev.filter((id) => id !== asset.id) : [...prev, asset.id],
                        )
                      }}
                    />
                    <span className="drama-muted">เลือกแล้ว</span>
                  </label>
                ) : null}
                <button
                  type="button"
                  className="pf-btn pf-btn-sm"
                  disabled={busy || batchBusy}
                  onClick={() => enqueueOne(asset)}
                >
                  {genButtonLabel(asset)}
                </button>
                {isCharacter ? (
                  <>
                    {DRAMA_VOICE_BINDING_ENABLED ? (
                      voice ? (
                        <CharacterVoicePreviewButton
                          url={voice.url}
                          label={voice.label}
                          onError={onError}
                        />
                      ) : voiceGenerationEnabled ? (
                        <button
                          type="button"
                          className="pf-btn pf-btn-sm pf-btn-lime"
                          disabled={
                            batchBusy ||
                            batchVoiceBusy ||
                            characterVoiceBusyIds.has(asset.id)
                          }
                          onClick={() => void handleGenerateCharacterVoice(asset)}
                        >
                          {characterVoiceBusyIds.has(asset.id) ? 'กำลังสร้าง…' : 'สร้างเสียง'}
                        </button>
                      ) : null
                    ) : null}
                    <button
                      type="button"
                      className="pf-btn pf-btn-sm drama-btn-danger-text"
                      disabled={busy || batchBusy || batchVoiceBusy}
                      onClick={() => void handleDeleteCharacter(asset)}
                    >
                      ลบ
                    </button>
                  </>
                ) : null}
              </>}
            />
          )
        })}
      </AssetGrid>
      {!loading && filtered.length === 0 ? <AssetEmpty /> : null}

      {!loading && filtered.length > 0 ? (
        <Pagination
          page={safePage}
          pageCount={pageCount}
          total={filtered.length}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
          onChange={setPage}
          ariaLabel="การแบ่งหน้าคลังแอสเซท"
          className="drama-assets-pagination"
        />
      ) : null}

      {detailAsset && (detailAsset.type || '').toLowerCase() !== 'voice' ? (
        <EditableAssetDetailDialog
          asset={detailAsset}
          open
          busy={busyAssetIds.has(detailAsset.id)}
          genLabel={genButtonLabel(detailAsset)}
          onClose={() => setDetailAsset(null)}
          onUpdated={(updated) => {
            setAssets((prev) => (prev ?? []).map((a) => (a.id === updated.id ? updated : a)))
            setDetailAsset(updated)
          }}
          onGenerate={(a) => enqueueOne(a)}
          onBindVoice={DRAMA_VOICE_BINDING_ENABLED ? (a) => setVoiceAsset(a) : undefined}
          onDelete={(a) => {
            setDetailAsset(null)
            void handleDeleteCharacter(a)
          }}
          onError={onError}
        />
      ) : null}

      {previewAsset && <AssetDetailDialog asset={previewAsset} onClose={() => setPreviewAsset(null)} />}

      {DRAMA_VOICE_BINDING_ENABLED && voiceAsset ? (
        <CharacterVoiceBindModal
          asset={voiceAsset}
          projectId={projectId}
          open
          onClose={() => setVoiceAsset(null)}
          onBound={(updated) => {
            handleVoiceBound(updated)
            setDetailAsset((prev) => (prev?.id === updated.id ? updated : prev))
          }}
          onError={onError}
        />
      ) : null}

      {DRAMA_VOICE_BINDING_ENABLED && project ? (
        <NarratorVoiceBindModal
          project={project}
          open={narratorVoiceOpen}
          onClose={() => setNarratorVoiceOpen(false)}
          onUpdated={(p) => setProject(p)}
          onError={onError}
        />
      ) : null}

      <GlobalAssetPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        projectId={projectId}
        defaultTab={tab === 'voice' ? 'voice' : tab}
        title="นำเข้าจากคลังแอสเซท"
        confirmLabel="นำเข้าไปยังเครื่องนี้โปรเจกต์"
        onPick={handleImportFromLibrary}
      />
    </div>
  )
}
