/**
 * Demo phone calls for Sparkle & Co. Deliberately mixed quality so the call
 * analysis has real differences to find: great calls, weak calls, missed
 * bookings, a cancellation that isn't saved, and noise (wrong numbers, spam).
 */
type Rep = "rachel" | "kim";
export type SeedCall = {
  daysAgo: number;
  hour: number;
  rep: Rep | null;
  direction: "inbound" | "outbound";
  /** Existing client (matched by their phone number), or a new caller's phone. */
  client?: string;
  phone?: string;
  callerName?: string; // what the phone system reports (often blank)
  lines: string[]; // "R: …" = rep, "C: …" = caller
};

export const SEED_CALLS: SeedCall[] = [
  // ---- Existing clients --------------------------------------------------
  {
    daysAgo: 2, hour: 10, rep: "rachel", direction: "inbound", client: "Olivia Martinez",
    lines: [
      "R: Sparkle and Co, this is Rachel.",
      "C: Hi, it's Olivia Martinez on Ridgeview. I'm calling because I want to cancel our weekly service.",
      "R: Oh, okay. Can I ask why?",
      "C: Honestly the last few cleans have been bad. Dog hair everywhere, the upstairs bathroom wasn't touched two weeks in a row. I'm paying $190 a week for this.",
      "R: I'm sorry to hear that. So do you want me to cancel starting next week?",
      "C: I guess so. I've been looking at another company.",
      "R: Okay, I'll put that in. You'll get an email confirmation.",
      "C: Fine. Thanks.",
    ],
  },
  {
    daysAgo: 6, hour: 14, rep: "kim", direction: "inbound", client: "The Nguyen Family",
    lines: [
      "R: Thanks for calling Sparkle and Co, this is Kim, how can I help?",
      "C: Hi Kim, this is Linh Nguyen. I'm not happy, we've had a different cleaner basically every week and I have to explain the playroom every single time.",
      "R: I'm really sorry, Linh. That's frustrating, and it's on us, not you. Can I ask who you liked best?",
      "C: Aisha was great the first month.",
      "R: Let me check her schedule. I can put Aisha on your house every Tuesday going forward, starting next week. Would that work?",
      "C: Yes, that would be great.",
      "R: Done. I'm also adding notes about the playroom to your file so it never gets missed, and I'll call you after next Tuesday's clean to make sure it was right.",
      "C: Okay, thank you, I appreciate that.",
    ],
  },
  {
    daysAgo: 9, hour: 11, rep: "rachel", direction: "inbound", client: "Robert Chen",
    lines: [
      "R: Sparkle and Co, Rachel speaking.",
      "C: Hey, Robert Chen. The baseboards were skipped again and there are streaks on the bathroom mirror. That's the third time.",
      "R: Sorry about that Robert. We can send someone back out.",
      "C: When?",
      "R: Probably Friday.",
      "C: Alright.",
      "R: Okay, bye.",
    ],
  },
  {
    daysAgo: 4, hour: 9, rep: "kim", direction: "inbound", client: "Priya Patel",
    lines: [
      "R: Good morning, Sparkle and Co, this is Kim.",
      "C: Hi Kim, Priya Patel. I need to reschedule Thursday's clean, I have family in town.",
      "R: No problem at all. I can move you to Friday morning or Monday afternoon. Which is better?",
      "C: Monday afternoon please.",
      "R: You're all set for Monday at 1pm, same cleaner. Anything else I can help with?",
      "C: No, that's it, thanks!",
    ],
  },
  {
    daysAgo: 12, hour: 16, rep: "kim", direction: "inbound", client: "Hannah Lee",
    lines: [
      "R: Sparkle and Co, Kim speaking.",
      "C: Hi, it's Hannah Lee. Quick question, we just got a second cat. Are the products you use safe for pets?",
      "R: Great question. Yes, all our standard products are pet-safe, and we can switch to fragrance-free if the cats are sensitive.",
      "C: Oh perfect. Fragrance-free would be great actually.",
      "R: I've added that to your file. Congratulations on the new cat!",
    ],
  },
  {
    daysAgo: 15, hour: 13, rep: "rachel", direction: "inbound", client: "Grace Okafor",
    lines: [
      "R: Sparkle and Co, this is Rachel.",
      "C: Hi Rachel, Grace Okafor. I'm hosting family next month and I'd like to book a one-time deep clean on top of my monthly.",
      "R: Absolutely. Our deep clean adds the oven, inside the fridge, baseboards and windows. For your place that's $240. Would the 14th work?",
      "C: The 14th is perfect.",
      "R: Great, you're booked for the 14th. I'll send a confirmation.",
    ],
  },
  {
    daysAgo: 3, hour: 15, rep: "kim", direction: "inbound", client: "Emily Johnson",
    lines: [
      "R: Sparkle and Co, this is Kim.",
      "C: Hi, it's Emily Johnson. I was charged twice for last week's clean on my card.",
      "R: I'm sorry about that. Let me look... yes, I see a duplicate charge of $150. I've refunded it now, it should show in 3 to 5 days.",
      "C: Okay great, thank you.",
      "R: I'll also email you the refund receipt. Anything else?",
      "C: That's all.",
    ],
  },

  // ---- New prospects ------------------------------------------------------
  {
    daysAgo: 1, hour: 10, rep: "kim", direction: "inbound", phone: "5125552101", callerName: "",
    lines: [
      "R: Thanks for calling Sparkle and Co, this is Kim. Who do I have the pleasure of speaking with?",
      "C: Hi Kim, this is Dana Lopez. I'm looking for a regular cleaner for our house.",
      "R: Welcome Dana! Tell me a bit about your home: how many bedrooms and bathrooms, and any pets?",
      "C: Three bedrooms, two baths, and one dog.",
      "R: Perfect. Are you thinking weekly or every two weeks? Most families with a dog go every two weeks.",
      "C: Every two weeks sounds right. How much is that?",
      "R: For three bed, two bath every two weeks it's $165 a visit, and the first clean is a deeper reset at $220 so every visit after that is easy to keep up.",
      "C: That sounds fair.",
      "R: I have Tuesday or Thursday mornings open next week. Which works better?",
      "C: Thursday.",
      "R: You're booked for Thursday at 9am with Maria. What's the address?",
      "C: 58 Cypress Lane, Austin.",
      "R: Got it. I'll text you a confirmation and Maria's photo the day before. Welcome to Sparkle and Co, Dana!",
    ],
  },
  {
    daysAgo: 3, hour: 17, rep: "rachel", direction: "inbound", phone: "5125552102", callerName: "REED MARCUS",
    lines: [
      "R: Sparkle and Co, Rachel.",
      "C: Hi, this is Marcus Reed. I'm getting quotes for cleaning. We have a four bedroom, three bath.",
      "R: For four bed three bath weekly it's $185.",
      "C: Okay. Let me talk to my wife and I'll call you back.",
      "R: Sure. I can also call you Thursday if that's easier?",
      "C: Yeah, Thursday works.",
      "R: Great, talk then.",
    ],
  },
  {
    daysAgo: 5, hour: 12, rep: "rachel", direction: "inbound", phone: "5125552103", callerName: "",
    lines: [
      "R: Sparkle and Co.",
      "C: Hi, how much do you charge for a house cleaning?",
      "R: Depends on the size. Usually between $140 and $220.",
      "C: Okay. For a two bedroom?",
      "R: Probably around $140.",
      "C: Okay, thanks.",
      "R: Yep, bye.",
    ],
  },
  {
    daysAgo: 7, hour: 11, rep: "kim", direction: "inbound", phone: "5125552104", callerName: "PARK JENNA",
    lines: [
      "R: Sparkle and Co, this is Kim, how can I help?",
      "C: Hi, my name is Jenna Park. I'm moving out of my apartment at the end of the month and need a move-out clean for my deposit.",
      "R: We do a lot of those. What size is the apartment, and do you know the move-out date?",
      "C: Two bed, one bath, the 30th.",
      "R: A move-out clean for that size is $260, and we guarantee it passes the landlord inspection or we come back free.",
      "C: Nice. I need to confirm the exact date with my landlord first.",
      "R: Totally understand. Can I pencil you in for the 30th and call you Monday to confirm?",
      "C: Yes please.",
      "R: Done. Talk Monday, Jenna.",
    ],
  },
  {
    daysAgo: 10, hour: 10, rep: "rachel", direction: "inbound", phone: "5125552105", callerName: "",
    lines: [
      "R: Sparkle and Co, Rachel speaking.",
      "C: Hi, this is Carlos Vega. Do you clean townhouses in Pflugerville?",
      "R: Yes we do. How big is it?",
      "C: Three bed, two and a half bath.",
      "R: That'd be about $170 every two weeks.",
      "C: Let me think about it and call back.",
      "R: Sounds good.",
    ],
  },
  {
    daysAgo: 2, hour: 15, rep: "kim", direction: "inbound", phone: "5125552105", callerName: "",
    lines: [
      "R: Sparkle and Co, this is Kim.",
      "C: Hi, Carlos Vega again. I talked to Rachel last week about my townhouse. I'm ready to start.",
      "R: Great to hear from you Carlos! That's the three bed, two and a half bath in Pflugerville, every two weeks at $170?",
      "C: That's it.",
      "R: I can get you started next Wednesday at 10am. Does that work?",
      "C: Perfect.",
      "R: You're all set for Wednesday. Any pets or gate codes we should know about?",
      "C: No pets. Gate code is 4471.",
      "R: Noted. See you Wednesday, Carlos!",
    ],
  },
  {
    daysAgo: 8, hour: 14, rep: "rachel", direction: "inbound", phone: "5125552106", callerName: "BROOKS ASHLEY",
    lines: [
      "R: Sparkle and Co, Rachel.",
      "C: Hi, this is Ashley Brooks. How much for a weekly clean, three bedroom?",
      "R: $175 a week.",
      "C: Oh. That's more than I expected, another company quoted me $130.",
      "R: Yeah, we're a bit more expensive.",
      "C: Okay, I'll probably go with them then. Thanks anyway.",
      "R: Okay, no problem.",
    ],
  },
  {
    daysAgo: 11, hour: 9, rep: "kim", direction: "inbound", phone: "5125552107", callerName: "",
    lines: [
      "R: Sparkle and Co, this is Kim.",
      "C: Hi, I'm Tom Hale, office manager at a small dental office. Do you do commercial cleaning?",
      "R: We do small offices, yes. How big is the space, and how often are you thinking?",
      "C: About 2,000 square feet, three times a week after hours.",
      "R: That's a great fit. Pricing for that depends on a walkthrough. Could I come by Thursday at 5 to look at the space and send a quote the same day?",
      "C: Thursday at 5 works.",
      "R: Perfect, what's the address?",
      "C: 3500 Bee Cave Road, suite 200.",
      "R: See you Thursday, Tom.",
    ],
  },
  {
    daysAgo: 14, hour: 10, rep: "kim", direction: "inbound", phone: "5125552108", callerName: "",
    lines: [
      "R: Sparkle and Co, Kim speaking.",
      "C: Hi, my name is Lisa Harper, I'd like to book a one-time deep clean before my in-laws visit.",
      "R: Lovely! How many bedrooms and bathrooms?",
      "C: Three and two.",
      "R: A deep clean for that is $240. I have Saturday at 9 or Monday at 1.",
      "C: Saturday please.",
      "R: You're booked for Saturday at 9. Many guests like to keep it going every two weeks after a deep clean at $165. Want me to tell you more after Saturday?",
      "C: Sure, call me after.",
      "R: Will do, Lisa!",
    ],
  },
  {
    daysAgo: 16, hour: 13, rep: "rachel", direction: "inbound", phone: "5125552109", callerName: "",
    lines: [
      "R: Sparkle and Co.",
      "C: Hi, this is Brian Cole. Do you have anything available this week for a regular clean?",
      "R: No, we're booked out about three weeks right now.",
      "C: Oh, okay. Never mind then.",
      "R: Okay, bye.",
    ],
  },
  {
    daysAgo: 18, hour: 11, rep: "kim", direction: "inbound", phone: "5125552110", callerName: "",
    lines: [
      "R: Sparkle and Co, Kim speaking.",
      "C: Hi, I'm comparing cleaning companies. Are you insured, and do you bring your own supplies?",
      "R: Yes to both. We're fully insured and bonded, and we bring everything, including pet-safe products. Can I ask your name and a bit about your home?",
      "C: I'm Priscilla Moore, two bed two bath condo.",
      "R: Thanks Priscilla. For that it's $150 every two weeks. Would you like me to hold a spot for next week?",
      "C: Not yet, I'm still comparing. Can you email me the details?",
      "R: Of course. I'll email you today and follow up on Friday.",
    ],
  },

  // ---- Noise -------------------------------------------------------------
  { daysAgo: 6, hour: 19, rep: "rachel", direction: "inbound", phone: "5125552201", lines: ["R: Sparkle and Co.", "C: Is this Tony's Pizza?", "R: No, sorry, wrong number.", "C: Oh, sorry."] },
  {
    daysAgo: 13, hour: 11, rep: "kim", direction: "inbound", phone: "8885550100",
    lines: ["R: Sparkle and Co, Kim speaking.", "C: Hi, this is Jake from Local Listings. Your Google business profile is at risk of being deactivated.", "R: We're not interested, thanks.", "C: It will only take a minute—", "R: No thank you. Bye."],
  },
  {
    daysAgo: 10, hour: 15, rep: "rachel", direction: "inbound", phone: "5125552202",
    lines: ["R: Sparkle and Co, Rachel.", "C: Hi, are you hiring cleaners? I have three years of experience.", "R: We are. You can apply on our website under careers.", "C: Great, thank you!"],
  },
  {
    daysAgo: 1, hour: 11, rep: "rachel", direction: "outbound", phone: "5125552102",
    lines: ["R: Hi Marcus, it's Rachel from Sparkle and Co following up on the quote for your four bedroom. Give me a call back at 512-555-0100 when you get a chance. Thanks!", "(voicemail)"],
  },
];

/** "R: …"/"C: …" → "Rep: …"/"Caller: …" transcript text. */
export function toTranscript(lines: string[]) {
  return lines.map((l) => l.replace(/^R:\s*/, "Rep: ").replace(/^C:\s*/, "Caller: ")).join("\n");
}
