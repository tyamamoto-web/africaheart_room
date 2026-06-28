-- デュエット曲リスト用テーブル
-- Supabase の SQL Editor に貼り付けて Run してください。

create extension if not exists pgcrypto;

create table if not exists public.duet_songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null default '',
  key_offset int not null default 0,   -- -3 〜 +3
  owner_id text not null,              -- 登録した端末ID
  owner_name text not null default '', -- 登録者名
  likes text[] not null default '{}',  -- いいねした端末IDの配列
  created_at timestamptz not null default now()
);

-- 行レベルセキュリティ（小規模グループ向けに匿名アクセスを許可）
alter table public.duet_songs enable row level security;

drop policy if exists "anon read"   on public.duet_songs;
drop policy if exists "anon insert" on public.duet_songs;
drop policy if exists "anon update" on public.duet_songs;
drop policy if exists "anon delete" on public.duet_songs;

create policy "anon read"   on public.duet_songs for select using (true);
create policy "anon insert" on public.duet_songs for insert with check (true);
create policy "anon update" on public.duet_songs for update using (true) with check (true);
create policy "anon delete" on public.duet_songs for delete using (true);
