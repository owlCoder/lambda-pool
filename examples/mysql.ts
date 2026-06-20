import mysql from "mysql2/promise";
import { buildMysqlPoolOptions } from "lambda-pool/mysql";

// One tiny pool per warm lambda. The platform's horizontal scaling is your
// concurrency; the database never sees a connection storm.
const pool = mysql.createPool(buildMysqlPoolOptions(process.env));

export async function getUser(id: number) {
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [id]);
  return (rows as unknown[])[0];
}
