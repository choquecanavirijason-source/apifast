// src/pages/admin/Volumen/types.ts

export interface LashVolume {
  id: number;
  name: string;
  description: string;
  image: string;
  model_3d_url?: string | null;
  model_3d_filename?: string | null;
}

// Omitimos el ID para el formulario de creación
export type VolumenFormState = Omit<LashVolume, 'id' | 'model_3d_url' | 'model_3d_filename'> & {
  modelFileName: string;
  modelFileUrl: string;
};