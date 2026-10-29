import api from "../api";

/** Mismos topes que el backend (domain/entities/broadcast.py). */
export const BROADCAST_TITLE_MAX_LENGTH = 80;
export const BROADCAST_BODY_MAX_LENGTH = 500;
/** Firebase descarta las imágenes de notificación de más de 1 MB. */
export const BROADCAST_IMAGE_MAX_BYTES = 1024 * 1024;
export const MAX_SELECTED_CLIENTS = 500;

export type BroadcastKind = "aviso" | "promocion" | "novedad";
export type BroadcastAudience = "all" | "upcoming_appointment" | "retouch_due" | "inactive" | "selected";
export type BroadcastStatus = "sending" | "sent" | "interrupted";
export type PushDelivery = "sent" | "failed" | "no_app";
export type EmailDelivery = "sent" | "failed" | "no_email";

export interface AudienceParams {
  kind: BroadcastKind;
  audience: BroadcastAudience;
  days?: number | null;
  branch_id?: number | null;
  /** Solo con audience "selected". */
  client_ids?: number[];
}

export interface AudiencePreview {
  clients: number;
  with_push: number;
  with_email: number;
  email_daily_limit: number;
}

export interface BroadcastImage {
  image_url: string;
  /** Como la ven los celulares; null = el servidor no tiene PUBLIC_BASE_URL. */
  public_url: string | null;
}

export interface BroadcastPayload {
  kind: BroadcastKind;
  title: string;
  body: string;
  image_url: string | null;
  audience: BroadcastAudience;
  audience_days: number | null;
  branch_id: number | null;
  send_push: boolean;
  send_email: boolean;
  email_from: string | null;
  client_ids: number[];
}

export interface Broadcast extends Omit<BroadcastPayload, "client_ids"> {
  id: number;
  branch_name: string | null;
  status: BroadcastStatus;
  recipients_count: number;
  push_sent: number;
  push_failed: number;
  email_sent: number;
  email_failed: number;
  created_by_name: string | null;
  /** UTC con zona. */
  created_at: string;
  finished_at: string | null;
}

export interface BroadcastRecipient {
  client_id: number;
  name: string;
  phone: string | null;
  email: string | null;
  branch_name: string | null;
  /** null = ese canal no se pidió o todavía no se procesó. */
  push_status: PushDelivery | null;
  email_status: EmailDelivery | null;
}

/** Una clienta del buscador de "Clientas específicas". */
export interface RecipientCandidate {
  id: number;
  name: string;
  branch_name: string | null;
  has_app: boolean;
  has_email: boolean;
  notificaciones_activas: boolean;
}

export interface BroadcastContent {
  kind: BroadcastKind;
  title: string;
  body: string;
  image_url: string | null;
}

export interface EmailPreview {
  subject: string;
  html: string;
}

const PATH = "/broadcasts";

export const BroadcastService = {
  async previewAudience({ days, branch_id, ...rest }: AudienceParams): Promise<AudiencePreview> {
    const params = { ...rest, days: days ?? undefined, branch_id: branch_id ?? undefined };
    // client_ids=1&client_ids=2 (lo que espera FastAPI), no client_ids[]=1.
    const response = await api.get<AudiencePreview>(`${PATH}/audience`, { params, paramsSerializer: { indexes: null } });
    return response.data;
  },

  async uploadImage(file: File): Promise<BroadcastImage> {
    const form = new FormData();
    form.append("file", file);
    const response = await api.post<BroadcastImage>(`${PATH}/image`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  /** El correo tal como saldría (lo arma el backend con la plantilla real). */
  async previewEmail(content: BroadcastContent): Promise<EmailPreview> {
    const response = await api.post<EmailPreview>(`${PATH}/email-preview`, content);
    return response.data;
  },

  /** Responde al instante con status "sending"; el envío sigue en el servidor. */
  async send(payload: BroadcastPayload): Promise<Broadcast> {
    const response = await api.post<Broadcast>(PATH, payload);
    return response.data;
  },

  async searchClients(search: string, branchId: number | null): Promise<RecipientCandidate[]> {
    const params = { search, branch_id: branchId ?? undefined };
    const response = await api.get<RecipientCandidate[]>(`${PATH}/clients`, { params });
    return response.data;
  },

  async listRecipients(broadcastId: number): Promise<BroadcastRecipient[]> {
    const response = await api.get<BroadcastRecipient[]>(`${PATH}/${broadcastId}/recipients`);
    return response.data;
  },

  async list(limit = 100): Promise<Broadcast[]> {
    const response = await api.get<Broadcast[]>(PATH, { params: { limit } });
    return response.data;
  },
};
