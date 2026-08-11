import {
  APPROVED_STATUSES,
  AWAITING_REVIEW_STATUSES,
  CAMPAIGN_NAME,
  EXCLUDED_STATUSES,
  OTHER_DOMAIN,
  PROJECT_ID,
  WORLD_DOMAINS,
  domainForWorld,
} from "./config";
import {
  firstApprovalByTask,
  isReviewerEvent,
  isWriterEvent,
  oneShotByTask,
  safeRate,
  taskWriterByTask,
  utcDate,
  type DateWindow,
  inWindow,
} from "./metrics";
import type {
  ContributorRow,
  DailySeriesPoint,
  DashboardV2Data,
  KpiValue,
  PayoutRow,
  PipelineStage,
  RawData,
  ReviewAttemptBucket,
  RosterRow,
  TaskEvent,
  UserInfo,
} from "./types";

/** Default start of the reporting window. */
export const DEFAULT_START = "2026-06-01";

/**
 * v2 "unit" semantics: two Studio task variants = one logical unit, so a raw
 * task/version count divided by 2 is a unit count. Rates and AHT use unit
 * denominators and are never themselves divided.
 */
function toUnits(rawCount: number): number {
  return rawCount / 2;
}

export interface V2Filters {
  start: string | null;
  end: string | null;
  world: string | null;
  expert: string | null;
  email: string | null;
}

function addDays(date: string, days: number): string {
  return new Date(
    new Date(`${date}T00:00:00Z`).getTime() + days * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10);
}

function dateRangeList(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    dates.push(d);
    if (dates.length > 730) break;
  }
  return dates;
}

/** Dominant domain per user, by event count (payout rows carry no world). */
function dominantWorldByUser(events: TaskEvent[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const event of events) {
    if (!event.userId) continue;
    const domain = domainForWorld(event.worldId);
    let inner = counts.get(event.userId);
    if (!inner) {
      inner = new Map();
      counts.set(event.userId, inner);
    }
    inner.set(domain, (inner.get(domain) ?? 0) + 1);
  }
  const result = new Map<string, string>();
  for (const [userId, inner] of counts) {
    let best = OTHER_DOMAIN;
    let bestCount = -1;
    for (const [domain, count] of inner) {
      if (count > bestCount) {
        best = domain;
        bestCount = count;
      }
    }
    result.set(userId, best);
  }
  return result;
}

const PIPELINE_ORDER = ["pending", "awaiting review", "review", "approved"];

function pipelineStageForStatus(status: string): string {
  if (APPROVED_STATUSES.has(status)) return "approved";
  if (AWAITING_REVIEW_STATUSES.has(status)) return "awaiting review";
  if (status.includes("review")) return "review";
  if (status.includes("pending") || status.includes("progress")) {
    return "pending";
  }
  return status;
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function computeDashboardV2(
  raw: RawData,
  filters: V2Filters,
  today: string,
): DashboardV2Data {
  const start = filters.start ?? DEFAULT_START;
  const end = filters.end ?? today;
  const window: DateWindow = { start, end };

  const userInfo = new Map<string, UserInfo>();
  for (const user of raw.users) userInfo.set(user.userId, user);
  const worldByUser = dominantWorldByUser(raw.events);

  const nameOf = (userId: string): string => {
    const info = userInfo.get(userId);
    if (info?.name) return info.name;
    const fromEvents = raw.events.find(
      (e) => e.userId === userId && e.userName,
    );
    return fromEvents?.userName ?? userId;
  };
  const emailOf = (userId: string): string | null =>
    userInfo.get(userId)?.email ?? null;

  // --- Expert / email / world filters -> allowed user set (null = all) ---
  let allowedUsers: Set<string> | null = null;
  const expertNeedle = filters.expert?.toLowerCase() ?? null;
  const emailNeedle = filters.email?.toLowerCase() ?? null;
  if (expertNeedle || emailNeedle || filters.world) {
    allowedUsers = new Set();
    const candidates = new Set<string>();
    for (const user of raw.users) candidates.add(user.userId);
    for (const event of raw.events) {
      if (event.userId) candidates.add(event.userId);
    }
    for (const payout of raw.payouts) candidates.add(payout.userId);
    for (const userId of candidates) {
      if (
        expertNeedle &&
        !nameOf(userId).toLowerCase().includes(expertNeedle) &&
        !userId.toLowerCase().includes(expertNeedle)
      ) {
        continue;
      }
      if (emailNeedle) {
        const email = emailOf(userId);
        if (!email || !email.toLowerCase().includes(emailNeedle)) continue;
      }
      if (
        filters.world &&
        (worldByUser.get(userId) ?? OTHER_DOMAIN) !== filters.world
      ) {
        continue;
      }
      allowedUsers.add(userId);
    }
  }

  const userAllowed = (userId: string | null): boolean =>
    allowedUsers === null || (userId !== null && allowedUsers.has(userId));

  // --- Filtered event/payout sets ---
  const events = raw.events.filter((event) => {
    if (!inWindow(utcDate(event.createdAt), window)) return false;
    if (filters.world && domainForWorld(event.worldId) !== filters.world) {
      return false;
    }
    if ((expertNeedle || emailNeedle) && !userAllowed(event.userId)) {
      return false;
    }
    return true;
  });
  const payouts = raw.payouts.filter(
    (row) => inWindow(row.date, window) && userAllowed(row.userId),
  );
  const timers = raw.timers.filter(
    (row) => inWindow(row.date, window) && userAllowed(row.userId),
  );

  const oneShots = oneShotByTask(events);
  const firstApprovals = firstApprovalByTask(events);
  const taskWriters = taskWriterByTask(events);

  // --- Daily series with trailing 7-day averages ---
  const dates = dateRangeList(start, end);
  const byDate = new Map<
    string,
    {
      submitted: number;
      approved: number;
      writer: number;
      reviewer: number;
      hours: number;
      payable: number;
      oneShotHits: number;
      oneShotEligible: number;
    }
  >();
  for (const date of dates) {
    byDate.set(date, {
      submitted: 0,
      approved: 0,
      writer: 0,
      reviewer: 0,
      hours: 0,
      payable: 0,
      oneShotHits: 0,
      oneShotEligible: 0,
    });
  }
  for (const event of events) {
    const day = byDate.get(utcDate(event.createdAt));
    if (!day) continue;
    if (isWriterEvent(event)) {
      day.writer += 1;
      if (event.action === "submit") day.submitted += 1;
    } else if (isReviewerEvent(event)) {
      day.reviewer += 1;
    }
  }
  for (const approvedAt of firstApprovals.values()) {
    const day = byDate.get(utcDate(approvedAt));
    if (day) day.approved += 1;
  }
  for (const outcome of oneShots.values()) {
    const day = byDate.get(utcDate(outcome.firstDecisionAt));
    if (!day) continue;
    day.oneShotEligible += 1;
    if (outcome.oneShot) day.oneShotHits += 1;
  }
  for (const payout of payouts) {
    const day = byDate.get(payout.date);
    if (!day) continue;
    day.hours += payout.hours;
    day.payable += payout.payable;
  }

  const daily: DailySeriesPoint[] = dates.map((date, index) => {
    const day = byDate.get(date);
    const trailing = dates.slice(Math.max(0, index - 6), index + 1);
    let submitted7 = 0;
    let approved7 = 0;
    let writer7 = 0;
    let reviewer7 = 0;
    let hours7 = 0;
    let payable7 = 0;
    let hits7 = 0;
    let eligible7 = 0;
    for (const d of trailing) {
      const t = byDate.get(d);
      if (!t) continue;
      submitted7 += t.submitted;
      approved7 += t.approved;
      writer7 += t.writer;
      reviewer7 += t.reviewer;
      hours7 += t.hours;
      payable7 += t.payable;
      hits7 += t.oneShotHits;
      eligible7 += t.oneShotEligible;
    }
    const n = trailing.length;
    return {
      date,
      oneShotRate: day ? safeRate(day.oneShotHits, day.oneShotEligible) : null,
      oneShotRate7d: safeRate(hits7, eligible7),
      submittedUnits: toUnits(day?.submitted ?? 0),
      submittedUnits7d: toUnits(submitted7 / n),
      approvedUnits: toUnits(day?.approved ?? 0),
      approvedUnits7d: toUnits(approved7 / n),
      writerUnits: toUnits(day?.writer ?? 0),
      writerUnits7d: toUnits(writer7 / n),
      reviewerUnits: toUnits(day?.reviewer ?? 0),
      reviewerUnits7d: toUnits(reviewer7 / n),
      hours: day?.hours ?? 0,
      hours7d: hours7 / n,
      payable: day?.payable ?? 0,
      payable7d: payable7 / n,
    };
  });

  // --- KPI cards with last-7 vs previous-7 comparisons ---
  const last7Window: DateWindow = { start: addDays(end, -6), end };
  const prev7Window: DateWindow = {
    start: addDays(end, -13),
    end: addDays(end, -7),
  };
  const sumPayouts = (
    rows: PayoutRow[],
    w: DateWindow,
    pick: (row: PayoutRow) => number,
  ): number => {
    let total = 0;
    for (const row of rows) {
      if (inWindow(row.date, w)) total += pick(row);
    }
    return total;
  };
  const totalHours = sumPayouts(payouts, window, (r) => r.hours);
  const totalPayable = sumPayouts(payouts, window, (r) => r.payable);
  const hoursLast7 = sumPayouts(payouts, last7Window, (r) => r.hours);
  const hoursPrev7 = sumPayouts(payouts, prev7Window, (r) => r.hours);
  const payableLast7 = sumPayouts(payouts, last7Window, (r) => r.payable);
  const payablePrev7 = sumPayouts(payouts, prev7Window, (r) => r.payable);

  const approvalsIn = (w: DateWindow): number => {
    let count = 0;
    for (const approvedAt of firstApprovals.values()) {
      if (inWindow(utcDate(approvedAt), w)) count += 1;
    }
    return count;
  };
  const approvedRaw = firstApprovals.size;
  const approvedUnits = toUnits(approvedRaw);
  const approvedLast7 = toUnits(approvalsIn(last7Window));
  const approvedPrev7 = toUnits(approvalsIn(prev7Window));

  const kpi = (
    value: number | null,
    last7: number | null,
    prev7: number | null,
  ): KpiValue => ({ value, last7, prev7 });

  const kpis = {
    totalHours: kpi(totalHours, hoursLast7, hoursPrev7),
    totalPayable: kpi(totalPayable, payableLast7, payablePrev7),
    approvedUnits: kpi(approvedUnits, approvedLast7, approvedPrev7),
    approvedAht: kpi(
      safeRate(totalHours, approvedUnits),
      safeRate(hoursLast7, approvedLast7),
      safeRate(hoursPrev7, approvedPrev7),
    ),
  };

  // --- Pipeline (current statuses; not date-filtered) ---
  const statuses = raw.statuses.filter((row) => {
    if (EXCLUDED_STATUSES.has(row.status)) return false;
    if (filters.world && domainForWorld(row.worldId) !== filters.world) {
      return false;
    }
    return true;
  });
  const stageCounts = new Map<string, number>();
  for (const row of statuses) {
    const stage = pipelineStageForStatus(row.status);
    stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1);
  }
  const pipeline: PipelineStage[] = [...stageCounts.entries()]
    .sort((a, b) => {
      const ai = PIPELINE_ORDER.indexOf(a[0]);
      const bi = PIPELINE_ORDER.indexOf(b[0]);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return b[1] - a[1];
    })
    .map(([stage, count]) => ({
      stage: titleCase(stage),
      units: toUnits(count),
    }));

  // --- Review outcomes ---
  let oneShotHits = 0;
  let oneShotEligible = 0;
  for (const outcome of oneShots.values()) {
    oneShotEligible += 1;
    if (outcome.oneShot) oneShotHits += 1;
  }
  const oneShotRate = safeRate(oneShotHits, oneShotEligible);
  const quality = {
    oneShotRate,
    reworkRate: oneShotRate === null ? null : 1 - oneShotRate,
  };

  // Review attempts before approval: reviewer decisions per task up to and
  // including its first approval.
  const decisionsByTask = new Map<string, string[]>();
  for (const event of events) {
    if (!isReviewerEvent(event)) continue;
    let list = decisionsByTask.get(event.taskId);
    if (!list) {
      list = [];
      decisionsByTask.set(event.taskId, list);
    }
    list.push(`${event.createdAt}|${event.action}`);
  }
  const bucketCounts = new Map<string, number>([
    ["One Shot", 0],
    ["2", 0],
    ["3", 0],
    ["4+", 0],
  ]);
  let approvedTotal = 0;
  for (const [taskId, decisions] of decisionsByTask) {
    if (!firstApprovals.has(taskId)) continue;
    decisions.sort();
    let attempts = 0;
    for (const decision of decisions) {
      attempts += 1;
      if (decision.endsWith("|approve")) break;
    }
    approvedTotal += 1;
    const bucket =
      attempts <= 1 ? "One Shot" : attempts === 2 ? "2" : attempts === 3 ? "3" : "4+";
    bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1);
  }
  const reviewAttempts: ReviewAttemptBucket[] = [...bucketCounts.entries()].map(
    ([bucket, count]) => ({
      bucket,
      approvedUnits: toUnits(count),
      share: safeRate(count, approvedTotal),
    }),
  );

  // --- Contributors ---
  const approvedTaskIds = new Set(
    statuses
      .filter((row) => APPROVED_STATUSES.has(row.status))
      .map((row) => row.taskId),
  );
  const contributorIds = new Set<string>();
  for (const event of events) {
    if (event.userId) contributorIds.add(event.userId);
  }
  const payoutByUser = new Map<
    string,
    { hours: number; payable: number; writerHours: number; reviewerHours: number; lastActive: string | null }
  >();
  for (const payout of payouts) {
    let agg = payoutByUser.get(payout.userId);
    if (!agg) {
      agg = {
        hours: 0,
        payable: 0,
        writerHours: 0,
        reviewerHours: 0,
        lastActive: null,
      };
      payoutByUser.set(payout.userId, agg);
    }
    agg.hours += payout.hours;
    agg.payable += payout.payable;
    agg.writerHours += payout.writerHours;
    agg.reviewerHours += payout.reviewerHours;
    if (!agg.lastActive || payout.date > agg.lastActive) {
      agg.lastActive = payout.date;
    }
  }
  // The payout mart's role split is often zero-filled; fall back to the
  // campaign timer logs for per-user writer/reviewer hours in that case.
  const timerHoursByUser = new Map<
    string,
    { writer: number; reviewer: number }
  >();
  for (const timer of timers) {
    let agg = timerHoursByUser.get(timer.userId);
    if (!agg) {
      agg = { writer: 0, reviewer: 0 };
      timerHoursByUser.set(timer.userId, agg);
    }
    if (timer.timer === "writer") {
      agg.writer += timer.hours;
    } else {
      agg.reviewer += timer.hours;
    }
  }

  const contributors: ContributorRow[] = [];
  for (const userId of contributorIds) {
    const userEvents = events.filter((event) => event.userId === userId);
    const written = new Set<string>();
    let reviewerRaw = 0;
    const reviewed = new Set<string>();
    for (const event of userEvents) {
      if (isWriterEvent(event)) {
        written.add(event.taskId);
      } else {
        reviewerRaw += 1;
        reviewed.add(event.taskId);
      }
    }
    const authored = new Set<string>();
    for (const [taskId, writerId] of taskWriters) {
      if (writerId === userId) authored.add(taskId);
    }
    const approvedAuthoredRaw = [...authored].filter((taskId) =>
      approvedTaskIds.has(taskId),
    ).length;
    const payout = payoutByUser.get(userId);
    const timerHours = timerHoursByUser.get(userId);
    const writerHours = payout?.writerHours || timerHours?.writer || 0;
    const reviewerHours = payout?.reviewerHours || timerHours?.reviewer || 0;
    const tasksWritten = toUnits(written.size);
    const reviewerUnits = toUnits(reviewerRaw);
    contributors.push({
      userId,
      name: nameOf(userId),
      email: emailOf(userId),
      world: worldByUser.get(userId) ?? OTHER_DOMAIN,
      tasksWritten,
      tasksApproved: toUnits(approvedAuthoredRaw),
      writerHours,
      writerAht: safeRate(writerHours, tasksWritten),
      reviewerUnits,
      reviewerHours,
      reviewerAht: safeRate(reviewerHours, reviewerUnits),
      oneShotRate: (() => {
        let hits = 0;
        let eligible = 0;
        for (const taskId of authored) {
          const outcome = oneShots.get(taskId);
          if (!outcome) continue;
          eligible += 1;
          if (outcome.oneShot) hits += 1;
        }
        return safeRate(hits, eligible);
      })(),
    });
  }
  contributors.sort((a, b) => b.tasksWritten - a.tasksWritten);

  // --- Spend & roster ---
  const spend = {
    totalPayable,
    payableLast7Days: payableLast7,
    averageRatePerHour: safeRate(totalPayable, totalHours),
  };

  const lastEventByUser = new Map<string, string>();
  for (const event of events) {
    if (!event.userId) continue;
    const date = utcDate(event.createdAt);
    const existing = lastEventByUser.get(event.userId);
    if (!existing || date > existing) lastEventByUser.set(event.userId, date);
  }
  const inactiveCutoff = addDays(today, -7);
  const rosterIds = new Set<string>([
    ...payoutByUser.keys(),
    ...contributorIds,
  ]);
  const roster: RosterRow[] = [...rosterIds].map((userId) => {
    const payout = payoutByUser.get(userId);
    const hours = payout?.hours ?? 0;
    const payable = payout?.payable ?? 0;
    const lastActive =
      [payout?.lastActive ?? null, lastEventByUser.get(userId) ?? null]
        .filter((d): d is string => d !== null)
        .sort()
        .pop() ?? null;
    return {
      userId,
      name: nameOf(userId),
      email: emailOf(userId),
      world: worldByUser.get(userId) ?? OTHER_DOMAIN,
      hours,
      payable,
      ratePerHour: safeRate(payable, hours),
      lastActive,
      inactive: lastActive === null || lastActive < inactiveCutoff,
    };
  });
  roster.sort((a, b) => b.payable - a.payable);

  return {
    campaignName: CAMPAIGN_NAME,
    projectId: PROJECT_ID,
    fetchedAt: raw.fetchedAt,
    source: raw.source,
    liveStatuses: raw.liveStatuses,
    filters: {
      start,
      end,
      world: filters.world,
      expert: filters.expert,
      email: filters.email,
    },
    worlds: [...Object.values(WORLD_DOMAINS), OTHER_DOMAIN],
    kpis,
    daily,
    pipeline,
    quality,
    reviewAttempts,
    contributors,
    spend,
    roster,
  };
}
