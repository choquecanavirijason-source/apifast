---
name: panel-administrativo
description: Índice maestro de skills para adminElashes. Business Central, CRUD, permisos, mapa del proyecto. Úsalo al entrar al repo o cuando no sepas qué skill aplicar. Slash: /panel-administrativo
---

# Panel Administrativo — adminElashes

## Orden de lectura recomendado

1. **`AGENTS.md`** — guía rápida (raíz del proyecto)
2. **`adminelashes-project`** — mapa de carpetas, servicios, permisos, rutas
3. **`ui-ux-ms-business-central`** — reglas visuales BC + migración

## Skills del proyecto (`.agent-skills/`)

| Skill | Slash | Para qué |
|---|---|---|
| `adminelashes-project` | `/adminelashes-project` | Mapa del proyecto, convenciones |
| `ui-ux-ms-business-central` | `/ui-ux-bc` | Reglas maestras BC, tokens Fluent |
| `bc-list-page` | `/bc-list-page` | Tablas / listados |
| `bc-card-page` | `/bc-card-page` | Fichas con FastTabs |
| `bc-role-center` | `/bc-role-center` | Dashboard / home con Cues |

## Skills globales Claude (opcional, en `~/.claude/skills/`)

Si están instaladas, complementan las del proyecto:

| Skill | Comando |
|---|---|
| `business-central-admin` | `/business-central-admin` |
| `admin-panel-pro` | `/admin-panel-pro` |
| `admin-panel-crud` | `/admin-panel-crud` |
| `admin-panel-dashboard` | `/admin-panel-dashboard` |
| `admin-panel-permissions` | `/admin-panel-permissions` |
| `react-structure` | (auto) |

## Referencia CRUD del proyecto

`src/pages/admin/clients/Main.tsx`

## Mejorar interfaz a Business Central

```
/panel-administrativo
/ui-ux-bc

Lee references/bc-migration-checklist.md y migra la pantalla que indique el usuario
siguiendo el patrón de clients/Main.tsx con SectionCard business y command bar.
```

## Stack

Vite 7 · React 19 · TypeScript · Tailwind v4 · Redux · React Router v7 · Tauri