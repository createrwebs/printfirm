import { workspaceScope } from '../../../features/teams/workspaceScope'
/** 画布顶栏：กลับ、标题、บันทึกสถานะ、ตั้งค่า占位 */
import { useState } from 'react'
import { ChevronLeft, Maximize2, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCanvasStore } from './CanvasStore'
import type { CanvasSaveStatus } from './useCanvasAutoSave'

type Props = {
  variant?: 'fullscreen' | 'embedded'
}

/** บันทึกสถานะ文案 */
function saveStatusLabel(status: CanvasSaveStatus): string | null {
  if (status === 'dirty') return '未บันทึก'
  if (status === 'saving') return 'กำลังบันทึก…'
  if (status === 'saved') return '已บันทึก'
  if (status === 'error') return 'บันทึกไม่สำเร็จ'
  return null
}

/** เรนเดอร์画布页顶部工具栏 */
export function CanvasTopBar({ variant = 'fullscreen' }: Props) {
  const navigate = useNavigate()
  const { saveStatus, projectId, freeCanvasMode } = useCanvasStore()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const embedded = variant === 'embedded'
  const statusText = saveStatusLabel(saveStatus)

  return (
    <>
      <div className="fc-overlay fc-topbar">
        <div className="fc-topbar-left">
          {embedded ? null : (
            <button
              type="button"
              className="fc-icon-btn"
              aria-label="กลับ"
              title="กลับ"
              onClick={() => {
                if (freeCanvasMode) {
                  navigate(workspaceScope.teamId ? `/teams/${workspaceScope.teamId}?tab=projects` : '/canvas')
                  return
                }
                if (window.history.length > 1) navigate(-1)
                else navigate(`/drama/projects/${projectId}`)
              }}
            >
              <ChevronLeft size={20} strokeWidth={1.8} />
            </button>
          )}
          <span className="fc-topbar-title">
            {embedded ? 'แอสเซท画布' : freeCanvasMode ? '自由画布' : 'แอสเซท库编排'}
          </span>
          {statusText ? (
            <span
              className={`fc-save-pill${
                saveStatus === 'error'
                  ? ' is-error'
                  : saveStatus === 'dirty'
                    ? ' is-dirty'
                    : saveStatus === 'saving'
                      ? ' is-saving'
                      : ''
              }`}
            >
              <span className="fc-save-dot" />
              {statusText}
            </span>
          ) : null}
        </div>

        <div className="fc-topbar-right">
          {embedded ? (
            <button
              type="button"
              className="fc-icon-btn"
              aria-label="全屏画布"
              title="全屏画布"
              onClick={() => navigate(`/drama/projects/${projectId}/canvas`)}
            >
              <Maximize2 size={18} strokeWidth={1.8} />
            </button>
          ) : null}
          <button
            type="button"
            className="fc-icon-btn"
            aria-label="ตั้งค่า"
            title="ตั้งค่า"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((v) => !v)}
          >
            <Settings size={18} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {settingsOpen ? (
        <div className="fc-settings-pop" role="dialog" aria-label="画布ตั้งค่า">
          <strong>画布ตั้งค่า</strong>
          {freeCanvasMode
            ? '在画布上เพิ่ม节点、连线并สร้างรูปภาพ与วิดีโอ。布局与แอสเซท会自动บันทึก。'
            : '布局与โปรเจกต์แอสเซท会自动同步บันทึก。อัปโหลด走 OSS；合成时按需拉本地缓存。'}
          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              className="fc-icon-btn is-sm"
              style={{ width: 'auto', padding: '0 12px', borderRadius: 10 }}
              onClick={() => setSettingsOpen(false)}
            >
              ปิด
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
