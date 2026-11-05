/** ตัวละครน้ำเสียง绑定：เลือก / อัปโหลด / AI 合成试听，写入 params.voiceAudio */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { dramaApi, resolveDramaMediaUrl, type DramaAsset } from '../../api/drama'
import Modal from '../../components/ui/Modal'
import { AssetCard, AssetEmpty, AssetGrid, AssetTypeFilter } from '../../components/assets/AssetLibrary'
import { useCharacterVoiceGenerationEnabled } from '../../hooks/usePublicCapabilities'
import { VOICE_GENERATION_DISABLED_MESSAGE } from '../../lib/publicCapabilities'

const AUDIO_ACCEPT = 'audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/m4a,.mp3,.wav,.m4a'

/** 是否可作为ตัวละครน้ำเสียงแอสเซท */
function isVoiceLikeAsset(asset: DramaAsset): boolean {
  const t = (asset.type || '').toLowerCase()
  return t === 'voice' || t === 'audio'
}

export type VoiceBinding = {
  sourceAssetId: number
  url: string
  label: string
  voicePrompt?: string
}

type Props = {
  asset: DramaAsset
  projectId: number
  open: boolean
  onClose: () => void
  onBound: (asset: DramaAsset) => void
  onError: (message: string) => void
}

// 读取 voice แอสเซท已บันทึก的 speaker
function readVoiceSpeaker(asset: DramaAsset): string {
  const params = (asset.params || {}) as Record<string, unknown>
  return typeof params.speaker === 'string' ? params.speaker.trim() : ''
}

// 读取 voice แอสเซท的น้ำเสียงคำอธิบาย
export function readVoicePrompt(asset: DramaAsset): string {
  const params = (asset.params || {}) as Record<string, unknown>
  return typeof params.voicePrompt === 'string' ? params.voicePrompt.trim() : ''
}

// 从แอสเซทตัวละคร params 读取已ผูกน้ำเสียง
export function readAssetVoiceBinding(asset: Pick<DramaAsset, 'params'>): VoiceBinding | null {
  const params = (asset.params || {}) as Record<string, unknown>
  const raw = params.voiceAudio
  if (raw && typeof raw === 'object') {
    const data = raw as Record<string, unknown>
    const sourceAssetId =
      typeof data.sourceAssetId === 'number'
        ? data.sourceAssetId
        : typeof data.voiceId === 'string'
          ? Number.NaN
          : null
    const url =
      typeof data.url === 'string'
        ? data.url
        : typeof data.previewUrl === 'string'
          ? data.previewUrl
          : ''
    if (typeof sourceAssetId === 'number' && sourceAssetId > 0 && url) {
      return {
        sourceAssetId,
        url,
        label: typeof data.label === 'string' ? data.label : 'น้ำเสียง',
        voicePrompt: typeof data.voicePrompt === 'string' ? data.voicePrompt : undefined,
      }
    }
  }
  const canvas = params.canvas
  if (canvas && typeof canvas === 'object') {
    const voiceAudio = (canvas as Record<string, unknown>).voiceAudio
    if (voiceAudio && typeof voiceAudio === 'object') {
      const data = voiceAudio as Record<string, unknown>
      const sourceAssetId = typeof data.sourceAssetId === 'number' ? data.sourceAssetId : null
      const url = typeof data.url === 'string' ? data.url : ''
      if (sourceAssetId && url) {
        return { sourceAssetId, url, label: 'น้ำเสียง' }
      }
    }
  }
  return null
}

// 构建绑定后的 params（同时写 voiceAudio 与 canvas.voiceAudio）
export function buildBoundParams(asset: DramaAsset, voice: DramaAsset): Record<string, unknown> {
  const url = voice.url || ''
  const binding: VoiceBinding = {
    sourceAssetId: voice.id,
    url,
    label: voice.name || 'น้ำเสียง',
    voicePrompt: readVoicePrompt(voice) || undefined,
  }
  const prev = (asset.params || {}) as Record<string, unknown>
  const prevCanvas =
    prev.canvas && typeof prev.canvas === 'object'
      ? (prev.canvas as Record<string, unknown>)
      : {}
  return {
    ...prev,
    voiceAudio: binding,
    canvas: {
      ...prevCanvas,
      voiceAudio: { sourceAssetId: voice.id, url },
    },
  }
}

// เรนเดอร์ตัวละครน้ำเสียง绑定弹窗
export function CharacterVoiceBindModal({
  asset,
  projectId,
  open,
  onClose,
  onBound,
  onError,
}: Props) {
  const voiceGenerationEnabled = useCharacterVoiceGenerationEnabled()
  /*
   * voiceAssets โปรเจกต์内 voice/audio แอสเซท
   * selectedId 选中น้ำเสียง
   * newPrompt / newName สร้างใหม่合成表单
   * busy / synthBusy / promptBusy / uploadBusy 各การดำเนินการ中
   * mode pick | upload | create
   */
  const [voiceAssets, setVoiceAssets] = useState<DramaAsset[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [newPrompt, setNewPrompt] = useState('')
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [synthBusy, setSynthBusy] = useState(false)
  const [promptBusy, setPromptBusy] = useState(false)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [suggestedSpeaker, setSuggestedSpeaker] = useState('')
  const [mode, setMode] = useState<'pick' | 'upload' | 'create'>('pick')
  const promptRequestedRef = useRef(false)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const bound = useMemo(() => readAssetVoiceBinding(asset), [asset])
  const selectedVoice = voiceAssets.find((v) => v.id === selectedId) || null
  const previewUrl = selectedVoice?.url ? resolveDramaMediaUrl(selectedVoice.url) : ''

  // 根据การตั้งค่าบทบาทตัวละคร AI 生成น้ำเสียงคำอธิบาย
  const fetchVoicePrompt = useCallback(
    async (force = false) => {
      if (!voiceGenerationEnabled) return
      if (promptBusy) return
      if (!force && newPrompt.trim()) return
      setPromptBusy(true)
      try {
        const result = await dramaApi.suggestVoicePrompt({
          project_id: projectId,
          asset_id: asset.id,
        })
        setNewPrompt(result.voice_prompt || '')
        setSuggestedSpeaker(result.speaker || '')
      } catch (err) {
        onError(err instanceof Error ? err.message : 'AI สร้างคำอธิบายเสียงไม่สำเร็จ')
      } finally {
        setPromptBusy(false)
      }
    },
    [asset.id, newPrompt, onError, projectId, promptBusy, voiceGenerationEnabled],
  )

  useEffect(() => {
    if (!open) {
      promptRequestedRef.current = false
      return
    }
    setSelectedId(bound?.sourceAssetId ?? null)
    setNewPrompt('')
    setSuggestedSpeaker('')
    setNewName(`${asset.name || 'ตัวละคร'}น้ำเสียง`)
    setMode('pick')
    promptRequestedRef.current = false

    dramaApi
      .listAssets(projectId)
      .then((list) => {
        const voices = list.filter(isVoiceLikeAsset)
        setVoiceAssets(voices)
        if (!bound?.sourceAssetId && voices[0]) {
          setSelectedId(voices[0].id)
        }
        if (voices.length === 0) {
          setMode('upload')
        }
      })
      .catch((err) => onError(err instanceof Error ? err.message : 'โหลดเสียงไม่สำเร็จ'))
  }, [open, asset, projectId, bound?.sourceAssetId, onError])

  // เข้าสู่「AI 合成」时自动生成น้ำเสียงคำอธิบาย
  useEffect(() => {
    if (!open || !voiceGenerationEnabled || mode !== 'create' || promptRequestedRef.current) return
    promptRequestedRef.current = true
    void fetchVoicePrompt(true)
  }, [open, mode, fetchVoicePrompt, voiceGenerationEnabled])

  useEffect(() => {
    if (!voiceGenerationEnabled && mode === 'create') setMode('pick')
  }, [voiceGenerationEnabled, mode])

  if (!open) return null

  const anyBusy = busy || synthBusy || promptBusy || uploadBusy

  // 本地อัปโหลดเสียง并记为น้ำเสียงแอสเซท
  async function handleUploadAudio(file: File) {
    if (uploadBusy) return
    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|m4a)$/i.test(file.name)) {
      onError('กรุณาอัปโหลดไฟล์เสียง mp3 / wav / m4a')
      return
    }
    setUploadBusy(true)
    try {
      const baseName = file.name.replace(/\.[^.]+$/, '').trim()
      const created = await dramaApi.createAsset({
        project_id: projectId,
        type: 'voice',
        asset_type: 'audio',
        name: baseName || `${asset.name || 'ตัวละคร'}น้ำเสียง`,
        params: {
          source: 'upload',
          originalFilename: file.name,
        },
      })
      const uploaded = await dramaApi.uploadAssetMedia(created.id, file)
      if (!(uploaded.url || '').trim()) throw new Error('อัปโหลดสำเร็จแต่ไม่พบที่อยู่ไฟล์สำหรับเล่น')
      setVoiceAssets((prev) => [uploaded, ...prev.filter((v) => v.id !== uploaded.id)])
      setSelectedId(uploaded.id)
      setMode('pick')
    } catch (err) {
      onError(err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ')
    } finally {
      setUploadBusy(false)
      if (uploadInputRef.current) uploadInputRef.current.value = ''
    }
  }

  // 按คำแนะนำ词สร้างใหม่并合成 voice แอสเซท
  async function handleCreateAndSynth() {
    if (!voiceGenerationEnabled) { onError(VOICE_GENERATION_DISABLED_MESSAGE); return }
    const prompt = newPrompt.trim()
    if (!prompt || synthBusy) return
    setSynthBusy(true)
    try {
      const result = await dramaApi.generateVoice({
        project_id: projectId,
        name: newName.trim() || undefined,
        voice_prompt: prompt,
        speaker: suggestedSpeaker || undefined,
        character_asset_id: asset.id,
      })
      const created = result.asset
      if (!created) throw new Error('สังเคราะห์เสียงไม่สำเร็จ')
      setVoiceAssets((prev) => [...prev, created])
      setSelectedId(created.id)
      setMode('pick')
    } catch (err) {
      onError(err instanceof Error ? err.message : 'สังเคราะห์เสียงไม่สำเร็จ')
    } finally {
      setSynthBusy(false)
    }
  }

  // 对已有 voice แอสเซท重新合成
  async function handleResynth(voice: DramaAsset) {
    if (!voiceGenerationEnabled) { onError(VOICE_GENERATION_DISABLED_MESSAGE); return }
    const prompt = readVoicePrompt(voice)
    if (!prompt || synthBusy) return
    setSynthBusy(true)
    try {
      const result = await dramaApi.generateVoice({
        project_id: projectId,
        asset_id: voice.id,
        voice_prompt: prompt,
        speaker: readVoiceSpeaker(voice) || suggestedSpeaker || undefined,
        character_asset_id: asset.id,
      })
      if (result.asset) {
        setVoiceAssets((prev) => prev.map((v) => (v.id === voice.id ? result.asset! : v)))
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'สังเคราะห์เสียงใหม่ไม่สำเร็จ')
    } finally {
      setSynthBusy(false)
    }
  }

  // 确认绑定到ตัวละคร
  async function handleConfirm() {
    if (!selectedVoice?.url || busy) {
      onError('กรุณาเลือกหรืออัปโหลดไฟล์เสียงตัวอย่างก่อน')
      return
    }
    setBusy(true)
    try {
      const updated = await dramaApi.updateAsset(asset.id, {
        params: buildBoundParams(asset, selectedVoice),
      })
      onBound(updated)
      onClose()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'ผูกเสียงไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  // ยกเลิกการผูกเสียง
  async function handleUnbind() {
    if (busy) return
    setBusy(true)
    try {
      const prev = (asset.params || {}) as Record<string, unknown>
      const nextParams = { ...prev }
      delete nextParams.voiceAudio
      if (nextParams.canvas && typeof nextParams.canvas === 'object') {
        const canvas = { ...(nextParams.canvas as Record<string, unknown>) }
        delete canvas.voiceAudio
        nextParams.canvas = canvas
      }
      const updated = await dramaApi.updateAsset(asset.id, { params: nextParams })
      onBound(updated)
      onClose()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'ยกเลิกการผูกเสียงไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="ผูกน้ำเสียง"
      size="lg"
      dismissible={!anyBusy}
      className="drama-voice-bind-modal"
      footer={
        <>
          <button type="button" className="pf-btn" onClick={onClose} disabled={anyBusy}>
            ยกเลิก
          </button>
          {bound ? (
            <button
              type="button"
              className="pf-btn"
              onClick={() => void handleUnbind()}
              disabled={anyBusy}
            >
              ยกเลิกการผูกเสียง
            </button>
          ) : null}
          <button
            type="button"
            className="pf-btn pf-btn-lime"
            onClick={() => void handleConfirm()}
            disabled={!selectedVoice?.url || anyBusy}
          >
            {busy ? 'กำลังผูก…' : 'ยืนยันการผูกเสียง'}
          </button>
        </>
      }
    >
      <p className="drama-muted">
        เพิ่มเสียงพูดให้กับ «{asset.name || 'ตัวละคร'}» สามารถเลือกเสียงที่มีอยู่หรืออัปโหลดไฟล์เสียง{voiceGenerationEnabled ? ' หรือสังเคราะห์ด้วย AI' : ''}
        เมื่อสร้างช็อตที่มีบทสนทนา โมเดลจะพากย์เสียงตามน้ำเสียงนี้
      </p>
      <p className="drama-muted" style={{ marginTop: -6, fontSize: 12 }}>
        บนแคนวาสสามารถเชื่อมโหนด «เสียง» เข้ากับตัวละครได้เช่นกัน
      </p>

      <div className="pf-library-toolbar">
        <AssetTypeFilter
          options={[{ value: 'pick', label: 'เลือกเสียงที่มี' }, { value: 'upload', label: 'อัปโหลดเสียง' }, ...(voiceGenerationEnabled ? [{ value: 'create' as const, label: 'AI สังเคราะห์' }] : [])] as const}
          value={mode}
          disabled={anyBusy}
          ariaLabel="น้ำเสียงที่มา"
          onChange={(value) => { setMode(value); if (value === 'create' && !newPrompt.trim() && !promptBusy) promptRequestedRef.current = false }}
        />
      </div>

      {mode === 'pick' ? (
        <AssetGrid picker>
          {voiceAssets.length === 0 ? (
            <AssetEmpty>ยังไม่มีเสียงที่สามารถใช้งานได้ กรุณา «อัปโหลดเสียง»{voiceGenerationEnabled ? ' หรือ «AI สังเคราะห์»' : ''} ก่อน</AssetEmpty>
          ) : (
            voiceAssets.map((voice) => {
              const hasAudio = Boolean(voice.url)
              const canResynth = Boolean(readVoicePrompt(voice))
              const statusLabel = !hasAudio
                ? 'รอสร้าง'
                : canResynth
                  ? 'สังเคราะห์แล้ว'
                  : 'อัปโหลดแล้ว'
              return (
                <AssetCard
                  key={voice.id}
                  asset={voice}
                  selected={selectedId === voice.id}
                  subtitle={statusLabel}
                  footer="โปรเจกต์น้ำเสียง"
                  onOpen={() => setSelectedId(voice.id)}
                  actions={voiceGenerationEnabled && hasAudio && canResynth ? <>
                    <button
                      type="button"
                      className="pf-btn pf-btn-sm"
                      disabled={synthBusy}
                      onClick={(e) => {
                        e.preventDefault()
                        void handleResynth(voice)
                      }}
                    >
                      สังเคราะห์ใหม่
                    </button>
                  </> : undefined}
                />
              )
            })
          )}
        </AssetGrid>
      ) : mode === 'upload' ? (
        <div className="drama-voice-create-form">
          <p className="drama-muted" style={{ margin: 0 }}>
            รองรับไฟล์ mp3 / wav / m4a แนะนำเสียงพูดที่ชัดเจนความยาว 2 วินาทีขึ้นไป
          </p>
          <input
            ref={uploadInputRef}
            type="file"
            accept={AUDIO_ACCEPT}
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleUploadAudio(file)
            }}
          />
          <button
            type="button"
            className="pf-btn pf-btn-lime"
            disabled={uploadBusy}
            onClick={() => uploadInputRef.current?.click()}
          >
            {uploadBusy ? 'กำลังอัปโหลด…' : 'เลือกไฟล์เสียง'}
          </button>
        </div>
      ) : voiceGenerationEnabled ? (
        <div className="drama-voice-create-form">
          <label className="drama-field">
            <span>ชื่อเสียง</span>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="เช่น: เสียงผู้ชายสุขุมนุ่มลึก, หญิงสาวสดใส"
            />
          </label>
          <label className="drama-field">
            <span className="drama-voice-prompt-label">
              ลักษณะเสียง (ระบุได้ตามต้องการ)
              <button
                type="button"
                className="pf-btn pf-btn-sm"
                disabled={promptBusy || synthBusy}
                onClick={() => void fetchVoicePrompt(true)}
              >
                {promptBusy ? 'กำลังสร้าง…' : 'เขียนให้ตามลักษณะตัวละคร'}
              </button>
            </span>
            <textarea
              rows={4}
              value={
                promptBusy && !newPrompt
                  ? 'กำลังเขียนคำอธิบายเสียงตามลักษณะตัวละคร…'
                  : newPrompt
              }
              readOnly={promptBusy && !newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder="เช่น: ชายอายุประมาณ 30 ปี เสียงสุขุมนุ่มลึกมีเสน่ห์ จังหวะการพูดไม่เร่งรีบ…"
            />
          </label>
          {suggestedSpeaker ? (
            <p className="drama-muted" style={{ margin: 0, fontSize: 12 }}>
              น้ำเสียงที่จับคู่: {suggestedSpeaker}
            </p>
          ) : null}
          <button
            type="button"
            className="pf-btn pf-btn-lime"
            disabled={!newPrompt.trim() || synthBusy || promptBusy}
            onClick={() => void handleCreateAndSynth()}
          >
            {synthBusy ? 'กำลังสังเคราะห์…' : 'สังเคราะห์เสียงตัวอย่าง'}
          </button>
        </div>
      ) : null}

      {previewUrl ? (
        <audio className="drama-voice-audio" controls src={previewUrl} />
      ) : null}
    </Modal>
  )
}
