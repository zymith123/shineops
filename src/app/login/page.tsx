import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/logo";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-sky-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo size="lg" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-lg font-semibold">Sign in</h1>
          <p className="mb-6 text-sm text-slate-500">Keep your recurring clients happy, and keep them.</p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
