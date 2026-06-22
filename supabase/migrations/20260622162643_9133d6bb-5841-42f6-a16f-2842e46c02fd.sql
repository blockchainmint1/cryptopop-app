INSERT INTO public.user_roles (user_id, role)
VALUES
  ('b4cda587-c07b-4977-ad7b-2608768bb7e4', 'admin'),
  ('a020da9b-43c2-4629-ba6c-7764ab6bc354', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;