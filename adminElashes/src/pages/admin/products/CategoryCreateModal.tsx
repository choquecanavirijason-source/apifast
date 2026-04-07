import type { FormEvent } from "react";
import GenericModal from "../../../components/common/modal/GenericModal";
import { Button, InputField } from "../../../components/common/ui";

interface CategoryCreateModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  categoryName: string;
  errorMessage?: string;
  onClose: () => void;
  onCategoryNameChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}

export default function CategoryCreateModal({
  isOpen,
  isSubmitting,
  categoryName,
  errorMessage,
  onClose,
  onCategoryNameChange,
  onSubmit,
}: CategoryCreateModalProps) {
  return (
    <GenericModal
      isOpen={isOpen}
      onClose={onClose}
      title="Nueva categoria"
      asForm
      onSubmit={onSubmit}
      size="md"
      closeOnBackdrop={!isSubmitting}
    >
      <div className="space-y-4">
        <InputField
          label="Nombre de categoria"
          placeholder="Ej. Pestañas clasicas"
          value={categoryName}
          onChange={(event) => onCategoryNameChange(event.target.value)}
          error={errorMessage}
          required
        />

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || Boolean(errorMessage)}>
            Crear categoria
          </Button>
        </div>
      </div>
    </GenericModal>
  );
}
