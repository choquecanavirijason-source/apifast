// src/models/user.model.ts

export interface UserModel {
  id: number;
  username: string;
  email: string;
  role: string;          // Ej: 'SuperAdmin', 'Operaria'
  permissions: string[]; // Ej: ['clients:view', 'tracking:view']
  phone?: string;
  is_active: boolean;
}
