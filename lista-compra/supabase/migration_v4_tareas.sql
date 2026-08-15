-- ============================================================
-- MIGRACIÓN v4 — Sección Tareas
-- ============================================================
-- Segura de ejecutar sobre una base de datos ya en uso: solo crea
-- tablas nuevas. No toca nada de lo que ya existe.
--
-- Ejecuta esto en Supabase → SQL Editor → New query → Run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabla TASKS
-- ------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  type text not null check (type in ('basica','lista','recurrente','gestion','actividad')),

  title text not null,
  description text,

  date date not null,        -- fecha (o fecha de inicio, si es una actividad con rango)
  end_date date,             -- fecha de fin, solo se usa en actividades con rango de días
  time_start time,           -- hora de inicio (opcional)
  time_end time,             -- hora de fin / fin de franja (opcional)

  assigned_to uuid references public.profiles(id) on delete set null,

  completed boolean not null default false,
  completed_at timestamptz,

  -- Recurrencia: las ocurrencias se generan como filas independientes
  -- que comparten recurrence_group_id, para poder marcarlas completas
  -- una a una sin afectar a las demás.
  recurrence_group_id uuid,
  recurrence_days int[],     -- 0=domingo .. 6=sábado

  -- Gestión: recordatorio (aviso dentro de la app; ver nota en README
  -- sobre notificaciones push reales)
  reminder_enabled boolean not null default false,
  reminder_minutes_before int,
  reminder_repeat text check (reminder_repeat in ('none','daily','weekly')) default 'none',

  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists tasks_group_date_idx
  on public.tasks(group_id, date) where deleted_at is null;

-- ------------------------------------------------------------
-- 2. Tabla TASK_LIST_ITEMS (subtareas del tipo "Lista")
-- ------------------------------------------------------------
create table if not exists public.task_list_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  text text not null,
  completed boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists task_list_items_task_idx on public.task_list_items(task_id);
create index if not exists task_list_items_group_idx on public.task_list_items(group_id);

-- ------------------------------------------------------------
-- 3. RLS — mismo criterio que el resto de tablas: solo miembros
--    del grupo pueden leer/escribir.
-- ------------------------------------------------------------
alter table public.tasks enable row level security;
alter table public.task_list_items enable row level security;

drop policy if exists "tasks_select_member" on public.tasks;
create policy "tasks_select_member" on public.tasks for select
  using (public.is_member_of_group(group_id));

drop policy if exists "tasks_insert_member" on public.tasks;
create policy "tasks_insert_member" on public.tasks for insert
  with check (public.is_member_of_group(group_id));

drop policy if exists "tasks_update_member" on public.tasks;
create policy "tasks_update_member" on public.tasks for update
  using (public.is_member_of_group(group_id));

drop policy if exists "tasks_delete_member" on public.tasks;
create policy "tasks_delete_member" on public.tasks for delete
  using (public.is_member_of_group(group_id));

-- task_list_items: se valida a través del group_id de la tarea padre
drop policy if exists "task_list_items_select_member" on public.task_list_items;
create policy "task_list_items_select_member" on public.task_list_items for select
  using (exists (
    select 1 from public.tasks t
    where t.id = task_list_items.task_id and public.is_member_of_group(t.group_id)
  ));

drop policy if exists "task_list_items_insert_member" on public.task_list_items;
create policy "task_list_items_insert_member" on public.task_list_items for insert
  with check (exists (
    select 1 from public.tasks t
    where t.id = task_list_items.task_id and t.group_id = task_list_items.group_id and public.is_member_of_group(t.group_id)
  ));

drop policy if exists "task_list_items_update_member" on public.task_list_items;
create policy "task_list_items_update_member" on public.task_list_items for update
  using (exists (
    select 1 from public.tasks t
    where t.id = task_list_items.task_id and t.group_id = task_list_items.group_id and public.is_member_of_group(t.group_id)
  ));

drop policy if exists "task_list_items_delete_member" on public.task_list_items;
create policy "task_list_items_delete_member" on public.task_list_items for delete
  using (exists (
    select 1 from public.tasks t
    where t.id = task_list_items.task_id and public.is_member_of_group(t.group_id)
  ));

-- ------------------------------------------------------------
-- 4. Realtime
-- ------------------------------------------------------------
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.task_list_items;
alter table public.tasks replica identity full;
alter table public.task_list_items replica identity full;
