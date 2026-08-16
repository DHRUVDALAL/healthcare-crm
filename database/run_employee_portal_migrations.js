'use strict';

const fs = require('fs');
const path = require('path');
const backendDir = path.join(__dirname, '..', 'backend');

// Load environment variables
require(path.join(backendDir, 'node_modules', 'dotenv')).config({ path: path.join(backendDir, '.env') });
const { getPool } = require(path.join(backendDir, 'config', 'db'));

async function main() {
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    console.log('Starting DB migrations for Employee Portal phase...');

    // 1. Alter users table
    console.log('Checking and adding users columns...');
    const [userCols] = await conn.query('DESCRIBE users');
    const userColNames = userCols.map(c => c.Field);

    if (!userColNames.includes('photo_path')) {
      console.log('Adding column users.photo_path...');
      await conn.query('ALTER TABLE users ADD COLUMN photo_path VARCHAR(500) NULL');
    }
    if (!userColNames.includes('theme')) {
      console.log('Adding column users.theme...');
      await conn.query("ALTER TABLE users ADD COLUMN theme VARCHAR(30) NOT NULL DEFAULT 'light'");
    }
    if (!userColNames.includes('notification_preferences')) {
      console.log('Adding column users.notification_preferences...');
      await conn.query('ALTER TABLE users ADD COLUMN notification_preferences TEXT NULL');
    }

    // 2. Alter tasks table
    console.log('Checking and altering tasks columns...');
    const [taskCols] = await conn.query('DESCRIBE tasks');
    const taskColNames = taskCols.map(c => c.Field);

    console.log('Altering tasks.task_type to VARCHAR(100)...');
    await conn.query('ALTER TABLE tasks MODIFY COLUMN task_type VARCHAR(100) NOT NULL DEFAULT "daily"');

    if (!taskColNames.includes('completion_percentage')) {
      console.log('Adding column tasks.completion_percentage...');
      await conn.query('ALTER TABLE tasks ADD COLUMN completion_percentage INT NOT NULL DEFAULT 0');
    }

    console.log('Converting existing task status values safely...');
    await conn.query('ALTER TABLE tasks MODIFY COLUMN status VARCHAR(50) NOT NULL');
    await conn.query(`UPDATE tasks SET status = 'pending' WHERE status IN ('not_started', 'overdue')`);

    console.log('Altering tasks.status ENUM...');
    await conn.query(`
      ALTER TABLE tasks MODIFY COLUMN status ENUM(
        'pending', 'in_progress', 'completed', 'blocked', 'cancelled'
      ) NOT NULL DEFAULT 'pending'
    `);

    // 3. Create task_comments table
    console.log('Creating task_comments table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS task_comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id INT NOT NULL,
        user_id INT NOT NULL,
        comment_text TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_task_comments_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        CONSTRAINT fk_task_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 4. Create task_attachments table
    console.log('Creating task_attachments table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS task_attachments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id INT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        uploaded_by INT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_task_attachments_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        CONSTRAINT fk_task_attachments_user FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 5. Create candidate_follow_ups table
    console.log('Creating candidate_follow_ups table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS candidate_follow_ups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        applicant_id INT NOT NULL,
        employee_id INT NOT NULL,
        follow_up_date DATE NOT NULL,
        follow_up_time TIME NULL,
        remarks TEXT NULL,
        outcome TEXT NULL,
        next_follow_up_date DATE NULL,
        next_follow_up_time TIME NULL,
        reminder_set TINYINT(1) DEFAULT 0,
        status ENUM('pending', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_follow_ups_applicant FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE,
        CONSTRAINT fk_follow_ups_employee FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 6. Alter reminders table
    console.log('Checking and altering reminders columns...');
    const [remCols] = await conn.query('DESCRIBE reminders');
    const remColNames = remCols.map(c => c.Field);

    if (!remColNames.includes('visibility')) {
      console.log('Adding column reminders.visibility...');
      await conn.query(`
        ALTER TABLE reminders ADD COLUMN visibility ENUM('private', 'public') NOT NULL DEFAULT 'private'
      `);
    }

    console.log('Database migrations completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    conn.release();
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
