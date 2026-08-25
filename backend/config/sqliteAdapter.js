'use strict';

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

class SqlitePool {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(__dirname, '..', 'crm.sqlite');
    this.saveTimer = null;
    this.ready = this.init();
  }

  async init() {
    const SQL = await initSqlJs();
    let filebuffer = null;
    if (fs.existsSync(this.dbPath)) {
      try {
        filebuffer = fs.readFileSync(this.dbPath);
      } catch (e) {}
    }
    this.db = new SQL.Database(filebuffer);
  }

  save() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        if (this.db) {
          const data = this.db.export();
          const buffer = Buffer.from(data);
          fs.writeFile(this.dbPath, buffer, () => {});
        }
      } catch (e) {}
    }, 2000);
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

  async query(sql, params = []) {
    await this.ready;
    const transformed = this.transformSql(sql);
    const isSelect = /^\s*(SELECT|PRAGMA|EXPLAIN|SHOW)/i.test(transformed);

    try {
      if (isSelect) {
        const stmt = this.db.prepare(transformed);
        if (params && params.length) {
          stmt.bind(params);
        }
        const rows = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
        return [rows, []];
      } else {
        this.db.run(transformed, params || []);
        this.save();
        const res = this.db.exec("SELECT last_insert_rowid() as id, changes() as affected");
        const insertId = res[0] && res[0].values[0] ? res[0].values[0][0] : 0;
        const affectedRows = res[0] && res[0].values[0] ? res[0].values[0][1] : 0;
        return [{ insertId, affectedRows }, []];
      }
    } catch (err) {
      if (isSelect) return [[], []];
      return [{ insertId: 0, affectedRows: 0 }, []];
    }
  }

  async execute(sql, params = []) {
    return this.query(sql, params);
  }

  async getConnection() {
    await this.ready;
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
