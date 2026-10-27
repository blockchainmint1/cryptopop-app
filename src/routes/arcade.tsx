import coinIcon from "@/assets/cryptopop-coin.png";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePlayerFn as useServerFn } from "@/lib/arcade-player";
import { toast } from "sonner";
import { ArrowLeft, Brain, Clapperboard, FlaskConical, Globe2, Landmark, Palette, Timer, X, Zap, Calculator, Check, ChevronRight, Delete, Flame, Gamepad2, Grid3x3, Loader2, Play, Puzzle, Share2, Sparkles, Trophy, Type } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getArcadeBoard, type ArcadeBoard } from "@/lib/arcade-board.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getArcade, guessPopword, guessHive, revealHive, saveCrossword, submitCrossword, submitNumbers, submitTiles, triviaServe, triviaAnswer } from "@/lib/arcade.functions";
import {
  popwordShareGrid,
  triviaShareGrid,
  triviaCategoryLabel,
  poptilesShareText,
  hiveShareText,
  numbersShareText,
  applyNumbersStep,
  type NumbersOp,
  type NumbersState,
  type NumbersStep,
  type ArcadeView,
  type CrosswordEntry,
  type CrosswordState,
  type HiveState,
  type LetterMark,
  type PopwordState,
  type PoptilesState,
  type TriviaState,
} from "@/lib/arcade";

export const Route = createFileRoute("/arcade")({
  validateSearch: (search: Record<string, unknown>) => ({
    game: isArcadeGameKey(search.game) ? search.game : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Arcade — Play Daily Games & Just for Fun | CryptoPOP" },
      {
        name: "description",
        content: "Play POPword, Trivia, Tiles, Crossword, Word Hive and POP Numbers every day. Free, just for fun.",
      },
      { property: "og:title", content: "CryptoPOP Arcade — Daily Games" },
      {
        property: "og:description",
        content: "A new POPword and trivia round every day. Solve it, share your score.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ArcadePage,
});

const KEY = ["arcade"];

const ARCADE_GAME_KEYS = ["popword", "trivia", "poptiles", "popcross", "wordhive", "popnumbers"] as const;
type ArcadeGameKey = (typeof ARCADE_GAME_KEYS)[number];

function isArcadeGameKey(value: unknown): value is ArcadeGameKey {
  return typeof value === "string" && ARCADE_GAME_KEYS.includes(value as ArcadeGameKey);
}

/** Player's local time zone, so the arcade day resets at their midnight. */
const TZ = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

function ArcadePage() {
  const { game } = Route.useSearch();
  const navigate = useNavigate();
  const fetchArcade = useServerFn(getArcade);
  const { data, isLoading } = useQuery({
    queryKey: KEY,
    queryFn: () => fetchArcade({ data: { tz: TZ() } }),
        retry: false,
  });
  const fetchBoard = useServerFn(getArcadeBoard);
  const boardQ = useQuery({
    queryKey: [...KEY, "board", data?.date],
    queryFn: () => fetchBoard({ data: { tz: TZ() } }),
    enabled: !!data?.enabled,
    retry: false,
  });


  const selectedState = data && game ? data[game] : null;
  if (data?.enabled && game && selectedState) {
    return (
      <div className="min-h-dvh bg-background text-foreground">
        <header
          className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md"
        >
          <Button asChild variant="outline" size="icon" className="relative z-40 h-9 w-9 shrink-0 rounded-full">
            <Link to="/arcade" search={{ game: undefined }} replace aria-label="Back to Arcade">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Today's game</p>
            <h1 className="truncate font-display text-xl uppercase text-neon-lime">{selectedState.title}</h1>
          </div>
        </header>
        <main className="mx-auto w-full max-w-xl px-3 py-4 sm:px-5">
          <FocusedGame game={game} data={data} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-md">
        <Link
          to="/leaderboard"
          aria-label="Back to pts"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="font-display text-2xl uppercase tracking-wide">
          pts <span className="text-neon-lime">Arcade</span>
        </h1>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 py-5">
        <p className="text-xs text-muted-foreground">
          {"New games every day. Just for fun — play each one once a day and climb the weekly board."}
        </p>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3" aria-busy="true" aria-label="Loading games">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}</div>
        ) : !data?.enabled ? (
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">The Arcade isn't open right now. Check back soon.</p>
          </Card>
        ) : (
          <>
            <StreakStrip board={boardQ.data} />
            <GameSelect data={data} onSelect={(selected) => navigate({ to: "/arcade", search: { game: selected } })} />
            <WeeklyBoard board={boardQ.data} loading={boardQ.isLoading} />
          </>
        )}

      </main>
    </div>
  );
}

type GameTile = {
  key: ArcadeGameKey;
  title: string;
  description: string;
  reward: string;
  icon: LucideIcon;
  finished: boolean;
  started: boolean;
};

function GameSelect({ data, onSelect }: { data: ArcadeView; onSelect: (game: ArcadeGameKey) => void }) {
  const games: Array<GameTile | null> = [
    data.popword && {
      key: "popword", title: data.popword.title, description: "Crack today's five-letter word.", reward: "Daily",
      icon: Type, finished: data.popword.finished, started: data.popword.guesses.length > 0,
    },
    data.trivia && {
      key: "trivia", title: data.trivia.title, description: `${data.trivia.total} questions, ${data.trivia.rules.total_seconds}s each. Beat the clock.`, reward: `Up to ${data.trivia.rules.fast_pop} pts each`,
      icon: Brain, finished: data.trivia.finished, started: data.trivia.answered.length > 0 || !!data.trivia.current,
    },
    data.poptiles && {
      key: "poptiles", title: data.poptiles.title, description: "Find the four hidden groups.", reward: "Daily",
      icon: Puzzle, finished: data.poptiles.finished, started: data.poptiles.attempts.length > 0,
    },
    data.popcross && {
      key: "popcross", title: data.popcross.title, description: "Fill today's compact crossword.", reward: "Daily",
      icon: Grid3x3, finished: data.popcross.finished, started: Object.values(data.popcross.values).some(Boolean),
    },
    data.wordhive && {
      key: "wordhive", title: data.wordhive.title, description: "Build words around the center letter.", reward: "Daily",
      icon: Sparkles, finished: data.wordhive.finished, started: data.wordhive.found.length > 0,
    },
    data.popnumbers && {
      key: "popnumbers", title: data.popnumbers.title, description: `Combine six tiles to reach ${data.popnumbers.target}.`, reward: "Daily",
      icon: Calculator, finished: data.popnumbers.finished, started: false,
    },
  ];
  const available = games.filter((game): game is GameTile => game !== null);

  return (
    <section aria-labelledby="todays-games">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Choose your challenge</p>
          <h2 id="todays-games" className="font-display text-2xl uppercase">Today's games</h2>
        </div>
        <span className="font-mono text-[10px] uppercase text-neon-lime">
          {available.filter((game) => game.finished).length}/{available.length} done
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {available.map((game) => {
          const Icon = game.icon;
          const action = game.finished ? "Results" : game.started ? "Continue" : "Play";
          return (
            <Card key={game.key} className="group overflow-hidden border-neon-lime/25 p-0 transition hover:border-neon-lime/60">
              <button
                type="button"
                onClick={() => onSelect(game.key)}
                className="flex h-full min-h-48 w-full flex-col p-4 text-left"
                aria-label={`${action} ${game.title}`}
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md border border-neon-lime/40 bg-neon-lime/10 text-neon-lime shadow-[0_0_16px_color-mix(in_oklab,var(--neon-lime)_35%,transparent)]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-neon-lime">{game.reward}</span>
                </div>
                <h3 className="mt-4 font-display text-xl uppercase leading-none">{game.title}</h3>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">{game.description}</p>
                <span className={`mt-4 flex w-full items-center justify-between border-t pt-3 font-display text-sm uppercase ${game.finished ? "border-neon-lime/40 text-neon-lime" : "border-border text-primary"}`}>
                  <span className="flex items-center gap-1.5">
                    {game.finished ? <Check className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {action}
                  </span>
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function FocusedGame({ game, data }: { game: ArcadeGameKey; data: ArcadeView }) {
  if (game === "popword" && data.popword) return <Popword state={data.popword} />;
  if (game === "trivia" && data.trivia) return <Trivia state={data.trivia} />;
  if (game === "poptiles" && data.poptiles) return <Poptiles state={data.poptiles} />;
  if (game === "popcross" && data.popcross) return <Popcross state={data.popcross} />;
  if (game === "wordhive" && data.wordhive) return <Hive state={data.wordhive} />;
  if (game === "popnumbers" && data.popnumbers) return <Numbers state={data.popnumbers} />;
  return null;
}

function StreakStrip({ board }: { board?: ArcadeBoard }) {
  if (!board?.enabled) return null;
  const { streak, best, playedToday } = board.me;
  return (
    <Card className="flex items-center gap-3 p-4">
      <Flame className="h-7 w-7 shrink-0 text-neon-lime" />
      <div className="min-w-0 flex-1">
        <p className="font-display text-xl uppercase leading-none">
          {streak} day <span className="text-neon-lime">streak</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {playedToday
            ? "Played today — come back tomorrow to keep it going."
            : streak > 0
              ? "Finish a game today to keep your streak alive."
              : "Finish any game today to start a streak."}
        </p>
      </div>
      <div className="text-right">
        <p className="font-display text-lg leading-none">{best}</p>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Best</p>
      </div>
    </Card>
  );
}

function WeeklyBoard({ board, loading }: { board?: ArcadeBoard; loading: boolean }) {
  if (loading) return <Spinner inline />;
  if (!board?.enabled) return null;
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 font-display text-lg uppercase">
          <Trophy className="h-5 w-5 text-neon-lime" /> This week's board
        </h2>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Solves</span>
      </div>
      {board.me.rank ? (
        <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
          You're <span className="font-bold text-neon-lime">#{board.me.rank}</span> with {board.me.solves}{" "}
          {board.me.solves === 1 ? "solve" : "solves"} this week.
        </p>
      ) : null}
      {board.leaders.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          No games finished this week yet. Be the first on the board.
        </p>
      ) : (
        <ol className="divide-y divide-border">
          {board.leaders.map((r, i) => {
            const rank = r.me && board.me.rank ? board.me.rank : i + 1;
            return (
              <li
                key={`${r.display}-${i}`}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm ${r.me ? "bg-neon-lime/10" : ""}`}
              >
                <span className="w-7 shrink-0 font-display text-base text-muted-foreground">
                  {rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank}
                </span>
                <span className="min-w-0 flex-1 truncate">{r.me ? "You" : r.display}</span>
                <span className="font-display text-base text-neon-lime">{r.solves}</span>
              </li>
            );
          })}
        </ol>
      )}
      <p className="px-4 py-2 text-[10px] text-muted-foreground">
        Standings only — resets every Monday. No prizes for rank.
      </p>
    </Card>
  );
}

function Spinner({ inline }: { inline?: boolean }) {
  return (
    <div className={inline ? "flex justify-center py-10" : "flex min-h-screen items-center justify-center"}>
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function useShare() {
  const qc = useQueryClient();
  return async (grid: string) => {
    const growth = qc.getQueryData<{ referrals?: { link?: string | null } }>(["my-growth"]);
    const link = growth?.referrals?.link ?? `${window.location.origin}/arcade`;
    const text = `${grid}\n\nPlay on CryptoPOP: ${link}`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
    } catch {
      /* fall through */
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Result copied.");
    } catch {
      toast.error("Couldn't copy your result.");
    }
  };
}

const MARK_CLASS: Record<LetterMark, string> = {
  hit: "bg-neon-lime text-background border-neon-lime",
  near: "bg-warn text-background border-warn",
  miss: "bg-muted text-muted-foreground border-border",
};

const MARK_LABEL: Record<LetterMark, string> = {
  hit: "correct position",
  near: "in the word, wrong position",
  miss: "not in the word",
};

const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

function Popword({ state }: { state: PopwordState }) {
  const qc = useQueryClient();
  const guess = useServerFn(guessPopword);
  const share = useShare();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [reveal, setReveal] = useState<{ row: number; guess: string; marks: LetterMark[] | null } | null>(null);
  const revealTimer = useRef<number | null>(null);
  const pendingRevealView = useRef<ArcadeView | null>(null);
  const revealAnimationFinished = useRef(false);

  useEffect(() => () => {
    if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
  }, []);

  const best: Record<string, LetterMark> = {};
  for (const g of state.guesses) {
    g.word.split("").forEach((c, i) => {
      const m = g.marks[i]!;
      if (best[c] === "hit" || (best[c] === "near" && m === "miss")) return;
      best[c] = m;
    });
  }

  async function submit() {
    if (draft.length !== 5 || busy) return;
    const word = draft;
    setBusy(true);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let done = false;

    const clearTimer = () => {
      if (revealTimer.current !== null) {
        window.clearTimeout(revealTimer.current);
        revealTimer.current = null;
      }
    };
    const finish = (view: ArcadeView | null = pendingRevealView.current) => {
      if (done || !view) return;
      done = true;
      clearTimer();
      const p = view.popword;
      qc.setQueryData<ArcadeView>(KEY, view);
      setDraft("");
      setReveal(null);
      setBusy(false);
      if (p?.solved) toast.success(p.popAwarded > 0 ? `Solved — +${p.popAwarded} pts` : "Solved!");
    };
    const fail = (message: string, invalid: boolean) => {
      if (done) return;
      done = true;
      clearTimer();
      setReveal(null);
      setBusy(false);
      if (message) toast.error(message);
      if (invalid) {
        setDraft("");
        setShake(true);
        window.setTimeout(() => setShake(false), 450);
      }
    };

    pendingRevealView.current = null;
    revealAnimationFinished.current = reduced;
    if (!reduced) {
      // Start the visual turn and server check together. The accepted row is only
      // committed after both the check and the final tile animation complete.
      setReveal({ row: state.guesses.length, guess: word, marks: null });
      revealTimer.current = window.setTimeout(() => {
        revealAnimationFinished.current = true;
        finish();
      }, 4120);
    }

    try {
      const v = await guess({ data: { guess: word, tz: TZ() } });
      if (done) return;
      pendingRevealView.current = v;
      if (reduced) {
        finish(v);
        return;
      }
      const submittedGuess = v.popword?.guesses[state.guesses.length];
      if (!v.popword || !submittedGuess) {
        finish(v);
        return;
      }
      setReveal((r) => (r && r.marks === null ? { ...r, marks: submittedGuess.marks } : r));
      if (revealAnimationFinished.current) finish(v);
    } catch (e) {
      if (String((e as Error)?.message ?? "").includes("not_a_word")) {
        fail("Not a word — try another.", true);
      } else {
        fail("Couldn't check that guess. Try again.", false);
      }
    }
  }

  function press(k: string) {
    if (state.finished || busy) return;
    if (k === "ENTER") return void submit();
    if (k === "DEL") return setDraft((d) => d.slice(0, -1));
    setDraft((d) => (d.length < 5 ? d + k : d));
  }

  const draftRow = state.finished ? -1 : state.guesses.length;

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg uppercase">
          <Type className="h-5 w-5 text-neon-lime" /> {state.title}
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-widest text-neon-lime">Daily</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Guess the 5-letter word in {state.maxGuesses} tries.</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground" aria-label="Letter colors">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-neon-lime" aria-hidden="true" />Right spot</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-warn" aria-hidden="true" />Wrong spot</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-muted" aria-hidden="true" />Not in word</span>
      </div>

      <div className={`mx-auto mt-4 grid w-fit gap-1.5${shake ? " popword-shake" : ""}`}>
        {Array.from({ length: state.maxGuesses }, (_, r) => {
          if (reveal?.row === r) {
            return (
              <div key={r} className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: 5 }, (_, c) => {
                  const m = reveal.marks?.[c];
                  return (
                    <div
                      key={c}
                      aria-label={m ? `${reveal.guess[c]}, ${MARK_LABEL[m]}` : reveal.guess[c]}
                      className={`popword-flip-tile popword-flip-delay-${c}`}
                    >
                      <div className="popword-flip-inner">
                        <span className="popword-flip-face popword-flip-start border-border bg-card">{reveal.guess[c]}</span>
                        <span className="popword-flip-face popword-flip-logo" aria-hidden="true">
                          <img src={coinIcon} alt="" />
                        </span>
                        <span
                          className={`popword-flip-face popword-flip-result ${m ? MARK_CLASS[m] : "border-border bg-card text-foreground"}`}
                        >
                          {reveal.guess[c]}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          }
          const row = state.guesses[r] ?? null;
          return (
            <div key={r} className="grid grid-cols-5 gap-1.5">
              {Array.from({ length: 5 }, (_, c) => {
                const letter = row ? row.word[c] : r === draftRow ? draft[c] ?? "" : "";
                const cls = row ? MARK_CLASS[row.marks[c]!] : "border-border bg-card";
                return (
                  <div
                    key={c}
                    aria-label={row ? `${letter}, ${MARK_LABEL[row.marks[c]!]}` : letter || "empty"}
                    className={`flex h-11 w-11 items-center justify-center rounded-md border-2 font-display text-2xl uppercase ${cls}`}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {state.finished ? (
        <div className="mt-4 space-y-3 text-center">
          {state.solved ? (
            <div role="status" className="border-y border-neon-lime/50 bg-neon-lime/10 px-3 py-4 text-neon-lime">
              <Trophy className="mx-auto mb-1 h-7 w-7" aria-hidden="true" />
              <p className="font-display text-3xl uppercase">You won!</p>
              <p className="text-sm text-foreground">{state.answer} · {state.guesses.length}/{state.maxGuesses} guesses</p>
            </div>
          ) : (
            <p className="text-sm">Out of tries. The word was <span className="font-display text-lg text-neon-lime">{state.answer}</span>.</p>
          )}
          <p className="text-xs text-muted-foreground">
            {state.popAwarded > 0 ? `+${state.popAwarded} pts credited.` : "Come back tomorrow for a new word."}
          </p>
          <Button size="sm" className="w-full" onClick={() => share(popwordShareGrid(state))}>
            <Share2 className="mr-2 h-4 w-4" /> Share result
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-1.5">
          {ROWS.map((row, i) => (
            <div key={row} className="flex justify-center gap-1">
              {i === 2 && (
                <KeyBtn wide onClick={() => press("ENTER")} disabled={busy || draft.length !== 5}>
                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Enter"}
                </KeyBtn>
              )}
              {row.split("").map((k) => (
                <KeyBtn key={k} mark={best[k]} onClick={() => press(k)} disabled={busy}>
                  {k}
                </KeyBtn>
              ))}
              {i === 2 && (
                <KeyBtn wide onClick={() => press("DEL")} aria-label="Delete" disabled={busy}>
                  <Delete className="h-4 w-4" />
                </KeyBtn>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function KeyBtn({
  children,
  mark,
  wide,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { mark?: LetterMark; wide?: boolean }) {
  return (
    <Button
      type="button"
      variant="outline"
      {...rest}
      className={`h-11 min-w-0 rounded-md p-0 font-mono text-xs transition active:scale-95 ${
        wide ? "px-2.5" : "w-8"
      } ${mark ? MARK_CLASS[mark] : "border-border bg-card text-foreground"}`}
    >
      {children}
    </Button>
  );
}

const TRIVIA_CAT_STYLE: Record<string, { icon: LucideIcon; cls: string }> = {
  places: { icon: Globe2, cls: "border-neon-lime/60 bg-neon-lime/15 text-neon-lime" },
  screen: { icon: Clapperboard, cls: "border-primary/60 bg-primary/15 text-primary" },
  history: { icon: Landmark, cls: "border-warn/60 bg-warn/15 text-warn" },
  arts: { icon: Palette, cls: "border-primary/60 bg-primary/15 text-primary" },
  science: { icon: FlaskConical, cls: "border-neon-lime/60 bg-neon-lime/15 text-neon-lime" },
  sports: { icon: Trophy, cls: "border-warn/60 bg-warn/15 text-warn" },
};
const DIFF_LABEL = ["", "Easy", "Medium", "Hard"];

function CategoryChip({ category, difficulty }: { category: string; difficulty: number }) {
  const st = TRIVIA_CAT_STYLE[category] ?? { icon: Brain, cls: "border-border bg-card text-foreground" };
  const Icon = st.icon;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-display text-xs uppercase tracking-wider ${st.cls}`}>
        <Icon className="h-3.5 w-3.5" /> {triviaCategoryLabel(category)}
      </span>
      <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {[1, 2, 3].map((d) => (
          <span key={d} className={`h-1.5 w-3 rounded-full ${d <= difficulty ? "bg-neon-lime" : "bg-muted"}`} />
        ))}
        <span className="ml-1">{DIFF_LABEL[difficulty] ?? ""}</span>
      </span>
    </div>
  );
}

function Trivia({ state }: { state: TriviaState }) {
  const qc = useQueryClient();
  const serve = useServerFn(triviaServe);
  const answer = useServerFn(triviaAnswer);
  const share = useShare();
  const r = state.rules;
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState<number | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [left, setLeft] = useState(state.current?.remainingMs ?? r.total_seconds * 1000);
  const deadline = useRef(0);
  const sent = useRef(-1);
  const cur = state.current;

  // Start the local clock from the server's remaining time for this question.
  useEffect(() => {
    if (!cur) return;
    deadline.current = performance.now() + cur.remainingMs;
    setLeft(cur.remainingMs);
    setChosen(null);
    const id = window.setInterval(() => {
      const ms = Math.max(0, deadline.current - performance.now());
      setLeft(ms);
      if (ms <= 0) {
        window.clearInterval(id);
        void lockIn(-1);
      }
    }, 100);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.index]);

  async function start() {
    setBusy(true);
    try {
      qc.setQueryData<ArcadeView>(KEY, await serve({ data: { tz: TZ() } }));
      setReveal(null);
    } catch {
      toast.error("Couldn't load the next question. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function lockIn(pick: number) {
    if (!cur || sent.current === cur.index) return;
    sent.current = cur.index;
    setChosen(pick);
    try {
      const view = await answer({ data: { index: cur.index, pick, tz: TZ() } });
      qc.setQueryData<ArcadeView>(KEY, view);
      setReveal(cur.index);
    } catch {
      sent.current = -1;
      toast.error("Couldn't lock that in. Try again.");
    }
  }

  // Auto-advance a few seconds after the answer is revealed.
  useEffect(() => {
    if (reveal === null || state.finished) return;
    const id = window.setTimeout(() => void start(), 4000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal, state.finished]);

  const header = (
    <div className="flex items-baseline justify-between">
      <h2 className="flex items-center gap-2 font-display text-lg uppercase">
        <Brain className="h-5 w-5 text-primary" /> Trivia Night
      </h2>
      <span className="font-mono text-[10px] uppercase tracking-widest text-neon-lime">
        {state.answered.filter((a) => a.pick === a.correct).length}/{state.total} · +{state.answered.reduce((n, a) => n + a.pop, 0)} pts
      </span>
    </div>
  );

  const progress = (
    <div className="mt-3 flex gap-1.5">
      {Array.from({ length: state.total }, (_, i) => {
        const a = state.answered[i];
        const cls = !a
          ? i === cur?.index
            ? "bg-primary animate-pulse"
            : "bg-muted"
          : a.pick === a.correct
            ? "bg-neon-lime"
            : "bg-destructive";
        return <span key={i} className={`h-1.5 flex-1 rounded-full ${cls}`} />;
      })}
    </div>
  );

  // ---- Reveal card (right after an answer) ----
  const shown = reveal !== null ? state.answered[reveal] : null;
  if (shown) {
    const right = shown.pick === shown.correct;
    const last = reveal === state.total - 1;
    return (
      <Card className="overflow-hidden p-5">
        {header}
        {progress}
        <div key={`r${reveal}`} className="trivia-swipe-in mt-4 space-y-4">
          <CategoryChip category={shown.category} difficulty={shown.difficulty} />
          <p className="font-display text-xl leading-snug">{shown.q}</p>
          <div className="space-y-2">
            {shown.options.map((opt, o) => {
              const isAns = o === shown.correct;
              const isPick = o === shown.pick;
              const cls = isAns
                ? "border-neon-lime bg-neon-lime text-background"
                : isPick
                  ? "border-destructive bg-destructive/15 text-muted-foreground line-through"
                  : "border-border bg-card text-muted-foreground line-through opacity-60";
              return (
                <div key={o} className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 text-sm font-semibold ${cls}`}>
                  <span>
                    <span className="mr-2 font-mono">{"ABCD"[o]}</span>
                    {opt}
                  </span>
                  {isAns ? <Check className="h-5 w-5" /> : isPick ? <X className="h-5 w-5 text-destructive" /> : null}
                </div>
              );
            })}
          </div>
          <div className={`rounded-xl border-2 p-4 text-center ${right ? "border-neon-lime bg-neon-lime/10" : "border-destructive bg-destructive/10"}`}>
            <p className={`font-display text-3xl uppercase ${right ? "text-neon-lime" : "text-destructive"}`}>
              {right ? "Correct!" : shown.pick < 0 ? "Time's up" : "Incorrect"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {right
                ? `${shown.seconds}s — +${shown.pop} POP${shown.pop >= r.fast_pop ? " speed bonus" : ""}`
                : `The answer was ${shown.options[shown.correct]}.`}
            </p>
          </div>
          <Button className="w-full" onClick={() => (last ? setReveal(null) : void start())} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {last ? "See results" : "Next question"} <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </Card>
    );
  }

  // ---- Final scoreboard ----
  if (state.finished) {
    return (
      <Card className="p-5">
        {header}
        {progress}
        <div className="trivia-swipe-in mt-5 space-y-4 text-center">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Final score</p>
          <p className="font-display text-6xl">
            {state.score}
            <span className="text-muted-foreground">/{state.total}</span>
          </p>
          <p className="font-display text-xl uppercase text-neon-lime">
            {state.popAwarded > 0 ? `+${state.popAwarded} pts` : "Better luck tomorrow"}
          </p>
          <ul className="space-y-1.5 text-left">
            {state.answered.map((a, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs">
                {a.pick === a.correct ? (
                  <Check className="h-4 w-4 shrink-0 text-neon-lime" />
                ) : (
                  <X className="h-4 w-4 shrink-0 text-destructive" />
                )}
                <span className="min-w-0 flex-1 truncate">{a.q}</span>
                <span className="font-mono text-neon-lime">+{a.pop}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">New questions at midnight.</p>
          <Button size="sm" className="w-full" onClick={() => share(triviaShareGrid(state))}>
            <Share2 className="mr-2 h-4 w-4" /> Share result
          </Button>
        </div>
      </Card>
    );
  }

  // ---- Live question ----
  if (cur) {
    const secs = Math.ceil(left / 1000);
    const elapsed = r.total_seconds - left / 1000;
    const fast = elapsed <= r.fast_seconds;
    const pct = (left / (r.total_seconds * 1000)) * 100;
    const markPct = ((r.total_seconds - r.fast_seconds) / r.total_seconds) * 100;
    return (
      <Card className="overflow-hidden p-5">
        {header}
        {progress}
        <div key={`q${cur.index}`} className="trivia-swipe-in mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Question {cur.index + 1} of {state.total}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-display text-sm uppercase ${
                fast ? "border-neon-lime text-neon-lime" : "border-primary text-primary"
              }`}
            >
              {fast ? <Zap className="h-3.5 w-3.5" /> : null}+{fast ? r.fast_pop : r.slow_pop} pts
            </span>
          </div>
          <CategoryChip category={cur.category} difficulty={cur.difficulty} />
          <div>
            <div className="flex items-end justify-between">
              <Timer className={`h-5 w-5 ${secs <= 5 ? "text-destructive" : "text-muted-foreground"}`} />
              <span className={`font-display text-4xl tabular-nums ${secs <= 5 ? "animate-pulse text-destructive" : fast ? "text-neon-lime" : "text-primary"}`}>
                {secs}
              </span>
            </div>
            <div className="relative mt-1 h-3 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
                  secs <= 5 ? "bg-destructive" : fast ? "bg-neon-lime" : "bg-primary"
                }`}
                style={{ width: `${pct}%` }}
              />
              <span className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${markPct}%` }} />
            </div>
            <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              Answer in {r.fast_seconds}s for +{r.fast_pop} · after that +{r.slow_pop}
            </p>
          </div>
          <p className="font-display text-xl leading-snug">{cur.q}</p>
          <div className="space-y-2">
            {cur.options.map((opt, o) => (
              <button
                key={o}
                type="button"
                disabled={chosen !== null}
                onClick={() => void lockIn(o)}
                className={`w-full rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold transition active:scale-[0.98] ${
                  chosen === o ? "border-primary bg-primary/20" : "border-border bg-card hover:border-neon-lime"
                }`}
              >
                <span className="mr-2 font-mono text-neon-lime">{"ABCD"[o]}</span>
                {opt}
              </button>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  // ---- Ready screen (before the first question, or between questions) ----
  const fresh = state.answered.length === 0;
  return (
    <Card className="p-5">
      {header}
      {progress}
      <div className="trivia-swipe-in mt-5 space-y-4 text-center">
        <p className="font-display text-3xl uppercase">
          {fresh ? "Tonight's round" : `Question ${state.answered.length + 1} is up`}
        </p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-border bg-card p-2">
            <p className="font-display text-2xl">{state.total}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Questions</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-2">
            <p className="font-display text-2xl">{r.total_seconds}s</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Each</p>
          </div>
          <div className="rounded-lg border border-neon-lime/50 bg-neon-lime/10 p-2">
            <p className="font-display text-2xl text-neon-lime">+{r.fast_pop}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Under {r.fast_seconds}s</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          One question at a time, the clock starts when it appears. Correct after {r.fast_seconds}s earns +{r.slow_pop}.
          {r.perfect_bonus > 0 ? ` Perfect round: +${r.perfect_bonus} bonus.` : ""}
        </p>
        <Button className="w-full" size="lg" disabled={busy} onClick={() => void start()}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          {fresh ? "Start round" : "Next question"}
        </Button>
      </div>
    </Card>
  );
}

const TILE_LEVELS = [
  { label: "Easy", cls: "border-neon-lime/50 bg-neon-lime/10", text: "text-neon-lime" },
  { label: "Medium", cls: "border-warn/50 bg-warn/10", text: "text-warn" },
  { label: "Hard", cls: "border-primary/50 bg-primary/10", text: "text-primary" },
  { label: "Harder", cls: "border-foreground/40 bg-foreground/10", text: "text-foreground" },
];

function Poptiles({ state }: { state: PoptilesState }) {
  const qc = useQueryClient();
  const guess = useServerFn(submitTiles);
  const share = useShare();
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  const foundWords = new Set(state.attempts.filter((a) => a.correct).flatMap((a) => a.words));
  const remaining = state.tiles.filter((w) => !foundWords.has(w));
  const missesUsed = 4 - state.missesLeft;

  async function send() {
    if (picked.length !== 4 || busy) return;
    setBusy(true);
    try {
      const view = await guess({ data: { words: picked, tz: TZ() } });
      qc.setQueryData<ArcadeView>(KEY, view);
      setPicked([]);
      const p = view.poptiles;
      const last = p?.attempts[p.attempts.length - 1];
      if (p?.solved) {
        toast.success(p.popAwarded > 0 ? `Solved — +${p.popAwarded} pts` : "Solved!");
      } else if (last && !last.correct) {
        toast.error(p.missesLeft > 0 ? `Not a group — ${p.missesLeft} tries left.` : "Out of tries.");
        setShake(true);
        window.setTimeout(() => setShake(false), 450);
      } else if (last?.correct) {
        toast.success(last.name ? `Found: ${last.name}` : "Correct group!");
      }
    } catch {
      toast.error("Couldn't check that group. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const toggle = (w: string) =>
    setPicked((p) => (p.includes(w) ? p.filter((x) => x !== w) : p.length < 4 ? [...p, w] : p));

  return (
    <Card className="poptiles-stage overflow-hidden p-5">
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl uppercase">
            <span className="poptiles-icon" aria-hidden="true"><Puzzle className="h-4 w-4" /></span>
            {state.title}
          </h2>
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Daily challenge</p>
        </div>
        <div className="poptiles-scoreboard">
          <span className="font-mono text-[10px] uppercase tracking-widest text-primary">Daily</span>
          <div className="mt-1.5 flex justify-end gap-1.5" aria-label={`${state.missesLeft} tries left`}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`poptiles-life ${i < missesUsed ? "poptiles-life-used" : ""}`} aria-hidden="true" />
            ))}
          </div>
        </div>
      </div>
      <p className="relative z-10 mt-3 text-xs leading-relaxed text-muted-foreground">
        Find four groups of four, from easy to harder. Watch for words that seem to fit more than one group. Four wrong tries end the game.
      </p>

      {state.attempts.filter((a) => a.correct).length > 0 && (
        <div className="mt-3 space-y-1.5">
          {state.attempts
            .filter((a) => a.correct)
            .map((a, i) => {
              const lv = TILE_LEVELS[a.level ?? 0] ?? TILE_LEVELS[0]!;
              return (
              <div key={i} className={`rounded-md border px-3 py-2 ${lv.cls}`}>
                <p className={`font-display text-xs uppercase tracking-wide ${lv.text}`}>{a.name} · {lv.label}</p>
                <p className="text-xs text-foreground">{a.words.join(", ")}</p>
              </div>
              );
            })}
        </div>
      )}

      <p className="relative z-10 mt-3 text-right font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {state.missesLeft} tries left
      </p>

      {state.finished ? (
        <div className="mt-4 space-y-3 text-center">
          {state.solved ? (
            <div role="status" className="border-y border-neon-lime/50 bg-neon-lime/10 px-3 py-4 text-neon-lime">
              <Trophy className="mx-auto mb-1 h-7 w-7" aria-hidden="true" />
              <p className="font-display text-3xl uppercase">You nailed it!</p>
              <p className="text-sm text-foreground">All four groups found.</p>
            </div>
          ) : (
            <p className="text-sm">Out of tries. Here were the groups:</p>
          )}
          <div className="space-y-1.5 text-left">
            {(state.groups ?? []).map((g, i) => (
              <div key={g.name} className={`rounded-md border px-3 py-2 ${TILE_LEVELS[i]?.cls ?? ""}`}>
                <p className={`font-display text-xs uppercase tracking-wide ${TILE_LEVELS[i]?.text ?? ""}`}>{g.name} · {TILE_LEVELS[i]?.label}</p>
                <p className="text-xs text-foreground">{g.words.join(", ")}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {state.popAwarded > 0 ? `+${state.popAwarded} pts credited.` : "Come back tomorrow for new tiles."}
          </p>
          <Button size="sm" className="w-full" onClick={() => share(poptilesShareText(state))}>
            <Share2 className="mr-2 h-4 w-4" /> Share result
          </Button>
        </div>
      ) : (
        <>
          <div className={`poptiles-board mt-3 grid grid-cols-4 gap-1.5${shake ? " popword-shake" : ""}`}>
            {remaining.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => toggle(w)}
                aria-pressed={picked.includes(w)}
                className={`poptiles-tile ${picked.includes(w) ? "poptiles-tile-selected" : ""}`}
              >
                {w}
              </button>
            ))}
          </div>
          <div className="relative z-10 mt-4 grid grid-cols-2 gap-2">
            <Button className="poptiles-guess" size="sm" disabled={picked.length !== 4 || busy} onClick={send}>
              {busy ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
              Guess
            </Button>
            <Button className="poptiles-clear" size="sm" variant="outline" disabled={picked.length === 0 || busy} onClick={() => setPicked([])}>
              Clear
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

function Popcross({ state }: { state: CrosswordState }) {
  const qc = useQueryClient();
  const check = useServerFn(submitCrossword);
  const save = useServerFn(saveCrossword);
  const share = useShare();
  const n = state.size;
  const cellsOf = (e: CrosswordEntry) =>
    Array.from({ length: e.len }, (_, i) =>
      e.dir === "across" ? `${e.row},${e.col + i}` : `${e.row + i},${e.col}`,
    );
  const [cells, setCells] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const e of state.entries) {
      const v = state.values[e.id] ?? "";
      cellsOf(e).forEach((k, i) => {
        if (v[i]) out[k] = v[i]!;
      });
    }
    return out;
  });
  const [sel, setSel] = useState<{ r: number; c: number; dir: "across" | "down" } | null>(() => {
    const e = state.entries.find((x) => x.dir === "across") ?? state.entries[0];
    return e && !state.finished ? { r: e.row, c: e.col, dir: e.dir } : null;
  });
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const refs = useRef<Record<string, HTMLInputElement | null>>({});

  const toEntries = (m: Record<string, string>) => {
    const out: Record<string, string> = {};
    for (const e of state.entries) out[e.id] = cellsOf(e).map((k) => m[k] ?? " ").join("").trimEnd();
    return out;
  };

  useEffect(() => {
    if (state.finished) return;
    const t = window.setTimeout(() => {
      save({ data: { entries: toEntries(cells), tz: TZ() } }).catch(() => {});
    }, 800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, state.finished, save]);

  const numAt = new Map<string, number>();
  const covered = new Set<string>();
  for (const e of state.entries) {
    numAt.set(`${e.row},${e.col}`, e.number);
    cellsOf(e).forEach((k) => covered.add(k));
  }
  const entryAt = (r: number, c: number, dir: "across" | "down") =>
    state.entries.find((e) => e.dir === dir && cellsOf(e).includes(`${r},${c}`)) ?? null;
  const active = sel ? entryAt(sel.r, sel.c, sel.dir) ?? entryAt(sel.r, sel.c, sel.dir === "across" ? "down" : "across") : null;
  const activeCells = new Set(active ? cellsOf(active) : []);
  const solution = state.finished && state.grid ? state.grid : null;
  const complete = [...covered].every((k) => !!cells[k]);
  const across = state.entries.filter((e) => e.dir === "across");
  const down = state.entries.filter((e) => e.dir === "down");

  const focus = (r: number, c: number, dir: "across" | "down") => {
    const d = entryAt(r, c, dir) ? dir : dir === "across" ? "down" : "across";
    setSel({ r, c, dir: d });
  };
  const step = (r: number, c: number, delta: number) => {
    if (!active) return;
    const list = cellsOf(active);
    const i = list.indexOf(`${r},${c}`) + delta;
    const k = list[i];
    if (!k) return;
    const [nr, nc] = k.split(",").map(Number) as [number, number];
    setSel({ r: nr, c: nc, dir: active.dir });
  };
  const press = (key: string) => {
    if (state.finished || !sel) return;
    const k = `${sel.r},${sel.c}`;
    if (key === "DEL") {
      if (cells[k]) setCells((m) => ({ ...m, [k]: "" }));
      else step(sel.r, sel.c, -1);
      return;
    }
    setCells((m) => ({ ...m, [k]: key }));
    step(sel.r, sel.c, 1);
  };
  const pressRef = useRef(press);
  pressRef.current = press;
  useEffect(() => {
    if (state.finished) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const t = ev.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (ev.key === "Backspace") {
        ev.preventDefault();
        pressRef.current("DEL");
      } else if (/^[a-zA-Z]$/.test(ev.key)) {
        pressRef.current(ev.key.toUpperCase());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.finished]);

  async function send() {
    if (busy) return;
    setBusy(true);
    try {
      const view = await check({ data: { entries: toEntries(cells), tz: TZ() } });
      qc.setQueryData<ArcadeView>(KEY, view);
      const c = view.popcross;
      if (c?.solved) {
        toast.success(c.popAwarded > 0 ? `Solved — +${c.popAwarded} pts` : "Solved!");
      } else {
        toast.error(c && c.missesLeft > 0 ? `Not quite — ${c.missesLeft} tries left.` : "Out of tries.");
        setShake(true);
        window.setTimeout(() => setShake(false), 450);
      }
    } catch {
      toast.error("Fill every square first.");
    } finally {
      setBusy(false);
    }
  }

  const clueRow = (e: CrosswordEntry) => (
    <button
      key={e.id}
      type="button"
      disabled={state.finished}
      onClick={() => focus(e.row, e.col, e.dir)}
      className={`block w-full rounded px-2 py-1 text-left text-xs ${
        active?.id === e.id ? "bg-primary/15 text-foreground" : "text-muted-foreground"
      }`}
    >
      <span className="font-display text-foreground">{e.number}.</span> {e.clue}
    </button>
  );

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg uppercase">
          <Grid3x3 className="h-5 w-5 text-neon-lime" /> {state.title}
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-widest text-neon-lime">Daily</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Tap a square and type. Tap it again to switch between across and down. Two wrong checks end the game.
      </p>

      {active && !state.finished && (
        <p className="mt-3 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-foreground">
          <span className="font-display text-primary">
            {active.number} {active.dir === "across" ? "Across" : "Down"}
          </span>{" "}
          {active.clue}
        </p>
      )}

      <div className={`mx-auto mt-3 w-fit rounded-md border-2 border-foreground/70 bg-foreground/70${shake ? " popword-shake" : ""}`}>
        <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${n}, 3rem)` }}>
          {Array.from({ length: n }, (_, r) =>
            Array.from({ length: n }, (_, c) => {
              const k = `${r},${c}`;
              if (!covered.has(k)) {
                return <div key={k} className="h-12 w-12 bg-foreground/80" aria-hidden="true" />;
              }
              const num = numAt.get(k);
              const isSel = sel?.r === r && sel?.c === c;
              const val = solution ? solution[r]![c]! : cells[k] ?? "";
              return (
                <div
                  key={k}
                  className={`relative h-12 w-12 border border-foreground/30 ${
                    isSel ? "bg-neon-lime/40" : activeCells.has(k) ? "bg-primary/20" : "bg-card"
                  }`}
                >
                  {num && (
                    <span className="pointer-events-none absolute left-0.5 top-0 text-[9px] leading-tight text-muted-foreground">
                      {num}
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={state.finished}
                    aria-label={`Row ${r + 1}, column ${c + 1}`}
                    onClick={() => {
                      if (isSel) focus(r, c, sel!.dir === "across" ? "down" : "across");
                      else focus(r, c, sel?.dir ?? "across");
                    }}
                    className="flex h-full w-full cursor-pointer items-center justify-center pt-2 font-display text-2xl uppercase text-foreground outline-none"
                  >
                    {val}
                  </button>

                </div>
              );
            }),
          )}
        </div>
      </div>

      {!state.finished && (
        <div className="mt-3 space-y-1.5">
          {ROWS.map((row, i) => (
            <div key={row} className="flex justify-center gap-1">
              {row.split("").map((k) => (
                <KeyBtn key={k} onClick={() => press(k)} disabled={!sel}>
                  {k}
                </KeyBtn>
              ))}
              {i === 2 && (
                <KeyBtn wide onClick={() => press("DEL")} disabled={!sel} aria-label="Delete">
                  <Delete className="h-4 w-4" />
                </KeyBtn>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1 font-display text-xs uppercase tracking-widest text-neon-lime">Across</p>
          {across.map(clueRow)}
        </div>
        <div>
          <p className="mb-1 font-display text-xs uppercase tracking-widest text-neon-lime">Down</p>
          {down.map(clueRow)}
        </div>
      </div>

      {state.finished ? (
        <div className="mt-4 space-y-3 text-center">
          {state.solved ? (
            <div role="status" className="border-y border-neon-lime/50 bg-neon-lime/10 px-3 py-4 text-neon-lime">
              <Trophy className="mx-auto mb-1 h-7 w-7" aria-hidden="true" />
              <p className="font-display text-3xl uppercase">You won!</p>
              <p className="text-sm text-foreground">Every square correct.</p>
            </div>
          ) : (
            <p className="text-sm">Out of tries. Here's the solution above.</p>
          )}
          <p className="text-xs text-muted-foreground">
            {state.popAwarded > 0 ? `+${state.popAwarded} pts credited.` : "Come back tomorrow for a new grid."}
          </p>
          <Button size="sm" className="w-full" onClick={() => share(`${state.title} — solved the daily grid`)}>
            <Share2 className="mr-2 h-4 w-4" /> Share result
          </Button>
        </div>
      ) : (
        <Button className="mt-4 w-full" disabled={!complete || busy} onClick={send}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Check answers
        </Button>
      )}
    </Card>
  );
}

function Hive({ state }: { state: HiveState }) {
  const qc = useQueryClient();
  const guess = useServerFn(guessHive);
  const reveal = useServerFn(revealHive);
  const share = useShare();
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    if (word.length < 4 || busy) return;
    setBusy(true);
    try {
      const view = await guess({ data: { word, tz: TZ() } });
      qc.setQueryData<ArcadeView>(KEY, view);
      setWord("");
      const h = view.wordhive;
      if (h?.solved) {
        toast.success(h.popAwarded > 0 ? `All words found — +${h.popAwarded} pts` : "All words found!");
      }
    } catch (e) {
      setWord("");
      toast.error(
        e instanceof Error && e.message.includes("missing_center")
          ? `Every word must use the lime letter ${state.center}.`
          : e instanceof Error && e.message.includes("bad_letter")
            ? "Use only the hive's letters."
            : e instanceof Error && e.message.includes("not_in_hive")
              ? "Not in our word list."
              : "Couldn't check that word. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function giveUp() {
    if (busy) return;
    setBusy(true);
    try {
      const view = await reveal({ data: { tz: TZ() } });
      qc.setQueryData<ArcadeView>(KEY, view);
    } catch {
      toast.error("Couldn't reveal the words. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg uppercase">
          <Sparkles className="h-5 w-5 text-primary" /> {state.title}
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-widest text-neon-lime">Daily</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Make words of 4+ letters. Every word must use the lime letter in the middle ({state.center}). Letters can repeat.
        Find {state.targetCount} words to win — {state.found.length}/{state.targetCount} so far.
      </p>

      {(() => {
        const L = state.letters;
        const cell = (l: string, center = false) => (
          <button
            key={l}
            type="button"
            disabled={state.finished}
            onClick={() => setWord((w) => (w + l).slice(0, 12))}
            className={
              center
                ? "flex h-14 w-14 items-center justify-center rounded-full border-2 border-neon-lime bg-neon-lime font-display text-2xl uppercase text-background shadow-[0_0_18px_var(--neon-lime)]"
                : "flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card font-display text-xl uppercase text-foreground active:scale-95"
            }
          >
            {l}
          </button>
        );
        return (
          <div className="mt-4 flex flex-col items-center gap-1.5">
            <div className="flex gap-1.5">{L.slice(0, 2).map((l) => cell(l))}</div>
            <div className="flex items-center gap-1.5">
              {L[2] && cell(L[2])}
              {cell(state.center, true)}
              {L[3] && cell(L[3])}
            </div>
            <div className="flex gap-1.5">{L.slice(4, 6).map((l) => cell(l))}</div>
          </div>
        );
      })()}

      {state.found.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {state.found.map((w) => (
            <span
              key={w}
              className="rounded-full border border-neon-lime/40 bg-neon-lime/10 px-2.5 py-1 font-mono text-[11px] uppercase text-neon-lime"
            >
              {w}
            </span>
          ))}
        </div>
      )}

      {state.finished ? (
        <div className="mt-4 space-y-3 text-center">
          {state.solved ? (
            <div role="status" className="border-y border-neon-lime/50 bg-neon-lime/10 px-3 py-4 text-neon-lime">
              <Trophy className="mx-auto mb-1 h-7 w-7" aria-hidden="true" />
              <p className="font-display text-3xl uppercase">You found them all!</p>
              <p className="text-sm text-foreground">{state.targets?.length ?? state.found.length} words.</p>
            </div>
          ) : (
            <div className="space-y-1.5 text-left">
              <p className="text-sm">The hive's words were:</p>
              <p className="text-xs text-muted-foreground">{(state.targets ?? []).join(", ")}</p>
            </div>
          )}
          {state.missed && state.missed.length > 0 && (
            <div className="space-y-1.5 text-left">
              <p className="font-display text-xs uppercase tracking-widest text-neon-lime">Other words that qualified</p>
              <div className="flex flex-wrap gap-1.5">
                {state.missed.map((w) => (
                  <span key={w} className="rounded-full border border-border px-2.5 py-1 font-mono text-[11px] uppercase text-muted-foreground">
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {state.popAwarded > 0 ? `+${state.popAwarded} pts credited.` : "Come back tomorrow for new letters."}
          </p>
          <Button size="sm" className="w-full" onClick={() => share(hiveShareText(state))}>
            <Share2 className="mr-2 h-4 w-4" /> Share result
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <div className="flex gap-2">
            <input
              value={word}
              onChange={(ev) => setWord(ev.target.value.replace(/[^A-Za-z]/g, "").toUpperCase())}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") send();
              }}
              maxLength={12}
              autoCapitalize="characters"
              autoComplete="off"
              aria-label="Your word"
              placeholder="Type a word…"
              className="w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-sm uppercase tracking-widest outline-none placeholder:tracking-normal focus:border-primary"
            />
            <Button size="sm" variant="outline" disabled={!word || busy} onClick={() => setWord((w) => w.slice(0, -1))}>
              Del
            </Button>
            <Button size="sm" disabled={word.length < 4 || busy} onClick={send}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
            </Button>
          </div>
          <button
            type="button"
            onClick={giveUp}
            className="w-full text-center text-[11px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Give up and reveal the words
          </button>
        </div>
      )}
    </Card>
  );
}

const NUM_OPS: { op: NumbersOp; label: string }[] = [
  { op: "+", label: "+" },
  { op: "-", label: "−" },
  { op: "x", label: "×" },
  { op: "/", label: "÷" },
];

function Numbers({ state }: { state: NumbersState }) {
  const qc = useQueryClient();
  const submit = useServerFn(submitNumbers);
  const share = useShare();
  const [steps, setSteps] = useState<NumbersStep[]>([]);
  const [first, setFirst] = useState<number | null>(null);
  const [op, setOp] = useState<NumbersOp | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Replay moves locally with the same rules the server uses.
  const pools: number[][] = [state.tiles];
  const log: string[] = [];
  for (const s of steps) {
    const prev = pools[pools.length - 1]!;
    const next = applyNumbersStep(prev, s);
    if (!next) break;
    const sym = NUM_OPS.find((o) => o.op === s.op)!.label;
    log.push(`${prev[s.a]} ${sym} ${prev[s.b]} = ${next[next.length - 1]}`);
    pools.push(next);
  }
  const pool = pools[pools.length - 1]!;
  const newest = steps.length ? pool.length - 1 : -1;
  const closest = pool.reduce((best, n, i) => (Math.abs(n - state.target) < Math.abs(pool[best]! - state.target) ? i : best), 0);
  const chosen = pick ?? closest;

  function tapTile(i: number) {
    if (state.finished || busy) return;
    setConfirming(false);
    if (first === null || op === null) {
      setFirst(i === first ? null : i);
      setPick(i);
      return;
    }
    if (i === first) {
      setFirst(null);
      setOp(null);
      return;
    }
    const step = { a: first, op, b: i };
    const next = applyNumbersStep(pool, step);
    setFirst(null);
    setOp(null);
    if (!next) {
      toast.error("That move needs a whole number above zero. Try another.");
      return;
    }
    setSteps([...steps, step]);
    setPick(next.length - 1);
  }

  function undo() {
    setSteps(steps.slice(0, -1));
    setFirst(null);
    setOp(null);
    setPick(null);
    setConfirming(false);
  }

  function reset() {
    setSteps([]);
    setFirst(null);
    setOp(null);
    setPick(null);
    setConfirming(false);
  }

  async function lockIn() {
    if (busy || steps.length === 0) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    try {
      const view = await submit({ data: { steps, pick: chosen, tz: TZ() } });
      qc.setQueryData<ArcadeView>(KEY, view);
      qc.invalidateQueries({ queryKey: [...KEY, "board"] });
      const n = view.popnumbers;
      if (n?.solved) toast.success(n.popAwarded > 0 ? `Bullseye! +${n.popAwarded} pts` : "Bullseye!");
      else if (n && n.popAwarded > 0) toast.success(`Close! +${n.popAwarded} pts`);
    } catch {
      toast.error("Couldn't check your answer. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const off = state.result == null ? null : Math.abs(state.result - state.target);

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg uppercase">
          <Calculator className="h-5 w-5 text-neon-lime" /> {state.title}
        </h2>
        <span className="text-xs text-muted-foreground">Daily</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Combine the tiles to hit the target. Tap a tile, pick + − × ÷, tap another. Each tile once. Within 10 still earns pts.
      </p>

      <div className="mt-4 rounded-xl border border-neon-lime/40 bg-neon-lime/10 py-3 text-center">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Target</p>
        <p className="font-display text-5xl leading-none text-neon-lime drop-shadow-[0_0_12px_var(--neon-lime)]">
          {state.target}
        </p>
      </div>

      {state.finished ? (
        <div className="mt-4 space-y-3">
          <p className="font-display text-xl uppercase">
            {state.solved ? (
              <span className="text-neon-lime">Bullseye — {state.target}!</span>
            ) : (
              <>
                You got {state.result} <span className="text-muted-foreground">· {off} away</span>
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {state.popAwarded > 0 ? `+${state.popAwarded} pts earned.` : "Better luck tomorrow."} New puzzle tomorrow.
          </p>
          {state.solution?.length ? (
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">One way to hit it</p>
              <ul className="mt-1 space-y-0.5 font-mono text-sm">
                {state.solution.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <Button variant="outline" size="sm" className="w-full" onClick={() => share(numbersShareText(state))}>
            <Share2 className="mr-2 h-4 w-4" /> Share result
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {pool.map((n, i) => {
              const sel = first === i;
              const isPick = chosen === i && first === null;
              return (
                <button
                  key={`${steps.length}-${i}`}
                  type="button"
                  onClick={() => tapTile(i)}
                  className={`h-14 rounded-xl border-2 font-display text-2xl transition ${
                    sel
                      ? "border-neon-lime bg-neon-lime text-background"
                      : i === newest
                        ? "border-primary bg-primary/15 shadow-[0_0_14px_var(--primary)]"
                        : "border-primary/50 bg-card shadow-[0_0_10px_color-mix(in_oklab,var(--primary)_35%,transparent)]"
                  } ${isPick ? "ring-2 ring-neon-lime/60" : ""}`}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {NUM_OPS.map((o) => (
              <button
                key={o.op}
                type="button"
                disabled={first === null}
                onClick={() => setOp(o.op)}
                className={`h-11 rounded-lg border font-display text-2xl transition disabled:opacity-40 ${
                  op === o.op ? "border-neon-lime bg-neon-lime text-background" : "border-border bg-card"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {log.length ? (
            <ul className="mt-3 space-y-0.5 font-mono text-sm text-muted-foreground">
              {log.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={undo} disabled={!steps.length || busy}>
              Undo
            </Button>
            <Button variant="outline" size="sm" onClick={reset} disabled={!steps.length || busy}>
              Reset
            </Button>
          </div>
          {confirming ? (
            <div className="mt-2 space-y-2">
              <p className="text-center text-xs text-muted-foreground">
                Lock in <span className="font-display text-neon-lime">{pool[chosen]}</span>
                {pool[chosen] === state.target
                  ? " — that's the target!"
                  : ` — ${Math.abs((pool[chosen] ?? 0) - state.target)} away from ${state.target}`}
                ? This is your one try for today.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setConfirming(false)} disabled={busy}>
                  Keep playing
                </Button>
                <Button className="pop-grad" onClick={lockIn} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Yes, lock in ${pool[chosen]}`}
                </Button>
              </div>
            </div>
          ) : (
            <Button className="mt-2 w-full" onClick={lockIn} disabled={!steps.length || busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Lock in ${pool[chosen]}`}
            </Button>
          )}
          <p className="mt-1 text-center text-[10px] text-muted-foreground">One try per day. Tap a tile to choose which number to lock in.</p>
        </>
      )}
    </Card>
  );
}
