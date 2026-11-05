import { useMemo } from "react";
import { BarChart3, Clapperboard, LayoutDashboard, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

/** แดชบอร์ด主板块 */
export type DashboardSection = "overview" | "usage" | "finance" | "projects";

type DashboardSectionTabsProps = {
  value: DashboardSection;
  onChange: (next: DashboardSection) => void;
};

/** แดชบอร์ด板块切换 */
export function DashboardSectionTabs({ value, onChange }: DashboardSectionTabsProps) {
  const { t } = useI18n();

  const sections = useMemo(
    () => [
      {
        id: "overview" as DashboardSection,
        label: t("dashboard.sections.overview"),
        desc: t("dashboard.sections.overviewDesc"),
        icon: LayoutDashboard,
      },
      {
        id: "usage" as DashboardSection,
        label: t("dashboard.sections.usage"),
        desc: t("dashboard.sections.usageDesc"),
        icon: BarChart3,
      },
      {
        id: "finance" as DashboardSection,
        label: t("dashboard.sections.finance"),
        desc: t("dashboard.sections.financeDesc"),
        icon: Wallet,
      },
      {
        id: "projects" as DashboardSection,
        label: t("dashboard.sections.projects"),
        desc: t("dashboard.sections.projectsDesc"),
        icon: Clapperboard,
      },
    ],
    [t],
  );

  return (
    <div className="admin-dashboard-section-tabs" role="tablist" aria-label={t("dashboard.sections.overview")}>
      {sections.map((item) => {
        const active = value === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn("admin-dashboard-section-tab", active && "is-active")}
            onClick={() => onChange(item.id)}
          >
            <span className="admin-dashboard-section-tab-icon">
              <Icon className="h-4 w-4" />
            </span>
            <span className="admin-dashboard-section-tab-text">
              <span className="admin-dashboard-section-tab-label">{item.label}</span>
              <span className="admin-dashboard-section-tab-desc">{item.desc}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
