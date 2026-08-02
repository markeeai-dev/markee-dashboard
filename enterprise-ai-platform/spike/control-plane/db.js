'use strict';
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: parseInt(process.env.PGPORT || '5432', 10),
  database: process.env.PGDATABASE || 'center_ai',
  user: process.env.PGUSER || 'center_ai',
  password: process.env.PGPASSWORD || '',
});

function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };
