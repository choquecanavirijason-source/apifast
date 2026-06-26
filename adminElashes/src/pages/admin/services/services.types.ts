export interface ServiceFormState {
  name: string;
  description: string;
  imageUrl: string;
  isMobile: boolean;
  questionnaireId: string;
  questionnaireRequired: boolean;
}

export const emptyServiceForm: ServiceFormState = {
  name: "",
  description: "",
  imageUrl: "",
  isMobile: false,
  questionnaireId: "",
  questionnaireRequired: false,
};

export interface ServiceItemFormState {
  name: string;
  description: string;
  imageUrl: string;
  categoryId: string;
  durationMinutes: string;
  price: string;
  commissionRate: string;
}

export const emptyServiceItemForm: ServiceItemFormState = {
  name: "",
  description: "",
  imageUrl: "",
  categoryId: "",
  durationMinutes: "",
  price: "",
  commissionRate: "",
};
