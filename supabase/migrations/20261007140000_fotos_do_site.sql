begin;

-- =====================================================================
-- Fotos do site editáveis no admin (aba "Fotos do site")
-- =====================================================================
-- 1. fotos_site: fotos fixas das páginas (topo da página inicial, "Sobre a
--    Bruna" na página inicial e as duas fotos da página Sobre).
-- 2. portfolio: os trabalhos do Portfólio (antes estavam no código).
-- O carrossel da página inicial usa a foto de cada categoria
-- (categorias.imagem_url), que o admin já pode alterar.
-- =====================================================================

create table if not exists public.fotos_site (
  chave text primary key,
  url text not null,
  atualizado_em timestamptz not null default now()
);

alter table public.fotos_site enable row level security;

drop policy if exists "fotos do site sao publicas" on public.fotos_site;
create policy "fotos do site sao publicas"
on public.fotos_site
for select
to anon, authenticated
using (true);

drop policy if exists "admin gere fotos do site" on public.fotos_site;
create policy "admin gere fotos do site"
on public.fotos_site
for all
to authenticated
using ((select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin')
with check ((select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin');

insert into public.fotos_site (chave, url) values
  ('inicio-topo-1', '/images/hero/hero-bolo-flores.jpg'),
  ('inicio-topo-2', '/images/hero/hero-chocolates.jpg'),
  ('inicio-topo-3', '/images/hero/hero-cupcakes.jpg'),
  ('inicio-topo-4', '/images/hero/hero-bolo-frutos.jpg'),
  ('inicio-sobre-bruna', '/images/about/about-pali.JPG'),
  ('sobre-topo', '/images/about/about-pali.JPG'),
  ('sobre-bruna', '/images/about/about-bruna.jpg')
on conflict (chave) do nothing;

create table if not exists public.portfolio (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  categoria text not null,
  imagem_url text not null,
  alt text,
  destaque boolean not null default false,
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

create index if not exists portfolio_ordem_idx on public.portfolio (ordem);

alter table public.portfolio enable row level security;

drop policy if exists "portfolio visivel ao publico" on public.portfolio;
create policy "portfolio visivel ao publico"
on public.portfolio
for select
to anon, authenticated
using (ativo);

drop policy if exists "admin gere portfolio" on public.portfolio;
create policy "admin gere portfolio"
on public.portfolio
for all
to authenticated
using ((select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin')
with check ((select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin');

-- Os 36 trabalhos que estavam no código (só se a tabela estiver vazia, para
-- a migração poder correr de novo sem duplicar).
insert into public.portfolio (titulo, categoria, imagem_url, alt, destaque, ativo, ordem)
select *
from (values
  ('Bolo com flores em pasta e drip dourado', 'Bolos Personalizados', '/images/portfolio/bolo-flores-drip.jpg', 'Bolo branco com flores em pasta de açúcar coral e drip dourado produzido pela Pali Cakes', true, true, 10),
  ('Bolo temático com suculentas', 'Bolos Personalizados', '/images/portfolio/bolo-suculentas.jpg', 'Bolo verde decorado com suculentas comestíveis e efeito de terra produzido pela Pali Cakes', true, true, 20),
  ('Bolo coração com mensagem divertida', 'Bolos Personalizados', '/images/portfolio/bolo-humor-aniversario.jpg', 'Bolo em formato de coração com mensagem de aniversário bem-humorada produzido pela Pali Cakes', false, true, 30),
  ('Bolo de finalistas com rosetas', 'Bolos Personalizados', '/images/portfolio/bolo-finalistas-rosetas.jpg', 'Bolo branco texturado com rosetas de chantilly e topo de finalista produzido pela Pali Cakes', true, true, 40),
  ('Bolo minimalista com flores naturais', 'Bolos Personalizados', '/images/portfolio/bolo-textura-flores-brancas.jpg', 'Bolo branco texturado com coroa de flores naturais produzido pela Pali Cakes', false, true, 50),
  ('Bolo de finalistas com frase divertida', 'Bolos Personalizados', '/images/portfolio/bolo-finalistas-frase.jpg', 'Bolo branco elegante com mensagem de finalistas e flores secas produzido pela Pali Cakes', false, true, 60),
  ('Bolo pintado à mão em estilo azulejo', 'Bolos Personalizados', '/images/portfolio/bolo-azulejos.jpg', 'Bolo branco pintado à mão com padrão floral azul inspirado em azulejos portugueses produzido pela Pali Cakes', true, true, 70),
  ('Bolo de noivado com alianças douradas', 'Bolos Personalizados', '/images/portfolio/bolo-noivado-aliancas.jpg', 'Bolo elegante com desenho de alianças douradas e pérolas produzido pela Pali Cakes', false, true, 80),
  ('Bolo vintage com topo em efeito geode', 'Bolos Personalizados', '/images/portfolio/bolo-floral-vintage-geode.jpg', 'Bolo com padrão floral vintage, borda dourada e topo brilhante em efeito geode produzido pela Pali Cakes', false, true, 90),
  ('Bolo cinzento com efeito kintsugi', 'Bolos Personalizados', '/images/portfolio/bolo-kintsugi-aniversario.jpg', 'Bolo cinzento com linhas douradas em efeito kintsugi e topo dourado de aniversário produzido pela Pali Cakes', false, true, 100),
  ('Bolo com flores e frutos vermelhos', 'Bolos Personalizados', '/images/portfolio/bolo-50-fabulous.jpg', 'Bolo branco decorado com flores amarelas e frutos vermelhos frescos produzido pela Pali Cakes', true, true, 110),
  ('Bolo com frutos vermelhos e chocolate', 'Bolos Personalizados', '/images/portfolio/bolo-40-anos-frutos.jpg', 'Bolo branco com drip de chocolate e coroa de frutos vermelhos frescos produzido pela Pali Cakes', false, true, 120),
  ('Bolo metalizado com borboletas', 'Bolos Personalizados', '/images/portfolio/bolo-metalico-borboletas.jpg', 'Bolo em degradê metalizado rosa e vermelho com borboletas produzido pela Pali Cakes', false, true, 130),
  ('Bolo escultural em formato de camisa', 'Bolos Personalizados', '/images/portfolio/bolo-camisa-verde.jpg', 'Bolo esculpido em formato de camisa verde com botões produzido pela Pali Cakes', false, true, 140),
  ('Bolo de chocolate com frutos vermelhos', 'Bolos Personalizados', '/images/portfolio/bolo-chocolate-frutos-vermelhos.jpg', 'Bolo de chocolate coberto com frutos vermelhos frescos e hortelã produzido pela Pali Cakes', true, true, 150),
  ('Bolo de unicórnio', 'Bolos Personalizados', '/images/portfolio/bolo-unicornio.jpg', 'Bolo temático de unicórnio com corno dourado e rosetas cor-de-rosa produzido pela Pali Cakes', false, true, 160),
  ('Bento cake com mensagem divertida', 'Bento Cakes', '/images/portfolio/bento-cake-frase-humor.jpg', 'Bento cake pequeno com mensagem bem-humorada produzido pela Pali Cakes', true, true, 170),
  ('Bento cake para o Dia do Pai', 'Bento Cakes', '/images/portfolio/bento-cake-super-pai.jpg', 'Bento cake colorido com o tema Super Pai produzido pela Pali Cakes', false, true, 180),
  ('Bento cake elegante para aniversário', 'Bento Cakes', '/images/portfolio/bento-cake-38-anos.jpg', 'Bento cake azul elegante com mensagem de aniversário produzido pela Pali Cakes', false, true, 190),
  ('Bento cake com corações', 'Bento Cakes', '/images/portfolio/bento-cake-maos-coracao.jpg', 'Bento cake decorado com mãos a formar um coração produzido pela Pali Cakes', false, true, 200),
  ('Bento cake de aniversário de namoro', 'Bento Cakes', '/images/portfolio/bento-cake-calendario.jpg', 'Bento cake com tema de calendário para celebrar um ano de relação produzido pela Pali Cakes', false, true, 210),
  ('Cheesecake de frutos vermelhos', 'Sobremesas', '/images/portfolio/sobremesa-cheesecake-frutos.jpg', 'Cheesecake artesanal coberto com frutos vermelhos frescos produzido pela Pali Cakes', true, true, 220),
  ('Bolo Piscina Cenoura', 'Sobremesas', '/images/portfolio/sobremesa-bolo-formigueiro.jpg', 'Bolo artesanal coberto com chocolate granulado produzido pela Pali Cakes', false, true, 230),
  ('Chocolates Pali Cakes', 'Chocolates', '/images/portfolio/chocolates-caixa-marca.jpg', 'Chocolates artesanais com a marca Pali Cakes', true, true, 240),
  ('Tabletes de chocolate com frutas', 'Chocolates', '/images/portfolio/chocolates-tabletes-frutas.jpg', 'Tabletes de chocolate artesanal decoradas com frutas produzidas pela Pali Cakes', false, true, 250),
  ('Chocolate crocante com framboesa', 'Chocolates', '/images/portfolio/chocolates-crocante-framboesa.jpg', 'Chocolate artesanal crocante decorado com framboesa produzido pela Pali Cakes', false, true, 260),
  ('Brigadeiros gurmets', 'Miniaturas', '/images/portfolio/miniaturas-caixa-trufas.jpg', 'Brigadeiros gurmets artesanais produzidos pela Pali Cakes', true, true, 270),
  ('Brigadeiros personalizados', 'Miniaturas', '/images/portfolio/doces-festa-real.jpg', 'Brigadeiros personalizados produzidos pela Pali Cakes', false, true, 280),
  ('Brownies artesanais', 'Miniaturas', '/images/portfolio/miniaturas-brownies.jpg', 'Brownies artesanais com cobertura de chocolate produzidos pela Pali Cakes', false, true, 290),
  ('Morango do Amor', 'Miniaturas', '/images/portfolio/morango-do-amor.jpg', 'Morango do amor produzidos pela Pali Cakes', false, true, 300),
  ('Coxinhas de morango', 'Miniaturas', '/images/portfolio/miniaturas-brigadeiro-rolo.jpg', 'Coxinhas de morango produzidas pela Pali Cakes', false, true, 310),
  ('Mini churros', 'Miniaturas', '/images/portfolio/miniaturas-macro-detalhe.jpg', 'Mini churros produzidas pela Pali Cakes', false, true, 320),
  ('Tarteletes para evento', 'Miniaturas', '/images/portfolio/miniaturas-evento-tarteletes.jpg', 'Mesa de tarteletes de frutos vermelhos montada para evento pela Pali Cakes', false, true, 330),
  ('Cake pops decorados', 'Miniaturas', '/images/portfolio/miniaturas-cake-pops.jpg', 'Cake pops decorados sobre base em forma de coração produzidos pela Pali Cakes', false, true, 340),
  ('Cupcakes com rosetas', 'Miniaturas', '/images/portfolio/miniaturas-cupcakes-rosa.jpg', 'Cupcakes com cobertura em roseta rosa e dourada produzidos pela Pali Cakes', true, true, 350),
  ('Copos de sobremesa e brigadeiros', 'Miniaturas', '/images/portfolio/miniaturas-copos-brigadeiros.jpg', 'Copos de sobremesa e brigadeiros com a marca Pali Cakes', false, true, 360)
) as v(titulo, categoria, imagem_url, alt, destaque, ativo, ordem)
where not exists (select 1 from public.portfolio);

notify pgrst, 'reload schema';

commit;
