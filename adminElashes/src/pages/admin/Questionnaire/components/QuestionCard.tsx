import React from "react";
import { Edit, Trash2, Type, CheckCircle, List } from "lucide-react";
import type { Question } from "../types";

interface Props {
  question: Question;
  onEdit: (q: Question) => void;
  onDelete: (q: Question) => void;
}

export const QuestionCard: React.FC<Props> = ({ question, onEdit, onDelete }) => {
  
  const getTypeConfig = (type: string) => {
    switch (type) {
      case "yes_no": return { label: "Sí/No", icon: <CheckCircle className="w-3.5 h-3.5" /> };
      case "selection": return { label: "Selección", icon: <List className="w-3.5 h-3.5" /> };
      default: return { label: "Texto", icon: <Type className="w-3.5 h-3.5" /> };
    }
  };

  const config = getTypeConfig(question.type);

  return (
    <div className="group bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-all duration-300 flex flex-col h-full relative overflow-hidden">
      {/* Indicador superior */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100 group-hover:bg-gray-900 transition-colors" />

      <div className="flex justify-between items-start mb-3 mt-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-50 text-gray-600 border border-gray-100">
          {config.icon}
          {config.label}
        </span>
        
        {question.required && (
          <span className="text-[10px] font-bold tracking-wider text-white bg-black px-2 py-0.5 rounded-full">
            REQ
          </span>
        )}
      </div>

      <h3 className="text-gray-900 font-medium leading-relaxed mb-6 flex-1">
        {question.text}
      </h3>

      <div className="flex items-center gap-2 pt-4 border-t border-gray-50 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <button 
          onClick={() => onEdit(question)}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold uppercase tracking-wide transition-colors"
        >
          <Edit className="w-3.5 h-3.5" /> Editar
        </button>
        <button 
          onClick={() => onDelete(question)}
          className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};