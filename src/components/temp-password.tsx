/** Shown once after creating a login or resetting a password. */
export function TempPassword({ email, password, note }: { email: string; password: string; note?: string }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
      {note && <p className="mb-1 font-medium">{note}</p>}
      <p>
        Login: <b>{email}</b>
      </p>
      <p>
        Temporary password: <code className="select-all font-mono font-semibold">{password}</code>
      </p>
      <p className="mt-1 text-emerald-700">Copy it now. It won&apos;t be shown again.</p>
    </div>
  );
}
