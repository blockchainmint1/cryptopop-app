CREATE TABLE public.games (
  key text PRIMARY KEY,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'daily',
  enabled boolean NOT NULL DEFAULT true,
  pop_reward numeric NOT NULL DEFAULT 0,
  daily_cap_pop numeric NOT NULL DEFAULT 0,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.games TO service_role;
GRANT SELECT ON public.games TO anon, authenticated;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read games" ON public.games FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.games (key, title, sort_order) VALUES
  ('popword','POPword',1),('trivia','Trivia Night',2),('poptiles','POP Tiles',3),
  ('popcross','POPcross',4),('wordhive','Word Hive',5),('popnumbers','POP Numbers',6);

CREATE TABLE public.game_puzzles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_key text NOT NULL REFERENCES public.games(key) ON DELETE CASCADE,
  puzzle_date date NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  solution jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_key, puzzle_date)
);
GRANT ALL ON public.game_puzzles TO service_role;
ALTER TABLE public.game_puzzles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.game_plays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL DEFAULT '',
  game_key text NOT NULL REFERENCES public.games(key) ON DELETE CASCADE,
  puzzle_date date NOT NULL,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  finished boolean NOT NULL DEFAULT false,
  solved boolean NOT NULL DEFAULT false,
  score integer NOT NULL DEFAULT 0,
  pop_awarded numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, game_key, puzzle_date)
);
COMMENT ON COLUMN public.game_plays.user_id IS 'Random per-device arcade player id (wallet has no login)';
CREATE INDEX game_plays_week_idx ON public.game_plays (puzzle_date) WHERE finished;
GRANT ALL ON public.game_plays TO service_role;
ALTER TABLE public.game_plays ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.trivia_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  difficulty integer NOT NULL DEFAULT 2,
  q text NOT NULL UNIQUE,
  options jsonb NOT NULL,
  answer integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  source text NOT NULL DEFAULT 'ai',
  used_on date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.trivia_bank TO service_role;
ALTER TABLE public.trivia_bank ENABLE ROW LEVEL SECURITY;