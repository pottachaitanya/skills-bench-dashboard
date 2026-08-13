import { NextRequest, NextResponse } from "next/server";
import { loadSnapshotV3 } from "@/lib/dataV3";
import { computeDashboardV3, earliestDay, tMinus1 } from "@/lib/metricsV3";

export const dynamic = "force-dynamic";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const refresh = params.get("refresh") === "1";
    const snap = await loadSnapshotV3(refresh);
    const t1 = tMinus1();
    const startParam = params.get("start");
    const endParam = params.get("end");
    const start = startParam && DAY_RE.test(startParam) ? startParam : earliestDay(snap);
    const endRaw = endParam && DAY_RE.test(endParam) ? endParam : t1;
    const end = endRaw > t1 ? t1 : endRaw;
    const data = computeDashboardV3(snap, { start, end });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
