/**
 * ละครซีรีส์运镜 / 景别词库（对齐 docs/EPISODE_RULES.md §5）
 * 供分集แก้ไข @ 菜单插入画面行前缀或运镜短语
 */

export type DramaCameraLexiconGroup = 'shot' | 'move'

export type DramaCameraLexiconItem = {
  id: string
  group: DramaCameraLexiconGroup
  /** 列表展示名 */
  label: string
  /** 插入到脚本的文本（用户可继续补描写） */
  insert: string
  /** 一行说明 */
  hint: string
}

/** 景别标签：写入画面行，勿标成对白 */
export const DRAMA_SHOT_SIZE_LEXICON: DramaCameraLexiconItem[] = [
  { id: 'empty', group: 'shot', label: 'ช็อตทิวทัศน์ว่างเปล่า (Empty Shot)', insert: 'ช็อตทิวทัศน์ว่างเปล่า: ', hint: 'สร้างบรรยากาศสถานที่ ไม่มีบทพูดและเสียงบรรยาย' },
  { id: 'wide', group: 'shot', label: 'ภาพมุมกว้างมาก (Extreme Wide Shot)', insert: 'ภาพมุมกว้างมาก: ', hint: 'แสดงความสัมพันธ์ของพื้นที่และสภาพแวดล้อม' },
  { id: 'full', group: 'shot', label: 'ภาพระยะไกล (Wide Shot)', insert: 'ภาพระยะไกล: ', hint: 'เห็นเต็มตัวพร้อมสภาพแวดล้อมโดยรอบ' },
  { id: 'medium', group: 'shot', label: 'ภาพระยะกลาง (Medium Shot)', insert: 'ภาพระยะกลาง: ', hint: 'ระดับเอวขึ้นไป เหมาะสำหรับบทสนทนา' },
  { id: 'close', group: 'shot', label: 'ภาพระยะใกล้ (Medium Close-up)', insert: 'ภาพระยะใกล้: ', hint: 'ระดับอกขึ้นไป ถ่ายทอดอารมณ์ความรู้สึก' },
  { id: 'closeup', group: 'shot', label: 'ภาพโคลสอัพ (Close-up)', insert: 'ภาพโคลสอัพ: ', hint: 'เน้นใบหน้าหรืออุปกรณ์/พร็อพชิ้นสำคัญ' },
  { id: 'ecu', group: 'shot', label: 'ภาพโคลสอัพขั้นสุด (Extreme Close-up)', insert: 'ภาพโคลสอัพขั้นสุด: ', hint: 'เจาะลึกเฉพาะดวงตา มือ หรือรายละเอียดชิ้นงาน' },
  { id: 'establish', group: 'shot', label: 'ช็อตเปิดตัวสร้างฉาก (Establishing Shot)', insert: 'ช็อตเปิดตัวสร้างฉาก: ', hint: 'เปิดฉากเพื่อกำหนดบรรยากาศของสถานที่' },
  { id: 'atmosphere', group: 'shot', label: 'ช็อตสร้างบรรยากาศ (Atmospheric Shot)', insert: 'ช็อตสร้างบรรยากาศ: ', hint: 'เน้นแสงเงา สภาพอากาศ หรือวัตถุเสริมอารมณ์' },
]

/** 运镜短语：单段运动轴建议 ≤ 2 */
export const DRAMA_CAMERA_MOVE_LEXICON: DramaCameraLexiconItem[] = [
  { id: 'push', group: 'move', label: 'ดอลลี่อิน (Push In / Dolly In)', insert: 'ดอลลี่อิน: ', hint: 'เคลื่อนกล้องเข้าใกล้จุดสนใจ' },
  { id: 'pull', group: 'move', label: 'ดอลลี่เอาต์ (Pull Out / Dolly Out)', insert: 'ดอลลี่เอาต์: ', hint: 'เคลื่อนกล้องถอยหลังเปิดพื้นที่กว้างขึ้น' },
  { id: 'pan', group: 'move', label: 'แพนกล้อง (Pan / Tilt)', insert: 'แพนกล้อง: ', hint: 'กล้องอยู่กับที่ กวาดมองแนวนอนหรือแนวตั้ง' },
  { id: 'truck', group: 'move', label: 'เคลื่อนกล้องตามแนวขนาน (Truck / Track)', insert: 'เคลื่อนกล้องตามแนวขนาน: ', hint: 'เลื่อนตำแหน่งกล้องขนานไปกับวัตถุ' },
  { id: 'follow', group: 'move', label: 'เคลื่อนกล้องตามตัวละคร (Follow Shot)', insert: 'เคลื่อนกล้องตามตัวละคร: ', hint: 'ติดตามการเคลื่อนไหวของบุคคล' },
  { id: 'high', group: 'move', label: 'มุมมองกดจากมุมสูง (High Angle)', insert: 'มุมมองกดจากมุมสูง: ', hint: 'มุมกล้องกดลงจากด้านบน' },
  { id: 'low', group: 'move', label: 'มุมมองงัดจากมุมต่ำ (Low Angle)', insert: 'มุมมองงัดจากมุมต่ำ: ', hint: 'มุมกล้องเสยขึ้นจากด้านล่าง' },
  { id: 'aerial', group: 'move', label: 'ภาพมุมสูงจากอากาศ (Aerial / Drone Shot)', insert: 'ภาพมุมสูงจากอากาศ: ', hint: 'มุมมองเบิร์ดอายวิวจากมุมสูงมาก' },
]

/** 合并词库（插入列表用） */
export const DRAMA_CAMERA_LEXICON: DramaCameraLexiconItem[] = [
  ...DRAMA_SHOT_SIZE_LEXICON,
  ...DRAMA_CAMERA_MOVE_LEXICON,
]

/** 运镜使用คำแนะนำ（只展示，不插入） */
export const DRAMA_CAMERA_USAGE_TIPS = [
  'สูตร: ประธาน + การกระทำ + ฉาก + (ขนาดภาพ/มุมกล้อง) + (แสงเงา)',
  'การเคลื่อนไหวของกล้องไม่ควรเกิน 2 แกนต่อช่วง (เช่น ดอลลี่อิน+แพนได้ แต่หาก ดอลลี่อิน+แพน+ยกกล้อง อาจหลุดการควบคุม)',
  'ภาพระยะใกล้หากหมุนกล้องกว้างเกินไปใบหน้าอาจบิดเบี้ยว การหมุนกล้องรอบตัวควรใช้กับภาพระยะกลางขึ้นไป',
  'ช็อตทิวทัศน์หรือขนาดภาพต้องเขียนเป็นภาษาภาพ ห้ามระบุเป็นบทสนทนาหรือเสียงบรรยาย',
] as const

// 按关键字过滤词库（匹配 label / insert / hint）
export function filterDramaCameraLexicon(
  items: DramaCameraLexiconItem[],
  query: string,
): DramaCameraLexiconItem[] {
  const q = (query || '').trim().toLowerCase()
  if (!q) return items
  return items.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.insert.toLowerCase().includes(q) ||
      item.hint.toLowerCase().includes(q),
  )
}
