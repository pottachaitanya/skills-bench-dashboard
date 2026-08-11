import { NextRequest, NextResponse } from "next/server";
import { loadRawData } from "@/lib/data";
import { computeDashboard } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: string | null): string | null {
  return value && DATE_RE.test(value) ? value : null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = parseDate(searchParams.get("start"));
    const end = parseDate(searchParams.get("end"));
    const forceRefresh = searchParams.get("refresh") === "1";
    const raw = await loadRawData(forceRefresh);
    const today = new Date().toISOString().slice(0, 10);
    const data = computeDashboard(raw, { start, end }, today);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
