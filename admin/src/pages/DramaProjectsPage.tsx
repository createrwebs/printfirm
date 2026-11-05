import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, type AdminDramaProject, type PageMeta } from "@/api/client";
import { AdminEntityLink } from "@/components/admin/AdminEntityLink";
import { AdminFilterBar } from "@/components/admin/AdminFilterBar";
import { AdminUserSearchSelect } from "@/components/admin/AdminUserSearchSelect";
import { PaginationBar } from "@/components/PaginationBar";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page";
import { fenToYuan } from "@/lib/utils";
import { useI18n } from "@/i18n";

type ListRes = { items: AdminDramaProject[]; meta: PageMeta };

/** โปรเจกต์ละครซีรีส์列表 */
export function DramaProjectsPage() {
  const { locale } = useI18n();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [summaryStatus, setSummaryStatus] = useState("");
  const [assetsSeedStatus, setAssetsSeedStatus] = useState("");
  const [data, setData] = useState<ListRes | null>(null);

  async function load(nextPage = page) {
    try {
      const params = new URLSearchParams({ page: String(nextPage), page_size: String(DEFAULT_PAGE_SIZE) });
      if (q.trim()) params.set("q", q.trim());
      if (userId) params.set("user_id", String(userId));
      if (summaryStatus.trim()) params.set("summary_status", summaryStatus.trim());
      if (assetsSeedStatus.trim()) params.set("assets_seed_status", assetsSeedStatus.trim());
      setData(await api<ListRes>(`/api/admin/drama-projects?${params}`));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (locale === "th" ? "โหลดข้อมูลล้มเหลว" : "Failed to load"));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <div className="admin-list-page">
      <PageHeader
        title={locale === "th" ? "โปรเจกต์ละครสั้น" : "Drama Projects"}
        description={locale === "th" ? "โปรเจกต์ละครสั้น: จำนวนตอน, แอสเซท, สถานะการผลิต และค่าใช้จ่าย" : "Drama projects: episodes, assets, production status & costs"}
      />
      <AdminFilterBar>
        <Input placeholder={locale === "th" ? "ชื่อเรื่อง / คำอธิบาย" : "Title / description"} value={q} onChange={(e) => setQ(e.target.value)} />
        <AdminUserSearchSelect value={userId} onChange={(id) => setUserId(id)} />
        <Input placeholder={locale === "th" ? "สถานะพล็อตเรื่อง" : "Summary status"} value={summaryStatus} onChange={(e) => setSummaryStatus(e.target.value)} />
        <Input
          placeholder={locale === "th" ? "สถานะสกัดแอสเซท" : "Assets seed status"}
          value={assetsSeedStatus}
          onChange={(e) => setAssetsSeedStatus(e.target.value)}
        />
        <Button
          size="sm"
          variant="secondary"
          className="admin-filter-action"
          onClick={() => {
            setPage(1);
            void load(1);
          }}
        >
          {locale === "th" ? "กรอง" : "Filter"}
        </Button>
      </AdminFilterBar>
      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>{locale === "th" ? "ชื่อเรื่อง" : "Title"}</th>
              <th>{locale === "th" ? "ผู้ใช้" : "User"}</th>
              <th>{locale === "th" ? "ตอน" : "Episodes"}</th>
              <th>{locale === "th" ? "แอสเซท" : "Assets"}</th>
              <th>{locale === "th" ? "ค่าใช้จ่าย" : "Cost"}</th>
              <th>{locale === "th" ? "พล็อต" : "Summary"}</th>
              <th>{locale === "th" ? "สกัดแอสเซท" : "Seed"}</th>
              <th>{locale === "th" ? "เวลาอัปเดต" : "Updated At"}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td className="max-w-[200px] truncate">
                  <Link to={`/drama-projects/${row.id}`} className="admin-link font-medium">
                    {row.title}
                  </Link>
                </td>
                <td>
                  <AdminEntityLink kind="user" id={row.user_id} label={row.user_email ?? undefined} />
                </td>
                <td>{row.episode_count ?? 0}</td>
                <td>{row.asset_count ?? 0}</td>
                <td>¥{fenToYuan(row.charge_fen ?? 0)}</td>
                <td className="text-xs text-[var(--admin-muted)]">{row.summary_status || "—"}</td>
                <td className="text-xs text-[var(--admin-muted)]">{row.assets_seed_status || "—"}</td>
                <td className="text-xs text-[var(--admin-muted)]">
                  {row.updated_at ? new Date(row.updated_at).toLocaleString() : "—"}
                </td>
                <td>
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/drama-projects/${row.id}`}>{locale === "th" ? "รายละเอียด" : "Details"}</Link>
                  </Button>
                </td>
              </tr>
            ))}
            {(data?.items.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={10} className="!text-center text-[var(--admin-muted)]">
                  {locale === "th" ? "ไม่มีโปรเจกต์" : "No projects"}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {data?.meta ? (
        <PaginationBar
          page={data.meta.page}
          pageSize={data.meta.page_size}
          total={data.meta.total}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}
