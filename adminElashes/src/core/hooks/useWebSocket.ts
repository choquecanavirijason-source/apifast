import { useEffect, useRef, useCallback } from "react";
import variables from "@/core/config/variables";

export type WsEvent =
  | { event: "ticket_created"; ticket_id: number; status: string; professional_id: number | null }
  | { event: "ticket_updated"; ticket_id: number; status: string; professional_id: number | null }
  | { event: "ticket_called";  ticket_id: number; status: string; professional_id: number | null }
  | { event: "ticket_deleted"; ticket_id: number };

type WsEventHandler = (data: WsEvent) => void;

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 2_000;

function getWsUrl(branchId: number): string {
  const base = variables.apiUrl.replace(/^http/, "ws").replace(/\/api\/?$/, "");
  return `${base}/ws/branch/${branchId}`;
}

export function useWebSocket(branchId: number | null, onEvent: WsEventHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retriesRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!branchId) return;
    if (retriesRef.current >= MAX_RETRIES) return;

    const ws = new WebSocket(getWsUrl(branchId));
    wsRef.current = ws;

    ws.onopen = () => {
      retriesRef.current = 0;
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
      if (e.code === 1000) return;

      retriesRef.current += 1;
      if (retriesRef.current >= MAX_RETRIES) return;

      const delay = Math.min(BASE_DELAY_MS * 2 ** (retriesRef.current - 1), 30_000);
      retryTimerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => ws.close();
  }, [branchId]);

  useEffect(() => {
    retriesRef.current = 0;
    connect();
    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      wsRef.current?.close(1000, "unmount");
    };
  }, [connect]);
}
