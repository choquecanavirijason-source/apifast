export interface ServiceFormState {
  name: string;
  description: string;
  imageUrl: string;
  isMobile: boolean;
}

export const emptyServiceForm: ServiceFormState = {
  name: "",
  description: "",
  imageUrl: "",
  isMobile: false,
};

export interface ServiceItemFormState {
  name: string;
  description: string;
  imageUrl: string;
  categoryId: string;
  durationMinutes: string;
  price: string;
}

export const emptyServiceItemForm: ServiceItemFormState = {
  name: "",
  description: "",
  imageUrl: "",
  categoryId: "",
  durationMinutes: "",
  price: "",
};
