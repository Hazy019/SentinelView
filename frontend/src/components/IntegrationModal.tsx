/**
 * IntegrationModal — Interactive Developer Integration & API Hub.
 * Provides ready-to-use snippets for connecting external websites, servers, and log shippers.
 */

"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface IntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = "curl" | "python" | "nodejs" | "shippers" | "webhooks" | "embed";

export default function IntegrationModal({ isOpen, onClose }: IntegrationModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("curl");
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const curlSingleSnippet = `curl -X POST "http://localhost:8000/api/v1/ingest" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_INGEST_API_KEY" \\
  -d '{
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
    "source_ip": "185.220.101.47",
    "dest_ip": "10.0.0.1",
    "action": "LOGIN",
    "status_code": 401,
    "username": "admin",
    "bytes_sent": 120
  }'`;

  const curlBatchSnippet = `curl -X POST "http://localhost:8000/api/v1/ingest/batch" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_INGEST_API_KEY" \\
  -d '{
    "events": [
      {
        "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
        "source_ip": "185.220.101.47",
        "dest_ip": "10.0.0.1",
        "action": "LOGIN",
        "status_code": 401,
        "username": "admin",
        "bytes_sent": 120
      },
      {
        "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
        "source_ip": "45.33.32.156",
        "dest_ip": "192.168.1.10",
        "action": "TRANSFER",
        "status_code": 200,
        "bytes_sent": 15000000
      }
    ]
  }'`;

  const pythonSnippet = `import requests
from datetime import datetime, timezone

# 1. Send single security event
payload = {
    "timestamp": datetime.now(timezone.utc).isoformat(),
    "source_ip": "185.220.101.47",
    "dest_ip": "10.0.0.1",
    "action": "LOGIN",
    "status_code": 401,
    "username": "root",
    "bytes_sent": 64
}

response = requests.post(
    "http://localhost:8000/api/v1/ingest",
    headers={"X-API-Key": "YOUR_INGEST_API_KEY"},
    json=payload
)
print("Ingest Status:", response.json())`;

  const nodeSnippet = `// Ingest from Next.js, Express, Fastify, or Cloudflare Workers
async function sendSecurityTelemetry(log) {
  const res = await fetch("http://localhost:8000/api/v1/ingest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": process.env.SENTINEL_API_KEY || "YOUR_API_KEY"
    },
    body: JSON.stringify({
      timestamp: new Date().toISOString(),
      source_ip: log.clientIp,
      dest_ip: log.serverIp,
      action: log.action, // "LOGIN" | "REQUEST" | "TRANSFER"
      status_code: log.statusCode,
      username: log.user || null,
      bytes_sent: log.bytesSent || 0
    })
  });
  return res.json();
}`;

  const vectorConfig = `# Vector / Fluent Bit / Logstash Log Pipeline
[sinks.sentinelview]
type = "http"
inputs = ["nginx_access_logs"]
uri = "http://sentinel-backend:8000/api/v1/ingest/batch"
method = "post"
encoding.codec = "json"

[sinks.sentinelview.headers]
"X-API-Key" = "YOUR_SECRET_INGEST_API_KEY"
"Content-Type" = "application/json"`;

  const webhookDocs = `// Outbound Webhook payload sent by SentinelView when threat is detected
{
  "event": "sentinelview.alert",
  "data": {
    "alert_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "timestamp": "2026-08-31T14:30:00Z",
    "source_ip": "185.220.101.47",
    "threat_type": "BRUTE_FORCE",
    "confidence": "HIGH",
    "detail": "6 failed login attempts from 185.220.101.47 in 10s window"
  }
}

// Enable in backend/.env:
// ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/... (or Slack/SOAR URL)`;

  const embedSnippet = `<!-- Embed SentinelView Live Threat Radar into any external portal or trust page -->
<iframe
  src="http://localhost:3000/dashboard"
  width="100%"
  height="700px"
  style="border: none; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.08);"
  title="SentinelView Real-Time Cyber Threat Visualizer"
  allow="accelerometer; autoplay"
></iframe>`;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-blue-50 text-[#2563EB] text-sm">🔌</span>
            <div>
              <h2 className="text-base font-extrabold font-sans text-slate-900 tracking-tight">
                Integrations & Ingestion API Hub
              </h2>
              <p className="text-xs text-slate-500 font-sans">
                Connect external websites, microservices, and log pipelines to SentinelView
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-100 flex gap-2 overflow-x-auto bg-white pt-2">
          {[
            { id: "curl", label: "cURL / HTTP", icon: "⚡" },
            { id: "python", label: "Python SDK", icon: "🐍" },
            { id: "nodejs", label: "Node.js / TS", icon: "🟢" },
            { id: "shippers", label: "Log Shippers", icon: "📦" },
            { id: "webhooks", label: "Outbound Webhooks", icon: "🔔" },
            { id: "embed", label: "Iframe Embed", icon: "🌐" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-3.5 py-2 text-xs font-sans font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-[#2563EB] text-[#2563EB] bg-blue-50/40 rounded-t-lg"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/40 text-xs font-sans">
          {activeTab === "curl" && (
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-xl border border-slate-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-slate-800 uppercase font-mono text-[11px]">
                    1. Ingest Single Log Event (`POST /api/v1/ingest`)
                  </span>
                  <button
                    onClick={() => copyToClipboard(curlSingleSnippet, "curl-single")}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all font-mono"
                  >
                    {copied === "curl-single" ? "✓ Copied" : "Copy cURL"}
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto font-mono text-[11px] leading-relaxed">
                  {curlSingleSnippet}
                </pre>
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-slate-800 uppercase font-mono text-[11px]">
                    2. Ingest Batch of Logs (`POST /api/v1/ingest/batch` up to 500 events)
                  </span>
                  <button
                    onClick={() => copyToClipboard(curlBatchSnippet, "curl-batch")}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all font-mono"
                  >
                    {copied === "curl-batch" ? "✓ Copied" : "Copy cURL"}
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto font-mono text-[11px] leading-relaxed">
                  {curlBatchSnippet}
                </pre>
              </div>
            </div>
          )}

          {activeTab === "python" && (
            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800 uppercase font-mono text-[11px]">
                  Python Script / Django / Flask / FastAPI Telemetry Shipper
                </span>
                <button
                  onClick={() => copyToClipboard(pythonSnippet, "python")}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all font-mono"
                >
                  {copied === "python" ? "✓ Copied" : "Copy Python"}
                </button>
              </div>
              <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto font-mono text-[11px] leading-relaxed">
                {pythonSnippet}
              </pre>
            </div>
          )}

          {activeTab === "nodejs" && (
            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800 uppercase font-mono text-[11px]">
                  Node.js / Express / Next.js Telemetry Middleware
                </span>
                <button
                  onClick={() => copyToClipboard(nodeSnippet, "node")}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all font-mono"
                >
                  {copied === "node" ? "✓ Copied" : "Copy Code"}
                </button>
              </div>
              <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto font-mono text-[11px] leading-relaxed">
                {nodeSnippet}
              </pre>
            </div>
          )}

          {activeTab === "shippers" && (
            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800 uppercase font-mono text-[11px]">
                  Vector / Fluent Bit / Logstash Pipeline Configuration
                </span>
                <button
                  onClick={() => copyToClipboard(vectorConfig, "shippers")}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all font-mono"
                >
                  {copied === "shippers" ? "✓ Copied" : "Copy Config"}
                </button>
              </div>
              <p className="text-slate-600">
                Forward your production server web logs (NGINX, Cloudflare, Traefik, HAProxy) in batches to SentinelView in real-time.
              </p>
              <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto font-mono text-[11px] leading-relaxed">
                {vectorConfig}
              </pre>
            </div>
          )}

          {activeTab === "webhooks" && (
            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800 uppercase font-mono text-[11px]">
                  Outbound Real-Time Webhooks (Discord, Slack, SOAR, SIEM)
                </span>
                <button
                  onClick={() => copyToClipboard(webhookDocs, "webhooks")}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all font-mono"
                >
                  {copied === "webhooks" ? "✓ Copied" : "Copy"}
                </button>
              </div>
              <p className="text-slate-600">
                Whenever SentinelView detects an anomaly (Brute Force, Port Scan, Data Exfil), it immediately POSTs this JSON payload to your configured webhook URL.
              </p>
              <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto font-mono text-[11px] leading-relaxed">
                {webhookDocs}
              </pre>
            </div>
          )}

          {activeTab === "embed" && (
            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800 uppercase font-mono text-[11px]">
                  Embed Threat Radar into External Company Dashboards & Trust Centers
                </span>
                <button
                  onClick={() => copyToClipboard(embedSnippet, "embed")}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all font-mono"
                >
                  {copied === "embed" ? "✓ Copied" : "Copy Iframe"}
                </button>
              </div>
              <p className="text-slate-600">
                Display the live 3D attack globe and cyber telemetry inside your internal NOC/SOC wallboards or customer-facing security portals.
              </p>
              <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto font-mono text-[11px] leading-relaxed">
                {embedSnippet}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-white flex justify-between items-center">
          <span className="text-[11px] font-mono text-slate-400">
            Auth: JWT Bearer or `X-API-Key: &lt;key&gt;`
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold font-sans bg-slate-900 text-white hover:bg-slate-800 transition-all"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
}
