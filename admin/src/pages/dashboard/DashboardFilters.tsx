import { useMemo } from "react";
import { AdminChipFilter } from "@/components/admin/AdminChipFilter";
import { AdminFilterBar } from "@/components/admin/AdminFilterBar";
import { useI18n } from "@/i18n";
import { getActiveLocale } from "@/i18n/detect";

/** แดชบอร์ดตัวกรอง维度 */
export type DashboardDays = "1" | "7" | "14" | "30";
export type DashboardDomain = "all" | "drama" | "kepu" | "tools" | "studio";
export type DashboardCapability = "all" | "llm" | "image" | "video" | "tts";
export type DashboardMetric = "charge" | "calls";

export type DashboardFilterState = {
  days: DashboardDays;
  domain: DashboardDomain;
  capability: DashboardCapability;
  metric: DashboardMetric;
};

export const DEFAULT_DASHBOARD_FILTERS: DashboardFilterState = {
  days: "7",
  domain: "all",
  capability: "all",
  metric: "charge",
};

/** 运维 Tab 固定全量 30 日，不受隐藏ตัวกรอง影响 */
export const PROJECTS_DASHBOARD_FILTERS: DashboardFilterState = {
  days: "30",
  domain: "all",
  capability: "all",
  metric: "charge",
};

/** 图表 / 区块标题用的เวลา范围文案 */
export function dashboardRangeLabel(days: DashboardDays): string {
  const loc = getActiveLocale();
  if (loc === "th") {
    if (days === "1") return "วันนี้";
    return `${days} วันที่ผ่านมา`;
  }
  if (loc === "en") {
    if (days === "1") return "Today";
    return `Last ${days} Days`;
  }
  if (days === "1") return "今日";
  return `近 ${days} 日`;
}

type DashboardFiltersProps = {
  value: DashboardFilterState;
  onChange: (next: DashboardFilterState) => void;
};

/** แดชบอร์ด用量ตัวกรอง条（两行紧凑布局） */
export function DashboardFilters({ value, onChange }: DashboardFiltersProps) {
  const { t } = useI18n();
  const patch = (partial: Partial<DashboardFilterState>) => onChange({ ...value, ...partial });

  const dayOptions = useMemo(
    () => [
      { value: "1", label: t("dashboard.filters.today") },
      { value: "7", label: t("dashboard.filters.last7Days") },
      { value: "14", label: t("dashboard.filters.last14Days") },
      { value: "30", label: t("dashboard.filters.last30Days") },
    ],
    [t],
  );

  const domainOptions = useMemo(
    () => [
      { value: "all", label: t("dashboard.filters.allDomains") },
      { value: "drama", label: t("dashboard.filters.drama") },
      { value: "kepu", label: t("dashboard.filters.kepu") },
      { value: "tools", label: t("dashboard.filters.tools") },
      { value: "studio", label: t("dashboard.filters.studio") },
    ],
    [t],
  );

  const capabilityOptions = useMemo(
    () => [
      { value: "all", label: t("dashboard.filters.allCapabilities") },
      { value: "llm", label: t("dashboard.filters.llm") },
      { value: "image", label: t("dashboard.filters.image") },
      { value: "video", label: t("dashboard.filters.video") },
      { value: "tts", label: t("dashboard.filters.tts") },
    ],
    [t],
  );

  const metricOptions = useMemo(
    () => [
      { value: "charge", label: t("dashboard.filters.charge") },
      { value: "calls", label: t("dashboard.filters.calls") },
    ],
    [t],
  );

  return (
    <AdminFilterBar className="admin-dashboard-filters">
      <AdminChipFilter
        label={t("dashboard.filters.timeRange")}
        value={value.days}
        options={dayOptions}
        onChange={(days) => patch({ days: days as DashboardDays })}
        className="admin-chip-filter--segment"
      />
      <AdminChipFilter
        label={t("dashboard.filters.domain")}
        value={value.domain}
        options={domainOptions}
        onChange={(domain) => patch({ domain: domain as DashboardDomain })}
        className="admin-chip-filter--segment"
      />
      <AdminChipFilter
        label={t("dashboard.filters.capability")}
        value={value.capability}
        options={capabilityOptions}
        onChange={(capability) => patch({ capability: capability as DashboardCapability })}
        className="admin-chip-filter--segment"
      />
      <AdminChipFilter
        label={t("dashboard.filters.metric")}
        value={value.metric}
        options={metricOptions}
        onChange={(metric) => patch({ metric: metric as DashboardMetric })}
        className="admin-chip-filter--segment"
      />
    </AdminFilterBar>
  );
}

/** 拼接 stats API 查询串 */
export function buildStatsQuery(filters: DashboardFilterState): string {
  const params = new URLSearchParams({
    days: filters.days,
    domain: filters.domain,
    capability: filters.capability,
    top_metric: filters.metric,
  });
  return `/api/admin/stats?${params.toString()}`;
}
