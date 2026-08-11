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

const PAYOUTS =
  "PROJECT_ANALYTICS.CENTRALIZED.CONTRACTOR_HOURS_PAYOUTS_ROLE_BASED";
const MERCOR_USERS = "ANALYTICS_DATABASE.AURORA_MERCOR_PRODUCTION.MERCORUSERS";

/** Daily payable amount and role-split hours per contributor. */
export const PAYOUTS_SQL = `
SELECT
  USERID AS "userId",
  TO_VARCHAR(REPORT_DATE, 'YYYY-MM-DD') AS "date",
  SUM(PAYABLE_AMOUNT) AS "payable",
  SUM(DURATION_HOURS) AS "hours",
  SUM(WRITER_DURATION_HOURS) AS "writerHours",
  SUM(REVIEWER_DURATION_HOURS) AS "reviewerHours"
FROM ${PAYOUTS}
WHERE PROJECTID = '${PROJECT_ID}'
GROUP BY 1, 2
ORDER BY 2
`;

/** Identity map (name/email) for task authors and payout recipients. */
export const USERS_SQL = `
WITH authors AS (
  SELECT
    VERSION_AUTHOR_USER_ID AS uid,
    MAX(VERSION_AUTHOR_NAME) AS name,
    MAX(VERSION_AUTHOR_EMAIL) AS email
  FROM ${TASK_VERSIONS}
  WHERE PROJECT_ID = '${PROJECT_ID}' AND VERSION_AUTHOR_USER_ID IS NOT NULL
  GROUP BY 1
),
payout_users AS (
  SELECT DISTINCT USERID AS uid FROM ${PAYOUTS}
  WHERE PROJECTID = '${PROJECT_ID}'
),
all_users AS (SELECT uid FROM authors UNION SELECT uid FROM payout_users)
SELECT
  u.uid AS "userId",
  COALESCE(a.name, m.NAME) AS "name",
  COALESCE(a.email, m.EMAIL) AS "email"
FROM all_users u
LEFT JOIN authors a ON a.uid = u.uid
LEFT JOIN ${MERCOR_USERS} m
  ON m.USERID = u.uid AND COALESCE(m._FIVETRAN_DELETED, FALSE) = FALSE
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
