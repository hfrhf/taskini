-- ==========================================
-- ملف تهيئة قاعدة بيانات مشروع Taskini في Supabase
-- قم بنسخ هذا الكود بالكامل ولصقه في قسم SQL Editor في لوحة تحكم Supabase ثم اضغط Run
-- ==========================================

-- 1. إنشاء جدول ملفات التعريف للمستخدمين (Profiles)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  email text not null,
  role text not null check (role in ('admin', 'user')),
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- تفعيل ميزة الأمان على مستوى السطر (Row Level Security)
alter table public.profiles enable row level security;

-- صلاحيات جدول ملفات التعريف
create policy "Allow public read access to profiles" on public.profiles
  for select using (true);

create policy "Allow users to update their own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Allow system/admins to insert profiles" on public.profiles
  for insert with check (true);

-- 2. دالة ومحفّز لإنشاء ملف تعريف تلقائي فور تسجيل مستخدم جديد في Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, role, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'عضو جديد'),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'user'),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=100&auto=format&fit=crop'
    )
  );
  return new;
end;
$$ language plpgsql security definer;

-- إطلاق المحفز
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. إنشاء جدول مجموعات العمل (task_groups)
create table if not exists public.task_groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  color text not null default 'classic',
  date date not null default current_date,
  created_by uuid references public.profiles(id) on delete cascade not null,
  assigned_to uuid references public.profiles(id) on delete set null,
  is_permanent boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.task_groups enable row level security;

-- صلاحيات مجموعات العمل
create policy "Allow admins full access to groups" on public.task_groups
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Allow users to read their own or assigned groups" on public.task_groups
  for select using (
    created_by = auth.uid() or assigned_to = auth.uid()
  );

create policy "Allow users to insert their own groups" on public.task_groups
  for insert with check (
    created_by = auth.uid()
  );

create policy "Allow users to update their own groups" on public.task_groups
  for update using (
    created_by = auth.uid()
  );

create policy "Allow users to delete their own groups" on public.task_groups
  for delete using (
    created_by = auth.uid()
  );

-- 4. إنشاء جدول المهام (tasks)
create table if not exists public.tasks (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.task_groups(id) on delete cascade not null,
  title text not null,
  description text,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed', 'late')),
  assigned_to uuid references public.profiles(id) on delete set null,
  color text not null default 'classic',
  due_date date not null,
  completed_date date,
  migrated_from_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.tasks enable row level security;

-- صلاحيات جدول المهام
create policy "Allow admins full access to tasks" on public.tasks
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Allow users to read their own or assigned tasks" on public.tasks
  for select using (
    assigned_to = auth.uid() or exists (
      select 1 from public.task_groups
      where task_groups.id = group_id and (task_groups.created_by = auth.uid() or task_groups.assigned_to = auth.uid())
    )
  );

create policy "Allow users to insert tasks in their groups" on public.tasks
  for insert with check (
    exists (
      select 1 from public.task_groups
      where task_groups.id = group_id and task_groups.created_by = auth.uid()
    )
  );

create policy "Allow users to update tasks assigned to them or in their groups" on public.tasks
  for update using (
    assigned_to = auth.uid() or exists (
      select 1 from public.task_groups
      where task_groups.id = group_id and task_groups.created_by = auth.uid()
    )
  );

create policy "Allow users to delete tasks in their groups" on public.tasks
  for delete using (
    exists (
      select 1 from public.task_groups
      where task_groups.id = group_id and task_groups.created_by = auth.uid()
    )
  );

-- 5. إنشاء جدول ملفات المهام (task_files)
create table if not exists public.task_files (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  file_name text not null,
  file_path text not null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.task_files enable row level security;

-- صلاحيات جدول ملفات المهام
create policy "Allow users to read files of tasks they can access" on public.task_files
  for select using (
    exists (
      select 1 from public.tasks
      where tasks.id = task_id
    )
  );

create policy "Allow users to upload files to tasks they can access" on public.task_files
  for insert with check (
    exists (
      select 1 from public.tasks
      where tasks.id = task_id
    )
  );

create policy "Allow users to delete their own uploaded files or admins to delete any" on public.task_files
  for delete using (
    uploaded_by = auth.uid() or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- 6. إنشاء مخزن الملفات (Storage Bucket) باسم task-attachments
-- ملاحظة: يجب عليك إنشاء هذا المجلد من خلال واجهة Supabase Storage باسم 'task-attachments' وتفعيل الوصول العام أو استخدام الصلاحيات التالية:

insert into storage.buckets (id, name, public) values ('task-attachments', 'task-attachments', true)
on conflict (id) do nothing;

-- صلاحيات مخزن الملفات السحابي
create policy "Allow authenticated uploads" on storage.objects
  for insert with check (
    bucket_id = 'task-attachments' and auth.role() = 'authenticated'
  );

create policy "Allow authenticated reads" on storage.objects
  for select using (
    bucket_id = 'task-attachments' and auth.role() = 'authenticated'
  );

create policy "Allow delete access" on storage.objects
  for delete using (
    bucket_id = 'task-attachments' and auth.role() = 'authenticated'
  );

-- 7. إنشاء جدول أوقات توفر المستخدمين (user_availability)
create table if not exists public.user_availability (
  user_id uuid references public.profiles(id) on delete cascade not null,
  day_of_week integer not null check (day_of_week between 0 and 6),
  hour integer not null check (hour between 0 and 23),
  status text not null default 'unavailable' check (status in ('available', 'unavailable', 'maybe')),
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, day_of_week, hour)
);

alter table public.user_availability enable row level security;

-- صلاحيات جدول أوقات التوفر
create policy "Allow users full access to their own availability" on public.user_availability
  for all using (
    auth.uid() = user_id
  );

create policy "Allow admins to read all availability" on public.user_availability
  for select using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- 8. إنشاء جدول اليوميات السريعة (daily_standups) مع الخيارات التفاعلية وتقييم النجوم
create table if not exists public.daily_standups (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null default current_date,
  today_tasks text not null,
  tomorrow_tasks text not null,
  blockers text,
  mood text not null default 'stable' check (mood in ('energetic', 'stable', 'tired', 'stressed')),
  progress_rate text not null default 'most' check (progress_rate in ('all', 'most', 'half', 'low')),
  productivity_score integer not null default 5 check (productivity_score between 1 and 5),
  work_minutes integer not null default 0, -- ساعات العمل بالدقائق
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, date) -- يمنع تكرار الإدخال للمستخدم في نفس اليوم
);

alter table public.daily_standups enable row level security;

-- السياسات الأمنية لجدول اليوميات
create policy "Allow all authenticated users to read standups" on public.daily_standups
  for select using (auth.role() = 'authenticated');

create policy "Allow users to insert their own standups" on public.daily_standups
  for insert with check (auth.uid() = user_id);

create policy "Allow users to update their own standups" on public.daily_standups
  for update using (auth.uid() = user_id);

create policy "Allow users to delete their own standups" on public.daily_standups
  for delete using (auth.uid() = user_id);

-- 9. إنشاء جدول المحطات الكبرى (project_milestones)
create table if not exists public.project_milestones (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  due_date date not null,
  status text not null default 'active' check (status in ('active', 'completed', 'delayed')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.project_milestones enable row level security;

-- السياسات الأمنية لجدول المحطات الكبرى
create policy "Allow all authenticated users to read milestones" on public.project_milestones
  for select using (auth.role() = 'authenticated');

create policy "Allow admins full access to milestones" on public.project_milestones
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- ربط جدول المهام (tasks) بالمحطة الكبرى
alter table public.tasks 
  add column if not exists milestone_id uuid references public.project_milestones(id) on delete set null;

-- ربط جدول اليوميات السريعة (daily_standups) بالمحطة الكبرى
alter table public.daily_standups 
  add column if not exists milestone_id uuid references public.project_milestones(id) on delete set null;


-- 10. إنشاء جدول حفظ اشتراكات إشعارات الويب اللحظية (push_subscriptions)
create table if not exists public.push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  subscription jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, subscription)
);

-- تفعيل RLS
alter table public.push_subscriptions enable row level security;

-- السياسات الأمنية
create policy "Allow users to manage their own push subscriptions" on public.push_subscriptions
  for all using (auth.uid() = user_id);


-- 11. إنشاء جدول استطلاعات المواعيد (meeting_polls)
create table if not exists public.meeting_polls (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  meeting_type text not null check (meeting_type in ('online', 'offline')),
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.meeting_polls enable row level security;

create policy "Allow all authenticated users to read meeting_polls" on public.meeting_polls
  for select using (auth.role() = 'authenticated');

create policy "Allow admins full access to meeting_polls" on public.meeting_polls
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- 12. إنشاء جدول خيارات الموعد المقترح (meeting_poll_options)
create table if not exists public.meeting_poll_options (
  id uuid default gen_random_uuid() primary key,
  poll_id uuid references public.meeting_polls(id) on delete cascade not null,
  proposed_date date not null,
  proposed_time time not null
);

alter table public.meeting_poll_options enable row level security;

create policy "Allow all authenticated users to read meeting_poll_options" on public.meeting_poll_options
  for select using (auth.role() = 'authenticated');

create policy "Allow admins full access to meeting_poll_options" on public.meeting_poll_options
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- 13. إنشاء جدول أصوات المستخدمين (meeting_poll_votes)
create table if not exists public.meeting_poll_votes (
  id uuid default gen_random_uuid() primary key,
  option_id uuid references public.meeting_poll_options(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (option_id, user_id)
);

alter table public.meeting_poll_votes enable row level security;

create policy "Allow all authenticated users to read meeting_poll_votes" on public.meeting_poll_votes
  for select using (auth.role() = 'authenticated');

create policy "Allow users to manage their own votes" on public.meeting_poll_votes
  for all using (auth.uid() = user_id);

-- 14. إنشاء جدول الاجتماعات المجدولة النهائية (scheduled_meetings)
create table if not exists public.scheduled_meetings (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  meeting_type text not null check (meeting_type in ('online', 'offline')),
  meeting_date date not null,
  meeting_time time not null,
  location_url text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.scheduled_meetings enable row level security;

create policy "Allow all authenticated users to read scheduled_meetings" on public.scheduled_meetings
  for select using (auth.role() = 'authenticated');

create policy "Allow admins full access to scheduled_meetings" on public.scheduled_meetings
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- 15. إنشاء جدول تفاعلات اللقاء اليومي (standup_reactions)
create table if not exists public.standup_reactions (
  id uuid default gen_random_uuid() primary key,
  standup_id uuid references public.daily_standups(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  reaction_type text not null check (reaction_type in ('like', 'heart', 'haha', 'rocket', 'tada', 'eyes', 'angry', 'alert')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (standup_id, user_id)
);

alter table public.standup_reactions enable row level security;

create policy "Allow all authenticated users to read standup_reactions" on public.standup_reactions
  for select using (auth.role() = 'authenticated');

create policy "Allow users to manage their own reactions" on public.standup_reactions
  for all using (auth.uid() = user_id);

-- 16. إنشاء جدول تعليقات اللقاء اليومي المتداخلة (standup_comments)
create table if not exists public.standup_comments (
  id uuid default gen_random_uuid() primary key,
  standup_id uuid references public.daily_standups(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  parent_id uuid references public.standup_comments(id) on delete cascade default null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.standup_comments enable row level security;

create policy "Allow all authenticated users to read standup_comments" on public.standup_comments
  for select using (auth.role() = 'authenticated');

create policy "Allow users to manage their own comments" on public.standup_comments
  for all using (auth.uid() = user_id);

-- 17. إنشاء جداول العصف الذهني والأفكار (Ideas & Upvotes & Comments)
create table if not exists public.ideas (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  category text not null default 'general', -- 'design', 'tech', 'marketing', 'general'
  status text not null default 'draft' check (status in ('draft', 'discussing', 'approved', 'converted')),
  user_id uuid references public.profiles(id) on delete cascade not null,
  converted_task_id uuid references public.tasks(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.ideas enable row level security;
create policy "Allow all authenticated users to view ideas" on public.ideas for select using (auth.role() = 'authenticated');
create policy "Allow users to create their own ideas" on public.ideas for insert with check (auth.uid() = user_id);
create policy "Allow owners to update their own ideas" on public.ideas for update using (auth.uid() = user_id);
create policy "Allow owners/admins to delete ideas" on public.ideas for delete using (auth.uid() = user_id or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create table if not exists public.idea_upvotes (
  idea_id uuid references public.ideas(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (idea_id, user_id)
);

alter table public.idea_upvotes enable row level security;
create policy "Allow all users to view upvotes" on public.idea_upvotes for select using (auth.role() = 'authenticated');
create policy "Allow users to toggle their own upvote" on public.idea_upvotes for insert with check (auth.uid() = user_id);
create policy "Allow users to delete their own upvote" on public.idea_upvotes for delete using (auth.uid() = user_id);

create table if not exists public.idea_comments (
  id uuid default gen_random_uuid() primary key,
  idea_id uuid references public.ideas(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.idea_comments enable row level security;
create policy "Allow all users to view idea comments" on public.idea_comments for select using (auth.role() = 'authenticated');
create policy "Allow users to insert their own comments" on public.idea_comments for insert with check (auth.uid() = user_id);
create policy "Allow owners to update their own comments" on public.idea_comments for update using (auth.uid() = user_id);
create policy "Allow owners/admins to delete comments" on public.idea_comments for delete using (auth.uid() = user_id or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));



