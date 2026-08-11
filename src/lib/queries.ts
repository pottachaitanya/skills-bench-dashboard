import {
  PROJECT_ID,
  REVIEWER_TIMER_NAME,
  WRITER_TIMER_NAME,
} from "./config";

// All queries are read-only and parameterized only with compile-time
// constants from config.ts (no user input is ever interpolated).

const TASK_VERSIONS = "PROJECT_ANALYTICS.CENTRALIZED.CONSOLIDATED_TASK_VERSIONS";
const TIMELOG = "ANALYTICS_DATABASE.AURORA_MERCOR_PRODUCTION.TIMELOG";

/**
 * Writer/reviewer unit events: one row per task version created by a writer
 * (submit/revise) or reviewer (approve/reject).
 */
export const EVENTS_SQL = `
SELECT
  TASK_ID   AS "taskId",
  WORLD_ID  AS "worldId",
  ROLE_ID   AS "role",
  ACTION_ID AS "action",
  TO_VARCHAR(CONVERT_TIMEZONE('UTC', CREATED_TIME), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "createdAt",
  VERSION_AUTHOR_USER_ID AS "userId",
  COALESCE(VERSION_AUTHOR_NAME, VERSION_AUTHOR_EMAIL) AS "userName"
FROM ${TASK_VERSIONS}
WHERE PROJECT_ID = '${PROJECT_ID}'
  AND ROLE_ID IN ('writer', 'reviewer')
  AND ACTION_ID IN ('submit', 'revise', 'approve', 'reject')
ORDER BY CREATED_TIME
`;

/** Current status per task = status on the latest version row. */
export const STATUSES_SQL = `
SELECT
  TASK_ID  AS "taskId",
  WORLD_ID AS "worldId",
  LOWER(TASK_STATUS) AS "status"
FROM ${TASK_VERSIONS}
WHERE PROJECT_ID = '${PROJECT_ID}'
QUALIFY ROW_NUMBER() OVER (PARTITION BY TASK_ID ORDER BY CREATED_TIME DESC) = 1
`;

/** Daily Insightful timer hours per user for the two Skills Bench timers. */
export const TIMERS_SQL = `
SELECT
  USERID AS "userId",
  CASE TASKNAME
    WHEN '${WRITER_TIMER_NAME}' THEN 'writer'
    ELSE 'reviewer'
  END AS "timer",
  TO_VARCHAR(CONVERT_TIMEZONE('UTC', TO_TIMESTAMP(TIMESTART / 1000)), 'YYYY-MM-DD') AS "date",
  SUM(DURATION) / 3600000 AS "hours"
FROM ${TIMELOG}
WHERE TASKNAME IN ('${WRITER_TIMER_NAME}', '${REVIEWER_TIMER_NAME}')
  AND COALESCE(_FIVETRAN_DELETED, FALSE) = FALSE
  AND USERID IS NOT NULL
GROUP BY 1, 2, 3
`;
