import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connectors",
  description:
    "Set up personal credentials for the tools your agents use. Connectors are per person, not per organisation.",
};

export default function ConnectorsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
