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
import type {
  DailyTrendPoint,
  DashboardData,
  DomainMetrics,
  ExpertMetrics,
  OverallMetrics,
  RawData,
  Rolling7DayMetrics,
  ScaledCount,
  StatusBreakdownRow,
  TaskEvent,
  TimerRow,
} from "./types";

/**
 * The /2 display transformation for task-related count metrics.
 * Applied exactly once, at metric-assembly time; `raw` stays auditable.
 * Never applied to rates, percentages, timer hours, or AHT.
 */
export function scaleTaskCount(raw: number): ScaledCount {
  return { raw, display: raw / 2 };
}

export function isWriterEvent(event: TaskEvent): boolean {
  return event.role === "writer";
}

export function isReviewerEvent(event: TaskEvent): boolean {
  return event.role === "reviewer";
}

/** Rate = numerator / denominator, null when the denominator is 0. */
export function safeRate(
  numerator: number,
  denominator: number,
): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

/** UTC date (YYYY-MM-DD) of an ISO timestamp. */
export function utcDate(isoTimestamp: string): string {
  return isoTimestamp.slice(0, 10);
}

export interface DateWindow {
  /** Inclusive YYYY-MM-DD, or null for unbounded. */
  start: string | null;
  /** Inclusive YYYY-MM-DD, or null for unbounded. */
  end: string | null;
}

export function inWindow(date: string, window: DateWindow): boolean {
  if (window.start && date < window.start) return false;
  if (window.end && date > window.end) return false;
  return true;
}

/** Rolling window of the last 7 calendar days ending at `end` (UTC, inclusive). */
export function rolling7Window(end: string): DateWindow {
  const endDate = new Date(`${end}T00:00:00Z`);
  const startDate = new Date(endDate.getTime() - 6 * 24 * 60 * 60 * 1000);
  return { start: startDate.toISOString().slice(0, 10), end };
}

/**
 * One-shot outcome per task: eligible when the task has at least one reviewer
 * decision; a one-shot when the chronologically first reviewer decision is an
 * approve. Rates are never divided by 2.
 */
export function oneShotByTask(
  events: TaskEvent[],
): Map<string, { oneShot: boolean; firstDecisionAt: string }> {
  const firstDecision = new Map<
    string,
    { action: string; createdAt: string }
  >();
  for (const event of events) {
    if (!isReviewerEvent(event)) continue;
    const existing = firstDecision.get(event.taskId);
    if (!existing || event.createdAt < existing.createdAt) {
      firstDecision.set(event.taskId, {
        action: event.action,
        createdAt: event.createdAt,
      });
    }
  }
  const result = new Map<string, { oneShot: boolean; firstDecisionAt: string }>();
  for (const [taskId, decision] of firstDecision) {
    result.set(taskId, {
      oneShot: decision.action === "approve",
      firstDecisionAt: decision.createdAt,
    });
  }
  return result;
}

function oneShotRateForTasks(
  taskIds: Iterable<string>,
  oneShots: Map<string, { oneShot: boolean; firstDecisionAt: string }>,
): number | null {
  let eligible = 0;
  let hits = 0;
  for (const taskId of taskIds) {
    const outcome = oneShots.get(taskId);
    if (!outcome) continue;
    eligible += 1;
    if (outcome.oneShot) hits += 1;
  }
  return safeRate(hits, eligible);
}

/** First-approval timestamp per task (used for "approved in last 7 days"). */
export function firstApprovalByTask(events: TaskEvent[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const event of events) {
    if (!isReviewerEvent(event) || event.action !== "approve") continue;
    const existing = result.get(event.taskId);
    if (!existing || event.createdAt < existing) {
      result.set(event.taskId, event.createdAt);
    }
  }
  return result;
}

/** Author of the first writer submission per task (expert attribution). */
export function taskWriterByTask(events: TaskEvent[]): Map<string, string> {
  const firstWriterEvent = new Map<string, TaskEvent>();
  for (const event of events) {
    if (!isWriterEvent(event) || !event.userId) continue;
    const existing = firstWriterEvent.get(event.taskId);
    if (!existing || event.createdAt < existing.createdAt) {
      firstWriterEvent.set(event.taskId, event);
    }
  }
  const result = new Map<string, string>();
  for (const [taskId, event] of firstWriterEvent) {
    if (event.userId) result.set(taskId, event.userId);
  }
  return result;
}

function sumTimerHours(
  timers: TimerRow[],
  timer: "writer" | "reviewer",
  window: DateWindow,
  userId?: string,
): number {
  let total = 0;
  for (const row of timers) {
    if (row.timer !== timer) continue;
    if (userId !== undefined && row.userId !== userId) continue;
    if (!inWindow(row.date, window)) continue;
    total += row.hours;
  }
  return total;
}

interface EventAgg {
  writerUnits: number;
  reviewerUnits: number;
  tasksWritten: Set<string>;
  tasksReviewed: Set<string>;
}

function newAgg(): EventAgg {
  return {
    writerUnits: 0,
    reviewerUnits: 0,
    tasksWritten: new Set(),
    tasksReviewed: new Set(),
  };
}

function addEvent(agg: EventAgg, event: TaskEvent): void {
  if (isWriterEvent(event)) {
    agg.writerUnits += 1;
    agg.tasksWritten.add(event.taskId);
  } else {
    agg.reviewerUnits += 1;
    agg.tasksReviewed.add(event.taskId);
  }
}

function aggregateEvents(events: TaskEvent[], window: DateWindow): EventAgg {
  const agg = newAgg();
  for (const event of events) {
    if (!inWindow(utcDate(event.createdAt), window)) continue;
    addEvent(agg, event);
  }
  return agg;
}

function countApprovedInWindow(
  firstApprovals: Map<string, string>,
  window: DateWindow,
  taskFilter?: (taskId: string) => boolean,
): number {
  let count = 0;
  for (const [taskId, approvedAt] of firstApprovals) {
    if (taskFilter && !taskFilter(taskId)) continue;
    if (inWindow(utcDate(approvedAt), window)) count += 1;
  }
  return count;
}

export function computeDashboard(
  raw: RawData,
  dateRange: DateWindow,
  today: string,
): DashboardData {
  const events = raw.events.filter((event) =>
    inWindow(utcDate(event.createdAt), dateRange),
  );
  const oneShots = oneShotByTask(events);
  const firstApprovals = firstApprovalByTask(events);
  const taskWriters = taskWriterByTask(events);
  const last7 = rolling7Window(dateRange.end ?? today);

  const includedStatuses = raw.statuses.filter(
    (row) => !EXCLUDED_STATUSES.has(row.status),
  );

  // --- Overall ---
  const all = aggregateEvents(events, { start: null, end: null });
  const last7Agg = aggregateEvents(events, last7);
  const approvedCount = includedStatuses.filter((row) =>
    APPROVED_STATUSES.has(row.status),
  ).length;
  const awaitingCount = includedStatuses.filter((row) =>
    AWAITING_REVIEW_STATUSES.has(row.status),
  ).length;
  const writerHours = sumTimerHours(raw.timers, "writer", dateRange);
  const reviewerHours = sumTimerHours(raw.timers, "reviewer", dateRange);

  const overall: OverallMetrics = {
    totalTasks: scaleTaskCount(includedStatuses.length),
    approvedTasks: scaleTaskCount(approvedCount),
    awaitingReview: scaleTaskCount(awaitingCount),
    writerUnits: scaleTaskCount(all.writerUnits),
    reviewerUnits: scaleTaskCount(all.reviewerUnits),
    uniqueTasksWritten: scaleTaskCount(all.tasksWritten.size),
    uniqueTasksReviewed: scaleTaskCount(all.tasksReviewed.size),
    oneShotRate: oneShotRateForTasks(oneShots.keys(), oneShots),
    approvedLast7Days: scaleTaskCount(
      countApprovedInWindow(firstApprovals, last7),
    ),
    writerUnitsLast7Days: scaleTaskCount(last7Agg.writerUnits),
    reviewerUnitsLast7Days: scaleTaskCount(last7Agg.reviewerUnits),
    writerTimerHours: writerHours,
    reviewerTimerHours: reviewerHours,
    writerAhtPerUnit: safeRate(writerHours, all.writerUnits),
    writerAhtPerUniqueTask: safeRate(writerHours, all.tasksWritten.size),
    reviewerAhtPerUnit: safeRate(reviewerHours, all.reviewerUnits),
    reviewerAhtPerUniqueReview: safeRate(reviewerHours, all.tasksReviewed.size),
  };

  // --- Domains ---
  const domainOrder = [...Object.values(WORLD_DOMAINS), OTHER_DOMAIN];
  const domainAggs = new Map<string, EventAgg>();
  const domainTasks = new Map<string, Set<string>>();
  for (const name of domainOrder) {
    domainAggs.set(name, newAgg());
    domainTasks.set(name, new Set());
  }
  const taskDomain = new Map<string, string>();
  for (const row of includedStatuses) {
    taskDomain.set(row.taskId, domainForWorld(row.worldId));
  }
  for (const event of events) {
    const domain = domainForWorld(event.worldId);
    if (!taskDomain.has(event.taskId)) {
      taskDomain.set(event.taskId, domain);
    }
    addEvent(domainAggs.get(domain) ?? newAgg(), event);
  }
  const worldByDomain = new Map<string, string>(
    Object.entries(WORLD_DOMAINS).map(([worldId, name]) => [name, worldId]),
  );
  const domains: DomainMetrics[] = domainOrder.map((name) => {
    const agg = domainAggs.get(name) ?? newAgg();
    const statusRows = includedStatuses.filter(
      (row) => domainForWorld(row.worldId) === name,
    );
    const domainTaskIds = new Set<string>();
    for (const [taskId, domain] of taskDomain) {
      if (domain === name) domainTaskIds.add(taskId);
    }
    return {
      domain: name,
      worldId: worldByDomain.get(name) ?? null,
      totalTasks: scaleTaskCount(statusRows.length),
      approvedTasks: scaleTaskCount(
        statusRows.filter((row) => APPROVED_STATUSES.has(row.status)).length,
      ),
      awaitingReview: scaleTaskCount(
        statusRows.filter((row) => AWAITING_REVIEW_STATUSES.has(row.status))
          .length,
      ),
      approvedLast7Days: scaleTaskCount(
        countApprovedInWindow(firstApprovals, last7, (taskId) =>
          domainTaskIds.has(taskId),
        ),
      ),
      oneShotRate: oneShotRateForTasks(domainTaskIds, oneShots),
      writerUnits: scaleTaskCount(agg.writerUnits),
      reviewerUnits: scaleTaskCount(agg.reviewerUnits),
      uniqueTasksWritten: scaleTaskCount(agg.tasksWritten.size),
      uniqueTasksReviewed: scaleTaskCount(agg.tasksReviewed.size),
    };
  });

  // --- Rolling 7-day ---
  const daily: DailyTrendPoint[] = [];
  const windowStart = last7.start ?? today;
  for (let i = 0; i < 7; i++) {
    const date = new Date(
      new Date(`${windowStart}T00:00:00Z`).getTime() + i * 24 * 60 * 60 * 1000,
    )
      .toISOString()
      .slice(0, 10);
    const dayAgg = aggregateEvents(events, { start: date, end: date });
    daily.push({
      date,
      approvedTasks: scaleTaskCount(
        countApprovedInWindow(firstApprovals, { start: date, end: date }),
      ),
      tasksWritten: scaleTaskCount(dayAgg.tasksWritten.size),
      tasksReviewed: scaleTaskCount(dayAgg.tasksReviewed.size),
      writerUnits: scaleTaskCount(dayAgg.writerUnits),
      reviewerUnits: scaleTaskCount(dayAgg.reviewerUnits),
      uniqueTasksWritten: scaleTaskCount(dayAgg.tasksWritten.size),
      uniqueTasksReviewed: scaleTaskCount(dayAgg.tasksReviewed.size),
    });
  }
  const writerHours7 = sumTimerHours(raw.timers, "writer", last7);
  const reviewerHours7 = sumTimerHours(raw.timers, "reviewer", last7);
  const eligible7: string[] = [];
  for (const [taskId, outcome] of oneShots) {
    if (inWindow(utcDate(outcome.firstDecisionAt), last7)) {
      eligible7.push(taskId);
    }
  }
  const rolling7: Rolling7DayMetrics = {
    windowStart,
    windowEnd: last7.end ?? today,
    approvedTasks: scaleTaskCount(countApprovedInWindow(firstApprovals, last7)),
    tasksWritten: scaleTaskCount(last7Agg.tasksWritten.size),
    tasksReviewed: scaleTaskCount(last7Agg.tasksReviewed.size),
    writerUnits: scaleTaskCount(last7Agg.writerUnits),
    reviewerUnits: scaleTaskCount(last7Agg.reviewerUnits),
    uniqueTasksWritten: scaleTaskCount(last7Agg.tasksWritten.size),
    uniqueTasksReviewed: scaleTaskCount(last7Agg.tasksReviewed.size),
    oneShotRate: oneShotRateForTasks(eligible7, oneShots),
    writerAhtPerUnit: safeRate(writerHours7, last7Agg.writerUnits),
    reviewerAhtPerUnit: safeRate(reviewerHours7, last7Agg.reviewerUnits),
    daily,
  };

  // --- Experts ---
  const approvedTaskIds = new Set(
    includedStatuses
      .filter((row) => APPROVED_STATUSES.has(row.status))
      .map((row) => row.taskId),
  );
  const expertIds = new Set<string>();
  for (const event of events) {
    if (event.userId) expertIds.add(event.userId);
  }
  const nameByUser = new Map<string, string>();
  for (const event of events) {
    if (event.userId && event.userName && !nameByUser.has(event.userId)) {
      nameByUser.set(event.userId, event.userName);
    }
  }
  const experts: ExpertMetrics[] = [];
  for (const userId of expertIds) {
    const userEvents = events.filter((event) => event.userId === userId);
    const agg = aggregateEvents(userEvents, { start: null, end: null });
    const agg7 = aggregateEvents(userEvents, last7);
    const writtenTasks = agg.tasksWritten;
    const authoredTasks = new Set<string>();
    for (const [taskId, writerId] of taskWriters) {
      if (writerId === userId) authoredTasks.add(taskId);
    }
    const approvedAuthored = [...authoredTasks].filter((taskId) =>
      approvedTaskIds.has(taskId),
    ).length;
    const expertWriterHours = sumTimerHours(
      raw.timers,
      "writer",
      dateRange,
      userId,
    );
    const expertReviewerHours = sumTimerHours(
      raw.timers,
      "reviewer",
      dateRange,
      userId,
    );
    const approved7 = countApprovedInWindow(firstApprovals, last7, (taskId) =>
      authoredTasks.has(taskId),
    );
    experts.push({
      userId,
      userName: nameByUser.get(userId) ?? userId,
      uniqueTasksWritten: scaleTaskCount(writtenTasks.size),
      writerUnits: scaleTaskCount(agg.writerUnits),
      approvedTasks: scaleTaskCount(approvedAuthored),
      tasksIncluded: scaleTaskCount(
        new Set([...agg.tasksWritten, ...agg.tasksReviewed]).size,
      ),
      reviewerUnits: scaleTaskCount(agg.reviewerUnits),
      uniqueTasksReviewed: scaleTaskCount(agg.tasksReviewed.size),
      oneShotRate: oneShotRateForTasks(authoredTasks, oneShots),
      writerTimerHours: expertWriterHours,
      reviewerTimerHours: expertReviewerHours,
      writerAht: safeRate(expertWriterHours, writtenTasks.size),
      reviewerAht: safeRate(expertReviewerHours, agg.tasksReviewed.size),
      last7: {
        writerUnits: scaleTaskCount(agg7.writerUnits),
        reviewerUnits: scaleTaskCount(agg7.reviewerUnits),
        uniqueTasksWritten: scaleTaskCount(agg7.tasksWritten.size),
        uniqueTasksReviewed: scaleTaskCount(agg7.tasksReviewed.size),
        approvedTasks: scaleTaskCount(approved7),
      },
    });
  }
  experts.sort(
    (a, b) => b.uniqueTasksWritten.raw - a.uniqueTasksWritten.raw,
  );

  // --- Status breakdown (includes excluded statuses for transparency) ---
  const statusCounts = new Map<string, number>();
  for (const row of raw.statuses) {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
  }
  const statusBreakdown: StatusBreakdownRow[] = [...statusCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => ({ status, count: scaleTaskCount(count) }));

  return {
    campaignName: CAMPAIGN_NAME,
    projectId: PROJECT_ID,
    fetchedAt: raw.fetchedAt,
    source: raw.source,
    liveStatuses: raw.liveStatuses,
    dateRange: { start: dateRange.start, end: dateRange.end },
    overall,
    domains,
    rolling7,
    experts,
    statusBreakdown,
  };
}
