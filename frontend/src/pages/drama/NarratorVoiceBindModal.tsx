/**
 * เสียงบรรยายน้ำเสียง绑定：从ละครซีรีส์ voice แอสเซทเลือก，写入 project.params.narrationVoiceAudio
 * 供 Seedance 生成时作为ทั่วไป reference_audio 注入。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AudioLines } from 'lucide-react'
import { dramaApi, resolveDramaMediaUrl, type DramaAsset, type DramaProject } from '../../api/drama'
import Modal from '../../components/ui/Modal'
import { AssetCard, AssetEmpty, AssetGrid } from '../../components/assets/AssetLibrary'
import type { VoiceBinding } from './CharacterVoiceBindModal'

type Props = {
  project: DramaProject
  open: boolean
  onClose: () => void
  onUpdated: (project: DramaProject) => void
  onError: (message: string) => void
}

function readNarrationVoiceBinding(project: DramaProject): VoiceBinding | null {
  const params = project.params || {}
  const raw = (params as Record<string, unknown>).narrationVoiceAudio
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  const sourceAssetId = typeof data.sourceAssetId === 'number' ? data.sourceAssetId : null
  const url = typeof data.url === 'string' ? data.url : ''
  const label = typeof data.label === 'string' ? data.label : 'เสียงบรรยายน้ำเสียง'
  if (!sourceAssetId || !url) return null
  return {
    sourceAssetId,
    url,
    label,
    voicePrompt: typeof data.voicePrompt === 'string' ? data.voicePrompt : undefined,
  }
}

export function NarratorVoiceBindModal({ project, open, onClose, onUpdated, onError }: Props) {
  const [voiceAssets, setVoiceAssets] = useState<DramaAsset[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const current = useMemo(() => readNarrationVoiceBinding(project), [project])

  const selectedVoice = useMemo(
    () => voiceAssets.find((v) => v.id === selectedId) || null,
    [voiceAssets, selectedId],
  )
  const previewUrl = selectedVoice?.url ? resolveDramaMediaUrl(selectedVoice.url) : ''

  const boundRef = useRef(false)
  useEffect(() => {
    if (!open) {
      boundRef.current = false
      return
    }
    if (boundRef.current) return
    boundRef.current = true

    setSelectedId(current?.sourceAssetId ?? null)
    dramaApi
      .listAssets(project.id)
      .then((list) => {
        const voices = list.filter((a) => (a.type || '').toLowerCase() === 'voice')
        setVoiceAssets(voices)
      })
      .catch((err) => onError(err instanceof Error ? err.message : '加载น้ำเสียงแอสเซทล้มเหลว'))
  }, [current?.sourceAssetId, onError, open, project.id])

  const handleConfirm = useCallback(async () => {
    if (!selectedVoice?.url || busy) {
      onError('请เลือก已合成试听的เสียงบรรยายน้ำเสียง')
      return
    }
    setBusy(true)
    try {
      const binding: VoiceBinding = {
        sourceAssetId: selectedVoice.id,
        url: selectedVoice.url,
        label: selectedVoice.name || 'เสียงบรรยายน้ำเสียง',
        // Narrator 端当前不依赖 voicePrompt；但保留字段给后续扩展
        voicePrompt:
          selectedVoice.params && typeof selectedVoice.params === 'object' && typeof (selectedVoice.params as any).voicePrompt === 'string'
            ? (selectedVoice.params as any).voicePrompt
            : undefined,
      }
      const nextParams = {
        ...(project.params || {}),
        narrationVoiceAudio: binding,
      }
      const updated = await dramaApi.updateProject(project.id, { params: nextParams })
      onUpdated(updated)
      onClose()
    } catch (err) {
      onError(err instanceof Error ? err.message : '绑定ล้มเหลว')
    } finally {
      setBusy(false)
    }
  }, [busy, onClose, onError, onUpdated, project.id, project.params, selectedVoice])

  const handleUnbind = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      const nextParams = { ...(project.params || {}) }
      delete (nextParams as Record<string, unknown>).narrationVoiceAudio
      const updated = await dramaApi.updateProject(project.id, { params: nextParams })
      onUpdated(updated)
      onClose()
    } catch (err) {
      onError(err instanceof Error ? err.message : '解绑ล้มเหลว')
    } finally {
      setBusy(false)
    }
  }, [busy, onClose, onError, onUpdated, project.id, project.params])

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="绑定เสียงบรรยายน้ำเสียง"
      size="lg"
      dismissible={!busy}
      footer={
        <>
          <button type="button" className="pf-btn" onClick={onClose} disabled={busy}>
            ยกเลิก
          </button>
          {current ? (
            <button type="button" className="pf-btn" onClick={() => void handleUnbind()} disabled={busy}>
              解除绑定
            </button>
          ) : null}
          <button
            type="button"
            className="pf-btn pf-btn-lime"
            onClick={() => void handleConfirm()}
            disabled={!selectedVoice?.url || busy}
          >
            {busy ? '绑定中…' : '确认绑定'}
          </button>
        </>
      }
    >
      <p className="drama-muted">
        ทั่วไปเสียงบรรยายน้ำเสียง将作为 Seedance 的 <strong>reference_audio</strong> 注入，用于所有镜头的เสียงบรรยาย口播ความต่อเนื่องสม่ำเสมอ。
      </p>

      <AssetGrid picker>
        {voiceAssets.length === 0 ? (
          <AssetEmpty>暂无น้ำเสียงแอสเซท，请先在「น้ำเสียง」分类合成เสียงบรรยายน้ำเสียง。</AssetEmpty>
        ) : (
          voiceAssets.map((voice) => {
            const hasAudio = Boolean(voice.url)
            const selected = selectedId === voice.id
            return (
              <AssetCard key={voice.id} asset={voice} selected={selected} subtitle={hasAudio ? '已合成' : '未合成'} footer="โปรเจกต์น้ำเสียง" onOpen={() => setSelectedId(voice.id)} />
            )
          })
        )}
      </AssetGrid>

      {previewUrl ? (
        <div style={{ marginTop: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
          <AudioLines size={16} />
          <audio className="drama-voice-audio" controls src={previewUrl} />
        </div>
      ) : null}
    </Modal>
  )
}

