/**
 * useAlerts — Multi-Tenant WebSocket client hook with Zero-Gap Backfill.
 *
 * Reliability guarantees:
 * 1. Monotonic sequence numbering (lastSeqRef) to detect network gaps.
 * 2. Automatic reconnect with ?last_seq=<n> to retrieve missed alerts from tenant ring buffer.
 * 3. Atomic backfill ingestion with deduplication (no UI reflow or duplicate keys).
 * 4. REST fallback re-hydration with ?since_seq=<n> on persistent failure.
 * 5. Multi-tenant channel isolation (tenantId passed from AuthContext).
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
  tenant_id?: string;
  seq?: number;
}

export type WsStatus = "connecting" | "connected" | "disconnected" | "error";

const MAX_ALERTS = 100;
const RECONNECT_DELAY_MS = 3000;
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export function useAlerts() {
  const { isAuthenticated, tenantId } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [wsStatus, setWsStatus] = useState<WsStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // Monotonic sequence tracker for zero-gap backfilling
  const lastSeqRef = useRef<number>(0);

  /** Fetch alert history via REST fallback and merge into state. */
  const rehydrate = useCallback(async () => {
    try {
      const sinceParam = lastSeqRef.current > 0 ? `&since_seq=${lastSeqRef.current}` : "";
      const { data } = await api.get<Alert[]>(
        `/api/v1/alerts?limit=50&tenant_id=${tenantId}${sinceParam}`
      );
      if (!isMountedRef.current) return;

      setAlerts((prev) => {
        const existingIds = new Set(prev.map((a) => a.alert_id));
        const incoming = data.filter((a) => !existingIds.has(a.alert_id));

        for (const a of incoming) {
          if (a.seq && a.seq > lastSeqRef.current) {
            lastSeqRef.current = a.seq;
          }
        }

        return [...incoming, ...prev]
          .sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
          .slice(0, MAX_ALERTS);
      });
    } catch {
      // Silently continue (WebSocket reconnect will retry)
    }
  }, [tenantId]);

  /** Open a new authenticated WebSocket connection with backfill parameters. */
  const connect = useCallback(async () => {
    if (!isAuthenticated || !isMountedRef.current) return;

    setWsStatus("connecting");

    try {
      // Step 1: Request one-time ticket bound to current tenant
      const { data } = await api.post<{ ticket: string; tenant_id: string }>(
        `/auth/ws-ticket?tenant_id=${tenantId}`
      );
      const ticket = data.ticket;

      // Step 2: Build WS URL — pass ticket, tenant_id, and last_seq for zero-gap recovery
      const wsBase = BASE_URL.replace(/^http/, "ws");
      const seqQuery = lastSeqRef.current > 0 ? `&last_seq=${lastSeqRef.current}` : "";
      const wsUrl = `${wsBase}/ws?ticket=${ticket}&tenant_id=${tenantId}${seqQuery}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) {
          ws.close();
          return;
        }
        setWsStatus("connected");
      };

      ws.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data);

          // Handle zero-gap backfill message on reconnect
          if (parsed.type === "BACKFILL" && Array.isArray(parsed.alerts)) {
            const backfillAlerts: Alert[] = parsed.alerts;
            if (!isMountedRef.current || backfillAlerts.length === 0) return;

            setAlerts((prev) => {
              const existingIds = new Set(prev.map((a) => a.alert_id));
              const newAlerts = backfillAlerts.filter((a) => !existingIds.has(a.alert_id));

              for (const a of backfillAlerts) {
                if (a.seq && a.seq > lastSeqRef.current) {
                  lastSeqRef.current = a.seq;
                }
              }

              return [...newAlerts, ...prev].slice(0, MAX_ALERTS);
            });
            return;
          }

          // Handle live single alert frame
          const alert: Alert = parsed;
          if (!isMountedRef.current) return;

          if (alert.seq && alert.seq > lastSeqRef.current) {
            lastSeqRef.current = alert.seq;
          }

          setAlerts((prev) => [
            alert,
            ...prev.filter((a) => a.alert_id !== alert.alert_id),
          ].slice(0, MAX_ALERTS));
        } catch {
          // Malformed message — ignore
        }
      };

      ws.onclose = async () => {
        if (!isMountedRef.current) return;
        setWsStatus("disconnected");
        // Trigger REST fallback re-hydration
        await rehydrate();
        // Schedule auto-reconnect
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
  }, [isAuthenticated, tenantId, rehydrate]);

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
