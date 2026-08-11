import { promises as fs } from "fs";
import path from "path";
import { getSnowflakeConfig, runQueries } from "./snowflake";
import { EVENTS_SQL, STATUSES_SQL, TIMERS_SQL } from "./queries";
import type { RawData, Role, TaskEvent, TaskStatusRow, TimerRow } from "./types";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseEvent(row: Record<string, unknown>): TaskEvent | null {
  const taskId = asString(row.taskId);
  const role = asString(row.role);
  const action = asString(row.action);
  const createdAt = asString(row.createdAt);
  if (!taskId || !createdAt) return null;
  if (role !== "writer" && role !== "reviewer") return null;
  if (
    action !== "submit" &&
    action !== "revise" &&
    action !== "approve" &&
    action !== "reject"
  ) {
    return null;
  }
  return {
    taskId,
    worldId: asString(row.worldId),
    role,
    action,
    createdAt,
    userId: asString(row.userId),
    userName: asString(row.userName),
  };
}

function parseStatus(row: Record<string, unknown>): TaskStatusRow | null {
  const taskId = asString(row.taskId);
  const status = asString(row.status);
  if (!taskId || !status) return null;
  return { taskId, worldId: asString(row.worldId), status };
}

function parseTimer(row: Record<string, unknown>): TimerRow | null {
  const userId = asString(row.userId);
  const timer = asString(row.timer);
  const date = asString(row.date);
  const hours = asNumber(row.hours);
  if (!userId || !date || hours === null) return null;
  if (timer !== "writer" && timer !== "reviewer") return null;
  return { userId, timer: timer as Role, date, hours };
}

function parseRows<T>(
  rows: unknown,
  parse: (row: Record<string, unknown>) => T | null,
): T[] {
  if (!Array.isArray(rows)) return [];
  const result: T[] = [];
  for (const row of rows) {
    if (typeof row === "object" && row !== null) {
      const parsed = parse(row as Record<string, unknown>);
      if (parsed) result.push(parsed);
    }
  }
  return result;
}

async function fetchFromSnowflake(): Promise<RawData | null> {
  const config = getSnowflakeConfig();
  if (!config) return null;
  const [events, statuses, timers] = await runQueries(config, [
    EVENTS_SQL,
    STATUSES_SQL,
    TIMERS_SQL,
  ]);
  return {
    events: parseRows(events, parseEvent),
    statuses: parseRows(statuses, parseStatus),
    timers: parseRows(timers, parseTimer),
    fetchedAt: new Date().toISOString(),
    source: "snowflake",
  };
}

async function loadSnapshot(): Promise<RawData> {
  const file = path.join(process.cwd(), "data", "snapshot.json");
  const text = await fs.readFile(file, "utf-8");
  const parsed: unknown = JSON.parse(text);
  const obj =
    typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  return {
    events: parseRows(obj.events, parseEvent),
    statuses: parseRows(obj.statuses, parseStatus),
    timers: parseRows(obj.timers, parseTimer),
    fetchedAt: asString(obj.fetchedAt) ?? "unknown",
    source: "snapshot",
  };
}

interface Cache {
  data: RawData;
  expiresAt: number;
}

let cache: Cache | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Load raw data, preferring live Snowflake (when SNOWFLAKE_* env vars are
 * set) with an in-memory cache, falling back to the bundled snapshot.
 */
export async function loadRawData(): Promise<RawData> {
  if (cache && cache.expiresAt > Date.now()) return cache.data;
  const useSnapshot = process.env.USE_SNAPSHOT === "1";
  let data: RawData | null = null;
  if (!useSnapshot) {
    data = await fetchFromSnowflake();
  }
  if (!data) {
    data = await loadSnapshot();
  }
  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}
