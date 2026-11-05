/** 分 ตอนแก้ไข顶栏：画幅/ความคมชัด / วิดีโอสไตล์ / คำบรรยาย (ซับไตเติล) / 人物介绍 / 模型 / 镜间衔接 */

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'

import { createPortal } from 'react-dom'

import { BarChart3, ChevronDown, CircleHelp, Link2, Smile, Type, Users } from 'lucide-react'

import { DramaImageStylePreviewImg } from '../../components/drama/DramaImageStylePreviewImg'

import { DramaMediaModelPicker } from '../../components/drama/DramaMediaModelPicker'
import { SeedanceRulesModal } from '../../components/drama/SeedanceRulesModal'

import {
  getImageStyleLabel,
  IMAGE_STYLE_OPTIONS,
  type ImageStyleId,
} from '../../lib/dramaImageStyles'

import { subtitleModeUsesModelOutput, type DramaSubtitleMode } from '../../lib/dramaSubtitleSettings'
import {
  characterIntroModeEnabled,
  type DramaCharacterIntroMode,
} from '../../lib/dramaCharacterIntro'

import {
  catalogModelLabel,
  catalogVideoModels,
  useMediaModelsCatalog,
} from '../../hooks/useMediaModelsCatalog'

import { DramaProjectOutputSettings } from './DramaProjectOutputSettings'

import './canvas/nodes/dramaImageGenOptions.css'
type Props = {
  styleId: ImageStyleId | ''
  modelId: string
  episodeParams: Record<string, unknown>
  projectParams: Record<string, unknown>
  linkLastFrame: boolean
  subtitleMode: DramaSubtitleMode
  characterIntroMode: DramaCharacterIntroMode
  onStyleChange: (id: ImageStyleId | '') => void
  onModelChange: (id: string) => void
  onEpisodeOutputChange: (
    nextParams: Record<string, unknown>,
    opts?: { quiet?: boolean },
  ) => void | Promise<void>
  onLinkLastFrameChange: (enabled: boolean) => void
  onSubtitleModeChange: (mode: DramaSubtitleMode) => void
  onCharacterIntroModeChange: (mode: DramaCharacterIntroMode) => void
  disabled?: boolean
  /** สไตล์/คำบรรยาย (ซับไตเติล)/介绍/衔接为โปรเจกต์ทั่วไป，分镜页只展示不可改；画幅/ความคมชัด仍可改（随模型过滤） */
  globalSettingsReadOnly?: boolean
}

type OpenPanel = 'style' | 'model' | 'link' | 'subtitle' | 'intro' | null

const STYLE_PANEL_WIDTH = 420

// เรนเดอร์顶栏生成参数控件
export function EpisodeEditHeaderControls({
  styleId,
  modelId,
  episodeParams,
  projectParams,
  linkLastFrame,
  subtitleMode,
  characterIntroMode,
  onStyleChange,
  onModelChange,
  onEpisodeOutputChange,
  onLinkLastFrameChange,
  onSubtitleModeChange,
  onCharacterIntroModeChange,
  disabled = false,
  globalSettingsReadOnly = false,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState<OpenPanel>(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null)
  const catalog = useMediaModelsCatalog()
  const videoModels = catalogVideoModels(catalog)
  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      setPanelStyle(null)
      return
    }
    // 固定定位下拉面板，避免与 top/bottom ความขัดแย้ง导致高度被压扁
    function updatePanelPosition() {
      const root = rootRef.current
      if (!root) return
      const rect = root.getBoundingClientRect()
      const width =
        open === 'style'
          ? Math.min(STYLE_PANEL_WIDTH, window.innerWidth - 24)
          : open === 'model'
            ? Math.min(400, window.innerWidth - 24)
            : Math.min(360, window.innerWidth - 24)
      let left = rect.right - width
      left = Math.max(12, Math.min(left, window.innerWidth - width - 12))
      const top = Math.min(rect.bottom + 8, window.innerHeight - 24)
      setPanelStyle({
        position: 'fixed',
        top,
        left,
        width,
        bottom: 'auto',
        right: 'auto',
        zIndex: 320,
      })
    }
    updatePanelPosition()
    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)
    return () => {
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
    }
  }, [open])
  useEffect(() => {
    if (!open) return
    function onDoc(e: Event) {
      const target = e.target as Node | null
      if (!target) return
      if (rootRef.current?.contains(target)) return
      if ((target as Element).closest?.('.fc-gen-opt-panel--portal')) return
      setOpen(null)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  const stop = (e: MouseEvent) => {
    e.stopPropagation()
  }
  const styleLabel = getImageStyleLabel(styleId) || 'สไตล์วิดีโอ'
  const modelLabel = catalogModelLabel(modelId, videoModels, 'โมเดลวิดีโอ')
  const subtitleLabel = subtitleMode === 'model' ? 'ซับไตเติลจากโมเดล' : 'ซับไตเติลตัดต่อภายหลัง'
  const subtitleUsesModel = subtitleModeUsesModelOutput(subtitleMode)
  const introLabel = characterIntroMode === 'model' ? 'แนะนำตัวละคร' : 'ไม่แสดงตัวอักษรแนะนำ'
  const introEnabled = characterIntroModeEnabled(characterIntroMode)
  const globalLocked = disabled || globalSettingsReadOnly
  return (
    <div
      ref={rootRef}
      className="fc-gen-opts drama-ep-header-gen-opts"
      onMouseDown={stop}
      onPointerDown={stop}
    >
      <div className="fc-gen-opts-triggers">
        <DramaProjectOutputSettings
          scope="episode"
          params={episodeParams}
          fallbackParams={projectParams}
          disabled={disabled}
          compact
          videoModelId={modelId}
          onChange={onEpisodeOutputChange}
        />
        <button
          type="button"
          className={`fc-gen-opt-btn${open === 'style' || styleId ? ' active' : ''}${globalSettingsReadOnly ? ' is-readonly' : ''}`}
          disabled={globalLocked}
          onClick={() => {
            if (globalSettingsReadOnly) return
            setOpen((c) => (c === 'style' ? null : 'style'))
          }}
          title={globalSettingsReadOnly ? `${styleLabel} (การตั้งค่าโปรเจกต์ อ่านอย่างเดียว)` : styleLabel}
        >
          <Smile size={14} strokeWidth={1.8} />
          <span className="fc-gen-opt-label">{styleLabel}</span>
          {!globalSettingsReadOnly ? <ChevronDown size={12} strokeWidth={2} /> : null}
        </button>
        <button
          type="button"
          className={`fc-gen-opt-btn${open === 'subtitle' || !subtitleUsesModel ? ' active' : ''}${globalSettingsReadOnly ? ' is-readonly' : ''}`}
          disabled={globalLocked}
          onClick={() => {
            if (globalSettingsReadOnly) return
            setOpen((c) => (c === 'subtitle' ? null : 'subtitle'))
          }}
          title={globalSettingsReadOnly ? `${subtitleLabel} (การตั้งค่าโปรเจกต์ อ่านอย่างเดียว)` : 'ตั้งค่าซับไตเติล'}
        >
          <Type size={14} strokeWidth={1.8} />
          <span className="fc-gen-opt-label">{subtitleLabel}</span>
          {!globalSettingsReadOnly ? <ChevronDown size={12} strokeWidth={2} /> : null}
        </button>
        <button
          type="button"
          className={`fc-gen-opt-btn${open === 'intro' || !introEnabled ? ' active' : ''}${globalSettingsReadOnly ? ' is-readonly' : ''}`}
          disabled={globalLocked}
          onClick={() => {
            if (globalSettingsReadOnly) return
            setOpen((c) => (c === 'intro' ? null : 'intro'))
          }}
          title={globalSettingsReadOnly ? `${introLabel} (การตั้งค่าโปรเจกต์ อ่านอย่างเดียว)` : 'ตัวอักษรแนะนำตัวละคร'}
        >
          <Users size={14} strokeWidth={1.8} />
          <span className="fc-gen-opt-label">{introLabel}</span>
          {!globalSettingsReadOnly ? <ChevronDown size={12} strokeWidth={2} /> : null}
        </button>
        <button
          type="button"
          className={`fc-gen-opt-btn${open === 'model' ? ' active' : ''}`}
          disabled={disabled}
          onClick={() => setOpen((c) => (c === 'model' ? null : 'model'))}
        >
          <BarChart3 size={14} strokeWidth={1.8} />
          <span className="fc-gen-opt-label">{modelLabel}</span>
          <ChevronDown size={12} strokeWidth={2} />
        </button>
        <button
          type="button"
          className={`fc-gen-opt-btn${open === 'link' || linkLastFrame ? ' active' : ''}${globalSettingsReadOnly ? ' is-readonly' : ''}`}
          disabled={globalLocked}
          onClick={() => {
            if (globalSettingsReadOnly) return
            setOpen((c) => (c === 'link' ? null : 'link'))
          }}
          title={globalSettingsReadOnly ? `${linkLastFrame ? 'เชื่อมเฟรมท้าย' : 'สร้างพร้อมกัน'} (การตั้งค่าโปรเจกต์ อ่านอย่างเดียว)` : 'เชื่อมต่อเฟรมท้ายระหว่างช็อต'}
        >
          <Link2 size={14} strokeWidth={1.8} />
          <span className="fc-gen-opt-label">{linkLastFrame ? 'เชื่อมเฟรมท้าย' : 'สร้างพร้อมกัน'}</span>
          {!globalSettingsReadOnly ? <ChevronDown size={12} strokeWidth={2} /> : null}
        </button>
        <button
          type="button"
          className="fc-gen-opt-btn drama-seedance-help-btn"
          disabled={disabled}
          title="กฎการส่งค่าและการใช้งาน Seedance"
          aria-label="กฎการส่งค่าและการใช้งาน Seedance"
          onClick={() => setRulesOpen(true)}
        >
          <CircleHelp size={14} strokeWidth={1.8} />
        </button>
      </div>
      <SeedanceRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      {open && panelStyle
        ? createPortal(
            <>
              {open === 'style' ? (
                <div
                  className="fc-gen-opt-panel fc-gen-style-panel drama-ep-opt-panel fc-gen-opt-panel--portal"
                  style={panelStyle}
                  role="dialog"
                  aria-label="สไตล์วิดีโอ"
                >
                  <div className="fc-gen-opt-panel-title">สไตล์วิดีโอ</div>
                  <div className="fc-gen-style-grid">
                    {IMAGE_STYLE_OPTIONS.map((opt) => {
                      const selected = styleId === opt.id
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          className={`fc-gen-style-card${selected ? ' selected' : ''}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            onStyleChange(opt.id)
                            setOpen(null)
                          }}
                        >
                          <DramaImageStylePreviewImg styleId={opt.id} alt={opt.label} />
                          <span>{opt.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}
              {open === 'model' ? (
                <div
                  className="fc-gen-opt-panel drama-ep-opt-panel fc-gen-opt-panel--portal"
                  style={panelStyle}
                  role="dialog"
                  aria-label="โมเดลวิดีโอ"
                >
                  <div className="fc-gen-opt-panel-title">โมเดลวิดีโอ</div>
                  <DramaMediaModelPicker
                    models={videoModels}
                    selectedId={modelId}
                    emptyHint="กรุณาตั้งค่าโมเดลเริ่มต้นในระบบจัดการก่อน"
                    onSelect={(opt) => {
                      onModelChange(opt.id)
                      setOpen(null)
                    }}
                  />
                </div>
              ) : null}
              {open === 'link' ? (
                <div
                  className="fc-gen-opt-panel drama-ep-opt-panel fc-gen-opt-panel--portal"
                  style={panelStyle}
                  role="dialog"
                  aria-label="การเชื่อมต่อระหว่างช็อต"
                >
                  <div className="fc-gen-opt-panel-title">การเชื่อมต่อระหว่างช็อต</div>
                  <label className="drama-ep-link-last-frame">
                    <input
                      type="checkbox"
                      checked={linkLastFrame}
                      disabled={disabled}
                      onChange={(e) => onLinkLastFrameChange(e.target.checked)}
                    />
                    <span>
                      เชื่อมต่อด้วยเฟรมท้ายของช็อตก่อนหน้า
                      <em>
                        เปิดใช้งานเป็นค่าเริ่มต้น สร้างตามลำดับช็อต สามารถส่งช็อตถัดไปล่วงหน้าและรอในคิวจนช็อตก่อนหน้าเสร็จสิ้น หากปิดจะสร้างแบบขนานพร้อมกันทันที เมื่อสลับการตั้งค่าจะจัดลำดับงานที่ยังไม่เริ่มใหม่ทันที หากมีตัวละคร/ฉากอ้างอิงจะแนบภาพเฟรมท้ายเป็นภาพอ้างอิง (ห้ามใช้ปนกับ first_frame)
                      </em>
                    </span>
                  </label>
                </div>
              ) : null}
              {open === 'subtitle' ? (
                <div
                  className="fc-gen-opt-panel drama-ep-opt-panel fc-gen-opt-panel--portal"
                  style={panelStyle}
                  role="dialog"
                  aria-label="ตั้งค่าซับไตเติล"
                >
                  <div className="fc-gen-opt-panel-title">ตั้งค่าซับไตเติล</div>
                  <label className="drama-ep-link-last-frame">
                    <input
                      type="radio"
                      name="episode-subtitle-mode"
                      checked={subtitleMode === 'model'}
                      disabled={disabled}
                      onChange={() => onSubtitleModeChange('model')}
                    />
                    <span>
                      โมเดลสร้างซับไตเติลโดยตรง
                      <em>
                        เมื่อสลับจะเพิ่มคำสั่งพร้อมท์ «ซิงค์ซับไตเติล / คำบอกบท» ในช็อตปัจจุบันทันที โมเดลจะใส่ซับไตเติลลงในวิดีโอโดยตรงขณะสร้าง
                      </em>
                    </span>
                  </label>
                  <label className="drama-ep-link-last-frame">
                    <input
                      type="radio"
                      name="episode-subtitle-mode"
                      checked={subtitleMode === 'post'}
                      disabled={disabled}
                      onChange={() => onSubtitleModeChange('post')}
                    />
                    <span>
                      ใส่ซับไตเติลในขั้นตอนตัดต่อภายหลัง
                      <em>
                        เมื่อสลับจะตัดคำสั่งซับไตเติลออกจากช็อตปัจจุบันทันที เพื่อนำไปใส่ซับไตเติลในโปรแกรมตัดต่อวิดีโอภายหลัง
                      </em>
                    </span>
                  </label>
                </div>
              ) : null}
              {open === 'intro' ? (
                <div
                  className="fc-gen-opt-panel drama-ep-opt-panel fc-gen-opt-panel--portal"
                  style={panelStyle}
                  role="dialog"
                  aria-label="ตัวอักษรแนะนำตัวละคร"
                >
                  <div className="fc-gen-opt-panel-title">ตัวอักษรแนะนำตัวละคร</div>
                  <label className="drama-ep-link-last-frame">
                    <input
                      type="radio"
                      name="episode-character-intro-mode"
                      checked={characterIntroMode === 'model'}
                      disabled={disabled}
                      onChange={() => onCharacterIntroModeChange('model')}
                    />
                    <span>
                      ซ้อนตัวอักษรแนะนำจากโมเดล
                      <em>
                        เมื่อเปิดใช้งาน เมื่อแบ่งสตอรี่บอร์ดใหม่จะใส่คำสั่ง «แนะนำตัวละคร · ข้อความซ้อน · ข้างตัวละคร» สำหรับตัวละครสำคัญที่ปรากฏตัวครั้งแรก โมเดลจะแสดงตัวอักษรแนะนำข้างตัวละครขณะสร้าง
                      </em>
                    </span>
                  </label>
                  <label className="drama-ep-link-last-frame">
                    <input
                      type="radio"
                      name="episode-character-intro-mode"
                      checked={characterIntroMode === 'off'}
                      disabled={disabled}
                      onChange={() => onCharacterIntroModeChange('off')}
                    />
                    <span>
                      ปิดตัวอักษรแนะนำตัวละคร
                      <em>
                        เมื่อสลับจะนำบรรทัดข้อความแนะนำตัวละครออกจากช็อตปัจจุบันทันที และห้ามแสดงการ์ดข้อความในภาพ หากต้องการนำกลับมาต้องแบ่งสตอรี่บอร์ดใหม่
                      </em>
                    </span>
                  </label>
                </div>
              ) : null}
            </>,
            document.body,
          )
        : null}
    </div>
  )
}
