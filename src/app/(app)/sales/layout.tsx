import { requireRole, STAFF } from "@/lib/auth";
import { aiEnabled } from "@/lib/ai/client";
import Link from "next/link";
import { Upload } from "lucide-react";
import { buttonClass, PageHeader } from "@/components/ui";
import { LinkPending } from "@/components/loading";
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
        subtitle={aiEnabled() ? "Calls analyzed by AI" : "Calls classified with keyword rules. AI analysis and coaching aren't configured yet"}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/sales/calls/upload" className={buttonClass("secondary")}>
              <Upload className="h-4 w-4" /> Upload a call
              <LinkPending collapse />
            </Link>
            <AnalyzeCallsButton ai={aiEnabled()} />
          </div>
        }
      />
      <SalesTabs />
      <div className="mt-6">{children}</div>
    </>
  );
}
