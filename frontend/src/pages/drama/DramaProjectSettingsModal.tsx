/** โครงร่าง「การตั้งค่าโปรเจกต์」：画幅/画风/คำบรรยาย (ซับไตเติล)/人物介绍/尾帧衔接（ทั่วไป可改；分镜页只读） */
import { useEffect, useState } from 'react'
import Modal from '../../components/ui/Modal'
import { DramaImageStyleModal } from './DramaImageStyleModal'
import {
  characterIntroModeEnabled,
  readEpisodeCharacterIntroMode,
  type DramaCharacterIntroMode,
} from '../../lib/dramaCharacterIntro'
import { type ImageStyleId } from '../../lib/dramaImageStyles'
import {
  DRAMA_RATIO_OPTIONS,
  readProjectAspectRatio,
  readProjectResolution,
  type DramaAspectRatio,
  type DramaResolution,
} from '../../lib/dramaProjectOutputSettings'
import {
  clampVideoResolutionForModel,
  hasKnownVideoModelResolutions,
  resolutionsForModel,
} from '../../lib/dramaVideoGenerationOptions'
import {
  catalogVideoModels,
  useMediaModelsCatalog,
} from '../../hooks/useMediaModelsCatalog'
import {
  readEpisodeSubtitleMode,
  subtitleModeUsesModelOutput,
  type DramaSubtitleMode,
} from '../../lib/dramaSubtitleSettings'
import type { DramaProject, DramaScript } from '../../api/drama'
import { dramaApi } from '../../api/drama'

type Props = {
  open: boolean
  projectId: number
  project: DramaProject
  script: DramaScript | null
  onClose: () => void
  onProjectChange: (p: DramaProject) => void
  onScriptChange: (s: DramaScript) => void
  onError: (msg: string) => void
}

type ChoiceProps<T extends string | boolean> = {
  options: Array<{ value: T; label: string }>
  value: T
  disabled?: boolean
  onChange: (value: T) => void
}

function coerceLinkLastFrame(params: Record<string, unknown> | null | undefined): boolean {
  const raw = params?.linkLastFrame ?? params?.link_last_frame
  if (raw == null) return true
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'number') return raw !== 0
  if (typeof raw === 'string') {
    const n = raw.trim().toLowerCase()
    if (['0', 'false', 'no', 'off', ''].includes(n)) return false
  }
  return Boolean(raw)
}

/** การตั้งค่าโปรเจกต์内选项条（复用โครงร่าง chip 样式） */
function SettingsChoiceRow<T extends string | boolean>({
  options,
  value,
  disabled,
  onChange,
}: ChoiceProps<T>) {
  return (
    <div className="drama-project-settings-chips" role="group">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          className={`drama-outline-chip-btn${value === opt.value ? ' is-on' : ''}`}
          disabled={disabled}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

/** โปรเจกต์级ทั่วไป成片ตั้งค่า弹窗 */
export function DramaProjectSettingsModal({
  open,
  projectId,
  project,
  script,
  onClose,
  onProjectChange,
  onScriptChange,
  onError,
}: Props) {
  const [saving, setSaving] = useState(false)
  const projectParams = (project.params || {}) as Record<string, unknown>
  const styleId = (String(script?.params?.image_style_id || projectParams.image_style_id || '') ||
    '') as ImageStyleId | ''
  const aspectRatio = readProjectAspectRatio(projectParams)
  const resolution = readProjectResolution(projectParams)
  const catalog = useMediaModelsCatalog()
  const videoModels = catalogVideoModels(catalog)
  const videoModelId =
    String(projectParams.video_model || projectParams.model_id || '').trim() ||
    catalog?.defaults.video_model ||
    ''
  const resolutionOptions = resolutionsForModel(videoModelId, catalog, videoModels)
  const clampedResolution = clampVideoResolutionForModel(
    videoModelId,
    resolution,
    catalog,
    videoModels,
  ) as DramaResolution
  const subtitleMode = readEpisodeSubtitleMode(projectParams)
  const characterIntroMode = readEpisodeCharacterIntroMode(projectParams)
  const linkLastFrame = coerceLinkLastFrame(projectParams)

  useEffect(() => {
    if (!open || saving) return
    if (!hasKnownVideoModelResolutions(videoModelId, catalog, videoModels)) return
    if (clampedResolution === resolution) return
    void patchProjectParams({ resolution: clampedResolution })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, videoModelId, catalog, clampedResolution])

  async function patchProjectParams(patch: Record<string, unknown>) {
    setSaving(true)
    try {
      const nextParams = { ...projectParams, ...patch }
      const updated = await dramaApi.updateProject(projectId, { params: nextParams })
      onProjectChange(updated)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'การตั้งค่าโปรเจกต์บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function handleStyleChange(id: ImageStyleId | '') {
    setSaving(true)
    try {
      const updated = await dramaApi.updateScript(projectId, {
        image_style_id: id || undefined,
      })
      onScriptChange(updated)
      const p = await dramaApi.getProject(projectId)
      onProjectChange(p)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'สไตล์บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="การตั้งค่าโปรเจกต์"
      size="md"
      className="drama-project-settings-modal"
      footer={
        <button type="button" className="drama-btn-primary" onClick={onClose} disabled={saving}>
          เสร็จสิ้น
        </button>
      }
    >
      <div className="drama-project-settings">
        <p className="drama-muted drama-project-settings-lead">
          全โปรเจกต์统一；分镜页只读展示。修改画幅后请สร้างใหม่相关镜头。
        </p>

        <section className="drama-project-settings-section">
          <div className="drama-project-settings-head">
            <h4>画幅</h4>
          </div>
          <SettingsChoiceRow
            value={aspectRatio}
            disabled={saving}
            options={DRAMA_RATIO_OPTIONS.map((r) => ({ value: r as DramaAspectRatio, label: r }))}
            onChange={(ratio) => void patchProjectParams({ aspect_ratio: ratio })}
          />
          <div className="drama-project-settings-head">
            <h4>ความคมชัด</h4>
          </div>
          <SettingsChoiceRow
            value={clampedResolution}
            disabled={saving}
            options={resolutionOptions.map((r) => ({ value: r as DramaResolution, label: r }))}
            onChange={(res) => void patchProjectParams({ resolution: res })}
          />
        </section>

        <section className="drama-project-settings-section">
          <div className="drama-project-settings-head">
            <h4>สไตล์ภาพ</h4>
          </div>
          <DramaImageStyleModal
            variant="field"
            fieldLabel=""
            title="เลือกสไตล์ภาพของโปรเจกต์"
            emptyLabel="เลือกสไตล์"
            value={styleId}
            disabled={saving}
            onChange={(id) => void handleStyleChange(id)}
          />
        </section>

        <section className="drama-project-settings-section">
          <div className="drama-project-settings-head">
            <h4>คำบรรยาย (ซับไตเติล)方式</h4>
          </div>
          <SettingsChoiceRow
            value={subtitleMode}
            disabled={saving}
            options={[
              { value: 'post' as DramaSubtitleMode, label: '后期คำบรรยาย (ซับไตเติล)' },
              { value: 'model' as DramaSubtitleMode, label: '模型คำบรรยาย (ซับไตเติล)' },
            ]}
            onChange={(mode) =>
              void patchProjectParams({
                subtitleMode: mode,
                subtitleEnabled: subtitleModeUsesModelOutput(mode),
              })
            }
          />
          <p className="drama-muted">后期คำบรรยาย (ซับไตเติล)成片后拼接；模型คำบรรยาย (ซับไตเติล)生成时烧录。</p>
        </section>

        <section className="drama-project-settings-section">
          <div className="drama-project-settings-head">
            <h4>人物介绍叠字</h4>
          </div>
          <SettingsChoiceRow
            value={characterIntroMode}
            disabled={saving}
            options={[
              { value: 'off' as DramaCharacterIntroMode, label: '无介绍叠字' },
              { value: 'model' as DramaCharacterIntroMode, label: '人物介绍' },
            ]}
            onChange={(mode) =>
              void patchProjectParams({
                characterIntroMode: mode,
                characterIntroEnabled: characterIntroModeEnabled(mode),
              })
            }
          />
        </section>

        <section className="drama-project-settings-section">
          <div className="drama-project-settings-head">
            <h4>镜间衔接</h4>
          </div>
          <SettingsChoiceRow
            value={linkLastFrame}
            disabled={saving}
            options={[
              { value: true, label: '尾帧衔接' },
              { value: false, label: '并发生成' },
            ]}
            onChange={(enabled) => void patchProjectParams({ linkLastFrame: enabled })}
          />
          <p className="drama-muted">开启后后一镜会参考前一镜尾帧，สไตล์更连贯。</p>
        </section>
      </div>
    </Modal>
  )
}
