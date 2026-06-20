import { Pool } from "pg";
import { buildPgPoolOptions } from "lambda-pool/pg";

// Same idea as the mysql example: max:1 per warm lambda, idle clients released.
const pool = new Pool(buildPgPoolOptions(process.env));

export async function getUser(id: number) {
  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return rows[0];
}
