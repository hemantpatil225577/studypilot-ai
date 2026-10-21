import { AuthForm } from "@/components/auth-form";
export default function Page({ searchParams }: { searchParams: { error?: string } }) {
  return <AuthForm mode="login" notice={searchParams.error === "confirm" ? "That confirmation link is invalid or expired. Sign in or register again." : undefined} />;
}
