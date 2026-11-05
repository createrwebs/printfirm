/**
 * ละครสั้น剪辑节奏公式（社区 Skill 六式，用于分镜ความยาว建议 / 整集导出规划）
 * 对齐 docs/EPISODE_RULES.md §10 P3
 */

export type DramaEditRhythmId =
  | 'breath'
  | 'heartbeat'
  | 'wave'
  | 'elastic'
  | 'pulse'
  | 'silence_hammer'

export type DramaEditRhythmPreset = {
  id: DramaEditRhythmId
  label: string
  hint: string
  /** 相对节拍权重，会归一化到目标总วินาที数 */
  weights: number[]
}

export const DRAMA_EDIT_RHYTHM_PRESETS: DramaEditRhythmPreset[] = [
  {
    id: 'breath',
    label: 'จังหวะลมหายใจ (Breath)',
    hint: 'เริ่มช้า—ขยายอารมณ์—ผ่อนลง เหมาะสำหรับสร้างฉากและถ่ายทอดอารมณ์',
    weights: [3, 5, 4, 3],
  },
  {
    id: 'heartbeat',
    label: 'จังหวะชีพจรเต้น (Heartbeat)',
    hint: 'กระชับ เร่งความเร็ว เหมาะสำหรับฉากเผชิญหน้าและความขัดแย้ง',
    weights: [2, 2, 3, 2, 4],
  },
  {
    id: 'wave',
    label: 'จังหวะคลื่นซัด (Wave)',
    hint: 'ไต่ระดับอารมณ์แล้วปล่อยลง เหมาะสำหรับฉากไคลแมกซ์',
    weights: [3, 4, 5, 6, 3],
  },
  {
    id: 'elastic',
    label: 'จังหวะเวลายืดหยุ่น (Elastic)',
    hint: 'ขยายช่วงการกระทำสำคัญ บีบอัดช่วงอื่นๆ',
    weights: [2, 6, 2, 3],
  },
  {
    id: 'pulse',
    label: 'จังหวะพัลส์เป็นช่วง (Pulse)',
    hint: 'จังหวะสม่ำเสมอ เหมาะสำหรับตรงบีทเพลงและแนะนำกลุ่มตัวละคร',
    weights: [3, 3, 3, 3],
  },
  {
    id: 'silence_hammer',
    label: 'จังหวะค้อนแห่งความเงียบ (Silence Hammer)',
    hint: 'เงียบสงบสั่งสมพลังแล้วตัดฉับทันที เหมาะสำหรับฉากหักมุม',
    weights: [5, 2, 6],
  },
]

const SEGMENT_MIN = 3
const SEGMENT_MAX = 15

// 按节奏公式为 N 段分配วินาที数（钳制 3–15，合计贴近 targetTotal）
export function suggestRhythmDurations(
  segmentCount: number,
  rhythmId: DramaEditRhythmId,
  targetTotal = 15,
): number[] {
  const count = Math.max(1, Math.floor(segmentCount))
  const preset =
    DRAMA_EDIT_RHYTHM_PRESETS.find((p) => p.id === rhythmId) || DRAMA_EDIT_RHYTHM_PRESETS[0]
  const weights: number[] = []
  for (let i = 0; i < count; i++) {
    weights.push(preset.weights[i % preset.weights.length] || 3)
  }
  const sumW = weights.reduce((a, b) => a + b, 0) || 1
  const raw = weights.map((w) => (w / sumW) * Math.max(SEGMENT_MIN * count, targetTotal))
  const clamped = raw.map((v) => Math.max(SEGMENT_MIN, Math.min(SEGMENT_MAX, Math.round(v))))
  // 微调合计：过短则从最大段加，过长则从最大段减
  let total = clamped.reduce((a, b) => a + b, 0)
  const goal = Math.max(SEGMENT_MIN * count, Math.min(15, Math.round(targetTotal)))
  let guard = 0
  while (total < goal && guard < 40) {
    const idx = clamped.indexOf(Math.max(...clamped))
    if (clamped[idx] < SEGMENT_MAX) {
      clamped[idx] += 1
      total += 1
    } else break
    guard += 1
  }
  while (total > goal && guard < 80) {
    const idx = clamped.indexOf(Math.max(...clamped))
    if (clamped[idx] > SEGMENT_MIN) {
      clamped[idx] -= 1
      total -= 1
    } else break
    guard += 1
  }
  return clamped
}

// 整集导出规划：为每镜建议ความยาว（D-2 / 已有分镜条数）
export function suggestEpisodeFragmentDurations(
  fragmentCount: number,
  rhythmId: DramaEditRhythmId,
  /** 单镜目标ความยาว均值 */
  perFragmentTarget = 10,
): number[] {
  const count = Math.max(1, Math.floor(fragmentCount))
  const total = Math.min(15 * count, Math.max(4 * count, perFragmentTarget * count))
  return suggestRhythmDurations(count, rhythmId, total).map((sec) =>
    Math.max(4, Math.min(15, sec)),
  )
}
