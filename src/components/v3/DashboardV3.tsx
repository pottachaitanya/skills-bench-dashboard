"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DashboardV3Data, TriValue } from "@/lib/typesV3";
import { HoursChart, PipelineChart, SpendChart, ThroughputChart, UnitsChart } from "./ChartsV3";
import { DomainScorecard, PerfSummaryTable, PipelineDomainTable, ReviewerTable, RosterTable, WriterTable } from "./TablesV3";
import { fmtDayLong, fmtHours, fmtMoney, fmtNum, fmtPct } from "./formatV3";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "pipeline", label: "Pipeline" },
  { id: "experts", label: "Experts" },
  { id: "quality", label: "Quality" },
  { id: "cost", label: "Cost" },
  { id: "domains", label: "Domains" },
];

type Preset = "7d" | "30d" | "mtd" | "all" | "custom";

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function laToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
}

function rangeDays(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;
}

function Tip({ text }: { text: string }) {
  return (
    <span className="group relative ml-1 inline-block cursor-help align-middle">
      <span className="text-[10px] text-slate-400">ⓘ</span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-64 -translate-x-1/2 rounded-lg bg-slate-800 p-2 text-xs font-normal normal-case text-white shadow-lg group-hover:block">
        {text}
      </span>
    </span>
  );
}

function KpiCard({ title, tip, value, fmt }: { title: string; tip: string; value: TriValue; fmt: (n: number | null) => string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
        <Tip text={tip} />
      </div>
      <div className="mt-2 text-3xl font-bold text-slate-800">{fmt(value.total)}</div>
      <div className="mt-2 flex gap-4 text-xs text-slate-500">
        <span>
          Yesterday: <span className="font-semibold text-slate-700">{fmt(value.t1)}</span>
        </span>
        <span>
          7-day average: <span className="font-semibold text-slate-700">{fmt(value.avg7)}</span>
        </span>
      </div>
      <div className="mt-1 text-[10px] text-slate-400">Total (selected range)</div>
    </div>
  );
}

function Card({ title, tip, children }: { title: string; tip?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 px-1 text-sm font-semibold text-slate-700">
        {title}
        {tip ? <Tip text={tip} /> : null}
      </h3>
      {children}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <div className="h-16 animate-pulse rounded-2xl bg-slate-200" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-72 animate-pulse rounded-2xl bg-slate-200" />
      ))}
    </div>
  );
}

export default function DashboardV3() {
  const t1 = useMemo(() => addDays(laToday(), -1), []);
  const [preset, setPreset] = useState<Preset>("all");
  const [start, setStart] = useState<string>("2026-06-12");
  const [end, setEnd] = useState<string>(t1);
  const [data, setData] = useState<DashboardV3Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contribTab, setContribTab] = useState<"writer" | "reviewer">("writer");
  const [qualityWin, setQualityWin] = useState<"d3" | "d7" | "total">("total");
  const [activeSection, setActiveSection] = useState("overview");

  // hydrate from URL
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const s = p.get("start");
    const e = p.get("end");
    const pr = p.get("preset") as Preset | null;
    if (s) setStart(s);
    if (e) setEnd(e > t1 ? t1 : e);
    if (pr && ["7d", "30d", "mtd", "all", "custom"].includes(pr)) setPreset(pr);
  }, [t1]);

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p === "7d") {
      setStart(addDays(t1, -6));
      setEnd(t1);
    } else if (p === "30d") {
      setStart(addDays(t1, -29));
      setEnd(t1);
    } else if (p === "mtd") {
      setStart(`${t1.slice(0, 7)}-01`);
      setEnd(t1);
    } else if (p === "all") {
      setStart("2026-06-12");
      setEnd(t1);
    }
  };

  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ start, end });
        if (refresh) qs.set("refresh", "1");
        const res = await fetch(`/api/dashboard/v3?${qs.toString()}`, { cache: "no-store" });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `Request failed (${res.status})`);
        }
        setData((await res.json()) as DashboardV3Data);
        const url = new URL(window.location.href);
        url.searchParams.set("start", start);
        url.searchParams.set("end", end);
        url.searchParams.set("preset", preset);
        window.history.replaceState(null, "", url.toString());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    [start, end, preset],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // scroll-spy
  useEffect(() => {
    const onScroll = () => {
      let current = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top < 140) current = s.id;
      }
      setActiveSection(current);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (loading && !data) return <Skeleton />;

  if (error && !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-sm text-slate-500">Failed to load analytics: {error}</p>
        <button onClick={() => void load()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
          Retry
        </button>
      </div>
    );
  }
  if (!data) return null;

  const q = data.quality[qualityWin];
  const rework = q.oneShot !== null ? 1 - q.oneShot : null;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      {/* Sticky top nav + date filter */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
          <div>
            <h1 className="text-base font-bold">Skills Bench — Ops Dashboard</h1>
            <p className="text-[11px] text-slate-400">
              {fmtDayLong(data.meta.rangeStart)} – {fmtDayLong(data.meta.rangeEnd)}, {rangeDays(data.meta.rangeStart, data.meta.rangeEnd)} days ·
              tz {data.meta.timezone} · today excluded (ends T-1) · snapshot {new Date(data.meta.fetchedAt).toLocaleString()}
            </p>
          </div>
          <nav className="flex gap-1 text-sm">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`rounded-full px-3 py-1 ${activeSection === s.id ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}
              >
                {s.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
            {(["7d", "30d", "mtd", "all"] as Preset[]).map((p) => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                className={`rounded-full px-2.5 py-1 ${preset === p ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
              >
                {p === "7d" ? "Last 7d" : p === "30d" ? "Last 30d" : p === "mtd" ? "MTD" : "All time"}
              </button>
            ))}
            <input
              type="date"
              value={start}
              max={end}
              onChange={(e) => {
                setPreset("custom");
                setStart(e.target.value);
              }}
              className="rounded-lg border border-slate-200 px-2 py-1"
            />
            <span className="text-slate-400">→</span>
            <input
              type="date"
              value={end}
              min={start}
              max={t1}
              onChange={(e) => {
                setPreset("custom");
                setEnd(e.target.value > t1 ? t1 : e.target.value);
              }}
              className="rounded-lg border border-slate-200 px-2 py-1"
            />
            <button
              onClick={() => void load(true)}
              disabled={loading}
              title="Re-pull data and re-render every section"
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-500 disabled:opacity-60"
            >
              <span className={loading ? "animate-spin" : ""}>⟳</span> Refresh data
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-6">
        {error ? <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">Refresh failed: {error}</div> : null}

        {/* Section 1 — Overview */}
        <section id="overview" className="scroll-mt-28 space-y-4">
          <h2 className="text-lg font-bold">Overview</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <KpiCard
              title="Hours Logged"
              tip="Writer + reviewer hours recorded in the Skillsbench - Task and Task Review-SkillsBench timers (Mercor MCP), within the selected range."
              value={data.kpis.hours}
              fmt={(n) => (n === null ? "—" : `${fmtHours(n)} h`)}
            />
            <KpiCard
              title="Total Hours per Approved Task"
              tip="Writer + reviewer hours ÷ Tasks Approved (weighted ×0.5). Per weighted (with-skill/without-skill pair) task — roughly double the raw per-row figure by design. Writer and reviewer hours-per-task use different denominators, so they are not meant to sum to this figure."
              value={data.kpis.ahtApproved}
              fmt={(n) => (n === null ? "—" : `${n.toFixed(2)} h`)}
            />
            <KpiCard
              title="Clean Pass Rate"
              tip="Approved tasks with zero backward transitions across their entire lifecycle ÷ all approved tasks (one-shot rate). The 0.5 weighting cancels out."
              value={data.kpis.oneShotRate}
              fmt={(n) => fmtPct(n)}
            />
          </div>
          <Card
            title="Performance Summary"
            tip="Today is a partial day and never feeds an average or rolling series. Hours and throughput rows are per-day rates; efficiency rows are window ratios (summed hours ÷ summed tasks)."
          >
            <PerfSummaryTable perf={data.perfSummary} />
          </Card>
          <Card title="Throughput — Tasks Written & Approved" tip="Daily value plus trailing 7-day average; complete LA days only, ending yesterday. Counts weighted ×0.5.">
            <ThroughputChart data={data.daily} />
          </Card>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card title="Submissions & Review Passes" tip="Submissions = transitions into Awaiting Review (resubmissions count again). Review Passes = transitions into In Review. Weighted ×0.5.">
              <UnitsChart data={data.daily} />
            </Card>
            <Card title="Hours Logged" tip="Actual recorded hours (not weighted).">
              <HoursChart data={data.daily} />
            </Card>
          </div>
        </section>

        {/* Section 2 — Pipeline */}
        <section id="pipeline" className="scroll-mt-28 space-y-4">
          <h2 className="text-lg font-bold">Pipeline</h2>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <Card
                title={`Stage Snapshot — as of ${fmtDayLong(data.pipeline.asOf)}`}
                tip="Each task's stage at the end of the selected range (latest transition on or before that date), weighted ×0.5. Not a time series."
              >
                <PipelineChart stages={data.pipeline.stages} />
              </Card>
            </div>
            <div className="space-y-4">
              <Card title="Range Totals" tip="All counts weighted ×0.5. Total (selected range).">
                <dl className="space-y-2 px-1 text-sm">
                  {[
                    ["Tasks Written", fmtNum(data.writerTotals.submitted), "Unique tasks with ≥1 transition into Awaiting Review"],
                    ["Submissions", fmtNum(data.writerTotals.writerUnits), "Transitions into Awaiting Review, resubmissions count again"],
                    ["Tasks Reviewed", fmtNum(data.writerTotals.reviewedTasks), "Unique tasks with ≥1 transition into In Review"],
                    ["Review Passes", fmtNum(data.writerTotals.reviewUnits), "Transitions into In Review"],
                    ["Tasks Approved", fmtNum(data.writerTotals.approved), "Unique tasks whose latest version is Approved"],
                    ["Approval Rate", fmtPct(data.writerTotals.passRate), "Tasks Approved ÷ Tasks Reviewed"],
                    ["Send-back Rate", fmtPct(data.writerTotals.sendBackRate), "Tasks sent back from review ÷ Tasks Reviewed. Approval Rate + Send-back Rate can exceed 100% — a task can be sent back once and approved later."],
                  ].map(([label, value, tip]) => (
                    <div key={label} className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <dt className="text-slate-500">
                        {label}
                        <Tip text={tip} />
                      </dt>
                      <dd className="font-semibold">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </div>
          </div>
          <Card
            title={`Pipeline by Domain — as of ${fmtDayLong(data.pipeline.asOf)}`}
            tip="Rows sorted by Open Work descending — the domain with the most work in flight is on top. Counts weighted ×0.5."
          >
            <PipelineDomainTable rows={data.pipelineDomains} />
          </Card>
        </section>

        {/* Section 3 — Experts */}
        <section id="experts" className="scroll-mt-28 space-y-4">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold">Experts</h2>
            <div className="flex rounded-full bg-slate-200 p-0.5 text-sm">
              {(["writer", "reviewer"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setContribTab(t)}
                  className={`rounded-full px-4 py-1 capitalize ${contribTab === t ? "bg-white font-semibold shadow" : "text-slate-500"}`}
                >
                  {t}s
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            {contribTab === "writer" ? <WriterTable rows={data.writers} /> : <ReviewerTable rows={data.reviewers} />}
          </div>
          {data.meta.unmatchedActors.length > 0 ? (
            <details className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
              <summary className="cursor-pointer">
                {data.meta.unmatchedActors.length} Studio contributor names could not be matched to a Mercor timer identity — their hours/AHT show “—” rather than being dropped.
              </summary>
              <p className="mt-2">{data.meta.unmatchedActors.join(", ")}</p>
            </details>
          ) : null}
        </section>

        {/* Section 4 — Quality */}
        <section id="quality" className="scroll-mt-28 space-y-4">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold">Quality</h2>
            <div className="flex rounded-full bg-slate-200 p-0.5 text-xs">
              {(
                [
                  ["d3", "3 days"],
                  ["d7", "7 days"],
                  ["total", "All time"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setQualityWin(k)}
                  className={`rounded-full px-3 py-1 ${qualityWin === k ? "bg-white font-semibold shadow" : "text-slate-500"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Clean Pass Rate
                <Tip text="Approved tasks whose path had zero backward transitions across the entire lifecycle ÷ all approved tasks in the window (one-shot rate)." />
              </div>
              <div className="mt-2 text-3xl font-bold text-emerald-600">{fmtPct(q.oneShot)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Rework Rate
                <Tip text="Derived complement: 1 − Clean Pass Rate (same denominator) — the two can never disagree." />
              </div>
              <div className="mt-2 text-3xl font-bold text-rose-500">{fmtPct(rework)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Approved Tasks in Window</div>
              <div className="mt-2 text-3xl font-bold text-slate-800">{fmtNum(q.approved)}</div>
              <div className="mt-1 text-[10px] text-slate-400">weighted ×0.5</div>
            </div>
          </div>
          {q.oneShot !== null ? (
            <div className="overflow-hidden rounded-full border border-slate-200 bg-white">
              <div className="flex h-6 text-[10px] font-semibold text-white">
                <div className="flex items-center justify-center bg-emerald-500" style={{ width: `${q.oneShot * 100}%` }}>
                  {fmtPct(q.oneShot)}
                </div>
                <div className="flex items-center justify-center bg-rose-400" style={{ width: `${(1 - q.oneShot) * 100}%` }}>
                  {fmtPct(rework)}
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {/* Section 5 — Cost & Roster */}
        <section id="cost" className="scroll-mt-28 space-y-4">
          <h2 className="text-lg font-bold">Cost & Roster</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Payable to Experts
                <Tip text="Actual payable amounts from Mercor MCP for the two SkillsBench timers, within the selected range. Bonus and non-SkillsBench-timer payouts are excluded and reported separately below." />
              </div>
              <div className="mt-2 text-3xl font-bold text-slate-800">{fmtMoney(data.spendKpis.payable)}</div>
              <div className="mt-1 text-[10px] text-slate-400">Total (selected range)</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payable (7 days)</div>
              <div className="mt-2 text-3xl font-bold text-slate-800">{fmtMoney(data.spendKpis.payable7d)}</div>
              <div className="mt-1 text-[10px] text-slate-400">last 7 complete days</div>
            </div>
          </div>
          <Card title="Daily Payable Spend" tip="Daily payable plus trailing 7-day average.">
            <SpendChart data={data.daily} />
          </Card>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <h3 className="px-4 pt-3 text-sm font-semibold text-slate-700">Expert Roster</h3>
            <RosterTable rows={data.roster} />
          </div>
          <p className="text-xs text-slate-400">
            {fmtMoney(data.meta.otherPayable)} of additional project payouts fall outside the two SkillsBench timers (bonuses, pilot and precursor
            timers) and are excluded from the Payable figures above.
          </p>
        </section>

        {/* Section 6 — Domain Scorecard */}
        <section id="domains" className="scroll-mt-28 space-y-4">
          <h2 className="text-lg font-bold">Domain Scorecard</h2>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <DomainScorecard rows={data.domains} drills={data.domainDrills} />
          </div>
        </section>
      </main>
    </div>
  );
}
