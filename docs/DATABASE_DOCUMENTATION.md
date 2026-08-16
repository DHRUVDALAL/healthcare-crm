# Database Schema Documentation

**System Title**: HealthCRM - Enterprise Healthcare Recruitment ERP + CRM  
**Engine**: MySQL 8.0 / InnoDB Engine  

---

## 1. Primary Relational Schema Tables

1. `users`: Agency administrators, recruiters, and employees.
2. `hospitals`: Client hospital profiles, departments, and contacts.
3. `jobs`: Hospital job requisitions, required skills, experience, and salary budget.
4. `applicants`: Candidate master database with pool status and recruiter assignment.
5. `applications`: Candidate job pipeline applications.
6. `interviews`: Multi-round scheduled candidate interviews.
7. `candidate_offers`: Salary CTC offers and pre-joining checklists.
8. `placements`: Placement records and billing milestone tracking.
9. `invoices`: Placement billing invoices and payment tracking.
10. `invoice_payments`: Partial and full payment receipts.
11. `recruiter_notes`: Private and shared notes.
12. `company_settings`: System configurations and templates.
13. `system_audit_logs`: Immutable audit trails.
