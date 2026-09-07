import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Usage",
  description: "Token usage by day and by tool. Tokens only — no prices.",
};

export default function TokenSpenditureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
