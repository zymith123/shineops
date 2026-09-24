import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { Bot, PhoneCall, Webhook } from "lucide-react";
import { db, schema } from "@/db";
import { requireRole } from "@/lib/auth";
import { aiEnabled } from "@/lib/ai/client";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";

export default async function SettingsPage() {
  const user = await requireRole(["owner"]);
  const [company] = await db.select().from(schema.companies).where(eq(schema.companies.id, user.companyId));
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const url = `${origin}/api/webhooks/feedback`;
  const callsUrl = `${origin}/api/webhooks/calls`;
  const callExample = {
    id: 88213,
    direction: "inbound",
    customer_name: null,
    customer_phone_number: "+1 512 555 0142",
    agent_email: "manager@sparkleco.demo",
    start_time: new Date().toISOString(),
    duration: 142,
    transcription: [
      { speaker: "Agent", text: "Sparkle and Co, this is Rachel, how can I help?" },
      { speaker: "Customer", text: "Hi, my name is Dana Lopez. How much is a biweekly clean for a 3 bedroom?" },
    ],
  };

  const examples = [
    {
      title: "ShineOps format",
      body: { client_email: "robert.chen@example.com", rating: 2, comment: "Kitchen floor was still sticky", external_id: "sms-8812" },
    },
    {
      title: "Review platform (review.created)",
      body: { event: "review.created", review: { id: 99812, reviewer: { email: "olivia.martinez@example.com" }, stars: 1, body: "Cancelling after this month." } },
    },
    {
      title: "Survey tool (NPS 0–10)",
      body: { type: "survey_response", response_id: "r_4471", respondent_email: "hannah.lee@example.com", nps: 10, answer: "Best cleaners we've ever had" },
    },
  ];

  return (
    <>
      <PageHeader title="Integrations" subtitle="Connect review sites, survey tools, or your CRM." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="AI health scoring" />
          <div className="flex items-start gap-3 p-5 text-sm">
            <Bot className="mt-0.5 h-5 w-5 text-brand-600" />
            <div>
              <p className="flex items-center gap-2 font-medium">
                Claude {aiEnabled() ? <Badge tone="green">Connected</Badge> : <Badge tone="amber">Not configured</Badge>}
              </p>
              <p className="mt-1 text-slate-500">
                {aiEnabled()
                  ? "Health checks read each client's feedback and visit history with Claude and write specific recommendations."
                  : "Set ANTHROPIC_API_KEY to enable AI analysis. Until then, health scores use the built-in rules engine."}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Feedback webhook" />
          <div className="space-y-4 p-5 text-sm">
            <div className="flex items-start gap-3">
              <Webhook className="mt-0.5 h-5 w-5 text-brand-600" />
              <p className="text-slate-600">
                POST feedback from any system. ShineOps normalizes the three formats below, matches the client by email, ignores
                duplicates by external id, and re-scores the client&apos;s health immediately.
              </p>
            </div>
            <dl className="grid gap-2 rounded-lg bg-slate-50 p-4 font-mono text-xs sm:grid-cols-[120px_1fr]">
              <dt className="text-slate-500">URL</dt>
              <dd className="break-all">{url}</dd>
              <dt className="text-slate-500">Header</dt>
              <dd className="break-all">X-ShineOps-Secret: {company.webhookSecret}</dd>
            </dl>
            {examples.map((ex) => (
              <div key={ex.title}>
                <p className="mb-1 text-xs font-medium text-slate-500">{ex.title}</p>
                <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
                  {`curl -X POST ${url} \\\n  -H "Content-Type: application/json" \\\n  -H "X-ShineOps-Secret: ${company.webhookSecret}" \\\n  -d '${JSON.stringify(ex.body)}'`}
                </pre>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Phone calls webhook" />
          <div className="space-y-4 p-5 text-sm">
            <div className="flex items-start gap-3">
              <PhoneCall className="mt-0.5 h-5 w-5 text-brand-600" />
              <p className="text-slate-600">
                Send calls from your phone system (call tracking, VoIP or CRM) with their transcript. Each call is classified, scored for
                coaching, matched to a client or lead by phone number, and moves the lead through the pipeline automatically. Same secret
                header as above.
              </p>
            </div>
            <dl className="grid gap-2 rounded-lg bg-slate-50 p-4 font-mono text-xs sm:grid-cols-[120px_1fr]">
              <dt className="text-slate-500">URL</dt>
              <dd className="break-all">{callsUrl}</dd>
            </dl>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Call tracking format (utterances or a single transcript string)</p>
              <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
                {`curl -X POST ${callsUrl} \\\n  -H "Content-Type: application/json" \\\n  -H "X-ShineOps-Secret: ${company.webhookSecret}" \\\n  -d '${JSON.stringify(callExample)}'`}
              </pre>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
