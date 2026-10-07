-- Align the starter catalog with the definitive folklore and pixel-art direction.

update public.creature_catalog
set
  title = 'Serpente das Brasas Vivas',
  description = 'Enrola-se ao redor de trilhas antigas e ilumina quem respeita a mata.',
  lore = 'Seus olhos de lampião confundem invasores, mas guiam viajantes que não ferem a floresta.',
  folklore_inspiration = 'Boitatá do folclore brasileiro e serpentes protetoras do fogo, reinterpretados',
  updated_at = now()
where id = 'ignavora';
update public.creature_catalog
set
  folklore_inspiration = 'Encantados de rio sul-americanos e animais-guia costeiros, reinterpretados',
  updated_at = now()
where id = 'marulino';
update public.creature_catalog
set
  title = 'Sentinela dos Passos Invertidos',
  description = 'Uma criatura de crina vermelha e cascos ao contrário que despista caçadores.',
  lore = 'Folhas novas brotam onde seus rastros parecem terminar, protegendo ninhos e árvores centenárias.',
  folklore_inspiration = 'Curupira e Caipora do folclore brasileiro, reinterpretados sem retratar a entidade diretamente',
  updated_at = now()
where id = 'ibiram';
update public.creature_catalog
set
  folklore_inspiration = 'Raijū japonês, felinos de montanha e animais de tempestade, reinterpretados',
  updated_at = now()
where id = 'raivel';
update public.creature_catalog
set
  folklore_inspiration = 'Cães negros celtas, guardiões psicopompos e espíritos noturnos eslavos, reinterpretados',
  updated_at = now()
where id = 'lumissombra';
update public.creature_catalog
set
  folklore_inspiration = 'Tatus encantados e histórias sul-americanas de animais formadores da paisagem',
  updated_at = now()
where id = 'pedrassu';
