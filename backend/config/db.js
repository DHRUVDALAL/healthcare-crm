'use strict';

const mysql = require('mysql2/promise');
const SqlitePool = require('./sqliteAdapter');

let pool;
let isUsingSqlite = false;

function getPool() {
  if (!pool) {
    if (process.env.USE_EMBEDDED_DB === 'true' || !process.env.DB_HOST) {
      console.log('ℹ️ Using self-contained embedded database pool');
      pool = new SqlitePool();
      isUsingSqlite = true;
      return pool;
    }

    let dbConfig;

    if (process.env.DATABASE_URL) {
      try {
        const u = new URL(process.env.DATABASE_URL);
        dbConfig = {
          host: u.hostname,
          port: Number(u.port || 3306),
          user: u.username,
          password: decodeURIComponent(u.password || ''),
          database: u.pathname.replace(/^\//, ''),
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          timezone: 'Z'
        };
      } catch (err) {
        dbConfig = {
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT || 3306),
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          timezone: 'Z'
        };
      }
    } else {
      dbConfig = {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        timezone: 'Z'
      };
    }

    if (process.env.DB_SSL === 'true' || process.env.MYSQL_ATTR_SSL_CA) {
      dbConfig.ssl = { rejectUnauthorized: false };
    }

    pool = mysql.createPool(dbConfig);
  }

  return pool;
}

async function testDbConnection() {
  const p = getPool();
  if (isUsingSqlite) return;

  try {
    const conn = await p.getConnection();
    try {
      await conn.ping();
    } finally {
      conn.release();
    }
  } catch (err) {
    console.warn('⚠️ Primary database host unavailable (' + err.message + '). Switching seamlessly to embedded database engine...');
    pool = new SqlitePool();
    isUsingSqlite = true;
  }
}

module.exports = {
  getPool,
  testDbConnection
};
