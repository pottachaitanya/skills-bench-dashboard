# Skills Bench Analytics Dashboard

Analytics dashboard for the Studio campaign **Skills Bench**:

- Campaign: `camp_eff62e0c0fc74cf09d89b23e6879cf81` (Skillsbench)
- Project: `proj_AAABndZ4FEZ1odUUJnBMi79x`

Built with Next.js 15 (App Router) + TypeScript + Tailwind + Recharts. All
data access happens server-side in `/api/dashboard`; no credentials or raw
warehouse access is exposed to the client.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in Snowflake credentials
npm run dev                  # http://localhost:3000
```

Without Snowflake credentials, set `USE_SNAPSHOT=1` to serve the bundled
`data/snapshot.json` (a point-in-time extract of the same queries).

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `SNOWFLAKE_ACCOUNT` | yes* | Snowflake account identifier (`FRDMZMO-XHB72082`) |
| `SNOWFLAKE_USER` | yes* | Read-only service user |
| `SNOWFLAKE_PASSWORD` | one of | Password auth |
| `SNOWFLAKE_PRIVATE_KEY` | one of | PKCS8 PEM key-pair auth (`\n`-escaped newlines OK) |
| `SNOWFLAKE_ROLE` | no | Role with read on `PROJECT_ANALYTICS.CENTRALIZED` and `ANALYTICS_DATABASE.AURORA_MERCOR_PRODUCTION.TIMELOG` |
| `SNOWFLAKE_WAREHOUSE` | no | e.g. `ADHOC_WH` |
| `USE_SNAPSHOT` | no | `1` = serve bundled snapshot instead of live queries |
| `STUDIO_API_KEY` | no | RLS Studio API key — enables **hybrid mode**: current task statuses (totals / approved / awaiting review per domain) are fetched live from the Studio REST API even without Snowflake. Units, one-shot, and AHT still come from Snowflake or the snapshot. |
| `STUDIO_BASE_URL` | no | Default `https://api.studio.mercor.com` |
| `STUDIO_COMPANY_ID` | no | Company scope header for the Studio API |

\* If Snowflake variables are missing the app automatically falls back to the
snapshot.

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run validate` | Metric-invariant validation harness (see below) |

## Data sources

The dashboard runs three read-only queries (see `src/lib/queries.ts`):

1. **Unit events** — `PROJECT_ANALYTICS.CENTRALIZED.CONSOLIDATED_TASK_VERSIONS`
   filtered to the project: one row per task version authored by a
   `writer` (`submit`/`revise`) or `reviewer` (`approve`/`reject`), with
   world ID, author, and UTC timestamp. This is the canonical cross-platform
   task-version spine maintained by the data team.
2. **Current task statuses** — same table; latest version row per `TASK_ID`
   gives the task's current status and world.
3. **Timer hours** — `ANALYTICS_DATABASE.AURORA_MERCOR_PRODUCTION.TIMELOG`
   (Insightful time tracking), daily hours per user for exactly two timers:
   - `Skillsbench - Task` → writer hours
   - `Task Review-SkillsBench` → reviewer hours

All timestamps are normalized to **UTC** in SQL; every date bucket and
rolling window uses UTC calendar days.

Results are cached in-memory for 10 minutes per server instance.

## Metric definitions

| Metric | Definition |
|---|---|
| Total Tasks | Distinct tasks whose current status is not `discarded` |
| Approved Tasks | Current status in {`approved`, `qa approved`} |
| Awaiting Review | Current status in {`awaiting review`, `re-reviewing`, `qa in review`} |
| Writer Units | Count of writer `submit`/`revise` task versions |
| Reviewer Units | Count of reviewer `approve`/`reject` task versions |
| Unique Tasks Written | Distinct task IDs with ≥1 writer event (deduplicated) |
| Unique Tasks Reviewed | Distinct task IDs with ≥1 reviewer event (deduplicated) |
| Approved (last 7d) | Tasks whose **first** approval event falls in the rolling window |
| One-Shot Rate | Tasks whose first reviewer decision is `approve` ÷ tasks with ≥1 reviewer decision. **Never divided by 2.** |
| Writer AHT | `Skillsbench - Task` timer hours ÷ **raw** writer units (also shown per unique task) |
| Reviewer AHT | `Task Review-SkillsBench` timer hours ÷ **raw** reviewer units (also shown per unique review) |

Expert attribution: a task's writer is the author of its first writer
submission; expert-level one-shot rate and approved tasks use the tasks the
expert authored. Expert AHT = the expert's timer hours ÷ the expert's unique
tasks written (writer) or unique tasks reviewed (reviewer), per the campaign
spec.

Domain mapping uses the ten world IDs configured in `src/lib/config.ts`;
tasks in any other world are grouped under **Other** so overall totals always
reconcile with the domain rollup.

## The /2 transformation

Every **task-related count** (task totals, approved, awaiting review, units,
unique tasks/reviews) is divided by 2 exactly once before display, per the
campaign's counting convention. This is implemented in a single function —
`scaleTaskCount()` in `src/lib/metrics.ts` — which returns
`{ raw, display: raw / 2 }`, keeping the raw value alongside the displayed
value so every number is auditable. Rates (one-shot), percentages, timer
hours, and AHT are **never** scaled, and AHT denominators use **raw** unit
counts (dividing both hours and units would be a no-op anyway, but the code
is explicit about using raw).

## Validation

`npm run validate` recomputes the dashboard payload and asserts:

- `display === raw / 2` for every task-related count (exactly once)
- one-shot rate ∈ [0, 1]; AHT = hours ÷ raw units (unscaled)
- domain rollups sum exactly to overall totals (tasks, approved, units)
- unique task/review counts are deduplicated (match distinct task IDs, never
  exceed unit counts)
- expert unit totals reconcile with overall events that have a known author
- rolling 7-day windows span exactly 7 UTC days
- writer/reviewer hours come only from the two configured timers

Cross-checks against the canonical warehouse marts (2026-08-10): raw writer
units 5,038 and reviewer units 4,238 computed by this dashboard match
`PROJECT_ANALYTICS.CENTRALIZED.FACT_DAILY_USER_TASK_METRICS` for the project
exactly. Note that the mart's "unique task" columns count distinct
user×task pairs, while this dashboard deduplicates across users
(task-level), per the campaign spec.

## Deployment (Vercel)

1. Import the GitHub repo in Vercel (framework preset: Next.js — no custom
   settings needed).
2. Add the `SNOWFLAKE_*` environment variables from the table above
   (server-side only; do **not** prefix with `NEXT_PUBLIC_`).
3. Deploy. `/api/dashboard` runs on the Node.js runtime and queries
   Snowflake directly; verify the header shows a fresh "Data refreshed"
   timestamp without "(snapshot)".
