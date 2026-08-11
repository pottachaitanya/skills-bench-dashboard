"use client";

import { useMemo, useState } from "react";
import type { ContributorRow } from "@/lib/types";

const PAGE_SIZE = 25;

type SortKey =
  | "tasksWritten"
  | "tasksApproved"
  | "writerAht"
  | "reviewerUnits"
  | "reviewerAht"
  | "oneShotRate";

const fmtUnits = (v: number): string =>
  v.toLocaleString("en-US", { maximumFractionDigits: 1 });
const fmt2 = (v: number | null): string => (v === null ? "—" : v.toFixed(2));
const fmtPct = (v: number | null): string =>
  v === null ? "—" : `${(v * 100).toFixed(1)}%`;

export default function ContributorTable({
  contributors,
  worlds,
}: {
  contributors: ContributorRow[];
  worlds: string[];
}) {
  const [search, setSearch] = useState("");
  const [world, setWorld] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("tasksWritten");
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = contributors.filter((row) => {
      if (world !== "all" && row.world !== world) return false;
      if (!needle) return true;
      return (
        row.name.toLowerCase().includes(needle) ||
        (row.email ?? "").toLowerCase().includes(needle) ||
        row.userId.toLowerCase().includes(needle)
      );
    });
    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      return sortDesc ? Number(bv) - Number(av) : Number(av) - Number(bv);
    });
    return sorted;
  }, [contributors, search, world, sortKey, sortDesc]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = rows.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );

  const sortButton = (key: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => {
        if (sortKey === key) {
          setSortDesc(!sortDesc);
        } else {
          setSortKey(key);
          setSortDesc(true);
        }
        setPage(0);
      }}
      className="inline-flex items-center gap-1 font-semibold hover:text-blue-600"
    >
      {label}
      {sortKey === key ? <span>{sortDesc ? "▼" : "▲"}</span> : null}
    </button>
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          Contributor Performance
        </h2>
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            placeholder="Search name, email, or ID…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
          <select
            value={world}
            onChange={(e) => {
              setWorld(e.target.value);
              setPage(0);
            }}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
          >
            <option value="all">All worlds</option>
            {worlds.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          No data available for the selected filters.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-2 py-2">Expert Name</th>
                <th className="px-2 py-2">Expert Email</th>
                <th className="px-2 py-2">World</th>
                <th className="px-2 py-2 text-right">
                  {sortButton("tasksWritten", "Tasks Written")}
                </th>
                <th className="px-2 py-2 text-right">
                  {sortButton("tasksApproved", "Tasks Approved")}
                </th>
                <th className="px-2 py-2 text-right">Writer Hours</th>
                <th className="px-2 py-2 text-right">
                  {sortButton("writerAht", "Writer AHT")}
                </th>
                <th className="px-2 py-2 text-right">
                  {sortButton("reviewerUnits", "Reviewer Units")}
                </th>
                <th className="px-2 py-2 text-right">Reviewer Hours</th>
                <th className="px-2 py-2 text-right">
                  {sortButton("reviewerAht", "Reviewer AHT")}
                </th>
                <th className="px-2 py-2 text-right">
                  {sortButton("oneShotRate", "One-Shot Rate")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visible.map((row) => (
                <tr key={row.userId} className="text-slate-700 dark:text-slate-200">
                  <td className="px-2 py-1.5 font-medium">{row.name}</td>
                  <td className="px-2 py-1.5 text-slate-500 dark:text-slate-400">
                    {row.email ?? "—"}
                  </td>
                  <td className="px-2 py-1.5">{row.world}</td>
                  <td className="px-2 py-1.5 text-right">
                    {fmtUnits(row.tasksWritten)}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {fmtUnits(row.tasksApproved)}
                  </td>
                  <td className="px-2 py-1.5 text-right">{fmt2(row.writerHours)}</td>
                  <td className="px-2 py-1.5 text-right">{fmt2(row.writerAht)}</td>
                  <td className="px-2 py-1.5 text-right">
                    {fmtUnits(row.reviewerUnits)}
                  </td>
                  <td className="px-2 py-1.5 text-right">{fmt2(row.reviewerHours)}</td>
                  <td className="px-2 py-1.5 text-right">{fmt2(row.reviewerAht)}</td>
                  <td className="px-2 py-1.5 text-right">{fmtPct(row.oneShotRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pageCount > 1 ? (
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>
            Page {currentPage + 1} of {pageCount} · {rows.length} contributors
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
              className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40 dark:border-slate-600"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={currentPage >= pageCount - 1}
              onClick={() => setPage(currentPage + 1)}
              className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40 dark:border-slate-600"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
