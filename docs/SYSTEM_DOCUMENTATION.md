# System Architecture Documentation

**System Title**: HealthCRM - Enterprise Healthcare Recruitment ERP + CRM  
**Version**: 1.0.0 (Production Release)  
**Architecture Style**: Monolithic Micro-Modular Node.js / Express Architecture with Vanilla JS Design System  

---

## 1. System Overview

HealthCRM is a full-featured Healthcare Recruitment ERP + CRM designed for healthcare staffing agencies. It covers candidate sourcing, matching engine, pipeline tracking, hospital submission packages, post-submission interview management, placements, invoicing, employee productivity, recruiter command center, and executive business operations.

---

## 2. Technical Stack

- **Backend Architecture**: Node.js v18+, Express.js REST APIs
- **Database Engine**: MySQL 8.0 with InnoDB tables, foreign key constraints, composite indexes
- **Frontend Layer**: Modern HTML5, Vanilla JavaScript, Modular CSS Tokens (Light/Dark themes)
- **Security Suite**: Helmet headers, CORS validation, bcrypt password hashing, JWT stateless authentication, rate limiting, parameterized queries
- **Process Management**: PM2 process manager with cluster mode and automated auto-restart

---

## 3. Directory Structure

```
recruitment-crm/
├── backend/
│   ├── config/          # DB connection pool & configuration
│   ├── controllers/     # API request handlers
│   ├── middleware/      # Auth, RBAC, error handling, rate limiting
│   ├── models/          # Data access objects & SQL queries
│   ├── routes/          # Express route definitions
│   ├── services/        # Business logic & intelligence engines
│   ├── utils/           # Utility functions & response formatters
│   └── app.js           # Main Express server initialization
├── frontend/
│   ├── assets/          # CSS themes, JS design system engines
│   └── pages/           # Admin, Employee & Recruiter HTML views
├── database/
│   └── schema.sql       # Enterprise SQL schema definition
├── docs/                # System, API, Database & Deployment manuals
└── tests/               # Master QA test runner (19 integrated suites)
```
