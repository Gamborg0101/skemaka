// Short, upbeat one-liners shown on a shift card when the shift has no manager
// note. Deterministically picked per shift so the same shift always shows the
// same line. Shared across the web manager view, the web employee portal, and
// the mobile app so all three read from one source of truth.
//
// Locale sets are translated 1:1 (same length, same order) so the same shift
// shows the "same" quote across languages.

import { DEFAULT_LOCALE, type Locale } from "./locales"

/** Generic set — used when the org has no industry (or an unmapped one). */
const GENERIC_QUOTES: Record<Locale, string[]> = {
  en: [
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
  ],
  da: [
    "Håber det bliver en nem en.",
    "Hav en god vagt.",
    "Vi ses derude.",
    "Held og lykke i dag.",
    "Håber kaffen er stærk.",
    "Nyd vagten.",
    "Hold hovedet koldt.",
    "Hav en solid en.",
    "Få det bedste ud af den.",
    "Håber dagen flyver af sted.",
    "Du ved, hvad du skal.",
    "Hav en god en.",
    "Hold det kørende derude.",
    "Håber det bliver en stille en.",
    "Nyd din dag.",
    "Bliv på tæerne.",
    "Hav en fin vagt.",
    "Håber det hele glider.",
    "God dag at være på arbejde.",
    "Én til overstået efter denne her.",
    "Håber holdet er i topform i dag.",
    "Tag én ting ad gangen.",
    "Hav en god en derude.",
    "Håber vagten går hurtigt.",
    "Nyd det, mens det varer.",
  ],
}

// Industry-specific sets. Keys match the `industry` values captured in
// onboarding (lowercase). Anything unmapped falls back to GENERIC_QUOTES.
const INDUSTRY_QUOTES: Record<Locale, Record<string, string[]>> = {
  en: {
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
  },
  da: {
    restaurant: [
      "Håber servicen glider i aften.",
      "Må rushet være mildt ved dig.",
      "Håber bonerne er til at følge med i.",
      "Hav en god service.",
      "Hold tallerkenerne kørende.",
      "Håber køkkenet er skarpt i dag.",
      "Glat service derude.",
      "Håber bordene vender hurtigt.",
      "Held og lykke på gulvet.",
      "Håber gæsterne er søde i dag.",
    ],
    cafe: [
      "Håber kaffen flyder let i dag.",
      "Må espressomaskinen opføre sig pænt.",
      "Håber morgenrushet er mildt.",
      "Bliv ved med at lange lattes over disken.",
      "Håber det bliver en hyggelig en.",
      "God dag til god kaffe.",
      "Håber kagerne bliver udsolgt.",
      "Hav en varm en.",
    ],
    retail: [
      "Håber gulvet holder sig pænt i dag.",
      "Må køerne være korte.",
      "Håber du rammer dine mål.",
      "Hav en god vagt på gulvet.",
      "Håber kunderne er flinke.",
      "Hold hylderne skarpe.",
      "Håber det bliver en rolig en.",
    ],
    hospitality: [
      "Håber dine gæster er glade i dag.",
      "Må indtjekningerne glide let.",
      "Håber det bliver en femstjernet vagt.",
      "Hav et varmt velkommen klar.",
      "Håber lobbyen holder sig rolig.",
      "God dag til at gøre nogens ophold særligt.",
    ],
    healthcare: [
      "Håber det bliver en rolig vagt på gulvet.",
      "Pas også på dig selv derude.",
      "Håber dine patienter er i godt humør.",
      "Rolige hænder i dag.",
      "Håber afdelingen holder sig rolig.",
      "Tak for den omsorg, du giver.",
    ],
    salon: [
      "Håber alle kunder går smilende hjem.",
      "Må dine aftaler holde tiden.",
      "Hav en stilfuld vagt.",
      "Håber stolen er booket hele dagen.",
      "God dag til at få folk til at stråle.",
    ],
    fitness: [
      "Håber energien er høj i dag.",
      "Hold medlemmerne motiverede.",
      "Hav en stærk vagt.",
      "Håber holdene er fyldte.",
      "God dag til at få folk i gang.",
    ],
    warehouse: [
      "Håber plukkene går hurtigt.",
      "Pas på dig selv på gulvet.",
      "Må ordrerne glide let.",
      "Hav en stabil vagt.",
      "Håber det bliver en velorganiseret en.",
    ],
    cleaning: [
      "Håber det bliver en nem runde i dag.",
      "Efterlad det skinnende rent.",
      "Hav en god vagt.",
      "Håber listen er kort.",
      "Friskt og pænt i dag.",
    ],
    childcare: [
      "Håber de små er i godt humør i dag.",
      "Hav en sjov vagt.",
      "Håber lurene går glat.",
      "Tålmodighed og snacks i dag.",
      "Håber det bliver en fnisende en.",
    ],
    security: [
      "Håber det bliver en stille vagt.",
      "Vær vaks derude.",
      "Hav en sikker vagt.",
      "Håber natten holder sig rolig.",
      "Skarpe øjne i dag.",
    ],
  },
}

/**
 * Deterministically pick an upbeat one-liner for a shift. The same `shiftId`
 * always yields the same line, drawn from the org's industry set when one is
 * mapped, otherwise from the generic set.
 */
export function pickShiftQuote(
  shiftId: string,
  industry?: string | null,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const key = industry?.trim().toLowerCase()
  const set = (key && INDUSTRY_QUOTES[locale][key]) || GENERIC_QUOTES[locale]
  let hash = 0
  for (const c of shiftId) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff
  return set[hash % set.length]
}
