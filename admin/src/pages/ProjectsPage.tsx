import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, type AdminProject, type PageMeta } from "@/api/client";
import {
  AdminDetailMeta,
  AdminDetailNote,
  AdminDetailSection,
  AdminDetailStatGrid,
  AdminDetailTableWrap,
} from "@/components/admin/AdminDetailLayout";
import { AdminEntityLink } from "@/components/admin/AdminEntityLink";
import { AdminFilterBar } from "@/components/admin/AdminFilterBar";
import { AdminModal } from "@/components/admin/AdminModal";
import { AdminUserSearchSelect } from "@/components/admin/AdminUserSearchSelect";
import { PaginationBar } from "@/components/PaginationBar";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page";
import { useAdminDetailQuery } from "@/hooks/useAdminDetailQuery";
import { PROJECT_STATUS_OPTIONS, projectStatusLabel, taskStatusLabel, taskTypeLabel } from "@/lib/statusLabels";
import { fenToYuan } from "@/lib/utils";
import { useI18n } from "@/i18n";

type ListRes = { items: AdminProject[]; meta: PageMeta };

function statusBadgeVariant(status: string): "destructive" | "success" | "warning" | "info" | "secondary" {
  if (status === "FAILED" || status === "REJECTED") return "destructive";
  if (status === "DONE") return "success";
  if (status === "CANCELLED") return "secondary";
  if (status === "DRAFT") return "secondary";
  return "info";
}

function mediaSrc(url: string | null | undefined): string {
  const trimmed = (url || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function ProjectsPage() {
  const { locale } = useI18n();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListRes | null>(null);
  const [detail, setDetail] = useState<AdminProject | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const projectDetail = useAdminDetailQuery("open");

  async function load(nextPage = page) {
    try {
      const params = new URLSearchParams({ page: String(nextPage), page_size: String(DEFAULT_PAGE_SIZE) });
      if (status) params.set("status", status);
      if (q.trim()) params.set("q", q.trim());
      if (userId) params.set("user_id", String(userId));
      setData(await api<ListRes>(`/api/admin/projects?${params}`));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (locale === "th" ? "โหลดข้อมูลล้มเหลว" : "Failed to load"));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function openDetail(id: number) {
    setDetailLoading(true);
    projectDetail.open(id);
    try {
      setDetail(await api<AdminProject>(`/api/admin/projects/${id}`));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (locale === "th" ? "โหลดรายละเอียดล้มเหลว" : "Failed to load details"));
      projectDetail.close();
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    if (!projectDetail.id) {
      setDetail(null);
      return;
    }
    if (detail?.id === projectDetail.id) return;
    void openDetail(projectDetail.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectDetail.id]);

  const usage = detail?.usage;

  return (
    <div className="admin-list-page">
      <PageHeader
        title={locale === "th" ? "โปรเจกต์วิดีโอ" : "Video Projects"}
        description={locale === "th" ? "โปรเจกต์ไปป์ไลน์วิดีโอ: สถานะ, ช็อต, คิวงานที่เกี่ยวข้อง และค่าใช้จ่าย" : "Video pipeline projects: status, shots, tasks, and charges"}
      />
      <AdminFilterBar>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          {PROJECT_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <Input placeholder={locale === "th" ? "ชื่อเรื่อง / ข้อความผิดพลาด" : "Title / error message"} value={q} onChange={(e) => setQ(e.target.value)} />
        <AdminUserSearchSelect value={userId} onChange={(id) => setUserId(id)} />
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
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>{locale === "th" ? "ชื่อเรื่อง" : "Title"}</TableHead>
              <TableHead>{locale === "th" ? "ผู้ใช้" : "User"}</TableHead>
              <TableHead>{locale === "th" ? "แม่แบบ" : "Template"}</TableHead>
              <TableHead>{locale === "th" ? "ไปป์ไลน์" : "Pipeline"}</TableHead>
              <TableHead>{locale === "th" ? "สถานะ" : "Status"}</TableHead>
              <TableHead>{locale === "th" ? "ความคืบหน้า" : "Progress"}</TableHead>
              <TableHead>{locale === "th" ? "ช็อต" : "Shots"}</TableHead>
              <TableHead>{locale === "th" ? "ค่าใช้จ่าย" : "Cost"}</TableHead>
              <TableHead>{locale === "th" ? "วันที่สร้าง" : "Created"}</TableHead>
              <TableHead>{locale === "th" ? "วันที่อัปเดต" : "Updated"}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items ?? []).map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.id}</TableCell>
                <TableCell className="max-w-[180px] truncate">{p.title}</TableCell>
                <TableCell className="text-sm">
                  <AdminEntityLink kind="user" id={p.user_id} label={p.user_email ?? undefined} />
                </TableCell>
                <TableCell className="font-mono text-xs">{p.template_id}</TableCell>
                <TableCell className="text-xs">{p.pipeline_mode}</TableCell>
                <TableCell>
                  <Badge variant={statusBadgeVariant(p.status)}>{projectStatusLabel(p.status)}</Badge>
                </TableCell>
                <TableCell>{p.progress}%</TableCell>
                <TableCell>{p.shot_count}</TableCell>
                <TableCell>¥{fenToYuan(p.charge_fen ?? 0)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(p.created_at).toLocaleString()}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(p.updated_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => void openDetail(p.id)}>
                    {locale === "th" ? "รายละเอียด" : "Details"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {data && (
        <PaginationBar
          page={data.meta.page}
          pageSize={data.meta.page_size}
          total={data.meta.total}
          onPageChange={setPage}
        />
      )}

      <AdminModal
        open={projectDetail.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDetail(null);
            projectDetail.close();
          }
        }}
        size="full"
        title={detail ? `${locale === "th" ? "โปรเจกต์วิดีโอ" : "Project"} #${detail.id} · ${detail.title}` : (locale === "th" ? "รายละเอียดโปรเจกต์" : "Project Details")}
        subtitle={detail ? projectStatusLabel(detail.status) : detailLoading ? (locale === "th" ? "กำลังโหลด…" : "Loading…") : undefined}
        bodyClassName="space-y-3"
      >
        {detailLoading && !detail ? (
          <div className="py-10 text-center text-sm text-[var(--admin-muted)]">{locale === "th" ? "กำลังโหลด…" : "Loading…"}</div>
        ) : null}
        {detail ? (
          <>
            <AdminDetailSection title={locale === "th" ? "ข้อมูลพื้นฐาน" : "Basic Information"}>
              <AdminDetailMeta
                items={[
                  {
                    label: locale === "th" ? "ผู้ใช้" : "User",
                    value: (
                      <AdminEntityLink
                        kind="user"
                        id={detail.user_id}
                        label={detail.user_email ?? undefined}
                      />
                    ),
                  },
                  {
                    label: locale === "th" ? "สถานะ / ความคืบหน้า" : "Status / Progress",
                    value: `${projectStatusLabel(detail.status)} · ${detail.progress}% · ${locale === "th" ? "ช็อต" : "Shots"} ${detail.shot_count}`,
                  },
                  { label: locale === "th" ? "แม่แบบ" : "Template", value: detail.template_id },
                  { label: locale === "th" ? "ไปป์ไลน์" : "Pipeline", value: detail.pipeline_mode },
                  { label: locale === "th" ? "ที่มา" : "Source", value: detail.source_type || "—" },
                  {
                    label: locale === "th" ? "ความละเอียด / สัดส่วน" : "Resolution / Ratio",
                    value: `${detail.resolution_mode || "—"} · ${detail.output_ratio || "—"}`,
                  },
                  { label: locale === "th" ? "เสียงพากย์" : "Voice", value: detail.voice_id || "—", full: true },
                ]}
              />
              <AdminDetailNote empty={!detail.error_msg} className="mt-3">
                {detail.error_msg || (locale === "th" ? "ไม่มีข้อความผิดพลาด" : "No errors")}
              </AdminDetailNote>
            </AdminDetailSection>

            {(detail.cover_url || detail.final_video_url) ? (
              <AdminDetailSection title={locale === "th" ? "ตัวอย่างสื่อ" : "Media Preview"}>
                <div className="admin-detail-media">
                  {detail.cover_url ? (
                    <img src={mediaSrc(detail.cover_url)} alt="Cover" />
                  ) : null}
                  {detail.final_video_url ? (
                    <video src={mediaSrc(detail.final_video_url)} controls className="max-w-full" />
                  ) : null}
                </div>
              </AdminDetailSection>
            ) : null}

            <AdminDetailSection title={locale === "th" ? "สรุปค่าใช้จ่าย" : "Cost Summary"}>
              <AdminDetailStatGrid
                items={[
                  { label: locale === "th" ? "ยอดเงินที่หัก" : "Charged", value: `¥${fenToYuan(usage?.charge_fen ?? detail.charge_fen ?? 0)}` },
                  { label: locale === "th" ? "จำนวนครั้งที่เรียก" : "Calls", value: usage?.calls ?? 0 },
                  { label: "Tokens", value: usage?.tokens ?? 0 },
                  {
                    label: locale === "th" ? "ภาพ/วิดีโอ/LLM/TTS" : "Img/Vid/LLM/TTS",
                    value: `${usage?.image_gens ?? 0}/${usage?.video_gens ?? 0}/${usage?.llm_calls ?? 0}/${usage?.tts_gens ?? 0}`,
                  },
                ]}
              />
            </AdminDetailSection>

            <AdminDetailSection title={`${locale === "th" ? "ช็อตสตอรี่บอร์ด" : "Shots"} (${(detail.shots ?? []).length})`}>
              <AdminDetailTableWrap>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{locale === "th" ? "สถานะ" : "Status"}</th>
                      <th>{locale === "th" ? "ความยาว" : "Duration"}</th>
                      <th>{locale === "th" ? "ภาพ" : "Image"}</th>
                      <th>{locale === "th" ? "วิดีโอ" : "Video"}</th>
                      <th>{locale === "th" ? "เสียง" : "Audio"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.shots ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="!text-center text-[var(--admin-muted)]">
                          {locale === "th" ? "ไม่มีช็อต" : "No shots"}
                        </td>
                      </tr>
                    ) : (
                      (detail.shots ?? []).map((s) => (
                        <tr key={s.id}>
                          <td>{s.shot_no}</td>
                          <td>{s.status}</td>
                          <td>{s.duration}s</td>
                          <td>{s.has_image ? "✓" : "—"}</td>
                          <td>{s.has_video ? "✓" : "—"}</td>
                          <td>{s.has_audio ? "✓" : "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </AdminDetailTableWrap>
            </AdminDetailSection>

            <AdminDetailSection title={`${locale === "th" ? "คิวงานที่เกี่ยวข้อง" : "Related Tasks"} (${(detail.recent_tasks ?? []).length})`}>
              <AdminDetailTableWrap className="max-h-[200px]">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>{locale === "th" ? "ประเภท" : "Type"}</th>
                      <th>{locale === "th" ? "สถานะ" : "Status"}</th>
                      <th>{locale === "th" ? "หักจริง / ประมาณการ" : "Charged / Est"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.recent_tasks ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="!text-center text-[var(--admin-muted)]">
                          {locale === "th" ? "ไม่มีคิวงาน" : "No tasks"}
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

            {detail.source_text ? (
              <AdminDetailSection title={locale === "th" ? "ข้อความต้นฉบับ" : "Source Text"}>
                <AdminDetailNote>{detail.source_text}</AdminDetailNote>
              </AdminDetailSection>
            ) : null}
          </>
        ) : null}
      </AdminModal>
    </div>
  );
}
