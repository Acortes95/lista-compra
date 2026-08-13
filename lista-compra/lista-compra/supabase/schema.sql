-- ============================================================
-- Lista de la Compra Compartida — Esquema de base de datos
-- Ejecutar en el SQL Editor de Supabase (proyecto nuevo)
-- ============================================================

-- Extensión necesaria para gen_random_uuid()
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. PROFILES  (un perfil por usuario de auth.users)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Usuario',
  created_at timestamptz not null default now()
);

-- Crea automáticamente un profile cuando se registra un usuario
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------
-- 2. GROUPS  (una pareja/grupo)
-- ------------------------------------------------------------
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Nuestra compra',
  invite_code text not null unique default substr(md5(random()::text), 1, 8),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

-- ------------------------------------------------------------
-- 3. GROUP_MEMBERS
-- ------------------------------------------------------------
create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- Función auxiliar: ¿pertenece el usuario actual a este grupo?
create or replace function public.is_member_of_group(target_group_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = target_group_id
      and user_id = auth.uid()
  );
$$;

-- ------------------------------------------------------------
-- 4. CATEGORIES
-- ------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null,
  icon text not null default '🛒',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 5. FOODS  (catálogo permanente de alimentos)
-- ------------------------------------------------------------
create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  unit text not null default 'unidades',
  default_quantity numeric not null default 1,
  notes text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists foods_group_idx on public.foods(group_id) where deleted_at is null;

-- ------------------------------------------------------------
-- 6. SHOPPING_LIST
-- ------------------------------------------------------------
create table if not exists public.shopping_list (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  food_id uuid not null references public.foods(id) on delete cascade,
  quantity numeric not null default 1,
  purchased boolean not null default false,
  created_at timestamptz not null default now(),
  purchased_at timestamptz,
  added_by uuid references public.profiles(id)
);

create index if not exists shopping_list_group_idx on public.shopping_list(group_id);

-- Evita duplicados: un mismo food_id sólo puede estar una vez
-- "activo" (no comprado) en la lista de un grupo.
create unique index if not exists shopping_list_unique_pending
  on public.shopping_list(group_id, food_id)
  where purchased = false;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.categories enable row level security;
alter table public.foods enable row level security;
alter table public.shopping_list enable row level security;

-- PROFILES: cada usuario ve y edita su propio perfil,
-- y puede ver los perfiles de compañeros de grupo (para "añadido por").
create policy "profiles_select_self_or_groupmate"
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.group_members gm1
      join public.group_members gm2 on gm1.group_id = gm2.group_id
      where gm1.user_id = auth.uid() and gm2.user_id = profiles.id
    )
  );

create policy "profiles_update_self"
  on public.profiles for update
  using (id = auth.uid());

-- GROUPS: solo miembros pueden ver su grupo.
create policy "groups_select_member"
  on public.groups for select
  using (public.is_member_of_group(id));

create policy "groups_insert_authenticated"
  on public.groups for insert
  with check (auth.uid() is not null);

create policy "groups_update_member"
  on public.groups for update
  using (public.is_member_of_group(id));

-- GROUP_MEMBERS: un usuario ve los miembros de sus propios grupos.
create policy "group_members_select_own_groups"
  on public.group_members for select
  using (public.is_member_of_group(group_id));

create policy "group_members_insert_self"
  on public.group_members for insert
  with check (user_id = auth.uid());

create policy "group_members_delete_self"
  on public.group_members for delete
  using (user_id = auth.uid());

-- CATEGORIES: solo miembros del grupo.
create policy "categories_select_member"
  on public.categories for select
  using (public.is_member_of_group(group_id));

create policy "categories_insert_member"
  on public.categories for insert
  with check (public.is_member_of_group(group_id));

create policy "categories_update_member"
  on public.categories for update
  using (public.is_member_of_group(group_id));

create policy "categories_delete_member"
  on public.categories for delete
  using (public.is_member_of_group(group_id));

-- FOODS: solo miembros del grupo.
create policy "foods_select_member"
  on public.foods for select
  using (public.is_member_of_group(group_id));

create policy "foods_insert_member"
  on public.foods for insert
  with check (public.is_member_of_group(group_id));

create policy "foods_update_member"
  on public.foods for update
  using (public.is_member_of_group(group_id));

create policy "foods_delete_member"
  on public.foods for delete
  using (public.is_member_of_group(group_id));

-- SHOPPING_LIST: solo miembros del grupo.
create policy "shopping_list_select_member"
  on public.shopping_list for select
  using (public.is_member_of_group(group_id));

create policy "shopping_list_insert_member"
  on public.shopping_list for insert
  with check (public.is_member_of_group(group_id));

create policy "shopping_list_update_member"
  on public.shopping_list for update
  using (public.is_member_of_group(group_id));

create policy "shopping_list_delete_member"
  on public.shopping_list for delete
  using (public.is_member_of_group(group_id));

-- ============================================================
-- REALTIME: publicar cambios de estas tablas
-- ============================================================
alter publication supabase_realtime add table public.shopping_list;
alter publication supabase_realtime add table public.foods;
alter publication supabase_realtime add table public.categories;
alter publication supabase_realtime add table public.group_members;

-- REPLICA IDENTITY FULL: imprescindible para que los eventos UPDATE
-- y, sobre todo, DELETE incluyan todas las columnas (incluida group_id),
-- que es lo que usamos para filtrar los cambios por grupo en el cliente.
-- Sin esto, solo llegan bien los INSERT.
alter table public.shopping_list replica identity full;
alter table public.foods replica identity full;
alter table public.categories replica identity full;

-- ============================================================
-- Categorías iniciales — se insertan por grupo al crear el grupo
-- (ver función create_group_with_defaults más abajo, usada desde la app)
-- ============================================================
create or replace function public.create_group_with_defaults(group_name text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  new_group_id uuid;
begin
  insert into public.groups (name, created_by)
  values (group_name, auth.uid())
  returning id into new_group_id;

  insert into public.group_members (group_id, user_id)
  values (new_group_id, auth.uid());

  insert into public.categories (group_id, name, icon, sort_order) values
    (new_group_id, 'Fruta y verdura', '🥦', 1),
    (new_group_id, 'Carnicería',      '🥩', 2),
    (new_group_id, 'Pescadería',      '🐟', 3),
    (new_group_id, 'Lácteos',         '🥛', 4),
    (new_group_id, 'Panadería',       '🥖', 5),
    (new_group_id, 'Alimentación',    '🥫', 6),
    (new_group_id, 'Congelados',      '🧊', 7),
    (new_group_id, 'Conservas',       '🥫', 8),
    (new_group_id, 'Bebidas',         '🥤', 9),
    (new_group_id, 'Limpieza',        '🧽', 10),
    (new_group_id, 'Higiene',         '🧴', 11),
    (new_group_id, 'Mascota',         '🐾', 12),
    (new_group_id, 'Otros',           '📦', 13);

  return new_group_id;
end;
$$;

-- Unirse a un grupo existente mediante código de invitación
create or replace function public.join_group_by_code(code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  target_group_id uuid;
begin
  select id into target_group_id from public.groups where invite_code = code;

  if target_group_id is null then
    raise exception 'Código de invitación no válido';
  end if;

  insert into public.group_members (group_id, user_id)
  values (target_group_id, auth.uid())
  on conflict do nothing;

  return target_group_id;
end;
$$;
