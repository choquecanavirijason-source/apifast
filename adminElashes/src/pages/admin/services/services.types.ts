export interface ServiceFormState {
  name: string;
  description: string;
  imageUrl: string;
  isMobile: boolean;
  questionnaireId: string;
  questionnaireRequired: boolean;
  hasMaintenance: boolean;
  hasRemoval: boolean;
}

export const emptyServiceForm: ServiceFormState = {
  name: "",
  description: "",
  imageUrl: "",
  isMobile: false,
  questionnaireId: "",
  questionnaireRequired: false,
  hasMaintenance: false,
  hasRemoval: false,
};

export interface ServiceItemFormState {
  name: string;
  description: string;
  imageUrl: string;
  categoryId: string;
  durationMinutes: string;
  price: string;
  commissionRate: string;
  maintenanceDays: string;
  removalDays: string;
}

export const emptyServiceItemForm: ServiceItemFormState = {
  name: "",
  description: "",
  imageUrl: "",
  categoryId: "",
  durationMinutes: "",
  price: "",
  commissionRate: "",
  maintenanceDays: "",
  removalDays: "",
};
