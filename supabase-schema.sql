-- 在 Supabase SQL Editor 執行此腳本

create table if not exists public.id_cards (
  id uuid primary key default gen_random_uuid(),
  full_name text not null unique,
  id_number text not null unique,
  created_at timestamptz not null default now()
);

alter table public.id_cards enable row level security;

-- 允許匿名讀寫（此為演示用途；正式環境請改更嚴格政策）
create policy "allow anon select"
  on public.id_cards for select
  to anon using (true);

create policy "allow anon insert"
  on public.id_cards for insert
  to anon with check (true);

grant select, insert on public.id_cards to anon;
