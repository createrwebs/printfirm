/** 选中节点顶部：本地อัปโหลด + 从ทั่วไปแอสเซท库เลือก + ตัวละครน้ำเสียง生成/绑定/试听 */
import { useCallback, useRef, useState, type ChangeEvent, type MouseEvent } from 'react'
import { AudioLines, FolderOpen, Loader2, Upload } from 'lucide-react'
import { dramaApi, type DramaAsset } from '../../../../api/drama'
import { CharacterVoicePreviewButton } from '../../../../components/drama/CharacterVoicePreviewButton'
import { generateAndBindCharacterVoice } from '../../../../lib/characterVoiceGenerate'
import { DRAMA_VOICE_BINDING_ENABLED } from '../../../../lib/dramaVoiceBinding'
import { useCharacterVoiceGenerationEnabled } from '../../../../hooks/usePublicCapabilities'
import { VOICE_GENERATION_DISABLED_MESSAGE } from '../../../../lib/publicCapabilities'
import { CharacterVoiceBindModal } from '../../CharacterVoiceBindModal'
import { useCanvasStore } from '../CanvasStore'
import { CANVAS_UPLOADABLE_KINDS, type CanvasNodeKind } from '../canvasTypes'
import {
  canvasKindToLibraryTypes,
  GlobalAssetPickerModal,
} from '../../GlobalAssetPickerModal'

type CanvasNodeUploadBarProps = {
  nodeId: string
  kind: CanvasNodeKind
  /** ตัวละคร节点已ผูกน้ำเสียง名 */
  voiceLabel?: string | null
  /** ตัวละคร节点已ผูกน้ำเสียง试听地址 */
  voiceUrl?: string | null
}

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'
const AUDIO_ACCEPT =
  'audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/m4a,audio/aac,audio/ogg,audio/webm,.mp3,.wav,.m4a,.aac,.ogg,.webm'

/** เรนเดอร์选中节点的อัปโหลด与แอสเซท库การดำเนินการ条 */
export function CanvasNodeUploadBar({
  nodeId,
  kind,
  voiceLabel,
  voiceUrl,
}: CanvasNodeUploadBarProps) {
  const voiceGenerationEnabled = useCharacterVoiceGenerationEnabled()
  /*
   * uploading 本地กำลังอัปโหลด
   * pickerOpen แอสเซท库弹窗
   * voiceLoading 一键生成น้ำเสียง中
   * bindOpen 绑定/เปลี่ยน弹窗
   * bindAsset 弹窗用แอสเซทตัวละคร快照
   * bindBusy 打开弹窗前拉แอสเซท中
   */
  const {
    uploadNodeMedia,
    applyLibraryMediaToNode,
    syncNodeFromAsset,
    ensureNodeAsset,
    setErrorMessage,
    projectId,
  } = useCanvasStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [voiceLoading, setVoiceLoading] = useState(false)
  const [bindOpen, setBindOpen] = useState(false)
  const [bindAsset, setBindAsset] = useState<DramaAsset | null>(null)
  const [bindBusy, setBindBusy] = useState(false)

  const stopFlowEvent = useCallback((event: MouseEvent) => {
    event.stopPropagation()
  }, [])

  if (!CANVAS_UPLOADABLE_KINDS.has(kind)) return null

  const isCharacter = kind === 'character'
  const isAudio = kind === 'audio'
  const hasVoice = Boolean(voiceUrl || voiceLabel)
  const uploadLabel = isAudio ? 'อัปโหลดเสียง' : 'อัปโหลดรูปภาพ'
  const accept = isAudio ? AUDIO_ACCEPT : IMAGE_ACCEPT
  const toolbarBusy = uploading || voiceLoading || bindBusy

  /** 确保แอสเซทตัวละคร存在并打开绑定弹窗 */
  async function openVoiceBindModal() {
    if (bindBusy || voiceLoading) return
    setBindBusy(true)
    try {
      const assetId = await ensureNodeAsset(nodeId)
      const list = await dramaApi.listAssets(projectId)
      const asset = list.find((a) => a.id === assetId)
      if (!asset) throw new Error('ไม่พบแอสเซทตัวละคร')
      setBindAsset(asset)
      setBindOpen(true)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'ไม่สามารถเปิดหน้าต่างผูกน้ำเสียงได้')
    } finally {
      setBindBusy(false)
    }
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (isAudio) {
      const name = (file.name || '').toLowerCase()
      const okType =
        file.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|webm)$/i.test(name)
      if (!okType) {
        setErrorMessage('กรุณาเลือกไฟล์เสียง (MP3 / WAV / M4A ฯลฯ)')
        return
      }
      if (file.size > 30 * 1024 * 1024) {
        setErrorMessage('ไฟล์เสียงต้องมีขนาดไม่เกิน 30MB')
        return
      }
    } else {
      if (!file.type.startsWith('image/')) {
        setErrorMessage('กรุณาเลือกไฟล์รูปภาพ')
        return
      }
      if (file.size > 20 * 1024 * 1024) {
        setErrorMessage('รูปภาพต้องมีขนาดไม่เกิน 20MB')
        return
      }
    }

    setUploading(true)
    void uploadNodeMedia(nodeId, file)
      .catch((err) => setErrorMessage(err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ'))
      .finally(() => setUploading(false))
  }

  /** 一键 AI 生成น้ำเสียง并绑定到ตัวละคร节点 */
  async function handleGenerateVoice() {
    if (!voiceGenerationEnabled) { setErrorMessage(VOICE_GENERATION_DISABLED_MESSAGE); return }
    if (voiceLoading) return
    setVoiceLoading(true)
    try {
      const assetId = await ensureNodeAsset(nodeId)
      const list = await dramaApi.listAssets(projectId)
      const asset = list.find((a) => a.id === assetId)
      if (!asset) throw new Error('ไม่พบแอสเซทตัวละคร')
      const { character } = await generateAndBindCharacterVoice(projectId, asset)
      // syncNodeFromAsset 内部 markDirty，写入 voiceLabel/voiceUrl 并触发自动บันทึก
      syncNodeFromAsset(nodeId, character)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'น้ำเสียงสร้างไม่สำเร็จ')
    } finally {
      setVoiceLoading(false)
    }
  }

  return (
    <>
      <div
        className="fc-node-toolbar nodrag nopan"
        onMouseDown={stopFlowEvent}
        onPointerDown={stopFlowEvent}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="fc-hidden-input"
          onChange={handleFileChange}
        />
        <button
          type="button"
          className="fc-toolbar-chip"
          disabled={toolbarBusy}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Loader2 size={14} className="fc-spin" /> : <Upload size={14} strokeWidth={1.8} />}
          {uploading ? 'กำลังอัปโหลด…' : uploadLabel}
        </button>
        <button
          type="button"
          className="fc-toolbar-chip"
          disabled={toolbarBusy}
          onClick={() => setPickerOpen(true)}
        >
          <FolderOpen size={14} strokeWidth={1.8} />
          เลือกจากคลังแอสเซท
        </button>
        {DRAMA_VOICE_BINDING_ENABLED && isCharacter ? (
          hasVoice && voiceUrl ? (
            <>
              <CharacterVoicePreviewButton
                url={voiceUrl}
                label={voiceLabel || undefined}
                variant="chip"
                className="is-active"
                onError={setErrorMessage}
              />
              <button
                type="button"
                className="fc-toolbar-chip"
                disabled={toolbarBusy}
                onClick={() => void openVoiceBindModal()}
                title="เปลี่ยนหรือยกเลิกการผูกน้ำเสียง หรือเชื่อมต่อไปยังโหนดเสียงอื่น"
              >
                {bindBusy ? <Loader2 size={14} className="fc-spin" /> : <AudioLines size={14} strokeWidth={1.8} />}
                {bindBusy ? 'กำลังเปิด...' : 'เปลี่ยน'}
              </button>
            </>
          ) : (
            <>
              {voiceGenerationEnabled && <button
                type="button"
                className="fc-toolbar-chip"
                disabled={toolbarBusy}
                onClick={() => void handleGenerateVoice()}
                title="สร้างน้ำเสียงด้วย AI ตามการตั้งค่าบทบาทตัวละคร"
              >
                {voiceLoading ? (
                  <Loader2 size={14} className="fc-spin" />
                ) : (
                  <AudioLines size={14} strokeWidth={1.8} />
                )}
                {voiceLoading ? 'กำลังสร้าง...' : 'สร้างน้ำเสียง'}
              </button>}
              <button
                type="button"
                className="fc-toolbar-chip"
                disabled={toolbarBusy}
                onClick={() => void openVoiceBindModal()}
                title="อัปโหลด/เลือกน้ำเสียง หรือเชื่อมต่อโหนดเสียงกับตัวละครนี้"
              >
                {bindBusy ? <Loader2 size={14} className="fc-spin" /> : null}
                {bindBusy ? 'กำลังเปิด…' : 'ผูกน้ำเสียง'}
              </button>
            </>
          )
        ) : null}
      </div>

      <GlobalAssetPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        projectId={projectId}
        defaultTab="all"
        allowedTypes={canvasKindToLibraryTypes(kind)}
        title="เลือกจากคลังแอสเซท"
        confirmLabel="确认使用"
        onPick={async (source) => {
          await applyLibraryMediaToNode(nodeId, source)
        }}
      />

      {DRAMA_VOICE_BINDING_ENABLED && bindAsset ? (
        <CharacterVoiceBindModal
          asset={bindAsset}
          projectId={projectId}
          open={bindOpen}
          onClose={() => {
            setBindOpen(false)
            setBindAsset(null)
          }}
          onBound={(updated) => {
            syncNodeFromAsset(nodeId, updated)
            setBindOpen(false)
            setBindAsset(null)
          }}
          onError={setErrorMessage}
        />
      ) : null}
    </>
  )
}
