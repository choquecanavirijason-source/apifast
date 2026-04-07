export interface IClient {
  id: number;
  nombre: string;
  apellido: string;
  edad: number;
  sexo: 'Masculino' | 'Femenino' | 'Otro';
  tipoOjos: string;
  phone?: string;
  eye_type_id?: number;
  branch_id?: number;
  branch_name?: string;
  created_at?: string;
  status:
    | 'en_servicio'
    | 'en_espera'
    | 'pagado'
    | 'reserva'
    | 'finalizado'
    | 'sin_estado'
    | 'siendo_atendido'   // legacy
    | 'atendido'          // legacy
    | 'cancelado'
    | 'no_se_presento'
    | 'reagendado';
   // Frecuencia
    visitas: number; 
  
    // Expediente Digital (Opcionales porque al crear cliente no existen aún)
    valoracion?: IClientAssessment;
    expediente?: IClientConsent;
}


export interface IClientAssessment {
  trastornoParpados: boolean;
  sensibilidadLuz: boolean;
  alergiasEstacionales: boolean;
  irritacionPiel: boolean;
  ojoSeco: boolean;
  xerosis: boolean; 
  alergiaAlimentos: boolean;
  conjuntivitis: boolean;
  trastornoCutaneo: boolean;
  observaciones?: string;
}


export interface IClientConsent {
  numeroExpediente: string;
  fecha: string;
  sucursal: string;
  ci: string;        
  firma?: string;    
  aceptado: boolean;
}


export type ClientFormState = Omit<IClient, 'id' | 'visitas' | 'valoracion' | 'expediente'>;