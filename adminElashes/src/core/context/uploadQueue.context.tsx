import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

export type UploadTaskStatus = "queued" | "uploading" | "processing" | "done" | "error";

export interface UploadTask {
  id: string;
  label: string;
  status: UploadTaskStatus;
  progress: number;
  error?: string;
}

interface EnqueueArgs<T> {
  label: string;
  run: (onProgress: (percent: number) => void) => Promise<T>;
  onDone?: (result: T) => void;
}

interface UploadQueueContextValue {
  tasks: UploadTask[];
  enqueue: <T>(args: EnqueueArgs<T>) => void;
  dismiss: (id: string) => void;
}

const UploadQueueContext = createContext<UploadQueueContextValue | null>(null);

interface QueuedJob {
  id: string;
  run: (onProgress: (percent: number) => void) => Promise<unknown>;
  onDone?: (result: unknown) => void;
}

export function UploadQueueProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const queueRef = useRef<QueuedJob[]>([]);
  const processingRef = useRef(false);

  const updateTask = useCallback((id: string, patch: Partial<UploadTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const processNext = useCallback(() => {
    if (processingRef.current) return;
    const job = queueRef.current.shift();
    if (!job) return;
    processingRef.current = true;
    updateTask(job.id, { status: "uploading", progress: 0 });

    job
      .run((percent) => {
        updateTask(job.id, { progress: percent });
        if (percent >= 100) {
          updateTask(job.id, { status: "processing" });
        }
      })
      .then((result) => {
        updateTask(job.id, { status: "done", progress: 100 });
        job.onDone?.(result);
        setTimeout(() => {
          setTasks((prev) => prev.filter((t) => t.id !== job.id));
        }, 4000);
      })
      .catch((err) => {
        updateTask(job.id, {
          status: "error",
          error: err instanceof Error ? err.message : "Error al subir",
        });
      })
      .finally(() => {
        processingRef.current = false;
        processNext();
      });
  }, [updateTask]);

  const enqueue = useCallback(
    <T,>(args: EnqueueArgs<T>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setTasks((prev) => [...prev, { id, label: args.label, status: "queued", progress: 0 }]);
      queueRef.current.push({
        id,
        run: args.run,
        onDone: args.onDone as ((result: unknown) => void) | undefined,
      });
      processNext();
    },
    [processNext],
  );

  const dismiss = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <UploadQueueContext.Provider value={{ tasks, enqueue, dismiss }}>
      {children}
    </UploadQueueContext.Provider>
  );
}

export function useUploadQueue(): UploadQueueContextValue {
  const ctx = useContext(UploadQueueContext);
  if (!ctx) throw new Error("useUploadQueue debe usarse dentro de UploadQueueProvider");
  return ctx;
}
