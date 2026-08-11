"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardData } from "@/lib/types";
import { CAMPAIGN_NAME, PROJECT_ID } from "@/lib/config";
import KpiCards from "./KpiCards";
import TrendCharts from "./TrendCharts";
import DomainSection from "./DomainSection";
import ExpertTable from "./ExpertTable";
import { formatCount } from "@/lib/format";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: DashboardData };

export default function Dashboard() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [domainFilter, setDomainFilter] = useState("all");

  const load = useCallback(async (startDate: string, endDate: string) => {
    setState({ kind: "loading" });
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("start", startDate);
      if (endDate) params.set("end", endDate);
      const res = await fetch(`/api/dashboard?${params.toString()}`);
      const body: unknown = await res.json();
      if (!res.ok) {
        const message =
          typeof body === "object" && body !== null && "error" in body
            ? String((body as { error: unknown }).error)
            : `Request failed (${res.status})`;
        setState({ kind: "error", message });
        return;
      }
      setState({ kind: "ready", data: body as DashboardData });
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Failed to load",
      });
    }
  }, []);

  useEffect(() => {
    void load("", "");
  }, [load]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Skills Bench Analytics
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Campaign: {CAMPAIGN_NAME} · Project: {PROJECT_ID}
            {state.kind === "ready" ? (
              <>
                {" "}
                · Data refreshed: {state.data.fetchedAt}
                {state.data.source === "snapshot"
                  ? state.data.liveStatuses
                    ? " (statuses live via Studio; units/AHT from snapshot)"
                    : " (snapshot)"
                  : ""}
              </>
            ) : null}
          </p>
        </div>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void load(start, end);
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
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              setStart("");
              setEnd("");
              void load("", "");
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Reset
          </button>
        </form>
      </header>

      {state.kind === "loading" ? (
        <div className="flex h-64 items-center justify-center text-slate-400">
          <div className="animate-pulse text-sm">Loading dashboard…</div>
        </div>
      ) : null}

      {state.kind === "error" ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <p className="font-semibold">Failed to load dashboard data</p>
          <p className="mt-1">{state.message}</p>
          <button
            onClick={() => void load(start, end)}
            className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      ) : null}

      {state.kind === "ready" ? (
        <>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            All task-related counts shown are raw ÷ 2 (see README). Rates and
            AHT are never scaled.
          </p>
          <KpiCards overall={state.data.overall} />
          <TrendCharts rolling7={state.data.rolling7} />
          <div>
            <div className="mb-2 flex items-center gap-2">
              <label className="text-xs text-slate-500 dark:text-slate-400">
                Domain filter
              </label>
              <select
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
              >
                <option value="all">All domains</option>
                {state.data.domains.map((d) => (
                  <option key={d.domain} value={d.domain}>
                    {d.domain}
                  </option>
                ))}
              </select>
            </div>
            <DomainSection
              domains={
                domainFilter === "all"
                  ? state.data.domains
                  : state.data.domains.filter((d) => d.domain === domainFilter)
              }
            />
          </div>
          <ExpertTable experts={state.data.experts} />
          <section>
            <h2 className="mb-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
              Task Status Breakdown
            </h2>
            <div className="flex flex-wrap gap-2">
              {state.data.statusBreakdown.map((row) => (
                <span
                  key={row.status}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  {row.status}: {formatCount(row.count)}
                </span>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
