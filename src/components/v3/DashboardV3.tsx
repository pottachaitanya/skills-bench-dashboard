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
      <span className="text-[10px]" style={{ color: "var(--ink-3)" }}>ⓘ</span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-64 -translate-x-1/2 rounded p-2 text-xs font-normal normal-case tracking-normal group-hover:block"
        style={{ background: "var(--navy)", color: "var(--ink-inv)" }}>
        {text}
      </span>
    </span>
  );
}

function KpiCard({ title, tip, value, fmt }: { title: string; tip: string; value: TriValue; fmt: (n: number | null) => string }) {
  return (
    <div className="card kpi">
      <span className="label">
        {title}
        <Tip text={tip} />
      </span>
      <div className="kpi-value">
        <span className="num num--kpi">{fmt(value.total)}</span>
      </div>
      <div className="kpi-meta">
        <div className="kpi-meta-item">
          <span className="label">Yesterday</span>
          <span className="num">{fmt(value.t1)}</span>
        </div>
        <div className="kpi-meta-item">
          <span className="label">7-day average</span>
          <span className="num">{fmt(value.avg7)}</span>
        </div>
        <div className="kpi-meta-item">
          <span className="label">Total (selected range)</span>
          <span className="num num--muted">{fmt(value.total)}</span>
        </div>
      </div>
    </div>
  );
}

function Card({ title, tip, children }: { title: string; tip?: string; children: React.ReactNode }) {
  return (
    <div className="card card-pad">
      <h3 className="mb-3 text-base font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
        {title}
        {tip ? <Tip text={tip} /> : null}
      </h3>
      {children}
    </div>
  );
}

function SectionHead({ n, title, sub }: { n: string; title: string; sub?: string }) {
  return (
    <div className="section-head">
      <span className="eyebrow">{n}</span>
      <h2 className="section-title">{title}</h2>
      {sub ? <p className="section-sub">{sub}</p> : null}
    </div>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="tablist">
      {options.map(([k, label]) => (
        <button key={k} role="tab" aria-selected={value === k} onClick={() => onChange(k)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="wrap space-y-4 py-6">
      <div className="skeleton" style={{ height: 64 }} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton" style={{ height: 128 }} />
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton" style={{ height: 288 }} />
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
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>Couldn&apos;t reach the analytics backend. Retry, or check the connection. ({error})</p>
        <button onClick={() => void load()} className="btn">
          Retry
        </button>
      </div>
    );
  }
  if (!data) return null;

  const q = data.quality[qualityWin];
  const rework = q.oneShot !== null ? 1 - q.oneShot : null;

  return (
    <div className="min-h-screen">
      {/* Sticky top nav + date filter */}
      <header className="nav flex-wrap" style={{ height: "auto", minHeight: "var(--nav-h)", paddingTop: 8, paddingBottom: 8 }}>
        <nav className="nav-links">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              aria-current={activeSection === s.id}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" });
              }}
              className="nav-link"
            >
              {s.label}
            </a>
          ))}
        </nav>
        <span className="scope hidden lg:inline">
          {fmtDayLong(data.meta.rangeStart)} – {fmtDayLong(data.meta.rangeEnd)}, {rangeDays(data.meta.rangeStart, data.meta.rangeEnd)} days
        </span>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="seg" role="tablist">
            {(["7d", "30d", "mtd", "all"] as Preset[]).map((p) => (
              <button key={p} role="tab" aria-selected={preset === p} onClick={() => applyPreset(p)}>
                {p === "7d" ? "Last 7d" : p === "30d" ? "Last 30d" : p === "mtd" ? "Month to date" : "All time"}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={start}
            max={end}
            onChange={(e) => {
              setPreset("custom");
              setStart(e.target.value);
            }}
            className="btn"
          />
          <span style={{ color: "var(--ink-3)" }}>→</span>
          <input
            type="date"
            value={end}
            min={start}
            max={t1}
            onChange={(e) => {
              setPreset("custom");
              setEnd(e.target.value > t1 ? t1 : e.target.value);
            }}
            className="btn"
          />
          <button onClick={() => void load(true)} disabled={loading} aria-busy={loading} title="Re-pulls all Studio and Mercor data for the selected range" className="btn">
            <span className={loading ? "animate-spin" : ""}>⟳</span> Refresh data
          </button>
        </div>
      </header>

      <div className="wrap" style={{ paddingTop: "var(--s5)" }}>
        {/* Hero band */}
        <div className="hero">
          <span className="label">Studio Project — Ops Dashboard</span>
          <h1 className="hero-title">Skills Bench</h1>
          <p className="hero-sub">
            Throughput, quality, per-person efficiency, and spend · {fmtDayLong(data.meta.rangeStart)} – {fmtDayLong(data.meta.rangeEnd)} ·
            tz {data.meta.timezone} · complete days end yesterday · last updated {new Date(data.meta.fetchedAt).toLocaleString()}
          </p>
        </div>
      </div>

      <main className="wrap">
        {error ? <div className="note note--flag card card-pad my-4">Couldn&apos;t refresh: {error}. Retry, or check the connection.</div> : null}

        {/* Section 1 — Overview */}
        <section id="overview" className="section space-y-4">
          <SectionHead n="01" title="Overview" />
          <div className="kpi-grid">
            <KpiCard
              title="Hours Logged"
              tip="Writer + reviewer hours recorded in the Skillsbench - Task and Task Review-SkillsBench timers (Mercor MCP), within the selected range."
              value={data.kpis.hours}
              fmt={(n) => (n === null ? "—" : fmtHours(n))}
            />
            <KpiCard
              title="Total Hours per Approved Task"
              tip="Writer + reviewer hours ÷ Tasks Approved (weighted ×0.5). Per weighted (with-skill/without-skill pair) task — roughly double the raw per-row figure by design."
              value={data.kpis.ahtApproved}
              fmt={(n) => (n === null ? "—" : n.toFixed(2))}
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
        <section id="pipeline" className="section space-y-4">
          <SectionHead n="02" title="Pipeline" sub={`Where work currently sits, as of ${fmtDayLong(data.pipeline.asOf)} (each task's stage from its latest transition on or before that date).`} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <Card
                title={`Stage Snapshot — as of ${fmtDayLong(data.pipeline.asOf)}`}
                tip="Each task's stage at the end of the selected range, weighted ×0.5. Not a time series."
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
                    <div key={label} className="flex items-center justify-between border-b pb-1.5" style={{ borderColor: "var(--rule)" }}>
                      <dt style={{ color: "var(--ink-2)" }}>
                        {label}
                        <Tip text={tip} />
                      </dt>
                      <dd className="num">{value}</dd>
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
        <section id="experts" className="section space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHead n="03" title="Experts" />
            <Seg
              value={contribTab}
              options={[
                ["writer", "Writers"],
                ["reviewer", "Reviewers"],
              ]}
              onChange={setContribTab}
            />
          </div>
          <div className="table-shell">
            {contribTab === "writer" ? <WriterTable rows={data.writers} /> : <ReviewerTable rows={data.reviewers} />}
          </div>
          {data.meta.unmatchedActors.length > 0 ? (
            <details className="card card-pad note">
              <summary className="cursor-pointer">
                {data.meta.unmatchedActors.length} Studio contributor names could not be matched to a Mercor timer identity — their hours show “—” rather than being dropped.
              </summary>
              <p className="mt-2">{data.meta.unmatchedActors.join(", ")}</p>
            </details>
          ) : null}
        </section>

        {/* Section 4 — Quality */}
        <section id="quality" className="section space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHead n="04" title="Quality" />
            <Seg
              value={qualityWin}
              options={[
                ["d3", "3 days"],
                ["d7", "7 days"],
                ["total", "All time"],
              ]}
              onChange={setQualityWin}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="card kpi">
              <span className="label">
                Clean Pass Rate
                <Tip text="Approved tasks whose path had zero backward transitions across the entire lifecycle ÷ all approved tasks in the window (one-shot rate)." />
              </span>
              <div className="kpi-value">
                <span className="num num--kpi" style={{ color: "var(--pass)" }}>{fmtPct(q.oneShot)}</span>
              </div>
            </div>
            <div className="card kpi">
              <span className="label">
                Rework Rate
                <Tip text="Derived complement: 1 − Clean Pass Rate (same denominator) — the two can never disagree." />
              </span>
              <div className="kpi-value">
                <span className="num num--kpi" style={{ color: "var(--flag)" }}>{fmtPct(rework)}</span>
              </div>
            </div>
            <div className="card kpi">
              <span className="label">Approved Tasks in Window <Tip text="Weighted ×0.5." /></span>
              <div className="kpi-value">
                <span className="num num--kpi">{fmtNum(q.approved)}</span>
              </div>
            </div>
          </div>
          {q.oneShot !== null ? (
            <div className="card overflow-hidden">
              <div className="flex h-7 text-[11px] font-semibold" style={{ fontFamily: "var(--font-data)", color: "var(--ink-inv)" }}>
                <div className="flex items-center justify-center" style={{ width: `${q.oneShot * 100}%`, background: "var(--pass)" }}>
                  {fmtPct(q.oneShot)}
                </div>
                <div className="flex items-center justify-center" style={{ width: `${(1 - q.oneShot) * 100}%`, background: "var(--flag)" }}>
                  {fmtPct(rework)}
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {/* Section 5 — Cost & Roster */}
        <section id="cost" className="section space-y-4">
          <SectionHead n="05" title="Cost & Roster" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="card kpi">
              <span className="label">
                Payable to Experts
                <Tip text="Every payable amount on the project from Mercor MCP within the selected range: timer-driven hours plus bonus payouts (which carry no timer or hours)." />
              </span>
              <div className="kpi-value">
                <span className="num num--kpi">{fmtMoney(data.spendKpis.payable)}</span>
              </div>
              <div className="note">Total (selected range)</div>
            </div>
            <div className="card kpi">
              <span className="label">Payable (7 days)</span>
              <div className="kpi-value">
                <span className="num num--kpi">{fmtMoney(data.spendKpis.payable7d)}</span>
              </div>
              <div className="note">last 7 complete days</div>
            </div>
          </div>
          <Card title="Daily Payable Spend" tip="Daily payable plus trailing 7-day average.">
            <SpendChart data={data.daily} />
          </Card>
          <div className="table-shell">
            <h3 className="px-4 pt-3 text-base font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>Expert Roster</h3>
            <RosterTable rows={data.roster} />
          </div>
          <p className="note">
            Includes {fmtMoney(data.meta.otherPayable)} of bonus payouts, which carry no timer and no hours, so they do not affect the roster hours or
            effective-rate columns.
          </p>
        </section>

        {/* Section 6 — Domain Scorecard */}
        <section id="domains" className="section space-y-4">
          <SectionHead n="06" title="Domain Scorecard" sub="Compare domains, then click a row to inspect one. Overall ratios are recomputed from summed numerators and denominators, never averaged across domains." />
          <div className="table-shell">
            <DomainScorecard rows={data.domains} drills={data.domainDrills} />
          </div>
        </section>
      </main>
    </div>
  );
}
