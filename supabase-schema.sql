-- 巴拉國身分證資料表（可重複執行）

create table if not exists public.id_cards (
  id uuid primary key default gen_random_uuid(),
  full_name text not null unique,
  id_number text not null unique,
  created_at timestamptz not null default now()
);

alter table public.id_cards enable row level security;

-- 先刪除舊政策（避免 42710 已存在錯誤）
drop policy if exists "allow anon select" on public.id_cards;
drop policy if exists "allow anon insert" on public.id_cards;

create policy "allow anon select"
  on public.id_cards for select
  to anon
  using (true);

create policy "allow anon insert"
  on public.id_cards for insert
  to anon
  with check (true);

grant select, insert on public.id_cards to anon;
