import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Login",
  description: "Sign in to PromptGallery to generate images, manage credits, and access your dashboard.",
  path: "/login",
  noIndex: true,
});

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
