# Pali Cakes — palicakes.pt

Site da Pali Cakes (bolos personalizados e doces artesanais, by Bruna Paliotes):
catálogo, packs de festa, portfólio, avaliações e pedido de encomenda, com
painel de administração.

## Tecnologia

- **Astro** — site estático gerado no build (bom para SEO e velocidade). Os
  dados (produtos, categorias, fotos, portfólio) são lidos do Supabase no
  momento do build.
- **Supabase** — base de dados, autenticação do admin, armazenamento de fotos
  (bucket `produtos`, público; `encomendas-referencias`, privado) e funções
  (`order-notification`, `contact-form`, `publicar-site`).
- **GitHub Pages** — alojamento. Cada `push` para `main` publica o site
  (`.github/workflows/deploy.yml`).

## Comandos

| Comando           | O que faz                                   |
| :---------------- | :------------------------------------------ |
| `npm install`     | Instala as dependências                     |
| `npm run dev`     | Servidor local em `localhost:4321`          |
| `npm run build`   | Gera o site em `./dist/`                    |
| `npm run check`   | Verifica tipos e erros do Astro             |
| `npm run preview` | Pré-visualiza o build localmente            |

É preciso Node 22.12 ou mais recente e um ficheiro `.env` (não vai para o Git)
com:

```
PUBLIC_SUPABASE_URL=...
PUBLIC_SUPABASE_ANON_KEY=...
```

### Abrir o projeto noutro computador

```
git clone https://github.com/pedrovisky013pb/pali-cakes.git
cd pali-cakes
npm install
```

Criar o `.env` com os dois valores acima (Supabase → Project Settings → API) e
correr `npm run dev`.

## Estrutura

```
public/                 imagens, favicon, robots.txt e CNAME
src/
  components/           home, layout (navbar, rodapé, cookies), produtos, avaliações
  data/portfolio.ts     portfólio de origem (só é usado se a tabela portfolio falhar)
  layouts/              MainLayout (SEO, navbar, rodapé, Analytics com consentimento)
  lib/                  acesso ao Supabase e regras partilhadas:
                          products, categories, orders, reviews, pricing (preço
                          por quantidade), site-photos e portfolio (fotos
                          editáveis), admin-* (funções do painel)
  pages/                páginas do site; admin/ = painel de administração
  scripts/              comportamento no navegador (carrinho, checkout, variantes,
                          admin…)
  styles/               CSS global, componentes, admin e responsivo
  types/database.ts     tipos das tabelas e do campo produtos.opcoes
supabase/
  functions/            order-notification, contact-form
  migrations/           alterações à base de dados, por ordem de data
astro.config.mjs        domínio, redirects de endereços antigos e sitemap
```

## Painel de administração (`/admin`)

Como o site é estático, quase tudo o que se muda no painel só aparece no site
depois de carregar em **Publicar alterações** (cerca de 2 minutos).

- **Encomendas** (`/admin/encomendas`) — chegam também por email, com cupão,
  desconto, personalização e fotos de referência.
- **Produtos** (`/admin/produtos`) — fotos e galeria, categoria, preço,
  quantidade mínima, sabores (com foto e preço opcionais), grupos de variantes
  (massa, cobertura, recheio…), tamanhos com preço e mínimo próprios, **preço
  por quantidade** (ex.: brigadeiros mais baratos a partir de 30 un.) e
  conteúdo dos packs.
- **Avaliações** (`/admin/avaliacoes`) — moderação. As regras de lançamento
  (publicação automática, cupões PALI01…, janela de 24 horas e validade) estão
  na tabela `definicoes_lancamento`; ver os comentários das migrações
  `2026092313*`, `2026092314*`, `2026092411*` e `2026092612*`.
- **Fotos do site** (`/admin/fotos`) — fotos do topo da página inicial, da
  secção "Sobre a Bruna" e da página Sobre (tabela `fotos_site`), foto de cada
  cartão do carrossel da página inicial (`categorias.imagem_url`) e gestão do
  **Portfólio** (tabela `portfolio`: trocar fotos, acrescentar, esconder,
  eliminar, título, categoria e ordem).
- **Conta** (`/admin/conta`) — mudar a palavra-passe.

### Regras de preço

- O preço por unidade de um produto pode depender do sabor, do tamanho e da
  quantidade (`produtos.opcoes`: `sabores`, `tamanhos`, `precos_quantidade`).
- No preço por quantidade, o valor do escalão atingido vale para **todas** as
  unidades. O carrinho e o checkout mostram o preço por unidade, e a função
  `criar_encomenda` aplica a mesma regra ao gravar a encomenda.
- Cupões de avaliação: 6% sobre o total dos produtos com preço, uso único,
  ligados ao email de quem avaliou.

## Alterações à base de dados

Cada alteração fica num ficheiro em `supabase/migrations/`, a correr no SQL
Editor do Supabase **por ordem** e **antes** do `git push` do código que dela
depende.

A função do email de encomenda é publicada à parte:

```
npx supabase functions deploy order-notification --project-ref yhruqmfmcbsukezjrgcl
```

## Alojamento e domínio

- Repositório: `pedrovisky013pb/pali-cakes` (GitHub). Em Settings → Pages, a
  origem tem de estar em **GitHub Actions**. Se o site deixar de atualizar ou
  um deploy falhar com "Ensure GitHub Pages has been enabled", confirmar essa
  opção e voltar a correr o deploy (Actions → Run workflow).
- O build precisa dos secrets `PUBLIC_SUPABASE_URL` e
  `PUBLIC_SUPABASE_ANON_KEY` (GitHub → Settings → Secrets and variables →
  Actions).
- Domínio `palicakes.pt` (Dominios.pt). O DNS é gerido no **cPanel → Zone
  Editor**, não no painel de redirecionamento. Lá está o registo TXT
  `_github-pages-challenge-pedrovisky013pb` que verifica o domínio no GitHub.
- O botão **Publicar alterações** chama a função `publicar-site`, que usa os
  secrets `GITHUB_TOKEN`, `GITHUB_OWNER` e `GITHUB_REPO` (Supabase → Edge
  Functions → Secrets). Se aparecer um erro 401, o token do GitHub expirou:
  gerar um novo e atualizar o secret.
