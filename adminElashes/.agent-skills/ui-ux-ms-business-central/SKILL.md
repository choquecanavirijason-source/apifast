---
name: ui-ux-ms-business-central
description: Replicar Microsoft Dynamics 365 Business Central en adminElashes. Usa las skills Claude business-central-admin, bc-list-page, bc-card-page y bc-role-center. Tokens Fluent, command bar, FastTabs, Cues, Tell Me. Slash: /ui-ux-bc
---

# UI/UX — Microsoft Business Central (adminElashes)

Este proyecto replica la experiencia de **Dynamics 365 Business Central**. Usa las skills Claude especializadas.

## Skills Claude (usar en este orden)

| Orden | Skill | Para qué |
|---|---|---|
| 1 | `business-central-admin` | Reglas maestras, tokens, anatomía BC |
| 2 | `bc-list-page` | Tablas / listados (80% de pantallas) |
| 3 | `bc-card-page` | Fichas con FastTabs |
| 4 | `bc-role-center` | Home / dashboard con Cues |

Ubicación: `~/.claude/skills/business-central-*/SKILL.md`

## Componentes BC de este proyecto

```
AppSidebar          → Navigation Pane (oscuro)
Header              → Tell Me + contexto sucursal
Layout              → App shell
PageLayout          → Caption + ribbon sticky
SectionCard         → variant="business" (tokens Fluent)
DataTable           → List Page tabla
GenericModal        → fullScreen para Card Page
Button              → Command bar (secondary/ghost sm)
```

## Tokens obligatorios

```
Fondo:     #f3f2f1
Borde:     #edebe9
Texto:     #323130 / #605e5c
Card:      rounded-sm, sombra mínima
Prohibido: rounded-2xl, shadow-2xl, gradientes
```

## Al crear pantalla nueva

1. Elegir tipo BC: List / Card / Role Center / Document
2. Usar `SectionCard variant="business"`
3. Command bar sticky con grupos separados
4. Registrar en `Header` → `APP_SECTIONS` (Tell Me)
5. Registrar en `AppSidebar` con permiso
6. Validar checklist en `business-central-admin`