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
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!branchId) return;

    const ws = new WebSocket(getWsUrl(branchId));
    wsRef.current = ws;

    ws.onopen = () => {
      // Ping cada 25s para mantener la conexión viva
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, 25_000);
    };

    ws.onmessage = (e) => {
      if (e.data === "pong") return;
      try {
        const data = JSON.parse(e.data) as WsEvent;
        onEventRef.current(data);
      } catch {
        // ignorar mensajes malformados
      }
    };

    ws.onclose = (e) => {
      if (pingRef.current) clearInterval(pingRef.current);
      if (e.code !== 1000) setTimeout(connect, 1_000);
    };

    ws.onerror = () => ws.close();
  }, [branchId]);

  useEffect(() => {
    connect();
    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
      wsRef.current?.close(1000, "unmount");
    };
  }, [connect]);
}
