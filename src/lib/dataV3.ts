import { promises as fs } from "fs";
import path from "path";
import type { SnapshotV3 } from "./typesV3";

let cache: { snap: SnapshotV3; loadedAt: number } | null = null;
const TTL_MS = 10 * 60 * 1000;

export async function loadSnapshotV3(forceRefresh = false): Promise<SnapshotV3> {
  if (!forceRefresh && cache && Date.now() - cache.loadedAt < TTL_MS) {
    return cache.snap;
  }
  const file = path.join(process.cwd(), "data", "snapshotV3.json");
  const snap = JSON.parse(await fs.readFile(file, "utf8")) as SnapshotV3;
  cache = { snap, loadedAt: Date.now() };
  return snap;
}
