import { AlertCircle, CheckCircle2, Loader2, Upload, X } from "lucide-react";
import { useUploadQueue } from "@/core/context/uploadQueue.context";

export default function UploadQueuePanel() {
  const { tasks, dismiss } = useUploadQueue();
  if (tasks.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[2147483000] flex w-80 flex-col gap-2">
      {tasks.map((task) => (
        <div key={task.id} className="rounded-xl border border-[#e2ddd0] bg-white p-3 shadow-lg">
          <div className="flex items-center gap-2">
            {task.status === "done" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : task.status === "error" ? (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            ) : (
              <Upload className="h-4 w-4 shrink-0 text-[#094732]" />
            )}
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#323130]">
              {task.label}
            </span>
            <button
              type="button"
              onClick={() => dismiss(task.id)}
              className="shrink-0 rounded p-0.5 text-[#a19f9d] hover:bg-[#f3f2f1] hover:text-[#323130]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-2 text-xs text-[#605e5c]">
            {task.status === "queued" && "En cola…"}
            {task.status === "uploading" && `Subiendo… ${task.progress}%`}
            {task.status === "processing" && (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Procesando video…
              </span>
            )}
            {task.status === "done" && "Listo ✓"}
            {task.status === "error" && (task.error || "Error al subir")}
          </div>

          {task.status === "uploading" && (
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-[#094732] transition-all duration-200"
                style={{ width: `${task.progress}%` }}
              />
            </div>
          )}
          {task.status === "processing" && (
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-full animate-pulse rounded-full bg-[#094732]" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
