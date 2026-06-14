import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — SentinelView",
  description: "Live cybersecurity threat dashboard with real-time alert feed and 3D attack globe.",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
