-- デュエット曲リスト用テーブル
-- Supabase の SQL Editor に貼り付けて Run してください。

create extension if not exists pgcrypto;

create table if not exists public.duet_songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null default '',
  key_offset int not null default 0,   -- -3 〜 +3
  part text not null default '',       -- 歌ってほしいパート（任意）
  owner_id text not null,              -- 登録した端末ID
  owner_name text not null default '', -- 登録者名
  likes text[] not null default '{}',  -- いいねした端末IDの配列
  created_at timestamptz not null default now()
);

-- 既にテーブルがある場合に part 列を追加（後から追加した場合用）
alter table public.duet_songs add column if not exists part text not null default '';

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


-- ============================================================
-- 宿題ルーレットの抽選結果（全員で共有する単一行 id=1）
-- ============================================================
create table if not exists public.homework_result (
  id smallint primary key,                          -- 常に 1 を使う
  themes text[] not null default '{}',              -- 抽選で決まったテーマ（最大3件）
  updated_by text not null default '',              -- 最後に更新した人の名前
  updated_at timestamptz not null default now()
);

-- 共有用の1行を用意（無ければ作成）
insert into public.homework_result (id, themes) values (1, '{}')
  on conflict (id) do nothing;

alter table public.homework_result enable row level security;

drop policy if exists "hw anon read"   on public.homework_result;
drop policy if exists "hw anon insert" on public.homework_result;
drop policy if exists "hw anon update" on public.homework_result;

create policy "hw anon read"   on public.homework_result for select using (true);
create policy "hw anon insert" on public.homework_result for insert with check (true);
create policy "hw anon update" on public.homework_result for update using (true) with check (true);


-- ============================================================
-- 宿題リスト（候補曲）：全員で追加・共有。月ごとに区分け（1〜12月）、各月20件まで。
-- 行ごとに保存し、(month, text) を一意にして同月内の重複登録を防ぐ。
-- ============================================================
create table if not exists public.homework_themes (
  id uuid primary key default gen_random_uuid(),
  month smallint not null check (month between 1 and 12),
  text text not null,
  created_at timestamptz not null default now(),
  unique (month, text)
);

alter table public.homework_themes enable row level security;

drop policy if exists "ht anon read"   on public.homework_themes;
drop policy if exists "ht anon insert" on public.homework_themes;
drop policy if exists "ht anon delete" on public.homework_themes;

create policy "ht anon read"   on public.homework_themes for select using (true);
create policy "ht anon insert" on public.homework_themes for insert with check (true);
create policy "ht anon delete" on public.homework_themes for delete using (true);

-- 旧「月なし版」homework_themes が既にある場合の移行（データは保持。fresh環境では実質no-op）
alter table public.homework_themes
  add column if not exists month smallint not null default 6 check (month between 1 and 12);
alter table public.homework_themes alter column month drop default;
alter table public.homework_themes drop constraint if exists homework_themes_text_key;
alter table public.homework_themes drop constraint if exists homework_themes_month_text_key;
alter table public.homework_themes add constraint homework_themes_month_text_key unique (month, text);


-- ============================================================
-- メンバープロフィール（自己紹介・近況）：全員で共有・編集
-- ============================================================
create table if not exists public.member_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,                     -- メンバー名
  intro text not null default '',         -- 自己紹介
  fav text not null default '',           -- 好きな曲・アーティスト（任意）
  status text not null default '',        -- 近況コメント
  birth_month smallint check (birth_month between 1 and 12), -- 誕生月（任意・1〜12・未設定はnull）
  owner_id text not null default '',      -- 登録した端末ID（記録用）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 既にテーブルがある場合に誕生月カラムを追加（後から追加した場合用）
alter table public.member_profiles
  add column if not exists birth_month smallint check (birth_month between 1 and 12);

alter table public.member_profiles enable row level security;

drop policy if exists "mp anon read"   on public.member_profiles;
drop policy if exists "mp anon insert" on public.member_profiles;
drop policy if exists "mp anon update" on public.member_profiles;
drop policy if exists "mp anon delete" on public.member_profiles;

create policy "mp anon read"   on public.member_profiles for select using (true);
create policy "mp anon insert" on public.member_profiles for insert with check (true);
create policy "mp anon update" on public.member_profiles for update using (true) with check (true);
create policy "mp anon delete" on public.member_profiles for delete using (true);
