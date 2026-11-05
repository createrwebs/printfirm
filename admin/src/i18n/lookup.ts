/** จุดดึงข้อความตาม path และแทนที่ตัวแปร {key} */

export type TVars = Record<string, string | number>;

export function lookupMessage(source: unknown, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = source;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" ? cur : undefined;
}

export function interpolate(template: string, vars?: TVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match,
  );
}
