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
- `group_members` vincula usuarios a grupos.
- Todas las políticas RLS comprueban que `auth.uid()` pertenece al `group_id`
  de la fila que se intenta leer/escribir — un usuario nunca puede ver datos
  de un grupo ajeno, aunque conozca el ID.
- La app se suscribe a un canal de **Supabase Realtime** (`js/realtime.js`)
  sobre las tablas `shopping_list`, `foods` y `categories`, filtrado por
  `group_id`. Cuando tu pareja marca algo como comprado, tu pantalla se
  actualiza sola, sin recargar.

---

## 7. Estructura del proyecto

```
index.html              Shell de la app (una sola página, 3 pantallas)
css/styles.css          Sistema de diseño completo
js/
  config.js              Credenciales de Supabase (rellenar)
  supabaseClient.js       Cliente único de Supabase
  state.js                 Estado en memoria + paleta de categorías
  toast.js                  Notificaciones no intrusivas
  auth.js                    Login / registro / logout
  groupSetup.js               Crear grupo / unirse por código
  foods.js                     Catálogo de alimentos (CRUD)
  shopping.js                   Lista de la compra (añadir, cantidades, comprado)
  realtime.js                    Suscripción a cambios en vivo
  settings.js                     Pantalla de ajustes
  app.js                           Router y arranque
manifest.json            Manifest de la PWA
sw.js                     Service Worker (cachea el shell, no los datos)
icons/                     Iconos generados (gen_icons.py)
supabase/schema.sql        Tablas + RLS + funciones RPC
vercel.json                 Cabeceras para despliegue en Vercel
```

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
