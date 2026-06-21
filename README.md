# ☕ Barista Log

A local-first **PWA** to track your brew & espresso recipes, log every cup, and
compare how your notes change day to day. Works fully offline; optional cloud
sync for power users.

*[Español abajo ⬇](#-español)*

## Features

- **Home** shows your **latest recipe** by default, plus recent brews.
- **Espresso & Brew** recipes with auto-calculated **ratio**, built-in **brew timer**,
  dose/yield, temperature, time, pressure/pre-infusion or brewer/bloom/pours.
- **History** of every logged brew, filterable by method, with ratings and flavor tags.
- **Compare** two or more sessions side-by-side to see what changed.
- **Beans** and **Water profiles** libraries (reuse origin, roaster, TDS/GH/KH…).
- **Grinder converter** — pivot a grind setting from one grinder to another
  (e.g. Timemore C2 → Mahlkönig X54) through microns, as a *starting point* for
  dialing in at a friend's place. Ships with ~16 popular grinders; add your own.
- **Share** any recipe as a clean **PNG card** (offline, via Web Share/Download).
- **Backup**: export/import all your data as a single **JSON** file.
- **Dark / light / system** theme and **English / Spanish**, °C / °F.
- **Optional Supabase cloud sync** — opt-in in Settings; off by default.

## Tech

React + TypeScript + Vite · Tailwind · Dexie (IndexedDB) · Zustand · react-i18next ·
vite-plugin-pwa · Supabase (optional).

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
npm run preview  # preview the built PWA (test install/offline)
```

## Data & storage

All data lives in your browser (IndexedDB via Dexie); settings in localStorage.
Every record carries `dirty` / `syncedAt` flags so cloud sync can be enabled
later without migration.

### Optional cloud sync (Supabase)

Local-first: every change is written to this device first; the cloud is a
**backup** you can restore on another device. The app never talks to a server
unless you connect one. To enable:

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql)
   in its SQL editor (creates the `sync_records` table + row-level security).
2. In the app: **Settings → Cloud sync**, paste your project **URL** and **anon key**.
3. **Create an account / sign in** (email + password). Each account only sees its
   own rows (enforced by RLS).
4. Syncs automatically after changes and when you come back online; **Sync now**
   forces it. Conflicts resolve last-write-wins by `updatedAt`; deletes propagate
   via tombstones. (Session photos aren't synced yet.)

Brew-method micron ranges are from the
[Honest Coffee Guide grind-size chart](https://honestcoffeeguide.com/coffee-grind-size-chart/).
Grinders whose microns-per-click is a loose estimate (stepless or sparsely
documented) are flagged with an **estimate** badge in the app.

> ⚠️ **Grinder conversion disclaimer:** conversions are estimates pivoted through
> published micron-per-click values. Burr wear, alignment, and conical-vs-flat
> geometry mean results are a *starting point only* — expect to adjust a few
> clicks and taste.

---

## 🇪🇸 Español

App **PWA** local-first para registrar tus recetas de espresso y filtrado,
anotar cada taza y comparar cómo cambian tus notas día a día. Funciona sin
conexión; sincronización en la nube opcional para usuarios avanzados.

### Funciones

- **Inicio** muestra tu **última receta** por defecto y las recientes.
- Recetas de **espresso y filtrado** con **ratio** automático, **temporizador**,
  dosis/salida, temperatura, tiempo, presión/preinfusión o cafetera/pre-humectado/vertidos.
- **Historial** de cada preparación, filtrable por método, con calificación y etiquetas de sabor.
- **Comparar** dos o más preparaciones lado a lado.
- Bibliotecas de **Granos** y **Perfiles de agua** (TDS/GH/KH…).
- **Conversor de molinos** — convierte un ajuste de molienda entre molinos
  (p. ej. Timemore C2 → Mahlkönig X54) a través de micras, como **punto de partida**.
- **Compartir** una receta como **imagen PNG**.
- **Respaldo** de todos tus datos en un archivo **JSON**.
- Tema **claro / oscuro / sistema**, **inglés / español**, °C / °F.
- **Sincronización con Supabase** opcional, desactivada por defecto.

> ⚠️ **Aviso del conversor:** las conversiones son estimaciones basadas en micras
> por clic publicadas. El desgaste de las muelas y la geometría cónica vs. plana
> hacen que el resultado sea solo un **punto de partida**.
