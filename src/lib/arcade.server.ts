// Server-only Arcade engine: today's puzzle, answer checking and POP payout.
// Skill only, free to play, one reward per game per day. Answers never leave
// the server until the member has finished.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { CrosswordEntry, LetterMark, TileGroup } from "./arcade";

export const POPWORD_MAX_GUESSES = 6;
export const TRIVIA_PERFECT_BONUS_MULTIPLIER = 2; // bonus = pop_reward x this on 5/5

const FALLBACK_WORDS = [
  "PARTY", "TOKEN", "LOCAL", "TACOS", "PIZZA", "MUSIC", "DANCE", "GRILL", "SUSHI", "PLAZA", "CROWD", "STAGE", "LIGHT", "BADGE", "BONUS", "CHEER", "EVENT", "FEAST", "GAMES", "HAPPY", "LUNCH", "MANGO", "NACHO", "OASIS", "PEACH", "QUEST", "RALLY", "SALSA", "TOAST", "VIBES", "YACHT", "ZESTY", "BEACH", "CANDY", "DRINK", "FLAME", "GLOWS", "BRAVO", "CRISP", "DONUT",
];

const FALLBACK_TRIVIA: { q: string; options: string[]; a: number }[] = [
  { q: "How many players are on the field for one team in American football?", options: ["9", "10", "11", "12"], a: 2 },
  { q: "Which city is known as the Big D?", options: ["Denver", "Dallas", "Detroit", "Durham"], a: 1 },
  { q: "What is the main ingredient in guacamole?", options: ["Avocado", "Tomato", "Lime", "Onion"], a: 0 },
  { q: "How many minutes are in a regulation NBA quarter?", options: ["10", "12", "15", "20"], a: 1 },
  { q: "What does a barista make?", options: ["Bread", "Coffee", "Cocktails", "Pasta"], a: 1 },
  { q: "Which planet is known as the Red Planet?", options: ["Venus", "Jupiter", "Mars", "Saturn"], a: 2 },
  { q: "What is the largest US state by area?", options: ["Texas", "California", "Alaska", "Montana"], a: 2 },
  { q: "How many strings does a standard guitar have?", options: ["4", "5", "6", "7"], a: 2 },
  { q: "Which country gave the US the Statue of Liberty?", options: ["Spain", "France", "England", "Italy"], a: 1 },
  { q: "What is sushi traditionally wrapped in?", options: ["Rice paper", "Seaweed", "Lettuce", "Tofu skin"], a: 1 },
  { q: "How many points is a touchdown worth?", options: ["3", "6", "7", "2"], a: 1 },
  { q: "Which instrument has 88 keys?", options: ["Organ", "Accordion", "Piano", "Harp"], a: 2 },
  { q: "What color do you get mixing blue and yellow?", options: ["Green", "Purple", "Orange", "Brown"], a: 0 },
  { q: "Which month has the fewest days?", options: ["April", "February", "June", "November"], a: 1 },
  { q: "What is the capital of Texas?", options: ["Houston", "Dallas", "Austin", "San Antonio"], a: 2 },
  { q: "What is a group of lions called?", options: ["Pack", "Herd", "Pride", "Flock"], a: 2 },
  { q: "How many sides does a hexagon have?", options: ["5", "6", "7", "8"], a: 1 },
  { q: "Which fruit is dried to make raisins?", options: ["Plums", "Grapes", "Figs", "Cherries"], a: 1 },
  { q: "Which sport uses a shuttlecock?", options: ["Tennis", "Squash", "Badminton", "Pickleball"], a: 2 },
  { q: "What is the freezing point of water in Fahrenheit?", options: ["0", "32", "50", "100"], a: 1 },
  { q: "Which ocean is the largest?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], a: 3 },
  { q: "Brisket is most associated with which cooking style?", options: ["Frying", "Smoking", "Boiling", "Steaming"], a: 1 },
  { q: "How many cards are in a standard deck?", options: ["48", "50", "52", "54"], a: 2 },
  { q: "Which is the tallest animal?", options: ["Elephant", "Giraffe", "Moose", "Camel"], a: 1 },
  { q: "What language has the most native speakers?", options: ["English", "Spanish", "Mandarin", "Hindi"], a: 2 },
];

/** Today's puzzle date in the player's own time zone (falls back to UTC). */
export function todayKey(now = new Date(), tz?: string | null): string {
  if (tz) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now);
      if (/^\d{4}-\d{2}-\d{2}$/.test(parts)) return parts;
    } catch {
      /* bad tz — fall through to UTC */
    }
  }
  return now.toISOString().slice(0, 10);
}

function dayIndex(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}

export type GameRow = {
  key: string;
  title: string;
  enabled: boolean;
  pop_reward: number;
  daily_cap_pop: number;
  settings?: unknown;
};

export async function readGames(): Promise<Record<string, GameRow>> {
  const { data } = await supabaseAdmin
    .from("games")
    .select("key, title, enabled, pop_reward, daily_cap_pop, settings")
    .order("sort_order");
  const out: Record<string, GameRow> = {};
  for (const r of data ?? []) out[r.key] = r as GameRow;
  return out;
}

/** Today's POPword answer: scheduled by admin, else the built-in rotation. */
export async function popwordAnswer(date: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("game_puzzles")
    .select("solution")
    .eq("game_key", "popword")
    .eq("puzzle_date", date)
    .maybeSingle();
  const word = String((data?.solution as { word?: string } | null)?.word ?? "").toUpperCase();
  if (/^[A-Z]{5}$/.test(word)) return word;
  return FALLBACK_WORDS[dayIndex(date) % FALLBACK_WORDS.length]!;
}

export type TriviaSet = { questions: { q: string; options: string[] }[]; answers: number[] };

export async function triviaSet(date: string): Promise<TriviaSet> {
  const { data } = await supabaseAdmin
    .from("game_puzzles")
    .select("payload, solution")
    .eq("game_key", "trivia")
    .eq("puzzle_date", date)
    .maybeSingle();
  const qs = (data?.payload as { questions?: { q: string; options: string[] }[] } | null)?.questions;
  const ans = (data?.solution as { answers?: number[] } | null)?.answers;
  if (Array.isArray(qs) && Array.isArray(ans) && qs.length > 0 && qs.length === ans.length) {
    return { questions: qs, answers: ans };
  }
  const start = (dayIndex(date) * 5) % FALLBACK_TRIVIA.length;
  const picked = Array.from({ length: 5 }, (_, i) => FALLBACK_TRIVIA[(start + i) % FALLBACK_TRIVIA.length]!);
  return { questions: picked.map(({ q, options }) => ({ q, options })), answers: picked.map((p) => p.a) };
}

/** Standard Wordle marking, handling repeated letters correctly. */
export function markGuess(guess: string, answer: string): LetterMark[] {
  const marks: LetterMark[] = Array(5).fill("miss");
  const left: Record<string, number> = {};
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) marks[i] = "hit";
    else left[answer[i]!] = (left[answer[i]!] ?? 0) + 1;
  }
  for (let i = 0; i < 5; i++) {
    if (marks[i] === "hit") continue;
    const c = guess[i]!;
    if ((left[c] ?? 0) > 0) {
      marks[i] = "near";
      left[c]!--;
    }
  }
  return marks;
}

/** Pay out a finished game once. Respects the game's cap and global earn limits. */
export async function payGame(opts: {
  email: string;
  userId: string;
  game: GameRow;
  date: string;
  amount: number;
}): Promise<number> {
  void opts;
  return 0; // games are just for fun here — no POP payouts
}

// ===== Phase B games: POP Tiles, POP Crossword, Word Hive =====

export const TILES_MAX_MISSES = 4;
export const CROSSWORD_MAX_MISSES = 2;
export const HIVE_MIN_LEN = 4;

/** Groups are listed easy → medium → hard → harder, with red herrings across groups. */
const FALLBACK_TILES: TileGroup[][] = [
  [
    { name: "Fruits", words: ["APPLE", "BANANA", "CHERRY", "KIWI"] },
    { name: "Shades of green", words: ["LIME", "OLIVE", "MINT", "JADE"] },
    { name: "___cake", words: ["CUP", "PAN", "CHEESE", "SPONGE"] },
    { name: "Hidden animals", words: ["SCATTER", "BEARD", "CRATE", "PIGMENT"] },
  ],
  [
    { name: "Sports", words: ["SOCCER", "TENNIS", "HOCKEY", "RUGBY"] },
    { name: "Golf gear", words: ["CLUB", "TEE", "IRON", "WEDGE"] },
    { name: "Things with keys", words: ["PIANO", "LOCK", "MAP", "FLORIDA"] },
    { name: "___ball", words: ["SNOW", "EYE", "MEAT", "ODD"] },
  ],
  [
    { name: "Weather", words: ["RAIN", "WIND", "HAIL", "FOG"] },
    { name: "Coffee orders", words: ["LATTE", "MOCHA", "AMERICANO", "CORTADO"] },
    { name: "Texas cities", words: ["AUSTIN", "TYLER", "KATY", "IRVING"] },
    { name: "Hidden body parts", words: ["CHINA", "WHIPS", "LEGEND", "EARTH"] },
  ],
];

/** A mini crossword with black corner squares, like a real daily mini. */
const FALLBACK_CROSSWORD = {
  grid: ["#CLIP", "ALONE", "ROOTS", "ASSET", "BEER#"],
  acrossClues: [
    "Paper holder, or short video",
    "By yourself",
    "Plant parts underground",
    "Something valuable",
    "Brewpub pour",
  ],
  downClues: [
    "Shut",
    "Not tight",
    "Bury, as a body",
    "Annoying bug",
    "Desert horse breed",
  ],
};

type HiveSet_ = { letters: string; center: string; targets: string[] };

const FALLBACK_HIVE: HiveSet_[] = [
  {
    letters: "CATRESN",
    center: "A",
    targets: ["TRACE", "CREATE", "CATER", "RATES", "SCARE", "NECTARS"],
  },
  {
    letters: "LANDERG",
    center: "R",
    targets: ["LAGER", "RANGE", "ANGLER", "LARGE", "REGAL", "GARDENER"],
  },
  {
    letters: "STOPMAK",
    center: "O",
    targets: ["STOMP", "TOAST", "MOST", "SPOT", "TOMATO", "OPTS"],
  },
];

function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = (seed * 2654435761) % 2147483647 || 1;
  const rand = () => {
    s = (s * 48271) % 2147483647;
    return s / 2147483647;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/** Today's POP Tiles puzzle: four hidden groups and the shuffled 16 words. */
export async function tilesSet(date: string): Promise<{ groups: TileGroup[]; tiles: string[] }> {
  const { data } = await supabaseAdmin
    .from("game_puzzles")
    .select("solution")
    .eq("game_key", "poptiles")
    .eq("puzzle_date", date)
    .maybeSingle();
  const groups = (data?.solution as { groups?: TileGroup[] } | null)?.groups;
  if (
    Array.isArray(groups) &&
    groups.length === 4 &&
    groups.every((g) => Array.isArray(g.words) && g.words.length === 4)
  ) {
    const normalized = groups.map((g) => ({
      name: String(g.name ?? "").slice(0, 60),
      words: g.words.map((w) => String(w).toUpperCase()),
    }));
    const words = normalized.flatMap((g) => g.words);
    if (new Set(words).size === 16) {
      return { groups: normalized, tiles: seededShuffle(words, dayIndex(date)) };
    }
  }
  const pick = FALLBACK_TILES[dayIndex(date) % FALLBACK_TILES.length]!;
  return {
    groups: pick,
    tiles: seededShuffle(pick.flatMap((g) => g.words), dayIndex(date)),
  };
}

export type CrosswordSet = { grid: string[]; entries: CrosswordEntry[] };

/** Every maximal across/down run of 2+ letters becomes an entry, numbered in reading order. */
export function crosswordEntries(grid: string[]): CrosswordEntry[] {
  const n = grid.length;
  const numAt: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  let number = 0;
  const runLenAcross = (r: number, c: number) => {
    let len = 0;
    while (c + len < n && grid[r]![c + len] !== "#") len++;
    return len;
  };
  const runLenDown = (r: number, c: number) => {
    let len = 0;
    while (r + len < n && grid[r + len]![c] !== "#") len++;
    return len;
  };
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (grid[r]![c] === "#") continue;
      const startsAcross = (c === 0 || grid[r]![c - 1] === "#") && runLenAcross(r, c) > 1;
      const startsDown = (r === 0 || grid[r - 1]![c] === "#") && runLenDown(r, c) > 1;
      if (startsAcross || startsDown) numAt[r]![c] = ++number;
    }
  }
  const across: CrosswordEntry[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (grid[r]![c] === "#") continue;
      if ((c === 0 || grid[r]![c - 1] === "#") && runLenAcross(r, c) > 1) {
        across.push({
          id: `across-${r}-${c}`,
          dir: "across",
          number: numAt[r]![c]!,
          row: r,
          col: c,
          len: runLenAcross(r, c),
          clue: "",
        });
      }
    }
  }
  const down: CrosswordEntry[] = [];
  for (let c = 0; c < n; c++) {
    for (let r = 0; r < n; r++) {
      if (grid[r]![c] === "#") continue;
      if ((r === 0 || grid[r - 1]![c] === "#") && runLenDown(r, c) > 1) {
        down.push({
          id: `down-${r}-${c}`,
          dir: "down",
          number: numAt[r]![c]!,
          row: r,
          col: c,
          len: runLenDown(r, c),
          clue: "",
        });
      }
    }
  }
  down.sort((a, b) => a.number - b.number);
  return [...across, ...down];
}

/** Today's POP Crossword: the solution grid and numbered clues. */
export async function crosswordSet(date: string): Promise<CrosswordSet> {
  const { data } = await supabaseAdmin
    .from("game_puzzles")
    .select("payload, solution")
    .eq("game_key", "popcross")
    .eq("puzzle_date", date)
    .maybeSingle();
  const raw = (data?.solution as { grid?: string[] } | null)?.grid;
  const payload = (data?.payload ?? {}) as { acrossClues?: unknown; downClues?: unknown };
  const grid = Array.isArray(raw)
    ? raw.map((r) => String(r).toUpperCase())
    : null;
  if (
    grid &&
    grid.length === 5 &&
    grid.every((r) => /^[A-Z#]{5}$/.test(r))
  ) {
    const entries = crosswordEntries(grid);
    const across = entries.filter((e) => e.dir === "across");
    const down = entries.filter((e) => e.dir === "down");
    const aClues = payload.acrossClues;
    const dClues = payload.downClues;
    if (
      Array.isArray(aClues) &&
      Array.isArray(dClues) &&
      aClues.length === across.length &&
      dClues.length === down.length
    ) {
      let ai = 0;
      let di = 0;
      return {
        grid,
        entries: entries.map((e) =>
          e.dir === "across"
            ? { ...e, clue: String(aClues[ai++]).slice(0, 200) }
            : { ...e, clue: String(dClues[di++]).slice(0, 200) },
        ),
      };
    }
  }
  const entries = crosswordEntries(FALLBACK_CROSSWORD.grid);
  let ai = 0;
  let di = 0;
  return {
    grid: FALLBACK_CROSSWORD.grid,
    entries: entries.map((e) =>
      e.dir === "across"
        ? { ...e, clue: FALLBACK_CROSSWORD.acrossClues[ai++] ?? "" }
        : { ...e, clue: FALLBACK_CROSSWORD.downClues[di++] ?? "" },
    ),
  };
}

export type HiveSet = { letters: string[]; center: string; targets: string[] };

/** Today's Word Hive: 7 letters (one center) and the hidden target words. */
export async function hiveSet(date: string): Promise<HiveSet> {
  const { data } = await supabaseAdmin
    .from("game_puzzles")
    .select("payload, solution")
    .eq("game_key", "wordhive")
    .eq("puzzle_date", date)
    .maybeSingle();
  const payload = (data?.payload ?? {}) as { letters?: unknown; center?: unknown };
  const rawTargets = (data?.solution as { targets?: string[] } | null)?.targets;
  const letters = typeof payload.letters === "string" ? payload.letters.toUpperCase() : "";
  const center = typeof payload.center === "string" ? payload.center.toUpperCase() : "";
  const targets = Array.isArray(rawTargets) ? rawTargets.map((t) => String(t).toUpperCase()) : null;
  const validTargets =
    targets &&
    targets.length > 0 &&
    targets.every(
      (t) =>
        /^[A-Z]{4,12}$/.test(t) &&
        [...t].every((ch) => letters.includes(ch)) &&
        letters.includes(center) &&
        t.includes(center),
    );
  if (
    /^[A-Z]{7}$/.test(letters) &&
    new Set(letters).size === 7 &&
    validTargets &&
    new Set(targets!).size === targets!.length
  ) {
    const outer = seededShuffle(
      [...letters].filter((ch) => ch !== center),
      dayIndex(date),
    );
    return { letters: outer, center, targets: targets! };
  }
  const pick = FALLBACK_HIVE[dayIndex(date) % FALLBACK_HIVE.length]!;
  const outer = seededShuffle(
    [...pick.letters].filter((ch) => ch !== pick.center),
    dayIndex(date),
  );
  return { letters: outer, center: pick.center, targets: pick.targets };
}

// ===== POP Numbers =====
export type NumbersSet = { target: number; tiles: number[]; solution: string[] };

const OP_SYMBOL: Record<string, string> = { "+": "+", "-": "−", x: "×", "/": "÷" };

function stepText(x: number, op: string, y: number, r: number) {
  return `${x} ${OP_SYMBOL[op]} ${y} = ${r}`;
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Built-in daily puzzle: the target is built from the tiles, so it's always solvable. */
function fallbackNumbers(date: string): NumbersSet {
  const rand = rng(dayIndex(date) * 7919 + 17);
  for (let attempt = 0; attempt < 500; attempt++) {
    const bigCount = 1 + Math.floor(rand() * 3);
    const bigs = seededShuffle([25, 50, 75, 100], Math.floor(rand() * 1e6)).slice(0, bigCount);
    const smalls: number[] = [];
    while (smalls.length < 6 - bigCount) smalls.push(1 + Math.floor(rand() * 10));
    const tiles = seededShuffle([...bigs, ...smalls], Math.floor(rand() * 1e6));
    let pool = [...tiles];
    const steps: string[] = [];
    const wanted = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < wanted && pool.length > 1; i++) {
      const a = Math.floor(rand() * pool.length);
      let b = Math.floor(rand() * (pool.length - 1));
      if (b >= a) b += 1;
      const op = (["+", "-", "x", "/"] as const)[Math.floor(rand() * 4)]!;
      const x = pool[a]!;
      const y = pool[b]!;
      const r = op === "+" ? x + y : op === "-" ? x - y : op === "x" ? x * y : y && x % y === 0 ? x / y : NaN;
      if (!Number.isInteger(r) || r <= 0 || (op === "x" && (x === 1 || y === 1)) || (op === "/" && y === 1)) continue;
      pool = pool.filter((_, j) => j !== a && j !== b);
      pool.push(r);
      steps.push(stepText(x, op, y, r));
    }
    const target = pool[pool.length - 1]!;
    if (steps.length >= 3 && target >= 101 && target <= 999 && !tiles.includes(target)) {
      return { target, tiles, solution: steps };
    }
  }
  return { target: 347, tiles: [2, 5, 7, 25, 50, 100], solution: ["50 × 7 = 350", "5 − 2 = 3", "350 − 3 = 347"] };
}

/** Find one exact solution (depth-first, stops at the first hit). */
export function solveNumbers(tiles: number[], target: number, budget = 3_000_000): string[] | null {
  let calls = 0;
  const walk = (pool: number[], steps: string[]): string[] | null => {
    if (++calls > budget) return null;
    if (pool.includes(target)) return steps;
    for (let i = 0; i < pool.length; i++) {
      for (let j = 0; j < pool.length; j++) {
        if (i === j) continue;
        const x = pool[i]!;
        const y = pool[j]!;
        for (const op of ["+", "-", "x", "/"] as const) {
          if ((op === "+" || op === "x") && i > j) continue;
          const r = op === "+" ? x + y : op === "-" ? x - y : op === "x" ? x * y : x % y === 0 ? x / y : NaN;
          if (!Number.isInteger(r) || r <= 0) continue;
          const rest = pool.filter((_, k) => k !== i && k !== j);
          rest.push(r);
          const hit = walk(rest, [...steps, stepText(x, op, y, r)]);
          if (hit) return hit;
        }
      }
    }
    return null;
  };
  return walk([...tiles], []);
}

export async function numbersSet(date: string): Promise<NumbersSet> {
  const { data } = await supabaseAdmin
    .from("game_puzzles")
    .select("payload, solution")
    .eq("game_key", "popnumbers")
    .eq("puzzle_date", date)
    .maybeSingle();
  const p = (data?.payload ?? {}) as { target?: unknown; tiles?: unknown };
  const tiles = Array.isArray(p.tiles) ? p.tiles.map(Number) : [];
  const target = Number(p.target);
  const steps = (data?.solution as { steps?: unknown } | null)?.steps;
  if (
    tiles.length === 6 &&
    tiles.every((t) => Number.isInteger(t) && t > 0 && t <= 1000) &&
    Number.isInteger(target) &&
    target > 0 &&
    Array.isArray(steps)
  ) {
    return { target, tiles, solution: steps.map(String) };
  }
  return fallbackNumbers(date);
}

/** POP for a finished round: exact = full reward, within 5 = half, within 10 = a fifth. */
export function numbersPop(reward: number, off: number): number {
  if (off === 0) return reward;
  if (off <= 5) return Math.floor(reward / 2);
  if (off <= 10) return Math.floor(reward / 5);
  return 0;
}
