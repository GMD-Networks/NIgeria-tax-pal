# TaxPal cPanel Deployment Guide (PHP + MySQL Only)

This guide deploys TaxPal fully on cPanel using:
- React frontend as static files
- PHP API under `/api` for auth, data, admin, subscriptions, usage, payments, SMTP, and AI
- MySQL as the single database

## 1) Target Folder Layout

Pick a single document root for the app (example: subdomain `taxpal.example.com` pointing to `/public_html/taxpal/`):

```
/public_html/taxpal/
├── index.html
├── assets/
├── robots.txt
├── .htaccess
└── api/
   ├── index.php
   ├── config.php
   ├── database.php
   ├── schema.sql
   ├── certs/
   │   └── cacert.pem
   └── routes/
```

## 2) Prerequisites (cPanel)

- PHP 8.1+ (recommended: 8.2+)
- PHP extensions enabled: `pdo_mysql`, `curl`, `openssl`, `json`
- MySQL 8+ (or MariaDB equivalent)
- Apache with `mod_rewrite` enabled (most cPanel setups have this)
- A Flutterwave account (only if you want subscription payments)
- An AI provider key (OpenAI-compatible; only if you want AI features)

## 3) Create the Subdomain + Folder

1. In cPanel → **Domains/Subdomains**, create your subdomain (example: `taxpal.example.com`).
2. Point it to a folder like `/public_html/taxpal`.
3. Ensure the folder exists (File Manager can create it).

## 4) Database Setup (MySQL + Schema)

1. In cPanel → **MySQL Databases**:
  - Create a database (e.g. `cpaneluser_taxpal`).
  - Create a database user and assign it to the DB with **ALL PRIVILEGES**.
2. In cPanel → **phpMyAdmin**:
  - Select your TaxPal DB.
  - Import the schema file: `api/schema.sql` (from this repo: `php-api/schema.sql`).

After import, you should see tables like: `users`, `profiles`, `user_roles`, `subscriptions`, `feature_usage`.

## 5) Upload the PHP API

1. Upload the contents of `php-api/` to `/public_html/taxpal/api/`.
2. Confirm this URL works in a browser:

`https://taxpal.example.com/api/health`

Expected response:

```json
{"status":"ok","backend":"cpanel-php"}
```

## 6) Configure the API (required)

Edit `/public_html/taxpal/api/config.php` and set real production values.

Minimum required:
- `DB_*` credentials
- `JWT_SECRET`
- `APP_URL` and `API_URL`

Optional (feature-dependent):
- `FLW_*` for Flutterwave subscriptions
- `SMTP_*` for SMTP email sending
- `AI_*` for AI endpoints
- `ADOBE_PDF_SERVICES_*` for document conversion without `soffice`

Example configuration values (edit the defaults, or set environment variables if your hosting supports them):

```php
// Database
define('DB_HOST', 'localhost');
define('DB_NAME', 'cpaneluser_taxpal');
define('DB_USER', 'cpaneluser_taxpal_user');
define('DB_PASS', 'YOUR_STRONG_PASSWORD');

// JWT
define('JWT_SECRET', 'CHANGE_ME_TO_A_RANDOM_64+_CHAR_SECRET');

// URLs
define('APP_URL', 'https://taxpal.example.com');
define('API_URL', 'https://taxpal.example.com/api');

// Flutterwave (optional)
define('FLW_SECRET_KEY', 'FLWSECK-...');
define('FLW_PUBLIC_KEY', 'FLWPUBK-...');
define('FLW_WEBHOOK_HASH', '...');

// AI provider (optional, OpenAI-compatible)
// OpenAI:
// define('AI_API_URL', 'https://api.openai.com/v1/chat/completions');
// define('AI_MODEL', 'gpt-4o-mini');
// DeepSeek:
// define('AI_API_URL', 'https://api.deepseek.com/v1/chat/completions');
// define('AI_MODEL', 'deepseek-chat');
define('AI_API_URL', 'https://api.openai.com/v1/chat/completions');
define('AI_API_KEY', 'YOUR_AI_KEY');
define('AI_MODEL', 'gpt-4o-mini');
define('OPENROUTER_API_KEY', 'YOUR_OPENROUTER_KEY');
define('DEEPSEEK_API_KEY', 'YOUR_DEEPSEEK_KEY');
define('GEMINI_API_KEY', 'YOUR_GEMINI_KEY');
define('OCR_AI_PROVIDER', 'gemini');
define('OCR_AI_API_URL', 'https://openrouter.ai/api/v1/chat/completions');
define('OCR_AI_API_KEY', 'YOUR_OPENROUTER_KEY');
define('OCR_AI_MODEL', 'google/gemini-2.5-pro');

// Document conversion (LibreOffice)
define('CONVERT_BIN', '/usr/bin/soffice');
define('CONVERT_TMP_DIR', '/tmp/taxpal-convert');
define('CONVERT_TIMEOUT', 120);

// Adobe PDF Services (recommended on cPanel/shared hosting)
define('ADOBE_PDF_SERVICES_CLIENT_ID', 'YOUR_ADOBE_CLIENT_ID');
define('ADOBE_PDF_SERVICES_CLIENT_SECRET', 'YOUR_ADOBE_CLIENT_SECRET');
define('ADOBE_PDF_SERVICES_BASE_URL', 'https://pdf-services.adobe.io');
define('ADOBE_PDF_SERVICES_TIMEOUT', 60);
define('ADOBE_PDF_SERVICES_POLL_TIMEOUT', 120);
define('ADOBE_PDF_SERVICES_POLL_INTERVAL_MS', 1500);

// SMTP (optional)
define('SMTP_HOST', 'mail.example.com');
define('SMTP_PORT', 465);
define('SMTP_USERNAME', 'info@example.com');
define('SMTP_PASSWORD', 'YOUR_SMTP_PASSWORD');
define('SMTP_ENCRYPTION', 'ssl');
define('SMTP_FROM_EMAIL', 'info@example.com');
define('SMTP_FROM_NAME', 'TaxPal');
```

Security note: after importing the DB, consider deleting `/public_html/taxpal/api/schema.sql` from production.

Document conversion note:
- If `ADOBE_PDF_SERVICES_CLIENT_ID` and `ADOBE_PDF_SERVICES_CLIENT_SECRET` are set, the API uses Adobe PDF Services first.
- If Adobe credentials are not set, conversion falls back to local `soffice` settings (`CONVERT_*`).

## 7) Frontend Build + Upload (React)

On your local machine (not cPanel), build the frontend.

1. Create `.env.production`:

```env
VITE_CPANEL_API_URL=https://taxpal.example.com/api
```

2. Build:

```bash
npm ci
npm run build
```

3. Upload `dist/*` into `/public_html/taxpal/` (same folder that contains `.htaccess`).

## 7.1) GitHub vs cPanel (What goes where)

Keep in **GitHub**:
- Frontend source (`src/`, configs, `package.json`)
- PHP API source (`php-api/`)
- Deployment file (`.cpanel.yml`)
- Built frontend (`dist/`) if your cPanel Git deployment copies `dist` directly

Keep in **cPanel only** (do not commit secrets):
- Live DB credentials and secrets (`DB_*`, `JWT_SECRET`, `FLW_*`, `AI_*`, `SMTP_*`)
- Any production-only API env override file (for example `/public_html/.../api/.env.local`)
- Runtime/generated files and logs

cPanel Git deployment mapping used by this repo:
- `dist/` ➜ your document root (e.g. `/public_html` or `/public_html/taxpal`)
- `php-api/` ➜ `<document-root>/api`

If your app URL is `https://taxpal.reddonisha.com`, then `/api/health` must resolve to:
- `https://taxpal.reddonisha.com/api/health`

## 7.2) SSH Deploy (only `dist` and `php-api`)

If your cPanel host provides SSH access, deploy only build artifacts and API source:

1. Build locally:

```bash
npm run build
```

2. Upload only these folders to your subdomain document root:
- `dist/*` ➜ `/home/<cpanel-user>/taxpal/`
- `php-api/*` ➜ `/home/<cpanel-user>/taxpal/api/`

This repo includes `scripts/deploy-ssh.ps1` to automate this flow from Windows PowerShell.

## 8) Apache Rewrites (.htaccess)

Create `/public_html/taxpal/.htaccess`:

```apache
RewriteEngine On

# Force HTTPS
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Route /api/* to the PHP router
RewriteRule ^api/(.*)$ api/index.php [QSA,L]

# SPA fallback (don’t rewrite real files/dirs, don’t rewrite /api)
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteCond %{REQUEST_URI} !^/api/
RewriteRule ^ index.html [QSA,L]

<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
  Header set X-Frame-Options "SAMEORIGIN"
  Header set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>
```

If your host doesn’t allow root rewrites, you can alternatively point your subdomain directly to `dist/` output and place the API in a separate subdomain (but that requires configuring CORS).

## 9) Create an Admin User

Recommended (no manual password hashing):

1. Register a normal account in the app (or via the API):
  - `POST https://taxpal.example.com/api/auth/register`
2. In phpMyAdmin, find the user’s `id` in the `users` table.
3. Promote them by inserting an admin role:

```sql
INSERT INTO user_roles (id, user_id, role)
VALUES (UUID(), 'USER_ID_HERE', 'admin');
```

If you already have a role row for the user, update it:

```sql
UPDATE user_roles SET role='admin' WHERE user_id='USER_ID_HERE';
```

## 10) Flutterwave (Subscriptions)

1. In Flutterwave Dashboard, set the webhook URL:

`https://taxpal.example.com/api/payments/webhook`

2. Set `FLW_WEBHOOK_HASH` in `api/config.php` to match Flutterwave’s webhook hash.

## 11) SMTP (Email)

TaxPal sends email using SMTP if you configure `SMTP_*` values.

If SMTP fails due to TLS/SSL verification issues on your host, you can upload a CA bundle at:

`/public_html/taxpal/api/certs/cacert.pem`

Then, in cPanel → MultiPHP INI Editor (if available), set:

```
curl.cainfo=/home/CPANELUSER/public_html/taxpal/api/certs/cacert.pem
openssl.cafile=/home/CPANELUSER/public_html/taxpal/api/certs/cacert.pem
```

## 12) AI Provider (OpenAI-compatible)

Set in `api/config.php`:
- `AI_API_URL`
- `AI_API_KEY`
- `AI_MODEL`

DeepSeek works via the2compatible endpoint:

```php
define('AI_API_URL', 'https://api.deepseek.com/v1/chat/completions');
define('AI_MODEL', 'deepseek-chat');
```

## 13) Post-deploy Verification Checklist

1. `GET /api/health` returns ok.
2. App loads at `/` and static assets load.
3. SPA routes refresh correctly (e.g. `/calculator`, `/invoice`, `/admin`).
4. Register/login/logout works.
5. Admin dashboard loads after promotion to admin.
6. Invoices save and load.
7. Subscriptions:
  - `/payments/initiate` returns a Flutterwave link.
  - webhook updates status after payment.
8. SMTP test (if configured): admin email sending works.
9. AI test (if configured): tax chat and admin content endpoints return responses.
10. Conversion test:
  - Upload PDF and convert to DOCX/XLSX/PPTX.
  - Upload DOCX/XLSX/PPTX and convert to PDF.

## 14) Troubleshooting

- **401/403 on admin endpoints**: confirm the user has an `admin` row in `user_roles`.
- **404 on refresh (SPA routes)**: `.htaccess` SPA fallback isn’t being applied.
- **404 on `/api/health`**:
  - Ensure `.cpanel.yml` copies `php-api` to `<document-root>/api` (not `<document-root>/php-api`).
  - Ensure `DEPLOYPATH` points to the actual subdomain document root.
  - Redeploy from cPanel Git Version Control, then re-test `/api/health`.
- **500 errors**: check cPanel → Errors, and confirm PHP extensions `pdo_mysql`, `curl`, `openssl`.
- **Payments/AI/SMTP TLS errors**: configure CA bundle (`curl.cainfo` / `openssl.cafile`) as in section 11.
- **Database connection errors**: verify `DB_NAME`, `DB_USER`, `DB_PASS`, and that the user is assigned to the DB with privileges.
- **Adobe conversion fails on cPanel**:
  - Verify `ADOBE_PDF_SERVICES_CLIENT_ID` and `ADOBE_PDF_SERVICES_CLIENT_SECRET`.
  - Ask hosting support to allow outbound HTTPS for:
    - `pdf-services.adobe.io`
    - `dcplatformstorageservice-prod-us-east-1.s3-accelerate.amazonaws.com`
    - `ims-na1.adobelogin.com`
