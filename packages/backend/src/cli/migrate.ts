import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { postgres, closePostgres } from '../services/postgres.js';

const sql = await readFile(fileURLToPath(new URL('../migrations/001_foundation.sql', import.meta.url)), 'utf8');
try {
  await postgres().query(sql);
  console.log('Migration 001_foundation aplicada.');
} finally {
  await closePostgres();
}
