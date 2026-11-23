-- Supabase SQL Editor에서 실행. 모든 사용자 데이터는 Google 로그인 uid로 분리됩니다.
create table if not exists public.myline_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.myline_snapshots enable row level security;
revoke all on public.myline_snapshots from anon;
grant select,insert,update on public.myline_snapshots to authenticated;
drop policy if exists "myline_select_own" on public.myline_snapshots;
create policy "myline_select_own" on public.myline_snapshots for select to authenticated using (auth.uid() = user_id);
drop policy if exists "myline_insert_own" on public.myline_snapshots;
create policy "myline_insert_own" on public.myline_snapshots for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "myline_update_own" on public.myline_snapshots;
create policy "myline_update_own" on public.myline_snapshots for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- 서버에서 원자적으로 버전을 검사해 오래된 기기가 최신 기록을 덮어쓰지 못하도록 합니다.
create or replace function public.myline_cas_save(expected_revision bigint, new_payload jsonb)
returns bigint language plpgsql security invoker set search_path = public as $$
declare new_revision bigint;
begin
  update public.myline_snapshots
     set payload = new_payload, revision = revision + 1, updated_at = now()
   where user_id = auth.uid() and revision = expected_revision
   returning revision into new_revision;
  return new_revision;
end; $$;
revoke all on function public.myline_cas_save(bigint,jsonb) from public;
grant execute on function public.myline_cas_save(bigint,jsonb) to authenticated;
