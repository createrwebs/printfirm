/** 分 ตอน脚本 contentEditable：ความยาว/แอสเซท chip + @ 弹层 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { resolveDramaMediaUrl, type DramaAsset } from '../../api/drama'
import {
  deleteAdjacentEditorChip,
  detectMentionTriggerFromSelection,
  getCaretClientRect,
  insertDurationChipAtRange,
  insertMentionChipAtRange,
  insertPlainTextAtRange,
  nextDurationPresetSeconds,
  renderPromptEditorContent,
  resolveChipFromAsset,
  serializePromptEditorContent,
  sumContentDurationSeconds,
  updateDurationChipElement,
  type MentionCaretRect,
} from '../../lib/dramaEpisodePromptEditor'
import type { AssetScope } from './dramaEpisodeEditUtils'
import { EpisodeEditMentionPopover } from './EpisodeEditMentionPopover'

type Props = {
  content: string
  assets: DramaAsset[]
  referencedIds: Set<number>
  editing: boolean
  placeholder?: string
  onContentChange: (content: string) => void
  onOpenAsset?: (assetId: number) => void
}

// เรนเดอร์可แก้ไขบทสตอรี่บอร์ด
export function EpisodeEditPromptEditor({
  content,
  assets,
  referencedIds,
  editing,
  placeholder = '输入คำบรรยายภาพ、บทสนทนา、เสียงบรรยาย；键入 @ 引用แอสเซท或插入ความยาว…',
  onContentChange,
  onOpenAsset,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const lastEmittedRef = useRef(content)
  const mentionTriggerRangeRef = useRef<Range | null>(null)

  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionAnchorRect, setMentionAnchorRect] = useState<MentionCaretRect | null>(null)
  const [mentionScope, setMentionScope] = useState<AssetScope>('episode')
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0)
  const [mentionItemsCount, setMentionItemsCount] = useState(0)

  // 按แอสเซท id 解析 chip 展示数据
  const resolveChip = useCallback(
    (assetId: number) => {
      const asset = assets.find((a) => a.id === assetId)
      if (!asset) return null
      return resolveChipFromAsset(asset, resolveDramaMediaUrl(asset.cover || asset.url))
    },
    [assets],
  )

  // ปิด @ 弹层
  const closeMentionPopover = useCallback(() => {
    setMentionOpen(false)
    setMentionQuery('')
    setMentionActiveIndex(0)
    setMentionScope('episode')
    mentionTriggerRangeRef.current = null
  }, [])

  // 把 content 刷到แก้ไข器 DOM
  const paint = useCallback(
    (next: string) => {
      const editor = editorRef.current
      if (!editor) return
      renderPromptEditorContent(editor, next, resolveChip)
    },
    [resolveChip],
  )

  // 外部 content 变化时同步到 DOM（แก้ไข中忽略本แก้ไข器回写）
  useEffect(() => {
    if (editing && content === lastEmittedRef.current) return
    paint(content)
    lastEmittedRef.current = content
  }, [content, editing, paint])

  // 只读态แอสเซท列表变化时รีเฟรช chip 展示
  useEffect(() => {
    if (editing) return
    paint(content)
  }, [assets, content, editing, paint])

  // เข้าสู่แก้ไข时聚焦
  useEffect(() => {
    if (!editing) {
      closeMentionPopover()
      return
    }
    requestAnimationFrame(() => editorRef.current?.focus())
  }, [closeMentionPopover, editing])

  // 同步 @ 触发สถานะ
  const syncMentionTrigger = useCallback(() => {
    const editor = editorRef.current
    if (!editor || !editing) {
      closeMentionPopover()
      return
    }
    const trigger = detectMentionTriggerFromSelection(editor)
    const caretRect = getCaretClientRect()
    if (!trigger || !caretRect) {
      closeMentionPopover()
      return
    }
    mentionTriggerRangeRef.current = trigger.range
    setMentionOpen(true)
    setMentionQuery(trigger.query)
    setMentionAnchorRect(caretRect)
    setMentionActiveIndex(0)
  }, [closeMentionPopover, editing])

  // 把แก้ไข器内容回写到父级
  const emitContent = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    const next = serializePromptEditorContent(editor)
    lastEmittedRef.current = next
    onContentChange(next)
  }, [onContentChange])

  // เลือกแอสเซท插入 chip
  const handleSelectAsset = useCallback(
    (asset: DramaAsset) => {
      const editor = editorRef.current
      const triggerRange = mentionTriggerRangeRef.current
      if (!editor || !triggerRange) return
      const chip = resolveChipFromAsset(asset, resolveDramaMediaUrl(asset.cover || asset.url))
      insertMentionChipAtRange(triggerRange, chip)
      mentionTriggerRangeRef.current = null
      closeMentionPopover()
      emitContent()
      editor.focus()
    },
    [closeMentionPopover, emitContent],
  )

  // เลือกความยาว插入 chip
  const handleSelectDuration = useCallback(
    (seconds: number) => {
      const editor = editorRef.current
      const triggerRange = mentionTriggerRangeRef.current
      if (!editor || !triggerRange) return
      insertDurationChipAtRange(triggerRange, seconds)
      mentionTriggerRangeRef.current = null
      closeMentionPopover()
      emitContent()
      editor.focus()
    },
    [closeMentionPopover, emitContent],
  )

  // 插入景别 / 运镜前缀纯文本
  const handleSelectCameraPhrase = useCallback(
    (text: string) => {
      const editor = editorRef.current
      const triggerRange = mentionTriggerRangeRef.current
      if (!editor || !triggerRange || !text) return
      insertPlainTextAtRange(triggerRange, text)
      mentionTriggerRangeRef.current = null
      closeMentionPopover()
      emitContent()
      editor.focus()
    },
    [closeMentionPopover, emitContent],
  )

  const contentDurationTotal = sumContentDurationSeconds(
    mentionOpen && editorRef.current
      ? serializePromptEditorContent(editorRef.current)
      : content,
  )

  return (
    <>
      <div
        ref={editorRef}
        className={`drama-ep-prompt-editor${editing ? ' is-editing' : ''}`}
        role="textbox"
        aria-multiline="true"
        aria-label="บทสตอรี่บอร์ด"
        aria-readonly={!editing}
        contentEditable={editing}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={() => {
          emitContent()
          syncMentionTrigger()
        }}
        onKeyUp={syncMentionTrigger}
        onClick={(e) => {
          if (!editing) {
            const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-asset-id]')
            if (chip?.dataset.assetId) onOpenAsset?.(Number(chip.dataset.assetId))
            return
          }
          const durationChip = (e.target as HTMLElement).closest<HTMLElement>('[data-duration-sec]')
          if (durationChip && editorRef.current?.contains(durationChip)) {
            e.preventDefault()
            const current = Number(durationChip.dataset.durationSec)
            updateDurationChipElement(durationChip, nextDurationPresetSeconds(current))
            emitContent()
            closeMentionPopover()
            return
          }
          syncMentionTrigger()
        }}
        onKeyDown={(e) => {
          if (editing && (e.key === 'Backspace' || e.key === 'Delete') && editorRef.current) {
            const removed = deleteAdjacentEditorChip(
              editorRef.current,
              e.key === 'Backspace' ? 'backward' : 'forward',
            )
            if (removed) {
              e.preventDefault()
              emitContent()
              closeMentionPopover()
              return
            }
          }
          if (!mentionOpen) return
          if (e.key === 'Escape') {
            e.preventDefault()
            closeMentionPopover()
            return
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setMentionActiveIndex((i) => Math.min(i + 1, Math.max(mentionItemsCount - 1, 0)))
            return
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            setMentionActiveIndex((i) => Math.max(i - 1, 0))
            return
          }
          if (e.key === 'Enter' && mentionItemsCount > 0) {
            e.preventDefault()
            // Enter 由弹层แอสเซท列表在父级通过 activeIndex 处理较复杂，这里仅拦截避免换行打断触发
          }
        }}
      />

      <EpisodeEditMentionPopover
        open={mentionOpen && editing}
        query={mentionQuery}
        scope={mentionScope}
        assets={assets}
        referencedIds={referencedIds}
        anchorRect={mentionAnchorRect}
        activeIndex={mentionActiveIndex}
        contentDurationTotal={contentDurationTotal}
        onScopeChange={setMentionScope}
        onActiveIndexChange={setMentionActiveIndex}
        onItemsCountChange={setMentionItemsCount}
        onSelectAsset={handleSelectAsset}
        onSelectDuration={handleSelectDuration}
        onSelectCameraPhrase={handleSelectCameraPhrase}
        onClose={closeMentionPopover}
      />
    </>
  )
}
