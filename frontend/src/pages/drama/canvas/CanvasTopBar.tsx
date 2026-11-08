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
  if (status === 'dirty') return 'ยังไม่ได้บันทึก'
  if (status === 'saving') return 'กำลังบันทึก…'
  if (status === 'saved') return 'บันทึกแล้ว'
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
            {embedded ? 'แคนวาสแอสเซท' : freeCanvasMode ? 'แคนวาสอิสระ' : 'จัดลำดับคลังแอสเซท'}
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
              aria-label="แคนวาสเต็มหน้าจอ"
              title="แคนวาสเต็มหน้าจอ"
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
        <div className="fc-settings-pop" role="dialog" aria-label="ตั้งค่าแคนวาส">
          <strong>ตั้งค่าแคนวาส</strong>
          {freeCanvasMode
            ? 'เพิ่มโหนด เชื่อมโยงสาย และสร้างรูปภาพหรือวิดีโอบนแคนวาส เลย์เอาต์และแอสเซทจะถูกบันทึกอัตโนมัติ'
            : 'เลย์เอาต์และแอสเซทของโปรเจกต์จะซิงค์และบันทึกอัตโนมัติ อัปโหลดผ่าน OSS และดึงแคชในเครื่องเมื่อรวมไฟล์'}
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
