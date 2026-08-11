import { NextRequest, NextResponse } from "next/server";
import { loadRawData } from "@/lib/data";
import { computeDashboardV2 } from "@/lib/metricsV2";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: string | null): string | null {
  return value && DATE_RE.test(value) ? value : null;
}

function parseText(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed.slice(0, 200) : null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "1";
    const raw = await loadRawData(forceRefresh);
    const today = new Date().toISOString().slice(0, 10);
    const data = computeDashboardV2(
      raw,
      {
        start: parseDate(searchParams.get("start")),
        end: parseDate(searchParams.get("end")),
        world: parseText(searchParams.get("world")),
        expert: parseText(searchParams.get("expert")),
        email: parseText(searchParams.get("email")),
      },
      today,
    );
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
