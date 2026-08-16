# Deployment & Operations Guide

**System Title**: HealthCRM - Enterprise Healthcare Recruitment ERP + CRM  

---

## 1. Prerequisites
- Linux Server (Ubuntu 22.04 LTS recommended)
- Node.js v18 LTS
- MySQL Server 8.0
- Nginx Web Server & PM2 Process Manager

---

## 2. Environment Setup

```bash
cd /var/www/recruitment-crm/backend
npm install --production
cp .env.example .env
```

---

## 3. Database Initialization

```bash
mysql -u root -p health_crm < database/schema.sql
node scratch/apply_admin_operations_center_migrations.js
node scratch/apply_production_hardening_migrations.js
```

---

## 4. PM2 Process Manager Setup

```bash
pm2 start backend/app.js --name "healthcrm-api" -i max
pm2 save
pm2 startup
```

---

## 5. Nginx Reverse Proxy Configuration

```nginx
server {
    listen 80;
    server_name crm.healthagency.com;

    location / {
        root /var/www/recruitment-crm/frontend;
        index pages/login.html index.html;
        try_files $uri $uri/ =404;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
