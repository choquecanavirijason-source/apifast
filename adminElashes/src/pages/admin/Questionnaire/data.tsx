import type { Question } from "./types";

export const defaultQuestions: Question[] = [
  { id: 1, text: "¿El niño tiene miedo a objetos cerca de los ojos?", type: "yes_no", required: true, target: "NIÑOS" },
  { id: 2, text: "¿Es capaz de permanecer quieto por 30 mins?", type: "yes_no", required: true, target: "NIÑOS" },
  { id: 3, text: "¿Usas lentes de contacto habitualmente?", type: "yes_no", required: true, target: "JOVENES" },
  { id: 4, text: "¿Buscas un look natural o dramático?", type: "selection", required: false, target: "JOVENES" },
  { id: 5, text: "¿Sufres de resequedad ocular crónica?", type: "yes_no", required: true, target: "ADULTOS" },
];