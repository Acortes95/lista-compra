# 🧺 Lista de la Compra Compartida

PWA para gestionar la lista de la compra entre dos personas, en tiempo real.
HTML + CSS + JavaScript "vanilla" (sin frameworks) + Supabase. Sin backend propio.

Funciona instalada desde Safari en iPhone/iPad ("Añadir a pantalla de inicio") y desde
Chrome en Android, además de en escritorio.

---

## 1. Crear el proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) → **New project**.
2. Cuando esté listo, abre **SQL Editor** → pega el contenido completo de
   [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   Esto crea las tablas, las políticas RLS, y activa Realtime.
3. Ve a **Authentication → Providers** y confirma que **Email** está activado.
   Para desarrollo rápido, en **Authentication → Settings** puedes desactivar
   "Confirm email" (así no necesitas revisar el correo al crear la cuenta).
4. Ve a **Project Settings → API** y copia:
   - `Project URL`
   - `anon public` key

> ⚠️ **¿Ya tenías la app funcionando de antes (con `schema.sql` ya ejecutado)?**
> Ejecuta también [`supabase/migration_v2_multigrupo.sql`](supabase/migration_v2_multigrupo.sql)
> en el SQL Editor. Añade la asignación de productos a usuarios, la posibilidad
> de pertenecer a varios grupos, y las funciones para gestionarlos — sin borrar
> nada de lo que ya tenías. Solo hace falta ejecutarlo **una vez**.

---

## 2. Configurar la app

Abre [`js/config.js`](js/config.js) y sustituye los valores:

```js
window.APP_CONFIG = {
  SUPABASE_URL: 'https://TU-PROYECTO.supabase.co',
  SUPABASE_ANON_KEY: 'TU-CLAVE-ANON-PUBLICA'
};
```

La clave `anon` es segura de exponer en el frontend: solo puede hacer lo que
las políticas RLS de `schema.sql` permiten (cada usuario solo ve los datos
de su propio grupo).

---

## 3. Probar en local

No hace falta backend ni build. Basta un servidor estático simple:

```bash
npx serve .
# o
python3 -m http.server 8080
```

Abre `http://localhost:8080`. La primera vez, crea una cuenta, crea un grupo
y copia el **código de invitación** (pantalla Ajustes) para que tu pareja se
una desde su propio dispositivo.

> Nota: el Service Worker (`sw.js`) solo se registra si sirves la app por
> `http://localhost` o `https://` — nunca abriendo `index.html` con `file://`.

---

## 4. Desplegar en Vercel

1. Sube esta carpeta a un repositorio de GitHub.
2. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el repo.
3. Framework preset: **Other** (es un sitio estático, no requiere build command).
4. Deploy.

Vercel te dará una URL `https://tu-app.vercel.app` con HTTPS automático, necesario
para que la PWA sea instalable.

---

## 5. Instalar en iPhone

1. Abre la URL de Vercel en **Safari** (no vale Chrome en iOS para instalar PWAs).
2. Toca el icono de **Compartir** (el cuadrado con la flecha hacia arriba).
3. Selecciona **"Añadir a pantalla de inicio"**.
4. La app aparece con su propio icono y abre a pantalla completa, sin barra de Safari.

En Android, Chrome mostrará automáticamente un banner de "Instalar app", o puedes
hacerlo desde el menú ⋮ → "Añadir a pantalla de inicio".

---

## 6. Cómo funciona la sincronización

- Cada grupo tiene un **código de invitación** único (tabla `groups`).
- `group_members` vincula usuarios a grupos — **un usuario puede pertenecer a
  varios grupos a la vez** (por ejemplo, "Casa" y "Familia").
- Todas las políticas RLS comprueban que `auth.uid()` pertenece al `group_id`
  de la fila que se intenta leer/escribir — un usuario nunca puede ver datos
  de un grupo ajeno, aunque conozca el ID.
- La app se suscribe a un canal de **Supabase Realtime** (`js/realtime.js`)
  sobre las tablas `shopping_list`, `foods`, `categories` y `group_members`,
  filtrado por `group_id`. Cuando alguien del grupo marca algo como comprado,
  añade un miembro, etc., tu pantalla se actualiza sola, sin recargar.

## 6b. Gestión de grupos (pantalla Cuenta)

- **Mis grupos**: lista todos los grupos a los que perteneces, marca cuál es
  el activo (✓), e indica si eres el propietario. Tocar un grupo distinto lo
  convierte en el activo — el dispositivo recuerda tu última elección.
- **+ Añadir grupo**: crear uno nuevo (te conviertes en su propietario) o
  unirte a uno existente con un código de invitación.
- **Grupo actual**: muestra el código de invitación para compartir, el botón
  **👥 Ver miembros** (nombre, email, y quién es el propietario), **Salir de
  este grupo** (cualquier miembro) y **Eliminar este grupo** (solo visible
  para el propietario, con confirmación — borra en cascada todas sus
  categorías, alimentos y productos de la lista).
- Si el propietario abandona un grupo con más gente dentro, la propiedad pasa
  automáticamente al miembro más antiguo. Si era el último, el grupo se
  elimina solo.

## 6c. Asignar productos a una persona

En la lista de la compra, toca el **nombre de cualquier producto** (no los
botones de +/−/✕) para abrir el selector de "Asignar a" con los miembros del
grupo actual, o "Sin asignar" para quitar la asignación. Se ve reflejado
debajo del nombre del producto (`👤 Nombre` o `Sin asignar`) y se sincroniza
en tiempo real para todos.

---

## 7. Estructura del proyecto

```
index.html              Shell de la app (una sola página, varias pantallas)
css/styles.css          Sistema de diseño completo
js/
  config.js              Credenciales de Supabase (rellenar)
  supabaseClient.js       Cliente único de Supabase
  state.js                 Estado en memoria + paleta de categorías
  toast.js                  Notificaciones no intrusivas
  auth.js                    Login / registro / logout
  groupSetup.js               Crear/unirse/cambiar/salir/eliminar grupo
  foods.js                     Catálogo de alimentos (CRUD)
  shopping.js                   Lista de la compra + asignación a usuarios
  realtime.js                    Suscripción a cambios en vivo
  settings.js                     Pantalla Cuenta (perfil + mis grupos + miembros)
  app.js                           Router y arranque
manifest.json            Manifest de la PWA
sw.js                     Service Worker (cachea el shell, no los datos)
icons/                     Iconos generados (gen_icons.py)
supabase/
  schema.sql               Esquema completo (proyecto nuevo)
  migration_v2_multigrupo.sql  Migración incremental (proyecto ya existente)
vercel.json                 Cabeceras para despliegue en Vercel
```

---

## 7b. Actualizar la versión en producción tras cada cambio

Cada vez que subas cambios de `index.html`, `css/styles.css` o cualquier
archivo de `js/`, el navegador de cada móvil puede seguir sirviendo la
versión cacheada anterior (el Service Worker está diseñado para que la app
cargue rápido, incluso sin conexión). Para forzar que se note el cambio:

1. Sube los archivos modificados a GitHub (Vercel despliega solo).
2. En cada móvil: cierra la app del todo (deslizar hacia arriba para
   quitarla de apps recientes) y vuelve a abrirla — a veces hace falta
   repetirlo una segunda vez.
3. Si con eso no basta, reinstálala: mantener pulsado el icono → Eliminar
   app → abrir la URL en Safari → Compartir → "Añadir a pantalla de inicio".

Los números `?v=N` al final de los `<script>`/`<link>` en `index.html`, y el
`CACHE_NAME` en `sw.js`, existen justo para esto — si tú mismo sigues
desarrollando la app, sube ese número cada vez que cambies CSS o JS para
forzar la actualización en todos los dispositivos.

---

## 8. Qué NO incluye (fuera del MVP, según el encargo)

Escáner de códigos de barras, precios, estadísticas, historial avanzado, IA,
notificaciones push, compartir con más de un grupo, tiendas/supermercados,
modo offline avanzado, app nativa (APK/IPA). El Service Worker solo cachea
el "shell" de la app para que abra rápido; los datos siempre vienen en vivo
de Supabase.

---

## 9. Siguientes pasos sugeridos

- Cambiar el `background_color`/`theme_color` del `manifest.json` si prefieres
  modo oscuro real en la barra de estado de iOS.
- Añadir un botón "Copiar código" en Ajustes (hoy se selecciona a mano).
- Si crece el catálogo, añadir un buscador en la pantalla Alimentos.
