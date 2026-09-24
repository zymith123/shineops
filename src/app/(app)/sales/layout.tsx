import { requireRole, STAFF } from "@/lib/auth";
import { aiEnabled, AI_MODEL } from "@/lib/ai/client";
import { PageHeader } from "@/components/ui";
import { AnalyzeCallsButton, SalesTabs } from "./sales-client";

// "Analyze calls with AI" runs callers in parallel; the demo's 22 calls take ~20-40s.
// 60s stays within every Vercel plan's function limit.
export const maxDuration = 60;

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  await requireRole(STAFF);
  return (
    <>
      <PageHeader
        title="Sales"
        subtitle={aiEnabled() ? `Calls analyzed by Claude (${AI_MODEL})` : "Calls classified with keyword rules. Add an Anthropic API key for AI analysis and coaching"}
        action={<AnalyzeCallsButton ai={aiEnabled()} />}
      />
      <SalesTabs />
      <div className="mt-6">{children}</div>
    </>
  );
}
