import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Integrations",
  description:
    "Connect Aegis to your dev tools. Works with Cursor, VS Code, and Claude Code via the Model Context Protocol.",
};

export default function IntegrationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
