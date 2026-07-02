// Short, upbeat one-liners shown on a shift card when the shift has no manager
// note. Deterministically picked per shift so the same shift always shows the
// same line. Shared across the web manager view, the web employee portal, and
// the mobile app so all three read from one source of truth.

/** Generic set — used when the org has no industry (or an unmapped one). */
const GENERIC_QUOTES = [
  "Hope it's a smooth one.",
  "Have a good shift.",
  "See you out there.",
  "Good luck today.",
  "Hope the coffee's strong.",
  "Enjoy the shift.",
  "Stay sharp.",
  "Have a solid one.",
  "Make it count.",
  "Hope the day flies by.",
  "You know what to do.",
  "Have a good one.",
  "Keep it smooth out there.",
  "Hope it's a quiet one.",
  "Enjoy your day.",
  "Stay on your feet.",
  "Have a decent shift.",
  "Hope things run smoothly.",
  "Good day to be in the building.",
  "Another one down after this.",
  "Hope the team's on form today.",
  "Take it one thing at a time.",
  "Have a good one out there.",
  "Hope the shift goes quick.",
  "Enjoy it while it lasts.",
]

// Industry-specific sets. Keys match the `industry` values captured in
// onboarding (lowercase). Anything unmapped falls back to GENERIC_QUOTES.
const INDUSTRY_QUOTES: Record<string, string[]> = {
  restaurant: [
    "Hope service runs smooth tonight.",
    "May the rush be kind to you.",
    "Hope the tickets stay manageable.",
    "Have a good service.",
    "Keep the plates moving.",
    "Hope the kitchen's on point today.",
    "Smooth service out there.",
    "Hope the tables turn quick.",
    "Good luck on the floor.",
    "Hope the covers are gentle today.",
  ],
  cafe: [
    "Hope the coffee flows smooth today.",
    "May the espresso machine behave.",
    "Hope the morning rush is kind.",
    "Keep the lattes coming.",
    "Hope it's a cosy one.",
    "Good day for great coffee.",
    "Hope the pastries sell out.",
    "Have a warm one.",
  ],
  retail: [
    "Hope the floor stays tidy today.",
    "May the queues be short.",
    "Hope you hit your targets.",
    "Have a good shift on the floor.",
    "Hope the customers are friendly.",
    "Keep the shelves looking sharp.",
    "Hope it's a steady one.",
  ],
  hospitality: [
    "Hope your guests are happy today.",
    "May check-ins run smooth.",
    "Hope it's a five-star shift.",
    "Have a warm welcome ready.",
    "Hope the lobby stays calm.",
    "Good day to make someone's stay.",
  ],
  healthcare: [
    "Hope it's a smooth shift on the floor.",
    "Take care of yourself out there too.",
    "Hope your patients are in good spirits.",
    "Steady hands today.",
    "Hope the ward stays calm.",
    "Thanks for the care you give.",
  ],
  salon: [
    "Hope every client leaves smiling.",
    "May your appointments run on time.",
    "Have a stylish shift.",
    "Hope the chair stays busy.",
    "Good day to make people look great.",
  ],
  fitness: [
    "Hope the energy's high today.",
    "Keep the members motivated.",
    "Have a strong shift.",
    "Hope the classes are full.",
    "Good day to get people moving.",
  ],
  warehouse: [
    "Hope the picks go quick.",
    "Stay safe on the floor.",
    "May the orders flow smooth.",
    "Have a steady shift.",
    "Hope it's a well-organised one.",
  ],
  cleaning: [
    "Hope it's a smooth round today.",
    "Leave it sparkling.",
    "Have a good shift.",
    "Hope the list is short.",
    "Fresh and tidy today.",
  ],
  childcare: [
    "Hope the little ones are cheerful today.",
    "Have a fun shift.",
    "Hope nap time goes smoothly.",
    "Patience and snacks today.",
    "Hope it's a giggly one.",
  ],
  security: [
    "Hope it's a quiet watch.",
    "Stay alert out there.",
    "Have a safe shift.",
    "Hope the night stays calm.",
    "Eyes sharp today.",
  ],
}

/**
 * Deterministically pick an upbeat one-liner for a shift. The same `shiftId`
 * always yields the same line, drawn from the org's industry set when one is
 * mapped, otherwise from the generic set.
 */
export function pickShiftQuote(shiftId: string, industry?: string | null): string {
  const key = industry?.trim().toLowerCase()
  const set = (key && INDUSTRY_QUOTES[key]) || GENERIC_QUOTES
  let hash = 0
  for (const c of shiftId) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff
  return set[hash % set.length]
}
