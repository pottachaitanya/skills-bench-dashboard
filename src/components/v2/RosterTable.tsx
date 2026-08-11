"use client";

import { useMemo, useState } from "react";
import type { RosterRow } from "@/lib/types";

const PAGE_SIZE = 25;

const usd = (v: number): string =>
  v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

export default function RosterTable({ roster }: { roster: RosterRow[] }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return roster;
    return roster.filter(
      (row) =>
        row.name.toLowerCase().includes(needle) ||
        (row.email ?? "").toLowerCase().includes(needle) ||
        row.world.toLowerCase().includes(needle) ||
        row.userId.toLowerCase().includes(needle),
    );
  }, [roster, search]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = rows.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          Expert Roster
        </h2>
        <input
          type="search"
          placeholder="Search contractor, email, or world…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          className="w-72 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
      </div>
      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          No data available for the selected filters.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-2 py-2">Contractor</th>
                <th className="px-2 py-2">Expert Email</th>
                <th className="px-2 py-2">World</th>
                <th className="px-2 py-2 text-right">Hours</th>
                <th className="px-2 py-2 text-right">Payable</th>
                <th className="px-2 py-2 text-right">Effective Rate / Hour</th>
                <th className="px-2 py-2 text-right">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visible.map((row) => (
                <tr
                  key={row.userId}
                  className={
                    row.inactive
                      ? "bg-amber-50 text-slate-500 dark:bg-amber-950/30 dark:text-slate-400"
                      : "text-slate-700 dark:text-slate-200"
                  }
                >
                  <td className="px-2 py-1.5 font-medium">
                    {row.name}
                    {row.inactive ? (
                      <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                        inactive
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-1.5 text-slate-500 dark:text-slate-400">
                    {row.email ?? "—"}
                  </td>
                  <td className="px-2 py-1.5">{row.world}</td>
                  <td className="px-2 py-1.5 text-right">{row.hours.toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-right">{usd(row.payable)}</td>
                  <td className="px-2 py-1.5 text-right">
                    {row.ratePerHour === null ? "—" : usd(row.ratePerHour)}
                    {row.ratePerHour === null ? "" : "/h"}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {row.lastActive ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pageCount > 1 ? (
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>
            Page {currentPage + 1} of {pageCount} · {rows.length} experts
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
      <p className="mt-2 text-[10px] text-slate-400">
        Experts with no activity in the last 7 days are highlighted.
      </p>
    </section>
  );
}
