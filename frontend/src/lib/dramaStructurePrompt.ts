/** โครงสร้างพรอมต์เริ่มต้นสำหรับแอสเซท (สอดคล้องกับ backend generation_prompt) */

export const CHARACTER_PROMPT_PREFIX =
  '【คำสั่งบังคับ: แผ่นตั้งค่าตัวละคร】พื้นหลังสีขาวล้วน ไม่มีฉากซับซ้อน ไม่มีสิ่งบัง และไม่มีลายน้ำ ' +
  'ด้านซ้ายต้องเป็นตัวละครเดียวกันแบบเต็มตัวสามมุมมอง: ด้านหน้า ด้านข้าง และด้านหลัง ' +
  'ใบหน้า ทรงผม เสื้อผ้า รูปร่าง และสัดส่วนต้องเหมือนกันทุกมุม ยืนท่าธรรมชาติ แขนวางลง และเห็นตั้งแต่ศีรษะถึงเท้า ' +
  'ในภาพเดียวกันต้องมีภาพใบหน้าโคลสอัปและภาพครึ่งตัวด้วย แสงสตูดิโอกลาง ขอบตัวละครคมชัด เว้นพื้นที่ว่างมากพอ ' +
  'ห้ามสร้างฉากหรือสิ่งของเป็นตัวหลัก และห้ามตัดสามมุมมอง ใบหน้า หรือภาพครึ่งตัวออก โปรดสร้างตามคำอธิบายต่อไปนี้:'

export const SCENE_PROMPT_PREFIX =
  '【คำสั่งบังคับ: แผ่นออกแบบฉาก】ให้พื้นที่และโครงสร้างอาคารเป็นตัวหลักในภาพเดียว ' +
  'แสดงมุมมองระดับสายตาและมุมมองด้านบน พร้อมผนัง ประตู หน้าต่าง และพื้นที่ใช้งานหลายส่วน ' +
  'ห้ามให้ตัวละครเป็นจุดสนใจ โปรดสร้างตามคำอธิบายฉากต่อไปนี้:'

export const PROP_PROMPT_PREFIX =
  '【คำสั่งบังคับ: แผ่นตั้งค่าวัตถุ】พื้นหลังสีขาวล้วน แสดงวัตถุชิ้นเดียวกันสามมุมมองด้านหน้า ด้านข้าง และด้านหลัง ' +
  'ต้องมีภาพรายละเอียดจุดสำคัญและพื้นผิววัสดุ ห้ามมีตัวละครหรือฉากซับซ้อน โปรดสร้างตามคำอธิบายวัตถุต่อไปนี้:'

export const MATERIAL_PROMPT_PREFIX =
  '【คำสั่งบังคับ: ภาพบรรยากาศ】สร้างภาพสภาพแวดล้อมและแสงเงาโดยไม่มีใบหน้าตัวละครเด่น โปรดสร้างตามคำอธิบายต่อไปนี้:'

export const IMAGE_PROMPT_PREFIX =
  '【คำสั่งบังคับ: ภาพตามเจตนาผู้ใช้】ให้สิ่งที่ผู้ใช้ระบุเป็นจุดศูนย์กลาง ห้ามแทนที่ด้วยสิ่งอื่น และห้ามเปลี่ยนเป็นแผ่นตั้งค่าหลายมุมมอง โปรดสร้างตามคำอธิบายต่อไปนี้:'

const STRUCTURE_PREFIX_BY_KIND: Record<string, string> = {
  character: CHARACTER_PROMPT_PREFIX,
  scene: SCENE_PROMPT_PREFIX,
  prop: PROP_PROMPT_PREFIX,
  material: MATERIAL_PROMPT_PREFIX,
  none: MATERIAL_PROMPT_PREFIX,
  image: IMAGE_PROMPT_PREFIX,
}

/** ตรวจสอบว่ามีคำสั่งบังคับโครงสร้างในพรอมต์แล้วหรือไม่ */
export function promptHasStructurePrefix(prompt: string): boolean {
  const text = prompt || ''
  return (
    text.includes('【คำสั่งบังคับ:') ||
    text.includes('【强制任务：') ||
    text.includes('สามมุมมอง') ||
    text.includes('三视图')
  )
}

/** เติมคำสั่งโครงสร้างนำหน้าพรอมต์ */
export function ensureStructureInPrompt(userPrompt: string, assetType?: string | null): string {
  const trimmed = (userPrompt || '').trim()
  if (!trimmed) return trimmed
  if (promptHasStructurePrefix(trimmed)) return trimmed

  const kind = (assetType || '').toLowerCase()
  const prefix = STRUCTURE_PREFIX_BY_KIND[kind] || STRUCTURE_PREFIX_BY_KIND.image
  return `${prefix}\n\n${trimmed}`
}

/** ลบคำสั่งโครงสร้างนำหน้าออกจากพรอมต์เพื่อแสดงผลให้ผู้ใช้ */
export function stripStructurePrefix(prompt: string): string {
  let text = (prompt || '').trim()
  for (const prefix of Object.values(STRUCTURE_PREFIX_BY_KIND)) {
    if (text.startsWith(prefix)) {
      text = text.slice(prefix.length).trim()
    }
  }
  return text.replace(/^【(?:คำสั่งบังคับ|强制任务)[^】]*】[^\n]*\n*/, '').trim()
}
