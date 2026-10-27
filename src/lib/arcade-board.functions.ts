// Arcade standings and play streak. Standings only — no prizes are attached to
// rank. Computed on the server from finished plays in game_plays.
import { createServerFn } from "@tanstack/react-start";

export type ArcadeBoardRow = { display: string; solves: number; plays: number; me: boolean };
export type ArcadeBoard = {
  enabled: boolean;
  weekStart: string;
  leaders: ArcadeBoardRow[];
  me: { rank: number | null; solves: number; plays: number; streak: number; best: number; playedToday: boolean };
};

const ADJ = ["Amber", "Swift", "Lucky", "Bright", "Bold", "Calm", "Clever", "Golden", "Jolly", "Mighty", "Quick", "Sunny", "Brave", "Cosmic", "Happy", "Keen"];
const ANIMAL = ["Fox", "Otter", "Falcon", "Tiger", "Panda", "Koala", "Eagle", "Dolphin", "Owl", "Lynx", "Gecko", "Heron", "Bison", "Mantis", "Carabao", "Tarsier"];

/** Stable, privacy-safe alias per member. Never derived from email or name text. */
function aliasFor(userId: string): string {
  let h = 2166136261;
  for (let i = 0; i < userId.length; i++) h = Math.imul(h ^ userId.charCodeAt(i), 16777619);
  const n = h >>> 0;
  return `Player ${ADJ[n % ADJ.length]} ${ANIMAL[(n >>> 8) % ANIMAL.length]}`;
}

function shiftDay(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing `key` (YYYY-MM-DD). */
function mondayOf(key: string): string {
  const d = new Date(`${key}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  return shiftDay(key, -dow);
}

export const getArcadeBoard = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = (d ?? {}) as { tz?: unknown; player?: unknown };
    const player = typeof o.player === "string" && /^[0-9a-f-]{36}$/i.test(o.player) ? o.player : "";
    return { tz: typeof o.tz === "string" && o.tz.length <= 64 ? o.tz : undefined, player };
  })
  .handler(async ({ data }): Promise<ArcadeBoard> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { todayKey } = await import("./arcade.server");
    const today = todayKey(undefined, data.tz);
    const weekStart = mondayOf(today);
    const empty: ArcadeBoard = {
      enabled: false,
      weekStart,
      leaders: [],
      me: { rank: null, solves: 0, plays: 0, streak: 0, best: 0, playedToday: false },
    };

    const [weekRes, mineRes] = await Promise.all([
      supabaseAdmin
        .from("game_plays")
        .select("user_id, email, solved")
        .eq("finished", true)
        .gte("puzzle_date", weekStart)
        .lte("puzzle_date", today)
        .limit(20000),
      supabaseAdmin
        .from("game_plays")
        .select("puzzle_date")
        .eq("user_id", data.player)
        .eq("finished", true)
        .order("puzzle_date", { ascending: false })
        .limit(2000),
    ]);

    const byUser = new Map<string, { email: string; solves: number; plays: number }>();
    for (const r of weekRes.data ?? []) {
      const row = byUser.get(r.user_id) ?? { email: r.email ?? "", solves: 0, plays: 0 };
      row.plays += 1;
      if (r.solved) row.solves += 1;
      if (!row.email && r.email) row.email = r.email;
      byUser.set(r.user_id, row);
    }
    const ranked = [...byUser.entries()]
      .map(([uid, r]) => ({ uid, ...r }))
      .sort((a, b) => b.solves - a.solves || b.plays - a.plays);
    const myIdx = ranked.findIndex((r) => r.uid === data.player);
    const leaders = ranked.slice(0, 25).map((r) => ({
      display: aliasFor(r.uid),
      solves: r.solves,
      plays: r.plays,
      me: r.uid === data.player,
    }));
    if (myIdx >= 25) {
      const r = ranked[myIdx]!;
      leaders.push({ display: aliasFor(r.uid), solves: r.solves, plays: r.plays, me: true });
    }

    // Daily play streak: consecutive days with at least one finished game,
    // counting from today (or yesterday if today isn't played yet).
    const days = new Set((mineRes.data ?? []).map((r) => String(r.puzzle_date)));
    const playedToday = days.has(today);
    let streak = 0;
    let cursor = playedToday ? today : shiftDay(today, -1);
    while (days.has(cursor)) {
      streak += 1;
      cursor = shiftDay(cursor, -1);
    }
    let best = 0;
    let run = 0;
    let prev: string | null = null;
    for (const d of [...days].sort()) {
      run = prev && shiftDay(prev, 1) === d ? run + 1 : 1;
      best = Math.max(best, run);
      prev = d;
    }

    const mine = myIdx >= 0 ? ranked[myIdx]! : null;
    return {
      enabled: true,
      weekStart,
      leaders,
      me: {
        rank: myIdx >= 0 ? myIdx + 1 : null,
        solves: mine?.solves ?? 0,
        plays: mine?.plays ?? 0,
        streak,
        best,
        playedToday,
      },
    };
  });
