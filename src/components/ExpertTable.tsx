"use client";

import { useMemo, useState } from "react";
import type { ExpertMetrics } from "@/lib/types";
import { formatAht, formatCount, formatRate } from "@/lib/format";

type SortKey =
  | "userName"
  | "uniqueTasksWritten"
  | "writerUnits"
  | "approvedTasks"
  | "tasksIncluded"
  | "reviewerUnits"
  | "uniqueTasksReviewed"
  | "oneShotRate"
  | "writerAht"
  | "reviewerAht"
  | "writerUnits7"
  | "reviewerUnits7";

function sortValue(expert: ExpertMetrics, key: SortKey): number | string {
  switch (key) {
    case "userName":
      return expert.userName.toLowerCase();
    case "uniqueTasksWritten":
      return expert.uniqueTasksWritten.raw;
    case "writerUnits":
      return expert.writerUnits.raw;
    case "approvedTasks":
      return expert.approvedTasks.raw;
    case "tasksIncluded":
      return expert.tasksIncluded.raw;
    case "reviewerUnits":
      return expert.reviewerUnits.raw;
    case "uniqueTasksReviewed":
      return expert.uniqueTasksReviewed.raw;
    case "oneShotRate":
      return expert.oneShotRate ?? -1;
    case "writerAht":
      return expert.writerAht ?? -1;
    case "reviewerAht":
      return expert.reviewerAht ?? -1;
    case "writerUnits7":
      return expert.last7.writerUnits.raw;
    case "reviewerUnits7":
      return expert.last7.reviewerUnits.raw;
  }
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "userName", label: "Expert" },
  { key: "uniqueTasksWritten", label: "Unique Tasks" },
  { key: "writerUnits", label: "Writer Units" },
  { key: "approvedTasks", label: "Approved" },
  { key: "tasksIncluded", label: "Tasks Included" },
  { key: "reviewerUnits", label: "Review Units" },
  { key: "uniqueTasksReviewed", label: "Unique Reviews" },
  { key: "oneShotRate", label: "One-Shot" },
  { key: "writerAht", label: "Writer AHT (h/unique task)" },
  { key: "reviewerAht", label: "Reviewer AHT (h/unique review)" },
  { key: "writerUnits7", label: "Writer Units (7d)" },
  { key: "reviewerUnits7", label: "Review Units (7d)" },
];

export default function ExpertTable({ experts }: { experts: ExpertMetrics[] }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("uniqueTasksWritten");
  const [sortDesc, setSortDesc] = useState(true);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? experts.filter(
          (e) =>
            e.userName.toLowerCase().includes(term) ||
            e.userId.toLowerCase().includes(term),
        )
      : experts;
    return [...filtered].sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp =
        typeof va === "string" && typeof vb === "string"
          ? va.localeCompare(vb)
          : Number(va) - Number(vb);
      return sortDesc ? -cmp : cmp;
    });
  }, [experts, search, sortKey, sortDesc]);

  function onSort(key: SortKey) {
    if (key === sortKey) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(key !== "userName");
    }
  }

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          ExpertWise Performance
        </h2>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search expert name or ID…"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        />
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {rows.length} experts
        </span>
      </div>
      <div className="max-h-[540px] overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900">
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="cursor-pointer whitespace-nowrap px-3 py-2 select-none hover:text-slate-800 dark:hover:text-slate-200"
                  onClick={() => onSort(col.key)}
                >
                  {col.label}
                  {sortKey === col.key ? (sortDesc ? " ↓" : " ↑") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr
                key={e.userId}
                className="border-b border-slate-100 last:border-0 dark:border-slate-700/50"
              >
                <td
                  className="max-w-[200px] truncate px-3 py-1.5 font-medium text-slate-800 dark:text-slate-200"
                  title={e.userId}
                >
                  {e.userName}
                </td>
                <td className="px-3 py-1.5 text-right">{formatCount(e.uniqueTasksWritten)}</td>
                <td className="px-3 py-1.5 text-right">{formatCount(e.writerUnits)}</td>
                <td className="px-3 py-1.5 text-right">{formatCount(e.approvedTasks)}</td>
                <td className="px-3 py-1.5 text-right">{formatCount(e.tasksIncluded)}</td>
                <td className="px-3 py-1.5 text-right">{formatCount(e.reviewerUnits)}</td>
                <td className="px-3 py-1.5 text-right">{formatCount(e.uniqueTasksReviewed)}</td>
                <td className="px-3 py-1.5 text-right">{formatRate(e.oneShotRate)}</td>
                <td className="px-3 py-1.5 text-right">{formatAht(e.writerAht)}</td>
                <td className="px-3 py-1.5 text-right">{formatAht(e.reviewerAht)}</td>
                <td className="px-3 py-1.5 text-right">{formatCount(e.last7.writerUnits)}</td>
                <td className="px-3 py-1.5 text-right">{formatCount(e.last7.reviewerUnits)}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-3 py-8 text-center text-slate-400"
                >
                  No experts match your search.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
