# System Known Limitations & Recommendations

**System Title**: HealthCRM - Enterprise Healthcare Recruitment ERP + CRM  

---

## Known Limitations & Recommendations

1. **SMS Gateway Integration**: The current notification engine supports in-app and email templates. Third-party SMS API credentials (e.g., Twilio/Gupshup) can be configured under Company Settings for SMS dispatch.
2. **Tally Accounting Sync**: The Finance ERP module generates structured JSON ledgers ready for Tally XML export. An external Tally Sync service can ingest this endpoint.
3. **Database Backups**: The backup engine creates complete `.sql` database dumps. Production environments should schedule cron jobs to sync backup files to offsite AWS S3 bucket storage.
