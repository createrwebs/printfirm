/** ทั่วไปแอสเซท库เลือก弹窗：跨โปรเจกต์挑选รูปภาพแอสเซท（导入或应用到节点） */
import { useEffect, useMemo, useState } from 'react'
import { dramaApi, type DramaAsset } from '../../api/drama'
import { filterDramaLibraryAssets, isDramaLibraryAsset } from '../../lib/dramaLibraryAssets'
import { DRAMA_VOICE_BINDING_ENABLED } from '../../lib/dramaVoiceBinding'
import BillingErrorNotice from '../../components/billing/BillingErrorNotice'
import Modal from '../../components/ui/Modal'
import { AssetBanner, AssetCard, AssetEmpty, AssetGrid, AssetSearch, AssetTypeFilter } from '../../components/assets/AssetLibrary'
import { teamsApi } from '../../api/teams'
import { projectTeam } from '../../features/teams/editLocks'
import { TeamPagination } from '../../features/teams/TeamPagination'
import './drama.css'

export type GlobalAssetTabKey = 'character' | 'scene' | 'prop' | 'voice' | 'all'

type Props = {
  open: boolean
  onClose: () => void
  /** 当前โปรเจกต์ ID，用于标注ที่มา与可选排除本项 */
  projectId: number
  /** ค่าเริ่มต้น Tab；canvas ฉาก可传 all */
  defaultTab?: GlobalAssetTabKey
  /** 限定可选แอสเซท type 列表；不传则按 Tab ตัวกรอง */
  allowedTypes?: string[]
  /** 标题 */
  title?: string
  /** 确认按钮文案 */
  confirmLabel?: string
  onPick: (asset: DramaAsset) => void | Promise<void>
}

const TABS: Array<{ key: GlobalAssetTabKey; label: string }> = [
  { key: 'character', label: 'ตัวละคร' },
  { key: 'scene', label: 'ฉาก' },
  { key: 'prop', label: 'อุปกรณ์/พร็อพ' },
  ...(DRAMA_VOICE_BINDING_ENABLED ? [{ key: 'voice' as const, label: 'น้ำเสียง' }] : []),
]

// แอสเซท是否匹配 Tab
function matchAssetTab(asset: DramaAsset, tab: GlobalAssetTabKey): boolean {
  if (!isDramaLibraryAsset(asset)) return false
  if (tab === 'all') return true
  const t = (asset.type || '').toLowerCase()
  if (tab === 'voice') return t === 'voice'
  return t === tab
}

// asset visible in picker (voice/audio with url; image needs cover/url)
function hasMedia(asset: DramaAsset): boolean {
  const t = (asset.type || '').toLowerCase()
  if (t === 'voice' || t === 'audio') return Boolean(asset.url || asset.cover)
  return Boolean(asset.url || asset.cover)
}

// เรนเดอร์ทั่วไปแอสเซท库เลือก弹窗（使用ทั่วไป Modal）
export function GlobalAssetPickerModal({
  open,
  onClose,
  projectId,
  defaultTab = 'character',
  allowedTypes,
  title = 'เลือกจากคลังแอสเซท',
  confirmLabel = 'ยืนยันการใช้งาน',
  onPick,
}: Props) {
  /*
   * allAssets 用户全部โปรเจกต์แอสเซท
   * tab 当前分类
   * query ค้นหา词
   * selectedId 选中แอสเซท
   * loading กำลังโหลด
   * busy ส่ง中
   * error 错误文案
   */
  const [allAssets, setAllAssets] = useState<DramaAsset[]>([])
  const [tab, setTab] = useState<GlobalAssetTabKey>(
    defaultTab === 'voice' && !DRAMA_VOICE_BINDING_ENABLED ? 'character' : defaultTab,
  )
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const allowedTypesKey = allowedTypes?.join(',') || ''

  useEffect(() => {
    if (!open) return
    setTab(
      defaultTab === 'voice' && !DRAMA_VOICE_BINDING_ENABLED ? 'character' : defaultTab,
    )
    setQuery('')
    setSelectedId(null)
    setError('')
    setPage(1)
  }, [open, defaultTab])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    let active = true
    setLoading(true); setError('')
    const timer = window.setTimeout(() => {
      void projectTeam(projectId).then(async (teamId) => {
        if (teamId === null) { const rows = await dramaApi.listAssets(undefined, { libraryOnly: true }); if (active) { setAllAssets(filterDramaLibraryAssets(rows)); setTotal(0) }; return }
        const kind = allowedTypesKey && !allowedTypesKey.includes(',') ? allowedTypesKey : tab === 'all' ? undefined : tab
        const result = await teamsApi.assets(String(teamId), { page, page_size: 12, q: query, type: kind }, controller.signal)
        if (active) { setAllAssets(result.items.map((asset) => ({ id: Number(asset.id), name: asset.name, type: asset.type, asset_type: asset.type === 'voice' ? 'audio' : 'image', url: asset.url, cover: asset.cover, project_id: Number(asset.projectId) }))); setTotal(result.meta.total) }
      }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'โหลดคลังแอสเซทไม่สำเร็จ') }).finally(() => { if (active) setLoading(false) })
    }, 180)
    return () => { active = false; controller.abort(); window.clearTimeout(timer) }
  }, [open, projectId, query, tab, page, allowedTypesKey])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allAssets.filter((asset) => {
      if (!hasMedia(asset)) return false
      if (allowedTypes?.length) {
        const t = (asset.type || '').toLowerCase()
        if (!allowedTypes.includes(t)) {
          return false
        }
      } else if (!matchAssetTab(asset, tab)) {
        return false
      }
      if (!q) return true
      const name = (asset.name || '').toLowerCase()
      return name.includes(q) || String(asset.project_id).includes(q)
    })
  }, [allAssets, allowedTypes, query, tab])

  // 确认选用แอสเซท
  async function handleConfirm() {
    const picked = allAssets.find((a) => a.id === selectedId)
    if (!picked || busy) return
    setBusy(true)
    setError('')
    try {
      await onPick(picked)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'นำไปใช้ไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const showTabs = !allowedTypes?.length && defaultTab !== 'all'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      dismissible={!busy}
      className="drama-global-picker-modal"
      footer={
        <>
          <button type="button" className="pf-btn" onClick={onClose} disabled={busy}>
            ยกเลิก
          </button>
          <button
            type="button"
            className="pf-btn pf-btn-lime"
            disabled={!selectedId || busy}
            onClick={() => void handleConfirm()}
          >
            {busy ? 'กำลังประมวลผล…' : confirmLabel}
          </button>
        </>
      }
    >
      <AssetBanner>แสดงแอสเซทที่ใช้งานได้ในพื้นที่ทำงานปัจจุบัน การใช้งานข้ามโปรเจกต์จะคัดลอกมายังโปรเจกต์ปัจจุบัน</AssetBanner>
      <div className="pf-library-toolbar">
        {showTabs && <AssetTypeFilter options={TABS.map((item) => ({ value: item.key, label: item.label }))} value={tab} onChange={(value) => { setTab(value); setPage(1); setSelectedId(null) }} />}
        <AssetSearch value={query} onChange={(value) => { setQuery(value); setPage(1); setSelectedId(null) }} placeholder="ค้นหาชื่อหรือรหัสโปรเจกต์" />
      </div>

      {error ? <BillingErrorNotice message={error} className="drama-error" /> : null}
      {loading ? <p className="drama-muted">กำลังโหลดคลังแอสเซท…</p> : null}

      <AssetGrid picker>
        {filtered.map((asset) => <AssetCard
          key={asset.id}
          asset={asset}
          selected={selectedId === asset.id}
          subtitle={asset.project_id === projectId ? 'โปรเจกต์นี้' : `โปรเจกต์ #${asset.project_id}`}
          footer={asset.type === 'voice' ? asset.url ? 'สังเคราะห์เสียงแล้ว' : 'ยังไม่ได้สังเคราะห์เสียง' : 'สามารถคัดลอกมายังโปรเจกต์นี้'}
          onOpen={() => setSelectedId(asset.id)}
        />)}
      </AssetGrid>
      <TeamPagination page={page} total={total} onChange={setPage} />
      {!loading && filtered.length === 0 ? (
        <AssetEmpty>ยังไม่มีสื่อที่ใช้งานได้ในหมวดหมู่นี้ กรุณาสร้างแอสเซทในโปรเจกต์ก่อน</AssetEmpty>
      ) : null}
    </Modal>
  )
}

// 将外部แอสเซทคัดลอก到当前โปรเจกต์（导入）
export async function importGlobalAssetToProject(
  projectId: number,
  source: DramaAsset,
): Promise<DramaAsset> {
  if (!source.url && !source.cover) {
    throw new Error('แอสเซทที่เลือกไม่มีรูปภาพที่ใช้งานได้')
  }
  return dramaApi.copyAsset(source, projectId)
}

// 画布 kind → แอสเซท type ตัวกรอง
export function canvasKindToLibraryTypes(kind: string): string[] {
  if (kind === 'character') return ['character']
  if (kind === 'scene') return ['scene']
  if (kind === 'audio') return DRAMA_VOICE_BINDING_ENABLED ? ['audio', 'voice'] : ['audio']
  return ['prop', 'image']
}
