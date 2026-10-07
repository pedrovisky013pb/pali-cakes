begin;

-- =====================================================================
-- Alterações pedidas pela Bruna (vídeos de 30/09/2026)
-- =====================================================================

-- 1. Cupcakes personalizados passam para Miniaturas e a categoria
--    "Cupcakes" deixa de aparecer no site (fica desativada, não apagada).
update public.produtos
   set categoria_slug = 'miniaturas'
 where categoria_slug = 'cupcakes';

update public.categorias
   set ativa = false,
       destaque = false
 where slug = 'cupcakes';

-- 2. Hambúrguer Dubai e Dubai Chewy Cookie passam para Miniaturas.
update public.produtos
   set categoria_slug = 'miniaturas'
 where slug in ('hamburguer-dubai', 'dubai-chewy-cookie')
    or nome ilike 'hamb%rguer dubai'
    or nome ilike 'dubai chewy cookie%';

-- 3. "Chocolate crocante com framboesa" sai do site (fica escondido, não
--    apagado; pode voltar marcando "Visível no site" no admin).
update public.produtos
   set ativo = false
 where slug = 'chocolate-crocante-framboesa'
    or nome ilike 'chocolate crocante com framboesa';

-- 4. Cupcakes: acrescentar à descrição que os extras são sob consulta.
--    Acrescenta ao texto que já existe (não apaga o que a Bruna escreveu).
update public.produtos
   set descricao = trim(coalesce(descricao, '')) ||
       case when coalesce(trim(descricao), '') = '' then '' else ' ' end ||
       'Extras como pasta de açúcar, glitter ou toppers são sob consulta.'
 where slug = 'cupcakes'
   and coalesce(descricao, '') not ilike '%pasta de açúcar%';

-- 5. Cheesecake passa a "Cheesecakes", com vários sabores, e a descrição
--    indica o tamanho. As fotos de cada sabor são postas no admin.
update public.produtos
   set nome = 'Cheesecakes',
       descricao = 'Cheesecake cremoso com 26 cm de diâmetro, serve até 12 fatias. Disponível nos sabores frutos vermelhos, Nutella, limão e Oreo.'
 where slug = 'cheesecake-frutos-vermelhos';

-- Sabores (sem foto, por agora). Só preenche se ainda não houver sabores,
-- para não apagar algum que já tenha sido criado no admin.
update public.produtos
   set opcoes = coalesce(opcoes, '{}'::jsonb) || jsonb_build_object(
         'sabores',
         '[
           {"nome": "Frutos vermelhos", "imagem": ""},
           {"nome": "Nutella", "imagem": ""},
           {"nome": "Limão", "imagem": ""},
           {"nome": "Oreo", "imagem": ""}
         ]'::jsonb
       )
 where slug = 'cheesecake-frutos-vermelhos'
   and coalesce(jsonb_array_length(
         case when jsonb_typeof(opcoes->'sabores') = 'array' then opcoes->'sabores' else '[]'::jsonb end
       ), 0) = 0;

-- 6. Tarte de Amêndoa: nome com acento, um só sabor (sem opções a escolher)
--    e descrição com o tamanho.
update public.produtos
   set nome = 'Tarte de Amêndoa',
       descricao = 'Tarte de amêndoa artesanal com 26 cm de diâmetro, serve até 12 fatias.',
       opcoes = coalesce(opcoes, '{}'::jsonb) || jsonb_build_object('sabores', '[]'::jsonb)
 where slug = 'tarte-de-amendoa';

commit;
