-- BuildLikeASenior — course purchases schema
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id text not null,
  amount integer not null,
  razorpay_order_id text,
  razorpay_payment_id text,
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);

alter table public.purchases enable row level security;

-- Buyers can read their own purchases (used by the "My Courses" page).
drop policy if exists "Users read own purchases" on public.purchases;
create policy "Users read own purchases"
  on public.purchases
  for select
  using (auth.uid() = user_id);

-- Writes happen only from the server using the service role key,
-- which bypasses RLS. No insert/update policy is granted to clients.
