-- ============================================================
-- MIGRACIÓN v2 — Multi-grupo, miembros y asignación de productos
-- ============================================================
-- Seguro de ejecutar sobre una base de datos que ya está en uso:
-- solo AÑADE columnas, funciones y políticas nuevas. No borra ni
-- modifica ninguna fila existente.
--
-- Ejecuta esto en Supabase → SQL Editor → New query → Run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Asignación de productos de la compra a un miembro del grupo
-- ------------------------------------------------------------
alter table public.shopping_list
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null;

-- ------------------------------------------------------------
-- 2. Permitir eliminar un grupo — solo su propietario
--    (la tabla "groups" ya tenía columna created_by = propietario)
-- ------------------------------------------------------------
drop policy if exists "groups_delete_owner" on public.groups;
create policy "groups_delete_owner"
  on public.groups for delete
  using (created_by = auth.uid());

-- ------------------------------------------------------------
-- 3. Listar "Mis grupos" (con rol y nº de miembros) de un click
-- ------------------------------------------------------------
create or replace function public.get_my_groups()
returns table (
  group_id uuid,
  name text,
  invite_code text,
  is_owner boolean,
  member_count bigint
)
language sql
security definer set search_path = public
stable
as $$
  select
    g.id,
    g.name,
    g.invite_code,
    (g.created_by = auth.uid()) as is_owner,
    (select count(*) from public.group_members gm2 where gm2.group_id = g.id) as member_count
  from public.groups g
  join public.group_members gm on gm.group_id = g.id
  where gm.user_id = auth.uid()
  order by g.created_at;
$$;

-- ------------------------------------------------------------
-- 4. Listar miembros de un grupo concreto (nombre, email, propietario)
--    Solo devuelve datos si quien pregunta es miembro de ese grupo.
-- ------------------------------------------------------------
create or replace function public.get_group_members(target_group_id uuid)
returns table (
  user_id uuid,
  name text,
  email text,
  is_owner boolean,
  joined_at timestamptz
)
language sql
security definer set search_path = public
stable
as $$
  select
    p.id,
    p.name,
    u.email,
    (g.created_by = p.id) as is_owner,
    gm.joined_at
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  join auth.users u on u.id = p.id
  join public.groups g on g.id = gm.group_id
  where gm.group_id = target_group_id
    and public.is_member_of_group(target_group_id)
  order by gm.joined_at;
$$;

-- ------------------------------------------------------------
-- 5. Salir de un grupo. Si quien sale es el propietario, la
--    propiedad pasa automáticamente al miembro más antiguo; si
--    no queda nadie más, el grupo (ya vacío) se elimina.
-- ------------------------------------------------------------
create or replace function public.leave_group(target_group_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  was_owner boolean;
  next_owner uuid;
begin
  select (created_by = auth.uid()) into was_owner
  from public.groups where id = target_group_id;

  delete from public.group_members
  where group_id = target_group_id and user_id = auth.uid();

  if was_owner then
    select user_id into next_owner
    from public.group_members
    where group_id = target_group_id
    order by joined_at
    limit 1;

    if next_owner is not null then
      update public.groups set created_by = next_owner where id = target_group_id;
    else
      delete from public.groups where id = target_group_id;
    end if;
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 6. REPLICA IDENTITY FULL en group_members — necesario para que
--    los eventos Realtime (alguien se une/sale de un grupo) se
--    puedan filtrar correctamente por group_id, igual que ya
--    hicimos con shopping_list/foods/categories.
-- ------------------------------------------------------------
alter table public.group_members replica identity full;
