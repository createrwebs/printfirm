import { useState, useEffect } from 'react'
import { Zap, Check, AlertCircle, Loader2, ExternalLink, HelpCircle } from 'lucide-react'
import { dramaApi, resolveDramaMediaUrl } from '../../api/drama'

export type ColabRefAssetOption = {
  id: number
  name: string
  type: string
  cover?: string | null
  isLinked?: boolean
}

export type ColabRenderSubmitParams = {
  comfyui_url: string
  engine?: string
  duration_sec: number
  prompt_override?: string
  seed?: number
  reference_image_url?: string
  reference_image_urls?: string[]
  first_frame_url?: string
  last_frame_url?: string
}

type ColabRenderModalProps = {
  open: boolean
  onCancel: () => void
  onConfirm: (params: ColabRenderSubmitParams) => Promise<void>
  fragmentCount: number
  currentFragment?: {
    id: number
    sort_order: number
    content: string
    duration_sec?: number | null
    cover?: string | null
  } | null
  characters?: ColabRefAssetOption[]
  scenes?: ColabRefAssetOption[]
  items?: ColabRefAssetOption[]
  prevLastFrameUrl?: string
  linkLastFrame?: boolean
  isSubmitting?: boolean
}

function cleanPromptForPreview(raw: string, assets: ColabRefAssetOption[] = []): string {
  if (!raw) return ''
  const nameById = new Map<number, string>()
  assets.forEach((a) => {
    if (a.id && a.name) nameById.set(Number(a.id), a.name.trim())
  })
  let text = raw
  text = text.replace(/@duration:\s*[\d.]+/gi, '')
  text = text.replace(/@(?:asset|character):\s*(\d+)/gi, (_, idStr) => {
    return nameById.get(Number(idStr)) || ''
  })
  text = text.replace(/^【(?:คำบรรยาย|แนะนำตัวละคร|字幕|角色名片)[^】]*】.*$/gm, '')
  text = text.replace(/【ภาพ[^】]*】/g, '')
  text = text.replace(/【画面[^】]*】/g, '')
  text = text.replace(/△\s*/g, '')
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
}

export function ColabRenderModal({
  open,
  onCancel,
  onConfirm,
  fragmentCount,
  currentFragment,
  characters = [],
  scenes = [],
  items = [],
  prevLastFrameUrl = '',
  linkLastFrame = true,
  isSubmitting = false,
}: ColabRenderModalProps) {
  const [colabUrl, setColabUrl] = useState(() => {
    return localStorage.getItem('colab_comfyui_url') || ''
  })
  const [engine, setEngine] = useState<'wan2' | 'h3'>('h3')
  const [durationSec, setDurationSec] = useState<number>(() => {
    return currentFragment?.duration_sec ? Math.max(5, Math.min(15, currentFragment.duration_sec)) : 5
  })
  const [promptOverride, setPromptOverride] = useState('')
  const [selectedRefUrls, setSelectedRefUrls] = useState<string[]>([])
  const [firstFrameUrl, setFirstFrameUrl] = useState<string>('none')
  const [lastFrameUrl, setLastFrameUrl] = useState<string>('none')
  const [seed, setSeed] = useState<string>('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    ok: boolean
    device?: string
    vram?: string
    error?: string
  } | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (open) {
      const saved = localStorage.getItem('colab_comfyui_url') || ''
      setColabUrl(saved)
      setDurationSec(currentFragment?.duration_sec ? Math.max(5, Math.min(8, currentFragment.duration_sec)) : 5)
      const allAssets = [...characters, ...scenes, ...items]
      const cleaned = cleanPromptForPreview(currentFragment?.content || '', allAssets)
      setPromptOverride(cleaned || currentFragment?.content || '')
      setSeed('')
      setTestResult(null)
      setFormError('')

      // Auto-gather all relevant reference images for this shot:
      // 1. Linked characters (ตัวละคร 1..N)
      // 2. Linked scenes (ฉาก) or shot cover fallback
      // 3. Linked props / items (อุปกรณ์/พร็อพ)
      const initialUrls: string[] = []
      characters.forEach((c) => {
        if (c.isLinked && c.cover && !initialUrls.includes(c.cover)) {
          initialUrls.push(c.cover)
        }
      })
      let hasLinkedScene = false
      scenes.forEach((s) => {
        if (s.isLinked && s.cover && !initialUrls.includes(s.cover)) {
          initialUrls.push(s.cover)
          hasLinkedScene = true
        }
      })
      items.forEach((it) => {
        if (it.isLinked && it.cover && !initialUrls.includes(it.cover)) {
          initialUrls.push(it.cover)
        }
      })
      if (!hasLinkedScene && currentFragment?.cover && !initialUrls.includes(currentFragment.cover)) {
        initialUrls.push(currentFragment.cover)
      }

      if (initialUrls.length === 0) {
        const anyChar = characters.find((c) => Boolean(c.cover))
        if (anyChar?.cover) initialUrls.push(anyChar.cover)
      }

      setSelectedRefUrls(initialUrls.slice(0, 9))

      // Default First Frame: previous shot's lastFrameUrl if continuity is enabled;
      // for H3 Multi-Ref (Ref2VA), keep 'none' when character refs exist so static shot cover doesn't lock motion
      if (linkLastFrame && prevLastFrameUrl) {
        setFirstFrameUrl(prevLastFrameUrl)
      } else if (engine === 'wan2' && currentFragment?.cover) {
        setFirstFrameUrl(currentFragment.cover)
      } else {
        setFirstFrameUrl('none')
      }
      setLastFrameUrl('none')
    }
  }, [open, currentFragment, characters, scenes, items, prevLastFrameUrl, linkLastFrame])

  const handleToggleRefUrl = (url: string) => {
    setSelectedRefUrls((prev) => {
      if (prev.includes(url)) {
        return prev.filter((u) => u !== url)
      }
      if (prev.length >= 9) return prev
      return [...prev, url]
    })
  }

  const handleSelectAllInShot = () => {
    const list: string[] = []
    characters.forEach((c) => {
      if (c.isLinked && c.cover && !list.includes(c.cover)) list.push(c.cover)
    })
    scenes.forEach((s) => {
      if (s.isLinked && s.cover && !list.includes(s.cover)) list.push(s.cover)
    })
    items.forEach((it) => {
      if (it.isLinked && it.cover && !list.includes(it.cover)) list.push(it.cover)
    })
    if (currentFragment?.cover && !list.includes(currentFragment.cover)) list.push(currentFragment.cover)
    setSelectedRefUrls(list.slice(0, 9))
  }

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onCancel, isSubmitting])

  if (!open) return null

  const handleTestConnection = async () => {
    const cleanUrl = colabUrl.trim().replace(/\/+$/, '')
    if (!cleanUrl) {
      setTestResult({ ok: false, error: 'กรุณากรอก Colab URL' })
      return
    }
    setTesting(true)
    setTestResult(null)
    setFormError('')
    try {
      const res = await dramaApi.checkColabComfyUI(cleanUrl)
      if (res.ok) {
        localStorage.setItem('colab_comfyui_url', cleanUrl)
        setTestResult({
          ok: true,
          device: res.device_name || 'GPU Device',
          vram: res.vram_free_gb ? `${res.vram_free_gb.toFixed(1)} GB` : undefined,
        })
      } else {
        setTestResult({
          ok: false,
          error: res.error || 'ไม่สามารถติดต่อ ComfyUI บน Colab ได้',
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setTestResult({
        ok: false,
        error: msg || 'เชื่อมต่อล้มเหลว ตรวจสอบ URL หรือความพร้อมของ Colab',
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanUrl = colabUrl.trim().replace(/\/+$/, '')
    if (!cleanUrl) {
      setFormError('กรุณากรอก Colab ComfyUI URL')
      return
    }
    localStorage.setItem('colab_comfyui_url', cleanUrl)
    localStorage.setItem('colab_engine', engine)
    setFormError('')

    const seedNum = seed.trim() ? parseInt(seed.trim(), 10) : undefined

    await onConfirm({
      comfyui_url: cleanUrl,
      engine,
      duration_sec: durationSec,
      prompt_override: currentFragment && promptOverride.trim() ? promptOverride.trim() : undefined,
      seed: isNaN(seedNum as number) ? undefined : seedNum,
      reference_image_urls: selectedRefUrls,
      reference_image_url: selectedRefUrls[0] ? selectedRefUrls[0].trim() : undefined,
      first_frame_url: firstFrameUrl,
      last_frame_url: lastFrameUrl,
    })
  }

  // Google Flow has no public API: copy prompt, download refs, open Flow so the user can drop them in.
  const handleSendToFlow = async () => {
    const text = promptOverride.trim() || cleanPromptForPreview(currentFragment?.content || '')
    const urls = [firstFrameUrl, ...selectedRefUrls, lastFrameUrl].filter((u, i, a) => u && u !== 'none' && a.indexOf(u) === i)

    // Preferred path: the flow-extension (see /flow-extension) opens Flow and fills prompt + refs itself.
    const handled = await new Promise<boolean>((resolve) => {
      const onAck = (e: MessageEvent) => {
        if (e.data?.type === 'PRINTFILM_FLOW_ACK') { window.removeEventListener('message', onAck); resolve(true) }
      }
      window.addEventListener('message', onAck)
      window.postMessage({ type: 'PRINTFILM_FLOW_JOB', prompt: text, refUrls: urls.map((u) => new URL(u, window.location.href).href) }, '*')
      setTimeout(() => { window.removeEventListener('message', onAck); resolve(false) }, 800)
    })
    if (handled) return

    // Fallback (extension not installed): open Flow, copy prompt, download refs for manual drag & drop.
    window.open('https://labs.google/fx/tools/flow', '_blank', 'noopener')
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      setFormError('คัดลอก Prompt ไม่สำเร็จ — คัดลอกจากช่อง Prompt ด้วยตนเอง')
    }
    for (const [i, url] of urls.entries()) {
      try {
        const blob = await (await fetch(url)).blob()
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `flow_ref_${i + 1}.${blob.type.split('/')[1] || 'png'}`
        a.click()
        URL.revokeObjectURL(a.href)
      } catch {
        window.open(url, '_blank', 'noopener') // shortcut: cross-origin image can't be fetched, open it for manual save
      }
    }
  }

  const isSingle = Boolean(currentFragment)
  const linkedScene = scenes.find((scene) => scene.isLinked && scene.name)

  return (
    <div className="pf-dialog-root" role="presentation">
      <div className="pf-dialog-veil" aria-hidden onClick={!isSubmitting ? onCancel : undefined} />
      <form
        className="pf-dialog colab-render-dialog"
        role="dialog"
        aria-modal="true"
        onSubmit={handleSubmit}
        style={{ maxWidth: 900, width: 'min(900px, calc(100vw - 24px))', maxHeight: 'calc(100dvh - 24px)' }}
      >
        <div className="pf-dialog-header" style={{ alignItems: 'flex-start' }}>
          <div
            className="pf-dialog-mark"
            style={{
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
              color: '#d97706',
              border: '1px solid #fcd34d',
            }}
          >
            <Zap size={22} strokeWidth={2.2} />
          </div>
          <div className="pf-dialog-body" style={{ flex: 1 }}>
            <h2 className="pf-dialog-title" style={{ fontSize: 18, margin: 0, color: '#0f172a' }}>
              ⚡ Render วิดีโอด้วย Google Colab
            </h2>
            <p className="pf-dialog-message" style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
              เรนเดอร์วิดีโอคุณภาพสูงฟรีโดยตรงบน GPU ของคุณเอง ผ่าน ComfyUI
            </p>
          </div>
        </div>

        <div className="colab-modal-content" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 0' }}>
          <div className="colab-top-grid">
          {/* Engine Selector */}
          <div className="colab-field-group">
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>
              โมเดลวิดีโอ (Video Engine)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                onClick={() => setEngine('h3')}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: engine === 'h3' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  background: engine === 'h3' ? '#eff6ff' : '#ffffff',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 13, color: engine === 'h3' ? '#1d4ed8' : '#1e293b' }}>
                    MiniMax H3 (Drama Multi-Ref)
                  </strong>
                  <span style={{ fontSize: 10, background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                    แนะนำหลัก (1–9 Refs)
                  </span>
                </div>
                <span style={{ fontSize: 11, color: '#64748b', lineHeight: 1.3 }}>
                  รองรับอ้างอิง 1–9 รูป + First/Last Frame + เสียงพากย์ในตัว
                </span>
              </button>

              <button
                type="button"
                onClick={() => setEngine('wan2')}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: engine === 'wan2' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  background: engine === 'wan2' ? '#eff6ff' : '#ffffff',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 13, color: engine === 'wan2' ? '#1d4ed8' : '#1e293b' }}>
                    Wan 2.2 (Alibaba I2V)
                  </strong>
                  <span style={{ fontSize: 10, background: '#f1f5f9', color: '#475569', padding: '1px 6px', borderRadius: 4 }}>
                    ทางเลือก (1–2 เฟรม)
                  </span>
                </div>
                <span style={{ fontSize: 11, color: '#64748b', lineHeight: 1.3 }}>
                  Image-to-Video เฉพาะภาพเริ่ม (First) และภาพจบ (Last)
                </span>
              </button>
            </div>
          </div>
          {/* Colab URL Input */}
          <div className="colab-field-group">
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>
              Colab Cloudflare Tunnel URL <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                className="colab-input"
                placeholder="https://xxxx.trycloudflare.com"
                value={colabUrl}
                onChange={(e) => {
                  setColabUrl(e.target.value)
                  setTestResult(null)
                  setFormError('')
                }}
                disabled={isSubmitting || testing}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
              <button
                type="button"
                className="drama-ep-btn-ghost"
                onClick={handleTestConnection}
                disabled={isSubmitting || testing || !colabUrl.trim()}
                style={{
                  whiteSpace: 'nowrap',
                  padding: '0 16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 38,
                  fontSize: 13,
                }}
              >
                {testing ? <Loader2 size={15} className="spin" /> : null}
                {testing ? 'กำลังตรวจสอบ…' : 'ทดสอบเชื่อมต่อ'}
              </button>
            </div>

            {/* Test result status */}
            {testResult?.ok && (
              <div
                style={{
                  marginTop: 8,
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#166534',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Check size={16} />
                <span>
                  เชื่อมต่อสำเร็จ! อุปกรณ์: <strong>{testResult.device}</strong>
                  {testResult.vram ? ` (VRAM ว่าง: ${testResult.vram})` : ''}
                </span>
              </div>
            )}

            {testResult && !testResult.ok && (
              <div
                style={{
                  marginTop: 8,
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AlertCircle size={16} />
                <span>{testResult.error}</span>
              </div>
            )}
          </div>
          </div>

          {/* Quick Help Guide Toggle */}
          <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: 10 }}>
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: '#2563eb',
                fontSize: 12,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <HelpCircle size={14} />
              {showHelp ? 'ซ่อนวิธีเปิด Colab Notebook' : 'วิธีรัน Google Colab + ComfyUI'}
            </button>
            {showHelp && (
              <div
                style={{
                  marginTop: 8,
                  padding: 12,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 12,
                  color: '#334155',
                  lineHeight: 1.6,
                }}
              >
                <p style={{ margin: '0 0 6px 0', fontWeight: 600 }}>ขั้นตอนการเปิด Colab:</p>
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  <li>
                    เปิด Notebook จาก GitHub:{' '}
                    <a
                      href="https://github.com/dseditor/minimax-h3-colab"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#2563eb', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 2 }}
                    >
                      dseditor/minimax-h3-colab <ExternalLink size={12} />
                    </a>
                  </li>
                  <li>เลือก Runtime Type เป็น <strong>GPU (T4, A100 หรือ L4)</strong></li>
                  <li>กด <strong>Runtime &gt; Run all</strong> เพื่อติดตั้งโมเดล H3, ComfyUI และเริ่ม Cloudflare tunnel</li>
                  <li>เมื่อเซลล์ทำงานเสร็จ จะแสดงลิงก์ <code>https://*.trycloudflare.com</code> คัดลอกมาวางในช่องด้านบน</li>
                </ol>
              </div>
            )}
          </div>

          {/* Target Shot Info & Reference Assets Selector */}
          {isSingle && currentFragment ? (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      background: '#e0e7ff',
                      color: '#3730a3',
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 4,
                    }}
                  >
                    ช็อตที่ {(currentFragment.sort_order ?? 0) + 1}
                  </span>
                  <span style={{ fontSize: 12, color: selectedRefUrls.length > 0 ? '#166534' : '#dc2626', fontWeight: 600 }}>
                    {selectedRefUrls.length > 0
                      ? `✓ เลือกภาพอ้างอิง ${selectedRefUrls.length} รูป (สูงสุด 9)`
                      : '⚠️ ยังไม่ได้เลือกภาพอ้างอิง'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={handleSelectAllInShot}
                    style={{
                      background: '#fff',
                      border: '1px solid #cbd5e1',
                      borderRadius: 4,
                      padding: '2px 8px',
                      fontSize: 11,
                      color: '#2563eb',
                      cursor: 'pointer',
                    }}
                  >
                    เลือกทั้งหมดในช็อต
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRefUrls([])}
                    style={{
                      background: '#fff',
                      border: '1px solid #cbd5e1',
                      borderRadius: 4,
                      padding: '2px 8px',
                      fontSize: 11,
                      color: '#64748b',
                      cursor: 'pointer',
                    }}
                  >
                    ล้างทั้งหมด
                  </button>
                </div>
              </div>
              <div className="colab-context-row">
                <span className="colab-context-chip colab-context-chip--shot">ช็อต {(currentFragment.sort_order ?? 0) + 1}</span>
                <span className="colab-context-chip colab-context-chip--scene">
                  ฉาก: {linkedScene?.name || 'ใช้ฉากจากช็อตนี้'}
                </span>
                <span className="colab-context-note">เลือกภาพอ้างอิงได้สูงสุด 9 รูป</span>
              </div>

              {/* 1. Character References Section */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>
                  <span>🎭 ภาพตัวละคร (&lt;Picture 1&gt;, &lt;Picture 2&gt;, ...)</span>
                  <span style={{ fontSize: 11, fontWeight: 400, color: '#64748b' }}>คลิกเพื่อเลือกหรือยกเลิก</span>
                </label>

                <div className="colab-ref-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, maxHeight: 108, overflowY: 'auto', padding: 2 }}>
                  {characters.filter((c) => Boolean(c.cover)).map((c) => {
                    const picIndex = selectedRefUrls.indexOf(c.cover || '')
                    const isSelected = picIndex !== -1
                    const imgSrc = resolveDramaMediaUrl(c.cover)
                    return (
                      <div
                        key={c.id}
                        onClick={() => handleToggleRefUrl(c.cover || '')}
                        style={{
                          position: 'relative',
                          cursor: 'pointer',
                          borderRadius: 8,
                          border: isSelected ? '2px solid #f59e0b' : '1px solid #cbd5e1',
                          background: isSelected ? '#fffbeb' : '#ffffff',
                          padding: 6,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          boxShadow: isSelected ? '0 0 0 2px rgba(245, 158, 11, 0.25)' : 'none',
                          transition: 'all 0.15s ease',
                          opacity: isSelected ? 1 : 0.75,
                        }}
                      >
                        {isSelected && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 4,
                              left: 4,
                              background: '#f59e0b',
                              color: '#fff',
                              borderRadius: 4,
                              padding: '1px 5px',
                              fontSize: 10,
                              fontWeight: 700,
                              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            }}
                          >
                            &lt;Picture {picIndex + 1}&gt;
                          </div>
                        )}
                        {isSelected && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              background: '#f59e0b',
                              color: '#fff',
                              borderRadius: '50%',
                              width: 16,
                              height: 16,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Check size={11} strokeWidth={3} />
                          </div>
                        )}
                        <img
                          src={imgSrc}
                          alt={c.name}
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 6,
                            objectFit: 'cover',
                            border: '1px solid #e2e8f0',
                            marginTop: isSelected ? 14 : 0,
                            marginBottom: 4,
                          }}
                        />
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#1e293b',
                            textAlign: 'center',
                            maxWidth: 110,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={c.name}
                        >
                          {c.name}
                        </div>
                        {c.isLinked && (
                          <span style={{ fontSize: 9, color: '#047857', background: '#d1fae5', padding: '1px 5px', borderRadius: 3, marginTop: 2 }}>
                            ในช็อตนี้
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 2. Scene / Environment Section */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>
                  <span>🏞️ ภาพฉากและสถานที่ / สภาพแวดล้อม (Scene Environment)</span>
                  <span style={{ fontSize: 11, fontWeight: 400, color: '#64748b' }}>คุมบรรยากาศ แสง และห้อง</span>
                </label>

                <div className="colab-ref-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, maxHeight: 108, overflowY: 'auto', padding: 2 }}>
                  {scenes.filter((s) => Boolean(s.cover)).map((s) => {
                    const picIndex = selectedRefUrls.indexOf(s.cover || '')
                    const isSelected = picIndex !== -1
                    const imgSrc = resolveDramaMediaUrl(s.cover)
                    return (
                      <div
                        key={s.id}
                        onClick={() => handleToggleRefUrl(s.cover || '')}
                        style={{
                          position: 'relative',
                          cursor: 'pointer',
                          borderRadius: 8,
                          border: isSelected ? '2px solid #0284c7' : '1px solid #cbd5e1',
                          background: isSelected ? '#f0f9ff' : '#ffffff',
                          padding: 6,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          boxShadow: isSelected ? '0 0 0 2px rgba(2, 132, 199, 0.25)' : 'none',
                          transition: 'all 0.15s ease',
                          opacity: isSelected ? 1 : 0.75,
                        }}
                      >
                        {isSelected && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 4,
                              left: 4,
                              background: '#0284c7',
                              color: '#fff',
                              borderRadius: 4,
                              padding: '1px 5px',
                              fontSize: 10,
                              fontWeight: 700,
                              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            }}
                          >
                            &lt;Picture {picIndex + 1}&gt;
                          </div>
                        )}
                        {isSelected && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              background: '#0284c7',
                              color: '#fff',
                              borderRadius: '50%',
                              width: 16,
                              height: 16,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Check size={11} strokeWidth={3} />
                          </div>
                        )}
                        <img
                          src={imgSrc}
                          alt={s.name}
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 6,
                            objectFit: 'cover',
                            border: '1px solid #e2e8f0',
                            marginTop: isSelected ? 14 : 0,
                            marginBottom: 4,
                          }}
                        />
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#1e293b',
                            textAlign: 'center',
                            maxWidth: 110,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={s.name}
                        >
                          {s.name}
                        </div>
                        {s.isLinked && (
                          <span style={{ fontSize: 9, color: '#0369a1', background: '#e0f2fe', padding: '1px 5px', borderRadius: 3, marginTop: 2 }}>
                            ฉากในช็อตนี้
                          </span>
                        )}
                      </div>
                    )
                  })}

                  {currentFragment.cover && (
                    <div
                      onClick={() => handleToggleRefUrl(currentFragment.cover || '')}
                      style={{
                        position: 'relative',
                        cursor: 'pointer',
                        borderRadius: 8,
                        border: selectedRefUrls.includes(currentFragment.cover) ? '2px solid #0284c7' : '1px solid #cbd5e1',
                        background: selectedRefUrls.includes(currentFragment.cover) ? '#f0f9ff' : '#ffffff',
                        padding: 6,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        boxShadow: selectedRefUrls.includes(currentFragment.cover) ? '0 0 0 2px rgba(2, 132, 199, 0.25)' : 'none',
                        transition: 'all 0.15s ease',
                        opacity: selectedRefUrls.includes(currentFragment.cover) ? 1 : 0.75,
                      }}
                    >
                      {selectedRefUrls.includes(currentFragment.cover) && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 4,
                            left: 4,
                            background: '#0284c7',
                            color: '#fff',
                            borderRadius: 4,
                            padding: '1px 5px',
                            fontSize: 10,
                            fontWeight: 700,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          }}
                        >
                          &lt;Picture {selectedRefUrls.indexOf(currentFragment.cover) + 1}&gt;
                        </div>
                      )}
                      {selectedRefUrls.includes(currentFragment.cover) && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            background: '#0284c7',
                            color: '#fff',
                            borderRadius: '50%',
                            width: 16,
                            height: 16,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Check size={11} strokeWidth={3} />
                        </div>
                      )}
                      <img
                        src={resolveDramaMediaUrl(currentFragment.cover)}
                        alt="Shot Cover"
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 6,
                          objectFit: 'cover',
                          border: '1px solid #e2e8f0',
                          marginTop: selectedRefUrls.includes(currentFragment.cover) ? 14 : 0,
                          marginBottom: 4,
                        }}
                      />
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#1e293b', textAlign: 'center' }}>
                        Cover ช็อต
                      </div>
                      <span style={{ fontSize: 9, color: '#475569', background: '#f1f5f9', padding: '1px 5px', borderRadius: 3, marginTop: 2 }}>
                        เฟรมปัจจุบัน
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Props / Items Section */}
              {items.some((it) => Boolean(it.cover)) && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>
                    <span>📦 ภาพอุปกรณ์ / พร็อพ (Props &amp; Items)</span>
                    <span style={{ fontSize: 11, fontWeight: 400, color: '#64748b' }}>คลิกเพื่อแนบพร็อพเข้าซีน</span>
                  </label>

                  <div className="colab-ref-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, maxHeight: 108, overflowY: 'auto', padding: 2 }}>
                    {items.filter((it) => Boolean(it.cover)).map((it) => {
                      const picIndex = selectedRefUrls.indexOf(it.cover || '')
                      const isSelected = picIndex !== -1
                      const imgSrc = resolveDramaMediaUrl(it.cover)
                      return (
                        <div
                          key={it.id}
                          onClick={() => handleToggleRefUrl(it.cover || '')}
                          style={{
                            position: 'relative',
                            cursor: 'pointer',
                            borderRadius: 8,
                            border: isSelected ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                            background: isSelected ? '#f5f3ff' : '#ffffff',
                            padding: 6,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            boxShadow: isSelected ? '0 0 0 2px rgba(124, 58, 237, 0.25)' : 'none',
                            transition: 'all 0.15s ease',
                            opacity: isSelected ? 1 : 0.75,
                          }}
                        >
                          {isSelected && (
                            <div
                              style={{
                                position: 'absolute',
                                top: 4,
                                left: 4,
                                background: '#7c3aed',
                                color: '#fff',
                                borderRadius: 4,
                                padding: '1px 5px',
                                fontSize: 10,
                                fontWeight: 700,
                              }}
                            >
                              &lt;Picture {picIndex + 1}&gt;
                            </div>
                          )}
                          {isSelected && (
                            <div
                              style={{
                                position: 'absolute',
                                top: 4,
                                right: 4,
                                background: '#7c3aed',
                                color: '#fff',
                                borderRadius: '50%',
                                width: 16,
                                height: 16,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Check size={11} strokeWidth={3} />
                            </div>
                          )}
                          <img
                            src={imgSrc}
                            alt={it.name}
                            style={{
                              width: 52,
                              height: 52,
                              borderRadius: 6,
                              objectFit: 'cover',
                              border: '1px solid #e2e8f0',
                              marginTop: isSelected ? 14 : 0,
                              marginBottom: 4,
                            }}
                          />
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: '#1e293b',
                              textAlign: 'center',
                              maxWidth: 110,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={it.name}
                          >
                            {it.name}
                          </div>
                          {it.isLinked && (
                            <span style={{ fontSize: 9, color: '#6d28d9', background: '#ede9fe', padding: '1px 5px', borderRadius: 3, marginTop: 2 }}>
                              พร็อพในช็อตนี้
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 4. First Frame & Last Frame Continuity Section */}
              {engine === 'wan2' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
                      🎬 First Frame (เฟรมแรกเปิดช็อต)
                    </label>
                    <select
                      value={firstFrameUrl}
                      onChange={(e) => setFirstFrameUrl(e.target.value)}
                      disabled={isSubmitting}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 11 }}
                    >
                      <option value="none">ไม่ล็อกเฟรมแรก (สร้างจาก Ref + Prompt)</option>
                      {prevLastFrameUrl && (
                        <option value={prevLastFrameUrl}>🔗 เฟรมท้ายจากช็อตก่อนหน้า (เชื่อมช็อตต่อกัน)</option>
                      )}
                      {currentFragment.cover && (
                        <option value={currentFragment.cover}>🖼️ Cover ของช็อตนี้</option>
                      )}
                      {scenes.filter((s) => Boolean(s.cover)).map((s) => (
                        <option key={`ff-s-${s.id}`} value={s.cover || ''}>
                          🏞️ ฉาก: {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
                      🏁 Last Frame (เฟรมท้ายจบช็อต - ไม่บังคับ)
                    </label>
                    <select
                      value={lastFrameUrl}
                      onChange={(e) => setLastFrameUrl(e.target.value)}
                      disabled={isSubmitting}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 11 }}
                    >
                      <option value="none">ไม่ล็อกเฟรมท้าย (เคลื่อนไหวอิสระตาม Prompt)</option>
                      {currentFragment.cover && (
                        <option value={currentFragment.cover}>🖼️ Cover ของช็อตนี้</option>
                      )}
                      {scenes.filter((s) => Boolean(s.cover)).map((s) => (
                        <option key={`lf-s-${s.id}`} value={s.cover || ''}>
                          🏞️ ฉาก: {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Reference Order Summary Strip */}
              {selectedRefUrls.length > 0 && (
                <div style={{ background: '#f1f5f9', borderRadius: 6, padding: '8px 10px', fontSize: 11, color: '#334155', marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>
                    ภาพ Ref ที่ส่งไป ({selectedRefUrls.length} รูป{firstFrameUrl !== 'none' ? ' + First Frame' : ''}{lastFrameUrl !== 'none' ? ' + Last Frame' : ''}):
                  </span>
                  {selectedRefUrls.map((url, idx) => {
                    const char = characters.find((c) => c.cover === url)
                    const scene = scenes.find((s) => s.cover === url)
                    const item = items.find((it) => it.cover === url)
                    const label = char?.name || scene?.name || item?.name || (url === currentFragment.cover ? 'Cover ช็อต' : `Ref ${idx + 1}`)
                    const isChar = Boolean(char)
                    const isItem = Boolean(item)
                    return (
                      <span
                        key={url}
                        style={{
                          background: isChar ? '#fef3c7' : isItem ? '#ede9fe' : '#e0f2fe',
                          border: isChar ? '1px solid #fde68a' : isItem ? '1px solid #ddd6fe' : '1px solid #bae6fd',
                          color: isChar ? '#92400e' : isItem ? '#5b21b6' : '#0369a1',
                          padding: '2px 7px',
                          borderRadius: 4,
                          fontWeight: 500,
                        }}
                      >
                        <strong>&lt;Picture {idx + 1}&gt;</strong> {label}
                      </span>
                    )
                  })}
                </div>
              )}

              {selectedRefUrls.length === 0 && (
                <div style={{ marginBottom: 12, padding: '8px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#991b1b', fontSize: 12 }}>
                  MiniMax H3 ต้องการภาพอ้างอิงอย่างน้อย 1 ภาพ (ตัวละครหรือฉาก) กรุณาคลิกเลือกภาพด้านบน
                </div>
              )}

              {/* Prompt Textarea */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
                    คำบรรยายเนื้อเรื่อง / การกระทำ (Prompt):
                  </label>
                </div>
                <div className="colab-prompt-row">
                  <textarea
                    className="colab-textarea"
                    rows={2}
                    value={promptOverride}
                    onChange={(e) => setPromptOverride(e.target.value)}
                    disabled={isSubmitting}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: 12,
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                    placeholder="คำอธิบายการเคลื่อนไหว กล้อง และการกระทำของตัวละครในช็อตนี้..."
                  />
                  <button
                    type="button"
                    onClick={() => setPromptOverride(cleanPromptForPreview(currentFragment?.content || ''))}
                    className="colab-clean-prompt"
                  >
                    คืนค่าเดิม
                  </button>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b' }}>
                  💡 ระบบจะผูกตัวละครตามลำดับภาพ (&lt;Subject 1&gt; = &lt;Picture 1&gt;, &lt;Subject 2&gt; = &lt;Picture 2&gt;) และใช้ภาพฉากคุมบรรยากาศโดยอัตโนมัติ
                </p>
              </div>
            </div>
          ) : (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 13, color: '#334155' }}>
                🚀 จะส่ง Render ทั้งหมด <strong>{fragmentCount} ช็อต</strong> ไปยังคิวของ Colab ComfyUI (ระบบจะดึงภาพตัวละครและฉากของแต่ละช็อตแนบไปอัตโนมัติ)
              </div>
            </div>
          )}

          {/* Options: Duration & Seed */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
                ความยาววิดีโอ (วินาที): {durationSec}s
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {[5, 8, 10, 12, 15].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setDurationSec(sec)}
                    disabled={isSubmitting}
                    style={{
                      flex: 1,
                      padding: '5px 0',
                      borderRadius: 6,
                      border: durationSec === sec ? '1px solid #d97706' : '1px solid #e2e8f0',
                      background: durationSec === sec ? '#fef3c7' : '#fff',
                      color: durationSec === sec ? '#92400e' : '#475569',
                      fontWeight: durationSec === sec ? 600 : 400,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
                Seed (สุ่มหรือระบุตัวเลข):
              </label>
              <input
                type="number"
                placeholder="สุ่ม (ค่าว่าง)"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: 12,
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {formError && (
            <div style={{ color: '#ef4444', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle size={14} />
              <span>{formError}</span>
            </div>
          )}
        </div>

        <div className="pf-dialog-actions" style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
          <button
            type="button"
            className="pf-dialog-btn pf-dialog-btn-ghost"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            className="pf-dialog-btn pf-dialog-btn-ghost"
            onClick={handleSendToFlow}
            disabled={isSubmitting || (isSingle && selectedRefUrls.length === 0)}
            title="คัดลอก Prompt + ดาวน์โหลดภาพ Ref แล้วเปิด Google Flow"
          >
            🌊 ส่งไป Google Flow
          </button>
          <button
            type="submit"
            className="drama-ep-btn-colab"
            disabled={isSubmitting || !colabUrl.trim() || (isSingle && selectedRefUrls.length === 0)}
            title={isSingle && selectedRefUrls.length === 0 ? 'กรุณาเลือกภาพอ้างอิงอย่างน้อย 1 ภาพก่อนเริ่มเรนเดอร์' : undefined}
            style={{
              padding: '9px 22px',
              fontSize: 13,
              fontWeight: 600,
              minWidth: 160,
              justifyContent: 'center',
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="spin" />
                <span>กำลังส่งงานไป Colab…</span>
              </>
            ) : (
              <>
                <Zap size={16} />
                <span>เริ่ม Render ด้วย Colab</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
