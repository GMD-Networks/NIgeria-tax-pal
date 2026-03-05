# Nigeria Tax Pal

Nigeria Tax Pal is a web/mobile-ready tax productivity platform for individuals, freelancers, and SMEs in Nigeria.

## What the app does

- Nigerian tax calculators (PAYE, VAT, WHT and related tools)
- Invoice generation and invoice history
- Saved client/business details for faster invoicing
- AI-powered tax chat and receipt/document OCR
- Tax education content with multilingual support
- Admin panel for users, rates, tax content, API settings, and chat support
- Subscription, usage limits, and Flutterwave payment flow

## Core functionality

### User features
- Sign up / sign in / sign out
- Use tax tools with free-tier usage limits
- Upgrade to premium subscription for higher/unlimited access
- Create and manage invoices
- Scan and extract receipt/document data
- Ask tax questions with AI chat

### Admin features
- Manage users and roles
- Manage tax rates and educational content
- View and manage consultant chat sessions
- Configure API/email settings
- Trigger AI content generation

## Tech stack

- Frontend: React + TypeScript + Vite + Tailwind + shadcn/ui
- Backend: PHP API (cPanel deployment)
- Database: MySQL
- Payments: Flutterwave
- Mobile shell support: Capacitor

## Project structure

- `src/` React application
- `php-api/` PHP backend router, auth, routes, and schema
- `public/` static public assets

## Local development

1. Install dependencies:

```bash
npm ci
```

2. Create `.env` (or use `.env.example`):

```env
VITE_CPANEL_API_URL=https://taxpal.gmd-networks.com.ng/api
```

3. Run dev server:

```bash
npm run dev
```

4. Build production:

```bash
npm run build
```

## Deployment

See `CPANEL-GUIDE.md` for full cPanel deployment steps.

## Notes

- Keep secrets out of source control.
- Configure `php-api/config.php` before production.
- Run DB schema from `php-api/schema.sql` in your cPanel MySQL database.
