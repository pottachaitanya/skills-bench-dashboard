/**
 * Validation harness (npm run validate).
 *
 * Loads the raw data (snapshot or Snowflake), computes the dashboard payload
 * and asserts the invariants documented in docs/METRICS.md:
 *  - every task-related count is divided by 2 exactly once (display = raw/2)
 *  - rates and AHT are never scaled
 *  - domain rollups reconcile with overall totals
 *  - unique task/review counts are deduplicated (<= unit counts)
 *  - expert metrics reconcile with overall metrics
 *  - rolling 7-day windows span exactly 7 UTC days
 */
import { loadRawData } from "../src/lib/data";
import { computeDashboard } from "../src/lib/metrics";
import type { ScaledCount } from "../src/lib/types";

let failures = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`PASS  ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${name} ${detail}`);
  }
}

function checkScaled(name: string, count: ScaledCount): void {
  check(`${name}: display = raw / 2`, count.display === count.raw / 2, `raw=${count.raw} display=${count.display}`);
}

async function main() {
  process.env.USE_SNAPSHOT = process.env.USE_SNAPSHOT ?? "1";
  const raw = await loadRawData();
  const today = new Date().toISOString().slice(0, 10);
  const data = computeDashboard(raw, { start: null, end: null }, today);
  const { overall, domains, experts, rolling7 } = data;

  // /2 applied exactly once to every task-related count
  checkScaled("overall.totalTasks", overall.totalTasks);
  checkScaled("overall.approvedTasks", overall.approvedTasks);
  checkScaled("overall.awaitingReview", overall.awaitingReview);
  checkScaled("overall.writerUnits", overall.writerUnits);
  checkScaled("overall.reviewerUnits", overall.reviewerUnits);
  checkScaled("overall.uniqueTasksWritten", overall.uniqueTasksWritten);
  checkScaled("overall.uniqueTasksReviewed", overall.uniqueTasksReviewed);
  checkScaled("overall.approvedLast7Days", overall.approvedLast7Days);
  for (const d of domains) {
    checkScaled(`domain[${d.domain}].totalTasks`, d.totalTasks);
    checkScaled(`domain[${d.domain}].writerUnits`, d.writerUnits);
  }

  // rates / AHT unscaled and in valid ranges
  check(
    "overall.oneShotRate within [0,1] or null",
    overall.oneShotRate === null ||
      (overall.oneShotRate >= 0 && overall.oneShotRate <= 1),
  );
  const rawWriterAht =
    overall.writerTimerHours / overall.writerUnits.raw;
  check(
    "writer AHT = timer hours / RAW writer units (unscaled)",
    overall.writerAhtPerUnit !== null &&
      Math.abs(overall.writerAhtPerUnit - rawWriterAht) < 1e-9,
    `aht=${overall.writerAhtPerUnit} expected=${rawWriterAht}`,
  );
  const rawReviewerAht =
    overall.reviewerTimerHours / overall.reviewerUnits.raw;
  check(
    "reviewer AHT = timer hours / RAW reviewer units (unscaled)",
    overall.reviewerAhtPerUnit !== null &&
      Math.abs(overall.reviewerAhtPerUnit - rawReviewerAht) < 1e-9,
  );

  // domain rollups reconcile with overall
  const sum = (pick: (d: (typeof domains)[number]) => number) =>
    domains.reduce((acc, d) => acc + pick(d), 0);
  check(
    "sum(domain.totalTasks.raw) = overall.totalTasks.raw",
    sum((d) => d.totalTasks.raw) === overall.totalTasks.raw,
    `${sum((d) => d.totalTasks.raw)} vs ${overall.totalTasks.raw}`,
  );
  check(
    "sum(domain.writerUnits.raw) = overall.writerUnits.raw",
    sum((d) => d.writerUnits.raw) === overall.writerUnits.raw,
  );
  check(
    "sum(domain.reviewerUnits.raw) = overall.reviewerUnits.raw",
    sum((d) => d.reviewerUnits.raw) === overall.reviewerUnits.raw,
  );
  check(
    "sum(domain.approvedTasks.raw) = overall.approvedTasks.raw",
    sum((d) => d.approvedTasks.raw) === overall.approvedTasks.raw,
  );

  // dedupe: unique counts can never exceed unit counts
  check(
    "overall unique written <= writer units",
    overall.uniqueTasksWritten.raw <= overall.writerUnits.raw,
  );
  check(
    "overall unique reviewed <= reviewer units",
    overall.uniqueTasksReviewed.raw <= overall.reviewerUnits.raw,
  );
  const distinctWritten = new Set(
    raw.events.filter((e) => e.role === "writer").map((e) => e.taskId),
  ).size;
  check(
    "unique tasks written matches distinct task IDs in events",
    overall.uniqueTasksWritten.raw === distinctWritten,
    `${overall.uniqueTasksWritten.raw} vs ${distinctWritten}`,
  );

  // expert rollups reconcile with overall (events with a known author)
  const expertWriterUnits = experts.reduce(
    (acc, e) => acc + e.writerUnits.raw,
    0,
  );
  const authoredWriterEvents = raw.events.filter(
    (e) => e.role === "writer" && e.userId !== null,
  ).length;
  check(
    "sum(expert.writerUnits.raw) = writer events with known author",
    expertWriterUnits === authoredWriterEvents,
    `${expertWriterUnits} vs ${authoredWriterEvents}`,
  );
  const expertReviewerUnits = experts.reduce(
    (acc, e) => acc + e.reviewerUnits.raw,
    0,
  );
  const authoredReviewerEvents = raw.events.filter(
    (e) => e.role === "reviewer" && e.userId !== null,
  ).length;
  check(
    "sum(expert.reviewerUnits.raw) = reviewer events with known author",
    expertReviewerUnits === authoredReviewerEvents,
  );

  // rolling window boundaries
  const start = new Date(`${rolling7.windowStart}T00:00:00Z`).getTime();
  const end = new Date(`${rolling7.windowEnd}T00:00:00Z`).getTime();
  check(
    "rolling window spans exactly 7 UTC days",
    (end - start) / (24 * 60 * 60 * 1000) === 6 && rolling7.daily.length === 7,
  );

  // timer sources
  const writerTimerTotal = raw.timers
    .filter((t) => t.timer === "writer")
    .reduce((acc, t) => acc + t.hours, 0);
  check(
    "overall writer timer hours = sum of writer timer rows",
    Math.abs(overall.writerTimerHours - writerTimerTotal) < 1e-6,
  );

  console.log(
    `\nSummary: raw totals — tasks=${overall.totalTasks.raw}, writerUnits=${overall.writerUnits.raw}, reviewerUnits=${overall.reviewerUnits.raw}, ` +
      `uniqueWritten=${overall.uniqueTasksWritten.raw}, uniqueReviewed=${overall.uniqueTasksReviewed.raw}, ` +
      `oneShot=${overall.oneShotRate?.toFixed(4)}, writerHours=${overall.writerTimerHours.toFixed(1)}, reviewerHours=${overall.reviewerTimerHours.toFixed(1)}`,
  );
  if (failures > 0) {
    console.error(`\n${failures} validation check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll validation checks passed.");
}

void main();
