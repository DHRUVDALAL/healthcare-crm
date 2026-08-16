# REST API Specification Documentation

**System Title**: HealthCRM - Enterprise Healthcare Recruitment ERP + CRM  
**API Base URL**: `http://localhost:5000/api`  
**Authentication Standard**: HTTP Bearer JWT Token (`Authorization: Bearer <token>`)  

---

## 1. Core Endpoints Overview

| Module | Endpoint Route | HTTP Method | Description |
|---|---|---|---|
| Auth | `/api/auth/login` | POST | Authenticate user and issue JWT |
| Applicants | `/api/applicants` | GET / POST | Manage candidate profiles |
| Hospitals | `/api/hospitals` | GET / POST | Manage hospital accounts |
| Jobs | `/api/jobs` | GET / POST | Manage hospital job openings |
| Pipeline | `/api/pipeline` | GET / POST | Move candidates through 10-stage pipeline |
| Interviews | `/api/interviews` | GET / POST | Schedule multi-round interviews |
| Offers | `/api/post-submission/offers` | GET / POST | Issue & track candidate offer letters |
| Invoices | `/api/invoices` | GET / POST | Issue & manage hospital placement invoices |
| Command Center | `/api/recruiter-command-center/work-center` | GET | Consolidate 10-section Today's Work Center |
| Admin Operations | `/api/admin-operations-center/dashboard-kpis` | GET | 25-KPI Live Executive Dashboard |
| Global Search | `/api/production-hardening/global-search` | GET | Search across 10 core entities |
| Bulk Import | `/api/production-hardening/import/bulk-excel` | POST | Validate & import Excel/CSV data |

---

## 2. Standardized JSON Response Structure

```json
{
  "success": true,
  "message": "Operation executed successfully",
  "data": { ... }
}
```
