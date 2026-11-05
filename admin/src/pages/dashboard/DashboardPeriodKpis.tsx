import { Activity, Film, TrendingUp } from "lucide-react";
import type { AdminStats } from "@/api/client";
import { fenToYuan } from "@/lib/utils";
import { dashboardRangeLabel, type DashboardFilterState } from "@/pages/dashboard/DashboardFilters";
import { DashboardKpiCard } from "@/pages/dashboard/DashboardKpiCard";
import { sumDailyUsage } from "@/pages/dashboard/dashboardMetrics";
import { useI18n } from "@/i18n";

type DashboardPeriodKpisProps = {
  stats: AdminStats | null;
  filters: DashboardFilterState;
  loading: boolean;
};

/** ตอนที่ 二行 KPI：随ตัวกรองเวลา窗变化的调用/扣费及โปรเจกต์规模 */
export function DashboardPeriodKpis({ stats, filters, loading }: DashboardPeriodKpisProps) {
  const { locale } = useI18n();
  const placeholder = loading ? "…" : "—";
  const rangeLabel = dashboardRangeLabel(filters.days);
  const period = sumDailyUsage(stats?.daily_usage ?? []);

  const callsLabel = locale === "th" ? `การเรียกใช้ (${rangeLabel})` : locale === "en" ? `Calls (${rangeLabel})` : `${rangeLabel}调用`;
  const callsHint = stats
    ? (locale === "th" ? `สะสม ${stats.usage_calls_total ?? 0} ครั้ง` : locale === "en" ? `Total ${stats.usage_calls_total ?? 0} calls` : `累计 ${stats.usage_calls_total ?? 0} 次`)
    : (locale === "th" ? "จำนวนครั้งที่เรียก" : locale === "en" ? "Calls" : "调用次数");

  const chargeLabel = locale === "th" ? `ยอดหัก (${rangeLabel})` : locale === "en" ? `Charges (${rangeLabel})` : `${rangeLabel}扣费`;
  const chargeHint = stats
    ? (locale === "th" ? `เดือนนี้ ¥${fenToYuan(stats.usage_charge_month_fen ?? 0)}` : locale === "en" ? `This month ¥${fenToYuan(stats.usage_charge_month_fen ?? 0)}` : `本月 ¥${fenToYuan(stats.usage_charge_month_fen ?? 0)}`)
    : (locale === "th" ? "ยอดหักค่าบริการ" : locale === "en" ? "Charges" : "用户扣费");

  const dramaLabel = locale === "th" ? "โปรเจกต์ละครสั้น" : locale === "en" ? "Drama Projects" : "โปรเจกต์ละครซีรีส์";
  const dramaHint = stats
    ? (locale === "th" ? `ผู้ใช้ ${stats.user_count} คน` : locale === "en" ? `Users ${stats.user_count}` : `用户 ${stats.user_count}`)
    : (locale === "th" ? "ขนาดโปรเจกต์" : locale === "en" ? "Scale" : "โปรเจกต์规模");

  return (
    <div className="admin-dashboard-kpi-grid admin-dashboard-kpi-grid--secondary min-[1401px]:!grid-cols-3">
      <DashboardKpiCard
        label={callsLabel}
        value={stats ? period.calls.toLocaleString() : placeholder}
        hint={callsHint}
        icon={Activity}
        tone="mint"
      />
      <DashboardKpiCard
        label={chargeLabel}
        value={stats ? `¥${fenToYuan(period.charge_fen)}` : placeholder}
        hint={chargeHint}
        icon={TrendingUp}
        tone="blue"
      />
      <DashboardKpiCard
        label={dramaLabel}
        value={stats ? stats.drama_project_count ?? 0 : placeholder}
        hint={dramaHint}
        icon={Film}
        tone="slate"
      />
    </div>
  );
}
