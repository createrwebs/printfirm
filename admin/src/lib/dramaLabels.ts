import { getActiveLocale, type Locale } from "@/i18n/detect";

/** ละครซีรีส์แอสเซท生成สถานะ（与 params.generation.status 一致） */
export const DRAMA_GENERATION_STATUSES = [
  "queued",
  "running",
  "generating",
  "done",
  "failed",
  "cancelled",
] as const;

export const DRAMA_GENERATION_STATUS_LABELS_I18N: Record<Locale, Record<string, string>> = {
  th: {
    queued: "อยู่ในคิว",
    running: "กำลังสร้าง",
    generating: "กำลังสร้าง",
    done: "เสร็จสมบูรณ์",
    failed: "ล้มเหลว",
    cancelled: "ยกเลิกแล้ว",
    idle: "ยังไม่เริ่ม",
  },
  en: {
    queued: "Queued",
    running: "Generating",
    generating: "Generating",
    done: "Done",
    failed: "Failed",
    cancelled: "Cancelled",
    idle: "Idle",
  },
  zh: {
    queued: "กำลังรอคิว",
    running: "กำลังสร้าง",
    generating: "กำลังสร้าง",
    done: "เสร็จสมบูรณ์",
    failed: "ล้มเหลว",
    cancelled: "ยกเลิกแล้ว",
    idle: "未开始",
  },
};

/** ละครซีรีส์生成สถานะ标签（idle 仅用于分镜等无 params.generation 时的展示回退） */
export function dramaGenerationStatusLabel(status: string): string {
  const loc = getActiveLocale();
  return DRAMA_GENERATION_STATUS_LABELS_I18N[loc]?.[status] ?? DRAMA_GENERATION_STATUS_LABELS_I18N.th[status] ?? status;
}

/** 列表/รายละเอียด展示：空值显示 — */
export function formatDramaGenerationStatus(status: string | null | undefined): string {
  if (!status) return "—";
  return dramaGenerationStatusLabel(status);
}

export const DRAMA_ASSET_TYPE_LABELS_I18N: Record<Locale, Record<string, string>> = {
  th: {
    character: "ตัวละคร",
    scene: "ฉาก",
    prop: "อุปกรณ์",
    material: "ฟุตเทจ/素材",
    narration: "เสียงบรรยาย",
    video: "วิดีโอ",
    audio: "เสียง",
    text: "ข้อความ",
    none: "ไม่ระบุหมวด",
  },
  en: {
    character: "Character",
    scene: "Scene",
    prop: "Prop",
    material: "Material",
    narration: "Narration",
    video: "Video",
    audio: "Audio",
    text: "Text",
    none: "Uncategorized",
  },
  zh: {
    character: "ตัวละคร",
    scene: "ฉาก",
    prop: "อุปกรณ์/พร็อพ",
    material: "素材",
    narration: "เสียงบรรยาย",
    video: "วิดีโอ",
    audio: "เสียง",
    text: "文本",
    none: "未分类",
  },
};

/** ละครซีรีส์แอสเซทประเภท标签 */
export function dramaAssetTypeLabel(type: string): string {
  const loc = getActiveLocale();
  return DRAMA_ASSET_TYPE_LABELS_I18N[loc]?.[type] ?? DRAMA_ASSET_TYPE_LABELS_I18N.th[type] ?? type;
}
