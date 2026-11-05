/** 团队日期统一按上海时区展示，避免服务器与浏览器时区差异。 */
export function teamDate(value: string): string {
  return new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
}

/** 平台ผู้ดูแลระบบ (Admin)ดู的团队内ตัวละคร名称。 */
export const teamRoleLabels = { owner: "เจ้าของ (Owner)", admin: "ผู้ดูแลระบบ (Admin)", member: "สมาชิก" };
