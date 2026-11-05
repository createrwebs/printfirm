/** แอสเซท生图结构前缀（与 backend generation_prompt 对齐）：抽取/รีเฟรชคำแนะนำ词时写入框内，生图ส่ง不再静默拼接。 */

export const CHARACTER_PROMPT_PREFIX =
  '【强制任务：การตั้งค่าบทบาทตัวละคร板构图】' +
  '纯白背景，无复杂背景、无遮挡、无文字水印。' +
  '画面左侧为同一ตัวละคร的全身三视图，占据主要视觉区域，从左到右固定为：' +
  '1.正面全身站姿；2.左侧面全身站姿；3.背面全身站姿。' +
  '三人必须是同一ตัวละคร：五官、发型、服装、体型、身高比例完全一致。' +
  '站姿自然，正面站立，双臂自然下垂，无其他动作，无夸张表情，全身完整入镜（从头到脚）。' +
  '同图还必须同时包含：①面部大头ภาพโคลสอัพ (Close-up)（五官、肤色、妆容与发际线清晰，可做人脸参考）；' +
  '②半身像ภาพโคลสอัพ (Close-up)（头肩至腰部，服饰上半与体态清晰）。' +
  '镜头平视，中性棚拍光，无夸张透视。' +
  '人物边缘清晰，服装版型明确，整体留白充足，类似ตัวละคร建模参考页/设定板排版。' +
  '严禁：只出单张全身或缺三视图；缺面部ภาพโคลสอัพ (Close-up)或缺半身像；风景/อุปกรณ์/พร็อพ为主体；复杂背景。' +
  '即使用户描述偏向ฉาก、物品或动作片段，也必须转化为可辨识的白底การตั้งค่าบทบาทตัวละคร板来呈现，' +
  '并据此补全外貌、体态与服饰。请严格依据以下用户描述生成上述结构的การตั้งค่าบทบาทตัวละคร图：'

export const SCENE_PROMPT_PREFIX =
  '【强制任务：ฉาก设计ภาพอ้างอิง构图】' +
  '单张图内同时包含平视视角与俯视视角。' +
  '画面左侧：围合空间的多面立面设计（含墙体ขยาย），须体现门洞/门及其他装修结构。' +
  '画面右侧：2～4 个功能区域的细节ขยาย（材质、家具或空间局部清晰可辨）。' +
  '以环境空间与建筑结构为主体，严禁人物ภาพโคลสอัพ (Close-up)、ตัวละคร立绘或以人物为视觉中心。' +
  '即使用户描述涉及人物、ตัวละคร或动作，也必须剥离人物主体，仅保留可独立成立的环境与结构信息。' +
  '请严格依据以下用户描述生成上述结构的ฉาก设计图：'

export const PROP_PROMPT_PREFIX =
  '【强制任务：อุปกรณ์/พร็อพ设定板构图】' +
  '纯白背景，无复杂背景、无遮挡、无文字水印。' +
  '画面左侧为同一อุปกรณ์/พร็อพ的完整三视图，占据主要视觉区域，从左到右固定为：' +
  '1.正面完整视图；2.左侧面完整视图；3.背面完整视图。' +
  '三件必须是同一อุปกรณ์/พร็อพ：外形轮廓、材质分区、颜色、比例、细节完全一致。' +
  '物件完整入镜，摆放平稳，无手持人物、无使用动作、无夸张透视。' +
  '同图还必须同时包含：①关键局部ภาพโคลสอัพ (Close-up)（铭文、机关、接口、纹样或破损等可辨识细节）；' +
  '②材质/结构半身级ภาพโคลสอัพ (Close-up)（表面质感、拼接与厚度清晰）。' +
  '镜头平视，中性棚拍光；物件边缘清晰，形制与比例明确，整体留白充足，类似อุปกรณ์/พร็อพ建模参考页/产品设定板排版。' +
  '严禁：只出单角度或缺三视图；缺局部ภาพโคลสอัพ (Close-up)；人物立绘/肖像；风景ฉาก为主体；复杂背景。' +
  '即使用户描述涉及人物使用或剧情动作，也必须剥离人物，仅保留可独立成立的อุปกรณ์/พร็อพ本体。' +
  '请严格依据以下用户描述生成上述结构的อุปกรณ์/พร็อพ设定图：'

export const MATERIAL_PROMPT_PREFIX =
  '【强制任务：生成气氛空镜素材】本次必须生成环境/气氛静帧，' +
  '强调构图、光影与氛围，可作为ละครสั้น空镜参考。' +
  '严禁生成可识别人脸ภาพโคลสอัพ (Close-up)或ตัวละคร立绘。' +
  '请严格依据以下用户描述生成素材画面：'

export const IMAGE_PROMPT_PREFIX =
  '【强制任务：按用户意图生成单张画面】' +
  '用户描述中的主体必须是画面绝对中心，禁止替换成无关物体，' +
  '禁止白底多视图设定板，禁止只出空镜氛围而丢掉主体。' +
  '请严格依据以下用户描述生成画面：'

const STRUCTURE_PREFIX_BY_KIND: Record<string, string> = {
  character: CHARACTER_PROMPT_PREFIX,
  scene: SCENE_PROMPT_PREFIX,
  prop: PROP_PROMPT_PREFIX,
  material: MATERIAL_PROMPT_PREFIX,
  none: MATERIAL_PROMPT_PREFIX,
  image: IMAGE_PROMPT_PREFIX,
}

/** 正文是否已含设定板/构图强制任务 */
export function promptHasStructurePrefix(prompt: string): boolean {
  const text = prompt || ''
  return text.includes('【强制任务：') || text.includes('全身三视图') || text.includes('完整三视图')
}

/** 补全结构前缀（Skill 优化丢前缀时用；正常由抽取/รีเฟรช落库） */
export function ensureStructureInPrompt(userPrompt: string, assetType?: string | null): string {
  const trimmed = (userPrompt || '').trim()
  if (!trimmed) return trimmed
  if (promptHasStructurePrefix(trimmed)) return trimmed
  const kind = (assetType || '').trim().toLowerCase()
  const prefix = STRUCTURE_PREFIX_BY_KIND[kind]
  if (!prefix) return trimmed
  return `${prefix}${trimmed}`
}
