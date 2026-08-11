import snowflake from "snowflake-sdk";

export interface SnowflakeConfig {
  account: string;
  username: string;
  password?: string;
  privateKey?: string;
  role?: string;
  warehouse?: string;
}

export function getSnowflakeConfig(): SnowflakeConfig | null {
  const account = process.env.SNOWFLAKE_ACCOUNT;
  const username = process.env.SNOWFLAKE_USER;
  const password = process.env.SNOWFLAKE_PASSWORD;
  const privateKey = process.env.SNOWFLAKE_PRIVATE_KEY;
  if (!account || !username || (!password && !privateKey)) return null;
  return {
    account,
    username,
    password,
    privateKey: privateKey?.replace(/\\n/g, "\n"),
    role: process.env.SNOWFLAKE_ROLE,
    warehouse: process.env.SNOWFLAKE_WAREHOUSE,
  };
}

function connect(config: SnowflakeConfig): Promise<snowflake.Connection> {
  const connection = snowflake.createConnection({
    account: config.account,
    username: config.username,
    ...(config.privateKey
      ? { authenticator: "SNOWFLAKE_JWT", privateKey: config.privateKey }
      : { password: config.password }),
    role: config.role,
    warehouse: config.warehouse,
    clientSessionKeepAlive: false,
  });
  return new Promise((resolve, reject) => {
    connection.connect((err, conn) => (err ? reject(err) : resolve(conn)));
  });
}

function destroy(connection: snowflake.Connection): Promise<void> {
  return new Promise((resolve) => connection.destroy(() => resolve()));
}

function execute(
  connection: snowflake.Connection,
  sqlText: string,
): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      complete: (err, _stmt, rows) =>
        err ? reject(err) : resolve(rows ?? []),
    });
  });
}

/** Run several read-only queries on one connection, returning rows per query. */
export async function runQueries(
  config: SnowflakeConfig,
  sqlTexts: string[],
): Promise<Record<string, unknown>[][]> {
  const connection = await connect(config);
  try {
    const results: Record<string, unknown>[][] = [];
    for (const sqlText of sqlTexts) {
      results.push(await execute(connection, sqlText));
    }
    return results;
  } finally {
    await destroy(connection);
  }
}
