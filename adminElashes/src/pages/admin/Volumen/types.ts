// src/pages/admin/Volumen/types.ts

export interface LashVolume {
  id: number;
  name: string;
  description: string;
  image: string;
}

// Omitimos el ID para el formulario de creación
export type VolumenFormState = Omit<LashVolume, 'id'>;