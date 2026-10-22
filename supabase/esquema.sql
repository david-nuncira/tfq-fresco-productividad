-- ================================================================
-- TFQ Fresco | Productividad — INSTALACIÓN COMPLETA DE LA BASE
-- ================================================================
-- Cómo ejecutarlo: en Supabase → SQL Editor → New query → pegue
-- TODO este archivo → Run. Está escrito en orden de ejecución y
-- pensado para un proyecto nuevo (vacío).
--
-- Qué instala:
--   1. Perfiles con roles (admin / analista / lector)
--   2. Lotes de importación con estados (pendiente/confirmado/anulado/descartado)
--   3. Eventos de bandeja con identidad + huella de contenido
--   4. Revisiones (historial: toda corrección conserva el valor anterior y su autor)
--   5. Horas-persona validadas (opcional, para productividad)
--   6. Catálogo de operarios y configuración (etapa de marca horaria, turnos, metas)
--   7. Funciones de importación (clasificar, importar, confirmar, descartar, anular, resolver conflicto)
--   8. Funciones de agregación (los totales se calculan en la base, sobre TODAS las filas filtradas)
--   9. Seguridad real: RLS en todas las tablas; escrituras SOLO mediante
--      funciones con verificación de rol. Ocultar botones no es seguridad;
--      esto sí lo es.
-- ================================================================

-- ----------------------------------------------------------------
-- 1) PERFILES Y ROLES
-- ----------------------------------------------------------------
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  correo text,
  nombre text,
  rol text not null default 'lector' check (rol in ('admin', 'analista', 'lector')),
  creado_en timestamptz not null default now()
);

comment on table public.perfiles is
  'Un perfil por usuario de Auth. El rol SOLO puede cambiarlo un administrador (política RLS); un usuario no puede elevarse permisos editando su perfil.';

-- Rol del usuario autenticado (SECURITY DEFINER para evitar recursión de RLS).
create or replace function public.fn_mi_rol()
returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
  select rol from public.perfiles where id = auth.uid();
$$;

create or replace function public.fn_es_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce((select rol from public.perfiles where id = auth.uid()) = 'admin', false);
$$;

create or replace function public.fn_es_editor()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce((select rol from public.perfiles where id = auth.uid()) in ('admin', 'analista'), false);
$$;

-- Crea el perfil automáticamente al crear un usuario en Supabase Auth.
create or replace function public.fn_nuevo_usuario()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.perfiles (id, correo, rol)
  values (new.id, new.email, 'lector')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_nuevo_usuario on auth.users;
create trigger trg_nuevo_usuario
after insert on auth.users
for each row execute function public.fn_nuevo_usuario();

-- ----------------------------------------------------------------
-- 2) LOTES DE IMPORTACIÓN
-- ----------------------------------------------------------------
create table public.lotes (
  id uuid primary key default gen_random_uuid(),
  creado_por uuid not null references public.perfiles (id),
  creado_en timestamptz not null default now(),
  origen text not null check (origen in ('pegado', 'archivo', 'horas')),
  nombre_origen text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'confirmado', 'anulado', 'descartado')),
  filas_recibidas integer not null default 0,
  rechazadas_cliente integer not null default 0,
  nuevas integer not null default 0,
  duplicadas integer not null default 0,
  conflictos integer not null default 0,
  errores integer not null default 0,
  confirmado_en timestamptz,
  anulado_en timestamptz,
  anulado_por uuid references public.perfiles (id),
  motivo_anulacion text
);

comment on table public.lotes is
  'Cada importación es un lote. Los indicadores SOLO cuentan eventos de lotes CONFIRMADOS: una importación interrumpida (lote pendiente) nunca publica datos parciales.';

create index idx_lotes_estado on public.lotes (estado);
create index idx_lotes_creado_en on public.lotes (creado_en desc);

-- ----------------------------------------------------------------
-- 3) EVENTOS DE BANDEJA
-- ----------------------------------------------------------------
create table public.eventos (
  id bigint generated always as identity primary key,
  -- Identidad del evento (validada con el archivo real):
  -- fecha de producción + n° de producción + tanque + posición + n° bandeja.
  clave text not null,
  -- Huella SHA-256 de TODAS las celdas originales: detecta contenido cambiado.
  huella text not null,
  lote_id uuid not null references public.lotes (id),
  fila_origen integer,
  estado text not null default 'activo'
    check (estado in ('activo', 'conflicto', 'anulado', 'descartado')),
  conflicto_con bigint references public.eventos (id),
  repeticion_confirmada boolean not null default false,
  -- Fila original completa, tal como se pegó (arreglo de celdas),
  -- incluidas columnas sin nombre y el encabezado "1630": trazabilidad.
  crudo jsonb not null,
  -- Valores normalizados (el original siempre queda en crudo):
  fecha_produccion date,
  numero_produccion text,
  liquido text,
  fecha_cargue date,
  posicion text,
  tanque text,
  finca text,
  codigo_pasmador text,
  nombre_pasmador text,
  variedad text,
  numero_bandeja text,
  codigo_ensamblador text,
  nombre_ensamblador text,
  cabezas_conformes integer,
  cabezas_no_conformes integer,
  total_cabezas integer,
  fecha_registro date,          -- columna FECHA del Excel (etapa sin confirmar)
  semana integer,
  marca_registro time,          -- TIEMPO interpretado como hora del día; JAMÁS una duración
  tiempo_crudo text,
  tipo_bandeja text,
  ocupacion numeric,
  cantidades_validas boolean not null default false,
  advertencias text[] not null default '{}',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz,
  actualizado_por uuid references public.perfiles (id)
);

comment on column public.eventos.clave is
  'Identidad del evento. TIEMPO/FECHA quedan fuera a propósito: una hora corregida genera CONFLICTO visible, no un evento nuevo silencioso. N° BANDEJA solo es un componente (las bandejas físicas se reutilizan).';

create index idx_eventos_clave on public.eventos (clave);
create index idx_eventos_lote on public.eventos (lote_id);
create index idx_eventos_estado on public.eventos (estado);
create index idx_eventos_fprod on public.eventos (fecha_produccion);
create index idx_eventos_fcargue on public.eventos (fecha_cargue);
create index idx_eventos_freg on public.eventos (fecha_registro);
create index idx_eventos_pasmador on public.eventos (codigo_pasmador);
create index idx_eventos_ensamblador on public.eventos (codigo_ensamblador);
create index idx_eventos_finca on public.eventos (finca);
create index idx_eventos_variedad on public.eventos (variedad);

-- Respaldo contra condiciones de carrera: dos importaciones simultáneas
-- no pueden insertar dos veces el mismo contenido vigente.
create unique index uq_eventos_vigente_contenido
  on public.eventos (clave, huella)
  where estado in ('activo', 'conflicto');

-- ----------------------------------------------------------------
-- 4) REVISIONES (historial de correcciones y reversiones)
-- ----------------------------------------------------------------
create table public.revisiones (
  id bigint generated always as identity primary key,
  evento_id bigint references public.eventos (id),
  horas_id bigint,
  datos_anteriores jsonb not null,
  accion text not null check (accion in ('resolucion_conflicto', 'correccion_horas', 'reversion_lote')),
  realizado_por uuid references public.perfiles (id),
  realizado_en timestamptz not null default now(),
  lote_id uuid references public.lotes (id),
  motivo text
);

comment on table public.revisiones is
  'Toda corrección conserva el valor anterior, su autor y su motivo. Anular un lote usa estas filas para revertir sus correcciones.';

create index idx_revisiones_evento on public.revisiones (evento_id);
create index idx_revisiones_lote on public.revisiones (lote_id);

-- ----------------------------------------------------------------
-- 5) HORAS-PERSONA VALIDADAS (opcional; sin esto la productividad
--    se muestra como "No calculable con los datos actuales")
-- ----------------------------------------------------------------
create table public.horas_persona (
  id bigint generated always as identity primary key,
  fecha date not null,
  codigo_operario text not null,
  rol text not null check (rol in ('pasmador', 'ensamblador')),
  horas numeric(5, 2) not null check (horas > 0 and horas <= 24),
  fuente text not null,
  lote_id uuid references public.lotes (id),
  creado_por uuid references public.perfiles (id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz,
  actualizado_por uuid references public.perfiles (id),
  unique (fecha, codigo_operario, rol)
);

comment on table public.horas_persona is
  'Horas netas por persona/fecha/rol, tomadas de una fuente EXISTENTE y validada (no se impone bitácora nueva a los operarios).';

create index idx_horas_fecha on public.horas_persona (fecha);

-- ----------------------------------------------------------------
-- 6) CATÁLOGO DE OPERARIOS Y CONFIGURACIÓN
-- ----------------------------------------------------------------
create table public.operarios (
  codigo text not null,
  rol text not null check (rol in ('pasmador', 'ensamblador')),
  nombre_oficial text not null,
  activo boolean not null default true,
  actualizado_por uuid references public.perfiles (id),
  actualizado_en timestamptz not null default now(),
  primary key (codigo, rol)
);

comment on table public.operarios is
  'Nombre oficial por código y rol, confirmado por el responsable. La aplicación NUNCA elige un nombre por frecuencia.';

create table public.config (
  clave text primary key,
  valor jsonb not null,
  actualizado_por uuid references public.perfiles (id),
  actualizado_en timestamptz not null default now()
);

insert into public.config (clave, valor) values
  ('etapa_marca', '{"confirmada": false, "etapa": null, "nota": null}'),
  ('turnos', '{"definidos": false, "lista": []}'),
  ('metas', '{"definidas": false}'),
  ('zona_horaria', '{"valor": "America/Bogota"}')
on conflict (clave) do nothing;

-- ----------------------------------------------------------------
-- 7) VISTA DE EVENTOS VÁLIDOS
--    (solo eventos activos de lotes confirmados; es lo único que
--    cuentan los indicadores y el detalle)
-- ----------------------------------------------------------------
create or replace view public.v_eventos
with (security_invoker = true) as
select
  e.id, e.fecha_produccion, e.numero_produccion, e.liquido, e.fecha_cargue,
  e.posicion, e.tanque, e.finca, e.codigo_pasmador, e.nombre_pasmador,
  e.variedad, e.numero_bandeja, e.codigo_ensamblador, e.nombre_ensamblador,
  e.cabezas_conformes, e.cabezas_no_conformes, e.total_cabezas,
  e.fecha_registro, e.semana, e.marca_registro, e.tiempo_crudo,
  e.tipo_bandeja, e.ocupacion, e.cantidades_validas, e.advertencias,
  e.repeticion_confirmada, e.lote_id, e.fila_origen
from public.eventos e
join public.lotes l on l.id = e.lote_id
where e.estado = 'activo'
  and l.estado = 'confirmado';

-- ----------------------------------------------------------------
-- Utilitarios internos
-- ----------------------------------------------------------------
create or replace function public.fn_jsonb_a_texto_arr(j jsonb)
returns text[]
language sql immutable
as $$
  select coalesce(array_agg(x), '{}'::text[])
  from jsonb_array_elements_text(coalesce(j, '[]'::jsonb)) as t (x);
$$;

-- Instantánea completa de un evento (para el historial de revisiones).
create or replace function public.fn_snapshot_evento(p_id bigint)
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'huella', e.huella,
    'crudo', e.crudo,
    'fila_origen', e.fila_origen,
    'cantidades_validas', e.cantidades_validas,
    'advertencias', to_jsonb(e.advertencias),
    'n', jsonb_build_object(
      'fecha_produccion', e.fecha_produccion,
      'numero_produccion', e.numero_produccion,
      'liquido', e.liquido,
      'fecha_cargue', e.fecha_cargue,
      'posicion', e.posicion,
      'tanque', e.tanque,
      'finca', e.finca,
      'codigo_pasmador', e.codigo_pasmador,
      'nombre_pasmador', e.nombre_pasmador,
      'variedad', e.variedad,
      'numero_bandeja', e.numero_bandeja,
      'codigo_ensamblador', e.codigo_ensamblador,
      'nombre_ensamblador', e.nombre_ensamblador,
      'cabezas_conformes', e.cabezas_conformes,
      'cabezas_no_conformes', e.cabezas_no_conformes,
      'total_cabezas', e.total_cabezas,
      'fecha_registro', e.fecha_registro,
      'semana', e.semana,
      'marca_registro', e.marca_registro,
      'tiempo_crudo', e.tiempo_crudo,
      'tipo_bandeja', e.tipo_bandeja,
      'ocupacion', e.ocupacion
    )
  )
  from public.eventos e
  where e.id = p_id;
$$;

-- Restaura sobre un evento los valores guardados en una instantánea.
create or replace function public.fn_aplicar_snapshot(p_id bigint, s jsonb)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  update public.eventos set
    huella = s ->> 'huella',
    crudo = s -> 'crudo',
    fila_origen = (s ->> 'fila_origen')::integer,
    cantidades_validas = coalesce((s ->> 'cantidades_validas')::boolean, false),
    advertencias = public.fn_jsonb_a_texto_arr(s -> 'advertencias'),
    fecha_produccion = (s -> 'n' ->> 'fecha_produccion')::date,
    numero_produccion = s -> 'n' ->> 'numero_produccion',
    liquido = s -> 'n' ->> 'liquido',
    fecha_cargue = (s -> 'n' ->> 'fecha_cargue')::date,
    posicion = s -> 'n' ->> 'posicion',
    tanque = s -> 'n' ->> 'tanque',
    finca = s -> 'n' ->> 'finca',
    codigo_pasmador = s -> 'n' ->> 'codigo_pasmador',
    nombre_pasmador = s -> 'n' ->> 'nombre_pasmador',
    variedad = s -> 'n' ->> 'variedad',
    numero_bandeja = s -> 'n' ->> 'numero_bandeja',
    codigo_ensamblador = s -> 'n' ->> 'codigo_ensamblador',
    nombre_ensamblador = s -> 'n' ->> 'nombre_ensamblador',
    cabezas_conformes = (s -> 'n' ->> 'cabezas_conformes')::integer,
    cabezas_no_conformes = (s -> 'n' ->> 'cabezas_no_conformes')::integer,
    total_cabezas = (s -> 'n' ->> 'total_cabezas')::integer,
    fecha_registro = (s -> 'n' ->> 'fecha_registro')::date,
    semana = (s -> 'n' ->> 'semana')::integer,
    marca_registro = (s -> 'n' ->> 'marca_registro')::time,
    tiempo_crudo = s -> 'n' ->> 'tiempo_crudo',
    tipo_bandeja = s -> 'n' ->> 'tipo_bandeja',
    ocupacion = (s -> 'n' ->> 'ocupacion')::numeric,
    actualizado_en = now(),
    actualizado_por = auth.uid()
  where id = p_id;
end;
$$;

-- ----------------------------------------------------------------
-- 8) FUNCIONES DE IMPORTACIÓN
-- ----------------------------------------------------------------

create or replace function public.fn_crear_lote(
  p_origen text,
  p_nombre text,
  p_filas_recibidas integer,
  p_rechazadas_cliente integer
)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.fn_es_editor() then
    raise exception 'Sin permiso: solo analistas o administradores pueden importar';
  end if;
  if p_origen not in ('pegado', 'archivo') then
    raise exception 'Origen inválido';
  end if;
  insert into public.lotes (creado_por, origen, nombre_origen, filas_recibidas, rechazadas_cliente)
  values (auth.uid(), p_origen, p_nombre, coalesce(p_filas_recibidas, 0), coalesce(p_rechazadas_cliente, 0))
  returning id into v_id;
  return v_id;
end;
$$;

-- Clasificación previa (solo lectura). Nota: los duplicados internos del
-- propio pegado los descuenta el cliente antes de llamar a esta función.
create or replace function public.fn_clasificar(p_filas jsonb)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  fila jsonb;
  v_nuevas integer := 0;
  v_dupes integer := 0;
  v_confl integer := 0;
begin
  if not public.fn_es_editor() then
    raise exception 'Sin permiso: solo analistas o administradores pueden importar';
  end if;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) > 2000 then
    raise exception 'Formato de filas inválido (máximo 2000 por llamada)';
  end if;
  for fila in select * from jsonb_array_elements(p_filas) loop
    if exists (
      select 1 from public.eventos
      where clave = fila ->> 'c' and huella = fila ->> 'h' and estado in ('activo', 'conflicto')
    ) then
      v_dupes := v_dupes + 1;
    elsif exists (
      select 1 from public.eventos
      where clave = fila ->> 'c' and estado = 'activo'
    ) then
      v_confl := v_confl + 1;
    else
      v_nuevas := v_nuevas + 1;
    end if;
  end loop;
  return jsonb_build_object('nuevas', v_nuevas, 'duplicadas', v_dupes, 'conflictos', v_confl);
end;
$$;

create or replace function public.fn_importar(p_lote uuid, p_filas jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_lote public.lotes%rowtype;
  fila jsonb;
  v_clave text;
  v_huella text;
  v_dup bigint;
  v_act bigint;
  v_nuevas integer := 0;
  v_dupes integer := 0;
  v_confl integer := 0;
  v_errores jsonb := '[]'::jsonb;
begin
  if not public.fn_es_editor() then
    raise exception 'Sin permiso: solo analistas o administradores pueden importar';
  end if;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) > 2000 then
    raise exception 'Formato de filas inválido (máximo 2000 por llamada)';
  end if;

  select * into v_lote from public.lotes where id = p_lote for update;
  if not found then
    raise exception 'Lote no encontrado';
  end if;
  if v_lote.estado <> 'pendiente' then
    raise exception 'El lote ya no está pendiente (estado: %)', v_lote.estado;
  end if;
  if v_lote.creado_por <> auth.uid() and not public.fn_es_admin() then
    raise exception 'Solo quien creó el lote (o un administrador) puede continuarlo';
  end if;

  for fila in select * from jsonb_array_elements(p_filas) loop
    begin
      v_clave := fila ->> 'c';
      v_huella := fila ->> 'h';
      if v_clave is null or v_huella is null then
        raise exception 'Fila sin clave o sin huella';
      end if;

      -- Serializa por clave: dos importaciones concurrentes de la misma
      -- fila no pueden duplicarla.
      perform pg_advisory_xact_lock(hashtextextended(v_clave, 42));

      select id into v_dup
      from public.eventos
      where clave = v_clave and huella = v_huella and estado in ('activo', 'conflicto')
      limit 1;

      if v_dup is not null then
        v_dupes := v_dupes + 1;
        continue;
      end if;

      select id into v_act
      from public.eventos
      where clave = v_clave and estado = 'activo'
      order by id
      limit 1;

      insert into public.eventos (
        clave, huella, lote_id, fila_origen, estado, conflicto_con, crudo,
        fecha_produccion, numero_produccion, liquido, fecha_cargue, posicion,
        tanque, finca, codigo_pasmador, nombre_pasmador, variedad,
        numero_bandeja, codigo_ensamblador, nombre_ensamblador,
        cabezas_conformes, cabezas_no_conformes, total_cabezas,
        fecha_registro, semana, marca_registro, tiempo_crudo, tipo_bandeja,
        ocupacion, cantidades_validas, advertencias
      ) values (
        v_clave,
        v_huella,
        p_lote,
        (fila ->> 'f')::integer,
        case when v_act is null then 'activo' else 'conflicto' end,
        v_act,
        coalesce(fila -> 'crudo', '[]'::jsonb),
        (fila -> 'n' ->> 'fecha_produccion')::date,
        fila -> 'n' ->> 'numero_produccion',
        fila -> 'n' ->> 'liquido',
        (fila -> 'n' ->> 'fecha_cargue')::date,
        fila -> 'n' ->> 'posicion',
        fila -> 'n' ->> 'tanque',
        fila -> 'n' ->> 'finca',
        fila -> 'n' ->> 'codigo_pasmador',
        fila -> 'n' ->> 'nombre_pasmador',
        fila -> 'n' ->> 'variedad',
        fila -> 'n' ->> 'numero_bandeja',
        fila -> 'n' ->> 'codigo_ensamblador',
        fila -> 'n' ->> 'nombre_ensamblador',
        (fila -> 'n' ->> 'cabezas_conformes')::integer,
        (fila -> 'n' ->> 'cabezas_no_conformes')::integer,
        (fila -> 'n' ->> 'total_cabezas')::integer,
        (fila -> 'n' ->> 'fecha_registro')::date,
        (fila -> 'n' ->> 'semana')::integer,
        (fila -> 'n' ->> 'marca_registro')::time,
        fila -> 'n' ->> 'tiempo_crudo',
        fila -> 'n' ->> 'tipo_bandeja',
        (fila -> 'n' ->> 'ocupacion')::numeric,
        coalesce((fila ->> 'cv')::boolean, false),
        public.fn_jsonb_a_texto_arr(fila -> 'adv')
      );

      if v_act is null then
        v_nuevas := v_nuevas + 1;
      else
        v_confl := v_confl + 1;
      end if;
    exception
      when others then
        v_errores := v_errores || jsonb_build_object(
          'fila', coalesce((fila ->> 'f')::integer, -1),
          'error', sqlerrm
        );
    end;
  end loop;

  update public.lotes
  set nuevas = nuevas + v_nuevas,
      duplicadas = duplicadas + v_dupes,
      conflictos = conflictos + v_confl,
      errores = errores + jsonb_array_length(v_errores)
  where id = p_lote;

  return jsonb_build_object(
    'nuevas', v_nuevas,
    'duplicadas', v_dupes,
    'conflictos', v_confl,
    'errores', case when jsonb_array_length(v_errores) = 0 then null else v_errores end
  );
end;
$$;

create or replace function public.fn_confirmar_lote(p_lote uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_lote public.lotes%rowtype;
begin
  if not public.fn_es_editor() then
    raise exception 'Sin permiso';
  end if;
  select * into v_lote from public.lotes where id = p_lote for update;
  if not found then
    raise exception 'Lote no encontrado';
  end if;
  if v_lote.estado <> 'pendiente' then
    raise exception 'El lote no está pendiente';
  end if;
  if v_lote.creado_por <> auth.uid() and not public.fn_es_admin() then
    raise exception 'Solo quien creó el lote (o un administrador) puede confirmarlo';
  end if;
  update public.lotes
  set estado = 'confirmado', confirmado_en = now()
  where id = p_lote;
end;
$$;

create or replace function public.fn_descartar_lote(p_lote uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_lote public.lotes%rowtype;
begin
  if not public.fn_es_editor() then
    raise exception 'Sin permiso';
  end if;
  select * into v_lote from public.lotes where id = p_lote for update;
  if not found then
    raise exception 'Lote no encontrado';
  end if;
  if v_lote.estado <> 'pendiente' then
    raise exception 'Solo se descartan lotes pendientes; para un lote confirmado use Anular';
  end if;
  if v_lote.creado_por <> auth.uid() and not public.fn_es_admin() then
    raise exception 'Solo quien creó el lote (o un administrador) puede descartarlo';
  end if;
  -- Las filas de un lote pendiente nunca se publicaron: se retiran.
  delete from public.eventos where lote_id = p_lote;
  update public.lotes set estado = 'descartado' where id = p_lote;
end;
$$;

create or replace function public.fn_anular_lote(p_lote uuid, p_motivo text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_lote public.lotes%rowtype;
  r record;
  v_snap jsonb;
begin
  if not public.fn_es_editor() then
    raise exception 'Sin permiso';
  end if;
  if p_motivo is null or length(trim(p_motivo)) < 5 then
    raise exception 'Debe indicar un motivo (mínimo 5 caracteres)';
  end if;
  select * into v_lote from public.lotes where id = p_lote for update;
  if not found then
    raise exception 'Lote no encontrado';
  end if;
  if v_lote.estado <> 'confirmado' then
    raise exception 'Solo se anulan lotes confirmados';
  end if;

  -- 1) Revertir las correcciones que este lote aplicó sobre eventos de
  --    OTROS lotes (quedó constancia en revisiones).
  for r in
    select *
    from public.revisiones
    where lote_id = p_lote
      and accion = 'resolucion_conflicto'
      and evento_id is not null
    order by id desc
  loop
    select public.fn_snapshot_evento(r.evento_id) into v_snap;
    if v_snap is not null then
      perform public.fn_aplicar_snapshot(r.evento_id, r.datos_anteriores);
      insert into public.revisiones (evento_id, datos_anteriores, accion, realizado_por, lote_id, motivo)
      values (r.evento_id, v_snap, 'reversion_lote', auth.uid(), p_lote,
              'Reversión automática por anulación del lote: ' || p_motivo);
    end if;
  end loop;

  -- 2) Excluir los eventos que ESTE lote insertó (sin tocar los de otros lotes).
  update public.eventos
  set estado = 'anulado', actualizado_en = now(), actualizado_por = auth.uid()
  where lote_id = p_lote and estado = 'activo';

  update public.eventos
  set estado = 'descartado', actualizado_en = now(), actualizado_por = auth.uid()
  where lote_id = p_lote and estado = 'conflicto';

  -- 3) Si es un lote de horas, retirar sus horas (con constancia).
  if v_lote.origen = 'horas' then
    for r in select * from public.horas_persona where lote_id = p_lote loop
      insert into public.revisiones (horas_id, datos_anteriores, accion, realizado_por, lote_id, motivo)
      values (r.id, to_jsonb(r), 'reversion_lote', auth.uid(), p_lote, 'Anulación del lote de horas: ' || p_motivo);
      delete from public.horas_persona where id = r.id;
    end loop;
  end if;

  update public.lotes
  set estado = 'anulado', anulado_en = now(), anulado_por = auth.uid(), motivo_anulacion = trim(p_motivo)
  where id = p_lote;
end;
$$;

create or replace function public.fn_resolver_conflicto(
  p_evento bigint,
  p_decision text,
  p_motivo text
)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_conf public.eventos%rowtype;
  v_act bigint;
  v_snap jsonb;
begin
  if not public.fn_es_editor() then
    raise exception 'Sin permiso';
  end if;
  if p_decision not in ('mantener_existente', 'aplicar_nuevo', 'evento_independiente') then
    raise exception 'Decisión inválida';
  end if;

  select * into v_conf from public.eventos where id = p_evento for update;
  if not found or v_conf.estado <> 'conflicto' then
    raise exception 'El registro no es un conflicto pendiente';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_conf.clave, 42));

  if p_decision = 'mantener_existente' then
    update public.eventos
    set estado = 'descartado', actualizado_en = now(), actualizado_por = auth.uid()
    where id = p_evento;
    return;
  end if;

  if p_decision = 'evento_independiente' then
    -- El responsable confirma que son DOS eventos reales distintos.
    update public.eventos
    set estado = 'activo', repeticion_confirmada = true,
        actualizado_en = now(), actualizado_por = auth.uid()
    where id = p_evento;
    return;
  end if;

  -- aplicar_nuevo: corrección explícita conservando el valor anterior.
  select id into v_act
  from public.eventos
  where clave = v_conf.clave and estado = 'activo'
  order by id
  limit 1
  for update;

  if v_act is null then
    -- El evento original ya no está activo: el nuevo pasa a ser el vigente.
    update public.eventos
    set estado = 'activo', actualizado_en = now(), actualizado_por = auth.uid()
    where id = p_evento;
    return;
  end if;

  select public.fn_snapshot_evento(v_act) into v_snap;
  insert into public.revisiones (evento_id, datos_anteriores, accion, realizado_por, lote_id, motivo)
  values (v_act, v_snap, 'resolucion_conflicto', auth.uid(), v_conf.lote_id, coalesce(p_motivo, 'Corrección aplicada'));

  perform public.fn_aplicar_snapshot(v_act, public.fn_snapshot_evento(p_evento));

  update public.eventos
  set estado = 'descartado', actualizado_en = now(), actualizado_por = auth.uid()
  where id = p_evento;
end;
$$;

create or replace function public.fn_importar_horas(p_filas jsonb, p_nota text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  fila jsonb;
  v_lote uuid;
  v_fecha date;
  v_codigo text;
  v_rol text;
  v_horas numeric;
  v_exist public.horas_persona%rowtype;
  v_ins integer := 0;
  v_act integer := 0;
  v_errores jsonb := '[]'::jsonb;
  v_i integer := 0;
begin
  if not public.fn_es_editor() then
    raise exception 'Sin permiso';
  end if;
  if p_nota is null or length(trim(p_nota)) < 5 then
    raise exception 'Debe indicar la fuente validada de las horas';
  end if;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) > 5000 then
    raise exception 'Formato de filas inválido (máximo 5000)';
  end if;

  insert into public.lotes (creado_por, origen, nombre_origen, estado, filas_recibidas, confirmado_en)
  values (auth.uid(), 'horas', left(trim(p_nota), 200), 'confirmado', jsonb_array_length(p_filas), now())
  returning id into v_lote;

  for fila in select * from jsonb_array_elements(p_filas) loop
    v_i := v_i + 1;
    begin
      v_fecha := (fila ->> 'fecha')::date;
      v_codigo := upper(trim(fila ->> 'codigo'));
      v_rol := fila ->> 'rol';
      v_horas := (fila ->> 'horas')::numeric;
      if v_fecha is null or v_codigo is null or v_codigo = '' then
        raise exception 'Fecha o código inválidos';
      end if;

      select * into v_exist
      from public.horas_persona
      where fecha = v_fecha and codigo_operario = v_codigo and rol = v_rol
      for update;

      if found then
        if v_exist.horas = v_horas then
          continue;
        end if;
        insert into public.revisiones (horas_id, datos_anteriores, accion, realizado_por, lote_id, motivo)
        values (v_exist.id, to_jsonb(v_exist), 'correccion_horas', auth.uid(), v_lote, trim(p_nota));
        update public.horas_persona
        set horas = v_horas, fuente = trim(p_nota), lote_id = v_lote,
            actualizado_en = now(), actualizado_por = auth.uid()
        where id = v_exist.id;
        v_act := v_act + 1;
      else
        insert into public.horas_persona (fecha, codigo_operario, rol, horas, fuente, lote_id, creado_por)
        values (v_fecha, v_codigo, v_rol, v_horas, trim(p_nota), v_lote, auth.uid());
        v_ins := v_ins + 1;
      end if;
    exception
      when others then
        v_errores := v_errores || jsonb_build_object('fila', v_i, 'error', sqlerrm);
    end;
  end loop;

  update public.lotes set nuevas = v_ins, duplicadas = v_act, errores = jsonb_array_length(v_errores)
  where id = v_lote;

  return jsonb_build_object(
    'insertadas', v_ins,
    'actualizadas', v_act,
    'errores', case when jsonb_array_length(v_errores) = 0 then '[]'::jsonb else v_errores end
  );
end;
$$;

-- ----------------------------------------------------------------
-- 9) CONFIGURACIÓN Y CATÁLOGOS (escritura)
-- ----------------------------------------------------------------
create or replace function public.fn_guardar_config(p_clave text, p_valor jsonb)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.fn_es_admin() then
    raise exception 'Solo el administrador puede cambiar la configuración';
  end if;
  if p_clave not in ('etapa_marca', 'turnos', 'metas', 'zona_horaria') then
    raise exception 'Clave de configuración desconocida';
  end if;
  insert into public.config (clave, valor, actualizado_por, actualizado_en)
  values (p_clave, p_valor, auth.uid(), now())
  on conflict (clave)
  do update set valor = excluded.valor, actualizado_por = excluded.actualizado_por, actualizado_en = now();
end;
$$;

create or replace function public.fn_guardar_operario(
  p_codigo text,
  p_rol text,
  p_nombre text,
  p_activo boolean
)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.fn_es_editor() then
    raise exception 'Sin permiso';
  end if;
  if p_codigo is null or trim(p_codigo) = '' or p_nombre is null or trim(p_nombre) = '' then
    raise exception 'Código y nombre son obligatorios';
  end if;
  insert into public.operarios (codigo, rol, nombre_oficial, activo, actualizado_por, actualizado_en)
  values (upper(trim(p_codigo)), p_rol, trim(p_nombre), coalesce(p_activo, true), auth.uid(), now())
  on conflict (codigo, rol)
  do update set nombre_oficial = excluded.nombre_oficial, activo = excluded.activo,
                actualizado_por = excluded.actualizado_por, actualizado_en = now();
end;
$$;

create or replace function public.fn_operarios_catalogo()
returns table (codigo text, rol text, nombre_oficial text, activo boolean)
language sql stable
set search_path = public, pg_temp
as $$
  select codigo, rol, nombre_oficial, activo
  from public.operarios
  order by rol, codigo;
$$;

-- ----------------------------------------------------------------
-- 10) FUNCIONES DE CONSULTA Y AGREGACIÓN
--     Todas calculan sobre TODAS las filas filtradas en la base.
-- ----------------------------------------------------------------

create or replace function public.fn_filtros()
returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'fincas', (select coalesce(jsonb_agg(x order by x), '[]'::jsonb)
               from (select distinct finca as x from public.v_eventos where finca is not null) t),
    'variedades', (select coalesce(jsonb_agg(x order by x), '[]'::jsonb)
                   from (select distinct variedad as x from public.v_eventos where variedad is not null) t),
    'tanques', (select coalesce(jsonb_agg(x order by x), '[]'::jsonb)
                from (select distinct tanque as x from public.v_eventos where tanque is not null) t),
    'liquidos', (select coalesce(jsonb_agg(x order by x), '[]'::jsonb)
                 from (select distinct liquido as x from public.v_eventos where liquido is not null) t),
    'tipos_bandeja', (select coalesce(jsonb_agg(x order by x), '[]'::jsonb)
                      from (select distinct tipo_bandeja as x from public.v_eventos where tipo_bandeja is not null) t),
    'pasmadores', (select coalesce(jsonb_agg(jsonb_build_object('codigo', c, 'nombre', n) order by c), '[]'::jsonb)
                   from (select distinct e.codigo_pasmador as c, o.nombre_oficial as n
                         from public.v_eventos e
                         left join public.operarios o on o.codigo = e.codigo_pasmador and o.rol = 'pasmador'
                         where e.codigo_pasmador is not null) t),
    'ensambladores', (select coalesce(jsonb_agg(jsonb_build_object('codigo', c, 'nombre', n) order by c), '[]'::jsonb)
                      from (select distinct e.codigo_ensamblador as c, o.nombre_oficial as n
                            from public.v_eventos e
                            left join public.operarios o on o.codigo = e.codigo_ensamblador and o.rol = 'ensamblador'
                            where e.codigo_ensamblador is not null) t),
    'fechas', jsonb_build_object(
      'produccion', (select jsonb_build_object('min', min(fecha_produccion), 'max', max(fecha_produccion)) from public.v_eventos),
      'cargue', (select jsonb_build_object('min', min(fecha_cargue), 'max', max(fecha_cargue)) from public.v_eventos),
      'registro', (select jsonb_build_object('min', min(fecha_registro), 'max', max(fecha_registro)) from public.v_eventos)
    ),
    'turnos', coalesce((select valor from public.config where clave = 'turnos'), '{"definidos": false, "lista": []}'::jsonb),
    'etapa_marca', coalesce((select valor from public.config where clave = 'etapa_marca'), '{"confirmada": false, "etapa": null, "nota": null}'::jsonb)
  );
$$;

create or replace function public.fn_resumen(p jsonb)
returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  with base as (
    select e.*,
      case coalesce(p ->> 'tipo_fecha', 'produccion')
        when 'cargue' then e.fecha_cargue
        when 'registro' then e.fecha_registro
        else e.fecha_produccion
      end as fecha_base,
      case coalesce(p ->> 'rol', 'ensamblador')
        when 'pasmador' then e.codigo_pasmador
        else e.codigo_ensamblador
      end as codigo_rol
    from public.v_eventos e
    where (p ->> 'finca' is null or e.finca = p ->> 'finca')
      and (p ->> 'variedad' is null or e.variedad = p ->> 'variedad')
      and (p ->> 'tanque' is null or e.tanque = p ->> 'tanque')
      and (p ->> 'liquido' is null or e.liquido = p ->> 'liquido')
      and (p ->> 'tipo_bandeja' is null or e.tipo_bandeja = p ->> 'tipo_bandeja')
  ),
  base2 as (
    select * from base
    where (p ->> 'operario' is null or codigo_rol = p ->> 'operario')
  ),
  dentro as (
    select * from base2
    where fecha_base is not null
      and (p ->> 'desde' is null or fecha_base >= (p ->> 'desde')::date)
      and (p ->> 'hasta' is null or fecha_base <= (p ->> 'hasta')::date)
  ),
  agg as (
    select
      count(*)::bigint as bandejas,
      count(distinct numero_bandeja) filter (where numero_bandeja is not null) as bandejas_fisicas,
      count(*) filter (where numero_bandeja is null) as eventos_sin_bandeja,
      coalesce(sum(cabezas_conformes) filter (where cantidades_validas), 0) as conformes,
      coalesce(sum(cabezas_no_conformes) filter (where cantidades_validas), 0) as no_conformes,
      count(distinct fecha_base) as dias,
      count(distinct codigo_rol) filter (where codigo_rol is not null) as operarios,
      count(*) filter (where not cantidades_validas) as cantidades_invalidas
    from dentro
  )
  select jsonb_build_object(
    'bandejas', a.bandejas,
    'bandejas_fisicas', a.bandejas_fisicas,
    'eventos_sin_bandeja', a.eventos_sin_bandeja,
    'conformes', a.conformes,
    'no_conformes', a.no_conformes,
    'cabezas', a.conformes + a.no_conformes,
    'pct_conformidad', case
      when (a.conformes + a.no_conformes) > 0
        then round(a.conformes * 100.0 / (a.conformes + a.no_conformes), 2)
      else null
    end,
    'dias', a.dias,
    'operarios', a.operarios,
    'exclusiones', jsonb_build_object(
      'sin_fecha', (select count(*) from base2 where fecha_base is null),
      'cantidades_invalidas', a.cantidades_invalidas
    )
  )
  from agg a;
$$;

create or replace function public.fn_por_dia(p jsonb)
returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  with base as (
    select e.*,
      case coalesce(p ->> 'tipo_fecha', 'produccion')
        when 'cargue' then e.fecha_cargue
        when 'registro' then e.fecha_registro
        else e.fecha_produccion
      end as fecha_base,
      case coalesce(p ->> 'rol', 'ensamblador')
        when 'pasmador' then e.codigo_pasmador
        else e.codigo_ensamblador
      end as codigo_rol
    from public.v_eventos e
    where (p ->> 'finca' is null or e.finca = p ->> 'finca')
      and (p ->> 'variedad' is null or e.variedad = p ->> 'variedad')
      and (p ->> 'tanque' is null or e.tanque = p ->> 'tanque')
      and (p ->> 'liquido' is null or e.liquido = p ->> 'liquido')
      and (p ->> 'tipo_bandeja' is null or e.tipo_bandeja = p ->> 'tipo_bandeja')
  ),
  dentro as (
    select * from base
    where (p ->> 'operario' is null or codigo_rol = p ->> 'operario')
      and fecha_base is not null
      and (p ->> 'desde' is null or fecha_base >= (p ->> 'desde')::date)
      and (p ->> 'hasta' is null or fecha_base <= (p ->> 'hasta')::date)
  )
  select coalesce(jsonb_agg(fila order by fila ->> 'fecha'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'fecha', fecha_base,
      'bandejas', count(*),
      'conformes', coalesce(sum(cabezas_conformes) filter (where cantidades_validas), 0),
      'no_conformes', coalesce(sum(cabezas_no_conformes) filter (where cantidades_validas), 0)
    ) as fila
    from dentro
    group by fecha_base
  ) t;
$$;

create or replace function public.fn_por_operario(p jsonb)
returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  with base as (
    select e.*,
      case coalesce(p ->> 'tipo_fecha', 'produccion')
        when 'cargue' then e.fecha_cargue
        when 'registro' then e.fecha_registro
        else e.fecha_produccion
      end as fecha_base,
      case coalesce(p ->> 'rol', 'ensamblador')
        when 'pasmador' then e.codigo_pasmador
        else e.codigo_ensamblador
      end as codigo_rol,
      case coalesce(p ->> 'rol', 'ensamblador')
        when 'pasmador' then e.nombre_pasmador
        else e.nombre_ensamblador
      end as nombre_rol
    from public.v_eventos e
    where (p ->> 'finca' is null or e.finca = p ->> 'finca')
      and (p ->> 'variedad' is null or e.variedad = p ->> 'variedad')
      and (p ->> 'tanque' is null or e.tanque = p ->> 'tanque')
      and (p ->> 'liquido' is null or e.liquido = p ->> 'liquido')
      and (p ->> 'tipo_bandeja' is null or e.tipo_bandeja = p ->> 'tipo_bandeja')
  ),
  dentro as (
    select * from base
    where (p ->> 'operario' is null or codigo_rol = p ->> 'operario')
      and codigo_rol is not null
      and fecha_base is not null
      and (p ->> 'desde' is null or fecha_base >= (p ->> 'desde')::date)
      and (p ->> 'hasta' is null or fecha_base <= (p ->> 'hasta')::date)
  )
  select coalesce(jsonb_agg(fila order by (fila ->> 'bandejas')::bigint desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'codigo', d.codigo_rol,
      'nombre_oficial', max(o.nombre_oficial),
      'nombres', (
        select coalesce(jsonb_agg(distinct nombre_rol), '[]'::jsonb)
        from dentro d2
        where d2.codigo_rol = d.codigo_rol and d2.nombre_rol is not null
      ),
      'bandejas', count(*),
      'conformes', coalesce(sum(d.cabezas_conformes) filter (where d.cantidades_validas), 0),
      'no_conformes', coalesce(sum(d.cabezas_no_conformes) filter (where d.cantidades_validas), 0),
      'cabezas', coalesce(sum(d.cabezas_conformes + d.cabezas_no_conformes) filter (where d.cantidades_validas), 0),
      'pct_conformidad', case
        when coalesce(sum(d.cabezas_conformes + d.cabezas_no_conformes) filter (where d.cantidades_validas), 0) > 0
          then round(
            coalesce(sum(d.cabezas_conformes) filter (where d.cantidades_validas), 0) * 100.0
            / sum(d.cabezas_conformes + d.cabezas_no_conformes) filter (where d.cantidades_validas), 2)
        else null
      end,
      'dias', count(distinct d.fecha_base)
    ) as fila
    from dentro d
    left join public.operarios o
      on o.codigo = d.codigo_rol and o.rol = coalesce(p ->> 'rol', 'ensamblador') and o.activo
    group by d.codigo_rol
  ) t;
$$;

create or replace function public.fn_productividad(p jsonb)
returns jsonb
language plpgsql stable
set search_path = public, pg_temp
as $$
declare
  v_rol text := coalesce(p ->> 'rol', 'ensamblador');
  v_resultado jsonb;
  v_total_horas numeric;
begin
  select sum(h.horas) into v_total_horas
  from public.horas_persona h
  where h.rol = v_rol
    and (p ->> 'desde' is null or h.fecha >= (p ->> 'desde')::date)
    and (p ->> 'hasta' is null or h.fecha <= (p ->> 'hasta')::date)
    and (p ->> 'operario' is null or h.codigo_operario = p ->> 'operario');

  if v_total_horas is null or v_total_horas <= 0 then
    return jsonb_build_object(
      'disponible', false,
      'motivo', 'No hay horas-persona registradas para el rol «' || v_rol || '» en el periodo filtrado. Sin un denominador confiable, la productividad no se calcula ni se estima.',
      'general', null,
      'operarios', '[]'::jsonb,
      'exclusiones', null
    );
  end if;

  with base as (
    select e.*,
      case coalesce(p ->> 'tipo_fecha', 'produccion')
        when 'cargue' then e.fecha_cargue
        when 'registro' then e.fecha_registro
        else e.fecha_produccion
      end as fecha_base,
      case v_rol when 'pasmador' then e.codigo_pasmador else e.codigo_ensamblador end as codigo_rol
    from public.v_eventos e
    where (p ->> 'finca' is null or e.finca = p ->> 'finca')
      and (p ->> 'variedad' is null or e.variedad = p ->> 'variedad')
      and (p ->> 'tanque' is null or e.tanque = p ->> 'tanque')
      and (p ->> 'liquido' is null or e.liquido = p ->> 'liquido')
      and (p ->> 'tipo_bandeja' is null or e.tipo_bandeja = p ->> 'tipo_bandeja')
  ),
  dentro as (
    select * from base
    where (p ->> 'operario' is null or codigo_rol = p ->> 'operario')
      and codigo_rol is not null
      and fecha_base is not null
      and (p ->> 'desde' is null or fecha_base >= (p ->> 'desde')::date)
      and (p ->> 'hasta' is null or fecha_base <= (p ->> 'hasta')::date)
  ),
  horas as (
    select h.codigo_operario, h.fecha, h.horas
    from public.horas_persona h
    where h.rol = v_rol
      and (p ->> 'desde' is null or h.fecha >= (p ->> 'desde')::date)
      and (p ->> 'hasta' is null or h.fecha <= (p ->> 'hasta')::date)
      and (p ->> 'operario' is null or h.codigo_operario = p ->> 'operario')
  ),
  -- Producción elegible: solo eventos de operarios y días CON horas
  -- (no se mezcla producción sin horas con el denominador de quienes sí tienen).
  elegibles as (
    select d.*
    from dentro d
    join horas h on h.codigo_operario = d.codigo_rol and h.fecha = d.fecha_base
  ),
  por_operario as (
    select
      h.codigo_operario as codigo,
      sum(h.horas) as horas,
      coalesce(e.bandejas, 0) as bandejas,
      coalesce(e.cabezas, 0) as cabezas
    from horas h
    left join (
      select codigo_rol,
        count(*)::bigint as bandejas,
        coalesce(sum(cabezas_conformes + cabezas_no_conformes) filter (where cantidades_validas), 0) as cabezas
      from elegibles
      group by codigo_rol
    ) e on e.codigo_rol = h.codigo_operario
    group by h.codigo_operario, e.bandejas, e.cabezas
  )
  select jsonb_build_object(
    'disponible', true,
    'motivo', null,
    'general', (
      select jsonb_build_object(
        'bandejas', coalesce(sum(bandejas), 0),
        'cabezas', coalesce(sum(cabezas), 0),
        'horas', coalesce(sum(horas), 0),
        'bandejas_hora', case when coalesce(sum(horas), 0) > 0 then round(coalesce(sum(bandejas), 0) / sum(horas), 2) else null end,
        'cabezas_hora', case when coalesce(sum(horas), 0) > 0 then round(coalesce(sum(cabezas), 0) / sum(horas), 2) else null end
      )
      from por_operario
    ),
    'operarios', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'codigo', po.codigo,
          'nombre', o.nombre_oficial,
          'bandejas', po.bandejas,
          'cabezas', po.cabezas,
          'horas', po.horas,
          'bandejas_hora', case when po.horas > 0 then round(po.bandejas / po.horas, 2) else null end,
          'cabezas_hora', case when po.horas > 0 then round(po.cabezas / po.horas, 2) else null end
        ) order by case when po.horas > 0 then po.bandejas / po.horas else 0 end desc
      ), '[]'::jsonb)
      from por_operario po
      left join public.operarios o on o.codigo = po.codigo and o.rol = v_rol
    ),
    'exclusiones', jsonb_build_object(
      'eventos_sin_horas', (select count(*) from dentro) - (select count(*) from elegibles),
      'registros_horas', (select count(*) from horas)
    )
  )
  into v_resultado;

  return v_resultado;
end;
$$;

create or replace function public.fn_ventana(p jsonb)
returns jsonb
language plpgsql stable
set search_path = public, pg_temp
as $$
declare
  v_etapa jsonb;
  v_rol text := coalesce(p ->> 'rol', 'ensamblador');
  v_filas jsonb;
begin
  select valor into v_etapa from public.config where clave = 'etapa_marca';
  if v_etapa is null or coalesce((v_etapa ->> 'confirmada')::boolean, false) = false then
    return jsonb_build_object(
      'disponible', false,
      'motivo', 'La etapa a la que pertenece la marca horaria (FECHA/TIEMPO) no está confirmada por el responsable. El análisis del archivo encontró marcas arrastradas (HORA=0 con TIEMPO=20:35), así que no se muestran rangos horarios hasta confirmar.',
      'filas', '[]'::jsonb
    );
  end if;

  select coalesce(jsonb_agg(fila order by fila ->> 'fecha' desc, fila ->> 'codigo'), '[]'::jsonb)
  into v_filas
  from (
    select jsonb_build_object(
      'codigo', t.codigo_rol,
      'fecha', t.fecha_registro,
      'primera', to_char(min(t.marca_registro), 'HH24:MI'),
      'ultima', to_char(max(t.marca_registro), 'HH24:MI'),
      'marcas', count(*)
    ) as fila
    from (
      select e.fecha_registro, e.marca_registro,
        case v_rol when 'pasmador' then e.codigo_pasmador else e.codigo_ensamblador end as codigo_rol
      from public.v_eventos e
      where e.marca_registro is not null
        and e.fecha_registro is not null
        and (p ->> 'desde' is null or e.fecha_registro >= (p ->> 'desde')::date)
        and (p ->> 'hasta' is null or e.fecha_registro <= (p ->> 'hasta')::date)
        and (p ->> 'finca' is null or e.finca = p ->> 'finca')
        and (p ->> 'variedad' is null or e.variedad = p ->> 'variedad')
    ) t
    where t.codigo_rol is not null
      and (p ->> 'operario' is null or t.codigo_rol = p ->> 'operario')
    group by t.codigo_rol, t.fecha_registro
    limit 200
  ) filas;

  return jsonb_build_object(
    'disponible', true,
    'motivo', 'Ventana observada entre registros: NO equivale a tiempo trabajado (no considera pausas, asistencia ni inicio/fin reales).',
    'filas', v_filas
  );
end;
$$;

create or replace function public.fn_estado_datos()
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'eventos_activos', (select count(*) from public.v_eventos),
    'conflictos_pendientes', (
      select count(*)
      from public.eventos e
      join public.lotes l on l.id = e.lote_id
      where e.estado = 'conflicto' and l.estado = 'confirmado'
    ),
    'lotes_pendientes', (select count(*) from public.lotes where estado = 'pendiente'),
    'ultima_importacion', (
      select jsonb_build_object(
        'creado_en', l.confirmado_en,
        'nuevas', l.nuevas,
        'duplicadas', l.duplicadas,
        'conflictos', l.conflictos,
        'correo', pe.correo
      )
      from public.lotes l
      left join public.perfiles pe on pe.id = l.creado_por
      where l.estado = 'confirmado' and l.origen in ('pegado', 'archivo')
      order by l.confirmado_en desc
      limit 1
    ),
    'etapa_marca', coalesce(
      (select valor from public.config where clave = 'etapa_marca'),
      '{"confirmada": false, "etapa": null, "nota": null}'::jsonb
    )
  );
$$;

create or replace function public.fn_calidad()
returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'eventos_activos', (select count(*) from public.v_eventos),
    'cantidades_invalidas', (select count(*) from public.v_eventos where not cantidades_validas),
    'sin_bandeja', (select count(*) from public.v_eventos where numero_bandeja is null),
    'advertencias', (
      select coalesce(jsonb_agg(jsonb_build_object('advertencia', adv, 'filas', n) order by n desc), '[]'::jsonb)
      from (
        select adv, count(*) as n
        from (select unnest(advertencias) as adv from public.v_eventos) u
        group by adv
        order by n desc
        limit 40
      ) t
    ),
    'inconsistencias', (
      select coalesce(jsonb_agg(fila order by (fila ->> 'total')::bigint desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'rol', rol,
          'codigo', codigo,
          'total', sum(filas),
          'nombres', jsonb_agg(jsonb_build_object('nombre', nombre, 'filas', filas) order by filas desc)
        ) as fila
        from (
          select 'ensamblador' as rol, codigo_ensamblador as codigo,
                 coalesce(nombre_ensamblador, '') as nombre, count(*) as filas
          from public.v_eventos
          where codigo_ensamblador is not null
          group by codigo_ensamblador, coalesce(nombre_ensamblador, '')
          union all
          select 'pasmador', codigo_pasmador, coalesce(nombre_pasmador, ''), count(*)
          from public.v_eventos
          where codigo_pasmador is not null
          group by codigo_pasmador, coalesce(nombre_pasmador, '')
        ) pares
        group by rol, codigo
        having count(*) > 1
        limit 100
      ) t
    )
  );
$$;

create or replace function public.fn_lotes()
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(fila order by fila ->> 'creado_en' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', l.id,
      'creado_en', l.creado_en,
      'origen', l.origen,
      'nombre_origen', l.nombre_origen,
      'estado', l.estado,
      'filas_recibidas', l.filas_recibidas,
      'nuevas', l.nuevas,
      'duplicadas', l.duplicadas,
      'conflictos', l.conflictos,
      'errores', l.errores,
      'rechazadas_cliente', l.rechazadas_cliente,
      'creador', pe.correo,
      'motivo_anulacion', l.motivo_anulacion
    ) as fila
    from public.lotes l
    left join public.perfiles pe on pe.id = l.creado_por
    order by l.creado_en desc
    limit 200
  ) t;
$$;

-- Campos normalizados de un evento, para comparar conflictos lado a lado.
create or replace function public.fn_evento_n(p_id bigint)
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.fn_snapshot_evento(p_id) -> 'n';
$$;

create or replace function public.fn_conflictos()
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(fila order by (fila -> 'conflicto' ->> 'id')::bigint), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'conflicto', jsonb_build_object(
        'id', c.id,
        'lote_id', c.lote_id,
        'fila_origen', c.fila_origen,
        'creado_en', c.creado_en,
        'n', public.fn_evento_n(c.id),
        'crudo', c.crudo
      ),
      'activo', case
        when a.id is null then null
        else jsonb_build_object(
          'id', a.id,
          'lote_id', a.lote_id,
          'fila_origen', a.fila_origen,
          'creado_en', a.creado_en,
          'n', public.fn_evento_n(a.id),
          'crudo', a.crudo
        )
      end,
      'diferencias', case
        when a.id is null then '["sin registro activo con la misma identidad"]'::jsonb
        else (
          select coalesce(jsonb_agg(k), '[]'::jsonb)
          from jsonb_each_text(public.fn_evento_n(c.id)) as t (k, v)
          where v is distinct from (public.fn_evento_n(a.id) ->> k)
        )
      end
    ) as fila
    from public.eventos c
    join public.lotes l on l.id = c.lote_id and l.estado = 'confirmado'
    left join lateral (
      select a2.id, a2.lote_id, a2.fila_origen, a2.creado_en, a2.crudo
      from public.eventos a2
      where a2.clave = c.clave and a2.estado = 'activo'
      order by a2.id
      limit 1
    ) a on true
    where c.estado = 'conflicto'
    order by c.id
    limit 100
  ) t;
$$;

-- ----------------------------------------------------------------
-- 11) SEGURIDAD: RLS Y PERMISOS REALES
-- ----------------------------------------------------------------
alter table public.perfiles enable row level security;
alter table public.lotes enable row level security;
alter table public.eventos enable row level security;
alter table public.revisiones enable row level security;
alter table public.horas_persona enable row level security;
alter table public.operarios enable row level security;
alter table public.config enable row level security;

-- Perfiles: cada quien ve el suyo; el administrador los ve todos.
-- SOLO el administrador puede modificar (así nadie se asigna un rol mayor).
create policy perfiles_select on public.perfiles
  for select to authenticated
  using (id = auth.uid() or public.fn_es_admin());

create policy perfiles_update on public.perfiles
  for update to authenticated
  using (public.fn_es_admin())
  with check (public.fn_es_admin());

-- Lectura para usuarios autenticados (cualquier rol consulta reportes).
create policy lotes_select on public.lotes for select to authenticated using (true);
create policy eventos_select on public.eventos for select to authenticated using (true);
create policy revisiones_select on public.revisiones for select to authenticated using (true);
create policy horas_select on public.horas_persona for select to authenticated using (true);
create policy operarios_select on public.operarios for select to authenticated using (true);
create policy config_select on public.config for select to authenticated using (true);

-- ESCRITURAS: no existe NINGUNA política de insert/update/delete.
-- Toda escritura pasa por las funciones SECURITY DEFINER de arriba,
-- que verifican el rol real del usuario. Un lector (o un anónimo con
-- la clave publicable) no puede escribir ni llamando a la API directa.

-- El rol anónimo no tiene acceso a nada.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
revoke execute on all functions in schema public from public;

-- Los autenticados leen tablas (filtradas por RLS) y ejecutan funciones
-- (que validan rol internamente).
grant select on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- Primitivas internas: solo las invocan otras funciones del esquema.
-- Nadie puede llamarlas directamente desde la API (evita modificar
-- eventos saltándose el historial de revisiones).
revoke execute on function public.fn_aplicar_snapshot(bigint, jsonb) from authenticated;
revoke execute on function public.fn_snapshot_evento(bigint) from authenticated;
revoke execute on function public.fn_evento_n(bigint) from authenticated;

-- ================================================================
-- FIN DE LA INSTALACIÓN.
--
-- SIGUIENTE PASO (una sola vez): cree su usuario en
-- Authentication → Users → Add user (marque "Auto Confirm User"),
-- y luego ejecute en el SQL Editor (reemplace el correo):
--
--   update public.perfiles set rol = 'admin'
--   where correo = 'su.correo@presh-tech.com';
--
-- Roles disponibles: 'admin' (todo), 'analista' (importa y corrige),
-- 'lector' (solo consulta).
-- ================================================================
