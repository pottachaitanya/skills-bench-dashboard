"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyPoint, StageCount } from "@/lib/typesV3";
import { fmtDay, fmtDayLong, fmtNum } from "./formatV3";

// Design-system chart tokens: single ink tone for daily series, accent for the
// 7-day trend, semantic green reserved for Approved. No multi-hue palettes.
const GRID = "#E4E7EC";
const AXIS = { fontSize: 11, fill: "#7A8496", fontFamily: "var(--font-data)" };
const DAILY = "#9AA4B8";
const TREND = "#4338CA";
const NAVY = "#141A33";
const PASS = "#0F7A5A";
const PASS_DAILY = "#8FBFAF";

function Empty() {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-slate-400">
      No data available for the selected filters.
    </div>
  );
}

interface SeriesSpec {
  key: keyof DailyPoint;
  name: string;
  color: string;
  strong: boolean;
}

function TrendChart({
  data,
  series,
  unit,
}: {
  data: DailyPoint[];
  series: SeriesSpec[];
  unit: string;
}) {
  if (data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tick={AXIS} tickFormatter={fmtDay} minTickGap={28} />
        <YAxis tick={AXIS} width={48} />
        <Tooltip
          labelFormatter={(d) => fmtDayLong(String(d))}
          formatter={(v, name) => [typeof v === "number" ? `${fmtNum(v, 2)} ${unit}` : "—", String(name)]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s) => (
          <Line
            key={String(s.key)}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={s.strong ? 2.5 : 1.25}
            strokeOpacity={s.strong ? 1 : 0.45}
            dot={false}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ThroughputChart({ data }: { data: DailyPoint[] }) {
  return (
    <TrendChart
      data={data}
      unit="tasks"
      series={[
        { key: "submitted", name: "Tasks Written (daily)", color: DAILY, strong: false },
        { key: "submitted7d", name: "Tasks Written (7-day average)", color: TREND, strong: true },
        { key: "approved", name: "Tasks Approved (daily)", color: PASS_DAILY, strong: false },
        { key: "approved7d", name: "Tasks Approved (7-day average)", color: PASS, strong: true },
      ]}
    />
  );
}

export function UnitsChart({ data }: { data: DailyPoint[] }) {
  return (
    <TrendChart
      data={data}
      unit="units"
      series={[
        { key: "writerUnits", name: "Submissions (daily)", color: DAILY, strong: false },
        { key: "writerUnits7d", name: "Submissions (7-day average)", color: TREND, strong: true },
        { key: "reviewUnits", name: "Review Passes (daily)", color: "#B9BFCC", strong: false },
        { key: "reviewUnits7d", name: "Review Passes (7-day average)", color: NAVY, strong: true },
      ]}
    />
  );
}

export function HoursChart({ data }: { data: DailyPoint[] }) {
  return (
    <TrendChart
      data={data}
      unit="h"
      series={[
        { key: "hours", name: "Hours Logged (daily)", color: DAILY, strong: false },
        { key: "hours7d", name: "Hours Logged (7-day average)", color: TREND, strong: true },
      ]}
    />
  );
}

export function SpendChart({ data }: { data: DailyPoint[] }) {
  if (data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tick={AXIS} tickFormatter={fmtDay} minTickGap={28} />
        <YAxis tick={AXIS} width={64} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          labelFormatter={(d) => fmtDayLong(String(d))}
          formatter={(v, name) => [
            typeof v === "number" ? v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—",
            String(name),
          ]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="payable" name="Payable (daily)" stroke={DAILY} strokeWidth={1.25} strokeOpacity={0.45} dot={false} />
        <Line type="monotone" dataKey="payable7d" name="Payable (7-day average)" stroke={TREND} strokeWidth={2.5} dot={false} connectNulls={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// One fixed colour per stage, reused identically everywhere the stage appears.
const STAGE_COLORS: Record<string, string> = {
  Pending: "#A9B2C4",
  "In Progress": "#A9B2C4",
  Unclaimed: "#C4CAD6",
  "Awaiting Review": "#7C88A3",
  "In Review": "#4C5B7D",
  "QA Awaiting Review": "#2E3A5C",
  "QA In Review": "#2E3A5C",
  "In QC": "#2E3A5C",
  "Needs QC Revision": "#B4402F",
  Approved: "#0F7A5A",
};

export function PipelineChart({ stages }: { stages: StageCount[] }) {
  if (stages.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={stages} margin={{ top: 20, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="stage" tick={{ ...AXIS, fontSize: 10 }} interval={0} angle={-18} textAnchor="end" height={52} />
        <YAxis tick={AXIS} width={48} />
        <Tooltip formatter={(v) => [typeof v === "number" ? `${fmtNum(v, 1)} weighted tasks` : "—", "Count"]} />
        <Bar dataKey="units" name="Weighted tasks" radius={[4, 4, 0, 0]} fill={DAILY} isAnimationActive={false}>
          <LabelList dataKey="units" position="top" style={{ fontSize: 11, fill: NAVY, fontFamily: "var(--font-data)" }} formatter={(v) => fmtNum(Number(v), 1)} />
          {stages.map((s) => (
            <Cell key={s.stage} fill={STAGE_COLORS[s.stage] ?? DAILY} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
