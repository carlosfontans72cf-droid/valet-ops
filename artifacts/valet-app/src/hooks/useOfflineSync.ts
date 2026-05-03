import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createTicket,
  updateTicket,
  deleteTicket,
} from "@workspace/api-client-react";
import { offlineQueue, QueuedMutation } from "@/lib/offline-queue";
import { useOnlineStatus } from "./useOnlineStatus";
import { toast } from "sonner";

export function useOfflineSync() {
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();
  const isSyncing = useRef(false);

  useEffect(() => {
    if (!isOnline || isSyncing.current) return;
    const queue = offlineQueue.getAll();
    if (queue.length === 0) return;

    isSyncing.current = true;

    (async () => {
      let successCount = 0;
      let failCount = 0;

      for (const item of queue) {
        try {
          await replayMutation(item);
          offlineQueue.remove(item.id);
          successCount++;
        } catch {
          failCount++;
        }
      }

      queryClient.invalidateQueries({ predicate: (q) => true });

      if (successCount > 0) {
        toast.success(
          `${successCount} ${successCount === 1 ? "acción sincronizada" : "acciones sincronizadas"} ✓`
        );
      }
      if (failCount > 0) {
        toast.error(
          `${failCount} ${failCount === 1 ? "acción no pudo sincronizarse" : "acciones no pudieron sincronizarse"}`
        );
      }

      isSyncing.current = false;
    })();
  }, [isOnline, queryClient]);
}

async function replayMutation(item: QueuedMutation): Promise<void> {
  if (item.type === "createTicket") {
    await createTicket(item.payload as Parameters<typeof createTicket>[0]);
  } else if (item.type === "updateTicket") {
    const { ticketId, data } = item.payload as { ticketId: number; data: Parameters<typeof updateTicket>[1] };
    await updateTicket(ticketId, data);
  } else if (item.type === "deleteTicket") {
    const { ticketId } = item.payload as { ticketId: number };
    await deleteTicket(ticketId);
  }
}
