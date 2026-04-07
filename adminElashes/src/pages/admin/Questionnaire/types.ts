export type TargetAudience = "NIÑOS" | "JOVENES" | "ADULTOS";
export type QuestionType = "text" | "yes_no" | "selection";

export interface Question {
  id: number;
  text: string;
  type: QuestionType;
  required: boolean;
  target: TargetAudience;
}

export const SECTIONS = [
  { id: "NIÑOS", label: "Niños" },
  { id: "JOVENES", label: "Jóvenes" },
  { id: "ADULTOS", label: "Adultos" },
] as const;     