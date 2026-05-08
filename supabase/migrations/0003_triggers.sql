-- Triggers: creator-implicit-vouch on pin insert.
-- (Itinerary cleanup trigger from the v1 plan dropped: itineraries are out of v1 scope.)

create or replace function public.tg_creator_vouch()
returns trigger language plpgsql security definer as $$
begin
  insert into public.vouches (pin_id, voucher_id)
  values (new.id, new.created_by)
  on conflict do nothing;
  return new;
end$$;

create trigger pins_creator_vouch
  after insert on public.pins
  for each row execute function public.tg_creator_vouch();
