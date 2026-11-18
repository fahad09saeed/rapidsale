# RapidSale — Classifieds Marketplace

A full classifieds platform (OLX-style) for Pakistan: **Go API + MySQL**, **Next.js web app** with admin panel,
and an **Expo (React Native) mobile app**, deployable to a single **AWS EC2** host with Docker Compose.

```
backend/   Go (Gin, GORM, MySQL) — REST API, WebSocket chat, RBAC, OTP, seeder
web/       Next.js 15 (App Router, Tailwind v4) — public site + /admin panel
mobile/    Expo SDK 58 (expo-router) — Android & iOS app
deploy/    nginx templates, EC2 bootstrap, deploy & backup scripts
docker-compose.yml       production stack (mysql, api, web, nginx, certbot)
docker-compose.dev.yml   local MySQL only
```

## Features

| Area | What's included |
|---|---|
| Auth | Register with phone and/or email → 6-digit **OTP** verification; password login; **password-less OTP login**; forgot/reset password via OTP; add/change phone or email with OTP; JWT access tokens (15 min) + rotating refresh tokens with reuse detection |
| OTP | HMAC-hashed codes, 5-min expiry, 5 attempts, 60 s resend cooldown, hourly cap. Delivery: console (dev), **Twilio SMS**, **SMTP email** (e.g. Amazon SES) |
| RBAC | Roles ↔ permissions tables. Seeded roles: `superadmin` (everything), `admin`, `moderator`, `user` (public). Superadmin can create custom roles and assign permissions from the admin panel |
| Catalog | 14 top-level categories, ~120 sub-categories (Mobiles, Vehicles, Property for Sale/Rent, Electronics, Bikes, Business, Services, Jobs, Animals, Furniture, Fashion, Books/Sports, Kids) with **dynamic attributes** (make, model, year, km, PTA status, area/marla, bedrooms, salary…) inherited by sub-categories. All provinces/territories, 130+ cities and popular areas of Pakistan |
| Listings | Post/edit with up to 12 photos, dynamic attributes, location, price/negotiable, condition, contact phone visibility; statuses (pending/active/rejected/sold/inactive/expired); auto-expiry + republish; views, favourites, related ads |
| Search | Full-text search (MySQL FULLTEXT), category & location trees (includes descendants), price range, condition, attribute filters (`attr.brand=Apple`, `attr_min.year=2018`), sorting, pagination |
| Messaging | Buyer↔seller conversations per listing, realtime over **WebSocket** (messages, read receipts ✓✓, typing indicator, online status), photo messages, unread counters |
| Moderation | Admin dashboard stats, user ban/unban & role assignment, listing approve/reject/feature/delete, abuse reports workflow, category/attribute/location CRUD, role & permission editor |
| Security | bcrypt passwords, per-IP rate limiting on auth/OTP/posting, upload type sniffing & size limits, CORS allow-list, account-enumeration-safe reset flow, banned users lose sessions & their ads are hidden |

## Local development

Prerequisites: Go 1.27+, Node 22+, and MySQL 8 (or Docker for `docker-compose.dev.yml`).

```bash
# 1. Database
docker compose -f docker-compose.dev.yml up -d       # or use your own MySQL 8

# 2. API (http://localhost:8080)
cd backend
cp .env.example .env                                  # defaults work with the dev DB
go run ./cmd/seed -demo                               # migrate + seed (+ demo users/ads)
go run ./cmd/api

# 3. Web (http://localhost:3000)
cd web
cp .env.example .env.local
npm install && npm run dev

# 4. Mobile
cd mobile
cp .env.example .env    # EXPO_PUBLIC_API_URL: 10.0.2.2 for Android emulator, your LAN IP for a phone
npm install && npx expo start
```

**Logins after seeding:** superadmin `admin@rapidsale.local` / `ChangeMe123!` (from `SUPERADMIN_*` env).
With `-demo`: `demo1@rapidsale.local` … `demo3@rapidsale.local` / `Password123!`.

In development `SMS_PROVIDER=console` and `OTP_DEBUG=true`: OTP codes are printed in the API log **and**
returned as `dev_code` (the web/mobile UIs display it). Both must be off in production.

Tests: `cd backend && go test ./...` · Web typecheck/build: `npm run build` · Mobile: `npx tsc --noEmit`.

## Deploying to AWS EC2

1. **Launch an instance** — Ubuntu 24.04 or Amazon Linux 2023, `t3.small` or larger, 20 GB+ gp3.
   Security group: allow 22 (your IP), 80, 443. Attach an Elastic IP.
2. **DNS** — point `example.com` and `www.example.com` A records to the Elastic IP.
3. **(Optional) S3 for images** — create a bucket with public-read on objects (or CloudFront), attach an
   IAM role to the instance allowing `s3:PutObject` on it, then set `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_PUBLIC_URL`.
4. On the server:
   ```bash
   git clone <your-repo> rapidsale && cd rapidsale
   cp .env.example .env && nano .env        # DOMAIN, passwords, secrets (openssl rand -hex 32), Twilio/SMTP
   sudo bash deploy/ec2-setup.sh            # installs Docker, builds, seeds, issues Let's Encrypt cert
   ```
5. **Updates:** `bash deploy/deploy.sh` · **Backups:** cron `deploy/backup.sh` (set `BACKUP_S3_BUCKET` to copy to S3).

For higher scale: move MySQL to **Amazon RDS** (set `DB_HOST` and drop the `mysql` service), images to S3 +
CloudFront, and run multiple API instances behind an ALB — at that point replace the in-memory WebSocket hub
and rate limiter with Redis (see `backend/internal/ws/hub.go`).

## Mobile app builds

```bash
cd mobile
npx eas-cli@latest build -p android     # APK/AAB via Expo cloud builds
npx eas-cli@latest build -p ios
```
Set `EXPO_PUBLIC_API_URL=https://example.com/api` for production builds. Update `ios.bundleIdentifier` /
`android.package` in `app.json` to your own identifiers before publishing.

## API overview

All routes are under `/api`. Auth: `Authorization: Bearer <access_token>`.

| Method & path | Notes |
|---|---|
| `POST /auth/register` · `/auth/verify` · `/auth/resend-otp` | sign-up with OTP |
| `POST /auth/login` · `/auth/otp-login/request` · `/auth/otp-login/verify` | password or OTP login |
| `POST /auth/forgot-password` · `/auth/reset-password` · `/auth/refresh` · `/auth/logout` · `GET /auth/me` | |
| `GET /categories` · `/categories/:slug` · `/locations` | catalog trees (+ effective attributes) |
| `GET /listings` · `/listings/:id` · `POST/PUT/DELETE /listings[/:id]` · `PATCH /listings/:id/status` | search & CRUD |
| `POST/DELETE /listings/:id/favorite` · `GET /me/favorites` · `GET /me/listings` | |
| `PUT /me` · `PUT /me/password` · `POST /me/contact/request|verify` · `GET /users/:id` | profile |
| `POST /uploads` (multipart `file`) | returns `{url}` |
| `GET/POST /conversations` · `GET /conversations/:id[/messages]` · `POST /conversations/:id/messages|read` · `GET /conversations/unread-count` | chat |
| `GET /ws?token=…` | realtime events: `message`, `read`, `typing` |
| `POST /reports` | abuse reports |
| `/admin/*` | stats, users, listings, reports, categories, attributes, locations, roles, permissions — each guarded by a permission |
