'use strict';

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class SqlitePool {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(__dirname, '..', 'crm.sqlite');
    this.db = new sqlite3.Database(this.dbPath);
    this.db.run('PRAGMA foreign_keys = OFF;');
  }

  transformSql(sql) {
    let s = sql;
    
    // Ignore MySQL ALTER TABLE MODIFY COLUMN and ADD CONSTRAINT in SQLite
    if (/^\s*ALTER\s+TABLE\s+[\w_]+\s+(MODIFY\s+COLUMN|ADD\s+CONSTRAINT)/i.test(s)) {
      return "SELECT 1";
    }

    // Remove MySQL ON UPDATE CURRENT_TIMESTAMP
    s = s.replace(/ON\s+UPDATE\s+CURRENT_TIMESTAMP/gi, '');
    // Convert ENUM(...) to TEXT
    s = s.replace(/ENUM\([^)]+\)/gi, 'TEXT');
    // Remove MySQL Engine & Charset clauses
    s = s.replace(/ENGINE\s*=\s*\w+\s*(DEFAULT\s+CHARSET\s*=\s*\w+)?;/gi, ';');
    s = s.replace(/ENGINE\s*=\s*\w+\s*(DEFAULT\s+CHARSET\s*=\s*\w+)?/gi, '');
    
    // Convert INT/BIGINT AUTO_INCREMENT to INTEGER PRIMARY KEY AUTOINCREMENT
    s = s.replace(/\b(INT|BIGINT|INTEGER)\s+AUTO_INCREMENT\s+PRIMARY\s+KEY\b/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');
    s = s.replace(/\b(INT|BIGINT|INTEGER)\s+AUTO_INCREMENT\b/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');
    
    // Convert INSERT IGNORE to INSERT OR IGNORE
    s = s.replace(/INSERT\s+IGNORE/gi, 'INSERT OR IGNORE');
    
    // Clean up MySQL table constraints and keys inside CREATE TABLE
    s = s.replace(/,\s*(UNIQUE\s+)?KEY\s+[\w_]+\s*\([^)]+\)/gi, '');
    s = s.replace(/,\s*CONSTRAINT\s+[\w_]+\s+FOREIGN\s+KEY\s*\([^)]+\)\s*REFERENCES\s+[\w_]+\s*\([^)]+\)\s*(ON\s+(DELETE|UPDATE)\s+[\w_\s]+)*/gi, '');
    s = s.replace(/,\s*FOREIGN\s+KEY\s*\([^)]+\)\s*REFERENCES\s+[\w_]+\s*\([^)]+\)\s*(ON\s+(DELETE|UPDATE)\s+[\w_\s]+)*/gi, '');
    
    // Convert NOW() and CURDATE()
    s = s.replace(/NOW\(\)/gi, "datetime('now')");
    s = s.replace(/CURDATE\(\)/gi, "date('now')");
    
    return s;
  }

  query(sql, params = []) {
    return new Promise((resolve, reject) => {
      const transformed = this.transformSql(sql);
      const isSelect = /^\s*(SELECT|PRAGMA|EXPLAIN|SHOW)/i.test(transformed);

      if (isSelect) {
        this.db.all(transformed, params || [], (err, rows) => {
          if (err) return reject(err);
          resolve([rows || [], []]);
        });
      } else {
        this.db.run(transformed, params || [], function (err) {
          if (err) return resolve([{ insertId: 0, affectedRows: 0 }, []]);
          resolve([{ insertId: this.lastID, affectedRows: this.changes }, []]);
        });
      }
    });
  }

  async execute(sql, params = []) {
    return this.query(sql, params);
  }

  async getConnection() {
    return {
      query: (sql, params) => this.query(sql, params),
      execute: (sql, params) => this.execute(sql, params),
      ping: async () => true,
      release: () => {},
      beginTransaction: async () => this.query('BEGIN TRANSACTION'),
      commit: async () => this.query('COMMIT'),
      rollback: async () => this.query('ROLLBACK')
    };
  }
}

module.exports = SqlitePool;
