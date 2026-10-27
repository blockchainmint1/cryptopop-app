// Arcade over RPC. Every answer is checked on the server; POP is paid once per
// game per day through the normal POP ledger. Free to play, skill only.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type {
  ArcadeView,
  CrosswordEntry,
  CrosswordState,
  HiveState,
  LetterMark,
  PopwordState,
  PoptilesState,
  TriviaState,
  NumbersState,
  NumbersStep,
} from "./arcade";

/** Player's IANA time zone, sent by the client so the arcade day resets at their local midnight. */
/** Random per-device player id (no login in the wallet). */
const playerField = z.string().uuid();
const tzField = z.string().max(64).optional();

async function guard(_userId: string) {
  // Just-for-fun arcade: no feature gates, no POP payouts.
}

type PlayRow = {
  answers: unknown;
  finished: boolean;
  solved: boolean;
  score: number;
  pop_awarded: number;
};

async function readPlay(userId: string, game: string, date: string): Promise<PlayRow | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("game_plays")
    .select("answers, finished, solved, score, pop_awarded")
    .eq("user_id", userId)
    .eq("game_key", game)
    .eq("puzzle_date", date)
    .maybeSingle();
  return (data as PlayRow | null) ?? null;
}

async function buildView(userId: string, tz?: string): Promise<ArcadeView> {
  const eng = await import("./arcade.server");
  const date = eng.todayKey(undefined, tz);
  const games = await eng.readGames();
  const view: ArcadeView = {
    enabled: true,
    date,
    popword: null,
    trivia: null,
    poptiles: null,
    popcross: null,
    wordhive: null,
    popnumbers: null,
  };

  const pw = games["popword"];
  if (pw?.enabled) {
    const play = await readPlay(userId, "popword", date);
    const guesses = (Array.isArray(play?.answers) ? play!.answers : []) as {
      word: string;
      marks: LetterMark[];
    }[];
    const finished = !!play?.finished;
    const state: PopwordState = {
      key: "popword",
      title: pw.title,
      enabled: true,
      pop: Math.min(pw.pop_reward, pw.daily_cap_pop),
      maxGuesses: eng.POPWORD_MAX_GUESSES,
      guesses,
      finished,
      solved: !!play?.solved,
      popAwarded: play?.pop_awarded ?? 0,
      answer: finished ? await eng.popwordAnswer(date) : null,
    };
    view.popword = state;
  }

  const tr = games["trivia"];
  if (tr?.enabled) {
    const tv = await import("./arcade-trivia.server");
    const rules = tv.readRules(tr.settings);
    const play = await readPlay(userId, "trivia", date);
    const set = await tv.triviaDaySet(date, rules.questions);
    const p = tv.parseTriviaPlay(play?.answers);
    const answered: TriviaState["answered"] = p.picks.map((pick, i) => ({
      ...set.questions[i]!,
      pick,
      correct: set.answers[i] ?? -1,
      pop: p.pops[i] ?? 0,
      seconds: Math.round((p.ms[i] ?? 0) / 100) / 10,
    }));
    const idx = p.picks.length;
    const finished = !!play?.finished || idx >= set.questions.length;
    let current: TriviaState["current"] = null;
    if (!finished && p.served[idx]) {
      const q = set.questions[idx]!;
      const elapsed = Date.now() - Date.parse(p.served[idx]!);
      current = { index: idx, ...q, remainingMs: Math.max(0, rules.total_seconds * 1000 - elapsed) };
    }
    view.trivia = {
      key: "trivia",
      title: tr.title,
      enabled: true,
      rules,
      total: set.questions.length,
      answered,
      current,
      finished,
      score: answered.filter((a) => a.pick === a.correct).length,
      popAwarded: play?.pop_awarded ?? 0,
    };
  }

  const pt = games["poptiles"];
  if (pt?.enabled) {
    const play = await readPlay(userId, "poptiles", date);
    const set = await eng.tilesSet(date);
    const attempts = (Array.isArray((play?.answers as { attempts?: unknown })?.attempts)
      ? (play!.answers as { attempts: { words: string[]; correct: boolean; name?: string }[] }).attempts
      : []) as { words: string[]; correct: boolean; name?: string }[];
    const finished = !!play?.finished;
    const state: PoptilesState = {
      key: "poptiles",
      title: pt.title,
      enabled: true,
      pop: Math.min(pt.pop_reward, pt.daily_cap_pop),
      tiles: set.tiles,
      attempts,
      missesLeft: Math.max(0, eng.TILES_MAX_MISSES - attempts.filter((a) => !a.correct).length),
      finished,
      solved: !!play?.solved,
      popAwarded: play?.pop_awarded ?? 0,
      groups: finished ? set.groups : null,
    };
    view.poptiles = state;
  }

  const pc = games["popcross"];
  if (pc?.enabled) {
    const play = await readPlay(userId, "popcross", date);
    const set = await eng.crosswordSet(date);
    const answers = (play?.answers ?? {}) as { entries?: Record<string, string>; wrong?: number };
    const finished = !!play?.finished;
    const state: CrosswordState = {
      key: "popcross",
      title: pc.title,
      enabled: true,
      pop: Math.min(pc.pop_reward, pc.daily_cap_pop),
      size: set.grid.length,
      entries: set.entries,
      values: answers.entries ?? {},
      missesLeft: Math.max(0, eng.CROSSWORD_MAX_MISSES - (answers.wrong ?? 0)),
      finished,
      solved: !!play?.solved,
      popAwarded: play?.pop_awarded ?? 0,
      grid: finished ? set.grid : null,
    };
    view.popcross = state;
  }

  const wh = games["wordhive"];
  if (wh?.enabled) {
    const play = await readPlay(userId, "wordhive", date);
    const set = await eng.hiveSet(date);
    const answers = (play?.answers ?? {}) as { found?: string[] };
    const finished = !!play?.finished;
    const state: HiveState = {
      key: "wordhive",
      title: wh.title,
      enabled: true,
      pop: Math.min(wh.pop_reward, wh.daily_cap_pop),
      letters: set.letters,
      center: set.center,
      targetCount: set.targets.length,
      found: answers.found ?? [],
      finished,
      solved: !!play?.solved,
      popAwarded: play?.pop_awarded ?? 0,
      targets: finished ? set.targets : null,
      missed: null,
    };
    if (finished) {
      const { hiveWordsFor } = await import("./arcade-hive-words.server");
      const have = new Set([...(answers.found ?? []), ...set.targets]);
      state.missed = hiveWordsFor(set.letters, set.center).filter((w) => !have.has(w)).slice(0, 60);
    }
    view.wordhive = state;
  }
  const pn = games["popnumbers"];
  if (pn?.enabled) {
    const play = await readPlay(userId, "popnumbers", date);
    const set = await eng.numbersSet(date);
    const answers = (play?.answers ?? {}) as { steps?: unknown[]; result?: number };
    const finished = !!play?.finished;
    const state: NumbersState = {
      key: "popnumbers",
      title: pn.title,
      enabled: true,
      pop: Math.min(pn.pop_reward, pn.daily_cap_pop),
      target: set.target,
      tiles: set.tiles,
      finished,
      solved: !!play?.solved,
      result: typeof answers.result === "number" ? answers.result : null,
      moves: Array.isArray(answers.steps) ? answers.steps.length : 0,
      popAwarded: play?.pop_awarded ?? 0,
      solution: finished ? set.solution : null,
    };
    view.popnumbers = state;
  }
  return view;
}

const OFF: ArcadeView = {
  enabled: false,
  date: "",
  popword: null,
  trivia: null,
  poptiles: null,
  popcross: null,
  wordhive: null,
  popnumbers: null,
};

/** Today's games and where the member stands. Answers stay hidden until done. */
export const getArcade = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tz: tzField, player: playerField }).parse(d ?? {}))
  .handler(async ({ data }): Promise<ArcadeView> => {
    try {
      await guard(data.player);
    } catch {
      return OFF;
    }
    return buildView(data.player, data.tz);
  });

/** One POPword guess. The server marks it and pays on the solving guess. */
export const guessPopword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ guess: z.string().trim().regex(/^[A-Za-z]{5}$/), tz: tzField, player: playerField }).parse(d),
  )
  .handler(async ({ data }): Promise<ArcadeView> => {
    await guard(data.player);
    const email = "";
    
    const eng = await import("./arcade.server");
    const games = await eng.readGames();
    const game = games["popword"];
    if (!game?.enabled) throw new Error("game_off");
    const date = eng.todayKey(undefined, data.tz);
    const play = await readPlay(data.player, "popword", date);
    if (play?.finished) return buildView(data.player, data.tz);

    const { isRealWord } = await import("./arcade-words.server");
    if (!isRealWord(data.guess)) throw new Error("not_a_word");

    const answer = await eng.popwordAnswer(date);
    const guess = data.guess.toUpperCase();
    const guesses = [
      ...((Array.isArray(play?.answers) ? play!.answers : []) as { word: string; marks: LetterMark[] }[]),
      { word: guess, marks: eng.markGuess(guess, answer) },
    ];
    const solved = guess === answer;
    const finished = solved || guesses.length >= eng.POPWORD_MAX_GUESSES;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("game_plays").upsert(
      {
        user_id: data.player,
        email,
        game_key: "popword",
        puzzle_date: date,
        answers: guesses,
        score: solved ? eng.POPWORD_MAX_GUESSES + 1 - guesses.length : 0,
        finished,
        solved,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,game_key,puzzle_date" },
    );
    if (solved) {
      const paid = await eng.payGame({ email, userId: data.player, game, date, amount: game.pop_reward });
      await supabaseAdmin
        .from("game_plays")
        .update({ pop_awarded: paid })
        .eq("user_id", data.player)
        .eq("game_key", "popword")
        .eq("puzzle_date", date);
    }
    return buildView(data.player, data.tz);
  });

async function triviaContext(userId: string, tz?: string) {
  await guard(userId);
  const eng = await import("./arcade.server");
  const tv = await import("./arcade-trivia.server");
  const games = await eng.readGames();
  const game = games["trivia"];
  if (!game?.enabled) throw new Error("game_off");
  const date = eng.todayKey(undefined, tz);
  const rules = tv.readRules(game.settings);
  const set = await tv.triviaDaySet(date, rules.questions);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("game_plays")
    .select("answers, finished, updated_at")
    .eq("user_id", userId)
    .eq("game_key", "trivia")
    .eq("puzzle_date", date)
    .maybeSingle();
  return { eng, tv, game, date, rules, set, supabaseAdmin, row, play: tv.parseTriviaPlay(row?.answers) };
}

/** Show the next trivia question. The server clock starts now. */
export const triviaServe = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tz: tzField, player: playerField }).parse(d))
  .handler(async ({ data }): Promise<ArcadeView> => {
    const email = "";
    
    const c = await triviaContext(data.player, data.tz);
    const idx = c.play.picks.length;
    if (c.row?.finished || idx >= c.set.questions.length || c.play.served[idx]) {
      return buildView(data.player, data.tz);
    }
    const now = new Date().toISOString();
    const next = { ...c.play, served: [...c.play.served.slice(0, idx), now] };
    if (!c.row) {
      await c.supabaseAdmin.from("game_plays").insert({
        user_id: data.player,
        email,
        game_key: "trivia",
        puzzle_date: c.date,
        answers: next,
        updated_at: now,
      });
    } else {
      await c.supabaseAdmin
        .from("game_plays")
        .update({ answers: next, updated_at: now })
        .eq("user_id", data.player)
        .eq("game_key", "trivia")
        .eq("puzzle_date", c.date)
        .eq("updated_at", c.row.updated_at);
    }
    return buildView(data.player, data.tz);
  });

/** Lock in an answer (or -1 when time ran out). Speed is measured on the server. */
export const triviaAnswer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ index: z.number().int().min(0).max(20), pick: z.number().int().min(-1).max(9), tz: tzField, player: playerField }).parse(d),
  )
  .handler(async ({ data }): Promise<ArcadeView> => {
    const email = "";
    
    const c = await triviaContext(data.player, data.tz);
    const idx = c.play.picks.length;
    if (!c.row || c.row.finished || data.index !== idx || !c.play.served[idx]) {
      return buildView(data.player, data.tz);
    }
    const elapsed = Math.max(0, Date.now() - Date.parse(c.play.served[idx]!));
    const late = elapsed > c.rules.total_seconds * 1000 + c.tv.TRIVIA_LAG_MS;
    const q = c.set.questions[idx]!;
    const pick = late || data.pick >= q.options.length ? -1 : data.pick;
    const correct = pick === c.set.answers[idx];
    const pop = c.tv.scoreAnswer(c.rules, correct, elapsed);
    const next = {
      ...c.play,
      picks: [...c.play.picks, pick],
      ms: [...c.play.ms.slice(0, idx), Math.min(elapsed, c.rules.total_seconds * 1000)],
      pops: [...c.play.pops.slice(0, idx), pop],
    };
    const done = next.picks.length >= c.set.questions.length;
    const score = next.picks.filter((p, i) => p === c.set.answers[i]).length;
    const perfect = done && score === c.set.questions.length;
    const { data: saved } = await c.supabaseAdmin
      .from("game_plays")
      .update({ answers: next, score, finished: done, solved: perfect, updated_at: new Date().toISOString() })
      .eq("user_id", data.player)
      .eq("game_key", "trivia")
      .eq("puzzle_date", c.date)
      .eq("updated_at", c.row.updated_at)
      .select("id");
    if (!saved?.length) return buildView(data.player, data.tz); // double tap / race
    if (done) {
      const amount = next.pops.reduce((n, p) => n + p, 0) + (perfect ? c.rules.perfect_bonus : 0);
      const paid = await c.eng.payGame({ email, userId: data.player, game: c.game, date: c.date, amount });
      await c.supabaseAdmin
        .from("game_plays")
        .update({ pop_awarded: paid })
        .eq("user_id", data.player)
        .eq("game_key", "trivia")
        .eq("puzzle_date", c.date);
    }
    return buildView(data.player, data.tz);
  });

function sanitizeCrosswordEntries(
  input: Record<string, unknown>,
  entries: CrosswordEntry[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of entries) {
    const raw = input[e.id];
    if (typeof raw !== "string") continue;
    const v = raw.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, e.len);
    if (v) out[e.id] = v;
  }
  return out;
}

/** Submit one group of four POP Tiles words. Four wrong tries end the game. */
export const submitTiles = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ words: z.array(z.string().trim().regex(/^[A-Za-z]{2,14}$/)).length(4), tz: tzField, player: playerField }).parse(d),
  )
  .handler(async ({ data }): Promise<ArcadeView> => {
    await guard(data.player);
    const email = "";
    
    const eng = await import("./arcade.server");
    const games = await eng.readGames();
    const game = games["poptiles"];
    if (!game?.enabled) throw new Error("game_off");
    const date = eng.todayKey(undefined, data.tz);
    const play = await readPlay(data.player, "poptiles", date);
    if (play?.finished) return buildView(data.player, data.tz);

    const words = data.words.map((w) => w.toUpperCase());
    if (new Set(words).size !== 4) throw new Error("duplicate_words");
    const set = await eng.tilesSet(date);
    const allTiles = new Set(set.tiles);
    if (!words.every((w) => allTiles.has(w))) throw new Error("unknown_word");

    const attempts = (Array.isArray((play?.answers as { attempts?: unknown })?.attempts)
      ? (play!.answers as { attempts: { words: string[]; correct: boolean; name?: string }[] })
          .attempts
      : []) as { words: string[]; correct: boolean; name?: string }[];
    const key = [...words].sort().join(",");
    if (attempts.some((a) => [...a.words].sort().join(",") === key)) {
      return buildView(data.player, data.tz); // same guess already tried
    }

    const level = set.groups.findIndex((g) => [...g.words].sort().join(",") === key);
    const match = level >= 0 ? set.groups[level]! : null;
    attempts.push({ words, correct: match != null, ...(match ? { name: match.name, level } : {}) });
    const correctCount = attempts.filter((a) => a.correct).length;
    const wrongCount = attempts.length - correctCount;
    const solved = correctCount === set.groups.length;
    const finished = solved || wrongCount >= eng.TILES_MAX_MISSES;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("game_plays").upsert(
      {
        user_id: data.player,
        email,
        game_key: "poptiles",
        puzzle_date: date,
        answers: { attempts },
        score: correctCount,
        finished,
        solved,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,game_key,puzzle_date" },
    );
    if (finished && solved) {
      const paid = await eng.payGame({ email, userId: data.player, game, date, amount: game.pop_reward });
      await supabaseAdmin
        .from("game_plays")
        .update({ pop_awarded: paid })
        .eq("user_id", data.player)
        .eq("game_key", "poptiles")
        .eq("puzzle_date", date);
    }
    return buildView(data.player, data.tz);
  });

/** Save crossword entries as the member types. Never finishes the game. */
export const saveCrossword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ entries: z.record(z.string(), z.string()), tz: tzField, player: playerField }).parse(d))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    await guard(data.player);
    const email = "";
    if (!email) return { ok: false };
    const eng = await import("./arcade.server");
    const games = await eng.readGames();
    const game = games["popcross"];
    if (!game?.enabled) return { ok: false };
    const date = eng.todayKey(undefined, data.tz);
    const play = await readPlay(data.player, "popcross", date);
    if (play?.finished) return { ok: true };

    const set = await eng.crosswordSet(date);
    const values = sanitizeCrosswordEntries(data.entries, set.entries);
    const existing = (play?.answers ?? {}) as { entries?: Record<string, string>; wrong?: number };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("game_plays").upsert(
      {
        user_id: data.player,
        email,
        game_key: "popcross",
        puzzle_date: date,
        answers: { entries: values, wrong: existing.wrong ?? 0 },
        score: 0,
        finished: false,
        solved: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,game_key,puzzle_date" },
    );
    return { ok: true };
  });

/** Check the completed crossword grid. Two wrong checks end the game. */
export const submitCrossword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ entries: z.record(z.string(), z.string()), tz: tzField, player: playerField }).parse(d))
  .handler(async ({ data }): Promise<ArcadeView> => {
    await guard(data.player);
    const email = "";
    
    const eng = await import("./arcade.server");
    const games = await eng.readGames();
    const game = games["popcross"];
    if (!game?.enabled) throw new Error("game_off");
    const date = eng.todayKey(undefined, data.tz);
    const play = await readPlay(data.player, "popcross", date);
    if (play?.finished) return buildView(data.player, data.tz);

    const set = await eng.crosswordSet(date);
    const values = sanitizeCrosswordEntries(data.entries, set.entries);
    const n = set.grid.length;
    const grid: string[][] = Array.from({ length: n }, () => Array(n).fill("#"));
    for (const e of set.entries) {
      const v = values[e.id] ?? "";
      for (let i = 0; i < e.len; i++) {
        const r = e.dir === "across" ? e.row : e.row + i;
        const c = e.dir === "across" ? e.col + i : e.col;
        const ch = v[i];
        if (ch) grid[r]![c] = ch;
      }
    }
    const complete = grid.every((row, r) => row.every((ch, c) => (ch === "#") === (set.grid[r]![c] === "#")));
    if (!complete) throw new Error("incomplete");
    const correct = grid.every((row, i) => row.join("") === set.grid[i]);

    const existing = (play?.answers ?? {}) as { entries?: Record<string, string>; wrong?: number };
    const wrong = correct ? existing.wrong ?? 0 : (existing.wrong ?? 0) + 1;
    const finished = correct || wrong >= eng.CROSSWORD_MAX_MISSES;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("game_plays").upsert(
      {
        user_id: data.player,
        email,
        game_key: "popcross",
        puzzle_date: date,
        answers: { entries: values, wrong },
        score: correct ? 1 : 0,
        finished,
        solved: correct,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,game_key,puzzle_date" },
    );
    if (finished && correct) {
      const paid = await eng.payGame({ email, userId: data.player, game, date, amount: game.pop_reward });
      await supabaseAdmin
        .from("game_plays")
        .update({ pop_awarded: paid })
        .eq("user_id", data.player)
        .eq("game_key", "popcross")
        .eq("puzzle_date", date);
    }
    return buildView(data.player, data.tz);
  });

/** One Word Hive guess. Only curated daily words count. */
export const guessHive = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ word: z.string().trim().regex(/^[A-Za-z]{4,12}$/), tz: tzField, player: playerField }).parse(d),
  )
  .handler(async ({ data }): Promise<ArcadeView> => {
    await guard(data.player);
    const email = "";
    
    const eng = await import("./arcade.server");
    const games = await eng.readGames();
    const game = games["wordhive"];
    if (!game?.enabled) throw new Error("game_off");
    const date = eng.todayKey(undefined, data.tz);
    const play = await readPlay(data.player, "wordhive", date);
    if (play?.finished) return buildView(data.player, data.tz);

    const word = data.word.toUpperCase();
    const set = await eng.hiveSet(date);
    if (!word.includes(set.center)) throw new Error("missing_center");
    const allowed = new Set([...set.letters, set.center]);
    if (![...word].every((ch) => allowed.has(ch))) throw new Error("bad_letter");
    const { isHiveWord } = await import("./arcade-hive-words.server");
    if (!set.targets.includes(word) && !isHiveWord(word)) throw new Error("not_in_hive");

    const found = (Array.isArray((play?.answers as { found?: unknown })?.found)
      ? (play!.answers as { found: string[] }).found
      : []) as string[];
    if (found.includes(word)) return buildView(data.player, data.tz);
    found.push(word);
    const solved = found.length >= set.targets.length;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("game_plays").upsert(
      {
        user_id: data.player,
        email,
        game_key: "wordhive",
        puzzle_date: date,
        answers: { found },
        score: found.length,
        finished: solved,
        solved,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,game_key,puzzle_date" },
    );
    if (solved) {
      const paid = await eng.payGame({ email, userId: data.player, game, date, amount: game.pop_reward });
      await supabaseAdmin
        .from("game_plays")
        .update({ pop_awarded: paid })
        .eq("user_id", data.player)
        .eq("game_key", "wordhive")
        .eq("puzzle_date", date);
    }
    return buildView(data.player, data.tz);
  });

/** Give up on Word Hive: reveals the words, pays nothing. */
export const revealHive = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tz: tzField, player: playerField }).parse(d ?? {}))
  .handler(async ({ data }): Promise<ArcadeView> => {
    await guard(data.player);
    const email = "";
    
    const eng = await import("./arcade.server");
    const games = await eng.readGames();
    const game = games["wordhive"];
    if (!game?.enabled) throw new Error("game_off");
    const date = eng.todayKey(undefined, data.tz);
    const play = await readPlay(data.player, "wordhive", date);
    if (play?.finished) return buildView(data.player, data.tz);

    const existing = (play?.answers ?? {}) as { found?: string[] };
    const found = existing.found ?? [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("game_plays").upsert(
      {
        user_id: data.player,
        email,
        game_key: "wordhive",
        puzzle_date: date,
        answers: { found },
        score: found.length,
        finished: true,
        solved: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,game_key,puzzle_date" },
    );
    return buildView(data.player, data.tz);
  });

/** Submit a POP Numbers round: the server replays every move and scores it. */
export const submitNumbers = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        steps: z
          .array(
            z.object({
              a: z.number().int().min(0).max(10),
              op: z.enum(["+", "-", "x", "/"]),
              b: z.number().int().min(0).max(10),
            }),
          )
          .min(1)
          .max(5),
        pick: z.number().int().min(0).max(10),
        tz: tzField, player: playerField,
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<ArcadeView> => {
    await guard(data.player);
    const email = "";
    
    const eng = await import("./arcade.server");
    const { applyNumbersStep } = await import("./arcade");
    const games = await eng.readGames();
    const game = games["popnumbers"];
    if (!game?.enabled) throw new Error("game_off");
    const date = eng.todayKey(undefined, data.tz);
    const play = await readPlay(data.player, "popnumbers", date);
    if (play?.finished) return buildView(data.player, data.tz);

    const set = await eng.numbersSet(date);
    let pool: number[] | null = [...set.tiles];
    for (const st of data.steps as NumbersStep[]) {
      pool = applyNumbersStep(pool, st);
      if (!pool) throw new Error("bad_move");
    }
    if (data.pick >= pool.length) throw new Error("bad_move");
    const result = pool[data.pick]!;
    const off = Math.abs(result - set.target);
    const solved = off === 0;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("game_plays").upsert(
      {
        user_id: data.player,
        email,
        game_key: "popnumbers",
        puzzle_date: date,
        answers: { steps: data.steps, result },
        score: Math.max(0, 11 - off),
        finished: true,
        solved,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,game_key,puzzle_date" },
    );
    const amount = eng.numbersPop(game.pop_reward, off);
    if (amount > 0) {
      const paid = await eng.payGame({ email, userId: data.player, game, date, amount });
      await supabaseAdmin
        .from("game_plays")
        .update({ pop_awarded: paid })
        .eq("user_id", data.player)
        .eq("game_key", "popnumbers")
        .eq("puzzle_date", date);
    }
    return buildView(data.player, data.tz);
  });
