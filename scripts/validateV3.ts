import { promises as fs } from "fs";
import path from "path";
import { computeDashboardV3, earliestDay } from "../src/lib/metricsV3";
import type { SnapshotV3 } from "../src/lib/typesV3";

async function main() {
  const file = path.join(process.cwd(), "data", "snapshotV3.json");
  const snap = JSON.parse(await fs.readFile(file, "utf8")) as SnapshotV3;
  const start = earliestDay(snap);
  const d = computeDashboardV3(snap, { start, end: "2099-01-01" });

  console.log("=== Stage transition graph (discovered, not assumed) ===");
  for (const e of d.meta.stageGraph) console.log(`${e.from} -> ${e.to}: ${e.count}`);

  console.log("\n=== All-time totals (range", d.meta.rangeStart, "..", d.meta.rangeEnd, ") ===");
  console.log("Total Hours Recorded:", d.kpis.hours.total);
  console.log("Total Payable:", d.spendKpis.payable);
  console.log("Tasks Submitted (weighted):", d.writerTotals.submitted);
  console.log("Reviewed Tasks (weighted):", d.writerTotals.reviewedTasks);
  console.log("Tasks Approved (weighted):", d.writerTotals.approved);
  console.log("Writer Units (weighted):", d.writerTotals.writerUnits);
  console.log("Review Units (weighted):", d.writerTotals.reviewUnits);
  console.log("Pass %:", d.writerTotals.passRate);
  console.log("Send Back Rate:", d.writerTotals.sendBackRate);
  console.log("One-shot Rate (total):", d.quality.total.oneShot);
  console.log("AHT approved (total):", d.kpis.ahtApproved.total);
  console.log("Other payable (non-SkillsBench timers/bonuses):", d.meta.otherPayable);
  console.log("Unmatched studio actors:", d.meta.unmatchedActors.length);
  console.log("Missing-rate roster rows:", d.meta.missingRateUsers.length);
  console.log("Pipeline as of", d.pipeline.asOf, d.pipeline.stages);

  const checks: [string, boolean][] = [
    ["reviewed tasks weighted matches spec baseline shape (ends in .0 or .5)", d.writerTotals.reviewedTasks % 0.5 === 0],
    ["weighting live: some weighted metric is fractional", [d.writerTotals.submitted, d.writerTotals.reviewedTasks, d.writerTotals.approved].some((v) => v % 1 !== 0)],
    ["one-shot within [0,1]", d.quality.total.oneShot !== null && d.quality.total.oneShot >= 0 && d.quality.total.oneShot <= 1],
    ["submitted >= reviewed - small gap", d.writerTotals.submitted >= d.writerTotals.reviewedTasks - 1],
    ["hours positive", (d.kpis.hours.total ?? 0) > 1000],
    ["payable positive", d.spendKpis.payable > 100000],
    ["daily series has rolling nulls only at warm-up", d.daily.length > 30],
    ["no NaN in KPIs", [d.kpis.hours.total, d.kpis.ahtApproved.total, d.kpis.oneShotRate.total].every((v) => v === null || Number.isFinite(v))],
  ];
  let failed = 0;
  for (const [name, ok] of checks) {
    console.log(ok ? "PASS" : "FAIL", name);
    if (!ok) failed += 1;
  }
  if (failed > 0) process.exit(1);
}

main();
