# NFCPATCH — Dynamic QR & NFC Management System Implementation Plan

## 1. Project Context, Architecture & Assets
- **Brand Name:** NFCPATCH
- **Production Domain:** `https://nfcpatch.link`
- **Card Template Asset:** Located in `./documents/` (or root `./`). Locate the existing PNG card template file and copy it to `public/template-card.png`.
- **Core Business Logic:**
  - Physical cards are pre-printed with a permanent QR code and programmed with an NTAG213 NFC chip pointing to `https://nfcpatch.link/r/{product_code}` (e.g., `https://nfcpatch.link/r/0001`).
  - While in inventory, products have status `unassigned`.
  - During on-site sales, the admin logs into `/dashboard` on a mobile phone, selects an `unassigned` product code, assigns it to a business (`business_name` + `google_review_url`), and flips status to `active` in under 30 seconds.
  - When customers scan the QR or tap the NFC tag, `/r/[code]` logs the scan event and immediately redirects (HTTP 302/307) to the assigned `google_review_url`.
- **Tech Stack:**
  - **Framework:** Next.js (App Router), TypeScript, Tailwind CSS
  - **Database & Auth:** Supabase (`@supabase/supabase-js`, `@supabase/ssr`)
  - **QR & PDF Engine:** `qrcode`, `@types/qrcode`, `pdf-lib`
  - **UI Icons:** `lucide-react`
  - **Deployment Target:** Cloudflare Pages (`@cloudflare/next-on-pages`)

## Step 1: Project Initialization & Environment Setup
- [x] Check Node.js version and initialize a Next.js App Router project (TypeScript, Tailwind CSS, ESLint) inside the root `nfcpatch` workspace. **Important:** Do NOT overwrite or delete the existing `./documents/` folder.
- [x] Install required packages:
  `npm install @supabase/supabase-js @supabase/ssr qrcode pdf-lib lucide-react`
  `npm install -D @types/qrcode @cloudflare/next-on-pages`
- [x] Inspect `./documents/` (and root `./`), find the PNG card template image, and copy it to `public/template-card.png`.
- [x] Create `.env.local` in the root directory with exact values:
  NEXT_PUBLIC_SUPABASE_URL=https://stfrajsripuepqdlsrfl.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_bUAgHp5x5lnpanOJp3syrQ_8avXYGjz
  NEXT_PUBLIC_SITE_URL=https://nfcpatch.link
- [x] Create `.gitignore` ensuring `.env.local` and `node_modules` are ignored.
- [x] Run `npm run build` to verify the base Next.js setup compiles with zero errors before proceeding to Step 2.

## Step 2: Database Schema (`supabase_schema.sql`) & Supabase Clients
- [x] Generate `supabase_schema.sql` in the root directory with complete DDL, indexes, and Row Level Security (RLS) policies:
  1. **`businesses` table:**
     - `id` `uuid` primary key default `gen_random_uuid()`
     - `business_name` `text` not null
     - `google_review_url` `text` not null
     - `city` `text` default `'İzmir'`
     - `notes` `text`
     - `created_at` `timestamptz` default `now()`
  2. **`products` table:**
     - `id` `uuid` primary key default `gen_random_uuid()`
     - `product_code` `text` unique not null (4-digit padded string, e.g., `'0001'`, `'0002'`)
     - `display_code` `text` unique not null (e.g., `'QR-0001'`, `'QR-0002'`)
     - `nfc_type` `text` not null default `'standard'` check (`nfc_type in ('standard', 'anti_metal')`)
     - `status` `text` not null default `'unassigned'` check (`status in ('unassigned', 'active', 'disabled')`)
     - `business_id` `uuid` nullable references `public.businesses(id)` on delete set null
     - `activated_at` `timestamptz` nullable
     - `created_at` `timestamptz` default `now()`
  3. **`scan_events` table:**
     - `id` `uuid` primary key default `gen_random_uuid()`
     - `product_id` `uuid` not null references `public.products(id)` on delete cascade
     - `source` `text` not null default `'unknown'` check (`source in ('qr', 'nfc', 'unknown')`)
     - `user_agent` `text`
     - `created_at` `timestamptz` default `now()`
  4. **Indexes:**
     - `idx_products_product_code` on `products(product_code)`
     - `idx_products_status` on `products(status)`
     - `idx_scan_events_product_id` on `scan_events(product_id)`
  5. **Row Level Security (RLS):**
     - Enable RLS on `businesses`, `products`, and `scan_events`.
     - Allow `anon` role `SELECT` on `products` and `businesses` (required for public `/r/[code]` lookups).
     - Allow `anon` role `INSERT` on `scan_events` (required to log public scans).
     - Allow `authenticated` role full `ALL` (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) on `businesses`, `products`, and `scan_events`.
- [x] Create Supabase SSR helper utilities:
  - `utils/supabase/client.ts` (browser client using `createBrowserClient`)
  - `utils/supabase/server.ts` (server component / route handler client using `createServerClient` and Next.js `cookies()`)
  - `utils/supabase/middleware.ts` (session refresh helper)
- [x] **MANDATORY PAUSE FOR USER:** Stop after completing Step 2 and ask the user to copy `supabase_schema.sql` into the Supabase SQL Editor and run it before proceeding to Step 3.
## Step 3: Public Redirect Engine (`/r/[code]`) & Inactive Fallback (`/inactive`)
- [x] Create `app/r/[code]/route.ts` (Edge-compatible GET route handler):
  1. Extract `code` param (e.g., `'0001'`) and query param `s` (`'nfc'`, `'qr'`, or `'unknown'`).
  2. Query Supabase `products` joined with `businesses` where `product_code = code`.
  3. If product exists, `status === 'active'`, and `businesses?.google_review_url` is a valid URL:
     - Insert a row into `scan_events` (`product_id`, `source`, `user_agent`).
     - Return HTTP `302` / `307` redirect response (`NextResponse.redirect(businesses.google_review_url)`).
  4. If product is not found, `status === 'unassigned'`, or `status === 'disabled'`:
     - Redirect to `/inactive`.
- [x] Create `app/inactive/page.tsx`:
  - Sleek dark-mode NFCPATCH branded screen (`#09090b` background, NFCPATCH header) displaying: `"NFCPATCH — Bu ürün henüz aktive edilmedi."` and a brief note explaining the card will redirect once activated by the business owner.
- [x] Create `app/page.tsx`:
  - Minimalist dark-mode NFCPATCH landing page with a clean "Admin Girişi" button linking to `/login`.

## Step 4: Auth Protection & Admin Login (`/login`)
- [x] Create `middleware.ts` in the root directory:
  - Refresh Supabase session and protect `/dashboard` and all `/dashboard/*` sub-routes.
  - Redirect unauthenticated visitors to `/login`.
  - Redirect already authenticated users visiting `/login` to `/dashboard`.
- [x] Build `app/login/page.tsx`:
  - Sleek dark-mode login card (`NFCPATCH Admin Panel`) with Email and Password inputs using `supabase.auth.signInWithPassword`.
  - Display clear Turkish error messages on invalid credentials.
  - **Strict Rule:** Do NOT include any Sign-Up / Register link or public registration form.

## Step 5: Admin Dashboard, Batch Generator & Field Activation (`/dashboard`)
- [x] Build mobile-first dark-mode SaaS layout (`#09090b` background, `#18181b` cards, `#27272a` borders, emerald/amber/rose status badges) with top navigation bar, Logout button, and quick action buttons.
- [x] **Overview KPI Cards (4-column responsive grid):**
  - Total Stock (`products` count)
  - Active Cards (`status = 'active'` count)
  - Unassigned Stock (`status = 'unassigned'` count)
  - Total Scans (`scan_events` count)
- [x] **Batch Product & QR Generator Modal ("Yeni Parti Üret"):**
  - Inputs: Start Number (auto-suggest next available number, e.g., `1`), Count / End Number (e.g., `100` -> generates `0001` to `0100`), NFC Type selector (`standard` vs `anti_metal`).
  - Inserts records into `products` with `product_code` (`0001`), `display_code` (`QR-0001`), `status = 'unassigned'`.
  - Each product permanently maps to `https://nfcpatch.link/r/{product_code}`.
- [x] **Product Inventory & Quick Field Activation Table/Cards:**
  - Filter tabs: `Tümü (All)`, `Boşta (Unassigned)`, `Aktif (Active)`, `Pasif (Disabled)` + real-time search by code (`QR-0001`) or business name.
  - Mobile-friendly card view on small screens and structured table on desktop.
  - **"Aktive Et" (Quick Field Activation) Modal/Drawer:**
    - Triggered from any `unassigned` product row or top "Hızlı Aktivasyon" button.
    - Allows choosing an existing business from a dropdown OR creating a new business inline (`business_name`, `google_review_url`, `city` default `'İzmir'`, `notes`).
    - On submit: saves business, updates product (`status = 'active'`, `business_id`, `activated_at = now()`), and shows a `"Canlı Test Et"` link (`https://nfcpatch.link/r/0001`).
  - **Management Actions per Product:**
    - `Test Et` (opens `/r/{product_code}` in new tab)
    - `Linki Düzenle` (updates target `google_review_url` or `business_name`)
    - `Durdur / Aktifleştir` (toggles between `disabled` and `active`)

## Step 6: Print-Ready PDF & CSV Exporter ("Matbaa Baskı Çıktısı")
- [x] Build a dedicated Print Export Modal/View (`/dashboard/print` or modal inside `/dashboard`) using `pdf-lib` and `qrcode`:
  1. **Product Range Selector:** Select product range (e.g., `QR-0001` to `QR-0100`, or filter by `unassigned` / `anti_metal`).
  2. **Interactive Alignment Calibration & Live Preview:**
     - Load `public/template-card.png` onto an HTML5 Canvas preview representing a `96mm x 96mm` card.
     - Draw a clean white cover box over the template's placeholder QR square area so the sample QR is completely hidden, preserving a strict white quiet zone around the real QR.
     - Provide X offset, Y offset, and QR Box Size sliders (pre-calibrated to the center QR area of `public/template-card.png`, roughly `32mm x 32mm` proportional to `96mm x 96mm`) so the user can visually confirm 100% alignment before downloading.
  3. **Multi-Page Print-Ready PDF Generation (`pdf-lib`):**
     - Page size: exact `96mm x 96mm` (`272.13pt x 272.13pt`), 1 card per page.
     - Embed `public/template-card.png` full-bleed (`0, 0, 272.13, 272.13`).
     - Draw the calibrated white cover rectangle over the placeholder QR area.
     - Generate a high-resolution PNG QR code (`errorCorrectionLevel: 'H'`, margin `1`) for each product's permanent URL (`https://nfcpatch.link/r/0001`, etc.) and draw it centered inside the cleared QR box.
     - Draw the serial number (`QR-0001`) in clean `6pt` Helvetica at the bottom-right corner (`x: 235pt, y: 10pt`).
     - Download file as `nfcpatch-print-0001-0100.pdf`.
  4. **Matching CSV Inventory Export:**
     - Download `nfcpatch-inventory-0001-0100.csv` with columns: `product_code,display_code,redirect_url,nfc_type,status`.
- [x] Run `npm run build` and TypeScript type-check (`npx tsc --noEmit`) to confirm zero errors across the entire project.