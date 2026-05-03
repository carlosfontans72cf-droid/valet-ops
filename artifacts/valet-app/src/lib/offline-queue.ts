export interface QueuedMutation {
  id: string;
  type: "createTicket" | "updateTicket" | "deleteTicket";
  payload: Record<string, unknown>;
  label: string;
  timestamp: number;
}

const KEY = "valet_offline_queue";

export const offlineQueue = {
  getAll: (): QueuedMutation[] => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch {
      return [];
    }
  },

  add: (item: Omit<QueuedMutation, "id" | "timestamp">): QueuedMutation => {
    const queue = offlineQueue.getAll();
    const entry: QueuedMutation = {
      ...item,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    queue.push(entry);
    localStorage.setItem(KEY, JSON.stringify(queue));
    return entry;
  },

  remove: (id: string): void => {
    const queue = offlineQueue.getAll().filter((i) => i.id !== id);
    localStorage.setItem(KEY, JSON.stringify(queue));
  },

  clear: (): void => {
    localStorage.removeItem(KEY);
  },

  count: (): number => offlineQueue.getAll().length,
};
