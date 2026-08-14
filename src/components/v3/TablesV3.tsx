"use client";

import { useMemo, useState } from "react";
import type { DomainDrill, DomainRow, PerfSummary, PipelineDomainRow, ReviewerRow, RosterRow, WindowValues, WriterRow } from "@/lib/typesV3";
import { fmtDayLong, fmtHours, fmtMoney, fmtNum, fmtPct } from "./formatV3";

const PAGE = 20;

function Th({ children, onClick, active, dir }: { children: React.ReactNode; onClick?: () => void; active?: boolean; dir?: "asc" | "desc" }) {
  return (
    <th
      aria-sort={onClick ? (active ? (dir === "asc" ? "ascending" : "descending") : "none") : undefined}
      onClick={onClick}
    >
      {children}
    </th>
  );
}

function Pager({ page, setPage, total }: { page: number; setPage: (n: number) => void; total: number }) {
  const pages = Math.max(1, Math.ceil(total / PAGE));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 px-3 py-2 text-xs" style={{ color: "var(--ink-3)" }}>
      <button className="btn disabled:opacity-40" disabled={page === 0} onClick={() => setPage(page - 1)}>
        Prev
      </button>
      <span className="num">
        {page + 1} / {pages}
      </span>
      <button className="btn disabled:opacity-40" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
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
      className="btn w-56"
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
  if (rows.length === 0) return <div className="card-pad note">No data available for the selected filters.</div>;
  return (
    <div>
      <div className="flex items-center justify-between px-3 py-2">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(0); }} />
        <span className="note">{filtered.length} writers</span>
      </div>
      <div className="table-scroll max-h-[520px] overflow-auto">
        <table className="data w-full min-w-[980px]">
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
              <tr key={r.name}>
                <td className="whitespace-nowrap">{r.name}</td>
                <td className="num">{fmtNum(r.unitsT1)}</td>
                <td className="num">{fmtNum(r.units7d, 2)}</td>
                <td className="num">{fmtNum(r.units)}</td>
                <td className="num">{fmtNum(r.submitted)}</td>
                <td className="num">{fmtNum(r.approved)}</td>
                <td className="num">{r.hours === null ? "—" : fmtHours(r.hours)}</td>
                <td className="num">{r.ahtApproved === null ? "—" : `${r.ahtApproved.toFixed(2)} h`}</td>
                <td className="num">{r.ahtSubmitted === null ? "—" : `${r.ahtSubmitted.toFixed(2)} h`}</td>
                <td className="num">{fmtPct(r.oneShot)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="row-total">
              <td>Total ({filtered.length})</td>
              <td className="num">{fmtNum(totals.unitsT1)}</td>
              <td className="num">—</td>
              <td className="num">{fmtNum(totals.units)}</td>
              <td className="num">{fmtNum(totals.submitted)}</td>
              <td className="num">{fmtNum(totals.approved)}</td>
              <td className="num">{fmtHours(totals.hours)}</td>
              <td className="num">{totals.approved > 0 ? `${(totals.hours / totals.approved).toFixed(2)} h` : "—"}</td>
              <td className="num">{totals.submitted > 0 ? `${(totals.hours / totals.submitted).toFixed(2)} h` : "—"}</td>
              <td className="num">{totals.oneShotDen > 0 ? fmtPct(totals.oneShotNum / totals.oneShotDen) : "—"}</td>
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
  if (rows.length === 0) return <div className="card-pad note">No data available for the selected filters.</div>;
  return (
    <div>
      <div className="flex items-center justify-between px-3 py-2">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(0); }} />
        <span className="note">{filtered.length} reviewers</span>
      </div>
      <div className="table-scroll max-h-[520px] overflow-auto">
        <table className="data w-full min-w-[980px]">
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
              <tr key={r.name}>
                <td className="whitespace-nowrap">{r.name}</td>
                <td className="num">{fmtNum(r.unitsT1)}</td>
                <td className="num">{fmtNum(r.units7d, 2)}</td>
                <td className="num">{fmtNum(r.units)}</td>
                <td className="num">{fmtNum(r.reviewedTasks)}</td>
                <td className="num">{r.hours === null ? "—" : fmtHours(r.hours)}</td>
                <td className="num">{r.hoursPerPass === null ? "—" : r.hoursPerPass.toFixed(2)}</td>
                <td className="num">{r.hoursPerReviewedTask === null ? "—" : r.hoursPerReviewedTask.toFixed(2)}</td>
                <td className="num">{r.passesPerTask === null ? "—" : r.passesPerTask.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="row-total">
              <td>Total ({filtered.length})</td>
              <td className="num">{fmtNum(totals.unitsT1)}</td>
              <td className="num">—</td>
              <td className="num">{fmtNum(totals.units)}</td>
              <td className="num">{fmtNum(totals.reviewedTasks)}</td>
              <td className="num">{fmtHours(totals.hours)}</td>
              <td className="num">{totals.units > 0 ? (totals.hours / totals.units).toFixed(2) : "—"}</td>
              <td className="num">{totals.reviewedTasks > 0 ? (totals.hours / totals.reviewedTasks).toFixed(2) : "—"}</td>
              <td className="num">{totals.reviewedTasks > 0 ? (totals.units / totals.reviewedTasks).toFixed(2) : "—"}</td>
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
  if (rows.length === 0) return <div className="card-pad note">No data available for the selected filters.</div>;
  return (
    <div>
      <div className="flex items-center justify-between px-3 py-2">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(0); }} />
        <span className="note">{filtered.length} experts</span>
      </div>
      <div className="table-scroll max-h-[520px] overflow-auto">
        <table className="data w-full min-w-[760px]">
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
              <tr key={`${r.name}-${r.email}`}>
                <td className="whitespace-nowrap">{r.name}</td>
                <td className="whitespace-nowrap" style={{ color: "var(--ink-2)" }}>{r.email ?? "—"}</td>
                <td className="num">{fmtHours(r.hours)}</td>
                <td className="num">{r.payable === null ? <span style={{ color: "var(--ink-3)", fontFamily: "var(--font-body)" }}>No rate on file</span> : fmtMoney(r.payable)}</td>
                <td className="num whitespace-nowrap">{r.lastActive ? fmtDayLong(r.lastActive) : "—"}</td>
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
    <td key={i} className={i === 0 ? "num is-partial" : "num"} data-emph={i === 3 ? "" : undefined}>{fmt(v)}</td>
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
    <div className="table-scroll">
      <table className="data w-full min-w-[760px]">
        <thead>
          <tr>
            <Th>Metric</Th>
            <Th>Today *</Th>
            <Th>Yesterday</Th>
            <Th>3-day</Th>
            <Th>7-day</Th>
            <Th>All time / range</Th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            [
              <tr key={g.label} className="group-row">
                <td colSpan={6} className="!text-left">
                  {g.label}
                  {g.ratio
                    ? <span className="ml-2 normal-case font-normal">window ratio (summed hours ÷ summed tasks), not a per-day average</span>
                    : <span className="ml-2 normal-case font-normal">3-day / 7-day columns are per-day averages over complete days</span>}
                </td>
              </tr>,
              ...g.rows.map((r) => (
                <tr key={r.name}>
                  <td className="whitespace-nowrap">{r.name}</td>
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
  if (rows.length === 0) return <div className="card-pad note">No tasks in this range. Try a wider date range.</div>;
  const cells = (r: { pending: number; awaitingReview: number; inReview: number; qa: number; openWork: number; approved: number }, pct: number | null) => (
    <>
      <td className="num">{fmtNum(r.pending)}</td>
      <td className="num">{fmtNum(r.awaitingReview)}</td>
      <td className="num">{fmtNum(r.inReview)}</td>
      <td className="num">{fmtNum(r.qa)}</td>
      <td className="num" data-divider="">{fmtNum(r.openWork)}</td>
      <td className="num">{fmtNum(r.approved)}</td>
      <td className="num">{pct === null ? "—" : fmtPct(pct)}</td>
    </>
  );
  return (
    <div className="table-scroll">
      <table className="data w-full min-w-[820px]">
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
          <tr className="row-overall">
            <td>Overall</td>
            {cells(overall, overall.openWork > 0 ? 1 : null)}
          </tr>
          {rows.map((r) => (
            <tr key={r.domain}>
              <td className="whitespace-nowrap">{r.domain}</td>
              {cells(r, r.pctOfOpenWork)}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note px-3 py-2">
        Open Work = Pending + Awaiting Review + In Review + QA. Approved is cumulative completed work and is kept out of the open-work total.
      </p>
    </div>
  );
}

// ---------- Domain Scorecard (Section 6) ----------

function Bar({ pct }: { pct: number | null }) {
  return (
    <div className="share min-w-[90px]" style={{ "--pct": Math.min(100, (pct ?? 0) * 100) } as React.CSSProperties}>
      <span className="num px-1">{pct === null ? "—" : fmtPct(pct)}</span>
    </div>
  );
}

function SmallMultiple({
  title,
  rows,
  value,
  fmt,
  refValue,
  refLabel,
}: {
  title: string;
  rows: DomainRow[];
  value: (r: DomainRow) => number | null;
  fmt: (n: number) => string;
  refValue?: number | null;
  refLabel?: string;
}) {
  const items = rows
    .map((r) => ({ domain: r.domain, v: value(r) }))
    .filter((x): x is { domain: string; v: number } => x.v !== null)
    .sort((a, b) => b.v - a.v);
  if (items.length === 0) return null;
  const max = Math.max(...items.map((x) => x.v), refValue ?? 0);
  return (
    <div>
      <div className="label mb-2">{title}</div>
      <div className="relative space-y-1">
        {refValue !== null && refValue !== undefined && max > 0 ? (
          <div
            className="absolute bottom-0 top-0 z-10 border-l border-dashed"
            style={{ left: `calc(96px + (100% - 96px - 56px) * ${refValue / max})`, borderColor: "var(--watch)" }}
            title={`${refLabel ?? "Overall"}: ${fmt(refValue)}`}
          />
        ) : null}
        {items.map((x) => (
          <div key={x.domain} className="flex items-center gap-2">
            <span className="w-[88px] shrink-0 truncate text-xs" style={{ color: "var(--ink-2)" }}>{x.domain}</span>
            <div className="h-4 flex-1">
              <div className="h-full rounded-sm" style={{ width: `${max > 0 ? (x.v / max) * 100 : 0}%`, background: "var(--series-daily, #9AA4B8)" }} />
            </div>
            <span className="num w-[52px] shrink-0 text-xs">{fmt(x.v)}</span>
          </div>
        ))}
      </div>
      {refValue !== null && refValue !== undefined ? (
        <div className="note mt-1">{refLabel ?? "Overall"} = {fmt(refValue)} (dashed line)</div>
      ) : null}
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
  if (rows.length === 0) return <div className="card-pad note">No tasks in this range. Try a wider date range.</div>;
  const drill = open !== null ? drills.find((d) => d.domain === open) : undefined;
  const dp2 = (n: number | null) => (n === null ? "—" : n.toFixed(2));
  const h1 = (n: number | null) => (n === null ? "—" : fmtNum(n, 1));
  const pc = (n: number | null) => fmtPct(n);
  return (
    <div>
      <div className="table-scroll">
        <table className="data sticky-col w-full min-w-[1080px]">
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
            <tr className="row-overall">
              <td>Overall</td>
              <td className="num">{fmtNum(overall.approved)}</td>
              <td className="num">{fmtNum(overall.written)}</td>
              <td className="num">{fmtNum(overall.reviewed)}</td>
              <td className="num">{fmtNum(overall.totalHours, 1)}</td>
              <td className="num">{overall.approved > 0 ? (overall.totalHours / overall.approved).toFixed(2) : "—"}</td>
              <td className="num">{overall.oneShotDen > 0 ? fmtPct(overall.oneShotNum / overall.oneShotDen) : "—"}</td>
              <td className="num">100%</td>
              <td className="num">100%</td>
            </tr>
            {sorted.map((r) => (
              <tr
                key={r.domain}
                onClick={() => setOpen(open === r.domain ? null : r.domain)}
                className="cursor-pointer"
                style={open === r.domain ? { background: "var(--accent-soft)" } : undefined}
              >
                <td className="whitespace-nowrap">
                  <span className="mr-1" style={{ color: "var(--ink-3)" }}>{open === r.domain ? "▾" : "▸"}</span>
                  {r.domain}
                </td>
                <td className="num">{fmtNum(r.approved)}</td>
                <td className="num">{fmtNum(r.written)}</td>
                <td className="num">{fmtNum(r.reviewed)}</td>
                <td className="num">{fmtNum(r.totalHours, 1)}</td>
                <td className="num">{dp2(r.overallAht)}</td>
                <td className="num">{pc(r.oneShot)}</td>
                <td className="num"><Bar pct={r.pctOfApproved} /></td>
                <td className="num"><Bar pct={r.pctOfHours} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note px-3 py-2">
        Overall row recomputed from summed numerators and denominators — never averaged across domains. Each expert works one domain: hours are assigned by the
        contractor&apos;s domain tag (Mercor job title, e.g. &quot;Writer Finance&quot;), falling back to where their Studio work happened when no tag exists. Click a domain row for the window drill-down.
      </p>
      <div className="grid grid-cols-1 gap-6 border-t px-4 py-4 md:grid-cols-3" style={{ borderColor: "var(--rule)" }}>
        <SmallMultiple title="Approved (weighted)" rows={rows} value={(r) => r.approved} fmt={(n) => fmtNum(n, 1)} />
        <SmallMultiple title="Total Hours" rows={rows} value={(r) => r.totalHours} fmt={(n) => fmtNum(n, 1)} />
        <SmallMultiple
          title="Total Hours per Approved Task — lower is better"
          rows={rows}
          value={(r) => r.overallAht}
          fmt={(n) => n.toFixed(2)}
          refValue={overall.approved > 0 ? overall.totalHours / overall.approved : null}
          refLabel="Overall"
        />
      </div>
      {drill ? (
        <div className="card mx-3 mb-3 overflow-hidden">
          <h4 className="px-3 pt-2 text-sm font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>{drill.domain} — by window</h4>
          <table className="data w-full min-w-[720px]">
            <thead>
              <tr>
                <Th>Metric</Th>
                <Th>Today *</Th>
                <Th>Yesterday</Th>
                <Th>3-day</Th>
                <Th>7-day</Th>
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
                <tr key={name}>
                  <td className="whitespace-nowrap">{name}</td>
                  {winCells(w, fmt)}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note px-3 py-2">
            Efficiency and rate rows are window ratios (summed numerator ÷ summed denominator), so the 3d / 7d columns are the window figure, not a per-day average.
          </p>
        </div>
      ) : null}
    </div>
  );
}
