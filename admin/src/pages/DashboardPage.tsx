import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Banknote,
  Clapperboard,
  Film,
  Layers,
  Receipt,
  Settings,
  Shapes,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { PageSection } from "@/components/admin/PageSection";
import { PageHeader } from "@/components/ui/page";
import { api, type AdminOrder, type AdminStats, type PageMeta } from "@/api/client";
import { AdminEntityLink } from "@/components/admin/AdminEntityLink";
import { fenToYuan } from "@/lib/utils";
import { projectStatusLabel, taskDomainLabel } from "@/lib/statusLabels";
import { useI18n } from "@/i18n";
import {
  buildStatsQuery,
  dashboardRangeLabel,
  DashboardFilters,
  DEFAULT_DASHBOARD_FILTERS,
  PROJECTS_DASHBOARD_FILTERS,
  type DashboardFilterState,
} from "@/pages/dashboard/DashboardFilters";
import { DashboardKpiCard } from "@/pages/dashboard/DashboardKpiCard";
import { DashboardInsightGrid } from "@/pages/dashboard/DashboardInsightGrid";
import { DashboardPeriodKpis } from "@/pages/dashboard/DashboardPeriodKpis";
import { DashboardSectionTabs, type DashboardSection } from "@/pages/dashboard/DashboardSectionTabs";
import { buildDomainInsights } from "@/pages/dashboard/dashboardInsightMaps";
import { buildFinanceInsights, buildProjectInsights } from "@/pages/dashboard/dashboardSectionInsights";
import { sumDailyUsage } from "@/pages/dashboard/dashboardMetrics";
import { UsageDistributionChart } from "@/pages/dashboard/UsageDistributionChart";
import { TopUsersRankingChart } from "@/pages/dashboard/TopUsersRankingChart";
import { UsageTrendChart } from "@/pages/dashboard/UsageTrendChart";

type OrderRes = { items: AdminOrder[]; meta: PageMeta };

function statusClass(status: string): string {
  if (status === "DONE") return "is-done";
  if (status === "FAILED" || status === "REJECTED" || status === "CANCELLED") return "is-fail";
  if (status === "SCRIPTING" || status === "IMAGING" || status === "VIDEOING" || status === "COMPOSING") {
    return "is-run";
  }
  return "is-warn";
}

/** 管理端แดชบอร์ด：板块切换 + 渐变 KPI + 可ตัวกรอง用量图表 */
export function DashboardPage() {
  const { t, locale } = useI18n();
  const [section, setSection] = useState<DashboardSection>("overview");
  const [filters, setFilters] = useState<DashboardFilterState>(DEFAULT_DASHBOARD_FILTERS);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const capabilityLabel = useCallback((key: string): string => {
    const labels: Record<string, Record<string, string>> = {
      th: { llm: "LLM ข้อความ", image: "สร้างภาพ", video: "สร้างวิดีโอ", tts: "เสียงพากย์", unknown: "อื่นๆ", other: "อื่นๆ" },
      en: { llm: "LLM Text", image: "Image Gen", video: "Video Gen", tts: "Voice/TTS", unknown: "Other", other: "Other" },
      zh: { llm: "LLM 文本", image: "生图", video: "วิดีโอ", tts: "เสียงพากย์", unknown: "其他", other: "其他" },
    };
    return labels[locale]?.[key] ?? labels.th[key] ?? key;
  }, [locale]);

  const domainChartLabel = useCallback((key: string): string => {
    if (key === "kepu") return locale === "th" ? "วิดีโอสั้น AI" : locale === "en" ? "AI Short Video" : "AIวิดีโอสั้น";
    return taskDomainLabel(key);
  }, [locale]);

  const loadData = useCallback(async (nextFilters: DashboardFilterState) => {
    setLoading(true);
    try {
      const [s, o] = await Promise.all([
        api<AdminStats>(buildStatsQuery(nextFilters)),
        api<OrderRes>("/api/admin/orders?page=1&page_size=8&status=paid"),
      ]);
      setStats(s);
      setOrders(o.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("dashboard.loadFail"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const kpiReady = Boolean(stats);
  const kpiPlaceholder = loading ? "…" : "—";
  const statsFilters = section === "projects" ? PROJECTS_DASHBOARD_FILTERS : filters;
  const projectsRangeLabel = dashboardRangeLabel(PROJECTS_DASHBOARD_FILTERS.days);

  useEffect(() => {
    void loadData(statsFilters);
  }, [statsFilters, loadData]);

  const statusEntries = Object.entries(stats?.project_status_counts ?? {}).sort((a, b) => b[1] - a[1]);
  const daily = stats?.daily_usage ?? [];
  const byCapability = stats?.usage_by_capability ?? [];
  const byDomain = stats?.usage_by_domain ?? [];
  const topUsers = stats?.top_users_by_charge ?? [];
  const rangeLabel = dashboardRangeLabel(filters.days);
  const showUsageFilters = section === "overview" || section === "usage";
  const domainInsights = buildDomainInsights(byDomain, filters.metric, domainChartLabel);
  const financeInsights = buildFinanceInsights(stats);
  const projectInsights = buildProjectInsights(stats, sumDailyUsage(daily));
  const metricHint = filters.metric === "calls"
    ? (locale === "th" ? "จำนวนครั้งที่เรียก" : locale === "en" ? "Call Count" : "调用次数")
    : (locale === "th" ? "ยอดเงินที่หัก" : locale === "en" ? "Charged Amount" : "扣费金额");

  return (
    <div className="admin-page admin-dashboard-page">
      <PageHeader title={t("dashboard.headerTitle")} description={t("dashboard.headerDesc")} />

      <div className="admin-dashboard-kpi-grid">
        <DashboardKpiCard
          label={t("dashboard.totalUsers")}
          value={kpiReady ? stats!.user_count : kpiPlaceholder}
          hint={t("dashboard.registeredUsers")}
          icon={Users}
          tone="teal"
        />
        <DashboardKpiCard
          label={t("dashboard.totalPaid")}
          value={kpiReady ? `¥${fenToYuan(stats!.order_paid_total_fen)}` : kpiPlaceholder}
          hint={t("dashboard.historicalTopups")}
          icon={Banknote}
          tone="blue"
        />
        <DashboardKpiCard
          label={t("dashboard.monthlyAiCharge")}
          value={kpiReady ? `¥${fenToYuan(stats!.usage_charge_month_fen ?? 0)}` : kpiPlaceholder}
          hint={
            kpiReady
              ? t("dashboard.todayCharge", { amount: `¥${fenToYuan(stats!.usage_charge_today_fen ?? 0)}` })
              : locale === "th" ? "ยอดหักวันนี้" : locale === "en" ? "Today's charge" : "今日扣费"
          }
          icon={Zap}
          tone="purple"
        />
        <DashboardKpiCard
          label={t("dashboard.monthlyCalls")}
          value={kpiReady ? (stats!.usage_calls_month ?? 0).toLocaleString() : kpiPlaceholder}
          hint={
            kpiReady
              ? t("dashboard.todayCalls", { count: (stats!.usage_calls_today ?? 0).toLocaleString() })
              : locale === "th" ? "จำนวนเรียกวันนี้" : locale === "en" ? "Today's calls" : "调用次数"
          }
          icon={Activity}
          tone="sand"
        />
      </div>

      <DashboardSectionTabs value={section} onChange={setSection} />

      {showUsageFilters ? <DashboardFilters value={filters} onChange={setFilters} /> : null}
      {showUsageFilters ? <DashboardPeriodKpis stats={stats} filters={filters} loading={loading} /> : null}

      {section === "overview" ? (
        <>
          <div className="admin-dashboard-charts">
            <PageSection
              title={t("dashboard.trend.title", { range: rangeLabel })}
              description={loading ? t("common.loading") : t("dashboard.trend.desc")}
              bodyClassName="!pt-2"
              className="admin-dashboard-chart-main admin-dashboard-glass min-h-0"
            >
              <UsageTrendChart data={daily} metric={filters.metric} />
            </PageSection>

            <PageSection
              title={t("dashboard.distribution.capabilityTitle")}
              description={`${rangeLabel} · ${metricHint}`}
              bodyClassName="!pt-2"
              className="admin-dashboard-chart-side admin-dashboard-glass min-h-0"
            >
              <UsageDistributionChart
                data={byCapability}
                metric={filters.metric}
                labelForKey={capabilityLabel}
                variant="donut"
              />
            </PageSection>
          </div>

          <PageSection
            title={t("dashboard.topUsers.title", { range: rangeLabel })}
            actions={
              <Link to="/orders?tab=usage" className="admin-link">
                {t("dashboard.topUsers.more")}
              </Link>
            }
            bodyClassName="!pt-2"
            className="admin-dashboard-glass min-h-0"
          >
            <TopUsersRankingChart users={topUsers.slice(0, 3)} metric={filters.metric} />
          </PageSection>

          <div className="admin-dashboard-charts">
            <PageSection
              title={t("dashboard.distribution.domainTitle")}
              description={`${rangeLabel} · ${metricHint}`}
              bodyClassName="!pt-2"
              className="admin-dashboard-chart-main admin-dashboard-glass min-h-0"
            >
              <UsageDistributionChart
                data={byDomain}
                metric={filters.metric}
                labelForKey={domainChartLabel}
                variant="bar"
              />
            </PageSection>
            <PageSection
              title={t("dashboard.domainInsights.title")}
              description={`${rangeLabel} · ${metricHint}`}
              bodyClassName="!pt-2"
              className="admin-dashboard-chart-side admin-dashboard-glass min-h-0"
            >
              <DashboardInsightGrid items={domainInsights} columns={2} />
            </PageSection>
          </div>
        </>
      ) : null}

      {section === "usage" ? (
        <>
          <div className="admin-dashboard-charts">
            <PageSection
              title={t("dashboard.trend.title", { range: rangeLabel })}
              description={loading ? t("common.loading") : locale === "th" ? "ยอดหัก / จำนวนเรียกรายวัน" : "Charges / calls aggregated daily"}
              bodyClassName="!pt-2"
              className="admin-dashboard-chart-main admin-dashboard-glass min-h-0"
            >
              <UsageTrendChart data={daily} metric={filters.metric} />
            </PageSection>

            <PageSection
              title={t("dashboard.distribution.capabilityTitle")}
              description={`${rangeLabel} · ${metricHint}`}
              bodyClassName="!pt-2"
              className="admin-dashboard-chart-side admin-dashboard-glass min-h-0"
            >
              <UsageDistributionChart
                data={byCapability}
                metric={filters.metric}
                labelForKey={capabilityLabel}
                variant="donut"
              />
            </PageSection>
          </div>

          <div className="admin-dashboard-charts">
            <PageSection
              title={t("dashboard.distribution.domainTitle")}
              description={`${rangeLabel} · ${metricHint}`}
              bodyClassName="!pt-2"
              className="admin-dashboard-chart-main admin-dashboard-glass min-h-0"
            >
              <UsageDistributionChart
                data={byDomain}
                metric={filters.metric}
                labelForKey={domainChartLabel}
                variant="bar"
              />
            </PageSection>
            <PageSection
              title={t("dashboard.topUsers.title", { range: rangeLabel })}
              actions={
                <Link to="/orders?tab=usage" className="admin-link">
                  {locale === "th" ? "รายละเอียดการใช้งาน →" : "Usage details →"}
                </Link>
              }
              description={metricHint}
              bodyClassName="!pt-2"
              className="admin-dashboard-chart-side admin-dashboard-glass min-h-0"
            >
              <TopUsersRankingChart users={topUsers} metric={filters.metric} />
            </PageSection>
          </div>
        </>
      ) : null}

      {section === "finance" ? (
        <div className="admin-dashboard-body admin-dashboard-body--finance">
          <PageSection
            title={locale === "th" ? "ภาพรวมการเงิน" : "Finance Overview"}
            description={locale === "th" ? "การเติมเงินและยอดหักของผู้ใช้" : "Top-up & User Deductions"}
            actions={
              <Link to="/finance" className="admin-link">
                {locale === "th" ? "บัญชีการเงิน →" : "Finance List →"}
              </Link>
            }
            bodyClassName="!pt-2"
            className="admin-dashboard-glass min-h-0 admin-dashboard-body--full"
          >
            <DashboardInsightGrid items={financeInsights} columns={3} />
          </PageSection>

          <PageSection
            title={locale === "th" ? "คำสั่งซื้อล่าสุด" : "Recent Orders"}
            description={locale === "th" ? "เฉพาะรายการที่ชำระเงินสำเร็จ" : "Paid orders only"}
            actions={
              <Link to="/orders" className="admin-link">
                {locale === "th" ? "ดูทั้งหมด →" : "All →"}
              </Link>
            }
            bodyClassName="!pt-0"
            className="admin-dashboard-glass min-h-0 admin-dashboard-body--full"
          >
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{locale === "th" ? "ผู้ใช้" : "User"}</th>
                    <th>{locale === "th" ? "ยอดเงิน" : "Amount"}</th>
                    <th>{locale === "th" ? "เวลาชำระ" : "Paid At"}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="!text-center text-[var(--admin-muted)]">
                        {locale === "th" ? "ยังไม่มีคำสั่งซื้อที่ชำระแล้ว" : "No paid orders yet"}
                      </td>
                    </tr>
                  ) : (
                    orders.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <AdminEntityLink kind="user" id={o.user_id} label={o.user_email ?? undefined} />
                        </td>
                        <td className="font-semibold text-[var(--admin-forest)]">¥{fenToYuan(o.amount_fen)}</td>
                        <td className="text-xs text-[var(--admin-muted)]">
                          {o.paid_at ? new Date(o.paid_at).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </PageSection>
        </div>
      ) : null}

      {section === "projects" ? (
        <>
          <PageSection
            title={locale === "th" ? "ภาพรวมการดำเนินงาน" : "Operations Overview"}
            description={locale === "th" ? "ขนาดโปรเจกต์ การเรียกใช้ และการกระจายสถานะ" : "Scale, calls & status"}
            bodyClassName="!pt-2"
            className="admin-dashboard-glass min-h-0"
          >
            <DashboardInsightGrid items={projectInsights} columns={4} />
          </PageSection>

          <div className="admin-dashboard-project-row">
            <PageSection
              title={locale === "th" ? "สถานะโปรเจกต์วิดีโอ AI" : "AI Video Project Status"}
              description={locale === "th" ? `โปรเจกต์ละครสั้น ${stats?.drama_project_count ?? 0} เรื่อง` : `Drama projects: ${stats?.drama_project_count ?? 0}`}
              bodyClassName="!pt-2"
              className="admin-dashboard-glass min-h-0"
            >
              <div className="flex flex-wrap gap-1.5">
                {statusEntries.length === 0 ? (
                  <span className="text-xs text-[var(--admin-muted)]">{t("common.error")}</span>
                ) : (
                  statusEntries.map(([status, count]) => (
                    <span key={status} className={`admin-status-pill !px-2.5 !py-1 !text-[11px] ${statusClass(status)}`}>
                      {projectStatusLabel(status)} {count}
                    </span>
                  ))
                )}
              </div>
            </PageSection>

            <PageSection title={locale === "th" ? "สถิติการเรียกใช้" : "Call Statistics"} bodyClassName="!pt-2" className="admin-dashboard-glass min-h-0">
              <div className="admin-dashboard-stat-grid">
                <div>
                  <div className="admin-dashboard-stat-grid-label">{locale === "th" ? "เรียกใช้วันนี้" : "Today"}</div>
                  <div className="admin-dashboard-stat-grid-value">
                    {kpiReady ? stats!.usage_calls_today ?? 0 : kpiPlaceholder}
                  </div>
                </div>
                <div>
                  <div className="admin-dashboard-stat-grid-label">{locale === "th" ? "เรียกใช้เดือนนี้" : "This Month"}</div>
                  <div className="admin-dashboard-stat-grid-value">
                    {kpiReady ? stats!.usage_calls_month ?? 0 : kpiPlaceholder}
                  </div>
                </div>
                <div>
                  <div className="admin-dashboard-stat-grid-label">{locale === "th" ? "เรียกใช้สะสม" : "All Time"}</div>
                  <div className="admin-dashboard-stat-grid-value">
                    {kpiReady ? stats!.usage_calls_total ?? 0 : kpiPlaceholder}
                  </div>
                </div>
              </div>
            </PageSection>
          </div>

          <PageSection title={`${t("dashboard.distribution.domainTitle")} (${projectsRangeLabel})`} bodyClassName="!pt-2" className="admin-dashboard-glass min-h-0">
            <UsageDistributionChart
              data={byDomain}
              metric="charge"
              labelForKey={domainChartLabel}
              variant="bar"
            />
          </PageSection>

          <PageSection title={locale === "th" ? "ทางลัดด่วน" : "Quick Access"} bodyClassName="!pt-2" className="admin-dashboard-glass">
            <div className="admin-dashboard-tools">
              <Link to="/templates" className="admin-dashboard-tool-btn">
                <Shapes className="h-5 w-5" />
                <span>{t("nav.templates")}</span>
              </Link>
              <Link to="/orders?tab=usage" className="admin-dashboard-tool-btn">
                <Receipt className="h-5 w-5" />
                <span>{locale === "th" ? "ประวัติการใช้" : "Usage"}</span>
              </Link>
              <Link to="/users" className="admin-dashboard-tool-btn">
                <Users className="h-5 w-5" />
                <span>{t("nav.users")}</span>
              </Link>
              <Link to="/projects" className="admin-dashboard-tool-btn">
                <Clapperboard className="h-5 w-5" />
                <span>{locale === "th" ? "วิดีโอสั้น AI" : "AI Video"}</span>
              </Link>
              <Link to="/drama-projects" className="admin-dashboard-tool-btn">
                <Film className="h-5 w-5" />
                <span>{t("nav.dramaProjects")}</span>
              </Link>
              <Link to="/queues" className="admin-dashboard-tool-btn">
                <Layers className="h-5 w-5" />
                <span>{t("nav.queues")}</span>
              </Link>
              <Link to="/settings" className="admin-dashboard-tool-btn">
                <Settings className="h-5 w-5" />
                <span>{t("nav.settings")}</span>
              </Link>
              <Link to="/orders" className="admin-dashboard-tool-btn">
                <Activity className="h-5 w-5" />
                <span>{t("nav.orders")}</span>
              </Link>
            </div>
          </PageSection>
        </>
      ) : null}
    </div>
  );
}
