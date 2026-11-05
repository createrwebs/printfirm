/** โปรเจกต์卡片「เพิ่มเติม」菜单：点选项、移出或点外部即ย่อเก็บ */
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'

type Props = {
  onRename: () => void
  onDelete: () => void
  onPublish?: () => void
}

// 鼠标离开后延迟ย่อเก็บ，避免滑向菜单项时被立刻关掉
const HIDE_DELAY_MS = 120

// เรนเดอร์โปรเจกต์卡片重命名 / ลบ菜单
export function DramaProjectCardMenu({ onRename, onDelete, onPublish }: Props) {
  /*
   * open 菜单是否ขยาย
   * rootRef 用于点外部ปิด
   * hideTimerRef 移出后延迟ย่อเก็บ
   * ignoreToggleRef 挡住菜单卸掉后穿透到「⋯」的同一次 click
   */
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ignoreToggleRef = useRef(false)

  // ยกเลิก待ย่อเก็บ
  function cancelHide() {
    if (!hideTimerRef.current) return
    clearTimeout(hideTimerRef.current)
    hideTimerRef.current = null
  }

  // 延迟ย่อเก็บ菜单
  function scheduleHide() {
    cancelHide()
    hideTimerRef.current = setTimeout(() => {
      setOpen(false)
      hideTimerRef.current = null
    }, HIDE_DELAY_MS)
  }

  // 立刻ย่อเก็บ后再执行การดำเนินการ，避免弹窗打开后菜单仍挂着
  function closeThenRun(action: () => void) {
    cancelHide()
    ignoreToggleRef.current = true
    flushSync(() => setOpen(false))
    action()
    window.setTimeout(() => {
      ignoreToggleRef.current = false
    }, 0)
  }

  useEffect(() => () => cancelHide(), [])

  // 点外部、滚动或 Esc 时ย่อเก็บ
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      const node = event.target
      if (node instanceof Node && rootRef.current?.contains(node)) return
      setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    function onScroll() {
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  return (
    <div
      ref={rootRef}
      className="drama-project-row-more"
      onMouseEnter={cancelHide}
      onMouseLeave={scheduleHide}
    >
      <button
        type="button"
        className="drama-project-row-more-btn"
        aria-label="เพิ่มเติมการดำเนินการ"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(event) => {
          event.stopPropagation()
          if (ignoreToggleRef.current) return
          cancelHide()
          setOpen((curr) => !curr)
        }}
      >
        <MoreHorizontal size={16} strokeWidth={1.8} />
      </button>
      {open ? (
        <div className={`drama-project-row-menu${onPublish ? ' has-publish' : ''}`} role="menu">
          {onPublish && <button type="button" role="menuitem"
            onPointerDown={event => { event.preventDefault(); event.stopPropagation(); closeThenRun(onPublish) }}
            onClick={event => { event.stopPropagation(); if (!ignoreToggleRef.current) closeThenRun(onPublish) }}
          >เผยแพร่สู่ตลาดดิจิทัลแอสเซท</button>}
          <button
            type="button"
            role="menuitem"
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              closeThenRun(onRename)
            }}
            onClick={(event) => {
              event.stopPropagation()
              if (ignoreToggleRef.current) return
              closeThenRun(onRename)
            }}
          >
            重命名
          </button>
          <button
            type="button"
            role="menuitem"
            className="is-danger"
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              closeThenRun(onDelete)
            }}
            onClick={(event) => {
              event.stopPropagation()
              if (ignoreToggleRef.current) return
              closeThenRun(onDelete)
            }}
          >
            ลบ
          </button>
        </div>
      ) : null}
    </div>
  )
}
