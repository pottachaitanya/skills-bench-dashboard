"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardV2Data, KpiValue } from "@/lib/types";
import { CAMPAIGN_NAME, PROJECT_ID } from "@/lib/config";
import { DEFAULT_START } from "@/lib/metricsV2";
import {
  HoursChart,
  OneShotChart,
  PipelineChart,
  ReviewAttemptsChart,
  SpendChart,
  ThroughputChart,
  UnitsChart,
} from "./ChartsV2";
import ContributorTable from "./ContributorTable";
import RosterTable from "./RosterTable";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: DashboardV2Data };

const usd = (v: number | null): string =>
  v === null
    ? "—"
    : v.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      });
const hours = (v: number | null): string =>
  v === null
    ? "—"
    : `${v.toLocaleString("en-US", { maximumFractionDigits: 1 })} h`;
const units = (v: number | null): string =>
  v === null ? "—" : v.toLocaleString("en-US", { maximumFractionDigits: 1 });
const aht = (v: number | null): string =>
  v === null ? "—" : `${v.toFixed(2)} h/unit`;
const pct = (v: number | null): string =>
  v === null ? "—" : `${(v * 100).toFixed(1)}%`;

function Trend({ kpi }: { kpi: KpiValue }) {
  if (kpi.last7 === null || kpi.prev7 === null || kpi.prev7 === 0) return null;
  const delta = (kpi.last7 - kpi.prev7) / kpi.prev7;
  const up = delta >= 0;
  return (
    <span
      className={`text-xs font-medium ${up ? "text-emerald-600" : "text-red-500"}`}
      title="Last 7 days vs previous 7 days"
    >
      {up ? "▲" : "▼"} {Math.abs(delta * 100).toFixed(1)}% vs prev 7d
    </span>
  );
}

function KpiCard({
  label,
  kpi,
  format,
}: {
  label: string;
  kpi: KpiValue;
  format: (v: number | null) => string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
        {format(kpi.value)}
      </p>
      <Trend kpi={kpi} />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-64 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"
          />
        ))}
      </div>
    </div>
  );
}

export default function DashboardV2() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState("");
  const [world, setWorld] = useState("all");
  const [expert, setExpert] = useState("");
  const [email, setEmail] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (
      params: {
        start: string;
        end: string;
        world: string;
        expert: string;
        email: string;
      },
      refresh = false,
    ) => {
      if (refresh) {
        setRefreshing(true);
      } else {
        setState({ kind: "loading" });
      }
      try {
        const query = new URLSearchParams();
        if (params.start) query.set("start", params.start);
        if (params.end) query.set("end", params.end);
        if (params.world !== "all") query.set("world", params.world);
        if (params.expert.trim()) query.set("expert", params.expert.trim());
        if (params.email.trim()) query.set("email", params.email.trim());
        if (refresh) query.set("refresh", "1");
        const res = await fetch(`/api/dashboard/v2?${query.toString()}`);
        const body: unknown = await res.json();
        if (!res.ok) {
          const message =
            typeof body === "object" && body !== null && "error" in body
              ? String((body as { error: unknown }).error)
              : `Request failed (${res.status})`;
          setState({ kind: "error", message });
          return;
        }
        setState({ kind: "ready", data: body as DashboardV2Data });
      } catch (error) {
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : "Failed to load",
        });
      } finally {
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load({ start: DEFAULT_START, end: "", world: "all", expert: "", email: "" });
  }, [load]);

  const applyFilters = (refresh = false) =>
    void load({ start, end, world, expert, email }, refresh);

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Skills Bench — Project Performance Dashboard
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Writer productivity, review quality, throughput, hours, and spend
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Campaign: {CAMPAIGN_NAME} · Project: {PROJECT_ID}
              {state.kind === "ready" ? (
                <>
                  {" "}
                  · Data refreshed: {state.data.fetchedAt}
                  {state.data.source === "snapshot"
                    ? state.data.liveStatuses
                      ? " (statuses live via Studio; hours/spend from snapshot)"
                      : " (snapshot)"
                    : ""}
                </>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            title="Refresh data"
            aria-label="Refresh data"
            disabled={refreshing}
            onClick={() => applyFilters(true)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <span className={refreshing ? "inline-block animate-spin" : ""}>⟳</span>
          </button>
        </div>
        <form
          className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          onSubmit={(e) => {
            e.preventDefault();
            applyFilters();
          }}
        >
          <label className="text-xs text-slate-500 dark:text-slate-400">
            From
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="ml-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </label>
          <label className="text-xs text-slate-500 dark:text-slate-400">
            To
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="ml-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </label>
          <label className="text-xs text-slate-500 dark:text-slate-400">
            World
            <select
              value={world}
              onChange={(e) => setWorld(e.target.value)}
              className="ml-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="all">All worlds</option>
              {(state.kind === "ready" ? state.data.worlds : []).map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-500 dark:text-slate-400">
            Expert
            <input
              type="text"
              placeholder="Name…"
              value={expert}
              onChange={(e) => setExpert(e.target.value)}
              className="ml-1 w-36 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </label>
          <label className="text-xs text-slate-500 dark:text-slate-400">
            Expert Email
            <input
              type="text"
              placeholder="Email…"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="ml-1 w-44 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              setStart(DEFAULT_START);
              setEnd("");
              setWorld("all");
              setExpert("");
              setEmail("");
              void load({
                start: DEFAULT_START,
                end: "",
                world: "all",
                expert: "",
                email: "",
              });
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Reset
          </button>
        </form>
      </header>

      {state.kind === "loading" ? <Skeleton /> : null}

      {state.kind === "error" ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <p className="font-semibold">Failed to load dashboard data</p>
          <p className="mt-1">{state.message}</p>
          <button
            onClick={() => applyFilters()}
            className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      ) : null}

      {state.kind === "ready" ? (
        <>
          {/* Section 1 — Overall Performance */}
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label="Total Hours Logged"
              kpi={state.data.kpis.totalHours}
              format={hours}
            />
            <KpiCard
              label="Total Payable"
              kpi={state.data.kpis.totalPayable}
              format={usd}
            />
            <KpiCard
              label="Approved Units"
              kpi={state.data.kpis.approvedUnits}
              format={units}
            />
            <KpiCard
              label="Approved AHT"
              kpi={state.data.kpis.approvedAht}
              format={aht}
            />
          </section>

          {/* Section 2 — Performance Trends */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <OneShotChart daily={state.data.daily} />
            <ThroughputChart daily={state.data.daily} />
            <UnitsChart daily={state.data.daily} />
            <HoursChart daily={state.data.daily} />
          </section>

          {/* Sections 3 & 4 — Pipeline and Review Outcomes */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <PipelineChart pipeline={state.data.pipeline} />
            <div className="grid grid-rows-2 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Quality Summary
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/40">
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                      One-Shot Rate
                    </p>
                    <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                      {pct(state.data.quality.oneShotRate)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-950/40">
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Rework Rate
                    </p>
                    <p className="text-xl font-bold text-amber-700 dark:text-amber-300">
                      {pct(state.data.quality.reworkRate)}
                    </p>
                  </div>
                </div>
                {state.data.quality.oneShotRate !== null ? (
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-amber-200 dark:bg-amber-900">
                    <div
                      className="h-full bg-emerald-500"
                      style={{
                        width: `${state.data.quality.oneShotRate * 100}%`,
                      }}
                    />
                  </div>
                ) : null}
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Spend Summary
                </h3>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-500 dark:text-slate-400">
                      Total Payable
                    </dt>
                    <dd className="font-semibold text-slate-800 dark:text-slate-100">
                      {usd(state.data.spend.totalPayable)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500 dark:text-slate-400">
                      Last 7 Days Payable
                    </dt>
                    <dd className="font-semibold text-slate-800 dark:text-slate-100">
                      {usd(state.data.spend.payableLast7Days)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500 dark:text-slate-400">
                      Average Rate / Hour
                    </dt>
                    <dd className="font-semibold text-slate-800 dark:text-slate-100">
                      {state.data.spend.averageRatePerHour === null
                        ? "—"
                        : `${usd(state.data.spend.averageRatePerHour)}/h`}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
            <ReviewAttemptsChart buckets={state.data.reviewAttempts} />
          </section>

          {/* Section 5 — Contributor Performance */}
          <ContributorTable
            contributors={state.data.contributors}
            worlds={state.data.worlds}
          />

          {/* Section 6 — Spend & Roster */}
          <section className="grid grid-cols-1 gap-4">
            <SpendChart daily={state.data.daily} />
            <RosterTable roster={state.data.roster} />
          </section>

          <p className="text-xs text-slate-400 dark:text-slate-500">
            Units are backend-computed (two Studio task variants = one logical
            unit); the UI never re-divides. Rates and AHT are never scaled.
          </p>
        </>
      ) : null}
    </div>
  );
}
