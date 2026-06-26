import { useEffect, useRef, useCallback } from "react";
import variables from "@/core/config/variables";

export type WsEvent =
  | { event: "ticket_created"; ticket_id: number; status: string; professional_id: number | null }
  | { event: "ticket_updated"; ticket_id: number; status: string; professional_id: number | null }
  | { event: "ticket_called";  ticket_id: number; status: string; professional_id: number | null }
  | { event: "ticket_deleted"; ticket_id: number };

type WsEventHandler = (data: WsEvent) => void;

function getWsUrl(branchId: number): string {
  const base = variables.apiUrl.replace(/^http/, "ws").replace(/\/api\/?$/, "");
  return `${base}/ws/branch/${branchId}`;
}

export function useWebSocket(branchId: number | null, onEvent: WsEventHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!branchId) return;

    const ws = new WebSocket(getWsUrl(branchId));
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as WsEvent;
        onEventRef.current(data);
      } catch {
        // ignorar mensajes malformados
      }
    };

    ws.onclose = (e) => {
      // reconectar solo si no fue cierre intencional
      if (e.code !== 1000) {
        setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => ws.close();
  }, [branchId]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close(1000, "unmount");
    };
  }, [connect]);
}
