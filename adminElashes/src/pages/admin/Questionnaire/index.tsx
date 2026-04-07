import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Edit, Trash2, HelpCircle } from "lucide-react";
import { toast } from "react-toastify";

import GenericModal from "@/components/common/modal/GenericModal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/common/ui";
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
  const [search, setSearch] = useState("");
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

  const filteredQuestions = useMemo(() => {
    const questions = activeQuestionnaire?.questions ?? [];
    return questions.filter((question) =>
      question.text.toLowerCase().includes(search.toLowerCase())
    );
  }, [activeQuestionnaire, search]);

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

  const handleOpenEdit = (question: QuestionForm) => {
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

  return (
    <div className="p-6 md:p-10 min-h-screen bg-slate-50/50 font-sans">
      <div className="mb-8 flex items-center gap-3">
        <div className="p-2 bg-emerald-100 rounded-lg">
          <HelpCircle className="w-6 h-6 text-[#094732]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cuestionario de Anamnesis</h1>
          <p className="text-slate-500 text-sm">Gestiona las preguntas medicas para el expediente</p>
        </div>
      </div>

      <div className="bg-emerald-50/40 rounded-[1.5rem] border border-emerald-100 shadow-sm p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex p-1 bg-white rounded-xl border border-slate-200 shadow-sm w-fit">
            {(["ADULTOS", "MENORES"] as TargetAudience[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`
                  px-6 py-2.5 rounded-lg text-sm font-bold transition-all
                  ${activeTab === tab 
                    ? "bg-[#094732] text-white shadow-md" 
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }
                `}
              >
                {tab === "ADULTOS" ? "Publico General" : "Menores de Edad"}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div className="relative w-full sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar pregunta..."
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#094732] focus:border-transparent outline-none text-slate-700 shadow-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button
              onClick={() => void handleOpenCreate()}
              disabled={isSaving}
              className="bg-[#094732] hover:bg-[#063324] text-white font-bold rounded-xl px-6 py-3 shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 transform active:scale-95 transition-all whitespace-nowrap disabled:opacity-70"
            >
              <Plus className="w-5 h-5" />
              <span>Nueva Pregunta</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading && (
            <div className="col-span-full py-16 text-center bg-white/50 rounded-2xl border border-dashed border-slate-300">
              <h3 className="text-lg font-bold text-slate-700">Cargando cuestionario...</h3>
              <p className="text-slate-500 text-sm mt-1">Estamos sincronizando los datos.</p>
            </div>
          )}

          {!isLoading && !activeQuestionnaire && (
            <div className="col-span-full py-16 text-center bg-white/50 rounded-2xl border border-dashed border-slate-300">
              <h3 className="text-lg font-bold text-slate-700">No hay cuestionario activo</h3>
              <p className="text-slate-500 text-sm mt-1">Crea el cuestionario para este segmento.</p>
              <Button className="mt-4" onClick={() => void handleOpenCreate()}>
                Crear cuestionario
              </Button>
            </div>
          )}

          {!isLoading && activeQuestionnaire && filteredQuestions.length === 0 && (
            <div className="col-span-full py-16 text-center bg-white/50 rounded-2xl border border-dashed border-slate-300">
              <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-700">No se encontraron preguntas</h3>
              <p className="text-slate-500 text-sm mt-1">Prueba con otro termino de busqueda o cambia de pestaña.</p>
            </div>
          )}

          {!isLoading && activeQuestionnaire && filteredQuestions.map((question) => (
            <div
              key={question.id}
              className="bg-white rounded-2xl border border-emerald-100/60 p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-800">{question.text}</h3>
                  <p className="text-xs text-slate-500 mt-2">
                    {QUESTION_TYPE_LABELS[question.question_type]}
                    {question.is_required ? " · Obligatoria" : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenEdit(question)}
                    className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteDialog({ isOpen: true, question })}
                    className="p-2 rounded-lg text-rose-500 hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

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
            <label className="block text-sm font-semibold text-slate-700 mb-2">Pregunta</label>
            <textarea
              value={form.text}
              onChange={(e) => setForm((prev) => ({ ...prev, text: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#094732] focus:border-transparent outline-none text-sm"
              rows={4}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Tipo</label>
              <select
                value={form.question_type}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, question_type: e.target.value as QuestionType }))
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
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
                className="w-4 h-4"
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
    </div>
  );
}
