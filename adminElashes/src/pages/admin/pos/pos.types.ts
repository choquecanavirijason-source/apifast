export type CartLine = {
  localId: string;
  service_id: string;
  professional_id: string;
  date: string;
  time: string;
  without_time: boolean;
  status: "pending" | "in_service";
  duration_minutes: number;
  price: number;
};

export type ReceiptTicketEdit = {
  date: string;
  time: string;
  without_time: boolean;
  professional_id: string;
  status: "pending" | "in_service";
};

export type PosSaleDraft = {
  clientId: string;
  clientSearch: string;
  paymentMethod: string;
  discountType: "amount" | "percent";
  discountValue: string;
  notes: string;
  cartLines: CartLine[];
  serviceSearch: string;
  selectedServiceCategoryId: string;
  sellerId: string;
};
