import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Set up your workspace",
  description:
    "Connect your GitHub repositories and configure your first agent governance policies.",
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
