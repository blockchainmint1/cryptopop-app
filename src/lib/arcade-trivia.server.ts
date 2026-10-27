// Server-only Trivia Night engine: question bank, daily picks, timed scoring.
// The server records when each question was shown, so speed-based POP can't
// be faked from the phone. Answers are revealed one question at a time.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TRIVIA_CATEGORIES, TRIVIA_DEFAULT_RULES, type TriviaRules } from "./arcade";

export type TriviaQ = { q: string; options: string[]; category: string; difficulty: number };
export type TriviaDaySet = { questions: TriviaQ[]; answers: number[] };

export function readRules(settings: unknown): TriviaRules {
  const s = (settings && typeof settings === "object" ? settings : {}) as Partial<Record<keyof TriviaRules, unknown>>;
  const n = (v: unknown, d: number, lo: number, hi: number) => {
    const x = Number(v);
    return Number.isFinite(x) ? Math.max(lo, Math.min(hi, Math.round(x))) : d;
  };
  const d = TRIVIA_DEFAULT_RULES;
  const total = n(s.total_seconds, d.total_seconds, 5, 120);
  return {
    fast_pop: n(s.fast_pop, d.fast_pop, 0, 100),
    fast_seconds: Math.min(total, n(s.fast_seconds, d.fast_seconds, 1, 120)),
    slow_pop: n(s.slow_pop, d.slow_pop, 0, 100),
    total_seconds: total,
    questions: n(s.questions, d.questions, 3, 10),
    perfect_bonus: n(s.perfect_bonus, d.perfect_bonus, 0, 100),
  };
}

/** Difficulty ladder for a round: easy first, hardest last. */
function ladder(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i < count * 0.4 ? 1 : i < count * 0.8 ? 2 : 3));
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let x = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    const j = x % (i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

type BankRow = { id: string; category: string; difficulty: number; q: string; options: string[]; answer: number };

/** Pick a fresh round from the bank: never-used first, one per category, rising difficulty. */
async function pickFromBank(date: string, count: number): Promise<{ rows: BankRow[] } | null> {
  const { data: fresh } = await supabaseAdmin
    .from("trivia_bank")
    .select("id, category, difficulty, q, options, answer")
    .eq("status", "active")
    .is("used_on", null)
    .limit(1000);
  let pool = (fresh ?? []) as unknown as BankRow[];
  if (pool.length < count * 3) {
    const { data: old } = await supabaseAdmin
      .from("trivia_bank")
      .select("id, category, difficulty, q, options, answer")
      .eq("status", "active")
      .not("used_on", "is", null)
      .order("used_on", { ascending: true })
      .limit(300);
    pool = [...pool, ...((old ?? []) as unknown as BankRow[])];
  }
  if (pool.length < count) return null;
  const seed = hashSeed(date);
  pool = shuffle(pool, seed);
  const cats = shuffle([...TRIVIA_CATEGORIES.map((c) => c.key)], seed + 7);
  const picked: BankRow[] = [];
  const used = new Set<string>();
  ladder(count).forEach((diff, i) => {
    const cat = cats[i % cats.length];
    const match =
      pool.find((r) => !used.has(r.id) && r.category === cat && r.difficulty === diff) ??
      pool.find((r) => !used.has(r.id) && r.difficulty === diff && !picked.some((p) => p.category === r.category)) ??
      pool.find((r) => !used.has(r.id) && r.difficulty === diff) ??
      pool.find((r) => !used.has(r.id));
    if (match) {
      used.add(match.id);
      picked.push(match);
    }
  });
  return picked.length === count ? { rows: picked } : null;
}

const FALLBACK: BankRow[] = [
  { id: "f1", category: "sports", difficulty: 1, q: "How many points is a touchdown worth?", options: ["3", "6", "7", "2"], answer: 1 },
  { id: "f2", category: "places", difficulty: 1, q: "What is the largest US state by area?", options: ["Texas", "California", "Alaska", "Montana"], answer: 2 },
  { id: "f3", category: "science", difficulty: 2, q: "Which planet has the most known moons?", options: ["Jupiter", "Saturn", "Uranus", "Neptune"], answer: 1 },
  { id: "f4", category: "history", difficulty: 2, q: "Which country gave the US the Statue of Liberty?", options: ["Spain", "France", "England", "Italy"], answer: 1 },
  { id: "f5", category: "arts", difficulty: 3, q: "Who wrote the novel 'Moby-Dick'?", options: ["Mark Twain", "Herman Melville", "Nathaniel Hawthorne", "Jack London"], answer: 1 },
];

/**
 * Today's round. Admin-scheduled puzzles win; otherwise the app picks one from
 * the bank the first time anyone opens that date, saves it, and marks the
 * questions used so they don't come back.
 */
export async function triviaDaySet(date: string, count: number): Promise<TriviaDaySet> {
  const read = async () => {
    const { data } = await supabaseAdmin
      .from("game_puzzles")
      .select("payload, solution")
      .eq("game_key", "trivia")
      .eq("puzzle_date", date)
      .maybeSingle();
    const qs = (data?.payload as { questions?: Partial<TriviaQ>[] } | null)?.questions;
    const ans = (data?.solution as { answers?: number[] } | null)?.answers;
    if (Array.isArray(qs) && Array.isArray(ans) && qs.length > 0 && qs.length === ans.length) {
      return {
        questions: qs.map((q) => ({
          q: String(q.q ?? ""),
          options: (q.options ?? []).map(String),
          category: String(q.category ?? "mixed"),
          difficulty: Number(q.difficulty ?? 2),
        })),
        answers: ans,
      };
    }
    return null;
  };
  const existing = await read();
  if (existing) return existing;

  const pick = await pickFromBank(date, count);
  const rows = pick?.rows ?? FALLBACK.slice(0, count);
  const { data: inserted } = await supabaseAdmin
    .from("game_puzzles")
    .upsert(
      {
        game_key: "trivia",
        puzzle_date: date,
        payload: {
          questions: rows.map((r) => ({ q: r.q, options: r.options, category: r.category, difficulty: r.difficulty })),
        },
        solution: { answers: rows.map((r) => r.answer) },
      },
      { onConflict: "game_key,puzzle_date", ignoreDuplicates: true },
    )
    .select("id");
  if (pick && (inserted?.length ?? 0) > 0) {
    await supabaseAdmin.from("trivia_bank").update({ used_on: date }).in("id", pick.rows.map((r) => r.id));
  }
  return (await read()) ?? {
    questions: rows.map((r) => ({ q: r.q, options: r.options, category: r.category, difficulty: r.difficulty })),
    answers: rows.map((r) => r.answer),
  };
}

/** Stored play for Trivia Night. Older rows were a plain array of picks. */
export type TriviaPlay = { v: 2; served: string[]; picks: number[]; ms: number[]; pops: number[] };

export function parseTriviaPlay(raw: unknown): TriviaPlay {
  if (Array.isArray(raw)) {
    const picks = raw.map((n) => Number(n));
    return { v: 2, served: [], picks, ms: picks.map(() => 0), pops: picks.map(() => 0) };
  }
  const o = (raw ?? {}) as Partial<TriviaPlay>;
  return {
    v: 2,
    served: Array.isArray(o.served) ? o.served.map(String) : [],
    picks: Array.isArray(o.picks) ? o.picks.map(Number) : [],
    ms: Array.isArray(o.ms) ? o.ms.map(Number) : [],
    pops: Array.isArray(o.pops) ? o.pops.map(Number) : [],
  };
}

/** Small allowance for network lag before a fast answer drops to the slower tier. */
export const TRIVIA_LAG_MS = 1500;

export function scoreAnswer(rules: TriviaRules, correct: boolean, elapsedMs: number): number {
  if (!correct) return 0;
  if (elapsedMs > rules.total_seconds * 1000 + TRIVIA_LAG_MS) return 0;
  return elapsedMs <= rules.fast_seconds * 1000 + TRIVIA_LAG_MS ? rules.fast_pop : rules.slow_pop;
}

// ===== AI question writer (admin-triggered; results wait for review) =====

export async function generateTriviaQuestions(opts: {
  category: string;
  difficulty: number;
  count: number;
}): Promise<{ inserted: number }> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("ai_unavailable");
  const cat = TRIVIA_CATEGORIES.find((c) => c.key === opts.category);
  if (!cat) throw new Error("bad_category");
  const level = ["", "EASY: most adults would get it", "MEDIUM: about half of adults would get it", "HARD: only trivia buffs would get it"][opts.difficulty];
  const prompt = `Write ${opts.count} original multiple-choice trivia questions for a sports-bar trivia night.
Category: ${cat.label} (${cat.topics}). Difficulty: ${level}.
Rules: exactly 4 short options, one correct, plausible wrong options, stable verifiable facts (nothing that changes over time), question under 140 characters, options under 40 characters, vary the correct position.
Return JSON only: {"questions":[{"q":"...","options":["a","b","c","d"],"answer":0}]}`;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(res.status === 429 ? "ai_rate_limited" : res.status === 402 ? "ai_credits" : "ai_failed");
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  let text = String(body.choices?.[0]?.message?.content ?? "").trim().replace(/^```(json)?/, "").replace(/```$/, "");
  const parsed = JSON.parse(text) as { questions?: { q?: string; options?: string[]; answer?: number }[] };
  const rows = (parsed.questions ?? [])
    .filter(
      (q) =>
        typeof q.q === "string" &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        Number.isInteger(q.answer) &&
        q.answer! >= 0 &&
        q.answer! < 4,
    )
    .map((q) => ({
      category: cat.key,
      difficulty: opts.difficulty,
      q: q.q!.trim().slice(0, 300),
      options: q.options!.map((o) => String(o).trim().slice(0, 120)),
      answer: q.answer!,
      status: "pending",
      source: "ai",
    }));
  text = "";
  if (rows.length === 0) return { inserted: 0 };
  const { data } = await supabaseAdmin
    .from("trivia_bank")
    .upsert(rows, { onConflict: "q", ignoreDuplicates: true })
    .select("id");
  return { inserted: data?.length ?? 0 };
}
