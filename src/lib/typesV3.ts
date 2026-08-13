// ---------- Raw snapshot (Studio transition crawl + Mercor MCP warehouse) ----------

export interface RawVersion {
  status: string;
  at: string; // UTC ISO timestamp of the transition
  transition: string | null;
  actorId: string | null;
  actorName: string | null;
  writerId: string | null;
  writerName: string | null;
}

export interface RawTask {
  taskId: string;
  world: string;
  versions: RawVersion[];
}

export interface TimelogRow {
  userId: string;
  role: "writer" | "reviewer";
  date: string; // America/Los_Angeles local day
  hours: number;
}

export interface SpendRow {
  userId: string;
  date: string;
  timer: string;
  payable: number;
  billable: number;
  hours: number;
}

export interface RateRow {
  userId: string;
  payRate: number | null;
  billRate: number | null;
  title: string | null;
  status: string | null;
}

export interface UserRow {
  userId: string;
  name: string | null;
  email: string | null;
}

export interface SnapshotV3 {
  tasks: RawTask[];
  timelog: TimelogRow[];
  spend: SpendRow[];
  rates: RateRow[];
  users: UserRow[];
  fetchedAt: string;
}

// ---------- Computed dashboard payload ----------

export interface TriValue {
  t1: number | null; // most recent complete day
  avg7: number | null; // 7d average
  total: number | null; // selected range total
}

export interface DailyPoint {
  date: string;
  submitted: number;
  submitted7d: number | null;
  approved: number;
  approved7d: number | null;
  writerUnits: number;
  writerUnits7d: number | null;
  reviewUnits: number;
  reviewUnits7d: number | null;
  hours: number;
  hours7d: number | null;
  payable: number;
  payable7d: number | null;
}

export interface StageCount {
  stage: string;
  units: number;
}

export interface QualityWindows {
  d3: { oneShot: number | null; approved: number };
  d7: { oneShot: number | null; approved: number };
  total: { oneShot: number | null; approved: number };
}

export interface WriterRow {
  name: string;
  unitsT1: number;
  units7d: number | null;
  units: number;
  submitted: number;
  approved: number;
  hours: number | null;
  ahtApproved: number | null;
  ahtSubmitted: number | null;
  oneShot: number | null;
}

export interface ReviewerRow {
  name: string;
  unitsT1: number;
  units7d: number | null;
  units: number;
  reviewedTasks: number;
  hours: number | null;
}

export interface RosterRow {
  name: string;
  email: string | null;
  hours: number;
  payable: number | null;
  billable: number | null;
  lastActive: string | null;
}

export interface DashboardV3Data {
  meta: {
    fetchedAt: string;
    timezone: string;
    tMinus1: string; // last complete LA day
    rangeStart: string;
    rangeEnd: string;
    stageGraph: { from: string; to: string; count: number }[];
    unmatchedActors: string[];
    missingRateUsers: string[];
    otherPayable: number; // payouts outside the two SkillsBench timers (bonuses, pilot, precursor timers)
  };
  kpis: {
    hours: TriValue;
    ahtApproved: TriValue;
    oneShotRate: TriValue;
  };
  daily: DailyPoint[];
  pipeline: { asOf: string; stages: StageCount[] };
  writerTotals: {
    submitted: number;
    approved: number;
    writerUnits: number;
    reviewUnits: number;
    reviewedTasks: number;
    passRate: number | null;
    sendBackRate: number | null;
    nonApprovedTerminal: number;
  };
  quality: QualityWindows;
  writers: WriterRow[];
  reviewers: ReviewerRow[];
  spendKpis: {
    payable: number;
    billable: number | null;
    payable7d: number;
  };
  roster: RosterRow[];
}
