import { useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, UsersRound } from "lucide-react";
import type { PageResult } from "@/api/types/common";
import type { AdminTeam } from "@/api/types/teams";
import { teamPaths } from "@/api/teams";
import { AdminFilterBar } from "@/components/admin/AdminFilterBar";
import { AdminSearchInput } from "@/components/admin/AdminSearchInput";
import { PaginationBar } from "@/components/PaginationBar";
import { TeamQueryFeedback } from "@/components/teams/TeamQueryFeedback";
import { teamDate } from "@/lib/teamLabels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminTeamQuery } from "@/hooks/useAdminTeamQuery";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { fenToYuan } from "@/lib/utils";

/** จัดการทีม入口：ดู归属、规模、เจ้าของ (Owner)账户与消费上限与实际消费。 */
export function TeamsPage() {
  /* draft 为输入值，q 为已ส่งค้นหา；分页全部由服务端เสร็จสิ้น。 */
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const query = useAdminTeamQuery<PageResult<AdminTeam>>(teamPaths.list({ page, pageSize, q }));
  const { data, loading, error, reload } = query;

  /** ส่งค้นหา时รีเซ็ต到首页，重复ค้นหา也可รีเฟรช。 */
  function search() {
    setQ(draft.trim()); setPage(1); reload();
  }

  return <div className="space-y-5">
    <PageHeader title="จัดการทีม" description="ดู全部团队、สมาชิก、เจ้าของ (Owner)账户与消费上限，追溯每一笔团队消费。" actions={<Button type="button" variant="outline" disabled={loading} onClick={reload}><RefreshCw className="h-4 w-4" />รีเฟรช</Button>} />
    <form onSubmit={(event) => { event.preventDefault(); search(); }}>
      <AdminFilterBar trailing={<Badge variant="info">{data ? `${data.meta.total} 个团队` : "จัดการทีม"}</Badge>}>
        <AdminSearchInput value={draft} onChange={setDraft} placeholder="ค้นหา团队名称、ID、เจ้าของ (Owner)昵称或邮箱" />
        <Button type="submit" size="sm" disabled={loading}>ค้นหา</Button>
      </AdminFilterBar>
    </form>
    <TeamQueryFeedback loading={loading} error={error} empty={!data?.items.length} onRetry={reload} />
    {data && data.items.length > 0 && <div className="space-y-3">
      <Table><TableHeader><TableRow>
        <TableHead>ทีม</TableHead><TableHead>เจ้าของทีม</TableHead><TableHead>สมาชิก / โปรเจกต์</TableHead>
        <TableHead>เจ้าของ (Owner)个人余额 / 冻结</TableHead><TableHead>本月消费</TableHead><TableHead>เวลาสร้าง</TableHead><TableHead>การดำเนินการ</TableHead>
      </TableRow></TableHeader><TableBody>{data.items.map((team) => <TableRow key={team.id}>
        <TableCell><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--admin-accent-soft)] text-[var(--admin-forest)]"><UsersRound className="h-5 w-5" /></span><div><Link className="font-semibold hover:underline" to={`/teams/${team.id}`}>{team.name}</Link><div className="mt-1 text-xs text-[var(--admin-muted)]">#{team.id}</div></div></div></TableCell>
        <TableCell><div>{team.owner_nickname || "—"}</div><div className="mt-1 text-xs text-[var(--admin-muted)]">{team.owner_email}</div></TableCell>
        <TableCell><span className="tabular-nums">{team.member_count} 位สมาชิก / {team.project_count} 个โปรเจกต์</span></TableCell>
        <TableCell className="tabular-nums"><div>¥{fenToYuan(team.balance_fen)}</div><div className="mt-1 text-xs text-[var(--admin-muted)]">冻结 ¥{fenToYuan(team.frozen_fen)}</div></TableCell>
        <TableCell className="tabular-nums"><div>¥{fenToYuan(team.month_spent_fen)}</div><div className="mt-1 text-xs text-[var(--admin-muted)]">{team.period}</div></TableCell>
        <TableCell className="whitespace-nowrap text-xs">{teamDate(team.created_at)}</TableCell>
        <TableCell><Button type="button" asChild size="sm" variant="outline"><Link to={`/teams/${team.id}`}>ดู团队</Link></Button></TableCell>
      </TableRow>)}</TableBody></Table>
    </div>}
    {data && <PaginationBar page={page} pageSize={pageSize} total={data.meta.total} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
  </div>;
}
