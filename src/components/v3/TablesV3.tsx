"use client";

import { useMemo, useState } from "react";
import type { DomainDrill, DomainRow, PerfSummary, PipelineDomainRow, ReviewerRow, RosterRow, WindowValues, WriterRow } from "@/lib/typesV3";
import { fmtDayLong, fmtHours, fmtMoney, fmtNum, fmtPct } from "./formatV3";

const PAGE = 20;

function Th({ children, onClick, active, dir }: { children: React.ReactNode; onClick?: () => void; active?: boolean; dir?: "asc" | "desc" }) {
  return (
    <th
      className={`sticky top-0 whitespace-nowrap bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${onClick ? "cursor-pointer select-none hover:text-slate-800" : ""}`}
      onClick={onClick}
    >
      {children}
      {active ? <span className="ml-1">{dir === "asc" ? "▲" : "▼"}</span> : null}
    </th>
  );
}

function Pager({ page, setPage, total }: { page: number; setPage: (n: number) => void; total: number }) {
  const pages = Math.max(1, Math.ceil(total / PAGE));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 px-3 py-2 text-xs text-slate-500">
      <button className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40" disabled={page === 0} onClick={() => setPage(page - 1)}>
        Prev
      </button>
      <span>
        {page + 1} / {pages}
      </span>
      <button className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
        Next
      </button>
    </div>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search…"
      className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-400"
    />
  );
}

function useSort<T>(rows: T[], initial: keyof T) {
  const [key, setKey] = useState<keyof T>(initial);
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      const an = typeof av === "number" ? av : av === null ? -Infinity : String(av);
      const bn = typeof bv === "number" ? bv : bv === null ? -Infinity : String(bv);
      if (an < bn) return dir === "asc" ? -1 : 1;
      if (an > bn) return dir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [rows, key, dir]);
  const toggle = (k: keyof T) => {
    if (k === key) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setKey(k);
      setDir("desc");
    }
  };
  return { sorted, key, dir, toggle };
}

export function WriterTable({ rows }: { rows: WriterRow[] }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase())), [rows, q]);
  const { sorted, key, dir, toggle } = useSort(filtered, "units");
  const view = sorted.slice(page * PAGE, page * PAGE + PAGE);
  const totals = useMemo(() => {
    const t = { units: 0, unitsT1: 0, submitted: 0, approved: 0, hours: 0, oneShotNum: 0, oneShotDen: 0 };
    for (const r of filtered) {
      t.units += r.units;
      t.unitsT1 += r.unitsT1;
      t.submitted += r.submitted;
      t.approved += r.approved;
      t.hours += r.hours ?? 0;
      if (r.oneShot !== null) {
        t.oneShotNum += r.oneShot * r.approved;
        t.oneShotDen += r.approved;
      }
    }
    return t;
  }, [filtered]);
  if (rows.length === 0) return <div className="p-6 text-sm text-slate-400">No data available for the selected filters.</div>;
  return (
    <div>
      <div className="flex items-center justify-between px-3 py-2">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(0); }} />
        <span className="text-xs text-slate-400">{filtered.length} writers</span>
      </div>
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr>
              <Th onClick={() => toggle("name")} active={key === "name"} dir={dir}>Name</Th>
              <Th onClick={() => toggle("unitsT1")} active={key === "unitsT1"} dir={dir}>Submissions · Yesterday</Th>
              <Th onClick={() => toggle("units7d")} active={key === "units7d"} dir={dir}>Submissions · 7-day avg</Th>
              <Th onClick={() => toggle("units")} active={key === "units"} dir={dir}>Submissions</Th>
              <Th onClick={() => toggle("submitted")} active={key === "submitted"} dir={dir}>Tasks Written</Th>
              <Th onClick={() => toggle("approved")} active={key === "approved"} dir={dir}>Tasks Approved</Th>
              <Th onClick={() => toggle("hours")} active={key === "hours"} dir={dir}>Hours</Th>
              <Th onClick={() => toggle("ahtApproved")} active={key === "ahtApproved"} dir={dir}>Hours per Approved Task</Th>
              <Th onClick={() => toggle("ahtSubmitted")} active={key === "ahtSubmitted"} dir={dir}>Hours per Task Written</Th>
              <Th onClick={() => toggle("oneShot")} active={key === "oneShot"} dir={dir}>Clean Pass Rate</Th>
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={r.name} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-700">{r.name}</td>
                <td className="px-3 py-2">{fmtNum(r.unitsT1)}</td>
                <td className="px-3 py-2">{fmtNum(r.units7d, 2)}</td>
                <td className="px-3 py-2">{fmtNum(r.units)}</td>
                <td className="px-3 py-2">{fmtNum(r.submitted)}</td>
                <td className="px-3 py-2">{fmtNum(r.approved)}</td>
                <td className="px-3 py-2">{r.hours === null ? "—" : fmtHours(r.hours)}</td>
                <td className="px-3 py-2">{r.ahtApproved === null ? "—" : `${r.ahtApproved.toFixed(2)} h`}</td>
                <td className="px-3 py-2">{r.ahtSubmitted === null ? "—" : `${r.ahtSubmitted.toFixed(2)} h`}</td>
                <td className="px-3 py-2">{fmtPct(r.oneShot)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-700">
              <td className="px-3 py-2">Total ({filtered.length})</td>
              <td className="px-3 py-2">{fmtNum(totals.unitsT1)}</td>
              <td className="px-3 py-2">—</td>
              <td className="px-3 py-2">{fmtNum(totals.units)}</td>
              <td className="px-3 py-2">{fmtNum(totals.submitted)}</td>
              <td className="px-3 py-2">{fmtNum(totals.approved)}</td>
              <td className="px-3 py-2">{fmtHours(totals.hours)}</td>
              <td className="px-3 py-2">{totals.approved > 0 ? `${(totals.hours / totals.approved).toFixed(2)} h` : "—"}</td>
              <td className="px-3 py-2">{totals.submitted > 0 ? `${(totals.hours / totals.submitted).toFixed(2)} h` : "—"}</td>
              <td className="px-3 py-2">{totals.oneShotDen > 0 ? fmtPct(totals.oneShotNum / totals.oneShotDen) : "—"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <Pager page={page} setPage={setPage} total={filtered.length} />
    </div>
  );
}

export function ReviewerTable({ rows }: { rows: ReviewerRow[] }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase())), [rows, q]);
  const { sorted, key, dir, toggle } = useSort(filtered, "units");
  const view = sorted.slice(page * PAGE, page * PAGE + PAGE);
  const totals = useMemo(() => {
    const t = { units: 0, unitsT1: 0, reviewedTasks: 0, hours: 0 };
    for (const r of filtered) {
      t.units += r.units;
      t.unitsT1 += r.unitsT1;
      t.reviewedTasks += r.reviewedTasks;
      t.hours += r.hours ?? 0;
    }
    return t;
  }, [filtered]);
  if (rows.length === 0) return <div className="p-6 text-sm text-slate-400">No data available for the selected filters.</div>;
  return (
    <div>
      <div className="flex items-center justify-between px-3 py-2">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(0); }} />
        <span className="text-xs text-slate-400">{filtered.length} reviewers</span>
      </div>
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr>
              <Th onClick={() => toggle("name")} active={key === "name"} dir={dir}>Reviewer</Th>
              <Th onClick={() => toggle("unitsT1")} active={key === "unitsT1"} dir={dir}>Passes · Yesterday</Th>
              <Th onClick={() => toggle("units7d")} active={key === "units7d"} dir={dir}>Passes · 7-day avg</Th>
              <Th onClick={() => toggle("units")} active={key === "units"} dir={dir}>Review Passes</Th>
              <Th onClick={() => toggle("reviewedTasks")} active={key === "reviewedTasks"} dir={dir}>Tasks Reviewed</Th>
              <Th onClick={() => toggle("hours")} active={key === "hours"} dir={dir}>Review Hours</Th>
              <Th onClick={() => toggle("hoursPerPass")} active={key === "hoursPerPass"} dir={dir}>Hours per Review Pass</Th>
              <Th onClick={() => toggle("hoursPerReviewedTask")} active={key === "hoursPerReviewedTask"} dir={dir}>Hours per Reviewed Task</Th>
              <Th onClick={() => toggle("passesPerTask")} active={key === "passesPerTask"} dir={dir}>Passes per Task</Th>
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={r.name} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-700">{r.name}</td>
                <td className="px-3 py-2">{fmtNum(r.unitsT1)}</td>
                <td className="px-3 py-2">{fmtNum(r.units7d, 2)}</td>
                <td className="px-3 py-2">{fmtNum(r.units)}</td>
                <td className="px-3 py-2">{fmtNum(r.reviewedTasks)}</td>
                <td className="px-3 py-2">{r.hours === null ? "—" : fmtHours(r.hours)}</td>
                <td className="px-3 py-2">{r.hoursPerPass === null ? "—" : r.hoursPerPass.toFixed(2)}</td>
                <td className="px-3 py-2">{r.hoursPerReviewedTask === null ? "—" : r.hoursPerReviewedTask.toFixed(2)}</td>
                <td className="px-3 py-2">{r.passesPerTask === null ? "—" : r.passesPerTask.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-700">
              <td className="px-3 py-2">Total ({filtered.length})</td>
              <td className="px-3 py-2">{fmtNum(totals.unitsT1)}</td>
              <td className="px-3 py-2">—</td>
              <td className="px-3 py-2">{fmtNum(totals.units)}</td>
              <td className="px-3 py-2">{fmtNum(totals.reviewedTasks)}</td>
              <td className="px-3 py-2">{fmtHours(totals.hours)}</td>
              <td className="px-3 py-2">{totals.units > 0 ? (totals.hours / totals.units).toFixed(2) : "—"}</td>
              <td className="px-3 py-2">{totals.reviewedTasks > 0 ? (totals.hours / totals.reviewedTasks).toFixed(2) : "—"}</td>
              <td className="px-3 py-2">{totals.reviewedTasks > 0 ? (totals.units / totals.reviewedTasks).toFixed(2) : "—"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <Pager page={page} setPage={setPage} total={filtered.length} />
    </div>
  );
}

export function RosterTable({ rows }: { rows: RosterRow[] }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const filtered = useMemo(
    () => rows.filter((r) => `${r.name} ${r.email ?? ""}`.toLowerCase().includes(q.toLowerCase())),
    [rows, q],
  );
  const { sorted, key, dir, toggle } = useSort(filtered, "hours");
  const view = sorted.slice(page * PAGE, page * PAGE + PAGE);
  if (rows.length === 0) return <div className="p-6 text-sm text-slate-400">No data available for the selected filters.</div>;
  return (
    <div>
      <div className="flex items-center justify-between px-3 py-2">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(0); }} />
        <span className="text-xs text-slate-400">{filtered.length} experts</span>
      </div>
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr>
              <Th onClick={() => toggle("name")} active={key === "name"} dir={dir}>Expert</Th>
              <Th>Email</Th>
              <Th onClick={() => toggle("hours")} active={key === "hours"} dir={dir}>Hours Logged</Th>
              <Th onClick={() => toggle("payable")} active={key === "payable"} dir={dir}>Payable Amount</Th>
              <Th onClick={() => toggle("lastActive")} active={key === "lastActive"} dir={dir}>Last Activity</Th>
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={`${r.name}-${r.email}`} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-700">{r.name}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-500">{r.email ?? "—"}</td>
                <td className="px-3 py-2">{fmtHours(r.hours)}</td>
                <td className="px-3 py-2">{r.payable === null ? <span className="text-slate-400">No rate on file</span> : fmtMoney(r.payable)}</td>
                <td className="whitespace-nowrap px-3 py-2">{r.lastActive ? fmtDayLong(r.lastActive) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} setPage={setPage} total={filtered.length} />
    </div>
  );
}

// ---------- Performance Summary (Section 1) ----------

function winCells(w: WindowValues, fmt: (n: number | null) => string) {
  return [w.today, w.t1, w.avg3, w.avg7, w.total].map((v, i) => (
    <td key={i} className="px-3 py-2 text-right tabular-nums">{fmt(v)}</td>
  ));
}

export function PerfSummaryTable({ perf }: { perf: PerfSummary }) {
  const h1 = (n: number | null) => (n === null ? "—" : fmtNum(n, 1));
  const dp2 = (n: number | null) => (n === null ? "—" : n.toFixed(2));
  const groups: { label: string; rows: { name: string; w: WindowValues; fmt: (n: number | null) => string }[]; ratio?: boolean }[] = [
    {
      label: "Hours",
      rows: [
        { name: "Total Hours", w: perf.totalHours, fmt: h1 },
        { name: "Writer Hours", w: perf.writerHours, fmt: h1 },
        { name: "Reviewer Hours", w: perf.reviewerHours, fmt: h1 },
      ],
    },
    {
      label: "Throughput",
      rows: [
        { name: "Tasks Written", w: perf.tasksWritten, fmt: h1 },
        { name: "Tasks Reviewed", w: perf.tasksReviewed, fmt: h1 },
        { name: "Tasks Approved", w: perf.tasksApproved, fmt: h1 },
      ],
    },
    {
      label: "Efficiency",
      ratio: true,
      rows: [
        { name: "Total Hours per Approved Task", w: perf.hoursPerApproved, fmt: dp2 },
        { name: "Writer Hours per Task", w: perf.writerHoursPerTask, fmt: dp2 },
        { name: "Review Hours per Task", w: perf.reviewHoursPerTask, fmt: dp2 },
      ],
    },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr>
            <Th>Metric</Th>
            <Th>Today (partial)</Th>
            <Th>Yesterday</Th>
            <Th>Avg/day · 3d</Th>
            <Th>Avg/day · 7d</Th>
            <Th>All time / range</Th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            [
              <tr key={g.label} className="border-t border-slate-200 bg-slate-50/60">
                <td colSpan={6} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {g.label}
                  {g.ratio ? <span className="ml-2 normal-case font-normal">window ratio (summed hours ÷ summed tasks), not a per-day average — 3-day / 7-day columns</span> : null}
                </td>
              </tr>,
              ...g.rows.map((r) => (
                <tr key={r.name} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-700">{r.name}</td>
                  {winCells(r.w, r.fmt)}
                </tr>
              )),
            ]
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Pipeline by domain (Section 2) ----------

export function PipelineDomainTable({ rows }: { rows: PipelineDomainRow[] }) {
  const overall = useMemo(() => {
    const o = { pending: 0, awaitingReview: 0, inReview: 0, qa: 0, openWork: 0, approved: 0 };
    for (const r of rows) {
      o.pending += r.pending;
      o.awaitingReview += r.awaitingReview;
      o.inReview += r.inReview;
      o.qa += r.qa;
      o.openWork += r.openWork;
      o.approved += r.approved;
    }
    return o;
  }, [rows]);
  if (rows.length === 0) return <div className="p-6 text-sm text-slate-400">No tasks in this range. Try a wider date range.</div>;
  const cells = (r: { pending: number; awaitingReview: number; inReview: number; qa: number; openWork: number; approved: number }, pct: number | null) => (
    <>
      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.pending)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.awaitingReview)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.inReview)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.qa)}</td>
      <td className="border-r border-slate-200 px-3 py-2 text-right font-semibold tabular-nums">{fmtNum(r.openWork)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.approved)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{pct === null ? "—" : fmtPct(pct)}</td>
    </>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr>
            <Th>Domain</Th>
            <Th>Pending</Th>
            <Th>Awaiting Review</Th>
            <Th>In Review</Th>
            <Th>QA</Th>
            <Th>Open Work</Th>
            <Th>Approved</Th>
            <Th>% of Open Work</Th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t-2 border-b border-slate-300 bg-slate-50 font-semibold text-slate-800">
            <td className="px-3 py-2">Overall</td>
            {cells(overall, overall.openWork > 0 ? 1 : null)}
          </tr>
          {rows.map((r) => (
            <tr key={r.domain} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-700">{r.domain}</td>
              {cells(r, r.pctOfOpenWork)}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 text-[11px] text-slate-400">
        Open Work = Pending + Awaiting Review + In Review + QA. Approved is cumulative completed work and is kept out of the open-work total.
      </p>
    </div>
  );
}

// ---------- Domain Scorecard (Section 6) ----------

function Bar({ pct }: { pct: number | null }) {
  return (
    <div className="relative min-w-[90px]">
      <div className="absolute inset-y-1 left-0 rounded bg-amber-100" style={{ width: `${Math.min(100, (pct ?? 0) * 100)}%` }} />
      <span className="relative px-1 tabular-nums">{pct === null ? "—" : fmtPct(pct)}</span>
    </div>
  );
}

export function DomainScorecard({ rows, drills }: { rows: DomainRow[]; drills: DomainDrill[] }) {
  const { sorted, key, dir, toggle } = useSort(rows, "approved");
  const [open, setOpen] = useState<string | null>(null);
  const overall = useMemo(() => {
    const o = { approved: 0, written: 0, reviewed: 0, writerHours: 0, reviewerHours: 0, totalHours: 0, oneShotNum: 0, oneShotDen: 0 };
    for (const r of rows) {
      o.approved += r.approved;
      o.written += r.written;
      o.reviewed += r.reviewed;
      o.writerHours += r.writerHours;
      o.reviewerHours += r.reviewerHours;
      o.totalHours += r.totalHours;
      if (r.oneShot !== null) {
        o.oneShotNum += r.oneShot * r.approved;
        o.oneShotDen += r.approved;
      }
    }
    return o;
  }, [rows]);
  if (rows.length === 0) return <div className="p-6 text-sm text-slate-400">No tasks in this range. Try a wider date range.</div>;
  const drill = open !== null ? drills.find((d) => d.domain === open) : undefined;
  const dp2 = (n: number | null) => (n === null ? "—" : n.toFixed(2));
  const h1 = (n: number | null) => (n === null ? "—" : fmtNum(n, 1));
  const pc = (n: number | null) => fmtPct(n);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-sm">
          <thead>
            <tr>
              <Th onClick={() => toggle("domain")} active={key === "domain"} dir={dir}>Domain</Th>
              <Th onClick={() => toggle("approved")} active={key === "approved"} dir={dir}>Approved</Th>
              <Th onClick={() => toggle("written")} active={key === "written"} dir={dir}>Written</Th>
              <Th onClick={() => toggle("reviewed")} active={key === "reviewed"} dir={dir}>Reviewed</Th>
              <Th onClick={() => toggle("totalHours")} active={key === "totalHours"} dir={dir}>Total Hours</Th>
              <Th onClick={() => toggle("overallAht")} active={key === "overallAht"} dir={dir}>Total Hours per Approved Task</Th>
              <Th onClick={() => toggle("oneShot")} active={key === "oneShot"} dir={dir}>Clean Pass %</Th>
              <Th onClick={() => toggle("pctOfApproved")} active={key === "pctOfApproved"} dir={dir}>% of Approved</Th>
              <Th onClick={() => toggle("pctOfHours")} active={key === "pctOfHours"} dir={dir}>% of Hours</Th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t-2 border-b border-slate-300 bg-slate-50 font-semibold text-slate-800">
              <td className="px-3 py-2">Overall</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtNum(overall.approved)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtNum(overall.written)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtNum(overall.reviewed)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtNum(overall.totalHours, 1)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{overall.approved > 0 ? (overall.totalHours / overall.approved).toFixed(2) : "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{overall.oneShotDen > 0 ? fmtPct(overall.oneShotNum / overall.oneShotDen) : "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">100%</td>
              <td className="px-3 py-2 text-right tabular-nums">100%</td>
            </tr>
            {sorted.map((r) => (
              <tr
                key={r.domain}
                onClick={() => setOpen(open === r.domain ? null : r.domain)}
                className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${open === r.domain ? "bg-amber-50/60" : ""}`}
              >
                <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-700">
                  <span className="mr-1 text-slate-400">{open === r.domain ? "▾" : "▸"}</span>
                  {r.domain}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.approved)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.written)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.reviewed)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.totalHours, 1)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{dp2(r.overallAht)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{pc(r.oneShot)}</td>
                <td className="px-3 py-2 text-right"><Bar pct={r.pctOfApproved} /></td>
                <td className="px-3 py-2 text-right"><Bar pct={r.pctOfHours} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-3 py-2 text-[11px] text-slate-400">
        Overall row recomputed from summed numerators and denominators — never averaged across domains. Domain hours are allocated by joining
        each person&apos;s recorded hours to their Studio activity per day. Click a domain row for the window drill-down.
      </p>
      {drill ? (
        <div className="mx-3 mb-3 rounded-xl border border-amber-200 bg-white">
          <h4 className="px-3 pt-2 text-sm font-semibold text-slate-700">{drill.domain} — by window</h4>
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr>
                <Th>Metric</Th>
                <Th>Today (partial)</Th>
                <Th>Yesterday</Th>
                <Th>Avg/day · 3d</Th>
                <Th>Avg/day · 7d</Th>
                <Th>All time / range</Th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["Approved Tasks", drill.approved, h1],
                  ["Tasks Written", drill.written, h1],
                  ["Tasks Reviewed", drill.reviewed, h1],
                  ["Writer Hours", drill.writerHours, h1],
                  ["Reviewer Hours", drill.reviewerHours, h1],
                  ["Total Hours", drill.totalHours, h1],
                  ["Writer Hours per Task", drill.writerAht, dp2],
                  ["Review Hours per Task", drill.reviewerAht, dp2],
                  ["Total Hours per Approved Task", drill.overallAht, dp2],
                  ["Clean Pass Rate", drill.oneShot, pc],
                ] as [string, WindowValues, (n: number | null) => string][]
              ).map(([name, w, fmt]) => (
                <tr key={name} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-700">{name}</td>
                  {winCells(w, fmt)}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-[11px] text-slate-400">
            Efficiency and rate rows are window ratios (summed numerator ÷ summed denominator), so the 3d / 7d columns are the window figure, not a per-day average.
          </p>
        </div>
      ) : null}
    </div>
  );
}
