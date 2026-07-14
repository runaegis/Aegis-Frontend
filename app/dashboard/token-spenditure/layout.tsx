import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics",
  description:
    "Track token usage analytics across connectors, tools, agents, and sessions. Compare costs with and without Aegis governance.",
};

export default function TokenSpenditureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
