export type Role = 'super-admin' | 'admin' | 'user'

export type Permission =
  | 'dashboard.view'
  | 'users.view'
  | 'users.create'
  | 'users.delete'
  | 'settings.view'
  | 'settings.mobile'
  | 'settings.edit'
  | 'clients.view'
  | 'clients.create'
  | 'forms.create'
  | 'forms.categories'
  | 'branches.view'
  | 'branches.create'
  | 'effects.create'
  | 'thickness.create'
  | 'designs.view'
  | 'designs.create'

export const Permissions: Record<Role, Permission[]> = {
  'super-admin': [
    'dashboard.view',
    'users.view',
    'users.create',
    'users.delete',
    'settings.view',
    'settings.mobile',
    'settings.edit'
    , 'clients.view', 'clients.create', 'forms.create', 'forms.categories', 'branches.view', 'branches.create', 'effects.create', 'thickness.create', 'designs.view', 'designs.create'
  ],
  'admin': [
    'dashboard.view',
    'users.view',
    'users.create',
    'settings.view'
    , 'clients.view', 'clients.create', 'forms.create', 'forms.categories', 'effects.create', 'thickness.create', 'designs.view', 'designs.create'
  ],
  'user': [
    'dashboard.view'
  ]
}

export function getPermissionsFor(role: Role): Permission[] {
  return Permissions[role] || []
}
