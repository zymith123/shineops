import { z } from "zod";

/** The one shape the rest of the app understands, whatever system sent the feedback. */
export type NormalizedFeedback = {
  clientEmail: string;
  rating: number;
  comment: string;
  externalId: string | null;
  source: string;
};

// Our own documented format.
const Generic = z.object({
  client_email: z.string().email(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().optional().default(""),
  external_id: z.string().optional(),
});

// Shape used by review platforms (e.g. a Google/Yelp review relay).
const ReviewEvent = z.object({
  event: z.literal("review.created"),
  review: z.object({
    id: z.union([z.string(), z.number()]),
    reviewer: z.object({ email: z.string().email() }),
    stars: z.coerce.number().min(1).max(5),
    body: z.string().optional().default(""),
  }),
});

// Survey tools report a 0–10 NPS score instead of stars.
const SurveyResponse = z.object({
  type: z.literal("survey_response"),
  response_id: z.string(),
  respondent_email: z.string().email(),
  nps: z.coerce.number().int().min(0).max(10),
  answer: z.string().optional().default(""),
});

export function npsToStars(nps: number): number {
  if (nps <= 2) return 1;
  if (nps <= 4) return 2;
  if (nps <= 6) return 3;
  if (nps <= 8) return 4;
  return 5;
}

export function normalizeFeedback(
  body: unknown,
): { ok: true; data: NormalizedFeedback } | { ok: false; error: string } {
  const review = ReviewEvent.safeParse(body);
  if (review.success) {
    const r = review.data.review;
    return {
      ok: true,
      data: {
        clientEmail: r.reviewer.email.toLowerCase(),
        rating: Math.round(r.stars),
        comment: r.body.trim(),
        externalId: `review:${r.id}`,
        source: "review",
      },
    };
  }
  const survey = SurveyResponse.safeParse(body);
  if (survey.success) {
    const s = survey.data;
    return {
      ok: true,
      data: {
        clientEmail: s.respondent_email.toLowerCase(),
        rating: npsToStars(s.nps),
        comment: s.answer.trim(),
        externalId: `survey:${s.response_id}`,
        source: "survey",
      },
    };
  }
  const generic = Generic.safeParse(body);
  if (generic.success) {
    const g = generic.data;
    return {
      ok: true,
      data: {
        clientEmail: g.client_email.toLowerCase(),
        rating: g.rating,
        comment: g.comment.trim(),
        externalId: g.external_id ?? null,
        source: "generic",
      },
    };
  }
  return {
    ok: false,
    error: `Unrecognized payload. ${generic.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
  };
}
