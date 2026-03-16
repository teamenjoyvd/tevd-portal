-- Fix trip_created notification action_url
-- The original trigger set action_url = '/trips/' || NEW.id which caused a 404
-- since there is no dynamic /trips/[id] route. Correct it to point to /trips.

CREATE OR REPLACE FUNCTION public.notify_trip_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into public.notifications (profile_id, type, title, message, action_url)
  select
    p.id,
    'trip_created',
    'New trip available',
    NEW.title || ' — ' || NEW.destination || ' is now open for registration.',
    '/trips'
  from public.profiles p
  where p.role in ('member', 'core', 'admin');

  return NEW;
end;
$function$