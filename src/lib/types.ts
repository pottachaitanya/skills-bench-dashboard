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

export interface RawData {
  events: TaskEvent[];
  statuses: TaskStatusRow[];
  timers: TimerRow[];
  fetchedAt: string;
  source: "snowflake" | "snapshot";
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
  dateRange: { start: string | null; end: string | null };
  overall: OverallMetrics;
  domains: DomainMetrics[];
  rolling7: Rolling7DayMetrics;
  experts: ExpertMetrics[];
  statusBreakdown: StatusBreakdownRow[];
}
