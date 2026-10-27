// Shared, client-safe Arcade types. Solutions never appear here — they stay
// on the server and are only revealed once a game is finished.
export type LetterMark = "hit" | "near" | "miss";

export type PopwordState = {
  key: "popword";
  title: string;
  enabled: boolean;
  pop: number;
  maxGuesses: number;
  guesses: { word: string; marks: LetterMark[] }[];
  finished: boolean;
  solved: boolean;
  popAwarded: number;
  answer: string | null;
};

export const TRIVIA_CATEGORIES = [
  { key: "places", label: "Places", topics: "geography, countries, capitals, landmarks, cities" },
  { key: "screen", label: "Screen & Music", topics: "movies, TV, music, pop culture, video games" },
  { key: "history", label: "History", topics: "world and US history, famous people, inventions" },
  { key: "arts", label: "Arts & Words", topics: "books, art, language, mythology, food and drink" },
  { key: "science", label: "Science & Nature", topics: "animals, space, the body, chemistry, technology" },
  { key: "sports", label: "Sports & Games", topics: "sports, athletes, rules, board games, hobbies" },
] as const;

export function triviaCategoryLabel(key: string): string {
  return TRIVIA_CATEGORIES.find((c) => c.key === key)?.label ?? "Mixed Bag";
}

/** Admin-tunable Trivia Night rules (CryptoPOP Web → games.update settings). */
export type TriviaRules = {
  fast_pop: number;
  fast_seconds: number;
  slow_pop: number;
  total_seconds: number;
  questions: number;
  perfect_bonus: number;
};

export const TRIVIA_DEFAULT_RULES: TriviaRules = {
  fast_pop: 2,
  fast_seconds: 10,
  slow_pop: 1,
  total_seconds: 30,
  questions: 5,
  perfect_bonus: 0,
};

export type TriviaAnswered = {
  q: string;
  options: string[];
  category: string;
  difficulty: number;
  pick: number;
  correct: number;
  pop: number;
  seconds: number;
};

export type TriviaState = {
  key: "trivia";
  title: string;
  enabled: boolean;
  rules: TriviaRules;
  total: number;
  answered: TriviaAnswered[];
  /** The question on screen right now (served, not yet answered). */
  current: {
    index: number;
    q: string;
    options: string[];
    category: string;
    difficulty: number;
    remainingMs: number;
  } | null;
  finished: boolean;
  score: number;
  popAwarded: number;
};

export type TileGroup = { name: string; words: string[] };

export type TileAttempt = { words: string[]; correct: boolean; name?: string; level?: number };

export type PoptilesState = {
  key: "poptiles";
  title: string;
  enabled: boolean;
  pop: number;
  tiles: string[];
  attempts: TileAttempt[];
  missesLeft: number;
  finished: boolean;
  solved: boolean;
  popAwarded: number;
  groups: TileGroup[] | null;
};

export type CrosswordEntry = {
  id: string;
  dir: "across" | "down";
  number: number;
  row: number;
  col: number;
  len: number;
  clue: string;
};

export type CrosswordState = {
  key: "popcross";
  title: string;
  enabled: boolean;
  pop: number;
  size: number;
  entries: CrosswordEntry[];
  values: Record<string, string>;
  missesLeft: number;
  finished: boolean;
  solved: boolean;
  popAwarded: number;
  grid: string[] | null;
};

export type HiveState = {
  key: "wordhive";
  title: string;
  enabled: boolean;
  pop: number;
  letters: string[];
  center: string;
  targetCount: number;
  found: string[];
  finished: boolean;
  solved: boolean;
  popAwarded: number;
  targets: string[] | null;
  /** After the game: other qualifying words the player didn't find. */
  missed: string[] | null;
};

export type ArcadeView = {
  enabled: boolean;
  date: string;
  popword: PopwordState | null;
  trivia: TriviaState | null;
  poptiles: PoptilesState | null;
  popcross: CrosswordState | null;
  wordhive: HiveState | null;
  popnumbers: NumbersState | null;
};

/** Spoiler-free share line for POP Tiles. */
export function poptilesShareText(state: PoptilesState): string {
  const found = state.attempts.filter((a) => a.correct).length;
  return `POP Tiles ${found}/${state.groups?.length ?? 4}`;
}

/** Spoiler-free share line for Word Hive. */
export function hiveShareText(state: HiveState): string {
  const n = state.solved ? state.targets?.length ?? state.found.length : state.found.length;
  return `Word Hive — ${n} words found`;
}

/** Spoiler-free share grid, Wordle style. */
export function popwordShareGrid(state: PopwordState): string {
  const rows = state.guesses
    .map((g) => g.marks.map((m) => (m === "hit" ? "🟩" : m === "near" ? "🟨" : "⬛")).join(""))
    .join("\n");
  const n = state.solved ? state.guesses.length : "X";
  return `POPword ${n}/${state.maxGuesses}\n${rows}`;
}

export function triviaShareGrid(state: TriviaState): string {
  const row = state.answered
    .map((a) => (a.pick !== a.correct ? "🟥" : a.pop >= state.rules.fast_pop ? "⚡" : "🟩"))
    .join("");
  return `CryptoPOP Trivia Night ${state.score}/${state.total}\n${row}`;
}

// ===== POP Numbers =====
export type NumbersOp = "+" | "-" | "x" | "/";
export type NumbersStep = { a: number; op: NumbersOp; b: number };
export type NumbersState = {
  key: "popnumbers";
  title: string;
  enabled: boolean;
  pop: number;
  target: number;
  tiles: number[];
  finished: boolean;
  solved: boolean;
  result: number | null;
  moves: number;
  popAwarded: number;
  solution: string[] | null;
};

/** Apply one step to a pool of tiles. Returns null if the move isn't allowed. */
export function applyNumbersStep(pool: number[], s: NumbersStep): number[] | null {
  if (s.a === s.b || s.a < 0 || s.b < 0 || s.a >= pool.length || s.b >= pool.length) return null;
  const x = pool[s.a]!;
  const y = pool[s.b]!;
  let r: number;
  if (s.op === "+") r = x + y;
  else if (s.op === "-") r = x - y;
  else if (s.op === "x") r = x * y;
  else if (s.op === "/") r = y !== 0 && x % y === 0 ? x / y : NaN;
  else return null;
  if (!Number.isInteger(r) || r <= 0) return null;
  const next = pool.filter((_, i) => i !== s.a && i !== s.b);
  next.push(r);
  return next;
}

export function numbersShareText(state: NumbersState): string {
  if (state.solved) return `POP Numbers 🎯 exact in ${state.moves} moves`;
  const off = state.result == null ? null : Math.abs(state.result - state.target);
  return off == null ? "POP Numbers" : `POP Numbers — ${off} away`;
}
