import api from "../api";

export interface BirthdayCouponConfig {
  enabled: boolean;
  /** Descuento en % (0 < percent <= 100 cuando está activo). */
  percent: number;
  /** Días antes y después del cumpleaños en que vale (0 = solo el día). */
  window_days: number;
}

/** Si a una clienta se le puede ofrecer hoy el cupón de cumpleaños. */
export interface BirthdayCouponEligibility {
  eligible: boolean;
  /** disabled | no_client | generic | no_birth_date | outside_window | already_used */
  reason: string | null;
  message: string | null;
  percent: number;
  window_days: number;
  /** Fecha concreta del cumpleaños que cubre hoy (YYYY-MM-DD). */
  birthday: string | null;
}

export interface BirthdayCouponRedemption {
  id: number;
  client_id: number;
  client_name: string;
  sale_id: number | null;
  sale_code: string | null;
  percent: number;
  discount_amount: number;
  applied_by: string | null;
  created_at: string;
}

export const CouponService = {
  async getBirthdayConfig(): Promise<BirthdayCouponConfig> {
    const response = await api.get<BirthdayCouponConfig>("/coupons/birthday/config");
    return response.data;
  },

  async updateBirthdayConfig(config: BirthdayCouponConfig): Promise<BirthdayCouponConfig> {
    const response = await api.put<BirthdayCouponConfig>("/coupons/birthday/config", config);
    return response.data;
  },

  /** Lo consulta el POS al elegir una clienta. */
  async getBirthdayEligibility(clientId: number): Promise<BirthdayCouponEligibility> {
    const response = await api.get<BirthdayCouponEligibility>("/coupons/birthday/eligibility", {
      params: { client_id: clientId },
    });
    return response.data;
  },

  async listBirthdayRedemptions(limit = 50): Promise<BirthdayCouponRedemption[]> {
    const response = await api.get<{ items: BirthdayCouponRedemption[] }>("/coupons/birthday/redemptions", {
      params: { limit },
    });
    return response.data.items;
  },
};
