import type { ScaledCount } from "./types";

export function formatCount(count: ScaledCount): string {
  return count.display.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

export function formatRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

export function formatHours(hours: number | null): string {
  if (hours === null) return "—";
  return hours.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function formatAht(aht: number | null): string {
  if (aht === null) return "—";
  return `${aht.toFixed(2)} h`;
}
