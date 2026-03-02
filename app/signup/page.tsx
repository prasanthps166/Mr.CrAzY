import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Sign Up",
  description: "Create your PromptGallery account to unlock more credits and save generations.",
  path: "/signup",
  noIndex: true,
});

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
