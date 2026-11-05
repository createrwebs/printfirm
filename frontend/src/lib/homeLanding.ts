/** 官网首页宣传文案与结构数据 */

/*
 * HOME_PIPELINE 成片三步
 * HOME_DRAMA_STEPS ละครซีรีส์路径标签
 * HOME_KEPU_STEPS 科普路径标签
 * HOME_CAPABILITIES 能力说明
 * HOME_AUDIENCES 适用对象
 */

export const HOME_PIPELINE = [
  { step: '01', title: '写下创意', desc: 'สรุปเรื่องในหนึ่งประโยค、知识点或完整剧本，都能作为起点。' },
  { step: '02', title: '生成แอสเซท', desc: 'ตัวละคร、ฉาก、อุปกรณ์/พร็อพ与น้ำเสียง入库，后续镜头保持同一套面孔。' },
  { step: '03', title: '分镜成片', desc: '按集拆镜、引用แอสเซท、生成画面与วิดีโอ，导出可播成片。' },
] as const

export const HOME_DRAMA_STEPS = ['AI 生剧本', 'ตัวละคร与ฉาก', '分集分镜', '成片导出'] as const

export const HOME_KEPU_STEPS = ['选สไตล์ภาพ', '写分镜เสียงบรรยาย', 'เสียงพากย์与成片', '批量出片'] as const

export const HOME_CAPABILITIES = [
  {
    title: '19 种成片风格',
    desc: '从神话史诗到都市写实、赛博霓虹，选定后贯穿整部作品。',
  },
  {
    title: 'แอสเซท可复用',
    desc: 'ตัวละคร、ฉาก、อุปกรณ์/พร็อพ、น้ำเสียง一次生成，全剧引用，避免每镜重画。',
  },
  {
    title: '分镜可แก้ไข',
    desc: '脚本里 @ 引用แอสเซท、插入ความยาว与运镜，生成前就能看清这一镜。',
  },
  {
    title: '两条出片路径',
    desc: 'ละครซีรีส์走分集叙事，科普走分镜流水线，同一套账号与积分。',
  },
] as const

export const HOME_AUDIENCES = [
  { title: 'ละครสั้นผู้สร้างสรรค์ (Creator)', desc: '把故事拆成可拍的分集，先出แอสเซท再成片。' },
  { title: '知识博主', desc: '把文章变成竖屏讲解片，风格统一、节奏可控。' },
  { title: '团队制作', desc: 'โปรเจกต์、แอสเซท、历史集中在一处，少在工具间来回搬。' },
] as const
