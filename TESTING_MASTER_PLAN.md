# HealthCRM — Enterprise ERP + CRM Testing Master Plan

> **Version**: 1.0  
> **Document Reference**: QA-TMP-2026-07  
> **Status**: APPROVED  
> **Author**: Lead QA Architect  

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Master Test Summary](#2-master-test-summary)
3. [Authentication Tests](#3-authentication-tests)
4. [Landing Page Tests](#4-landing-page-tests)
5. [Admin Dashboard Tests](#5-admin-dashboard-tests)
6. [Employee Dashboard Tests](#6-employee-dashboard-tests)
7. [Recruitment Module Tests](#7-recruitment-module-tests)
8. [Employee Module Tests](#8-employee-module-tests)
9. [Task Management Tests](#9-task-management-tests)
10. [Performance Module Tests](#10-performance-module-tests)
11. [HR Module Tests](#11-hr-module-tests)
12. [Finance Module Tests](#12-finance-module-tests)
13. [Calendar Tests](#13-calendar-tests)
14. [Settings Tests](#14-settings-tests)
15. [Role-Based Access Control (RBAC) Tests](#15-role-based-access-control-rbac-tests)
16. [Database Testing](#16-database-testing)
17. [API Testing](#17-api-testing)
18. [Security Testing](#18-security-testing)
19. [Performance Testing](#19-performance-testing)
20. [Responsive Testing](#20-responsive-testing)
21. [Accessibility Testing](#21-accessibility-testing)
22. [Regression Testing Checklist](#22-regression-testing-checklist)
23. [Bug Report Template](#23-bug-report-template)
24. [Implementation Status Checklist](#24-implementation-status-checklist)
25. [Future Features & Roadmap](#25-future-features--roadmap)

---

## 1. Project Overview

### Purpose
This document establishes the comprehensive verification and validation protocol for the HealthCRM platform. It functions as the authoritative checklist for manual functional verification, layout validation, and regression suites, while providing a precise mapping and criteria matrix to develop future automated end-to-end (E2E) testing flows.

### Testing Strategy
To achieve production-grade stability, a multi-tiered test strategy is used:
1. **Automated Verification**: Zero-dependency Node.js test runners validating schema, security headers, endpoints, and key E2E workflows.
2. **Manual Functional Testing**: Step-by-step verification of UI workflows, dashboard updates, and visual edge cases.
3. **Security Probing**: Rigorous inputs auditing for SQL Injection, XSS, and authorization privilege escalations.
4. **Performance Auditing**: Verifying database connection pool scaling and API response latency.

### Testing Levels
- **Level 1: Unit & Schema Verification**: Validation of core models, schema columns, unique constraints, and referential keys.
- **Level 2: API Integration Validation**: Endpoint request schema, JWT guards, status codes, and error formatting.
- **Level 3: End-to-End (E2E) Workflow Testing**: Testing consecutive business flows (e.g., Onboarding -> Job -> Applicant -> Match -> Hiring -> Invoice).
- **Level 4: User Interface (UI) Integrity**: Checking layout elements, assets, collapsibles, theme classes, and duplicate ID audits.

### Testing Environment
- **Host Engine**: local loopback or test runner environments
- **Application URL**: `http://localhost:5050`
- **Database Engine**: MariaDB / MySQL `v8.0+` on port `3306`
- **Node.js runtime**: `v25.9.0`

### Browser Requirements
- Google Chrome: Version `115+` (Chromium engine)
- Mozilla Firefox: Version `110+`
- Apple Safari: Version `16+`
- Microsoft Edge: Version `115+`

### Database Requirements
- Database: `recruitment_crm` (seeding verified via `backend/utils/dbInit.js`)
- Credentials: host `127.0.0.1:3306`, user `root`, password `root123`
- Connection Pools: minimum 10 connections configuration.

### User Accounts
| Email | Password | Role | Purpose |
| :--- | :--- | :---: | :--- |
| `admin@crm.com` | `admin123` | **Admin** | Superuser settings, global configurations, approvals |
| `recruiter_test@crm.com`| `recruiter123`| **Employee** | Job openings, timeline notes, applicants matching |

### Test Data
- Test Hospital Name: `Workflow Hospital Inc`
- Test Candidate Email: `workflow_candidate@crm.com`
- Test Candidate Resume: `uploads/resumes/mock_workflow_resume.pdf`

---

## 2. Master Test Summary

| Module | Feature | Priority | Status | Dependencies | Risk | Testing Type |
| :--- | :--- | :---: | :---: | :--- | :---: | :--- |
| **Auth** | Login Validation | Critical | Active | Database, JWT | High | API, Functional |
| **Recruitment**| Hospital Onboarding | High | Active | Auth Session | Medium | E2E, Database |
| **Recruitment**| Matching Suggestions | High | Active | Job & Applicant DB | Medium | API, Functional |
| **Recruitment**| Timeline Logging | Medium | Active | Events Tables | Low | API, UI Integrity |
| **Finance** | Invoice Generation | High | Active | Hospital Data | High | API, E2E |
| **HR** | Attendance tracking | Medium | Gap | Employee Database | High | Database, API |
| **Admin** | Settings Customization| Low | Active | Config Tables | Low | Functional |

---

## 3. Authentication Tests

### [ ] TC-AUTH-01: Valid Admin Login
- **Preconditions**: User account `admin@crm.com` with password `admin123` exists.
- **Steps**:
  1. Navigate to `/pages/login.html`.
  2. Input Email `admin@crm.com` and Password `admin123`.
  3. Click "Sign In".
- **Expected Result**: Redirected to `/pages/dashboard.html` with a valid JWT saved in `localStorage` under key `token`. Topbar/sidebar displays "System Admin".

### [ ] TC-AUTH-02: Logout Handler Execution
- **Preconditions**: User is logged in with token in storage.
- **Steps**:
  1. Click the "Logout" trigger button in the sidebar.
- **Expected Result**: JWT cleared from `localStorage`. User redirected to `/pages/login.html`. Back button access to dashboard returns 401/redirects to login.

### [ ] TC-AUTH-03: Invalid Password Attempt
- **Preconditions**: User `admin@crm.com` exists.
- **Steps**:
  1. Input `admin@crm.com` and password `wrongpassword`.
  2. Click "Sign In".
- **Expected Result**: Sign-in fails. Red error message displays "Invalid credentials". Status code `401 Unauthorized` in DevTools network tab.

### [ ] TC-AUTH-04: Unauthorized Page Access Guard
- **Preconditions**: No active session token in browser.
- **Steps**:
  1. Direct navigate to `http://localhost:5050/pages/dashboard.html`.
- **Expected Result**: Browser automatically intercepts request and redirects to `/pages/login.html`.

### [ ] TC-AUTH-05: JWT Signature Tampering Check
- **Preconditions**: Active session.
- **Steps**:
  1. Open Chrome DevTools -> Application -> LocalStorage.
  2. Modify the signature block of the JWT value.
  3. Refresh the page or trigger an API request (e.g., dashboard load).
- **Expected Result**: Request fails with `401 Unauthorized`. Browser clears token and forces redirect to login.

### [ ] TC-AUTH-06: Session Expiry Validation
- **Preconditions**: JWT expiration duration set to short interval (e.g., 5 seconds).
- **Steps**:
  1. Log in. Wait for expiration duration to expire.
  2. Click a dashboard sidebar navigation option.
- **Expected Result**: Request fails with status `401`. Toast alert reads "Session expired, please log in again" and redirects user to login.

---

## 4. Landing Page Tests

### [ ] TC-LAND-01: Navigation Links Route Check
- **Steps**:
  1. Click every header navigation link (Home, Features, Pricing, Contact).
- **Expected Result**: Page scrolls smoothly to correct anchors, or redirects to matching sub-pages without console exceptions.

### [ ] TC-LAND-02: Animated Elements Layout Review
- **Steps**:
  1. Scroll down the landing page and observe loading animations.
- **Expected Result**: Cards fade/slide in smoothly without lag. No rendering bugs.

### [ ] TC-LAND-03: SEO Metadata Audit
- **Steps**:
  1. Inspect source of Landing page.
- **Expected Result**: Exists single `<title>` tag, description meta tag is not empty, and semantic header structure (`<h1>` down to `<h3>`) exists.

---

## 5. Admin Dashboard Tests

### [ ] TC-DASH-01: Statistics Cards Data Matching
- **Preconditions**: Database populated with candidates, hospitals, and openings.
- **Steps**:
  1. Log in as Administrator.
  2. Read summary counters: "Active Jobs", "Joined Candidates", "Pending Invoices".
- **Expected Result**: Summary counters count match database counts.

### [ ] TC-DASH-02: Recent Activity Timeline Feeds
- **Steps**:
  1. Perform an action (e.g. create candidate or schedule interview).
  2. Navigate back to Dashboard home.
- **Expected Result**: Action appears at the top of the "Recent Activity" timeline with timestamp and username.

---

## 6. Employee Dashboard Tests

### [ ] TC-EMP-01: Assigned Tasks Checklist
- **Preconditions**: Employee has tasks assigned by Admin.
- **Steps**:
  1. Log in as employee account.
  2. Locate "Assigned Tasks" card.
- **Expected Result**: Renders list of active tasks. Checked tasks strike out and trigger state updates to `/api/tasks`.

---

## 7. Recruitment Module Tests

### Hospitals
#### [ ] TC-HOSP-01: Create Hospital Record
- **Steps**:
  1. Go to Hospitals page. Click "Add Hospital".
  2. Fill in: Name "QA Hospital", Email "qa_hosp@crm.com", Phone "123456", Address "100 Test St", Commission "15%".
  3. Click "Save".
- **Expected Result**: Popup "Hospital onboarded successfully". Hospital row appears in the grid.

#### [ ] TC-HOSP-02: Edit Hospital Details
- **Steps**:
  1. Click "Edit" on "QA Hospital".
  2. Change Commission percentage to "12%". Click "Save".
- **Expected Result**: Grid update immediately reflects "12%". Database record changes commission value to 12.0.

#### [ ] TC-HOSP-03: Search and Filter Grid
- **Steps**:
  1. Input "QA Hospital" in toolbar Search bar.
- **Expected Result**: Grids filters down to matching hospital row.

### Jobs
#### [ ] TC-JOB-01: Job Creation Form
- **Steps**:
  1. Go to Jobs -> Click "Create Job".
  2. Select Hospital "QA Hospital".
  3. Fill in: Title "RN Emergency Room", Priority "High", Vacancies "4".
  4. Save form.
- **Expected Result**: Job created. Pipeline lists "RN Emergency Room" under active openings.

#### [ ] TC-JOB-02: Vacancy Depletion Logic
- **Preconditions**: Job created with vacancies count "2".
- **Steps**:
  1. Transition two candidates through pipeline to stage "joined".
- **Expected Result**: Vacancies count reduces to "0". Job status changes to "closed" automatically.

### Applicants
#### [ ] TC-APP-01: Applicant Profile Fields Creation
- **Steps**:
  1. Go to Applicants -> Click "Register Applicant".
  2. Fill in Profile data, upload resume file. Save.
- **Expected Result**: Saved row contains candidate fields. Original resume path seeded under `/uploads/resumes/`.

#### [ ] TC-APP-02: Candidate Notes and Timelines Tabs
- **Steps**:
  1. View Applicant details modal.
  2. Click "Timeline" tab, then "Notes" tab.
  3. Add a new note: "Candidate passed screen check".
- **Expected Result**: Timeline logs creation and stage updates. Notes tab lists the note. Note count on profile tab increments.

### Matching
#### [ ] TC-MATCH-01: Matching Suggestions Engine Execution
- **Preconditions**: Applicant has skills "ICU, Trauma". Job requires skills "ICU, Trauma".
- **Steps**:
  1. Navigate to Job detail page.
  2. Trigger suggestions matching calculations.
- **Expected Result**: Applicant suggestions grid loads candidate profile with a high match score (e.g. 90%+ matching profile).

### Candidate Pool
#### [ ] TC-POOL-01: Pool Reassignment Action
- **Steps**:
  1. Select candidate in pipeline, click "Move back to pool".
- **Expected Result**: Active application terminates. Candidate pool status is set to `1` (available in Pool database).

### Pipeline
#### [ ] TC-PIPE-01: Valid Stage Transitions
- **Steps**:
  1. Open Application Pipeline board.
  2. Drag candidate from `applied` to `screening` to `shortlisted`.
- **Expected Result**: Status updates database `applications` stage correctly. Event history timeline logs every transition.

#### [ ] TC-PIPE-02: Invalid Stage Progression Block
- **Steps**:
  1. Try to drag/transition candidate from `applied` directly to `joined` (bypassing screening/shortlists).
- **Expected Result**: Board blocks transition or API responds with validation warning status error.

### Interviews
#### [ ] TC-INT-01: Schedule Interview Panel
- **Steps**:
  1. Select candidate in pipeline. Click "Schedule Interview".
  2. Input: Date, Time (HH:MM format), Mode "Online", zoom URL. Save.
- **Expected Result**: Row logs in `interviews` table. Pipeline stage shifts to `interview_scheduled`.

#### [ ] TC-INT-02: Record Feedback and Complete
- **Steps**:
  1. Click "Record Feedback" on active interview.
  2. Fill in: Feedback text, Result "Selected", Status "Completed".
- **Expected Result**: Record updates in DB. Candidate stage transitions based on feedback status.

### Referrals
#### [ ] TC-REF-01: Milestone Progression Reward Trigger
- **Preconditions**: Referral reward configuration exists.
- **Steps**:
  1. Mark referred applicant status as "joined".
- **Expected Result**: Milestone record updates status. Reward milestone logs under `/api/referrals` as `eligible` for payout.

---

## 8. Employee Module Tests

### [ ] TC-EMP-01: Create and Roles Assignment
- **Steps**:
  1. Navigate to Employees page. Click "Add Employee".
  2. Fill in name, email, credentials, select role "Employee".
- **Expected Result**: Employee registered in `users` table. Access permissions limited to Recruiter/Employee role scopes.

### [ ] TC-EMP-02: Deactivation workflow
- **Steps**:
  1. Click "Deactivate" on employee account.
- **Expected Result**: Status changes to "inactive". Employee cannot log in using their credentials (receives error alert).

---

## 9. Task Management Tests

### [ ] TC-TASK-01: Task Creation and Deadlines Checks
- **Steps**:
  1. Click "Assign Task". Select employee, input deadline date, priority level.
- **Expected Result**: Task renders on Employee dashboard timeline. Overdue tasks flag red highlights.

---

## 10. Performance Module Tests

### [ ] TC-PERF-01: Leaderboard Placements Analytics
- **Preconditions**: Placements records exist in database.
- **Steps**:
  1. View Performance analytics page.
- **Expected Result**: Lists employees sorted by total monthly placements and revenue achievements.

---

## 11. HR Module Tests

### Attendance
#### [ ] TC-HR-ATT-01: Daily Clock In/Out Actions
- **Steps**:
  1. Click "Clock In" button. Wait. Click "Clock Out".
- **Expected Result**: System writes records to attendance logs showing login, logout, and total duration times.

### Leaves
#### [ ] TC-HR-LEV-01: Leave Request Approval Route
- **Steps**:
  1. Employee submits leave request.
  2. Admin logs in, clicks "Approve" on dashboard notifications list.
- **Expected Result**: Leave status updates in DB. Employee allowance balance decreases.

---

## 12. Finance Module Tests

### Salary
#### [ ] TC-FIN-SAL-01: Generate Payroll Records
- **Steps**:
  1. Go to Salary management page. Click "Generate Monthly Payroll".
- **Expected Result**: Calculates base salary, additions/deductions, and populates `salary_records` database table.

### Hospital Invoices
#### [ ] TC-FIN-INV-01: Invoice Creation on Joined Candidate
- **Preconditions**: Candidate marked as "joined".
- **Steps**:
  1. Go to Invoices page. Click "Generate Invoice".
  2. Select Candidate placement record.
- **Expected Result**: Invoice details populated based on job salary and hospital commission parameters.

---

## 13. Calendar Tests

### [ ] TC-CAL-01: Multi-source Events Render
- **Steps**:
  1. View Calendar page.
- **Expected Result**: Calendar fetches and renders interviews, deadlines, and leave periods in colored blocks.

---

## 14. Settings Tests

### [ ] TC-SET-01: Theme Configuration Toggle
- **Steps**:
  1. Click theme toggle (Dark / Light).
- **Expected Result**: Changes the visual interface theme and persists preferences in localStorage or database profile config.

---

## 15. Role-Based Access Control (RBAC) Tests

### [ ] TC-RBAC-01: Admin Settings Route Protection
- **Preconditions**: Logged in as Employee role user.
- **Steps**:
  1. Send POST request to `/api/settings` or navigate to settings.html.
- **Expected Result**: Server returns `403 Forbidden` response. Dashboard locks UI interface from loading configuration inputs.

---

## 16. Database Testing

### [ ] TC-DB-01: Schema Check and Table Presence
- **Steps**:
  1. Run schema diagnostic scripts or query `SHOW TABLES`.
- **Expected Result**: Confirms existence of all 24 required operational tables.

### [ ] TC-DB-02: Uniqueness Key Constraints Enforcement
- **Steps**:
  1. Try to manually insert a user row with an existing email via SQL command.
- **Expected Result**: Query engine rejects transaction with unique key violation error.

### [ ] TC-DB-03: Cascade Delete Restrictions
- **Steps**:
  1. Attempt deleting hospital record that contains active child job openings.
- **Expected Result**: Database rejects query or enforces foreign key cascade restrictions to maintain database integrity.

---

## 17. API Testing

### [ ] TC-API-01: HTTP GET Fetch Validations
- **Steps**:
  1. Query `GET /api/jobs` without auth header, then with auth header.
- **Expected Result**: First request returns `401 Unauthorized`. Second returns `200 OK` with JSON array payload.

### [ ] TC-API-02: Validation Constraints Handling (400 Bad Request)
- **Steps**:
  1. Send POST payload with invalid parameters (e.g. empty candidate name).
- **Expected Result**: Server returns `400 Bad Request` specifying input validation errors.

---

## 18. Security Testing

### [ ] TC-SEC-01: SQL Injection Protection checks
- **Steps**:
  1. Pass SQL characters (e.g. `' OR 1=1 --`) inside search query parameters.
- **Expected Result**: Query parameters bind safely. Server does not crash or leak unauthorized data.

### [ ] TC-SEC-02: Helmet Headers Auditing
- **Steps**:
  1. Inspect network response headers of pages.
- **Expected Result**: Confirm headers `X-Content-Type-Options: nosniff` exist and `X-Powered-By` header is missing.

---

## 19. Performance Testing

### [ ] TC-PERF-01: Concurrency Connections Loads
- **Steps**:
  1. Stress test API routes with concurrent simulated requests.
- **Expected Result**: Server pool handles routing throughput without drops or connection leaks.

---

## 20. Responsive Testing

### [ ] TC-RESP-01: Screen Dimensions Breakpoints Layouts
- **Steps**:
  1. Resize window to Mobile (375px), Tablet (768px), and Laptop (1024px) sizes.
- **Expected Result**: Sidebar collapses cleanly, navigation shifts into toggle menus, and grid contents align.

---

## 21. Accessibility Testing

### [ ] TC-ACC-01: Keyboard Navigation Tab Flow
- **Steps**:
  1. Navigate page using only the `Tab` key.
- **Expected Result**: Focus indicators outline interactive buttons, forms, and navigation triggers in chronological order.

---

## 22. Regression Testing Checklist

This checklist must be executed before compiling release bundles after every feature implementation phase:
- [ ] 1. Run all Database Schema integrity tests (`npm test` runner checks)
- [ ] 2. Perform Login and Logout sequences for Admin and Recruiter roles
- [ ] 3. Verify onboarding a new Hospital and generating a Job opening
- [ ] 4. Register a test candidate and confirm timeline logging records
- [ ] 5. Confirm matching engine generates scores for the new candidate
- [ ] 6. Transition candidate through pipeline board and inspect stage history log
- [ ] 7. Perform an interview scheduling and feedback submission flow
- [ ] 8. Verify the HTML template sanity of changed pages (no duplicate IDs)
- [ ] 9. Verify Helmet security headers are present and X-Powered-By is deleted

---

## 23. Bug Report Template

```markdown
### Bug ID: [QA-BUG-XXXX]
**Priority**: [Low | Medium | High | Critical]  
**Severity**: [Trivial | Minor | Major | Blocker]  

#### Description:
[Provide a clear and concise summary of the issue]

#### Steps to Reproduce:
1. Navigate to '...'
2. Click on '....'
3. Enter input '...'
4. Click 'Save'

#### Expected Behavior:
[What should happen when these steps are followed]

#### Actual Behavior:
[What actually happens, e.g. error code, visual defect, or crash]

#### Environment Configurations:
- **Browser**: [Chrome v120 | Safari v17 | Firefox v119]
- **Endpoint**: [e.g. POST /api/applicants]
- **Role**: [Admin | Employee | Unauthenticated]

#### Developer Notes:
[Optional logs, query exceptions, or context notes]
```

---

## 24. Implementation Status Checklist

### Authentication Module
- [x] Login Form & Validation Checks
- [x] Session Expiry & Logouts
- [x] JWT Handling & Token Decryption

### Landing Page
- [x] Landing Page Structure
- [x] Responsive Breakpoints Navigation
- [x] SEO Meta Elements Verification

### Dashboards
- [x] Admin Summary KPIs & Cards
- [x] Employee Task Checks
- [x] Recent Activity Timelines

### Recruitment Module
- [x] Hospital CRUD Onboarding
- [x] Job Opening CRUD Profiles
- [x] Applicant CRUD Registrations
- [x] Dynamic timeline tracking
- [x] Skill-based Match Suggestions
- [x] Master Candidate Pool Transfers
- [x] Drag & Drop Pipeline Transitions
- [x] Interview Scheduling workflows
- [x] Referral Reward Milestones

### Employee & HR Modules
- [x] Employee CRUD Profile updates
- [x] Roles Assignment logic
- [ ] Employee Clock-in Attendance logs
- [x] Leaves Request Forms & Tracker
- [x] Tasks Assignment board

### Finance Module
- [x] Hospital Invoice Automation
- [x] Salary payroll generation
- [x] Placement Revenue projections
- [x] CSV/PDF export report features

### Security & Database
- [x] Password Bcrypt hashing storage
- [x] SQL injection parameter validation
- [x] Helmet security headers configuration

---

## 25. Future Features & Roadmap

### Implemented
- **Core Recruitment Pipeline**: Hospital profile setups, Job openings creation, applicant profiles, resume timeline integrations.
- **Access Controls**: Multi-role support (Admin and Employee) validated across APIs and UI templates.

### Partially Implemented
- **Financial Projections**: Targets configurations are stored, but visual trends and forecasting calculations are calculated locally.
- **Holiday Calendar Sync**: Local reminders can be set, but integrations with external calendar providers (Google/Outlook) are placeholder scopes.

### Not Implemented (Gaps Identified)
- **Attendance Logging System**: The attendance clock-in database storage is not wired up to log clock-ins dynamically.
- **Referrals milestones automated payout**: Rewards status transitions to `eligible` but direct bank processing integrations do not exist.

### Future Enhancements
- **Resume Masking Automation**: Automatically redact personal identifiers (phone, email) from resumes using parsing models during upload.
- **Push Notification Engine**: In-app notifications using WebSockets for immediate alerts on interview updates and invoice alerts.
- **Advanced BI Dashboard**: Interactive charts tracking recruiter placements and conversion rates across candidate sources.
