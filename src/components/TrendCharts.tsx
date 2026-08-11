"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Rolling7DayMetrics } from "@/lib/types";
import { formatAht, formatCount, formatRate } from "@/lib/format";

interface TrendChartProps {
  title: string;
  data: { date: string; value: number }[];
  color: string;
}

function TrendChart({ title, data, color }: TrendChartProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h3 className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function TrendCharts({ rolling7 }: { rolling7: Rolling7DayMetrics }) {
  const series = (pick: (d: Rolling7DayMetrics["daily"][number]) => number) =>
    rolling7.daily.map((d) => ({ date: d.date, value: pick(d) }));
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          Rolling 7-Day Trends
        </h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {rolling7.windowStart} → {rolling7.windowEnd} · Approved{" "}
          {formatCount(rolling7.approvedTasks)} · One-Shot{" "}
          {formatRate(rolling7.oneShotRate)} · Writer AHT{" "}
          {formatAht(rolling7.writerAhtPerUnit)} / unit · Reviewer AHT{" "}
          {formatAht(rolling7.reviewerAhtPerUnit)} / unit
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <TrendChart
          title="Approved Tasks (/2)"
          data={series((d) => d.approvedTasks.display)}
          color="#16a34a"
        />
        <TrendChart
          title="Writer Units (/2)"
          data={series((d) => d.writerUnits.display)}
          color="#2563eb"
        />
        <TrendChart
          title="Reviewer Units (/2)"
          data={series((d) => d.reviewerUnits.display)}
          color="#9333ea"
        />
        <TrendChart
          title="Unique Tasks Written (/2)"
          data={series((d) => d.uniqueTasksWritten.display)}
          color="#0891b2"
        />
        <TrendChart
          title="Unique Tasks Reviewed (/2)"
          data={series((d) => d.uniqueTasksReviewed.display)}
          color="#ea580c"
        />
      </div>
    </section>
  );
}
