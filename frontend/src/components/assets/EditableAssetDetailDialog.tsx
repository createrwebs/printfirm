import { useTeamEditLock } from '../../features/teams/useTeamEditLock'
/** รายละเอียดแอสเซทการดำเนินการ框：ดูตัวอย่าง图、อัปโหลด/生图คำแนะนำ词แก้ไข、生成/น้ำเสียง、形象历史版本 */
import { useEffect, useRef, useState } from 'react'
import { dramaApi, type DramaAsset } from '../../api/drama'
import { AssetDetailDialog } from './AssetDetailDialog'
import { readVisualPrompt } from '../../lib/dramaVisualPrompt'
import { dramaAssetHasImage } from '../../lib/dramaAssetImage'
import {
  formatAssetImageVersionLabel,
  readAssetImageVersions,
  resolveAssetImageVersionUrl,
} from '../../lib/dramaAssetImageVersions'
import { readAssetVoiceBinding } from '../../pages/drama/CharacterVoiceBindModal'

type Props = {
  asset: DramaAsset
  open: boolean
  readOnly?: boolean
  busy?: boolean
  genLabel?: string
  onClose: () => void
  onUpdated: (asset: DramaAsset) => void
  onGenerate: (asset: DramaAsset) => void
  onBindVoice?: (asset: DramaAsset) => void
  onDelete?: (asset: DramaAsset) => void
  onError: (message: string) => void
}

// 将แก้ไข后的คำแนะนำ词写回 params.visualPrompt
function buildPromptParams(asset: DramaAsset, prompt: string): Record<string, unknown> {
  const prev = (asset.params || {}) as Record<string, unknown>
  const kind = (asset.type || '').toLowerCase()
  const next: Record<string, unknown> = {
    ...prev,
    visualPrompt: prompt.trim(),
  }
  if (kind === 'character' || kind === 'scene') {
    next.visualImage = prompt.trim()
  }
  return next
}

// เรนเดอร์รายละเอียดแอสเซทการดำเนินการ弹窗
export function EditableAssetDetailDialog({
  asset,
  open,
  readOnly = false,
  busy = false,
  genLabel = 'สร้างรูปภาพ',
  onClose,
  onUpdated,
  onGenerate,
  onBindVoice,
  onDelete,
  onError,
}: Props) {
  /*
   * promptDraft คำแนะนำ词ฉบับร่าง
   * saving กำลังบันทึก
   * uploading อัปโหลดรูปภาพ中
   * restoringVersionId 正在还原的版本
   * lightboxSrc ขยายขนาดดูตัวอย่าง图 URL
   */
  const [promptDraft, setPromptDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const hasImage = dramaAssetHasImage(asset)
  const voice = readAssetVoiceBinding(asset)
  const isCharacter = (asset.type || '').toLowerCase() === 'character'
  const isScene = (asset.type || '').toLowerCase() === 'scene'
  const isProp =
    (asset.type || '').toLowerCase() === 'prop' ||
    (asset.type || '').toLowerCase() === 'material'
  const deleteLabel = isScene ? 'ลบฉาก' : isProp ? 'ลบอุปกรณ์/พร็อพ' : 'ลบตัวละคร'
  const canDelete = Boolean(onDelete) && (isCharacter || isScene || isProp)
  const dirty = promptDraft.trim() !== readVisualPrompt(asset).trim()
  const imageVersions = readAssetImageVersions(asset)
  const lock = useTeamEditLock({ projectId: asset.project_id, type: 'asset', resourceId: asset.id }, open && !readOnly, async (isCurrent) => { const rows = await dramaApi.listAssets(asset.project_id); const fresh = rows.find((item) => item.id === asset.id); if (!fresh) throw new Error('แอสเซทถูกลบไปแล้ว กรุณาปิดแล้วโหลดใหม่'); if (isCurrent()) onUpdated(fresh) })
  const actionBusy = readOnly || lock.readOnly || busy || saving || uploading || Boolean(restoringVersionId)

  useEffect(() => {
    if (!open) return
    setPromptDraft(readVisualPrompt(asset))
    setLightboxSrc(null)
    setRestoringVersionId(null)
  }, [open, asset])

  // บันทึกคำแนะนำ词到แอสเซท params
  async function savePrompt() {
    if (actionBusy) return
    const text = promptDraft.trim()
    if (!text) {
      onError('คำสั่งพร้อมท์ต้องไม่เว้นว่าง')
      return
    }
    setSaving(true)
    try {
      const updated = await dramaApi.updateAsset(asset.id, {
        params: buildPromptParams(asset, text),
      })
      onUpdated(updated)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'บันทึกคำสั่งพร้อมท์ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  // 先บันทึก脏คำแนะนำ词再触发生图
  async function handleGenerate() {
    if (actionBusy) return
    if (dirty) {
      const text = promptDraft.trim()
      if (!text) {
        onError('คำสั่งพร้อมท์ต้องไม่เว้นว่าง')
        return
      }
      setSaving(true)
      try {
        const updated = await dramaApi.updateAsset(asset.id, {
          params: buildPromptParams(asset, text),
        })
        onUpdated(updated)
        onGenerate(updated)
      } catch (err) {
        onError(err instanceof Error ? err.message : 'บันทึกคำสั่งพร้อมท์ไม่สำเร็จ')
      } finally {
        setSaving(false)
      }
      return
    }
    onGenerate(asset)
  }

  // 本地อัปโหลดรูปภาพ，视为已出图
  async function handleUpload(file: File) {
    if (actionBusy) return
    setUploading(true)
    try {
      const updated = await dramaApi.uploadAssetMedia(asset.id, file)
      onUpdated(updated)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'อัปโหลดรูปภาพไม่สำเร็จ')
    } finally {
      setUploading(false)
      if (uploadInputRef.current) uploadInputRef.current.value = ''
    }
  }

  // 将历史形象还原为当前
  async function handleRestoreVersion(versionId: string) {
    if (actionBusy) return
    setRestoringVersionId(versionId)
    try {
      const updated = await dramaApi.activateAssetImageVersion(asset.id, versionId)
      onUpdated(updated)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'กู้คืนเวอร์ชันไม่สำเร็จ')
    } finally {
      setRestoringVersionId(null)
    }
  }

  // 媒体รายละเอียด保持统一，当前业务仅提供แก้ไข与历史การดำเนินการ。
  const history = imageVersions.find((item) => resolveAssetImageVersionUrl(item) === lightboxSrc)
  return <>
    <AssetDetailDialog
      asset={asset}
      open={open}
      onClose={onClose}
      notice={readOnly ? <p className="drama-muted" role="status">โหมดดูอย่างเดียว</p> : lock.readOnly ? <p className="pf-team-alert" role="status">{lock.checking ? 'กำลังตรวจสอบสิทธิ์การแก้ไข…' : lock.error}<button type="button" onClick={lock.retry}>ลองใหม่อีกครั้ง</button></p> : undefined}
      actions={!readOnly && <button type="button" className="pf-btn pf-btn-lime" disabled={actionBusy || !promptDraft.trim()} onClick={() => void handleGenerate()}>{busy ? 'กำลังสร้าง…' : genLabel}</button>}
    >
      {!readOnly && <details className="pf-asset-detail-editor">
        <summary>แก้ไขคำสั่งพร้อมท์สำหรับการสร้างครั้งถัดไป</summary>
        <label><span className="sr-only">คำสั่งพร้อมท์สร้างภาพ</span><textarea rows={5} value={promptDraft} readOnly={lock.readOnly} onChange={(event) => setPromptDraft(event.target.value)} placeholder="ระบุลักษณะภายนอก องค์ประกอบภาพ แสงเงา และสไตล์…" /></label>
        <div className="pf-asset-detail-edit-actions">
          <button type="button" className="pf-btn pf-btn-sm" disabled={saving || !dirty || actionBusy} onClick={() => void savePrompt()}>{saving ? 'กำลังบันทึก…' : 'บันทึกคำสั่งพร้อมท์'}</button>
        </div>
      </details>}
      {!readOnly && <div className="pf-asset-detail-edit-actions">
        <input ref={uploadInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" disabled={actionBusy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleUpload(file) }} />
        <button type="button" className="pf-btn pf-btn-sm" disabled={actionBusy} onClick={() => uploadInputRef.current?.click()}>{uploading ? 'กำลังอัปโหลด…' : hasImage ? 'เปลี่ยนรูปภาพ' : 'อัปโหลดรูปภาพ'}</button>
        {isCharacter && onBindVoice && <button type="button" className="pf-btn pf-btn-sm" disabled={actionBusy} onClick={() => onBindVoice(asset)}>{voice ? 'เปลี่ยนเสียง' : 'ผูกเสียง'}</button>}
        {canDelete && <button type="button" className="pf-btn pf-btn-sm drama-btn-danger-text" disabled={actionBusy} onClick={() => onDelete?.(asset)}>{deleteLabel}</button>}
      </div>}
      {imageVersions.length > 0 && <details className="pf-asset-detail-history">
        <summary>เวอร์ชันประวัติ · {imageVersions.length} รายการ</summary>
        <ul className="pf-asset-detail-versions">{imageVersions.map((version) => <li key={version.id}>
          <button type="button" className="pf-asset-detail-version-thumb" title="ดูรายละเอียดเวอร์ชันประวัติ" onClick={() => setLightboxSrc(resolveAssetImageVersionUrl(version))}><img src={resolveAssetImageVersionUrl(version)} alt="" /></button>
          <div className="pf-asset-detail-version-info"><span>{formatAssetImageVersionLabel(version)}</span>{version.createdAt && <small>{version.createdAt.replace('T', ' ').slice(0, 16)}</small>}</div>
          {!readOnly && <button type="button" className="pf-btn pf-btn-sm" disabled={actionBusy} onClick={() => void handleRestoreVersion(version.id)}>{restoringVersionId === version.id ? 'กำลังกู้คืน…' : 'กู้คืน'}</button>}
        </li>)}</ul>
      </details>}
    </AssetDetailDialog>
    {lightboxSrc && <AssetDetailDialog asset={{ ...asset, name: `${asset.name || 'แอสเซท'} · เวอร์ชันประวัติ`, cover: lightboxSrc, url: lightboxSrc, references: undefined, params: { media_metadata: history?.mediaMetadata || { source: 'unknown' } } }} onClose={() => setLightboxSrc(null)} />}
  </>
}
