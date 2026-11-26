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
  isActive: boolean;
  discountPercent: string;
  isCombo: boolean;
  componentIds: number[];
  /** El usuario escribió la duración a mano: deja de sugerirse la suma de los servicios. */
  durationEdited: boolean;
  /** El usuario escribió el precio a mano: deja de sugerirse la suma de los servicios. */
  priceEdited: boolean;
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
  isActive: true,
  discountPercent: "",
  isCombo: false,
  componentIds: [],
  durationEdited: false,
  priceEdited: false,
};
