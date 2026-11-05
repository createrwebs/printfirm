import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api, type AdminDramaProject } from "@/api/client";
import {
  AdminDetailMeta,
  AdminDetailSection,
  AdminDetailStatGrid,
  AdminDetailTableWrap,
} from "@/components/admin/AdminDetailLayout";
import { AdminEntityLink } from "@/components/admin/AdminEntityLink";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dramaAssetTypeLabel, formatDramaGenerationStatus } from "@/lib/dramaLabels";
import { taskStatusLabel, taskTypeLabel } from "@/lib/statusLabels";
import { fenToYuan } from "@/lib/utils";

const TABS = ["overview", "episodes", "assets", "tasks"] as const;
type TabKey = (typeof TABS)[number];

function isTabKey(value: string | null): value is TabKey {
  return TABS.includes(value as TabKey);
}

/** โปรเจกต์ละครซีรีส์二级รายละเอียด：概览 / 分 ตอน / แอสเซท / 任务 */
export function DramaProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: TabKey = isTabKey(tabParam) ? tabParam : "overview";

  const [detail, setDetail] = useState<AdminDramaProject | null>(null);
  const [loading, setLoading] = useState(true);

  const id = Number(projectId);

  useEffect(() => {
    if (!id || Number.isNaN(id)) {
      navigate("/drama-projects", { replace: true });
      return;
    }
    setLoading(true);
    void api<AdminDramaProject>(`/api/admin/drama-projects/${id}`)
      .then(setDetail)
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "โหลดไม่สำเร็จ");
        navigate("/drama-projects", { replace: true });
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  function setTab(next: TabKey) {
    const params = new URLSearchParams(searchParams);
    if (next === "overview") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  }

  const usage = detail?.usage;

  if (loading && !detail) {
    return <div className="admin-detail-page-loading">กำลังโหลด…</div>;
  }
  if (!detail) return null;

  return (
    <div className="admin-detail-page">
      <div className="admin-detail-page-toolbar">
        <Button variant="ghost" size="sm" className="admin-detail-back" asChild>
          <Link to="/drama-projects">
            <ArrowLeft className="h-4 w-4" />
            กลับ列表
          </Link>
        </Button>
        <div className="admin-detail-page-heading">
          <h2 className="admin-detail-page-title">
            ละครซีรีส์ #{detail.id} · {detail.title}
          </h2>
          <p className="admin-detail-page-sub">
            <AdminEntityLink kind="user" id={detail.user_id} label={detail.user_email ?? undefined} />
            {detail.summary_status ? ` · เรื่องย่อ ${detail.summary_status}` : ""}
          </p>
        </div>
        <div className="admin-detail-page-actions">
          <Button size="sm" variant="outline" asChild>
            <Link to={`/drama-assets?project_id=${detail.id}`}>ดูแอสเซท库</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to={`/drama-episodes?project_id=${detail.id}`}>ดู分 ตอน</Link>
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="admin-detail-tabs">
        <TabsList className="admin-detail-tabs-list">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="episodes">分 ตอน（{detail.episode_count ?? 0}）</TabsTrigger>
          <TabsTrigger value="assets">แอสเซท（{detail.asset_count ?? 0}）</TabsTrigger>
          <TabsTrigger value="tasks">任务（{(detail.recent_tasks ?? []).length}）</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="admin-detail-tab-panel">
          <AdminDetailSection title="基本信息">
            <AdminDetailMeta
              items={[
                {
                  label: "用户",
                  value: (
                    <AdminEntityLink
                      kind="user"
                      id={detail.user_id}
                      label={detail.user_email ?? undefined}
                    />
                  ),
                },
                { label: "คำอธิบาย", value: detail.description || "无คำอธิบาย", full: true },
                { label: "เรื่องย่อสถานะ", value: detail.summary_status || "—" },
                { label: "分 ตอนสถานะ", value: detail.episode_content_status || "—" },
                { label: "แอสเซท抽取", value: detail.assets_seed_status || "—" },
                { label: " ตอน数", value: detail.episode_count ?? 0 },
                { label: "แอสเซท数", value: detail.asset_count ?? 0 },
                { label: "分镜数", value: detail.fragment_count ?? 0 },
                {
                  label: "เวลาที่อัปเดต",
                  value: detail.updated_at ? new Date(detail.updated_at).toLocaleString() : "—",
                  full: true,
                },
              ]}
            />
          </AdminDetailSection>

          <AdminDetailSection title="费用汇总">
            <AdminDetailStatGrid
              items={[
                { label: "扣费", value: `¥${fenToYuan(usage?.charge_fen ?? detail.charge_fen ?? 0)}` },
                { label: "调用", value: usage?.calls ?? 0 },
                {
                  label: "图/视/LLM/TTS",
                  value: `${usage?.image_gens ?? 0}/${usage?.video_gens ?? 0}/${usage?.llm_calls ?? 0}/${usage?.tts_gens ?? 0}`,
                },
              ]}
            />
          </AdminDetailSection>
        </TabsContent>

        <TabsContent value="episodes" className="admin-detail-tab-panel">
          <AdminDetailSection title={`分 ตอน列表（${(detail.episodes ?? []).length}）`}>
            <AdminDetailTableWrap>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>名称</th>
                    <th>分镜数</th>
                    <th>分镜计划</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.episodes ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="!text-center text-[var(--admin-muted)]">
                        ยังไม่มีตอน
                      </td>
                    </tr>
                  ) : (
                    (detail.episodes ?? []).map((ep) => (
                      <tr key={ep.id}>
                        <td>{ep.id}</td>
                        <td>{ep.name}</td>
                        <td>{ep.fragment_count}</td>
                        <td>{ep.fragment_plan_status || "—"}</td>
                        <td>
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/drama-episodes/${ep.id}`}>ดู</Link>
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </AdminDetailTableWrap>
          </AdminDetailSection>
        </TabsContent>

        <TabsContent value="assets" className="admin-detail-tab-panel">
          <AdminDetailSection title={`โปรเจกต์แอสเซท（${(detail.assets ?? []).length}）`}>
            <AdminDetailTableWrap>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>ประเภท</th>
                    <th>名称</th>
                    <th>封面</th>
                    <th>生成</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.assets ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="!text-center text-[var(--admin-muted)]">
                        ไม่มีแอสเซท
                      </td>
                    </tr>
                  ) : (
                    (detail.assets ?? []).map((a) => (
                      <tr key={a.id}>
                        <td>{a.id}</td>
                        <td>{dramaAssetTypeLabel(a.type)}</td>
                        <td className="max-w-[160px] truncate">{a.name || "—"}</td>
                        <td>{a.has_cover ? "有基准图" : "—"}</td>
                        <td>{formatDramaGenerationStatus(a.generation_status)}</td>
                        <td>
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/drama-assets/${a.id}`}>ดู</Link>
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </AdminDetailTableWrap>
          </AdminDetailSection>
        </TabsContent>

        <TabsContent value="tasks" className="admin-detail-tab-panel">
          <AdminDetailSection title={`关联任务（最近 ${(detail.recent_tasks ?? []).length}）`}>
            <AdminDetailTableWrap>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>ประเภท</th>
                    <th>สถานะ</th>
                    <th>已扣 / 预估</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.recent_tasks ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="!text-center text-[var(--admin-muted)]">
                        暂无任务
                      </td>
                    </tr>
                  ) : (
                    (detail.recent_tasks ?? []).map((t) => (
                      <tr key={t.id}>
                        <td>
                          <AdminEntityLink kind="task" id={t.id} />
                        </td>
                        <td>{taskTypeLabel(t.task_type)}</td>
                        <td>{taskStatusLabel(t.status)}</td>
                        <td>
                          ¥{fenToYuan(t.billing_charged_fen)} / ¥{fenToYuan(t.billing_estimate_fen)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </AdminDetailTableWrap>
          </AdminDetailSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}
