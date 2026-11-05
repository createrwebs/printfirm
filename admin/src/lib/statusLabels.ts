import { getActiveLocale, type Locale } from "@/i18n/detect";

export const PROJECT_STATUS_LABELS_I18N: Record<Locale, Record<string, string>> = {
  th: {
    DRAFT: "ฉบับร่าง",
    SCRIPTING: "กำลังสร้างบท",
    SCRIPT_READY: "บทพร้อมแล้ว",
    IMAGING: "กำลังสร้างภาพสตอรี่บอร์ด",
    IMAGE_READY: "ภาพสตอรี่บอร์ดพร้อมแล้ว",
    VIDEOING: "กำลังสร้างวิดีโอ",
    VIDEO_READY: "วิดีโอพร้อมแล้ว",
    AUDIOING: "กำลังสร้างเสียงพากย์",
    COMPOSING: "กำลังสังเคราะห์รวมวิดีโอ",
    AUDITING: "กำลังตรวจสอบ",
    DONE: "เสร็จสมบูรณ์",
    REJECTED: "ถูกปฏิเสธ",
    FAILED: "ล้มเหลว",
    CANCELLED: "ยกเลิกแล้ว",
  },
  en: {
    DRAFT: "Draft",
    SCRIPTING: "Scripting",
    SCRIPT_READY: "Script Ready",
    IMAGING: "Generating Storyboard",
    IMAGE_READY: "Storyboard Ready",
    VIDEOING: "Generating Video",
    VIDEO_READY: "Video Ready",
    AUDIOING: "Generating Voice",
    COMPOSING: "Composing",
    AUDITING: "Under Review",
    DONE: "Completed",
    REJECTED: "Rejected",
    FAILED: "Failed",
    CANCELLED: "Cancelled",
  },
  zh: {
    DRAFT: "ฉบับร่าง",
    SCRIPTING: "脚本กำลังสร้าง",
    SCRIPT_READY: "脚本就绪",
    IMAGING: "分镜图กำลังสร้าง",
    IMAGE_READY: "分镜图就绪",
    VIDEOING: "วิดีโอกำลังสร้าง",
    VIDEO_READY: "วิดีโอ就绪",
    AUDIOING: "เสียงพากย์中",
    COMPOSING: "合成中",
    AUDITING: "审核中",
    DONE: "เสร็จสมบูรณ์",
    REJECTED: "已拒绝",
    FAILED: "ล้มเหลว",
    CANCELLED: "ยกเลิกแล้ว",
  },
};

export const ORDER_STATUS_LABELS_I18N: Record<Locale, Record<string, string>> = {
  th: {
    pending: "รอชำระเงิน",
    paid: "ชำระแล้ว",
    closed: "ปิดแล้ว",
  },
  en: {
    pending: "Pending",
    paid: "Paid",
    closed: "Closed",
  },
  zh: {
    pending: "待支付",
    paid: "已支付",
    closed: "ปิดใช้งานแล้ว",
  },
};

export const AUDIT_STATUS_LABELS_I18N: Record<Locale, Record<string, string>> = {
  th: {
    pending: "รอตรวจสอบ",
    passed: "ผ่านการอนุมัติ",
    rejected: "ถูกปฏิเสธ",
  },
  en: {
    pending: "Pending",
    passed: "Passed",
    rejected: "Rejected",
  },
  zh: {
    pending: "待审核",
    passed: "已通过",
    rejected: "已拒绝",
  },
};

export const VISIBILITY_LABELS_I18N: Record<Locale, Record<string, string>> = {
  th: {
    public: "สาธารณะ",
    private: "ส่วนตัว",
    unlisted: "ไม่แสดงในรายการ",
  },
  en: {
    public: "Public",
    private: "Private",
    unlisted: "Unlisted",
  },
  zh: {
    public: "公开",
    private: "私密",
    unlisted: "不公开列出",
  },
};

export const LEDGER_KIND_LABELS_I18N: Record<Locale, Record<string, string>> = {
  th: {
    topup: "เติมเงิน",
    grant: "โบนัสของขวัญ",
    adjust: "ปรับยอดเงิน",
    freeze: "ระงับชั่วคราว",
    unfreeze: "ปลดระงับ",
    settle: "หักชำระ",
    refund: "คืนเงิน",
  },
  en: {
    topup: "Top-up",
    grant: "Bonus",
    adjust: "Adjustment",
    freeze: "Freeze",
    unfreeze: "Unfreeze",
    settle: "Settlement",
    refund: "Refund",
  },
  zh: {
    topup: "充值",
    grant: "赠送",
    adjust: "调账",
    freeze: "冻结",
    unfreeze: "解冻",
    settle: "结算",
    refund: "退款",
  },
};

export const PAY_TYPE_LABELS_I18N: Record<Locale, Record<string, string>> = {
  th: {
    alipay: "Alipay",
    wxpay: "WeChat Pay",
    stripe: "บัตรเครดิต · Stripe",
  },
  en: {
    alipay: "Alipay",
    wxpay: "WeChat Pay",
    stripe: "Card · Stripe",
  },
  zh: {
    alipay: "支付宝",
    wxpay: "微信",
    stripe: "银行卡 · Stripe",
  },
};

export const TASK_STATUS_LABELS_I18N: Record<Locale, Record<string, string>> = {
  th: {
    pending: "อยู่ในคิว",
    leased: "รับคิวแล้ว",
    running: "กำลังประมวลผล",
    awaiting_poll: "รอผลลัพธ์",
    awaiting_review: "รอตรวจสอบ",
    cancel_requested: "กำลังขอยกเลิก",
    succeeded: "สำเร็จ",
    failed: "ล้มเหลว",
    cancelled: "ยกเลิกแล้ว",
  },
  en: {
    pending: "Pending",
    leased: "Leased",
    running: "Running",
    awaiting_poll: "Awaiting Poll",
    awaiting_review: "Awaiting Review",
    cancel_requested: "Cancelling",
    succeeded: "Succeeded",
    failed: "Failed",
    cancelled: "Cancelled",
  },
  zh: {
    pending: "กำลังรอคิว",
    leased: "已租约",
    running: "执行中",
    awaiting_poll: "等待轮询",
    awaiting_review: "待审核",
    cancel_requested: "ยกเลิก中",
    succeeded: "已สำเร็จ",
    failed: "ล้มเหลว",
    cancelled: "ยกเลิกแล้ว",
  },
};

export const TASK_DOMAIN_LABELS_I18N: Record<Locale, Record<string, string>> = {
  th: {
    drama: "ละครสั้น AI",
    kepu: "วิดีโอสั้น AI",
    tools: "เครื่องมือ",
    studio: "สตูดิโอ",
  },
  en: {
    drama: "Drama",
    kepu: "AI Short Video",
    tools: "Tools",
    studio: "Studio",
  },
  zh: {
    drama: "ละครซีรีส์",
    kepu: "AIวิดีโอสั้น",
    tools: "工具",
    studio: "工作室",
  },
};

export const TASK_TYPE_LABELS_I18N: Record<Locale, Record<string, string>> = {
  th: {
    agent_chat: "แชทผู้ช่วยละครสั้น",
    skill_optimize: "ปรับแต่ง Prompt ด้วย Skill",
    voice_prompt: "กำหนดโทนเสียงตัวละคร",
    content_expand: "ขยายบทและพล็อต",
    script_summary: "สรุปย่อบทละคร",
    episode_script: "บทละครรายตอน",
    fragment_plan: "วางแผน AI สตอรี่บอร์ด",
    fragment_video: "วิดีโอสตอรี่บอร์ด",
    seed_assets: "สกัดแอสเซทจากบท",
    asset_image: "สร้างภาพแอสเซท",
    asset_video: "สร้างวิดีโอแอสเซท",
    voice_synthesis: "สังเคราะห์เสียงพากย์",
    project_pipeline: "ไปป์ไลน์วิดีโอ",
    shot_regen_image: "วาดซ้ำเฉพาะช็อต",
    shot_regen_video: "สร้างวิดีโอซ้ำเฉพาะช็อต",
    shot_regen_audio: "พากย์เสียงซ้ำเฉพาะช็อต",
    project_regen_audio: "พากย์เสียงทั้งเรื่องใหม่",
    project_compose_only: "รวมไฟล์อย่างเดียว",
    tool_image: "เครื่องมือสร้างภาพ",
    tool_video: "เครื่องมือสร้างวิดีโอ",
  },
  en: {
    agent_chat: "Drama Assistant Chat",
    skill_optimize: "Skill Prompt Optimization",
    voice_prompt: "Character Voice Prompt",
    content_expand: "Story Expansion",
    script_summary: "Script Summary",
    episode_script: "Episode Script",
    fragment_plan: "AI Storyboard Plan",
    fragment_video: "Storyboard Video",
    seed_assets: "Asset Extraction",
    asset_image: "Asset Image Gen",
    asset_video: "Asset Video Gen",
    voice_synthesis: "Voice Synthesis",
    project_pipeline: "Video Pipeline",
    shot_regen_image: "Redraw Single Shot",
    shot_regen_video: "Regenerate Shot Video",
    shot_regen_audio: "Regenerate Shot Voice",
    project_regen_audio: "Regenerate Full Voice",
    project_compose_only: "Compose Only",
    tool_image: "Tool Image Gen",
    tool_video: "Tool Video Gen",
  },
  zh: {
    agent_chat: "ละครซีรีส์助手聊天",
    skill_optimize: "Skill 优化คำแนะนำ词",
    voice_prompt: "ตัวละครน้ำเสียง描述",
    content_expand: "选题扩写",
    script_summary: "สรุปเรื่องย่อ",
    episode_script: "บทละครแต่ละตอน",
    fragment_plan: "AI 分镜",
    fragment_video: "分镜วิดีโอ",
    seed_assets: "แอสเซท抽取",
    asset_image: "แอสเซท生图",
    asset_video: "แอสเซทวิดีโอ",
    voice_synthesis: "เสียงพากย์合成",
    project_pipeline: "科普流水线",
    shot_regen_image: "单镜重绘",
    shot_regen_video: "单镜วิดีโอ",
    shot_regen_audio: "单镜เสียงพากย์",
    project_regen_audio: "全片เสียงพากย์",
    project_compose_only: "仅合成",
    tool_image: "工具生图",
    tool_video: "工具生วิดีโอ",
  },
};

export const PROJECT_STATUS_LABELS = PROJECT_STATUS_LABELS_I18N.th;
export const ORDER_STATUS_LABELS = ORDER_STATUS_LABELS_I18N.th;
export const AUDIT_STATUS_LABELS = AUDIT_STATUS_LABELS_I18N.th;
export const VISIBILITY_LABELS = VISIBILITY_LABELS_I18N.th;
export const LEDGER_KIND_LABELS = LEDGER_KIND_LABELS_I18N.th;
export const PAY_TYPE_LABELS = PAY_TYPE_LABELS_I18N.th;
export const TASK_STATUS_LABELS = TASK_STATUS_LABELS_I18N.th;
export const TASK_DOMAIN_LABELS = TASK_DOMAIN_LABELS_I18N.th;
export const TASK_TYPE_LABELS = TASK_TYPE_LABELS_I18N.th;

export function projectStatusLabel(status: string): string {
  const loc = getActiveLocale();
  return PROJECT_STATUS_LABELS_I18N[loc]?.[status] ?? PROJECT_STATUS_LABELS_I18N.th[status] ?? status;
}

export function orderStatusLabel(status: string): string {
  const loc = getActiveLocale();
  return ORDER_STATUS_LABELS_I18N[loc]?.[status] ?? ORDER_STATUS_LABELS_I18N.th[status] ?? status;
}

export function auditStatusLabel(status: string): string {
  const loc = getActiveLocale();
  return AUDIT_STATUS_LABELS_I18N[loc]?.[status] ?? AUDIT_STATUS_LABELS_I18N.th[status] ?? status;
}

export function visibilityLabel(status: string): string {
  const loc = getActiveLocale();
  return VISIBILITY_LABELS_I18N[loc]?.[status] ?? VISIBILITY_LABELS_I18N.th[status] ?? status;
}

export function ledgerKindLabel(kind: string): string {
  const loc = getActiveLocale();
  return LEDGER_KIND_LABELS_I18N[loc]?.[kind] ?? LEDGER_KIND_LABELS_I18N.th[kind] ?? kind;
}

export function payTypeLabel(payType: string): string {
  const loc = getActiveLocale();
  return PAY_TYPE_LABELS_I18N[loc]?.[payType] ?? PAY_TYPE_LABELS_I18N.th[payType] ?? payType;
}

export function taskStatusLabel(status: string): string {
  const loc = getActiveLocale();
  return TASK_STATUS_LABELS_I18N[loc]?.[status] ?? TASK_STATUS_LABELS_I18N.th[status] ?? status;
}

export function taskDomainLabel(domain: string): string {
  const loc = getActiveLocale();
  return TASK_DOMAIN_LABELS_I18N[loc]?.[domain] ?? TASK_DOMAIN_LABELS_I18N.th[domain] ?? domain;
}

export function taskTypeLabel(taskType: string): string {
  const loc = getActiveLocale();
  return TASK_TYPE_LABELS_I18N[loc]?.[taskType] ?? TASK_TYPE_LABELS_I18N.th[taskType] ?? taskType;
}

export const PROJECT_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "ทุกสถานะ" },
  ...Object.entries(PROJECT_STATUS_LABELS_I18N.th).map(([value, label]) => ({ value, label })),
];
