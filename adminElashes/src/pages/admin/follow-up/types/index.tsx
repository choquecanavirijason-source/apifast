

export interface IFollowUp {
  id: number;
  clientId: number;
  clientName: string;
  
  applicationDate: string;       
  
 
  curva: string[];    // C, B, D...
  tamano: string[];   // 7, 8... 17
  grosor: string[];   // 0.03, 0.05...
  
  efectoMaterial: string; 
  densidad: "Natural" | "Semitupido" | "Tupido" | "";
  
  diseno: "Natural" | "Ojo de Gato" | "Mixta al Costado" | "Mixta" | "Personalizado" | "";
  
  
  formaOjos: string[]; 
  
  notas?: string;
}

export type FollowUpFormState = Omit<IFollowUp, 'id'>;