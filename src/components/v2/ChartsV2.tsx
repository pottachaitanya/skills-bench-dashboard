"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  DailySeriesPoint,
  PipelineStage,
  ReviewAttemptBucket,
} from "@/lib/types";

const AXIS_STYLE = { fontSize: 11 } as const;

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {title}
      </h3>
      <div className="h-64">{children}</div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-xs text-slate-400">
      No data available for the selected filters.
    </div>
  );
}

const pct = (v: number | null | undefined): string =>
  v === null || v === undefined ? "—" : `${(v * 100).toFixed(1)}%`;
const num = (v: number | null | undefined, digits = 1): string =>
  v === null || v === undefined ? "—" : v.toFixed(digits);
const usd = (v: number | null | undefined): string =>
  v === null || v === undefined
    ? "—"
    : v.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      });

export function OneShotChart({ daily }: { daily: DailySeriesPoint[] }) {
  const hasData = daily.some((d) => d.oneShotRate !== null);
  return (
    <ChartCard title="One-Shot Rate">
      {hasData ? (
        <ResponsiveContainer>
          <LineChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
            <XAxis dataKey="date" tick={AXIS_STYLE} minTickGap={40} />
            <YAxis
              tick={AXIS_STYLE}
              tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            />
            <Tooltip
              formatter={(value, name) => [
                pct(typeof value === "number" ? value : null),
                name === "oneShotRate" ? "Daily One-Shot %" : "7-Day Average %",
              ]}
            />
            <Legend
              formatter={(value: string) =>
                value === "oneShotRate" ? "Daily" : "7-Day Avg"
              }
            />
            <Line
              dataKey="oneShotRate"
              stroke="#93c5fd"
              strokeWidth={1}
              dot={false}
              connectNulls
            />
            <Line
              dataKey="oneShotRate7d"
              stroke="#2563eb"
              strokeWidth={2.5}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}

const SERIES_LABELS: Record<string, string> = {
  submittedUnits: "Submitted (daily)",
  submittedUnits7d: "Submitted (7d avg)",
  approvedUnits: "Approved (daily)",
  approvedUnits7d: "Approved (7d avg)",
  writerUnits: "Writer (daily)",
  writerUnits7d: "Writer (7d avg)",
  reviewerUnits: "Reviewer (daily)",
  reviewerUnits7d: "Reviewer (7d avg)",
  hours: "Hours (daily)",
  hours7d: "Hours (7d avg)",
};

function labelFor(key: string): string {
  return SERIES_LABELS[key] ?? key;
}

export function ThroughputChart({ daily }: { daily: DailySeriesPoint[] }) {
  const hasData = daily.some(
    (d) => d.submittedUnits > 0 || d.approvedUnits > 0,
  );
  return (
    <ChartCard title="Submission & Approval Throughput">
      {hasData ? (
        <ResponsiveContainer>
          <LineChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
            <XAxis dataKey="date" tick={AXIS_STYLE} minTickGap={40} />
            <YAxis tick={AXIS_STYLE} />
            <Tooltip
              formatter={(value, name) => [
                num(typeof value === "number" ? value : null),
                labelFor(String(name)),
              ]}
            />
            <Legend formatter={labelFor} />
            <Line dataKey="submittedUnits" stroke="#a5b4fc" strokeWidth={1} dot={false} />
            <Line dataKey="submittedUnits7d" stroke="#4f46e5" strokeWidth={2.5} dot={false} />
            <Line dataKey="approvedUnits" stroke="#86efac" strokeWidth={1} dot={false} />
            <Line dataKey="approvedUnits7d" stroke="#16a34a" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}

export function UnitsChart({ daily }: { daily: DailySeriesPoint[] }) {
  const hasData = daily.some((d) => d.writerUnits > 0 || d.reviewerUnits > 0);
  return (
    <ChartCard title="Writer & Reviewer Units">
      {hasData ? (
        <ResponsiveContainer>
          <LineChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
            <XAxis dataKey="date" tick={AXIS_STYLE} minTickGap={40} />
            <YAxis tick={AXIS_STYLE} />
            <Tooltip
              formatter={(value, name) => [
                num(typeof value === "number" ? value : null),
                labelFor(String(name)),
              ]}
            />
            <Legend formatter={labelFor} />
            <Line dataKey="writerUnits" stroke="#93c5fd" strokeWidth={1} dot={false} />
            <Line dataKey="writerUnits7d" stroke="#2563eb" strokeWidth={2.5} dot={false} />
            <Line dataKey="reviewerUnits" stroke="#fdba74" strokeWidth={1} dot={false} />
            <Line dataKey="reviewerUnits7d" stroke="#ea580c" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}

export function HoursChart({ daily }: { daily: DailySeriesPoint[] }) {
  const hasData = daily.some((d) => d.hours > 0);
  return (
    <ChartCard title="Hours Logged">
      {hasData ? (
        <ResponsiveContainer>
          <LineChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
            <XAxis dataKey="date" tick={AXIS_STYLE} minTickGap={40} />
            <YAxis tick={AXIS_STYLE} />
            <Tooltip
              formatter={(value, name) => [
                num(typeof value === "number" ? value : null, 2),
                labelFor(String(name)),
              ]}
            />
            <Legend formatter={labelFor} />
            <Line dataKey="hours" stroke="#c4b5fd" strokeWidth={1} dot={false} />
            <Line dataKey="hours7d" stroke="#7c3aed" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}

export function PipelineChart({ pipeline }: { pipeline: PipelineStage[] }) {
  return (
    <ChartCard title="Current Task Pipeline">
      {pipeline.length > 0 ? (
        <ResponsiveContainer>
          <BarChart data={pipeline}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
            <XAxis dataKey="stage" tick={AXIS_STYLE} />
            <YAxis tick={AXIS_STYLE} />
            <Tooltip
              formatter={(value) => [
                num(typeof value === "number" ? value : null),
                "Units",
              ]}
            />
            <Bar dataKey="units" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}

export function ReviewAttemptsChart({
  buckets,
}: {
  buckets: ReviewAttemptBucket[];
}) {
  const hasData = buckets.some((b) => b.approvedUnits > 0);
  return (
    <ChartCard title="Review Attempts Before Approval">
      {hasData ? (
        <ResponsiveContainer>
          <BarChart data={buckets}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
            <XAxis dataKey="bucket" tick={AXIS_STYLE} />
            <YAxis tick={AXIS_STYLE} />
            <Tooltip
              formatter={(value, _name, item) => {
                const share =
                  item && typeof item.payload === "object" && item.payload
                    ? (item.payload as ReviewAttemptBucket).share
                    : null;
                return [
                  `${num(typeof value === "number" ? value : null)} units (${pct(share)})`,
                  "Approved Units",
                ];
              }}
            />
            <Bar dataKey="approvedUnits" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}

export function SpendChart({ daily }: { daily: DailySeriesPoint[] }) {
  const hasData = daily.some((d) => d.payable > 0);
  return (
    <ChartCard title="Daily Payable Spend">
      {hasData ? (
        <ResponsiveContainer>
          <LineChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
            <XAxis dataKey="date" tick={AXIS_STYLE} minTickGap={40} />
            <YAxis tick={AXIS_STYLE} tickFormatter={(v: number) => usd(v)} width={80} />
            <Tooltip
              formatter={(value, name) => [
                usd(typeof value === "number" ? value : null),
                name === "payable" ? "Daily Payable" : "7-Day Avg",
              ]}
            />
            <Legend
              formatter={(value: string) =>
                value === "payable" ? "Daily Payable" : "7-Day Avg"
              }
            />
            <Line dataKey="payable" stroke="#fca5a5" strokeWidth={1} dot={false} />
            <Line dataKey="payable7d" stroke="#dc2626" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}
