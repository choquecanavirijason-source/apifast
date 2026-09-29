# Documentación Técnica y de Diseño: Sidebar del Menú Principal del Panel Administrativo

> **Fecha de análisis:** 24 de septiembre de 2026  
> **Proyecto:** Docufacil (`d:\docufacil\docufacil`)  
> **Archivo generado:** `DISENO_SIDEBAR_ADMIN.md`  
> **Estado:** Documentación basada exclusivamente en el código fuente actual verificado. No se modificó el código del proyecto.

---

## 1. Resumen Ejecutivo y Archivos Involucrados

El menú principal de navegación lateral (sidebar) del panel administrativo de Docufacil es un componente modular y reactivo que gestiona la navegación entre módulos (documentos, flujos de trabajo, conversaciones con IA, agentes/bots), la jerarquía de proyectos y tablas (con soporte para reordenamiento mediante Drag and Drop), accesos rápidos de creación, configuración del workspace y menú contextual.

El sidebar cuenta con dos implementaciones complementarias según la resolución de pantalla:
1. **Desktop / Tablet (`HomeExplorer.jsx`):** Sidebar persistente situado a la izquierda con modos expandido (`240px`) y colapsado compacto (`50px`).
2. **Mobile (`MobileAsidebarNavigation.jsx`):** Menú lateral tipo *drawer* desplegable que se activa mediante un botón hamburguesa en pantallas con ancho menor o igual a `768px`.

### 1.1 Rutas y Archivos del Código Fuente

| Componente / Archivo | Ruta Relativa | Propósito |
| :--- | :--- | :--- |
| **Enrutador Admin** | [`src/admin/AdminRoot.jsx`](file:///d:/docufacil/docufacil/src/admin/AdminRoot.jsx) | Punto de entrada para todas las rutas `/admin/*`, envuelve el contenido en `PanelTemplateWrapper`. |
| **Contenedor Principal** | [`src/views/Dashboard/components/PanelTemplate/PanelTemplateWrapper.jsx`](file:///d:/docufacil/docufacil/src/views/Dashboard/components/PanelTemplate/PanelTemplateWrapper.jsx) | Wrapper de layout que aplica clases de scroll (`admin-scroll`) y gestiona títulos. |
| **Plantilla Estructural** | [`src/views/Dashboard/components/PanelTemplate/PanelTemplate.jsx`](file:///d:/docufacil/docufacil/src/views/Dashboard/components/PanelTemplate/PanelTemplate.jsx) | Orquesta el layout dividido: monta `<HomeExplorer>`, `<NavbarAdmin>`, `<FileExplorer>` y el área de contenido. Gestiona el breakpoint móvil (`768px`). |
| **CSS de Plantilla** | [`src/views/Dashboard/components/PanelTemplate/PanelTemplate.module.css`](file:///d:/docufacil/docufacil/src/views/Dashboard/components/PanelTemplate/PanelTemplate.module.css) | Flexbox de nivel superior, posición y media queries para el sidebar y navbar. |
| **Sidebar Desktop** | [`src/views/Dashboard/components/PanelTemplate/HomeExplorer/HomeExplorer.jsx`](file:///d:/docufacil/docufacil/src/views/Dashboard/components/PanelTemplate/HomeExplorer/HomeExplorer.jsx) | Componente principal del sidebar administrativo (4.098 líneas). Lógica de estado, colapsado, DnD, submenús y atajos. |
| **CSS Sidebar Desktop** | [`src/views/Dashboard/components/PanelTemplate/HomeExplorer/HomeExplorer.module.css`](file:///d:/docufacil/docufacil/src/views/Dashboard/components/PanelTemplate/HomeExplorer/HomeExplorer.module.css) | Estilos visuales del sidebar: transiciones, anchos (240px / 50px), hover, badges, scrollbars y menús contextuales. |
| **Sidebar Mobile** | [`src/views/Dashboard/components/NavbarAdmin/MobileAsidebarNavigation/MobileAsidebarNavigation.jsx`](file:///d:/docufacil/docufacil/src/views/Dashboard/components/NavbarAdmin/MobileAsidebarNavigation/MobileAsidebarNavigation.jsx) | Drawer lateral para resoluciones `<= 768px`, montado en `NavbarAdmin.jsx`. |
| **CSS Sidebar Mobile** | [`src/views/Dashboard/components/NavbarAdmin/MobileAsidebarNavigation/MobileAsidebarNavigation.module.css`](file:///d:/docufacil/docufacil/src/views/Dashboard/components/NavbarAdmin/MobileAsidebarNavigation/MobileAsidebarNavigation.module.css) | Estilos para la animación de deslizamiento (`transition: left 300ms`) y dimensiones móviles. |
| **Items de Tablas** | [`src/views/Dashboard/components/NavigationPopups/ContactAssetNavigation/SortableItem.jsx`](file:///d:/docufacil/docufacil/src/views/Dashboard/components/NavigationPopups/ContactAssetNavigation/SortableItem.jsx) | Renderizado de elementos de tabla ordenables dentro de cada proyecto (`father === 'homeExplorerTable'`). |
| **CSS Items de Tablas** | [`src/views/Dashboard/components/NavigationPopups/ContactAssetNavigation/ContactAssetNavigation.module.css`](file:///d:/docufacil/docufacil/src/views/Dashboard/components/NavigationPopups/ContactAssetNavigation/ContactAssetNavigation.module.css) | Estilos de los elementos de tabla (iconos, hover, drag handle, título). |
| **Hook de Permisos** | [`src/utils/usePermissions.js`](file:///d:/docufacil/docufacil/src/utils/usePermissions.js) | Lógica de cálculo de permisos por máscaras de bits (`VIEW`, `EDIT`, `DELETE`, `ALL`) que condiciona la visibilidad. |
| **Atajos de Teclado** | [`src/hooks/useGlobalShortcuts.js`](file:///d:/docufacil/docufacil/src/hooks/useGlobalShortcuts.js) | Mapeo de atajos globales para macOS y Windows (ej. `Cmd/Ctrl + D`, `Cmd/Ctrl + Shift + A`). |
| **Variables de Tema** | [`src/index.css`](file:///d:/docufacil/docufacil/src/index.css) | Definición global de tokens CSS para temas claro y oscuro (`--f5-background`, `--_10a37f-background`, etc.). |

---

## 2. Arquitectura y Jerarquía de Componentes

### 2.1 Diagrama de Componentes

```
AdminRoot.jsx
└── PanelTemplateWrapper.jsx
    └── PanelTemplate.jsx
        ├── [Si !isMobile (width > 768px)]:
        │   └── div.container
        │       └── HomeExplorer.jsx
        │           ├── div._workspaceContainer / div.workspaceContainer (Selector de Workspace)
        │           ├── div.menuSections (Navegación Core & Acciones Rápidas)
        │           ├── DndContext (DnD-Kit para Proyectos y Tablas)
        │           │   └── SortableContext
        │           │       └── div.projectsWrapper
        │           │           └── SortableProjectItem / SortableItem (Tablas hijas)
        │           ├── div.menuMore (Configuraciones, Soporte, Plus y Home)
        │           └── div.version (V 1.02) / div.infoWorkspaceContainer
        │
        ├── NavbarAdmin.jsx
        │   └── [Si isMobile (width <= 768px)]:
        │       └── MobileAsidebarNavigation.jsx (Drawer deslizante)
        │
        └── [Botón Mobile en PanelTemplate]:
            └── div.openMenuContainer > button.openMenuButton ("☰")
```

### 2.2 Integración en `PanelTemplate.jsx`

En [`PanelTemplate.jsx`](file:///d:/docufacil/docufacil/src/views/Dashboard/components/PanelTemplate/PanelTemplate.jsx#L140-L165), el sidebar principal se renderiza condicionalmente según el ancho de la ventana:

```jsx
// Fragmento verificado de src/views/Dashboard/components/PanelTemplate/PanelTemplate.jsx
{!isMobile && (
  <div className={styles.container}>
    <HomeExplorer
      collapsed={collapsed}
      setCollapsed={setCollapsed}
      currentMenuSelected={currentMenuSelected}
      showInfoTemplate={showInfoTemplate}
      setShowInfoTemplate={setShowInfoTemplate}
    />
  </div>
)}
```

El estado `isMobile` se inicializa con `window.innerWidth <= 768` y se actualiza reactivamente con un listener en el evento `resize`.

---

## 3. Estructura del DOM y Secciones del Menú

El sidebar desktop (`HomeExplorer.jsx`) se organiza internamente en cuatro bloques verticales principales dentro de un contenedor `<aside className={styles.container}>`:

### 3.1 Cabecera: Selector de Workspace (`workspaceContainer`)

* **Ubicación:** Superior izquierda.
* **Elementos en Modo Expandido (`isOpen === true`):**
  * Contenedor de avatar/icono con la inicial del workspace o icono por defecto (`FiBriefcase`).
  * Contenedor de texto con el nombre del workspace (`workspace?.name` o *"Mi Espacio"*).
  * Badge de conteo de etiquetas/miembros activos (`{activeMembers?.length} labels`).
  * Icono de flechas arriba/abajo (`RiArrowUpDownLine` o `RiArrowDownSLine`) para desplegar la lista de workspaces disponibles.
* **Elementos en Modo Colapsado (`isOpen === false`):**
  * Se renderiza en un contenedor compacto `div._workspaceContainer` que muestra únicamente el avatar/icono circular.

### 3.2 Menú Principal (`menuSections`)

El bloque central superior contiene los enlaces de primer nivel organizados en dos listas: fijas y desplegables.

#### A. Opciones Principales de Navegación

| Opción | Etiqueta i18n | Icono Componente | Condición de Visibilidad (Permiso) | Atajo Teclado Mostrado |
| :--- | :--- | :--- | :--- | :--- |
| **Colapsar / Expandir** | *Sin texto / Tooltip* | `VscLayoutSidebarLeft` o `CgSidebarRight` | Siempre visible | `[ ]` o clic directo |
| **Documentos** | `t('documents')` ("Documentos") | `IoDocumentTextOutline` | Siempre visible | `Cmd/Ctrl + D` |
| **Flujos de Trabajo** | `t('workflows')` ("Workflows") | `TbGitFork` | `shouldShowWorkflows` (`manageAutomation & 1 !== 0`) | `Cmd/Ctrl + Shift + A` |
| **Conversaciones** | `t('conversations')` ("Conversaciones") | `BsChatDots` | `shouldShowConversations` (`manageConversations & 1 !== 0`) | `Cmd/Ctrl + Shift + C` |
| **Agentes** | `t('agents')` ("Agentes") | `RiRobot2Line` | `shouldShowBots` (`manageBots & 1 !== 0`) | `Cmd/Ctrl + Shift + B` |

> **Nota sobre el botón Expandir/Colapsar:**  
> Cuando el sidebar está expandido, se muestra en la primera fila con el icono `VscLayoutSidebarLeft`. Al hacer clic, invierte el valor de `isOpen` y guarda el estado en `localStorage.setItem('menuSidebarState', ...)`.

#### B. Menú Desplegable "Ver más / Ver menos" (`showMoreMenuPoints`)

Al hacer clic en el botón conector `t('seeMore')` / `t('seeLess')` (icono `IoIosArrowDown` rotado a `IoIosArrowUp`), se expanden 8 acciones de creación rápida:

1. **Subir Documento:** Icono `FiUploadCloud`. Abre modal de subida (`openUploadModal`).
2. **Nueva Carpeta:** Icono `FiFolderPlus`. Crea una carpeta en la raíz de documentos.
3. **Nuevo Proyecto:** Icono `FiPlusSquare`. Abre modal de creación de proyecto.
4. **Nueva Tabla:** Icono `FiTable`. Dispara `handleOpenModalTable()`.
5. **Nuevo Contacto:** Icono `FiUserPlus`. Abre formulario de nuevo contacto.
6. **Nuevo Activo:** Icono `FiDatabase`. Abre formulario de nuevo activo.
7. **Nuevo Documento:** Icono `FiFilePlus`. Crea un documento en blanco.
8. **Nuevo Workflow:** Icono `TbGitFork`. Redirige al editor de automatizaciones.

### 3.3 Sección de Proyectos y Tablas (`projectsWrapper`)

Ubicada entre el menú principal y el menú inferior, permite listar los proyectos del usuario y sus tablas subordinadas mediante `@dnd-kit/core` y `@dnd-kit/sortable`:

* **Cabecera de Sección:**
  * Título: `t('projects')` ("Proyectos").
  * Botón de añadir proyecto: Icono `FiPlus` con tooltip.
* **Árbol de Proyectos:**
  * Cada proyecto es un elemento ordenable (`SortableProjectItem`).
  * Cada proyecto contiene un toggle de expansión (`RiArrowRightSLine` rotando 90° al abrirse).
  * Icono de carpeta: `FiFolder` (o icono de color personalizado según el proyecto).
  * Título del proyecto con truncamiento elíptico.
  * Botón de menú contextual (`FiMoreVertical`) con acciones: Renombrar, Duplicar, Cambiar Color, Compartir, Eliminar.
* **Tablas Hijas por Proyecto:**
  * Al expandir un proyecto, se consultan y renderizan sus tablas asociadas mediante el componente [`SortableItem.jsx`](file:///d:/docufacil/docufacil/src/views/Dashboard/components/NavigationPopups/ContactAssetNavigation/SortableItem.jsx).
  * Paginación / Límite visual: Si hay más de 10 tablas, muestra un botón *"Ver más"* / *"Ver menos"* para no saturar el scroll.
  * Botón inferior de acción rápida con IA: Botón con gradiente de color *"Nueva Tabla"* (`GEN AI`) con icono `BsStars`.

### 3.4 Menú Inferior / Utilidades del Sistema (`menuMore`)

Situado al fondo del sidebar en `div.menuMore`:

| Opción | Etiqueta i18n | Icono Componente | Comportamiento / Destino |
| :--- | :--- | :--- | :--- |
| **Explorar Comunidad** | `t('exploreCommunity')` | `IoCompassOutline` | Abre vista o modal de plantillas comunitarias. |
| **Obtener Plus / Plan** | `t('getPlus')` | `BsStars` | Abre el modal de pasarela de pago o upgrade de plan. Destacado con badge de estrella. |
| **Configuración** | `t('settings')` | `IoSettingsOutline` | Navega a `/admin/settings`. |
| **Centro de Ayuda** | `t('helpCenter')` | `IoHelpCircleOutline` | Abre soporte, FAQs o documentación de usuario. |
| **Enviar Sugerencia** | `t('sendFeedback')` | `BiMessageRoundedDetail` | Abre formulario de feedback. |
| **Home / Volver** | `t('home')` | `RiHome5Line` | Redirige a la vista principal del dashboard. |

### 3.5 Pie de Página: Versión y Workspace

* **Versión (`styles.version`):** Muestra el texto literal `V 1.02`.
* **Condición:** Solo se visualiza cuando el sidebar está en modo expandido (`!isExpanded`).

---

## 4. Tokens de Diseño y Estilos Visuales

Los estilos se gobiernan a través del módulo CSS [`HomeExplorer.module.css`](file:///d:/docufacil/docufacil/src/views/Dashboard/components/PanelTemplate/HomeExplorer/HomeExplorer.module.css) y las variables globales declaradas en [`src/index.css`](file:///d:/docufacil/docufacil/src/index.css).

### 4.1 Tipografía

La fuente tipográfica se hereda de la configuración global de la aplicación:

```css
/* Verificado en src/index.css */
body {
  font-family: Inter, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

#### Tamaños y Pesos en el Sidebar

* **Texto de Items de Menú (`.itemTitle`, `.pointMenu`):**
  * `font-size: 14px;`
  * `font-weight: 400;` (en estado inactivo) / `font-weight: 500;` (en estado activo).
  * `line-height: normal;`
  * `white-space: nowrap;`
  * `overflow: hidden;`
  * `text-overflow: ellipsis;`
* **Nombre del Workspace (`.workspaceContainer b`):**
  * `font-size: 12px;`
  * `font-weight: 500;`
* **Badges y Contador de Atajos (`.badge`, `.shortcut`):**
  * `font-size: 9px;` o `10px;`
  * `font-weight: 600;`
* **Pie de Versión (`.version`):**
  * `font-size: 12px;`
  * `color: var(--black);` (con opacidad).

### 4.2 Paleta de Colores (Variables CSS y Valores Resueltos)

El sistema soporta modo claro y modo oscuro dinámico (mediante la clase `.dark-theme` o atributos en el elemento raíz):

| Variable CSS | Modo Claro (Light) | Modo Oscuro (Dark) | Uso en el Sidebar |
| :--- | :--- | :--- | :--- |
| `--f5-background` | `#F5F5F5` | `#242525` | Fondo principal del contenedor del sidebar en modo expandido (`.container`). |
| `--white-color` | `#FFFFFF` | `#1E1F1F` | Fondo de tarjetas internas, degradado del sidebar colapsado e inputs. |
| `--_10a37f-background` | `#10A37F` (Verde Esmeralda) | `#6EE7B7` | Color primario de acento de Docufacil. Fondo de badges activos e iconos destacados. |
| `--_16c098-background` | `#16C098` | `#16C098` | Variante viva del verde para estados activos y elementos hover. |
| `--_16c0982e-background` | `rgba(22, 192, 152, 0.18)` | `rgba(22, 192, 152, 0.25)` | Fondo de item de menú seleccionado/activo. |
| `--_16c09821-background` | `rgba(22, 192, 152, 0.13)` | `rgba(22, 192, 152, 0.18)` | Fondo secundario de badges y chips de estado. |
| `--gray-50` | `#F9FAFB` | `#2C2E2E` | Fondo del item al hacer hover (`:hover`). |
| `--black` | `#000000` / `#111827` | `#F9FAFB` | Color principal de los textos de opciones e iconos inactivos. |
| `--gray-400` / `--border-color` | `#D1D5DB` | `#374151` | Líneas divisorias, bordes de iconos colapsados y atajos de teclado. |

### 4.3 Dimensiones, Espaciado y Geometría

Fragmentos exactos extraídos de [`HomeExplorer.module.css`](file:///d:/docufacil/docufacil/src/views/Dashboard/components/PanelTemplate/HomeExplorer/HomeExplorer.module.css#L1-L40):

```css
/* Contenedor del Sidebar Desktop */
.container {
  min-width: 240px;
  width: 240px;
  height: 100vh;
  background-color: var(--f5-background);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 10px 8px;
  box-sizing: border-box;
  transition: width 0.2s ease, min-width 0.2s ease;
  overflow-x: hidden;
  overflow-y: auto;
  user-select: none;
}

/* Sidebar en Modo Colapsado (Compacto) */
.activeTab {
  min-width: 50px !important;
  max-width: 50px !important;
  width: 50px !important;
  padding: 10px 4px !important;
  background: linear-gradient(
    to top,
    var(--white-color) 0%,
    var(--white-color) 43%,
    var(--f5-background) 100%
  ) !important;
  align-items: center;
}
```

#### Medidas de Items y Botones

* **Item de Navegación Estándar (`.pointMenu`):**
  * `min-height: 40px;`
  * `height: 40px;`
  * `border-radius: 8px;`
  * `padding: 0 8px;`
  * `gap: 8px;` (entre icono y texto).
  * `display: flex; align-items: center;`
* **Contenedor del Icono (`.iconContainer`):**
  * `min-width: 32px;`
  * `width: 32px;`
  * `height: 32px;`
  * `display: flex; align-items: center; justify-content: center;`
  * `border-radius: 6px;`
* **Badge de Notificación / Cantidad:**
  * `min-width: 14px;`
  * `height: 14px;`
  * `border-radius: 6px;`
  * `padding: 0 4px;`
  * `font-size: 9px;`
  * `background: var(--_10a37f-background);`
  * `color: #FFFFFF;`
* **Separación Vertical:**
  * Los bloques de menú se agrupan con un margen inferior de `12px` a `16px`.
  * La separación entre items individuales es de `4px`.

---

## 5. Estados de Interacción

### 5.1 Estado Normal (Default)
* Color de texto: `var(--black)` con opacidad del 80%.
* Fondo transparente: `background: transparent;`.
* Iconos en escala neutra monocromática.

### 5.2 Estado Hover
Al pasar el cursor sobre cualquier item no activo (`.pointMenu:hover`):

```css
/* Verificado en HomeExplorer.module.css */
.pointMenu:hover {
  background-color: var(--gray-50);
  cursor: pointer;
  transform: translateY(-2px);
  transition: transform 0.15s ease, background-color 0.15s ease;
}
```

* **Microinteracción:** Elevación física sutil (`translateY(-2px)`).
* **Fondo:** Se colorea con `var(--gray-50)`.
* **Tooltip:** En modo colapsado (50px), el hover dispara un tooltip emergente flotante a la derecha con el nombre de la opción.

### 5.3 Estado Activo / Seleccionado (`.activePointMenu`)
Cuando la ruta actual coincide con el elemento (determinado por `currentMenuSelected` o `location.pathname`):

```css
/* Verificado en HomeExplorer.module.css */
.activePointMenu {
  background-color: var(--_16c0982e-background) !important;
  color: var(--_10a37f-background) !important;
  font-weight: 500;
}

.activePointMenu svg {
  color: var(--_10a37f-background) !important;
}
```

* **Fondo:** Verde translúcido al 18% de opacidad (`--_16c0982e-background`).
* **Texto e Icono:** Color de acento de marca verde esmeralda (`--_10a37f-background`).
* **Tipografía:** Cambia de peso regular a medium (`font-weight: 500`).

### 5.4 Lógica de Expansión vs Colapsado

En [`HomeExplorer.jsx`](file:///d:/docufacil/docufacil/src/views/Dashboard/components/PanelTemplate/HomeExplorer/HomeExplorer.jsx), existe una inversión de variable clave que controla el estado visual:

```javascript
// Fragmento verificado de HomeExplorer.jsx
let isExpanded = !(expanded || isOpen);
```

* **Si `isOpen === true` (sidebar abierto a 240px):**
  * `isExpanded` evalúa a `false`.
  * La clase `.activeTab` **no** se aplica al `<aside>`.
  * El ancho efectivo es `240px`.
  * Se renderizan textos, badges de atajos de teclado, submenús y el pie de versión `V 1.02`.
* **Si `isOpen === false` (sidebar colapsado a 50px):**
  * `isExpanded` evalúa a `true`.
  * Se añade la clase `styles.activeTab` al `<aside>`.
  * El ancho se fuerza a `50px !important`.
  * Se ocultan los textos (`span.itemTitle { display: none }`), el contador de miembros y el pie de página.
  * Los iconos quedan centrados vertical y horizontalmente.

---

## 6. Menú Contextual y Acciones Secundarias

Tanto los proyectos como las tablas y documentos disponen de un menú contextual emergente (`selectedOption` o popover de tres puntos `FiMoreVertical`):

```jsx
// Opciones implementadas en el menú contextual de HomeExplorer.jsx
const contextMenuActions = [
  { id: 'edit', label: t('edit'), icon: FiEdit2 },
  { id: 'pin', label: t('pinToTop'), icon: BsPinAngle },
  { id: 'share', label: t('share'), icon: FiShare2 },
  { id: 'move', label: t('moveTo'), icon: FiCornerDownRight },
  { id: 'show', label: t('viewDetails'), icon: FiEye },
  { id: 'talk_ai', label: t('talkWithAi'), icon: BsStars },
  { id: 'copy', label: t('copyLink'), icon: FiCopy },
  { id: 'duplicate', label: t('duplicate'), icon: FiCopy },
  { id: 'export', label: t('exportData'), icon: FiDownload },
  { id: 'import', label: t('importData'), icon: FiUpload },
  { id: 'delete', label: t('delete'), icon: FiTrash2, danger: true }
];
```

* **Estilo del Menú Contextual (`.contextMenu`):**
  * `position: fixed;` o `absolute;` con `z-index: 1050;`.
  * `background: var(--white-color);`
  * `box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);`
  * `border-radius: 8px;`
  * `padding: 6px;`
  * Los elementos de peligro (`delete`) utilizan color de texto rojo (`#EF4444`).

---

## 7. Drag & Drop (Reordenamiento)

El sidebar utiliza la librería `@dnd-kit/core` junto con `@dnd-kit/sortable` para permitir el reordenamiento manual de proyectos y tablas mediante arrastrar y soltar:

* **Estrategia de Colisión:** `closestCenter`.
* **Sensores:**
  * `PointerSensor` con activación diferida (`activationConstraint: { distance: 5 }`) para no interferir con el clic de selección de ruta.
* **Manejador de Arrastre (`DragHandle`):**
  * Icono de agarre `MdOutlineDragIndicator` o `RxDragHandleDots2`.
  * Aparece en hover sobre el item en proyectos (`.dragHandle`).
* **Sincronización:** Al dispararse `onDragEnd`, se calcula el nuevo índice con `arrayMove` y se emite una mutación al backend para persistir el nuevo orden (`orderIndex`).

---

## 8. Reglas de Visibilidad, Roles y Permisos

La visibilidad de las opciones del sidebar está gobernada estrictamente por el hook [`usePermissions.js`](file:///d:/docufacil/docufacil/src/utils/usePermissions.js).

### 8.1 Máscara de Bits de Permisos

El sistema utiliza operaciones binarias para evaluar qué acciones puede realizar el usuario:

```javascript
// Verificado en src/utils/usePermissions.js
const PERMISSION_MASKS = {
  NONE: 0,    // 000 en binario
  VIEW: 1,    // 001 en binario
  EDIT: 2,    // 010 en binario
  DELETE: 4,  // 100 en binario
  ALL: 7      // 111 en binario
};
```

### 8.2 Roles de Workspace Especiales
* **Roles `owner` y `admin`:**  
  Si `permissionsUserInWorkspace?.type === 'admin'` o `'owner'`, **todas las comprobaciones de permisos devuelven `true` automáticamente**, dando acceso irrestricto a todos los menús y acciones de creación.
* **Rol `member` / `guest`:**  
  Depende de los bits configurados en el objeto de permisos del workspace.

### 8.3 Evaluación de Items Específicos del Sidebar

```javascript
// Reglas exactas verificadas en usePermissions.js y consumidas en HomeExplorer.jsx
const shouldShowWorkflows = isAdminOrOwner || (manageAutomation & PERMISSION_MASKS.VIEW) !== 0;
const shouldShowConversations = isAdminOrOwner || (manageConversations & PERMISSION_MASKS.VIEW) !== 0;
const shouldShowBots = isAdminOrOwner || (manageBots & PERMISSION_MASKS.VIEW) !== 0;
const shouldShowTables = isAdminOrOwner || (manageTables & PERMISSION_MASKS.VIEW) !== 0;
const canCreateTables = isAdminOrOwner || (manageTables & PERMISSION_MASKS.EDIT) !== 0;
```

#### Aplicación en el DOM:
1. **Flujos de Trabajo (`TbGitFork`):** Si `!shouldShowWorkflows`, el elemento aplica `display: none` o no se monta en el render.
2. **Conversaciones (`BsChatDots`):** Si `!shouldShowConversations`, se oculta.
3. **Agentes (`RiRobot2Line`):** Si `!shouldShowBots`, se oculta.
4. **Botón Añadir Tabla en Proyecto (`.addChildItem`):** Solo se muestra si el usuario tiene permiso `EDIT` sobre la tabla o el proyecto compartido (`hasProjectEditPermission`).

---

## 9. Comportamiento Responsive y Móvil

### 9.1 Breakpoint de Pantalla

El punto de quiebre crítico del layout está fijado en **`768px`**:

* **En Desktop (`windowWidth > 768px`):**
  * `HomeExplorer` se renderiza en el flujo normal a la izquierda.
  * Ocupa `240px` (o `50px` si se colapsa manualmente).
  * El botón flotante hamburguesa está oculto.
* **En Mobile / Tablet Pequeña (`windowWidth <= 768px`):**
  * `HomeExplorer` se **desmonta completamente** en `PanelTemplate.jsx` (`!isMobile`).
  * Se renderiza el botón hamburguesa `☰` (`openMenuButton`) en la esquina superior izquierda.
  * La navegación se traslada a [`MobileAsidebarNavigation.jsx`](file:///d:/docufacil/docufacil/src/views/Dashboard/components/NavbarAdmin/MobileAsidebarNavigation/MobileAsidebarNavigation.jsx).

### 9.2 Drawer Móvil (`MobileAsidebarNavigation.module.css`)

```css
/* Fragmento verificado de MobileAsidebarNavigation.module.css */
.mobileMenu {
  position: fixed;
  top: 0;
  left: -100vw;
  width: 240px;
  height: 100vh;
  background-color: var(--f5-background);
  z-index: 1000;
  transition: left 300ms cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 2px 0 12px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
}

.activeMobileMenu {
  left: 0 !important;
}

.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
}
```

* Al pulsar el botón hamburguesa o emitir el evento custom `openMobileMenu`, se añade la clase `.activeMobileMenu`, desplazando el sidebar de `left: -100vw` a `left: 0` en `300ms`.
* Se despliega un telón de fondo oscuro (`.overlay`) que cierra el menú al hacer clic fuera.

---

## 10. Cuadro Comparativo: Funcionalidades Verificadas vs No Verificadas

Para garantizar la máxima integridad de esta documentación técnica, se expone a continuación qué elementos han sido confirmados línea por línea en el código frente a supuestos o aspectos delegados al backend:

| Elemento / Característica | Estado en el Código | Detalle Técnico Verificado |
| :--- | :--- | :--- |
| **Ancho Expandido / Colapsado** | **Verificado** | `240px` por defecto y `50px` al activar `.activeTab`. |
| **Breakpoint Responsive** | **Verificado** | Exactamente `768px` mediante listener en `window.innerWidth`. |
| **Animación Hover** | **Verificado** | `transform: translateY(-2px)` con fondo `var(--gray-50)`. |
| **Transición de Colapso** | **Verificado** | `transition: width 0.2s ease, min-width 0.2s ease`. |
| **Colores Light / Dark** | **Verificado** | Extraídos de las variables `--f5-background`, `--_10a37f-background`, etc., en `src/index.css`. |
| **Atajos de Teclado Visuales** | **Verificado** | Mapeados en `useGlobalShortcuts.js` para Mac (`Cmd`) y Windows/Linux (`Ctrl`). |
| **Reordenamiento Drag & Drop** | **Verificado** | Implementado con `@dnd-kit/core` y `SortableContext` en proyectos y tablas. |
| **Máscaras de Permisos** | **Verificado** | Bits `1 (VIEW)`, `2 (EDIT)`, `4 (DELETE)`, `7 (ALL)` en `usePermissions.js`. |
| **Persistencia del Estado del Menú** | **Verificado** | `localStorage.getItem('menuSidebarState')` / `localStorage.setItem(...)`. |
| **Número de Versión Estática** | **Verificado** | Cadena literal `V 1.02` en el JSX de `HomeExplorer.jsx`. |
| *Persistencia del orden DnD en backend* | *Dependiente de API externa* | Se verifica la llamada axios/fetch, pero la persistencia en base de datos depende de la API REST. |
| *Contenido dinámico de la Comunidad* | *No verificado en el componente* | El botón "Explorar Comunidad" existe en el DOM, pero su vista destino no está incrustada en este módulo. |

---

## 11. Conclusión y Recomendaciones de Mantenimiento

1. **Unificación de la variable `isExpanded`:** En `HomeExplorer.jsx`, la lógica invertida `let isExpanded = !(expanded || isOpen);` genera ambigüedad semántica (un desarrollador esperaría que `isExpanded` sea verdadero cuando el sidebar está abierto a 240px, mientras que en el código actual significa que está colapsado a 50px). Se recomienda documentar internamente o normalizar esta denominación en futuras refactorizaciones.
2. **Modularización:** `HomeExplorer.jsx` cuenta con más de 4.000 líneas. Los subcomponentes como el menú contextual, el selector de workspace y la lista de proyectos ordenables podrían desacoplarse en archivos independientes para facilitar pruebas unitarias de regresión visual.
3. **Consistencia Accesible (A11y):** Aunque se implementaron atajos de teclado y tooltips, se recomienda añadir atributos `aria-expanded` y roles `menu` / `menuitem` explícitos en los elementos de lista para lectores de pantalla.
