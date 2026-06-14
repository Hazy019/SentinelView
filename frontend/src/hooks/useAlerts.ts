/**
 * useAlerts — WebSocket client hook with REST fallback re-hydration.
 *
 * Flow:
 * 1. POST /auth/ws-ticket → get one-time ticket (JWT in Authorization header).
 * 2. Connect to ws(s)://<backend>/ws?ticket=<uuid>.
 * 3. On message: prepend alert to state (newest-first).
 * 4. On disconnect: re-hydrate from GET /api/v1/alerts?limit=50 (REST fallback).
 * 5. On reconnect: request a fresh ticket and reconnect.
 *
 * Security: JWT is NEVER placed in the WebSocket URL. Only the short-lived
 * ticket (30s TTL, single-use) appears as a query param.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export interface Alert {
  alert_id: string;
  timestamp: string;
  source_ip: string;
  threat_type: "BRUTE_FORCE" | "PORT_SCAN" | "DATA_EXFIL";
  confidence: "LOW" | "MEDIUM" | "HIGH";
  detail: string;
}

export type WsStatus = "connecting" | "connected" | "disconnected" | "error";

const MAX_ALERTS = 100;
const RECONNECT_DELAY_MS = 3000;
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export function useAlerts() {
  const { isAuthenticated } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [wsStatus, setWsStatus] = useState<WsStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  /** Fetch alert history via REST fallback and merge into state. */
  const rehydrate = useCallback(async () => {
    try {
      const { data } = await api.get<Alert[]>("/api/v1/alerts?limit=50");
      if (!isMountedRef.current) return;
      setAlerts((prev) => {
        const existingIds = new Set(prev.map((a) => a.alert_id));
        const incoming = data.filter((a) => !existingIds.has(a.alert_id));
        return [...prev, ...incoming]
          .sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
          .slice(0, MAX_ALERTS);
      });
    } catch {
      // REST fallback failed — silently continue (WebSocket reconnect will retry)
    }
  }, []);

  /** Open a new authenticated WebSocket connection. */
  const connect = useCallback(async () => {
    if (!isAuthenticated || !isMountedRef.current) return;

    setWsStatus("connecting");

    try {
      // Step 1: Get a one-time ticket (JWT sent in Authorization header by Axios interceptor)
      const { data } = await api.post<{ ticket: string }>("/auth/ws-ticket");
      const ticket = data.ticket;

      // Step 2: Build WS URL — ticket in query param, JWT NEVER in URL
      const wsBase = BASE_URL.replace(/^http/, "ws");
      const wsUrl = `${wsBase}/ws?ticket=${ticket}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) { ws.close(); return; }
        setWsStatus("connected");
      };

      ws.onmessage = (evt) => {
        try {
          const alert: Alert = JSON.parse(evt.data);
          if (!isMountedRef.current) return;
          setAlerts((prev) =>
            [alert, ...prev].slice(0, MAX_ALERTS)
          );
        } catch {
          // Malformed message — ignore
        }
      };

      ws.onclose = async () => {
        if (!isMountedRef.current) return;
        setWsStatus("disconnected");
        // REST fallback re-hydration on disconnect
        await rehydrate();
        // Schedule reconnect
        reconnectTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) connect();
        }, RECONNECT_DELAY_MS);
      };

      ws.onerror = () => {
        if (!isMountedRef.current) return;
        setWsStatus("error");
      };
    } catch {
      if (!isMountedRef.current) return;
      setWsStatus("error");
      reconnectTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) connect();
      }, RECONNECT_DELAY_MS);
    }
  }, [isAuthenticated, rehydrate]);

  useEffect(() => {
    isMountedRef.current = true;
    if (isAuthenticated) connect();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [isAuthenticated, connect]);

  return { alerts, wsStatus };
}
