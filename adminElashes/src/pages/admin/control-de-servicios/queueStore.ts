type QueueStatus = "active" | "waiting";

export interface QueueEntry {
  id: string;
  clientId: number;
  clientName: string;
  serviceId: number | null;
  serviceName: string;
  durationMinutes: number;
  status: QueueStatus;
  estimatedStart: string;
  estimatedEnd: string;
  createdAt: string;
  ticketId?: number | null;
}

export interface ServiceHistoryEntry {
  id: string;
  serviceId: number | null;
  serviceName: string;
  clientId: number;
  clientName: string;
  durationMinutes: number;
  startedAt: string;
  endedAt: string;
  notes: string;
  ticketId?: number | null;
}

export interface ServiceQueue {
  serviceId: number | null;
  serviceName: string;
  durationMinutes: number;
  capacity: number;
  active: QueueEntry[];
  waiting: QueueEntry[];
  updatedAt: string;
}

const STORAGE_KEY = "serviceQueueData";
const HISTORY_KEY = "serviceHistoryData";
const DEFAULT_CAPACITY = 2;

const isQueueEntry = (value: unknown): value is QueueEntry => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as QueueEntry;
  return Boolean(candidate.id && candidate.clientName && candidate.serviceName);
};

const isHistoryEntry = (value: unknown): value is ServiceHistoryEntry => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as ServiceHistoryEntry;
  return Boolean(candidate.id && candidate.clientName && candidate.serviceName && candidate.startedAt && candidate.endedAt);
};

const toIso = (date: Date) => date.toISOString();

const addMinutes = (date: Date, minutes: number) => {
  const next = new Date(date.getTime());
  next.setMinutes(next.getMinutes() + minutes);
  return next;
};

const normalizeQueue = (queue: ServiceQueue): ServiceQueue => {
  const active = Array.isArray(queue.active) ? queue.active.filter(isQueueEntry) : [];
  const waiting = Array.isArray(queue.waiting) ? queue.waiting.filter(isQueueEntry) : [];
  return {
    ...queue,
    active,
    waiting,
    capacity: Number(queue.capacity) > 0 ? Number(queue.capacity) : DEFAULT_CAPACITY,
    durationMinutes: Number(queue.durationMinutes) > 0 ? Number(queue.durationMinutes) : 60,
    serviceName: queue.serviceName || "Servicio",
    updatedAt: queue.updatedAt || new Date().toISOString(),
  };
};

const recomputeSchedule = (queue: ServiceQueue): ServiceQueue => {
  let cursor = new Date();
  const nextActive = queue.active.map((entry) => {
    const start = cursor;
    const end = addMinutes(start, Math.max(1, entry.durationMinutes || queue.durationMinutes));
    cursor = end;
    return {
      ...entry,
      status: "active" as QueueStatus,
      estimatedStart: toIso(start),
      estimatedEnd: toIso(end),
    };
  });

  const nextWaiting = queue.waiting.map((entry) => {
    const start = cursor;
    const end = addMinutes(start, Math.max(1, entry.durationMinutes || queue.durationMinutes));
    cursor = end;
    return {
      ...entry,
      status: "waiting" as QueueStatus,
      estimatedStart: toIso(start),
      estimatedEnd: toIso(end),
    };
  });

  return {
    ...queue,
    active: nextActive,
    waiting: nextWaiting,
    updatedAt: new Date().toISOString(),
  };
};

const getQueueMatchIndex = (queues: ServiceQueue[], serviceId: number | null, serviceName: string) => {
  if (serviceId != null) {
    const byId = queues.findIndex((queue) => queue.serviceId === serviceId);
    if (byId >= 0) return byId;
  }
  const normalizedName = serviceName.trim().toLowerCase();
  if (!normalizedName) return -1;
  return queues.findIndex((queue) => queue.serviceId == null && queue.serviceName.trim().toLowerCase() === normalizedName);
};

const ensureQueue = (
  queues: ServiceQueue[],
  payload: { serviceId: number | null; serviceName: string; durationMinutes: number; capacity?: number }
) => {
  const index = getQueueMatchIndex(queues, payload.serviceId, payload.serviceName);
  if (index >= 0) {
    const existing = normalizeQueue(queues[index]);
    const updated = {
      ...existing,
      serviceName: payload.serviceName || existing.serviceName,
      durationMinutes: payload.durationMinutes > 0 ? payload.durationMinutes : existing.durationMinutes,
      capacity: payload.capacity ?? existing.capacity,
    };
    queues[index] = normalizeQueue(updated);
    return queues[index];
  }

  const newQueue: ServiceQueue = normalizeQueue({
    serviceId: payload.serviceId ?? null,
    serviceName: payload.serviceName || "Servicio",
    durationMinutes: payload.durationMinutes > 0 ? payload.durationMinutes : 60,
    capacity: payload.capacity ?? DEFAULT_CAPACITY,
    active: [],
    waiting: [],
    updatedAt: new Date().toISOString(),
  });
  queues.push(newQueue);
  return newQueue;
};

export const loadServiceQueues = (): ServiceQueue[] => {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as ServiceQueue[];
    if (!Array.isArray(data)) return [];
    return data.map(normalizeQueue);
  } catch {
    return [];
  }
};

export const saveServiceQueues = (queues: ServiceQueue[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queues));
};

export const loadServiceHistory = (): ServiceHistoryEntry[] => {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as ServiceHistoryEntry[];
    if (!Array.isArray(data)) return [];
    return data.filter(isHistoryEntry);
  } catch {
    return [];
  }
};

export const saveServiceHistory = (history: ServiceHistoryEntry[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
};

export const addServiceHistoryEntry = (payload: {
  serviceId: number | null;
  serviceName: string;
  clientId: number;
  clientName: string;
  durationMinutes: number;
  startedAt: string;
  endedAt: string;
  notes: string;
  ticketId?: number | null;
}) => {
  const history = loadServiceHistory();
  const entry: ServiceHistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    serviceId: payload.serviceId ?? null,
    serviceName: payload.serviceName || "Servicio",
    clientId: payload.clientId,
    clientName: payload.clientName,
    durationMinutes: payload.durationMinutes,
    startedAt: payload.startedAt,
    endedAt: payload.endedAt,
    notes: payload.notes.trim(),
    ticketId: payload.ticketId ?? null,
  };
  history.unshift(entry);
  saveServiceHistory(history);
  return entry;
};

export const enqueueClientToService = (payload: {
  clientId: number;
  clientName: string;
  serviceId: number | null;
  serviceName: string;
  durationMinutes: number;
  ticketId?: number | null;
}) => {
  const queues = loadServiceQueues();
  const queue = ensureQueue(queues, {
    serviceId: payload.serviceId,
    serviceName: payload.serviceName,
    durationMinutes: payload.durationMinutes,
  });

  const entry: QueueEntry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    clientId: payload.clientId,
    clientName: payload.clientName,
    serviceId: payload.serviceId,
    serviceName: payload.serviceName,
    durationMinutes: payload.durationMinutes,
    status: "active",
    estimatedStart: new Date().toISOString(),
    estimatedEnd: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ticketId: payload.ticketId ?? null,
  };

  if (queue.active.length < queue.capacity) {
    queue.active = [...queue.active, entry];
  } else {
    entry.status = "waiting";
    queue.waiting = [...queue.waiting, entry];
  }

  const updated = recomputeSchedule(queue);
  const index = getQueueMatchIndex(queues, payload.serviceId, payload.serviceName);
  if (index >= 0) queues[index] = updated;
  saveServiceQueues(queues);
  return updated;
};

export const updateServiceCapacity = (payload: {
  serviceId: number | null;
  serviceName: string;
  durationMinutes: number;
  capacity: number;
}) => {
  const queues = loadServiceQueues();
  const queue = ensureQueue(queues, {
    serviceId: payload.serviceId,
    serviceName: payload.serviceName,
    durationMinutes: payload.durationMinutes,
    capacity: payload.capacity,
  });

  const normalizedCapacity = Math.max(1, Math.floor(payload.capacity));
  let active = [...queue.active];
  let waiting = [...queue.waiting];

  if (active.length > normalizedCapacity) {
    const overflow = active.splice(normalizedCapacity);
    waiting = [...overflow, ...waiting];
  }

  queue.capacity = normalizedCapacity;
  queue.active = active;
  queue.waiting = waiting;

  const updated = recomputeSchedule(queue);
  const index = getQueueMatchIndex(queues, payload.serviceId, payload.serviceName);
  if (index >= 0) queues[index] = updated;
  saveServiceQueues(queues);
  return updated;
};

export const completeServiceEntry = (payload: {
  serviceId: number | null;
  serviceName: string;
  entryId: string;
}) => {
  const queues = loadServiceQueues();
  const index = getQueueMatchIndex(queues, payload.serviceId, payload.serviceName);
  if (index < 0) return null;

  const queue = normalizeQueue(queues[index]);
  const active = queue.active.filter((entry) => entry.id !== payload.entryId);
  let waiting = [...queue.waiting];

  if (active.length < queue.capacity && waiting.length > 0) {
    const next = waiting.shift();
    if (next) active.push({ ...next, status: "active" });
  }

  queue.active = active;
  queue.waiting = waiting;

  const updated = recomputeSchedule(queue);
  queues[index] = updated;
  saveServiceQueues(queues);
  return updated;
};
