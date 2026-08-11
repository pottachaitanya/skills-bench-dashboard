import { CAMPAIGN_ID, WORLD_DOMAINS } from "./config";
import type { TaskStatusRow } from "./types";

const STUDIO_BASE_URL =
  process.env.STUDIO_BASE_URL ?? "https://api.studio.mercor.com";
const STUDIO_COMPANY_ID =
  process.env.STUDIO_COMPANY_ID ?? "comp_2fa4115109d741cd94a3c409ed89e61f";

interface StudioTask {
  task_id: string;
  world_id: string | null;
  archived_at: string | null;
  status: string | null;
}

function parseStudioTasks(body: unknown): StudioTask[] {
  if (typeof body !== "object" || body === null) return [];
  const tasks = (body as Record<string, unknown>).tasks;
  if (!Array.isArray(tasks)) return [];
  const result: StudioTask[] = [];
  for (const item of tasks) {
    if (typeof item !== "object" || item === null) continue;
    const task = item as Record<string, unknown>;
    const taskId = typeof task.task_id === "string" ? task.task_id : null;
    if (!taskId) continue;
    const statusDefn = task.task_status_defn;
    const statusName =
      typeof statusDefn === "object" &&
      statusDefn !== null &&
      typeof (statusDefn as Record<string, unknown>).status_name === "string"
        ? ((statusDefn as Record<string, unknown>).status_name as string)
        : null;
    result.push({
      task_id: taskId,
      world_id: typeof task.world_id === "string" ? task.world_id : null,
      archived_at:
        typeof task.archived_at === "string" ? task.archived_at : null,
      status: statusName,
    });
  }
  return result;
}

/**
 * Fetch live current task statuses from the Studio API for the ten campaign
 * worlds. Returns null when STUDIO_API_KEY is not configured.
 */
export async function fetchStudioStatuses(): Promise<TaskStatusRow[] | null> {
  const apiKey = process.env.STUDIO_API_KEY;
  if (!apiKey) return null;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "X-Campaign-Id": CAMPAIGN_ID,
    "X-Company-Id": STUDIO_COMPANY_ID,
  };
  const worldIds = Object.keys(WORLD_DOMAINS);
  const responses = await Promise.all(
    worldIds.map(async (worldId) => {
      const res = await fetch(`${STUDIO_BASE_URL}/tasks/world/${worldId}`, {
        headers,
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`Studio API ${res.status} for world ${worldId}`);
      }
      const body: unknown = await res.json();
      return parseStudioTasks(body);
    }),
  );
  const rows: TaskStatusRow[] = [];
  for (const tasks of responses) {
    for (const task of tasks) {
      if (task.archived_at || !task.status) continue;
      rows.push({
        taskId: task.task_id,
        worldId: task.world_id,
        status: task.status.toLowerCase(),
      });
    }
  }
  return rows;
}
