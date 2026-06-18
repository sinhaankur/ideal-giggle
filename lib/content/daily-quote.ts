// Quote of the day — gentle, motivational two-liners shown on the empty chat
// state. Bundled and deterministic on purpose: like everything else in
// EMPATHEIA it works fully offline (no quote API, no network), and "of the day"
// means the SAME quote for the whole calendar day, rotating daily — never a
// random flicker on each render.
//
// Tone note: these lean warm and grounding rather than hustle-y. This is an
// empathy companion; a quote that shames someone for not "grinding" would cut
// against the whole point.

export interface DailyQuote {
  line1: string
  line2: string
}

export const QUOTES: DailyQuote[] = [
  { line1: "You don't have to have it all figured out", line2: "to take the next small step." },
  { line1: "The fact that you're still here, still trying,", line2: "is its own kind of strength." },
  { line1: "Be as kind to yourself", line2: "as you would be to a good friend." },
  { line1: "Healing isn't linear —", line2: "a hard day doesn't erase your progress." },
  { line1: "You are allowed to be both", line2: "a work in progress and enough as you are." },
  { line1: "Rest is not a reward you earn.", line2: "It's a need you're allowed to meet." },
  { line1: "Some days, just showing up", line2: "is the brave thing." },
  { line1: "Your feelings are information,", line2: "not instructions — you get to choose what's next." },
  { line1: "You've survived every hardest day so far.", line2: "That's a perfect record." },
  { line1: "Progress whispers.", line2: "It rarely arrives as a thunderclap." },
  { line1: "It's okay to set down what's heavy", line2: "before you figure out where to put it." },
  { line1: "You can begin again", line2: "at any moment you choose." },
  { line1: "Small and steady", line2: "still gets you there." },
  { line1: "Being gentle with yourself", line2: "is not the same as giving up." },
  { line1: "The voice that says you're not doing enough", line2: "is rarely telling the truth." },
  { line1: "You don't owe anyone", line2: "a productive version of your pain." },
  { line1: "What you're feeling is real,", line2: "and it's also not the whole story." },
  { line1: "Courage is quiet.", line2: "It's getting up one more time." },
  { line1: "You are not behind.", line2: "You're on your own timeline." },
  { line1: "Let today be enough.", line2: "Tomorrow can ask its own questions." },
]

// Days since the Unix epoch, in the viewer's local time — so the quote turns
// over at local midnight rather than UTC.
function localDayIndex(now: Date): number {
  const ms = now.getTime() - now.getTimezoneOffset() * 60_000
  return Math.floor(ms / 86_400_000)
}

// Deterministic quote for a given date. Same all day, rotates daily, and walks
// the whole list before repeating (stride of 1 over a modest list is fine and
// keeps consecutive days from feeling clustered).
export function getDailyQuote(now: Date = new Date()): DailyQuote {
  const index = ((localDayIndex(now) % QUOTES.length) + QUOTES.length) % QUOTES.length
  return QUOTES[index]
}
