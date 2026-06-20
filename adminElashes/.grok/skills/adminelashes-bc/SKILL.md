---
name: adminelashes-bc
description: Skill proyecto adminElashes para UI estilo Business Central. Lee AGENTS.md y .agent-skills/ antes de modificar pantallas admin. Úsalo al mejorar interfaz, migrar a Dynamics BC, o trabajar en src/pages/admin/. Slash: /adminelashes-bc
---

# adminElashes — Business Central

## Lectura obligatoria

1. `AGENTS.md` (raíz)
2. `.agent-skills/ui-ux-ms-business-central/SKILL.md`
3. `.agent-skills/ui-ux-ms-business-central/references/bc-migration-checklist.md`

## Regla principal

Toda pantalla admin debe usar:
- Fondo `#f3f2f1`
- `SectionCard variant="business"`
- Command bar con `Button secondary/ghost size sm`
- Sin `rounded-xl` ni `shadow-2xl`

## Referencia CRUD

`src/pages/admin/clients/Main.tsx`

## Skills especializadas (en `.agent-skills/`)

- `bc-list-page` — tablas
- `bc-card-page` — fichas
- `bc-role-center` — dashboard
- `adminelashes-project` — mapa del proyecto