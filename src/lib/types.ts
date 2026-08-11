export type Role = "writer" | "reviewer";
export type WriterAction = "submit" | "revise";
export type ReviewerAction = "approve" | "reject";

/** One task-version event (a writer submission/revision or a reviewer decision). */
export interface TaskEvent {
  taskId: string;
  worldId: string | null;
  role: Role;
  action: WriterAction | ReviewerAction;
  /** ISO 8601 UTC timestamp of the event. */
  createdAt: string;
  userId: string | null;
  userName: string | null;
}

/** Current status of a task (latest version). */
export interface TaskStatusRow {
  taskId: string;
  worldId: string | null;
  status: string;
}

/** Daily timer hours per user per timer. */
export interface TimerRow {
  userId: string;
  timer: Role;
  /** UTC date, YYYY-MM-DD. */
  date: string;
  hours: number;
}

/** Daily payable/hours per user (from contractor payout marts). */
export interface PayoutRow {
  userId: string;
  /** UTC date, YYYY-MM-DD. */
  date: string;
  payable: number;
  hours: number;
  writerHours: number;
  reviewerHours: number;
}

/** Identity map for contributor names/emails. */
export interface UserInfo {
  userId: string;
  name: string | null;
  email: string | null;
}

export interface RawData {
  events: TaskEvent[];
  statuses: TaskStatusRow[];
  timers: TimerRow[];
  payouts: PayoutRow[];
  users: UserInfo[];
  fetchedAt: string;
  source: "snowflake" | "snapshot";
  /** True when current task statuses were fetched live from the Studio API. */
  liveStatuses: boolean;
}

/** A task count kept raw and displayed (/2) side by side for auditability. */
export interface ScaledCount {
  raw: number;
  display: number;
}

export interface OverallMetrics {
  totalTasks: ScaledCount;
  approvedTasks: ScaledCount;
  awaitingReview: ScaledCount;
  writerUnits: ScaledCount;
  reviewerUnits: ScaledCount;
  uniqueTasksWritten: ScaledCount;
  uniqueTasksReviewed: ScaledCount;
  oneShotRate: number | null;
  approvedLast7Days: ScaledCount;
  writerUnitsLast7Days: ScaledCount;
  reviewerUnitsLast7Days: ScaledCount;
  writerTimerHours: number;
  reviewerTimerHours: number;
  writerAhtPerUnit: number | null;
  writerAhtPerUniqueTask: number | null;
  reviewerAhtPerUnit: number | null;
  reviewerAhtPerUniqueReview: number | null;
}

export interface DomainMetrics {
  domain: string;
  worldId: string | null;
  totalTasks: ScaledCount;
  approvedTasks: ScaledCount;
  awaitingReview: ScaledCount;
  approvedLast7Days: ScaledCount;
  oneShotRate: number | null;
  writerUnits: ScaledCount;
  reviewerUnits: ScaledCount;
  uniqueTasksWritten: ScaledCount;
  uniqueTasksReviewed: ScaledCount;
}

export interface DailyTrendPoint {
  date: string;
  approvedTasks: ScaledCount;
  tasksWritten: ScaledCount;
  tasksReviewed: ScaledCount;
  writerUnits: ScaledCount;
  reviewerUnits: ScaledCount;
  uniqueTasksWritten: ScaledCount;
  uniqueTasksReviewed: ScaledCount;
}

export interface Rolling7DayMetrics {
  windowStart: string;
  windowEnd: string;
  approvedTasks: ScaledCount;
  tasksWritten: ScaledCount;
  tasksReviewed: ScaledCount;
  writerUnits: ScaledCount;
  reviewerUnits: ScaledCount;
  uniqueTasksWritten: ScaledCount;
  uniqueTasksReviewed: ScaledCount;
  oneShotRate: number | null;
  writerAhtPerUnit: number | null;
  reviewerAhtPerUnit: number | null;
  daily: DailyTrendPoint[];
}

export interface ExpertMetrics {
  userId: string;
  userName: string;
  uniqueTasksWritten: ScaledCount;
  writerUnits: ScaledCount;
  approvedTasks: ScaledCount;
  tasksIncluded: ScaledCount;
  reviewerUnits: ScaledCount;
  uniqueTasksReviewed: ScaledCount;
  oneShotRate: number | null;
  writerTimerHours: number;
  reviewerTimerHours: number;
  writerAht: number | null;
  reviewerAht: number | null;
  last7: {
    writerUnits: ScaledCount;
    reviewerUnits: ScaledCount;
    uniqueTasksWritten: ScaledCount;
    uniqueTasksReviewed: ScaledCount;
    approvedTasks: ScaledCount;
  };
}

export interface StatusBreakdownRow {
  status: string;
  count: ScaledCount;
}

export interface DashboardData {
  campaignName: string;
  projectId: string;
  fetchedAt: string;
  source: "snowflake" | "snapshot";
  liveStatuses: boolean;
  dateRange: { start: string | null; end: string | null };
  overall: OverallMetrics;
  domains: DomainMetrics[];
  rolling7: Rolling7DayMetrics;
  experts: ExpertMetrics[];
  statusBreakdown: StatusBreakdownRow[];
}

// ---------------------------------------------------------------------------
// v2 dashboard (Project Performance) payload
// ---------------------------------------------------------------------------

/** A KPI value plus an optional trend vs. the previous 7-day period. */
export interface KpiValue {
  value: number | null;
  /** Last-7-days value, when available. */
  last7: number | null;
  /** Previous-7-days value, when available. */
  prev7: number | null;
}

export interface DailySeriesPoint {
  date: string;
  oneShotRate: number | null;
  oneShotRate7d: number | null;
  submittedUnits: number;
  submittedUnits7d: number;
  approvedUnits: number;
  approvedUnits7d: number;
  writerUnits: number;
  writerUnits7d: number;
  reviewerUnits: number;
  reviewerUnits7d: number;
  hours: number;
  hours7d: number;
  payable: number;
  payable7d: number;
}

export interface PipelineStage {
  stage: string;
  units: number;
}

export interface ReviewAttemptBucket {
  bucket: string;
  approvedUnits: number;
  share: number | null;
}

export interface ContributorRow {
  userId: string;
  name: string;
  email: string | null;
  world: string;
  tasksWritten: number;
  tasksApproved: number;
  writerHours: number;
  writerAht: number | null;
  reviewerUnits: number;
  reviewerHours: number;
  reviewerAht: number | null;
  oneShotRate: number | null;
}

export interface RosterRow {
  userId: string;
  name: string;
  email: string | null;
  world: string;
  hours: number;
  payable: number;
  ratePerHour: number | null;
  lastActive: string | null;
  inactive: boolean;
}

export interface DashboardV2Data {
  campaignName: string;
  projectId: string;
  fetchedAt: string;
  source: "snowflake" | "snapshot";
  liveStatuses: boolean;
  filters: {
    start: string | null;
    end: string | null;
    world: string | null;
    expert: string | null;
    email: string | null;
  };
  worlds: string[];
  kpis: {
    totalHours: KpiValue;
    totalPayable: KpiValue;
    approvedUnits: KpiValue;
    approvedAht: KpiValue;
  };
  daily: DailySeriesPoint[];
  pipeline: PipelineStage[];
  quality: {
    oneShotRate: number | null;
    reworkRate: number | null;
  };
  reviewAttempts: ReviewAttemptBucket[];
  contributors: ContributorRow[];
  spend: {
    totalPayable: number;
    payableLast7Days: number;
    averageRatePerHour: number | null;
  };
  roster: RosterRow[];
}
