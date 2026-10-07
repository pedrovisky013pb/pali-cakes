begin;

-- =====================================================================
-- Alterações da Bruna (parte 2) — correr DEPOIS de 20261007100000.
-- =====================================================================

-- 7. Diâmetro com o símbolo Ø em vez de "de diâmetro".
update public.produtos
   set descricao = 'Cheesecake cremoso, Ø 26 cm, serve até 12 fatias.'
 where slug = 'cheesecake-frutos-vermelhos';

update public.produtos
   set descricao = 'Tarte de amêndoa artesanal, Ø 26 cm, serve até 12 fatias.'
 where slug = 'tarte-de-amendoa';

-- 8. Bolo de cenoura: nova descrição.
update public.produtos
   set descricao = 'Bolo de cenoura recheado com brigadeiro tradicional. Serve até 12 fatias.'
 where slug = 'bolo-piscina-cenoura';

commit;
