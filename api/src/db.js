import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
const ca = process.env.MYSQL_SSL_CA || (process.env.MYSQL_SSL_CA_PATH
  ? readFileSync(resolve(fileURLToPath(new URL('../', import.meta.url)), process.env.MYSQL_SSL_CA_PATH), 'utf8')
  : undefined);
export const connectionOptions = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'short_crm',
  ...(ca ? { ssl: { ca, rejectUnauthorized: true } } : {}),
  connectTimeout: 10000,
};
export const db = mysql.createPool({
  ...connectionOptions,
  waitForConnections: true, connectionLimit: 10,
  dateStrings: true, decimalNumbers: true,
});
