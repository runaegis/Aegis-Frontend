import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Authentication",
  description:
    "Create an account or sign in to Aegis.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
