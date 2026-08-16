# Healthcare Recruitment CRM Portal (Parts 1–8 COMPLETE)

Production-ready foundation for a Healthcare Staffing Agency Recruitment CRM. This repository contains the complete system across all 8 phases of development.

## Tech Stack
- Frontend: HTML5 + CSS3 + Vanilla JS
- Backend: Node.js + Express.js
- Database: MySQL
- Auth: JWT + bcrypt

## Folder Structure
- `backend/` Express API + static frontend hosting
- `frontend/` Complete Admin UI (Landing + Dashboard + CRM Modules)
- `database/schema.sql` Complete MySQL schema mapping all business models.

## Prerequisites
- Node.js 18+
- MySQL 8+ (works with 5.7+ too)

## 1) Create MySQL DB

Create the database:

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS recruitment_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

(Optional) Create tables using the provided schema:

```bash
cd recruitment-crm
mysql -u root -p recruitment_crm < database/schema.sql
```

> The backend also auto-creates the required tables on startup, but the **database** must exist.

## 2) Configure environment
Edit `backend/.env` and set your MySQL credentials and a strong JWT secret.

Example:
```env
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=recruitment_crm
JWT_SECRET=your-long-random-secret
```

## 3) Install backend dependencies

```bash
cd backend
npm install
```

## 4) Run the app

```bash
npm start
```

App will run at:
- http://localhost:5050

## Default Admin Login
- Email: `admin@crm.com`
- Password: `admin123`

The admin user is automatically seeded on startup if it doesn’t exist.

## Modules Implemented
- **Part 1:** Landing Page + Authentication + Dashboard Shell
- **Part 2:** Hospital Management + Job Openings
- **Part 3:** Applicant Management + Resume Uploads
- **Part 4:** Resume Masking + Candidate Matching + Pool Database
- **Part 5:** Application Pipeline + Interview Scheduling
- **Part 6:** Invoicing + Referrals
- **Part 7:** Employee Management + Attendance + Leaves + Salary Tracker
- **Part 8:** Executive Dashboard + Calendar/Reminders + Monthly Projections + Admin CSV Reports

## Access Control
- All API routes are protected by JWT Bearer auth.
- **Admin**: Has full system control, sees all data, can create/edit users, manage invoices, projections, reports, etc.
- **Employee**: Can view hospitals, jobs, and applicants. Can manage their own attendance/leaves, view their own salary, and manage their assigned tasks/reminders.

## Deployment Notes
- This system runs natively as an Express monolith and can be easily deployed to a VPS or Dockerized container.
- For production, ensure PDF resumes inside `backend/uploads/` are secured or migrated to S3.
- Set a real `JWT_SECRET` prior to production deployment.
