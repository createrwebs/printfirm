import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMarketplaceEnabled } from "@/features/marketplace/api";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Aperture,
  ChevronRight,
  PanelLeftClose,
  Search,
  X,
  Clapperboard,
  FileVideo,
  Film,
  Image,
  Layers,
  LayoutDashboard,
  ListVideo,
  LogOut,
  Maximize2,
  Receipt,
  Scale,
  Settings,
  Shapes,
  Users,
  Wallet,
} from "lucide-react";
import { clearAuth, getCachedUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useI18n, type TFunction } from "@/i18n";
import { LanguageSwitch } from "./LanguageSwitch";
import { AdminNavigationSearch } from "./AdminNavigationSearch";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  matchPrefix?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

function getNavGroups(t: TFunction): NavGroup[] {
  return [
    {
      label: t("nav.overview"),
      items: [{ to: "/", label: t("nav.dashboard"), icon: LayoutDashboard, end: true }],
    },
    {
      label: t("nav.business"),
      items: [
        { to: "/users", label: t("nav.users"), icon: Users },
        { to: "/teams", label: t("nav.teams"), icon: Users, matchPrefix: true },
        { to: "/orders", label: t("nav.orders"), icon: Receipt },
        { to: "/adjustments", label: t("nav.adjustments"), icon: Scale },
        { to: "/finance", label: t("nav.finance"), icon: Wallet },
        { to: "/projects", label: t("nav.projects"), icon: Clapperboard },
        { to: "/works", label: t("nav.works"), icon: FileVideo },
      ],
    },
    {
      label: t("nav.drama"),
      items: [
        { to: "/drama-projects", label: t("nav.dramaProjects"), icon: Film, matchPrefix: true },
        { to: "/drama-assets", label: t("nav.dramaAssets"), icon: Image, matchPrefix: true },
        { to: "/drama-episodes", label: t("nav.dramaEpisodes"), icon: ListVideo, matchPrefix: true },
        { to: "/drama-fragments", label: t("nav.dramaFragments"), icon: Layers, matchPrefix: true },
      ],
    },
    {
      label: t("nav.resources"),
      items: [
        { to: "/templates", label: t("nav.templates"), icon: Shapes },
        { to: "/queues", label: t("nav.queues"), icon: Layers },
      ],
    },
    {
      label: t("nav.system"),
      items: [{ to: "/settings", label: t("nav.settings"), icon: Settings }],
    },
  ];
}

function resolvePageTitle(pathname: string, t: TFunction): string {
  if (pathname.startsWith("/teams/")) return t("titles.teamDetail");
  if (pathname.startsWith("/drama-projects/")) return t("titles.dramaProjectDetail");
  if (pathname.startsWith("/drama-assets/")) return t("titles.dramaAssetDetail");
  if (pathname.startsWith("/drama-episodes/")) return t("titles.dramaEpisodeDetail");
  if (pathname.startsWith("/drama-fragments/")) return t("titles.dramaFragmentDetail");

  const titleMap: Record<string, string> = {
    "/marketplace": t("titles.marketplace"),
    "/": t("titles.dashboard"),
    "/users": t("titles.users"),
    "/teams": t("titles.teams"),
    "/orders": t("titles.orders"),
    "/adjustments": t("titles.adjustments"),
    "/finance": t("titles.finance"),
    "/projects": t("titles.projects"),
    "/drama-projects": t("titles.dramaProjects"),
    "/drama-assets": t("titles.dramaAssets"),
    "/drama-episodes": t("titles.dramaEpisodes"),
    "/drama-fragments": t("titles.dramaFragments"),
    "/works": t("titles.works"),
    "/templates": t("titles.templates"),
    "/settings": t("titles.settings"),
    "/queues": t("titles.queues"),
  };

  return titleMap[pathname] ?? t("titles.adminConsole");
}

/** 统一运营เวิร์กสเตชัน：桌面折叠导航、移动抽屉与多语言切换。 */
export function AdminLayout() {
  const { t } = useI18n();
  const marketplaceEnabled = useMarketplaceEnabled();
  const rawNavGroups = useMemo(() => getNavGroups(t), [t]);

  const visibleNavGroups = useMemo(() => {
    return rawNavGroups.map((group) =>
      group.label === t("nav.business") && marketplaceEnabled
        ? {
            ...group,
            items: [
              ...group.items,
              { to: "/marketplace", label: t("nav.marketplace"), icon: FileVideo } satisfies NavItem,
            ],
          }
        : group,
    );
  }, [rawNavGroups, marketplaceEnabled, t]);

  const navigate = useNavigate();
  const location = useLocation();
  const user = getCachedUser();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 800px)").matches);
  const sidebarRef = useRef<HTMLElement>(null);
  const navigationToggleRef = useRef<HTMLButtonElement>(null);
  const sidebarCloseRef = useRef<HTMLButtonElement>(null);
  const mobileDrawerOpen = isMobile && mobileOpen;
  const title = resolvePageTitle(location.pathname, t);
  const initial = (user?.nickname || user?.email || "A").slice(0, 1).toUpperCase();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 800px)");
    function onChange(event: MediaQueryListEvent) {
      setIsMobile(event.matches);
      if (!event.matches) setMobileOpen(false);
    }
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useLayoutEffect(() => {
    if (!mobileDrawerOpen) return;
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    const navigationToggle = navigationToggleRef.current;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebarCloseRef.current?.focus({ preventScroll: true });

    function focusableItems() {
      return Array.from(
        sidebar!.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
    }
    function trapFocus(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const items = focusableItems();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || !sidebar!.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !sidebar!.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }
    function keepFocusInside(event: FocusEvent) {
      if (event.target instanceof Node && !sidebar!.contains(event.target)) {
        sidebarCloseRef.current?.focus({ preventScroll: true });
      }
    }
    document.addEventListener("keydown", trapFocus, true);
    document.addEventListener("focusin", keepFocusInside);
    return () => {
      document.removeEventListener("keydown", trapFocus, true);
      document.removeEventListener("focusin", keepFocusInside);
      document.body.style.overflow = previousOverflow;
      if (sidebar.contains(document.activeElement) || document.activeElement === document.body) {
        const restoreTarget = previouslyFocused?.isConnected ? previouslyFocused : navigationToggle;
        restoreTarget?.focus({ preventScroll: true });
      }
    };
  }, [mobileDrawerOpen]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setMobileOpen(false);
        setSearchOpen((value) => !value);
      }
      if (event.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function handleLogout() {
    clearAuth();
    navigate("/login");
  }
  function toggleNavigation() {
    if (isMobile) setMobileOpen((value) => !value);
    else setCollapsed((value) => !value);
  }

  return (
    <div className={cn("admin-app", collapsed && "is-collapsed", mobileDrawerOpen && "is-mobile-open")}>
      <a className="admin-skip-link" href="#admin-main-content">
        {t("nav.skipLink")}
      </a>
      {mobileDrawerOpen && (
        <button
          type="button"
          className="admin-sidebar-scrim"
          tabIndex={-1}
          aria-label={t("nav.closeNav")}
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        className="admin-sidebar"
        id="admin-sidebar"
        aria-label={t("nav.consoleTitle")}
        role={mobileDrawerOpen ? "dialog" : undefined}
        aria-modal={mobileDrawerOpen ? true : undefined}
        aria-hidden={isMobile && !mobileOpen ? true : undefined}
        inert={isMobile && !mobileOpen}
      >
        <div className="admin-brand">
          <div className="admin-brand-mark">
            <Aperture size={23} strokeWidth={1.7} />
          </div>
          <div className="admin-brand-copy">
            <div className="admin-brand-name">
              Tora FILM<span>®</span>
            </div>
            <div className="admin-brand-sub">{t("nav.consoleTitle")}</div>
          </div>
          <button
            ref={sidebarCloseRef}
            type="button"
            className="admin-icon-btn admin-sidebar-close"
            aria-label={t("nav.closeNav")}
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <nav className="admin-nav" aria-label={t("nav.consoleTitle")}>
          {visibleNavGroups.map((group) => (
            <div key={group.label} className="admin-nav-group">
              <div className="admin-nav-group-label">{group.label}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end ?? !item.matchPrefix}
                  className={({ isActive }) =>
                    cn(
                      "admin-nav-item",
                      (isActive || (item.matchPrefix && location.pathname.startsWith(`${item.to}/`))) &&
                        "is-active",
                    )
                  }
                  title={item.label}
                  onClick={() => setMobileOpen(false)}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.7} />
                  <span className="admin-nav-label">{item.label}</span>
                  <ChevronRight className="admin-nav-arrow" size={14} />
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="admin-sidebar-footnote">
          <span />
          {t("nav.consoleSub")}
        </div>
        <div className="admin-user-card">
          <div className="admin-avatar">{initial}</div>
          <div className="admin-user-copy">
            <strong>{user?.nickname || t("nav.adminUser")}</strong>
            <span title={user?.email}>{user?.email}</span>
          </div>
          <button
            type="button"
            className="admin-icon-btn admin-logout"
            onClick={handleLogout}
            title={t("nav.logout")}
            aria-label={t("nav.logout")}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className="admin-main" inert={mobileDrawerOpen}>
        <header className="admin-topbar">
          <div className="admin-topbar-leading">
            <button
              ref={navigationToggleRef}
              type="button"
              className="admin-icon-btn"
              onClick={toggleNavigation}
              aria-label={
                isMobile
                  ? mobileOpen
                    ? t("nav.closeNav")
                    : t("nav.openNav")
                  : collapsed
                    ? t("nav.expandNav")
                    : t("nav.collapseNav")
              }
              aria-controls="admin-sidebar"
              aria-expanded={isMobile ? mobileOpen : !collapsed}
            >
              <PanelLeftClose size={19} />
            </button>
            <div className="admin-topbar-breadcrumb">
              <span>{t("nav.consoleBreadcrumb")}</span>
              <ChevronRight size={13} />
              <strong>{title}</strong>
            </div>
          </div>
          <div className="admin-topbar-actions">
            <LanguageSwitch />
            <button
              type="button"
              className="admin-command-trigger"
              aria-label={t("nav.searchPlaceholder")}
              aria-keyshortcuts="Control+K Meta+K"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={15} />
              <span>{t("nav.searchPlaceholder")}</span>
              <kbd>{t("nav.searchKbd")}</kbd>
            </button>
            <a
              className="admin-site-link"
              href={import.meta.env.DEV ? "http://127.0.0.1:5173" : "/"}
              target="_blank"
              rel="noreferrer"
            >
              {t("nav.userSite")}
              <ArrowUpRight size={14} />
            </a>
            <button
              type="button"
              className="admin-icon-btn admin-fullscreen"
              title={t("nav.toggleFullscreen")}
              aria-label={t("nav.toggleFullscreen")}
              onClick={() => {
                if (!document.fullscreenElement) void document.documentElement.requestFullscreen().catch(() => undefined);
                else void document.exitFullscreen().catch(() => undefined);
              }}
            >
              <Maximize2 size={17} />
            </button>
            <div className="admin-topbar-avatar" title={user?.email}>
              {initial}
            </div>
          </div>
        </header>
        <main className="admin-content" id="admin-main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <AdminNavigationSearch open={searchOpen} onOpenChange={setSearchOpen} groups={visibleNavGroups} />
    </div>
  );
}
