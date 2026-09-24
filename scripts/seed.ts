/**
 * Resets the database to realistic demo data: two cleaning companies and a platform admin.
 * WARNING: deletes ALL data first. Run with: npm run db:seed
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "../src/db";
import { addDays, planDates, today } from "../src/lib/dates";
import { assessClient } from "../src/lib/health/service";
import type { Frequency } from "../src/db/schema";

// Deterministic randomness so every seed produces the same demo.
let rngState = 42;
function rand() {
  rngState = (rngState * 1664525 + 1013904223) % 4294967296;
  return rngState / 4294967296;
}
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

type Profile = "happy" | "inconsistent" | "quality_drop" | "churn_risk" | "unreliable" | "damage" | "new";

const HAPPY_COMMENTS = [
  "Spotless as always, thank you!",
  "Maria is amazing. The kitchen sparkles.",
  "Great job, house smells so fresh.",
  "Love coming home on cleaning day.",
  "",
  "",
  "Very thorough, even did the inside of the microwave.",
];

const CLIENTS: { name: string; email: string; address: string; beds: number; baths: number; pets: string; frequency: Frequency; price: number; profile: Profile; monthsAgo: number }[] = [
  { name: "Hannah Lee", email: "hannah.lee@example.com", address: "412 Maple Ave, Austin, TX", beds: 3, baths: 2, pets: "1 cat", frequency: "biweekly", price: 165, profile: "happy", monthsAgo: 14 },
  { name: "Olivia Martinez", email: "olivia.martinez@example.com", address: "88 Ridgeview Dr, Austin, TX", beds: 4, baths: 3, pets: "2 dogs", frequency: "weekly", price: 190, profile: "churn_risk", monthsAgo: 9 },
  { name: "The Nguyen Family", email: "nguyen.family@example.com", address: "1520 Oak Hollow Ln, Round Rock, TX", beds: 5, baths: 3, pets: "", frequency: "weekly", price: 220, profile: "inconsistent", monthsAgo: 11 },
  { name: "Robert Chen", email: "robert.chen@example.com", address: "3301 Lamar Blvd #12, Austin, TX", beds: 2, baths: 2, pets: "", frequency: "biweekly", price: 140, profile: "quality_drop", monthsAgo: 20 },
  { name: "Priya Patel", email: "priya.patel@example.com", address: "907 Sunset Trail, Cedar Park, TX", beds: 3, baths: 2, pets: "1 dog", frequency: "biweekly", price: 160, profile: "unreliable", monthsAgo: 6 },
  { name: "Mark Thompson", email: "mark.thompson@example.com", address: "2204 Barton Hills Dr, Austin, TX", beds: 4, baths: 2, pets: "", frequency: "biweekly", price: 175, profile: "damage", monthsAgo: 8 },
  { name: "Emily Johnson", email: "emily.johnson@example.com", address: "65 Willow Creek Rd, Austin, TX", beds: 3, baths: 2, pets: "", frequency: "weekly", price: 150, profile: "happy", monthsAgo: 24 },
  { name: "David Kim", email: "david.kim@example.com", address: "1800 S Congress Ave #4, Austin, TX", beds: 1, baths: 1, pets: "", frequency: "biweekly", price: 110, profile: "happy", monthsAgo: 5 },
  { name: "Sarah Wilson", email: "sarah.wilson@example.com", address: "742 Pecan St, Pflugerville, TX", beds: 4, baths: 3, pets: "2 cats", frequency: "weekly", price: 200, profile: "happy", monthsAgo: 18 },
  { name: "James & Ana Rivera", email: "rivera.home@example.com", address: "33 Hilltop Cir, Leander, TX", beds: 4, baths: 2, pets: "1 dog", frequency: "biweekly", price: 170, profile: "happy", monthsAgo: 12 },
  { name: "Grace Okafor", email: "grace.okafor@example.com", address: "510 Riverside Dr, Austin, TX", beds: 2, baths: 1, pets: "", frequency: "monthly", price: 185, profile: "happy", monthsAgo: 7 },
  { name: "Tom Becker", email: "tom.becker@example.com", address: "1209 Elm St, Georgetown, TX", beds: 3, baths: 2, pets: "", frequency: "monthly", price: 195, profile: "happy", monthsAgo: 3 },
  { name: "Linda Brooks", email: "linda.brooks@example.com", address: "480 Canyon View, Austin, TX", beds: 5, baths: 4, pets: "1 dog", frequency: "weekly", price: 260, profile: "happy", monthsAgo: 30 },
  { name: "Carlos Mendoza", email: "carlos.mendoza@example.com", address: "2770 Parmer Ln, Austin, TX", beds: 3, baths: 2, pets: "", frequency: "biweekly", price: 155, profile: "happy", monthsAgo: 10 },
  { name: "Megan O'Brien", email: "megan.obrien@example.com", address: "19 Bluebonnet Way, Buda, TX", beds: 3, baths: 2, pets: "3 cats", frequency: "biweekly", price: 165, profile: "happy", monthsAgo: 4 },
  { name: "Aaron Feldman", email: "aaron.feldman@example.com", address: "900 W 5th St #1102, Austin, TX", beds: 2, baths: 2, pets: "", frequency: "weekly", price: 135, profile: "happy", monthsAgo: 16 },
  { name: "Nora Castillo", email: "nora.castillo@example.com", address: "4410 Duval St, Austin, TX", beds: 2, baths: 1, pets: "1 dog", frequency: "biweekly", price: 125, profile: "new", monthsAgo: 1 },
  { name: "Westlake Dental (office)", email: "office@westlakedental.example.com", address: "3500 Bee Cave Rd, Austin, TX", beds: 0, baths: 3, pets: "", frequency: "weekly", price: 240, profile: "happy", monthsAgo: 22 },
];

type ClientSeed = (typeof CLIENTS)[number];

/** Clients with plans, ~12 weeks of visit history + 3 weeks ahead, feedback, and an initial health score. */
async function seedClients(
  companyId: string,
  cleaners: { id: string; name: string }[],
  clients: ClientSeed[],
  opts: { now: string; passwordHash: string; portalEmails?: string[] },
) {
  const { now, passwordHash, portalEmails = [] } = opts;
  for (const [i, c] of clients.entries()) {
    const createdAt = new Date(`${addDays(now, -c.monthsAgo * 30)}T12:00:00Z`);
    const [client] = await db
      .insert(schema.clients)
      .values({
        companyId,
        name: c.name,
        email: c.email,
        phone: `(512) 555-${String(1000 + i * 37).slice(-4)}`,
        address: c.address,
        bedrooms: c.beds,
        bathrooms: c.baths,
        pets: c.pets,
        entryNotes: pick(["Lockbox code 4821 on side gate", "Key under the blue planter", "Client works from home, ring bell", "Garage code 1357#"]),
        createdAt,
      })
      .returning();

    const preferred = cleaners[i % cleaners.length];
    const startDate = addDays(now, -Math.min(c.monthsAgo * 30, 84) - (i % 7));
    await db.insert(schema.servicePlans).values({
      companyId,
      clientId: client.id,
      frequency: c.frequency,
      priceCents: c.price * 100,
      preferredCleanerId: preferred.id,
      startDate,
    });

    const dates = planDates(startDate, c.frequency, addDays(now, -84), addDays(now, 21));
    const pastDates = dates.filter((d) => d < now);
    for (const [vi, date] of dates.entries()) {
      const isPast = date < now;
      const recentIdx = pastDates.length - 1 - pastDates.indexOf(date); // 0 = most recent past visit
      let cleaner = preferred;
      let status: "scheduled" | "completed" | "skipped" = isPast ? "completed" : "scheduled";
      if (c.profile === "inconsistent" && isPast) cleaner = cleaners[vi % cleaners.length];
      if (c.profile === "unreliable" && isPast && (recentIdx === 1 || recentIdx === 3)) status = "skipped";

      const [visit] = await db
        .insert(schema.visits)
        .values({
          companyId,
          clientId: client.id,
          cleanerId: cleaner.id,
          scheduledDate: date,
          status,
          priceCents: c.price * 100,
          completedAt: status === "completed" ? new Date(`${date}T15:00:00Z`) : null,
        })
        .returning();

      // Not every client leaves feedback, but always keep the recent visits that tell each profile's story.
      const optional = c.profile === "happy" || c.profile === "new" || recentIdx > 4;
      if (status !== "completed" || (optional && rand() < 0.3)) continue;
      const fb = feedbackFor(c.profile, recentIdx, cleaner.name);
      if (!fb) continue;
      await db.insert(schema.feedback).values({
        companyId,
        clientId: client.id,
        visitId: visit.id,
        rating: fb.rating,
        comment: fb.comment,
        source: rand() < 0.8 ? "portal" : "webhook",
        createdAt: new Date(`${addDays(date, 1)}T18:00:00Z`),
      });
    }

    // Rules only here: seeding shouldn't spend API credits. Use "Re-analyze with AI" in the app.
    await assessClient(companyId, client.id, { useAI: false });
    if (portalEmails.includes(c.email)) {
      await db.insert(schema.users).values({
        companyId,
        name: c.name,
        email: c.email,
        role: "client",
        clientId: client.id,
        passwordHash,
      });
    }
  }
}

const FRESHNEST_CLIENTS: ClientSeed[] = [
  { name: "Kevin Walsh", email: "kevin.walsh@example.com", address: "88 Harbor View Rd, San Diego, CA", beds: 3, baths: 2, pets: "", frequency: "biweekly", price: 170, profile: "happy", monthsAgo: 6 },
  { name: "Maya Singh", email: "maya.singh@example.com", address: "412 Palm Ct, San Diego, CA", beds: 2, baths: 2, pets: "1 cat", frequency: "weekly", price: 145, profile: "quality_drop", monthsAgo: 9 },
  { name: "The Harper Family", email: "harper.family@example.com", address: "9 Seacrest Ln, Carlsbad, CA", beds: 4, baths: 3, pets: "2 dogs", frequency: "biweekly", price: 210, profile: "happy", monthsAgo: 4 },
  { name: "Ben Ortiz", email: "ben.ortiz@example.com", address: "2150 Juniper St, San Diego, CA", beds: 1, baths: 1, pets: "", frequency: "monthly", price: 120, profile: "new", monthsAgo: 1 },
];

async function main() {
  const now = today();
  console.log(`Seeding demo data (today = ${now})…`);

  await db.execute(
    sql`TRUNCATE ${schema.tasks}, ${schema.healthAssessments}, ${schema.feedback}, ${schema.visits}, ${schema.servicePlans}, ${schema.users}, ${schema.clients}, ${schema.companies} CASCADE`,
  );

  const [company] = await db
    .insert(schema.companies)
    .values({ name: "Sparkle & Co. Cleaning", webhookSecret: "whsec_demo_sparkleco_2f9a" })
    .returning();
  const passwordHash = await bcrypt.hash("demo1234", 10);
  const staff = await db
    .insert(schema.users)
    .values([
      { companyId: company.id, name: "Sophie Bennett", email: "owner@sparkleco.demo", role: "owner", passwordHash },
      { companyId: company.id, name: "Rachel Ops", email: "manager@sparkleco.demo", role: "manager", passwordHash },
      { companyId: company.id, name: "Maria Santos", email: "maria@sparkleco.demo", role: "cleaner", passwordHash },
      { companyId: company.id, name: "James Carter", email: "james@sparkleco.demo", role: "cleaner", passwordHash },
      { companyId: company.id, name: "Aisha Khan", email: "aisha@sparkleco.demo", role: "cleaner", passwordHash },
      { companyId: company.id, name: "Diego Ramirez", email: "diego@sparkleco.demo", role: "cleaner", passwordHash },
    ])
    .returning();
  const owner = staff.find((u) => u.role === "owner")!;
  const manager = staff.find((u) => u.role === "manager")!;
  const cleaners = staff.filter((u) => u.role === "cleaner");

  await seedClients(company.id, cleaners, CLIENTS, { now, passwordHash, portalEmails: ["hannah.lee@example.com"] });

  // A few human-created tasks so the queue isn't only AI output.
  const clientRows = await db.select().from(schema.clients).where(eq(schema.clients.companyId, company.id));
  const byName = (n: string) => clientRows.find((c) => c.name === n)!.id;
  await db.insert(schema.tasks).values([
    {
      companyId: company.id,
      clientId: byName("Nora Castillo"),
      assigneeId: manager.id,
      title: "7-day check-in call with new client",
      description: "First clean was last week. Ask how it went and confirm the biweekly schedule works.",
      source: "manual",
      dueDate: addDays(now, 1),
    },
    {
      companyId: company.id,
      clientId: byName("Grace Okafor"),
      assigneeId: manager.id,
      title: "Client request: add a one-time deep clean",
      description: "Hosting family next month. Wants oven + inside fridge added to the next visit.",
      source: "client_request",
      dueDate: addDays(now, 2),
    },
    {
      companyId: company.id,
      clientId: null,
      assigneeId: owner.id,
      title: "Restock microfiber cloths and glass cleaner",
      description: "",
      source: "manual",
      dueDate: addDays(now, 4),
    },
  ]);


  // A second, smaller customer so the platform admin console has more than one company.
  const [freshnest] = await db
    .insert(schema.companies)
    .values({ name: "FreshNest Home Cleaning", webhookSecret: "whsec_demo_freshnest_7c1e" })
    .returning();
  const freshnestStaff = await db
    .insert(schema.users)
    .values([
      { companyId: freshnest.id, name: "Paolo Reyes", email: "owner@freshnest.demo", role: "owner", passwordHash },
      { companyId: freshnest.id, name: "Lena Brooks", email: "lena@freshnest.demo", role: "cleaner", passwordHash },
    ])
    .returning();
  await seedClients(freshnest.id, freshnestStaff.filter((u) => u.role === "cleaner"), FRESHNEST_CLIENTS, { now, passwordHash });

  // Platform operator: belongs to no company.
  await db.insert(schema.users).values({
    companyId: null,
    name: "ShineOps Admin",
    email: "admin@shineops.demo",
    role: "admin",
    passwordHash,
  });

  console.log(
    `Done. 2 companies, ${CLIENTS.length + FRESHNEST_CLIENTS.length} clients. Log in with owner@sparkleco.demo or admin@shineops.demo / demo1234`,
  );
  process.exit(0);
}

function feedbackFor(profile: Profile, recentIdx: number, cleanerName: string): { rating: number; comment: string } | null {
  const first = cleanerName.split(" ")[0];
  const happy = () => ({ rating: rand() < 0.85 ? 5 : 4, comment: pick(HAPPY_COMMENTS).replace("Maria", first) });
  switch (profile) {
    case "happy":
    case "new":
      return happy();
    case "churn_risk":
      if (recentIdx === 0) return { rating: 2, comment: "Honestly thinking about switching to another company. Dog hair everywhere again and the bathrooms weren't touched." };
      if (recentIdx === 1) return { rating: 2, comment: "Floors still dirty under the table. Paying a lot for this." };
      if (recentIdx <= 3) return { rating: 3, comment: "Kitchen was fine but they missed the upstairs bathroom." };
      return happy();
    case "inconsistent":
      if (recentIdx <= 3) return pick([
        { rating: 3, comment: "Different cleaner every time, have to explain everything again." },
        { rating: 3, comment: "New team today didn't know about the playroom. Would like the same person." },
        { rating: 4, comment: "Fine, but it's never the same person." },
      ]);
      return happy();
    case "quality_drop":
      if (recentIdx <= 2) return pick([
        { rating: 3, comment: "Baseboards skipped again and streaks on the mirrors." },
        { rating: 3, comment: "Dust on the shelves, not as thorough as it used to be." },
      ]);
      return { rating: 5, comment: pick(["Perfect as usual.", "Great work!", ""]) };
    case "unreliable":
      if (recentIdx <= 4) return { rating: 3, comment: "Cleaner showed up 2 hours late and we had to leave." };
      return happy();
    case "damage":
      if (recentIdx === 0) return { rating: 2, comment: "A picture frame in the hallway was broken and nobody told us." };
      return happy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
