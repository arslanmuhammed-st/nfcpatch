-- NFCPATCH Database Schema & Row Level Security (RLS)

-- 1. Businesses Table
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  google_review_url text not null,
  city text default 'İzmir',
  notes text,
  created_at timestamptz default now()
);

-- 2. Products Table
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  product_code text unique not null,
  display_code text unique not null,
  nfc_type text not null default 'standard' check (nfc_type in ('standard', 'anti_metal')),
  status text not null default 'unassigned' check (status in ('unassigned', 'active', 'disabled')),
  business_id uuid references public.businesses(id) on delete set null,
  activated_at timestamptz,
  created_at timestamptz default now()
);

-- 3. Scan Events Table
create table if not exists public.scan_events (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  source text not null default 'unknown' check (source in ('qr', 'nfc', 'unknown')),
  user_agent text,
  created_at timestamptz default now()
);

-- 4. Indexes
create index if not exists idx_products_product_code on public.products(product_code);
create index if not exists idx_products_status on public.products(status);
create index if not exists idx_scan_events_product_id on public.scan_events(product_id);

-- 5. Row Level Security (RLS)
alter table public.businesses enable row level security;
alter table public.products enable row level security;
alter table public.scan_events enable row level security;

-- Public (anon) policies for /r/[code] lookups and scan logging
drop policy if exists "Allow anon select on products" on public.products;
create policy "Allow anon select on products"
  on public.products
  for select
  to anon
  using (true);

drop policy if exists "Allow anon select on businesses" on public.businesses;
create policy "Allow anon select on businesses"
  on public.businesses
  for select
  to anon
  using (true);

drop policy if exists "Allow anon insert on scan_events" on public.scan_events;
create policy "Allow anon insert on scan_events"
  on public.scan_events
  for insert
  to anon
  with check (true);

-- Authenticated admin policies (full access)
drop policy if exists "Allow authenticated full access on businesses" on public.businesses;
create policy "Allow authenticated full access on businesses"
  on public.businesses
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Allow authenticated full access on products" on public.products;
create policy "Allow authenticated full access on products"
  on public.products
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Allow authenticated full access on scan_events" on public.scan_events;
create policy "Allow authenticated full access on scan_events"
  on public.scan_events
  for all
  to authenticated
  using (true)
  with check (true);
