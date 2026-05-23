-- ============================================================
-- Acadore Tracker — Supabase Schema
-- Run this entire file in: Supabase → SQL Editor → New Query
-- ============================================================

-- MEMBERS
create table if not exists members (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  initials    text not null,
  color       text not null default '#1a6fe8',
  role        text not null default 'Member',
  created_at  timestamptz default now()
);

-- PROJECTS
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  desc        text default '',
  color       text not null default '#1a6fe8',
  status      text not null default 'active',
  start_date  date,
  end_date    date,
  members     uuid[] default '{}',
  created_at  timestamptz default now()
);

-- TASKS
create table if not exists tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects(id) on delete cascade,
  title       text not null,
  description text default '',
  status      text not null default 'todo',
  priority    text not null default 'medium',
  assignee_id uuid references members(id) on delete set null,
  due_date    date,
  tags        text[] default '{}',
  created_at  timestamptz default now()
);

-- Enable Row Level Security (open access — add auth later if needed)
alter table members  enable row level security;
alter table projects enable row level security;
alter table tasks    enable row level security;

create policy "Public read/write members"  on members  for all using (true) with check (true);
create policy "Public read/write projects" on projects for all using (true) with check (true);
create policy "Public read/write tasks"    on tasks    for all using (true) with check (true);

-- Enable Realtime so all teammates see changes live
alter publication supabase_realtime add table members;
alter publication supabase_realtime add table projects;
alter publication supabase_realtime add table tasks;

-- ============================================================
-- Seed Data (your initial projects and team)
-- ============================================================

insert into members (name, initials, color, role) values
  ('Gautam',       'G',  '#1a6fe8', 'Owner'),
  ('Mira Kapoor',  'MK', '#0dada6', 'Design Lead'),
  ('Aarav Tandon', 'AT', '#7c3aed', 'Engineering'),
  ('Priya Nair',   'PN', '#16a34a', 'Product'),
  ('Tomás García', 'TG', '#ea580c', 'Engineering');
