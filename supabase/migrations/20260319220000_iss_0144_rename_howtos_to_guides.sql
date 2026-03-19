-- ISS-0144: Rename howtos table to guides
ALTER TABLE public.howtos RENAME TO guides;

-- Update bento_config tile_key reference
UPDATE public.bento_config SET tile_key = 'guides' WHERE tile_key = 'howtos';
