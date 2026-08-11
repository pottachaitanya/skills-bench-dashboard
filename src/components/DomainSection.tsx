"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DomainMetrics } from "@/lib/types";
import { formatCount, formatRate } from "@/lib/format";

function DomainBarChart({
  title,
  data,
  bars,
}: {
  title: string;
  data: Record<string, unknown>[];
  bars: { key: string; color: string; name: string }[];
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h3 className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
          <XAxis
            dataKey="domain"
            tick={{ fontSize: 9 }}
            interval={0}
            angle={-30}
            textAnchor="end"
            height={60}
          />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          {bars.length > 1 ? <Legend wrapperStyle={{ fontSize: 11 }} /> : null}
          {bars.map((bar) => (
            <Bar key={bar.key} dataKey={bar.key} fill={bar.color} name={bar.name} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function DomainSection({ domains }: { domains: DomainMetrics[] }) {
  const visible = domains.filter((d) => d.totalTasks.raw > 0 || d.writerUnits.raw > 0);
  const chartData = visible.map((d) => ({
    domain: d.domain,
    approved: d.approvedTasks.display,
    awaiting: d.awaitingReview.display,
    writerUnits: d.writerUnits.display,
    reviewerUnits: d.reviewerUnits.display,
    oneShotPct: d.oneShotRate === null ? 0 : +(d.oneShotRate * 100).toFixed(1),
  }));
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
        Domain Performance
      </h2>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <th className="px-3 py-2">Domain</th>
              <th className="px-3 py-2 text-right">Total Tasks</th>
              <th className="px-3 py-2 text-right">Approved</th>
              <th className="px-3 py-2 text-right">Awaiting Review</th>
              <th className="px-3 py-2 text-right">Approved (7d)</th>
              <th className="px-3 py-2 text-right">One-Shot Rate</th>
              <th className="px-3 py-2 text-right">Writer Units</th>
              <th className="px-3 py-2 text-right">Reviewer Units</th>
              <th className="px-3 py-2 text-right">Unique Written</th>
              <th className="px-3 py-2 text-right">Unique Reviewed</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((d) => (
              <tr
                key={d.domain}
                className="border-b border-slate-100 last:border-0 dark:border-slate-700/50"
              >
                <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                  {d.domain}
                </td>
                <td className="px-3 py-2 text-right">{formatCount(d.totalTasks)}</td>
                <td className="px-3 py-2 text-right">{formatCount(d.approvedTasks)}</td>
                <td className="px-3 py-2 text-right">{formatCount(d.awaitingReview)}</td>
                <td className="px-3 py-2 text-right">{formatCount(d.approvedLast7Days)}</td>
                <td className="px-3 py-2 text-right">{formatRate(d.oneShotRate)}</td>
                <td className="px-3 py-2 text-right">{formatCount(d.writerUnits)}</td>
                <td className="px-3 py-2 text-right">{formatCount(d.reviewerUnits)}</td>
                <td className="px-3 py-2 text-right">{formatCount(d.uniqueTasksWritten)}</td>
                <td className="px-3 py-2 text-right">{formatCount(d.uniqueTasksReviewed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <DomainBarChart
          title="Approved Tasks by Domain (/2)"
          data={chartData}
          bars={[{ key: "approved", color: "#16a34a", name: "Approved" }]}
        />
        <DomainBarChart
          title="Awaiting Review by Domain (/2)"
          data={chartData}
          bars={[{ key: "awaiting", color: "#eab308", name: "Awaiting Review" }]}
        />
        <DomainBarChart
          title="Writer vs Reviewer Units by Domain (/2)"
          data={chartData}
          bars={[
            { key: "writerUnits", color: "#2563eb", name: "Writer Units" },
            { key: "reviewerUnits", color: "#9333ea", name: "Reviewer Units" },
          ]}
        />
        <DomainBarChart
          title="One-Shot Rate by Domain (%)"
          data={chartData}
          bars={[{ key: "oneShotPct", color: "#0891b2", name: "One-Shot %" }]}
        />
      </div>
    </section>
  );
}
