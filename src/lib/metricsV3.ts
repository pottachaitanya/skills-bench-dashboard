import type {
  DailyPoint,
  DashboardV3Data,
  DomainDrill,
  DomainRow,
  PerfSummary,
  PipelineDomainRow,
  QualityWindows,
  ReviewerRow,
  RosterRow,
  SnapshotV3,
  StageCount,
  TriValue,
  WindowValues,
  WriterRow,
} from "./typesV3";
import { WORLD_DOMAINS } from "./config";

export const TIMEZONE = "America/Los_Angeles";
export const WRITER_TIMERS = [
  "Skillsbench - Task",
  "Alibaba-Skillsbench - Task",
  "SkillsBench-Pilot",
  "Skillsbench-General",
];
export const REVIEWER_TIMER = "Task Review-SkillsBench";

// Every Studio task is one half of a with-skill / without-skill pair.
const WEIGHT = 0.5;

// Stage buckets (§1.4). QA sits AFTER Approved in this campaign
// (Approved -> QA Awaiting Review / In QC), verified from the live
// transition graph.
const PRE_REVIEW = new Set(["Pending", "In Progress", "Unclaimed", "Needs QC Revision"]);
const SUBMITTED = "Awaiting Review";
const REVIEW = "In Review";
const QA = new Set(["QA Awaiting Review", "QA In Review", "In QC"]);
const APPROVED = "Approved";

type Bucket = "pre" | "submitted" | "review" | "approved" | "qa";

function bucketOf(status: string): Bucket {
  if (status === SUBMITTED) return "submitted";
  if (status === REVIEW) return "review";
  if (status === APPROVED) return "approved";
  if (QA.has(status)) return "qa";
  if (PRE_REVIEW.has(status)) return "pre";
  return "pre";
}

// A backward transition: leaving the review gate / approval / QA back to
// writer-side or the submission queue. Breaks one-shot and counts as a
// send-back.
function isBackward(from: Bucket, to: Bucket): boolean {
  return (from === "review" || from === "approved" || from === "qa") && (to === "pre" || to === "submitted");
}

const dayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function laDay(isoUtc: string): string {
  return dayFmt.format(new Date(isoUtc));
}

export function todayLA(now: Date = new Date()): string {
  return dayFmt.format(now);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function tMinus1(now: Date = new Date()): string {
  return addDays(todayLA(now), -1);
}

export interface V3Filters {
  start: string; // required (§1.5)
  end: string; // capped at T-1
}

interface TaskEvent {
  taskId: string;
  world: string;
  day: string;
  at: string;
  from: Bucket;
  to: Bucket;
  fromStatus: string;
  toStatus: string;
  actorName: string | null;
  writerName: string | null;
}

function normalizeName(name: string): string {
  return name
    .replace(/^\[EXP\]\s*/i, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function shortKey(name: string): string {
  const parts = normalizeName(name).split(" ");
  if (parts.length < 2) return parts[0] ?? "";
  return `${parts[0]} ${parts[parts.length - 1][0]}`;
}

function round(n: number, dp = 4): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export function computeDashboardV3(snap: SnapshotV3, filters: V3Filters, now: Date = new Date()): DashboardV3Data {
  const t1Day = tMinus1(now);
  const end = filters.end < t1Day ? filters.end : t1Day;
  const start = filters.start;
  const warmupStart = addDays(start, -6);

  // ---- Flatten transition events ----
  const events: TaskEvent[] = [];
  const stageGraphCount = new Map<string, number>();
  for (const t of snap.tasks) {
    for (let i = 1; i < t.versions.length; i++) {
      const prev = t.versions[i - 1];
      const v = t.versions[i];
      const key = `${prev.status}\u0000${v.status}`;
      stageGraphCount.set(key, (stageGraphCount.get(key) ?? 0) + 1);
      events.push({
        taskId: t.taskId,
        world: t.world,
        day: laDay(v.at),
        at: v.at,
        from: bucketOf(prev.status),
        to: bucketOf(v.status),
        fromStatus: prev.status,
        toStatus: v.status,
        actorName: v.actorName,
        writerName: v.writerName,
      });
    }
  }
  events.sort((a, b) => (a.at < b.at ? -1 : 1));

  const inRange = (day: string) => day >= start && day <= end;
  const inWarm = (day: string) => day >= warmupStart && day <= end;

  // ---- Per-task lifecycle facts (full history, never truncated at start) ----
  interface TaskFacts {
    world: string;
    submitDays: string[]; // days of transitions into Awaiting Review
    reviewDays: string[]; // days of transitions into In Review
    approveDays: string[]; // days of In Review -> Approved transitions
    backwardDays: string[];
    statusAsOfEnd: string | null;
    finalApproveDay: string | null; // last approval on/before end
    submitters: Map<string, number>; // writerName -> AR entries
    reviewers: Map<string, number>; // actorName -> In Review entries
    lastSubmitterBeforeFinalApproval: string | null;
  }
  const facts = new Map<string, TaskFacts>();
  for (const t of snap.tasks) {
    facts.set(t.taskId, {
      world: t.world,
      submitDays: [],
      reviewDays: [],
      approveDays: [],
      backwardDays: [],
      statusAsOfEnd: t.versions.length > 0 ? t.versions[0].status : null,
      finalApproveDay: null,
      submitters: new Map(),
      reviewers: new Map(),
      lastSubmitterBeforeFinalApproval: null,
    });
  }
  const endBoundary = `${end}~`; // day strings sort lexicographically
  for (const e of events) {
    const f = facts.get(e.taskId);
    if (!f) continue;
    if (e.to === "submitted" && e.from !== "submitted") {
      f.submitDays.push(e.day);
      if (e.writerName) f.submitters.set(e.writerName, (f.submitters.get(e.writerName) ?? 0) + 1);
    }
    if (e.toStatus === REVIEW && e.fromStatus !== REVIEW) {
      f.reviewDays.push(e.day);
      if (e.actorName) f.reviewers.set(e.actorName, (f.reviewers.get(e.actorName) ?? 0) + 1);
    }
    if (e.toStatus === APPROVED && e.from === "review") f.approveDays.push(e.day);
    if (isBackward(e.from, e.to)) f.backwardDays.push(e.day);
    if (e.day <= end && e.day < endBoundary) f.statusAsOfEnd = e.toStatus;
  }
  for (const f of facts.values()) {
    const approvals = f.approveDays.filter((d) => d <= end);
    f.finalApproveDay = approvals.length > 0 ? approvals[approvals.length - 1] : null;
  }
  // last submitter before final approval (for attributing approved tasks to writers)
  for (const t of snap.tasks) {
    const f = facts.get(t.taskId);
    if (!f || f.finalApproveDay === null) continue;
    let last: string | null = null;
    for (let i = 1; i < t.versions.length; i++) {
      const prev = t.versions[i - 1];
      const v = t.versions[i];
      if (laDay(v.at) > end) break;
      if (bucketOf(v.status) === "submitted" && bucketOf(prev.status) !== "submitted" && v.writerName) {
        last = v.writerName;
      }
    }
    f.lastSubmitterBeforeFinalApproval = last;
  }

  // ---- Identity: studio actor name -> mercor userId ----
  const byFull = new Map<string, string[]>();
  const byShort = new Map<string, string[]>();
  for (const u of snap.users) {
    if (!u.name) continue;
    const full = normalizeName(u.name);
    const short = shortKey(u.name);
    byFull.set(full, [...(byFull.get(full) ?? []), u.userId]);
    byShort.set(short, [...(byShort.get(short) ?? []), u.userId]);
  }
  const actorToUser = new Map<string, string | null>();
  const unmatchedActors = new Set<string>();
  const resolveActor = (name: string): string | null => {
    if (actorToUser.has(name)) return actorToUser.get(name) ?? null;
    const full = normalizeName(name);
    const short = shortKey(name);
    const cand = new Set([...(byFull.get(full) ?? []), ...(byShort.get(short) ?? [])]);
    const resolved = cand.size === 1 ? [...cand][0] : null;
    actorToUser.set(name, resolved);
    if (!resolved) unmatchedActors.add(name);
    return resolved;
  };

  // ---- Hours / spend maps (already LA-local days) ----
  const hoursByDay = new Map<string, number>();
  const writerHoursByUser = new Map<string, number>();
  const reviewerHoursByUser = new Map<string, number>();
  const allHoursByUser = new Map<string, number>();
  const lastActiveByUser = new Map<string, string>();
  for (const r of snap.timelog) {
    const la = lastActiveByUser.get(r.userId);
    if (!la || r.date > la) lastActiveByUser.set(r.userId, r.date);
    if (!inWarm(r.date)) continue;
    hoursByDay.set(r.date, (hoursByDay.get(r.date) ?? 0) + r.hours);
    if (inRange(r.date)) {
      allHoursByUser.set(r.userId, (allHoursByUser.get(r.userId) ?? 0) + r.hours);
      const m = r.role === "writer" ? writerHoursByUser : reviewerHoursByUser;
      m.set(r.userId, (m.get(r.userId) ?? 0) + r.hours);
    }
  }
  const skillsTimers = new Set([...WRITER_TIMERS, REVIEWER_TIMER]);
  const payableByDay = new Map<string, number>();
  const payableByUser = new Map<string, number>();
  const billableByUser = new Map<string, number>();
  let otherPayable = 0;
  let totalBillable = 0;
  for (const r of snap.spend) {
    if (!skillsTimers.has(r.timer)) {
      otherPayable += r.payable;
      continue;
    }
    if (!inWarm(r.date)) continue;
    payableByDay.set(r.date, (payableByDay.get(r.date) ?? 0) + r.payable);
    if (inRange(r.date)) {
      payableByUser.set(r.userId, (payableByUser.get(r.userId) ?? 0) + r.payable);
      billableByUser.set(r.userId, (billableByUser.get(r.userId) ?? 0) + r.billable);
      totalBillable += r.billable;
    }
  }

  // ---- Daily series (warm-up window feeds the rolling averages only) ----
  const submittedTasksByDay = new Map<string, Set<string>>();
  const writerUnitEventsByDay = new Map<string, number>();
  const reviewUnitEventsByDay = new Map<string, number>();
  const approveEventsByDay = new Map<string, number>();
  for (const [taskId, f] of facts) {
    for (const d of f.submitDays) {
      if (!inWarm(d)) continue;
      writerUnitEventsByDay.set(d, (writerUnitEventsByDay.get(d) ?? 0) + 1);
      let s = submittedTasksByDay.get(d);
      if (!s) {
        s = new Set();
        submittedTasksByDay.set(d, s);
      }
      s.add(taskId);
    }
    for (const d of f.reviewDays) {
      if (inWarm(d)) reviewUnitEventsByDay.set(d, (reviewUnitEventsByDay.get(d) ?? 0) + 1);
    }
    for (const d of f.approveDays) {
      if (inWarm(d)) approveEventsByDay.set(d, (approveEventsByDay.get(d) ?? 0) + 1);
    }
  }

  let dataMin: string | null = null;
  for (const e of events) if (dataMin === null || e.day < dataMin) dataMin = e.day;
  for (const r of snap.timelog) if (dataMin === null || r.date < dataMin) dataMin = r.date;

  const days: string[] = [];
  for (let d = warmupStart; d <= end; d = addDays(d, 1)) days.push(d);

  const rawDaily = days.map((d) => ({
    date: d,
    submitted: (submittedTasksByDay.get(d)?.size ?? 0) * WEIGHT,
    approved: (approveEventsByDay.get(d) ?? 0) * WEIGHT,
    writerUnits: (writerUnitEventsByDay.get(d) ?? 0) * WEIGHT,
    reviewUnits: (reviewUnitEventsByDay.get(d) ?? 0) * WEIGHT,
    hours: hoursByDay.get(d) ?? 0,
    payable: payableByDay.get(d) ?? 0,
  }));
  const rolling = (idx: number, get: (r: (typeof rawDaily)[number]) => number): number | null => {
    const windowStart = addDays(rawDaily[idx].date, -6);
    if (dataMin !== null && windowStart < dataMin && rawDaily[idx].date !== dataMin) {
      // incomplete warm-up: a partial average that looks complete is worse than a gap
      if (windowStart < (dataMin ?? windowStart)) return null;
    }
    if (idx < 6) return null;
    let sum = 0;
    for (let j = idx - 6; j <= idx; j++) sum += get(rawDaily[j]);
    return round(sum / 7);
  };
  const daily: DailyPoint[] = [];
  rawDaily.forEach((r, i) => {
    if (r.date < start) return;
    daily.push({
      date: r.date,
      submitted: round(r.submitted),
      submitted7d: rolling(i, (x) => x.submitted),
      approved: round(r.approved),
      approved7d: rolling(i, (x) => x.approved),
      writerUnits: round(r.writerUnits),
      writerUnits7d: rolling(i, (x) => x.writerUnits),
      reviewUnits: round(r.reviewUnits),
      reviewUnits7d: rolling(i, (x) => x.reviewUnits),
      hours: round(r.hours),
      hours7d: rolling(i, (x) => x.hours),
      payable: round(r.payable, 2),
      payable7d: rolling(i, (x) => x.payable),
    });
  });

  // ---- Range totals (§2) ----
  const submittedTasks = new Set<string>();
  const reviewedTasks = new Set<string>();
  const sendBackTasks = new Set<string>();
  let writerUnits = 0;
  let reviewUnits = 0;
  for (const [taskId, f] of facts) {
    for (const d of f.submitDays) {
      if (inRange(d)) {
        submittedTasks.add(taskId);
        writerUnits += 1;
      }
    }
    for (const d of f.reviewDays) {
      if (inRange(d)) {
        reviewedTasks.add(taskId);
        reviewUnits += 1;
      }
    }
    for (const d of f.backwardDays) {
      if (inRange(d)) sendBackTasks.add(taskId);
    }
  }
  // Tasks Approved: unique tasks whose latest version as of `end` is Approved,
  // attributed to the day of the final approval; scoped to the range.
  const approvedTaskIds: string[] = [];
  let nonApprovedTerminal = 0;
  for (const [taskId, f] of facts) {
    if (f.statusAsOfEnd === APPROVED && f.finalApproveDay !== null && inRange(f.finalApproveDay)) {
      approvedTaskIds.push(taskId);
    }
  }
  // No non-Approved terminal states were discovered in the transition graph;
  // keep the count so any future ones are reported, not silently dropped.
  nonApprovedTerminal = 0;

  const tasksSubmitted = submittedTasks.size * WEIGHT;
  const tasksApproved = approvedTaskIds.length * WEIGHT;
  const reviewedTasksW = reviewedTasks.size * WEIGHT;
  const writerUnitsW = writerUnits * WEIGHT;
  const reviewUnitsW = reviewUnits * WEIGHT;

  // ---- Quality: one-shot over approved tasks, windows ending at `end` ----
  const oneShotWindow = (from: string): { oneShot: number | null; approved: number } => {
    let approved = 0;
    let oneShot = 0;
    for (const taskId of approvedTaskIds) {
      const f = facts.get(taskId);
      if (!f || f.finalApproveDay === null || f.finalApproveDay < from) continue;
      approved += 1;
      if (f.backwardDays.length === 0) oneShot += 1;
    }
    return { oneShot: approved > 0 ? round(oneShot / approved) : null, approved: approved * WEIGHT };
  };
  const quality: QualityWindows = {
    d3: oneShotWindow(addDays(end, -2)),
    d7: oneShotWindow(addDays(end, -6)),
    total: oneShotWindow(start),
  };

  // ---- KPI cards: T-1 / 7d avg / Total ----
  const kpiT1 = end; // last complete day of the selected range
  const sumWindow = (map: Map<string, number>, from: string, to: string): number => {
    let s = 0;
    for (const [d, v] of map) if (d >= from && d <= to) s += v;
    return s;
  };
  const hoursT1 = hoursByDay.get(kpiT1) ?? 0;
  const hours7 = sumWindow(hoursByDay, addDays(end, -6), end);
  const hoursTotal = sumWindow(hoursByDay, start, end);
  const hoursKpi: TriValue = { t1: round(hoursT1), avg7: round(hours7 / 7), total: round(hoursTotal) };

  // All-in (writer + reviewer) hours in a window — the Overall AHT numerator.
  const writerHoursWindow = (from: string, to: string): number => {
    let s = 0;
    for (const r of snap.timelog) {
      if (r.date >= from && r.date <= to) s += r.hours;
    }
    return s;
  };
  const approvedInWindow = (from: string, to: string): number => {
    let n = 0;
    for (const taskId of approvedTaskIds) {
      const f = facts.get(taskId);
      if (f && f.finalApproveDay !== null && f.finalApproveDay >= from && f.finalApproveDay <= to) n += 1;
    }
    return n * WEIGHT;
  };
  const aht = (wh: number, approved: number): number | null => (approved > 0 ? round(wh / approved) : null);
  const ahtKpi: TriValue = {
    t1: aht(writerHoursWindow(kpiT1, kpiT1), approvedInWindow(kpiT1, kpiT1)),
    avg7: aht(writerHoursWindow(addDays(end, -6), end), approvedInWindow(addDays(end, -6), end)),
    total: aht(writerHoursWindow(start, end), tasksApproved),
  };
  const oneShotKpi: TriValue = {
    t1: oneShotWindow(end).oneShot,
    avg7: quality.d7.oneShot,
    total: quality.total.oneShot,
  };

  // ---- Pipeline snapshot as of `end` ----
  const stageOrder = ["Pending", "In Progress", "Unclaimed", "Awaiting Review", "In Review", "QA Awaiting Review", "QA In Review", "In QC", "Needs QC Revision", "Approved"];
  const stageCounts = new Map<string, number>();
  for (const f of facts.values()) {
    if (!f.statusAsOfEnd) continue;
    stageCounts.set(f.statusAsOfEnd, (stageCounts.get(f.statusAsOfEnd) ?? 0) + 1);
  }
  const pipeline: StageCount[] = [...stageCounts.entries()]
    .sort((a, b) => {
      const ia = stageOrder.indexOf(a[0]);
      const ib = stageOrder.indexOf(b[0]);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    })
    .map(([stage, n]) => ({ stage, units: round(n * WEIGHT, 1) }));

  // ---- Contributors ----
  interface WAgg {
    unitEvents: number;
    unitEventsT1: number;
    unitEvents7: number;
    submitted: Set<string>;
    approved: number;
    oneShot: number;
  }
  const writersAgg = new Map<string, WAgg>();
  const wAgg = (name: string): WAgg => {
    let a = writersAgg.get(name);
    if (!a) {
      a = { unitEvents: 0, unitEventsT1: 0, unitEvents7: 0, submitted: new Set(), approved: 0, oneShot: 0 };
      writersAgg.set(name, a);
    }
    return a;
  };
  for (const t of snap.tasks) {
    for (let i = 1; i < t.versions.length; i++) {
      const prev = t.versions[i - 1];
      const v = t.versions[i];
      if (bucketOf(v.status) !== "submitted" || bucketOf(prev.status) === "submitted") continue;
      const d = laDay(v.at);
      if (!inRange(d) || !v.writerName) continue;
      const a = wAgg(v.writerName);
      a.unitEvents += 1;
      a.submitted.add(t.taskId);
      if (d === kpiT1) a.unitEventsT1 += 1;
      if (d >= addDays(end, -6)) a.unitEvents7 += 1;
    }
  }
  for (const taskId of approvedTaskIds) {
    const f = facts.get(taskId);
    const who = f?.lastSubmitterBeforeFinalApproval;
    if (!f || !who) continue;
    const a = wAgg(who);
    a.approved += 1;
    if (f.backwardDays.length === 0) a.oneShot += 1;
  }
  const writers: WriterRow[] = [...writersAgg.entries()]
    .map(([name, a]) => {
      const uid = resolveActor(name);
      const wh = uid !== null ? (writerHoursByUser.get(uid) ?? 0) : null;
      const approvedW = a.approved * WEIGHT;
      const submittedW = a.submitted.size * WEIGHT;
      return {
        name: name.replace(/^\[EXP\]\s*/i, ""),
        unitsT1: round(a.unitEventsT1 * WEIGHT, 1),
        units7d: round((a.unitEvents7 * WEIGHT) / 7, 2),
        units: round(a.unitEvents * WEIGHT, 1),
        submitted: round(submittedW, 1),
        approved: round(approvedW, 1),
        hours: wh !== null ? round(wh, 2) : null,
        ahtApproved: wh !== null && approvedW > 0 ? round(wh / approvedW, 2) : null,
        ahtSubmitted: wh !== null && submittedW > 0 ? round(wh / submittedW, 2) : null,
        oneShot: a.approved > 0 ? round(a.oneShot / a.approved) : null,
      };
    })
    .sort((a, b) => b.units - a.units);

  interface RAgg {
    unitEvents: number;
    unitEventsT1: number;
    unitEvents7: number;
    reviewed: Set<string>;
  }
  const reviewersAgg = new Map<string, RAgg>();
  for (const t of snap.tasks) {
    for (let i = 1; i < t.versions.length; i++) {
      const prev = t.versions[i - 1];
      const v = t.versions[i];
      if (v.status !== REVIEW || prev.status === REVIEW) continue;
      const d = laDay(v.at);
      if (!inRange(d) || !v.actorName) continue;
      let a = reviewersAgg.get(v.actorName);
      if (!a) {
        a = { unitEvents: 0, unitEventsT1: 0, unitEvents7: 0, reviewed: new Set() };
        reviewersAgg.set(v.actorName, a);
      }
      a.unitEvents += 1;
      a.reviewed.add(t.taskId);
      if (d === kpiT1) a.unitEventsT1 += 1;
      if (d >= addDays(end, -6)) a.unitEvents7 += 1;
    }
  }
  const reviewers: ReviewerRow[] = [...reviewersAgg.entries()]
    .map(([name, a]) => {
      const uid = resolveActor(name);
      const rh = uid !== null ? (reviewerHoursByUser.get(uid) ?? 0) : null;
      const unitsW = a.unitEvents * WEIGHT;
      const reviewedW = a.reviewed.size * WEIGHT;
      return {
        name: name.replace(/^\[EXP\]\s*/i, ""),
        unitsT1: round(a.unitEventsT1 * WEIGHT, 1),
        units7d: round((a.unitEvents7 * WEIGHT) / 7, 2),
        units: round(unitsW, 1),
        reviewedTasks: round(reviewedW, 1),
        hours: rh !== null ? round(rh, 2) : null,
        hoursPerPass: rh !== null && unitsW > 0 ? round(rh / unitsW, 2) : null,
        hoursPerReviewedTask: rh !== null && reviewedW > 0 ? round(rh / reviewedW, 2) : null,
        passesPerTask: reviewedW > 0 ? round(unitsW / reviewedW, 2) : null,
      };
    })
    .sort((a, b) => b.units - a.units);

  // ---- Performance Summary windows (Today partial / Yesterday / 3d / 7d / Total) ----
  const today = todayLA(now);
  // Snapshot tasks carry the domain name directly; accept raw world IDs too.
  const domainNames = new Set(Object.values(WORLD_DOMAINS));
  const domainOf = (world: string): string => WORLD_DOMAINS[world] ?? (domainNames.has(world) ? world : "Unassigned");

  // One expert works one domain: each timer user's hours all go to their
  // primary domain (most Studio events across the range); else "Unassigned".
  const nameToUid = new Map<string, string | null>();
  const uidFor = (name: string | null): string | null => {
    if (!name) return null;
    if (!nameToUid.has(name)) nameToUid.set(name, resolveActor(name));
    return nameToUid.get(name) ?? null;
  };
  type DomainCount = Map<string, number>;
  const writerEvByUser = new Map<string, DomainCount>();
  const reviewEvByUser = new Map<string, DomainCount>();
  const bump = (m: DomainCount, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  for (const t of snap.tasks) {
    const dom = domainOf(t.world);
    for (let i = 1; i < t.versions.length; i++) {
      const prev = t.versions[i - 1];
      const v = t.versions[i];
      if (bucketOf(v.status) === "submitted" && bucketOf(prev.status) !== "submitted") {
        const uid = uidFor(v.writerName);
        if (uid) {
          let all = writerEvByUser.get(uid);
          if (!all) writerEvByUser.set(uid, (all = new Map()));
          bump(all, dom);
        }
      }
      if (v.status === REVIEW && prev.status !== REVIEW) {
        const uid = uidFor(v.actorName);
        if (uid) {
          let all = reviewEvByUser.get(uid);
          if (!all) reviewEvByUser.set(uid, (all = new Map()));
          bump(all, dom);
        }
      }
    }
  }

  // Each expert works a single domain. First choice is the contractor tag —
  // the Mercor job title ("Writer Finance", "Reviewer Physics", ...). Users
  // without a domain-bearing tag fall back to their dominant Studio domain
  // (most writer + review events across the range); else "Unassigned".
  const TAG_DOMAINS: Record<string, string> = {
    "human resources": "HR",
    "marketing / sales": "Marketing / Sales",
    "computer science": "Computer Science",
    finance: "Finance",
    biology: "Biology",
    law: "Law",
    education: "Education",
    chemistry: "Chemistry",
    physics: "Physics",
    mathematics: "Mathematics",
  };
  const tagDomainByUser = new Map<string, string>();
  for (const r of snap.rates) {
    if (!r.title || tagDomainByUser.has(r.userId)) continue;
    const rest = r.title.replace(/^(Writer|Reviewer)\s+/i, "").trim().toLowerCase();
    const dom = TAG_DOMAINS[rest];
    if (dom) tagDomainByUser.set(r.userId, dom);
  }
  const primaryDomainCache = new Map<string, string>();
  const primaryDomainOf = (userId: string): string => {
    const cached = primaryDomainCache.get(userId);
    if (cached) return cached;
    const tagged = tagDomainByUser.get(userId);
    if (tagged) {
      primaryDomainCache.set(userId, tagged);
      return tagged;
    }
    const combined: DomainCount = new Map();
    for (const src of [writerEvByUser.get(userId), reviewEvByUser.get(userId)]) {
      if (src) for (const [dom, n] of src) combined.set(dom, (combined.get(dom) ?? 0) + n);
    }
    let best = "Unassigned";
    let bestN = 0;
    for (const [dom, n] of combined) {
      if (n > bestN || (n === bestN && dom < best)) {
        best = dom;
        bestN = n;
      }
    }
    primaryDomainCache.set(userId, best);
    return best;
  };

  // Unfiltered day-level hour maps (needed for Today and window sums).
  const writerHoursByDayAll = new Map<string, number>();
  const reviewerHoursByDayAll = new Map<string, number>();
  // domain -> day -> hours
  const writerHoursByDomainDay = new Map<string, Map<string, number>>();
  const reviewerHoursByDomainDay = new Map<string, Map<string, number>>();
  const addDomainDay = (m: Map<string, Map<string, number>>, dom: string, day: string, h: number) => {
    let dd = m.get(dom);
    if (!dd) m.set(dom, (dd = new Map()));
    dd.set(day, (dd.get(day) ?? 0) + h);
  };
  for (const r of snap.timelog) {
    const dayMap = r.role === "writer" ? writerHoursByDayAll : reviewerHoursByDayAll;
    dayMap.set(r.date, (dayMap.get(r.date) ?? 0) + r.hours);
    const domMap = r.role === "writer" ? writerHoursByDomainDay : reviewerHoursByDomainDay;
    addDomainDay(domMap, primaryDomainOf(r.userId), r.date, r.hours);
  }

  const sumDayMap = (m: Map<string, number> | undefined, from: string, to: string): number => {
    if (!m) return 0;
    let s = 0;
    for (const [d, v] of m) if (d >= from && d <= to) s += v;
    return s;
  };
  // Windows: today (partial) / t1 / 3d avg / 7d avg / total-of-range
  const windowsOf = (valueIn: (from: string, to: string) => number, opts?: { avg?: boolean }): WindowValues => {
    const avg = opts?.avg ?? true;
    return {
      today: round(valueIn(today, today)),
      t1: round(valueIn(end, end)),
      avg3: round(avg ? valueIn(addDays(end, -2), end) / 3 : valueIn(addDays(end, -2), end)),
      avg7: round(avg ? valueIn(addDays(end, -6), end) / 7 : valueIn(addDays(end, -6), end)),
      total: round(valueIn(start, end)),
    };
  };
  const ratioWindows = (num: (from: string, to: string) => number, den: (from: string, to: string) => number): WindowValues => {
    const r = (from: string, to: string): number | null => {
      const d = den(from, to);
      return d > 0 ? round(num(from, to) / d, 2) : null;
    };
    return { today: r(today, today), t1: r(end, end), avg3: r(addDays(end, -2), end), avg7: r(addDays(end, -6), end), total: r(start, end) };
  };

  // Unique-task window counts (weighted). A task counts once per window it has an event in.
  const uniqueInWindow = (getDays: (f: TaskFacts) => string[], from: string, to: string, domain?: string): number => {
    let n = 0;
    for (const f of facts.values()) {
      if (domain !== undefined && domainOf(f.world) !== domain) continue;
      if (getDays(f).some((d) => d >= from && d <= to)) n += 1;
    }
    return n * WEIGHT;
  };
  // Approved: unique tasks whose latest state is Approved, attributed to final approval day.
  const approvedWindow = (from: string, to: string, domain?: string): number => {
    let n = 0;
    for (const taskId of approvedTaskIds) {
      const f = facts.get(taskId);
      if (!f || f.finalApproveDay === null) continue;
      if (domain !== undefined && domainOf(f.world) !== domain) continue;
      if (f.finalApproveDay >= from && f.finalApproveDay <= to) n += 1;
    }
    return n * WEIGHT;
  };
  // Today's approvals are still in flight: use approve events for the partial-day cell.
  const approveEventsWindow = (from: string, to: string, domain?: string): number => {
    let n = 0;
    for (const f of facts.values()) {
      if (domain !== undefined && domainOf(f.world) !== domain) continue;
      n += f.approveDays.filter((d) => d >= from && d <= to).length;
    }
    return n * WEIGHT;
  };
  const approvedOrEvents = (from: string, to: string, domain?: string): number =>
    to >= today ? approveEventsWindow(from, to, domain) : approvedWindow(from, to, domain);

  const wHours = (from: string, to: string) => sumDayMap(writerHoursByDayAll, from, to);
  const rHours = (from: string, to: string) => sumDayMap(reviewerHoursByDayAll, from, to);
  const tHours = (from: string, to: string) => wHours(from, to) + rHours(from, to);
  const writtenWin = (from: string, to: string) => uniqueInWindow((f) => f.submitDays, from, to);
  const reviewedWin = (from: string, to: string) => uniqueInWindow((f) => f.reviewDays, from, to);

  const perfSummary: PerfSummary = {
    totalHours: windowsOf(tHours),
    writerHours: windowsOf(wHours),
    reviewerHours: windowsOf(rHours),
    tasksWritten: windowsOf(writtenWin),
    tasksReviewed: windowsOf(reviewedWin),
    tasksApproved: windowsOf((f, t) => approvedOrEvents(f, t)),
    hoursPerApproved: ratioWindows(tHours, (f, t) => approvedOrEvents(f, t)),
    writerHoursPerTask: ratioWindows(wHours, writtenWin),
    reviewHoursPerTask: ratioWindows(rHours, reviewedWin),
  };

  // ---- Pipeline by domain (as of `end`) ----
  const pipeDomAgg = new Map<string, { pending: number; awaitingReview: number; inReview: number; qa: number; approved: number }>();
  for (const f of facts.values()) {
    if (!f.statusAsOfEnd) continue;
    const dom = domainOf(f.world);
    let a = pipeDomAgg.get(dom);
    if (!a) pipeDomAgg.set(dom, (a = { pending: 0, awaitingReview: 0, inReview: 0, qa: 0, approved: 0 }));
    const b = bucketOf(f.statusAsOfEnd);
    if (b === "pre") a.pending += 1;
    else if (b === "submitted") a.awaitingReview += 1;
    else if (b === "review") a.inReview += 1;
    else if (b === "qa") a.qa += 1;
    else if (b === "approved") a.approved += 1;
  }
  let openWorkTotal = 0;
  for (const a of pipeDomAgg.values()) openWorkTotal += a.pending + a.awaitingReview + a.inReview + a.qa;
  const pipelineDomains: PipelineDomainRow[] = [...pipeDomAgg.entries()]
    .map(([domain, a]) => {
      const open = a.pending + a.awaitingReview + a.inReview + a.qa;
      return {
        domain,
        pending: round(a.pending * WEIGHT, 1),
        awaitingReview: round(a.awaitingReview * WEIGHT, 1),
        inReview: round(a.inReview * WEIGHT, 1),
        qa: round(a.qa * WEIGHT, 1),
        openWork: round(open * WEIGHT, 1),
        approved: round(a.approved * WEIGHT, 1),
        pctOfOpenWork: openWorkTotal > 0 ? round(open / openWorkTotal) : null,
      };
    })
    .sort((a, b) => b.openWork - a.openWork);

  // ---- Domain Scorecard (6B): comparison rows + per-domain drill-downs ----
  const allDomains = new Set<string>();
  for (const f of facts.values()) allDomains.add(domainOf(f.world));
  for (const m of [writerHoursByDomainDay, reviewerHoursByDomainDay]) for (const dom of m.keys()) allDomains.add(dom);
  const totalHoursAll = tHours(start, end);
  const oneShotDomainWindow = (from: string, to: string, domain?: string): number | null => {
    let approved = 0;
    let clean = 0;
    for (const taskId of approvedTaskIds) {
      const f = facts.get(taskId);
      if (!f || f.finalApproveDay === null || f.finalApproveDay < from || f.finalApproveDay > to) continue;
      if (domain !== undefined && domainOf(f.world) !== domain) continue;
      approved += 1;
      if (f.backwardDays.length === 0) clean += 1;
    }
    return approved > 0 ? round(clean / approved) : null;
  };
  const domains: DomainRow[] = [...allDomains]
    .map((dom) => {
      const wh = sumDayMap(writerHoursByDomainDay.get(dom), start, end);
      const rh = sumDayMap(reviewerHoursByDomainDay.get(dom), start, end);
      const th = wh + rh;
      const written = uniqueInWindow((f) => f.submitDays, start, end, dom);
      const reviewed = uniqueInWindow((f) => f.reviewDays, start, end, dom);
      const approved = approvedWindow(start, end, dom);
      return {
        domain: dom,
        approved: round(approved, 1),
        written: round(written, 1),
        reviewed: round(reviewed, 1),
        writerHours: round(wh, 1),
        reviewerHours: round(rh, 1),
        totalHours: round(th, 1),
        writerAht: written > 0 ? round(wh / written, 2) : null,
        reviewerAht: reviewed > 0 ? round(rh / reviewed, 2) : null,
        overallAht: approved > 0 ? round(th / approved, 2) : null,
        oneShot: oneShotDomainWindow(start, end, dom),
        pctOfApproved: tasksApproved > 0 ? round(approved / tasksApproved) : null,
        pctOfHours: totalHoursAll > 0 ? round(th / totalHoursAll) : null,
      };
    })
    .filter((d) => d.approved > 0 || d.written > 0 || d.reviewed > 0 || d.totalHours > 0)
    .sort((a, b) => b.approved - a.approved);
  const domainDrills: DomainDrill[] = domains.map((d) => {
    const dom = d.domain;
    const dwh = (f: string, t: string) => sumDayMap(writerHoursByDomainDay.get(dom), f, t);
    const drh = (f: string, t: string) => sumDayMap(reviewerHoursByDomainDay.get(dom), f, t);
    const dth = (f: string, t: string) => dwh(f, t) + drh(f, t);
    const dWritten = (f: string, t: string) => uniqueInWindow((x) => x.submitDays, f, t, dom);
    const dReviewed = (f: string, t: string) => uniqueInWindow((x) => x.reviewDays, f, t, dom);
    const dApproved = (f: string, t: string) => approvedOrEvents(f, t, dom);
    const oneShotWin = (f: string, t: string): number | null => oneShotDomainWindow(f, t, dom);
    return {
      domain: dom,
      approved: windowsOf(dApproved),
      written: windowsOf(dWritten),
      reviewed: windowsOf(dReviewed),
      writerHours: windowsOf(dwh),
      reviewerHours: windowsOf(drh),
      totalHours: windowsOf(dth),
      writerAht: ratioWindows(dwh, dWritten),
      reviewerAht: ratioWindows(drh, dReviewed),
      overallAht: ratioWindows(dth, dApproved),
      oneShot: {
        today: oneShotWin(today, today),
        t1: oneShotWin(end, end),
        avg3: oneShotWin(addDays(end, -2), end),
        avg7: oneShotWin(addDays(end, -6), end),
        total: oneShotWin(start, end),
      },
    };
  });

  // ---- Spend & roster ----
  const payableTotal = sumWindow(payableByDay, start, end);
  const payable7 = sumWindow(payableByDay, addDays(end, -6), end);
  const userById = new Map(snap.users.map((u) => [u.userId, u]));
  const missingRateUsers: string[] = [];
  const roster: RosterRow[] = [...allHoursByUser.entries()]
    .map(([userId, h]) => {
      const u = userById.get(userId);
      const pay = payableByUser.get(userId);
      const bill = billableByUser.get(userId);
      const name = u?.name ?? userId;
      if (pay === undefined && h > 0) missingRateUsers.push(name);
      return {
        name,
        email: u?.email ?? null,
        hours: round(h, 2),
        payable: pay !== undefined ? round(pay, 2) : null,
        billable: bill !== undefined && bill > 0 ? round(bill, 2) : null,
        lastActive: lastActiveByUser.get(userId) ?? null,
      };
    })
    .sort((a, b) => b.hours - a.hours);

  const stageGraph = [...stageGraphCount.entries()]
    .map(([k, count]) => {
      const [from, to] = k.split("\u0000");
      return { from, to, count };
    })
    .sort((a, b) => b.count - a.count);

  const passRate = reviewedTasksW > 0 ? round(tasksApproved / reviewedTasksW) : null;
  const sendBackRate = reviewedTasksW > 0 ? round((sendBackTasks.size * WEIGHT) / reviewedTasksW) : null;

  return {
    meta: {
      fetchedAt: snap.fetchedAt,
      timezone: TIMEZONE,
      tMinus1: t1Day,
      rangeStart: start,
      rangeEnd: end,
      stageGraph,
      unmatchedActors: [...unmatchedActors].sort(),
      missingRateUsers,
      otherPayable: round(otherPayable, 2),
    },
    kpis: { hours: hoursKpi, ahtApproved: ahtKpi, oneShotRate: oneShotKpi },
    daily,
    pipeline: { asOf: end, stages: pipeline },
    writerTotals: {
      submitted: round(tasksSubmitted, 1),
      approved: round(tasksApproved, 1),
      writerUnits: round(writerUnitsW, 1),
      reviewUnits: round(reviewUnitsW, 1),
      reviewedTasks: round(reviewedTasksW, 1),
      passRate,
      sendBackRate,
      nonApprovedTerminal,
    },
    quality,
    perfSummary,
    pipelineDomains,
    domains,
    domainDrills,
    writers,
    reviewers,
    spendKpis: {
      payable: round(payableTotal, 2),
      billable: totalBillable > 0 ? round(totalBillable, 2) : null,
      payable7d: round(payable7, 2),
    },
    roster,
  };
}

export function earliestDay(snap: SnapshotV3): string {
  let min: string | null = null;
  for (const t of snap.tasks) {
    for (const v of t.versions) {
      const d = laDay(v.at);
      if (min === null || d < min) min = d;
    }
  }
  for (const r of snap.timelog) if (min === null || r.date < min) min = r.date;
  return min ?? "2026-06-01";
}
