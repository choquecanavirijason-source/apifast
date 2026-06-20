---
name: bc-role-center
description: Crear Role Center estilo Business Central en adminElashes. Home con Cues (tiles KPI), gráficas Recharts, actividades recientes y accesos rápidos. Úsalo para dashboard, página de inicio admin. Slash: /bc-role-center
---

# BC Role Center — adminElashes

Home administrativo con **Cues** (tiles numéricos), gráficas y actividades.

**Referencia:** `src/pages/admin/dashboard/Dashboard`

## Estructura

```tsx
import Layout from "@/components/common/layout";
import { SectionCard, StatCard } from "@/components/common/ui";

<Layout title="Role Center" subtitle="Resumen del día" pageClassName="bg-[#f3f2f1]">
  {/* Cues — fila de KPIs */}
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
    <StatCard label="Tickets hoy" value={42} />
    <StatCard label="En servicio" value={8} />
    ...
  </div>

  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <SectionCard variant="business" title="Actividades recientes">
      {/* lista compacta */}
    </SectionCard>
    <SectionCard variant="business" title="Ingresos semana">
      {/* Recharts */}
    </SectionCard>
  </div>
</Layout>
```

## Cues (tiles BC)

- Compactos, borde `#edebe9`, sin sombras pesadas
- Número grande + etiqueta pequeña `#605e5c`
- Click navega a la sección relacionada
- Usar `StatCard` adaptado o tile custom con tokens Fluent

## Reglas

- Fondo `#f3f2f1`, secciones en `SectionCard variant="business"`
- Densidad media (no p-8 everywhere)
- Gráficas Recharts con colores marca (`#094732`, `#9F8351`)
- Sin gradientes llamativos en tiles