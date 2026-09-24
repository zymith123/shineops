"use client";

import { useActionState, useRef } from "react";
import { login, type LoginState } from "./actions";
import { Button, Field, inputClass } from "@/components/ui";

const DEMO_ACCOUNTS = [
  { label: "Owner", email: "owner@sparkleco.demo" },
  { label: "Manager", email: "manager@sparkleco.demo" },
  { label: "Cleaner", email: "maria@sparkleco.demo" },
  { label: "Client", email: "hannah.lee@example.com" },
  { label: "Platform admin", email: "admin@shineops.demo" },
];

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <form action={action} className="space-y-4">
        <Field label="Email">
          <input ref={emailRef} name="email" type="email" autoComplete="email" required className={inputClass} />
        </Field>
        <Field label="Password">
          <input ref={passwordRef} name="password" type="password" autoComplete="current-password" required className={inputClass} />
        </Field>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <Button type="submit" loading={pending} className="w-full">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="mt-6 border-t border-slate-100 pt-5">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Demo accounts (password: demo1234)</p>
        <div className="grid grid-cols-2 gap-2 [&>button:last-child]:col-span-2">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.email}
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-2 text-left text-xs hover:border-brand-500 hover:bg-brand-50"
              onClick={() => {
                if (emailRef.current) emailRef.current.value = a.email;
                if (passwordRef.current) passwordRef.current.value = "demo1234";
              }}
            >
              <span className="block font-semibold text-slate-700">{a.label}</span>
              <span className="text-slate-400">{a.email}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
