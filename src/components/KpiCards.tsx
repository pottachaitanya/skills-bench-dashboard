import type { OverallMetrics } from "@/lib/types";
import { formatAht, formatCount, formatRate } from "@/lib/format";

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
}

function KpiCard({ label, value, sub }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {value}
      </div>
      {sub ? (
        <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          {sub}
        </div>
      ) : null}
    </div>
  );
}

export default function KpiCards({ overall }: { overall: OverallMetrics }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      <KpiCard label="Total Tasks" value={formatCount(overall.totalTasks)} />
      <KpiCard
        label="Approved Tasks"
        value={formatCount(overall.approvedTasks)}
        sub={`${formatCount(overall.approvedLast7Days)} in last 7d`}
      />
      <KpiCard
        label="Awaiting Review"
        value={formatCount(overall.awaitingReview)}
      />
      <KpiCard
        label="Writer Units"
        value={formatCount(overall.writerUnits)}
        sub={`${formatCount(overall.writerUnitsLast7Days)} in last 7d`}
      />
      <KpiCard
        label="Reviewer Units"
        value={formatCount(overall.reviewerUnits)}
        sub={`${formatCount(overall.reviewerUnitsLast7Days)} in last 7d`}
      />
      <KpiCard
        label="One-Shot Rate"
        value={formatRate(overall.oneShotRate)}
        sub="not scaled"
      />
      <KpiCard
        label="Writer AHT"
        value={formatAht(overall.writerAhtPerUnit)}
        sub={`per unit · ${formatAht(overall.writerAhtPerUniqueTask)} per unique task`}
      />
      <KpiCard
        label="Reviewer AHT"
        value={formatAht(overall.reviewerAhtPerUnit)}
        sub={`per unit · ${formatAht(overall.reviewerAhtPerUniqueReview)} per unique review`}
      />
    </div>
  );
}
