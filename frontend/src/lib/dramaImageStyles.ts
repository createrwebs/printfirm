import { getActiveLocale, type Locale } from '../i18n/detect'

export const IMAGE_STYLE_IDS = [
  'retro-sci-fi-atompunk',
  'palace-intrigue-cold',
  'domestic-suspense-cold',
  'ancient-romance-soft',
  'ancient-chinese-mythology',
  'japanese-youth-film',
  'japanese-daily-natural',
  'korean-urban-soft',
  'chinese-urban-realistic',
  'wuxia-realistic-photo',
  '90s-realistic-film',
  'retro-narrative-film',
  'american-retro-hollywood',
  'neon-cyberpunk-film',
  '90s-rural-china-film',
  'cgi-3d-animation',
  'ghibli-handdrawn-anime',
  'tezuka-era-cartoon',
  'shanghai-animation',
  'pixel-art',
  'shadow-puppet-illustration',
] as const

export type ImageStyleId = (typeof IMAGE_STYLE_IDS)[number]

export const IMAGE_STYLE_LABELS_I18N: Record<Locale, Record<ImageStyleId, string>> = {
  th: {
    'retro-sci-fi-atompunk': 'ไซไฟเรโทร Atompunk',
    'palace-intrigue-cold': 'วังหลวงชิงอำนาจโทนเย็น',
    'domestic-suspense-cold': 'ระทึกขวัญสืบสวนโทนเย็น',
    'ancient-romance-soft': 'พีเรียดย้อนยุคโรแมนติกแสงนุ่ม',
    'ancient-chinese-mythology': 'มหากาพย์เทพนิยายโบราณ',
    'japanese-youth-film': 'ฟิล์มวัยรุ่นญี่ปุ่น',
    'japanese-daily-natural': 'ธรรมชาติชีวิตประจำวันญี่ปุ่น',
    'korean-urban-soft': 'ซีรีส์เกาหลีในเมืองแสงนุ่ม',
    'chinese-urban-realistic': 'ชีวิตคนเมืองสมจริง',
    'wuxia-realistic-photo': 'ยุทธภพกำลังภายในสมจริง',
    '90s-realistic-film': 'ภาพยนตร์ยุค 90 สมจริง',
    'retro-narrative-film': 'ภาพยนตร์เล่าเรื่องสไตล์เรโทร',
    'american-retro-hollywood': 'ฮอลลีวูดเรโทรคลาสสิก',
    'neon-cyberpunk-film': 'นีออนไซเบอร์พังก์',
    '90s-rural-china-film': 'ชนบทโบราณยุค 90',
    'cgi-3d-animation': 'แอนิเมชัน 3D',
    'ghibli-handdrawn-anime': 'อนิเมะวาดมือกลิ่นอายจิบลิ',
    'tezuka-era-cartoon': 'การ์ตูนคลาสสิกยุคเทะซึกะ',
    'shanghai-animation': 'แอนิเมชันสไตล์คลาสสิก',
    'pixel-art': 'พิกเซลอาร์ต (Pixel Art)',
    'shadow-puppet-illustration': 'ภาพประกอบหนังตะลุงโบราณ',
  },
  en: {
    'retro-sci-fi-atompunk': 'Retro Sci-Fi Atompunk',
    'palace-intrigue-cold': 'Palace Intrigue',
    'domestic-suspense-cold': 'Suspense Thriller',
    'ancient-romance-soft': 'Ancient Romance Soft',
    'ancient-chinese-mythology': 'Mythological Epic',
    'japanese-youth-film': 'Japanese Youth Film',
    'japanese-daily-natural': 'Japanese Daily Natural',
    'korean-urban-soft': 'Korean Urban Soft',
    'chinese-urban-realistic': 'Urban Realistic',
    'wuxia-realistic-photo': 'Wuxia Realistic Photo',
    '90s-realistic-film': '90s Realistic Film',
    'retro-narrative-film': 'Retro Narrative Film',
    'american-retro-hollywood': 'American Retro Hollywood',
    'neon-cyberpunk-film': 'Neon Cyberpunk Film',
    '90s-rural-china-film': '90s Rural Cinema',
    'cgi-3d-animation': '3D Animation',
    'ghibli-handdrawn-anime': 'Ghibli Style Hand-drawn',
    'tezuka-era-cartoon': 'Classic Cartoon Era',
    'shanghai-animation': 'Classic Folk Animation',
    'pixel-art': 'Pixel Art',
    'shadow-puppet-illustration': 'Shadow Puppet Illustration',
  },
  zh: {
    'retro-sci-fi-atompunk': '复古科幻原子朋克',
    'palace-intrigue-cold': '宫斗权谋冷峻',
    'domestic-suspense-cold': '国产悬疑冷调',
    'ancient-romance-soft': '古偶唯美柔光',
    'ancient-chinese-mythology': '中国古代神话史诗',
    'japanese-youth-film': '日式青春胶片',
    'japanese-daily-natural': '日式生活自然',
    'korean-urban-soft': '韩剧都市柔光',
    'chinese-urban-realistic': '国产都市写实',
    'wuxia-realistic-photo': '武侠江湖写实摄影',
    '90s-realistic-film': '90年代写实电影',
    'retro-narrative-film': '复古叙事电影',
    'american-retro-hollywood': '美式复古好莱坞',
    'neon-cyberpunk-film': '霓虹赛博电影',
    '90s-rural-china-film': '90年代中国农村电影',
    'cgi-3d-animation': '3D 动画',
    'ghibli-handdrawn-anime': '宫崎骏气质手绘',
    'tezuka-era-cartoon': '手冢治虫时代卡通画风',
    'shanghai-animation': '上美画风',
    'pixel-art': '像素风',
    'shadow-puppet-illustration': '皮影戏插画',
  },
}

export const IMAGE_STYLE_OPTIONS: Array<{ id: ImageStyleId; label: string }> = IMAGE_STYLE_IDS.map((id) => ({
  id,
  get label() {
    const loc = getActiveLocale()
    return IMAGE_STYLE_LABELS_I18N[loc]?.[id] ?? IMAGE_STYLE_LABELS_I18N.th[id]
  },
}))

export const EPISODE_COUNT_PRESETS = [1, 12, 24, 36, 48] as const

export function getImageStyleLabel(styleId: string | undefined | null): string | null {
  if (!styleId) return null
  const loc = getActiveLocale()
  const typedId = styleId as ImageStyleId
  return IMAGE_STYLE_LABELS_I18N[loc]?.[typedId] ?? IMAGE_STYLE_LABELS_I18N.th[typedId] ?? styleId
}
