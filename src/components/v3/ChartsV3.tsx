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

const GRID = "#e2e8f0";
const AXIS = { fontSize: 11, fill: "#64748b" };

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
        { key: "submitted", name: "Tasks Submitted (daily)", color: "#3b82f6", strong: false },
        { key: "submitted7d", name: "Tasks Submitted (7d avg)", color: "#1d4ed8", strong: true },
        { key: "approved", name: "Tasks Approved (daily)", color: "#22c55e", strong: false },
        { key: "approved7d", name: "Tasks Approved (7d avg)", color: "#15803d", strong: true },
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
        { key: "writerUnits", name: "Writer Units (daily)", color: "#8b5cf6", strong: false },
        { key: "writerUnits7d", name: "Writer Units (7d avg)", color: "#6d28d9", strong: true },
        { key: "reviewUnits", name: "Review Units (daily)", color: "#f59e0b", strong: false },
        { key: "reviewUnits7d", name: "Review Units (7d avg)", color: "#b45309", strong: true },
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
        { key: "hours", name: "Hours Recorded (daily)", color: "#0ea5e9", strong: false },
        { key: "hours7d", name: "Hours Recorded (7d avg)", color: "#0369a1", strong: true },
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
            typeof v === "number" ? v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }) : "—",
            String(name),
          ]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="payable" name="Payable (daily)" stroke="#10b981" strokeWidth={1.25} strokeOpacity={0.45} dot={false} />
        <Line type="monotone" dataKey="payable7d" name="Payable (7d avg)" stroke="#047857" strokeWidth={2.5} dot={false} connectNulls={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

const STAGE_COLORS: Record<string, string> = {
  Pending: "#94a3b8",
  "In Progress": "#a8a29e",
  Unclaimed: "#cbd5e1",
  "Awaiting Review": "#3b82f6",
  "In Review": "#f59e0b",
  "QA Awaiting Review": "#c084fc",
  "QA In Review": "#a855f7",
  "In QC": "#d946ef",
  "Needs QC Revision": "#f43f5e",
  Approved: "#22c55e",
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
        <Bar dataKey="units" name="Weighted tasks" radius={[4, 4, 0, 0]} fill="#3b82f6" isAnimationActive={false}>
          <LabelList dataKey="units" position="top" style={{ fontSize: 11, fill: "#334155" }} formatter={(v) => fmtNum(Number(v), 1)} />
          {stages.map((s) => (
            <Cell key={s.stage} fill={STAGE_COLORS[s.stage] ?? "#3b82f6"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
