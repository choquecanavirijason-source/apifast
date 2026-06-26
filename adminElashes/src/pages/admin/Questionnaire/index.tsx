import { useEffect, useMemo, useState } from "react";
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "react-toastify";

import Layout from "@/components/common/layout";
import FilterActionBar from "@/components/common/FilterActionBar";
import GenericModal from "@/components/common/modal/GenericModal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/common/ui";
import DataTable, { type DataTableAction, type DataTableColumn } from "@/components/common/table/DataTable";
import {
  CatalogService,
  type QuestionnaireItem,
  type QuestionnaireUpdatePayload,
} from "@/core/services/catalog/catalog.service";

type TargetAudience = "ADULTOS" | "MENORES";
type QuestionType = "text" | "number" | "bool" | "select" | "multi_select";

interface QuestionForm {
  id?: number;
  text: string;
  question_type: QuestionType;
  is_required: boolean;
  sort_order?: number;
}

type QuestionRow = NonNullable<QuestionnaireItem["questions"]>[number];

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  text: "Texto libre",
  number: "Numero",
  bool: "Si / No",
  select: "Seleccion",
  multi_select: "Multiple",
};

const tabTitleMap: Record<TargetAudience, string> = {
  ADULTOS: "Cuestionario Adultos",
  MENORES: "Cuestionario Menores",
};

const matchQuestionnaireForTab = (questionnaire: QuestionnaireItem, tab: TargetAudience) => {
  const title = questionnaire.title.toLowerCase();
  return tab === "ADULTOS" ? title.includes("adult") : title.includes("menor");
};

export default function QuestionnairePage() {
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireItem[]>([]);
  const [activeTab, setActiveTab] = useState<TargetAudience>("ADULTOS");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionForm | null>(null);
  const [form, setForm] = useState<QuestionForm>({
    text: "",
    question_type: "bool",
    is_required: false,
  });
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; question: QuestionForm | null }>({
    isOpen: false,
    question: null,
  });

  const activeQuestionnaire = useMemo(
    () => questionnaires.find((item) => matchQuestionnaireForTab(item, activeTab)) ?? null,
    [questionnaires, activeTab]
  );

  const tableData = useMemo<QuestionRow[]>(
    () => activeQuestionnaire?.questions ?? [],
    [activeQuestionnaire]
  );

  const loadQuestionnaires = async () => {
    setIsLoading(true);
    try {
      const data = await CatalogService.listQuestionnaires({ limit: 200 });
      setQuestionnaires(data);
    } catch (error) {
      console.error("Error cargando cuestionarios:", error);
      toast.error("No se pudieron cargar los cuestionarios.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadQuestionnaires();
  }, []);

  const createQuestionnaireForTab = async () => {
    setIsSaving(true);
    try {
      const created = await CatalogService.createQuestionnaire({
        title: tabTitleMap[activeTab],
        description: "",
        is_active: true,
        questions: [],
      });
      setQuestionnaires((prev) => [created, ...prev]);
      return created;
    } catch (error) {
      console.error("Error creando cuestionario:", error);
      toast.error("No se pudo crear el cuestionario.");
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenCreate = async () => {
    let targetQuestionnaire = activeQuestionnaire;
    if (!targetQuestionnaire) {
      targetQuestionnaire = await createQuestionnaireForTab();
      if (!targetQuestionnaire) return;
    }
    setCurrentQuestion(null);
    setForm({ text: "", question_type: "bool", is_required: false });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (question: QuestionRow) => {
    setCurrentQuestion(question);
    setForm({
      id: question.id,
      text: question.text,
      question_type: question.question_type,
      is_required: question.is_required,
    });
    setIsModalOpen(true);
  };

  const buildPayload = (questions: QuestionForm[]): QuestionnaireUpdatePayload => ({
    questions: questions.map((question, index) => ({
      text: question.text.trim(),
      question_type: question.question_type,
      is_required: question.is_required,
      sort_order: index,
    })),
  });

  const persistQuestions = async (targetId: number, questions: QuestionForm[]) => {
    const payload = buildPayload(questions);
    const updated = await CatalogService.updateQuestionnaire(targetId, payload);
    setQuestionnaires((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.text.trim()) return;

    let targetQuestionnaire = activeQuestionnaire;
    if (!targetQuestionnaire) {
      targetQuestionnaire = await createQuestionnaireForTab();
      if (!targetQuestionnaire) return;
    }

    const questions = (targetQuestionnaire.questions ?? []).map((question) => ({
      id: question.id,
      text: question.text,
      question_type: question.question_type,
      is_required: question.is_required,
      sort_order: question.sort_order,
    }));

    const nextQuestions = currentQuestion?.id
      ? questions.map((question) =>
          question.id === currentQuestion.id
            ? { ...question, ...form, text: form.text.trim() }
            : question
        )
      : [...questions, { ...form, text: form.text.trim() }];

    setIsSaving(true);
    try {
      await persistQuestions(targetQuestionnaire.id, nextQuestions);
      setIsModalOpen(false);
      toast.success(currentQuestion ? "Pregunta actualizada." : "Pregunta creada.");
    } catch (error) {
      console.error("Error guardando pregunta:", error);
      toast.error("No se pudo guardar la pregunta.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.question || !activeQuestionnaire) return;
    const filtered = (activeQuestionnaire.questions ?? []).filter(
      (question) => question.id !== deleteDialog.question?.id
    );
    setIsSaving(true);
    try {
      await persistQuestions(activeQuestionnaire.id, filtered);
      toast.success("Pregunta eliminada.");
    } catch (error) {
      console.error("Error eliminando pregunta:", error);
      toast.error("No se pudo eliminar la pregunta.");
    } finally {
      setIsSaving(false);
      setDeleteDialog({ isOpen: false, question: null });
    }
  };

  const columns = useMemo<DataTableColumn<QuestionRow>[]>(
    () => [
      {
        key: "text",
        header: "Pregunta",
        sortable: true,
        render: (item) => <span className="font-semibold text-slate-800">{item.text}</span>,
      },
      {
        key: "question_type",
        header: "Tipo",
        sortable: true,
        getValue: (item) => QUESTION_TYPE_LABELS[item.question_type],
        render: (item) => (
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
            {QUESTION_TYPE_LABELS[item.question_type]}
          </span>
        ),
      },
      {
        key: "is_required",
        header: "Obligatoria",
        sortable: true,
        getValue: (item) => (item.is_required ? "si" : "no"),
        render: (item) =>
          item.is_required ? (
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">
              Si
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
              No
            </span>
          ),
      },
      {
        key: "sort_order",
        header: "Orden",
        sortable: true,
        getValue: (item) => item.sort_order,
        render: (item) => (
          <span className="tabular-nums text-slate-600">{item.sort_order + 1}</span>
        ),
      },
    ],
    []
  );

  const actions = useMemo<DataTableAction<QuestionRow>[]>(
    () => [
      {
        label: "Editar",
        icon: <Edit className="h-4 w-4" />,
        onClick: handleOpenEdit,
      },
      {
        label: "Eliminar",
        icon: <Trash2 className="h-4 w-4" />,
        variant: "danger",
        onClick: (question) => setDeleteDialog({ isOpen: true, question }),
      },
    ],
    []
  );

  const renderToolbar = () => (
    <FilterActionBar
      left={
        <div className="flex w-fit rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {(["ADULTOS", "MENORES"] as TargetAudience[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-5 py-2 text-sm font-bold transition-all ${
                activeTab === tab
                  ? "bg-[#094732] text-white shadow-md"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              {tab === "ADULTOS" ? "Publico General" : "Menores de Edad"}
            </button>
          ))}
        </div>
      }
      right={
        <Button onClick={() => void handleOpenCreate()} disabled={isSaving}>
          <Plus className="h-4 w-4" />
          Nueva pregunta
        </Button>
      }
    />
  );

  return (
    <>
      <Layout
        title="Cuestionario de Anamnesis"
        subtitle="Gestiona las preguntas medicas para el expediente del cliente"
        variant="table"
        toolbar={renderToolbar()}
      >
        {!isLoading && !activeQuestionnaire ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/50 py-16 text-center">
            <h3 className="text-lg font-bold text-slate-700">No hay cuestionario activo</h3>
            <p className="mt-1 text-sm text-slate-500">Crea el cuestionario para este segmento.</p>
            <Button className="mt-4" onClick={() => void handleOpenCreate()}>
              Crear cuestionario
            </Button>
          </div>
        ) : (
          <DataTable
            data={tableData}
            columns={columns}
            actions={actions}
            loading={isLoading}
            globalSearchPlaceholder="Buscar pregunta..."
            defaultLimit={10}
            availableLimits={[5, 10, 20, 50]}
            tableMinWidth="min-w-[640px]"
          />
        )}
      </Layout>

      <GenericModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={currentQuestion ? "Editar Pregunta" : "Nueva Pregunta"}
        asForm
        onSubmit={handleSubmit}
        size="lg"
      >
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Pregunta</label>
            <textarea
              value={form.text}
              onChange={(e) => setForm((prev) => ({ ...prev, text: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#094732]"
              rows={4}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Tipo</label>
              <select
                value={form.question_type}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, question_type: e.target.value as QuestionType }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              >
                {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={form.is_required}
                onChange={(e) => setForm((prev) => ({ ...prev, is_required: e.target.checked }))}
                className="h-4 w-4"
              />
              Obligatoria
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </GenericModal>

      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        title="Eliminar pregunta"
        message="¿Estas seguro que deseas eliminar esta pregunta?"
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setDeleteDialog({ isOpen: false, question: null })}
        isProcessing={isSaving}
      />
    </>
  );
}
