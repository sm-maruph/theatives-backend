require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Set it to the Supabase PostgreSQL connection string.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

/**
 * Temporary compatibility wrapper for the existing MySQL-style route files.
 * Converts `?` placeholders to PostgreSQL `$n` parameters and returns results
 * in the `[rows]` / `insertId` shape those routes currently expect.
 */
const query = async (sql, params = []) => {
  const values = [];
  let parameterIndex = 0;
  let statement = sql.replace(/\?/g, () => {
    const value = params[parameterIndex++];

    // Existing blog/showcase delete handlers pass an array to IN (?).
    if (Array.isArray(value)) {
      if (value.length === 0) return 'NULL';
      return value.map((item) => {
        values.push(item);
        return `$${values.length}`;
      }).join(', ');
    }

    values.push(value);
    return `$${values.length}`;
  });

  const isInsert = /^\s*insert\s+into\s/i.test(statement);
  if (isInsert && !/\breturning\b/i.test(statement)) {
    statement = `${statement.trimEnd()} RETURNING id`;
  }

  const result = await pool.query(statement, values);

  if (isInsert) {
    return [{
      insertId: result.rows[0]?.id == null ? undefined : Number(result.rows[0].id),
      affectedRows: result.rowCount,
    }];
  }

  if (/^\s*(update|delete|replace)\b/i.test(statement)) {
    return [{ affectedRows: result.rowCount }];
  }

  return [result.rows];
};

module.exports = { query, pool, end: () => pool.end() };
