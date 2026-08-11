export const CAMPAIGN_ID = "camp_eff62e0c0fc74cf09d89b23e6879cf81";
export const CAMPAIGN_NAME = "Skills Bench";
export const PROJECT_ID = "proj_AAABndZ4FEZ1odUUJnBMi79x";

export const WRITER_TIMER_NAME = "Skillsbench - Task";
export const REVIEWER_TIMER_NAME = "Task Review-SkillsBench";

export const WORLD_DOMAINS: Record<string, string> = {
  world_887695f4974543b38797e9b3f0d6eeeb: "Chemistry",
  world_7ffbf49be2c64c34871621e25348d9e6: "HR",
  world_3e794edd820c4799a134b86e84219ed4: "Marketing / Sales",
  world_f268dbb388724ee086e2eba6f98fe4f6: "Biology",
  world_95c2cfdf635d42a291a4274cf19872b5: "Mathematics",
  world_d4b0b7c903944fc6b47f58436ba9d641: "Computer Science",
  world_4697895029f54b089827ead9228322d2: "Law",
  world_3b1a4c950e7f44d5ac3cc0d1be8f497b: "Education",
  world_1136cb3f011f411b923375c139ac91c3: "Finance",
  world_61d56d28f4fe48bdb31c76b222c63707: "Physics",
};

export const OTHER_DOMAIN = "Other";

export function domainForWorld(worldId: string | null): string {
  if (worldId && worldId in WORLD_DOMAINS) return WORLD_DOMAINS[worldId];
  return OTHER_DOMAIN;
}

/** Current task statuses counted as "Approved". */
export const APPROVED_STATUSES = new Set(["approved", "qa approved"]);
/** Current task statuses counted as "Awaiting Review". */
export const AWAITING_REVIEW_STATUSES = new Set([
  "awaiting review",
  "re-reviewing",
  "qa in review",
]);
/** Excluded from Total Tasks. */
export const EXCLUDED_STATUSES = new Set(["discarded"]);
