import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { teamPaths } from "@/api/teams";
import type { AdminTeamUsagePage } from "@/api/types/teams";
import { AdminDateRangeFilter } from "@/components/admin/AdminDateRangeFilter";
import { AdminFilterBar, AdminFilterField } from "@/components/admin/AdminFilterBar";
import { AdminListStats } from "@/components/admin/AdminListStats";
import { AdminSearchInput } from "@/components/admin/AdminSearchInput";
import { PaginationBar } from "@/components/PaginationBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TeamQueryFeedback } from "./TeamQueryFeedback";
import { teamDate } from "@/lib/teamLabels";
import { useAdminTeamQuery } from "@/hooks/useAdminTeamQuery";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { fenToYuan } from "@/lib/utils";

/** 团队รายละเอียดการใช้จ่าย与ตัวกรอง合计；สมาชิก深链可继续ดู已退出สมาชิก的历史记录。 */
export function TeamUsageTable({ teamId }: { teamId: number }) {
  /* filter/draft 分离ส่ง，memberId 来自สมาชิก列表深链；分页由后端执行。 */
  const [params, setParams] = useSearchParams();
  const memberId = /^\d+$/.test(params.get("member_id") || "") && Number(params.get("member_id")) > 0 ? params.get("member_id")! : "";
  const [draft, setDraft] = useState({ q: "", settled: "", dateFrom: "", dateTo: "" });
  const [filter, setFilter] = useState(draft);
  const [validation, setValidation] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const { data, loading, error, reload } = useAdminTeamQuery<AdminTeamUsagePage>(teamPaths.usage(teamId, { ...filter, memberId, page, pageSize }));

  /** 检查日历范围后ส่งตัวกรอง，不覆盖上一次有效结果。 */
  function search() {
    if (draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo) { setValidation("开始日期不能晚于结束日期"); return; }
    setValidation(""); setFilter(draft); setPage(1); reload();
  }

  return <div className="space-y-4">
    <form onSubmit={(event) => { event.preventDefault(); search(); }}>
      <AdminFilterBar>
        <AdminSearchInput value={draft.q} onChange={(q) => setDraft({ ...draft, q })} placeholder="ค้นหาสมาชิก、邮箱、โปรเจกต์、模型或计费项" />
        <AdminFilterField label="结算สถานะ"><Select value={draft.settled} onChange={(event) => setDraft({ ...draft, settled: event.target.value })}><option value="">全部สถานะ</option><option value="true">已结算</option><option value="false">待结算</option></Select></AdminFilterField>
        <AdminDateRangeFilter from={draft.dateFrom} to={draft.dateTo} onChange={({ from, to }) => setDraft({ ...draft, dateFrom: from, dateTo: to })} />
        <Button type="submit" size="sm" disabled={loading}>ตัวกรอง</Button>
      </AdminFilterBar>
    </form>
    {validation && <p role="alert" className="text-sm text-red-700">{validation}</p>}
    {memberId && <div className="flex items-center gap-3 text-sm"><Badge variant="info">仅ดูสมาชิก #{memberId}</Badge><Button type="button" variant="ghost" size="sm" onClick={() => { const next = new URLSearchParams(params); next.delete("member_id"); setParams(next, { replace: true }); setPage(1); }}>ดู全部สมาชิก</Button></div>}
    <AdminListStats items={[
      { label: "ตัวกรอง结果记录数", value: data?.summary.record_count ?? "—" },
      { label: "ตัวกรอง结果已结算消费", value: data ? `¥${fenToYuan(data.summary.settled_charge_fen)}` : "—", hint: "按全部ตัวกรอง结果汇总，不受分页影响；不含待结算金额" },
    ]} />
    <TeamQueryFeedback loading={loading} error={error} empty={!data?.items.length} onRetry={reload} />
    {data && data.items.length > 0 && <Table><TableHeader><TableRow>
      <TableHead>เวลา（上海）</TableHead><TableHead>สมาชิก</TableHead><TableHead>โปรเจกต์ / 任务</TableHead><TableHead>计费โปรเจกต์ / 模型</TableHead><TableHead>Token</TableHead><TableHead>金额</TableHead><TableHead>结算สถานะ</TableHead>
    </TableRow></TableHeader><TableBody>{data.items.map((row) => <TableRow key={row.id}>
      <TableCell className="whitespace-nowrap text-xs">{teamDate(row.created_at)}</TableCell>
      <TableCell><div className="font-semibold">{row.user_nickname || "—"}</div><div className="mt-1 text-xs text-[var(--admin-muted)]">{row.user_email} · #{row.user_id}</div></TableCell>
      <TableCell><div>{row.project_title || (row.project_id ? "โปรเจกต์已ลบ" : "无โปรเจกต์关联")}</div><div className="mt-1 text-xs text-[var(--admin-muted)]">{row.project_id ? `โปรเจกต์ #${row.project_id} · ` : ""}{row.task_run_id ? `任务 #${row.task_run_id}` : "无任务关联"}</div></TableCell>
      <TableCell><div>{row.billing_label}</div><div className="mt-1 text-xs text-[var(--admin-muted)]">{row.model || "—"}</div></TableCell>
      <TableCell className="tabular-nums">{row.total_tokens.toLocaleString()}</TableCell>
      <TableCell className="font-semibold tabular-nums">¥{fenToYuan(row.charge_fen)}</TableCell>
      <TableCell><Badge variant={row.settled ? "success" : "warning"}>{row.settled ? "已结算" : "待结算"}</Badge></TableCell>
    </TableRow>)}</TableBody></Table>}
    {data && <PaginationBar page={page} pageSize={pageSize} total={data.meta.total} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
  </div>;
}
