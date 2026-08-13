// Fixed decimals per column, never variable: hours 1dp, task counts 1dp,
// efficiency 2dp, rates 1dp %, money 2dp. Absent data renders —, a true zero renders 0.
export function fmtNum(n: number | null | undefined, dp = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function fmtPct(n: number | null | undefined, dp = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(dp)}%`;
}

export function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtHours(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function fmtDay(d: string): string {
  const dt = new Date(`${d}T12:00:00Z`);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function fmtDayLong(d: string): string {
  const dt = new Date(`${d}T12:00:00Z`);
  return dt.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
