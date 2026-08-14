-- ============================================================
-- MIGRACIÓN v3 — Avatares de usuario
-- ============================================================
-- Segura de ejecutar sobre una base de datos ya en uso: solo añade
-- una columna con valor por defecto y actualiza dos funciones.
-- No borra ni modifica ninguna fila existente (los usuarios ya
-- creados reciben el avatar 'apple' por defecto automáticamente).
--
-- Ejecuta esto en Supabase → SQL Editor → New query → Run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Columna avatar_id en profiles
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists avatar_id text not null default 'apple';

-- ------------------------------------------------------------
-- 2. Que los usuarios nuevos también reciban el avatar por defecto
--    (redefinimos el trigger que crea el perfil al registrarse)
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, avatar_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'apple'
  );
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 3. get_group_members ahora también devuelve avatar_id.
--    Hay que borrar la función antes de recrearla porque cambia
--    el conjunto de columnas que devuelve (Postgres no permite
--    "create or replace" cuando cambian las columnas de salida).
-- ------------------------------------------------------------
drop function if exists public.get_group_members(uuid);

create function public.get_group_members(target_group_id uuid)
returns table (
  user_id uuid, name text, avatar_id text, email text, is_owner boolean, joined_at timestamptz
)
language sql
security definer set search_path = public
stable
as $$
  select p.id, p.name, p.avatar_id, u.email, (g.created_by = p.id) as is_owner, gm.joined_at
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  join auth.users u on u.id = p.id
  join public.groups g on g.id = gm.group_id
  where gm.group_id = target_group_id
    and public.is_member_of_group(target_group_id)
  order by gm.joined_at;
$$;

-- ------------------------------------------------------------
-- 4. Publicar profiles para Realtime: así, si tu pareja cambia su
--    avatar, lo ves actualizado sin recargar. Sigue protegido por
--    las políticas RLS ya existentes en profiles (solo se reciben
--    cambios de tu propio perfil o el de compañeros de grupo).
-- ------------------------------------------------------------
alter publication supabase_realtime add table public.profiles;
