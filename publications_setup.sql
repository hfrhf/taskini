-- ==========================================================
-- ملف تهيئة جداول ساحة المشاركة والمنشورات الاجتماعية لـ Supabase
-- قم بنسخ هذا الكود بالكامل ولصقه في SQL Editor في لوحة تحكم Supabase ثم اضغط Run
-- ==========================================================

-- 1. جدول المنشورات (publications)
create table if not exists public.publications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- تفعيل ميزة الأمان على مستوى السطر (RLS)
alter table public.publications enable row level security;

-- السياسات الأمنية لجدول المنشورات
create policy "Allow all authenticated users to view publications" on public.publications
  for select using (auth.role() = 'authenticated');

create policy "Allow users to create their own publications" on public.publications
  for insert with check (auth.uid() = user_id);

create policy "Allow owners to update their own publications" on public.publications
  for update using (auth.uid() = user_id);

create policy "Allow owners or admins to delete publications" on public.publications
  for delete using (auth.uid() = user_id or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- 2. جدول تفاعلات المنشورات (publication_reactions)
create table if not exists public.publication_reactions (
  id uuid default gen_random_uuid() primary key,
  publication_id uuid references public.publications(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  reaction_type text not null check (reaction_type in ('like', 'heart', 'haha', 'wow', 'sad', 'angry')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (publication_id, user_id)
);

alter table public.publication_reactions enable row level security;

-- السياسات الأمنية لجدول تفاعلات المنشورات
create policy "Allow all authenticated users to view publication_reactions" on public.publication_reactions
  for select using (auth.role() = 'authenticated');

create policy "Allow users to manage their own reactions" on public.publication_reactions
  for all using (auth.uid() = user_id);

-- 3. جدول تعليقات المنشورات المتداخلة (publication_comments)
create table if not exists public.publication_comments (
  id uuid default gen_random_uuid() primary key,
  publication_id uuid references public.publications(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  parent_id uuid references public.publication_comments(id) on delete cascade default null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.publication_comments enable row level security;

-- السياسات الأمنية لجدول تعليقات المنشورات
create policy "Allow all authenticated users to view publication_comments" on public.publication_comments
  for select using (auth.role() = 'authenticated');

create policy "Allow users to insert their own comments" on public.publication_comments
  for insert with check (auth.uid() = user_id);

create policy "Allow owners to update their own comments" on public.publication_comments
  for update using (auth.uid() = user_id);

create policy "Allow owners or admins to delete comments" on public.publication_comments
  for delete using (auth.uid() = user_id or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));
