/**
 * Admin → "Fotos do site": fotos fixas das páginas, fotos do carrossel da
 * página inicial (uma por categoria) e gestão do Portfólio. Tudo é guardado
 * de imediato; o site público só muda depois de "Publicar alterações".
 */

import { exigirSessao, sair } from "@/lib/auth";
import { carregarImagem, TAMANHO_MAXIMO_FOTO } from "@/lib/admin-products";
import { FOTOS_FIXAS, FOTOS_PADRAO, type ChaveFoto } from "@/lib/site-photos";
import { ordenarPortfolio, type PortfolioRow } from "@/lib/portfolio";
import {
  listarFotosSite,
  guardarFotoSite,
  listarCategoriasCarrossel,
  guardarFotoCategoria,
  listarPortfolioAdmin,
  actualizarTrabalho,
  criarTrabalho,
  eliminarTrabalho
} from "@/lib/admin-site-photos";

/** Categorias do portfólio sugeridas mesmo que ainda não tenham trabalhos. */
const CATEGORIAS_BASE = [
  "Bolos Personalizados",
  "Bento Cakes",
  "Sobremesas",
  "Chocolates",
  "Miniaturas"
];

const OPCAO_NOVA_CATEGORIA = "__nova__";

let trabalhos: PortfolioRow[] = [];

function esc(valor: string): string {
  return valor.replace(/[&<>"']/g, (caracter) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[caracter] ?? caracter
  );
}

function mostrarEstado(elemento: HTMLElement | null, texto: string, erro = false): void {
  if (!elemento) return;
  elemento.textContent = texto;
  elemento.classList.toggle("is-error", erro);
}

/**
 * Envia a foto escolhida, guarda-a com `guardar` e atualiza a pré-visualização.
 * Devolve o URL guardado (ou null se algo falhou).
 */
async function enviarFoto(
  input: HTMLInputElement,
  prefixo: string,
  estado: HTMLElement | null,
  guardar: (url: string) => Promise<boolean>
): Promise<string | null> {
  const ficheiro = input.files?.[0];
  input.value = "";
  if (!ficheiro) return null;

  if (ficheiro.size > TAMANHO_MAXIMO_FOTO) {
    mostrarEstado(estado, "A imagem excede 20 MB.", true);
    return null;
  }

  mostrarEstado(estado, "A carregar foto…");

  const url = await carregarImagem(ficheiro, prefixo);
  if (!url) {
    mostrarEstado(estado, "Não foi possível carregar a foto.", true);
    return null;
  }

  if (!(await guardar(url))) {
    mostrarEstado(estado, "A foto foi carregada mas não ficou guardada. Tente novamente.", true);
    return null;
  }

  mostrarEstado(estado, "Guardado ✓ Falta publicar.");
  return url;
}

function cartaoFoto(opcoes: {
  titulo: string;
  subtitulo?: string;
  url: string;
  atributos: string;
  repor?: boolean;
}): string {
  return `
    <article class="admin-photo-card" ${opcoes.atributos}>
      <div class="admin-photo-card__image">
        <img
          src="${esc(opcoes.url)}"
          alt=""
          data-preview
          onerror="this.onerror=null;this.classList.add('is-broken')"
        />
      </div>

      <div class="admin-photo-card__body">
        <strong>${esc(opcoes.titulo)}</strong>
        ${opcoes.subtitulo ? `<span>${esc(opcoes.subtitulo)}</span>` : ""}

        <div class="admin-photo-card__actions">
          <label class="button button--secondary button--small">
            <input type="file" accept="image/jpeg,image/png,image/webp" data-upload hidden />
            Trocar foto
          </label>
          ${
            opcoes.repor
              ? `<button type="button" class="admin-photo-card__reset" data-repor>Repor a original</button>`
              : ""
          }
        </div>

        <span class="admin-photo-card__status" data-status></span>
      </div>
    </article>
  `;
}

/* ------------------------------------------------------------------ */
/* Fotos das páginas                                                   */
/* ------------------------------------------------------------------ */

async function renderizarFotosFixas(): Promise<void> {
  const contentor = document.querySelector<HTMLElement>("[data-fotos-fixas]");
  if (!contentor) return;

  const guardadas = await listarFotosSite();
  const seccoes = [...new Set(FOTOS_FIXAS.map((foto) => foto.secao))];

  contentor.innerHTML = seccoes
    .map(
      (secao) => `
        <h3 class="admin-photos-subtitle">${esc(secao)}</h3>
        <div class="admin-photo-grid">
          ${FOTOS_FIXAS.filter((foto) => foto.secao === secao)
            .map((foto) =>
              cartaoFoto({
                titulo: foto.nome,
                url: guardadas[foto.chave] || FOTOS_PADRAO[foto.chave],
                atributos: `data-foto-fixa="${foto.chave}"`,
                repor: true
              })
            )
            .join("")}
        </div>
      `
    )
    .join("");

  contentor.querySelectorAll<HTMLElement>("[data-foto-fixa]").forEach((cartao) => {
    const chave = cartao.dataset.fotoFixa as ChaveFoto;
    const imagem = cartao.querySelector<HTMLImageElement>("[data-preview]");
    const estado = cartao.querySelector<HTMLElement>("[data-status]");

    cartao.querySelector<HTMLInputElement>("[data-upload]")?.addEventListener("change", async (evento) => {
      const url = await enviarFoto(evento.target as HTMLInputElement, `site-${chave}`, estado, (novoUrl) =>
        guardarFotoSite(chave, novoUrl)
      );

      if (url && imagem) {
        imagem.classList.remove("is-broken");
        imagem.src = url;
      }
    });

    cartao.querySelector("[data-repor]")?.addEventListener("click", async () => {
      mostrarEstado(estado, "A repor…");
      const original = FOTOS_PADRAO[chave];

      if (await guardarFotoSite(chave, original)) {
        if (imagem) {
          imagem.classList.remove("is-broken");
          imagem.src = original;
        }
        mostrarEstado(estado, "Foto original reposta ✓ Falta publicar.");
      } else {
        mostrarEstado(estado, "Não foi possível repor a foto.", true);
      }
    });
  });
}

/* ------------------------------------------------------------------ */
/* Carrossel da página inicial (foto de cada categoria)                */
/* ------------------------------------------------------------------ */

async function renderizarCarrossel(): Promise<void> {
  const contentor = document.querySelector<HTMLElement>("[data-fotos-carrossel]");
  if (!contentor) return;

  const categorias = await listarCategoriasCarrossel();

  if (categorias.length === 0) {
    contentor.innerHTML = `<p class="admin-loading">Não foi possível carregar as categorias.</p>`;
    return;
  }

  contentor.innerHTML = categorias
    .map((categoria) =>
      cartaoFoto({
        titulo: categoria.nome,
        subtitulo: "Cartão do carrossel",
        url: categoria.imagem_url ?? "",
        atributos: `data-categoria-slug="${esc(categoria.slug)}"`
      })
    )
    .join("");

  contentor.querySelectorAll<HTMLElement>("[data-categoria-slug]").forEach((cartao) => {
    const slug = cartao.dataset.categoriaSlug ?? "";
    const imagem = cartao.querySelector<HTMLImageElement>("[data-preview]");
    const estado = cartao.querySelector<HTMLElement>("[data-status]");

    cartao.querySelector<HTMLInputElement>("[data-upload]")?.addEventListener("change", async (evento) => {
      const url = await enviarFoto(evento.target as HTMLInputElement, `categoria-${slug}`, estado, (novoUrl) =>
        guardarFotoCategoria(slug, novoUrl)
      );

      if (url && imagem) {
        imagem.classList.remove("is-broken");
        imagem.src = url;
      }
    });
  });
}

/* ------------------------------------------------------------------ */
/* Portfólio                                                           */
/* ------------------------------------------------------------------ */

function categoriasPortfolio(): string[] {
  const existentes = ordenarPortfolio(trabalhos).map((trabalho) => trabalho.categoria);
  return [...new Set([...existentes, ...CATEGORIAS_BASE])];
}

function opcoesCategoria(actual: string): string {
  return `
    ${categoriasPortfolio()
      .map(
        (categoria) =>
          `<option value="${esc(categoria)}" ${categoria === actual ? "selected" : ""}>${esc(categoria)}</option>`
      )
      .join("")}
    <option value="${OPCAO_NOVA_CATEGORIA}">Outra categoria…</option>
  `;
}

/** Ordem para um trabalho que entra no fim de uma categoria. */
function ordemNoFimDe(categoria: string): number {
  const daCategoria = trabalhos.filter((trabalho) => trabalho.categoria === categoria);

  if (daCategoria.length > 0) {
    return Math.max(...daCategoria.map((trabalho) => trabalho.ordem)) + 1;
  }

  // Categoria nova: fica depois de todas as outras.
  return trabalhos.length > 0 ? Math.max(...trabalhos.map((trabalho) => trabalho.ordem)) + 10 : 10;
}

function cartaoTrabalho(trabalho: PortfolioRow, primeiro: boolean, ultimo: boolean): string {
  return `
    <article
      class="admin-portfolio-item${trabalho.ativo ? "" : " is-inactive"}"
      data-trabalho="${esc(trabalho.id)}"
      data-categoria="${esc(trabalho.categoria)}"
    >
      <div class="admin-product__image">
        <img
          src="${esc(trabalho.imagem_url)}"
          alt=""
          data-preview
          onerror="this.onerror=null;this.classList.add('is-broken')"
        />
        <label class="admin-product__upload">
          <input type="file" accept="image/jpeg,image/png,image/webp" data-upload hidden />
          <span>Trocar foto</span>
        </label>
      </div>

      <div class="admin-portfolio-item__fields">
        <label class="form-field">
          <span>Título</span>
          <input type="text" data-titulo value="${esc(trabalho.titulo)}" maxlength="120" />
        </label>

        <label class="form-field">
          <span>Categoria</span>
          <select data-categoria-select>${opcoesCategoria(trabalho.categoria)}</select>
        </label>

        <label class="form-field" data-categoria-nova-campo hidden>
          <span>Nome da nova categoria</span>
          <input type="text" data-categoria-nova maxlength="60" placeholder="Ex: Bolos de casamento" />
        </label>

        <div class="admin-portfolio-item__actions">
          <label class="admin-portfolio-item__toggle">
            <input type="checkbox" data-ativo ${trabalho.ativo ? "checked" : ""} />
            Visível no site
          </label>

          <div class="admin-portfolio-item__order">
            <button type="button" data-mover="-1" aria-label="Subir" ${primeiro ? "disabled" : ""}>↑</button>
            <button type="button" data-mover="1" aria-label="Descer" ${ultimo ? "disabled" : ""}>↓</button>
          </div>

          <button type="button" class="admin-product__delete" data-eliminar>Eliminar</button>
        </div>

        <span class="admin-photo-card__status" data-status></span>
      </div>
    </article>
  `;
}

function renderizarPortfolio(): void {
  const lista = document.querySelector<HTMLElement>("[data-portfolio-lista]");
  const filtro = document.querySelector<HTMLSelectElement>("[data-portfolio-filtro]");
  if (!lista) return;

  const ordenados = ordenarPortfolio(trabalhos);
  const categorias = [...new Set(ordenados.map((trabalho) => trabalho.categoria))];

  if (filtro) {
    const escolhida = filtro.value;
    filtro.innerHTML =
      `<option value="">Todas as categorias (${ordenados.length})</option>` +
      categorias
        .map((categoria) => {
          const total = ordenados.filter((trabalho) => trabalho.categoria === categoria).length;
          return `<option value="${esc(categoria)}">${esc(categoria)} (${total})</option>`;
        })
        .join("");
    filtro.value = categorias.includes(escolhida) ? escolhida : "";
  }

  if (ordenados.length === 0) {
    lista.innerHTML = `<p class="admin-loading">Ainda não há trabalhos no portfólio.</p>`;
    return;
  }

  lista.innerHTML = categorias
    .map((categoria) => {
      const daCategoria = ordenados.filter((trabalho) => trabalho.categoria === categoria);

      return `
        <div class="admin-portfolio-group" data-grupo="${esc(categoria)}">
          <h3 class="admin-photos-subtitle">${esc(categoria)} <small>${daCategoria.length}</small></h3>
          ${daCategoria
            .map((trabalho, indice) =>
              cartaoTrabalho(trabalho, indice === 0, indice === daCategoria.length - 1)
            )
            .join("")}
        </div>
      `;
    })
    .join("");

  aplicarFiltro();

  lista.querySelectorAll<HTMLElement>("[data-trabalho]").forEach(ligarTrabalho);
}

function aplicarFiltro(): void {
  const filtro = document.querySelector<HTMLSelectElement>("[data-portfolio-filtro]");
  const valor = filtro?.value ?? "";

  document.querySelectorAll<HTMLElement>("[data-grupo]").forEach((grupo) => {
    grupo.hidden = valor !== "" && grupo.dataset.grupo !== valor;
  });
}

async function guardarCampos(
  trabalho: PortfolioRow,
  campos: Partial<Omit<PortfolioRow, "id">>,
  estado: HTMLElement | null
): Promise<boolean> {
  mostrarEstado(estado, "A guardar…");

  if (!(await actualizarTrabalho(trabalho.id, campos))) {
    mostrarEstado(estado, "Não foi possível guardar.", true);
    return false;
  }

  Object.assign(trabalho, campos);
  mostrarEstado(estado, "Guardado ✓ Falta publicar.");
  return true;
}

function ligarTrabalho(cartao: HTMLElement): void {
  const trabalho = trabalhos.find((item) => item.id === cartao.dataset.trabalho);
  if (!trabalho) return;

  const estado = cartao.querySelector<HTMLElement>("[data-status]");
  const imagem = cartao.querySelector<HTMLImageElement>("[data-preview]");

  cartao.querySelector<HTMLInputElement>("[data-upload]")?.addEventListener("change", async (evento) => {
    // A descrição antiga (alt) era da foto anterior: passa a ser gerada a partir do título.
    const url = await enviarFoto(evento.target as HTMLInputElement, "portfolio", estado, async (novoUrl) => {
      const ok = await actualizarTrabalho(trabalho.id, { imagem_url: novoUrl, alt: null });
      if (ok) Object.assign(trabalho, { imagem_url: novoUrl, alt: null });
      return ok;
    });

    if (url && imagem) {
      imagem.classList.remove("is-broken");
      imagem.src = url;
    }
  });

  const titulo = cartao.querySelector<HTMLInputElement>("[data-titulo]");
  titulo?.addEventListener("change", async () => {
    const novo = titulo.value.trim();

    if (!novo) {
      titulo.value = trabalho.titulo;
      mostrarEstado(estado, "O título não pode ficar vazio.", true);
      return;
    }

    if (novo !== trabalho.titulo) {
      await guardarCampos(trabalho, { titulo: novo }, estado);
    }
  });

  const mudarCategoria = async (categoria: string): Promise<void> => {
    const nova = categoria.trim();
    if (!nova || nova === trabalho.categoria) return;

    if (await guardarCampos(trabalho, { categoria: nova, ordem: ordemNoFimDe(nova) }, estado)) {
      renderizarPortfolio();
    }
  };

  const select = cartao.querySelector<HTMLSelectElement>("[data-categoria-select]");
  const campoNova = cartao.querySelector<HTMLElement>("[data-categoria-nova-campo]");
  const inputNova = cartao.querySelector<HTMLInputElement>("[data-categoria-nova]");

  select?.addEventListener("change", () => {
    if (select.value === OPCAO_NOVA_CATEGORIA) {
      if (campoNova) campoNova.hidden = false;
      inputNova?.focus();
      return;
    }

    if (campoNova) campoNova.hidden = true;
    void mudarCategoria(select.value);
  });

  inputNova?.addEventListener("change", () => void mudarCategoria(inputNova.value));

  const ativo = cartao.querySelector<HTMLInputElement>("[data-ativo]");
  ativo?.addEventListener("change", async () => {
    if (await guardarCampos(trabalho, { ativo: ativo.checked }, estado)) {
      cartao.classList.toggle("is-inactive", !ativo.checked);
      mostrarEstado(
        estado,
        ativo.checked ? "Visível no site ✓ Falta publicar." : "Escondido do site ✓ Falta publicar."
      );
    } else {
      ativo.checked = !ativo.checked;
    }
  });

  cartao.querySelectorAll<HTMLButtonElement>("[data-mover]").forEach((botao) => {
    botao.addEventListener("click", () => void mover(trabalho, Number(botao.dataset.mover), estado));
  });

  cartao.querySelector("[data-eliminar]")?.addEventListener("click", async () => {
    if (!window.confirm(`Eliminar "${trabalho.titulo}" do portfólio? Esta ação não se pode desfazer.`)) {
      return;
    }

    mostrarEstado(estado, "A eliminar…");

    if (await eliminarTrabalho(trabalho.id)) {
      trabalhos = trabalhos.filter((item) => item.id !== trabalho.id);
      renderizarPortfolio();
    } else {
      mostrarEstado(estado, "Não foi possível eliminar.", true);
    }
  });
}

/** Troca a posição com o trabalho anterior (-1) ou seguinte (1) da mesma categoria. */
async function mover(trabalho: PortfolioRow, direcao: number, estado: HTMLElement | null): Promise<void> {
  const daCategoria = ordenarPortfolio(trabalhos).filter(
    (item) => item.categoria === trabalho.categoria
  );
  const indice = daCategoria.findIndex((item) => item.id === trabalho.id);
  const vizinho = daCategoria[indice + direcao];
  if (!vizinho) return;

  let ordemTrabalho = vizinho.ordem;
  const ordemVizinho = trabalho.ordem;

  // Com ordens iguais a troca não teria efeito.
  if (ordemTrabalho === ordemVizinho) ordemTrabalho += direcao;

  mostrarEstado(estado, "A mudar a ordem…");

  const [okA, okB] = await Promise.all([
    actualizarTrabalho(trabalho.id, { ordem: ordemTrabalho }),
    actualizarTrabalho(vizinho.id, { ordem: ordemVizinho })
  ]);

  if (!okA || !okB) {
    mostrarEstado(estado, "Não foi possível mudar a ordem.", true);
    trabalhos = await listarPortfolioAdmin();
    renderizarPortfolio();
    return;
  }

  trabalho.ordem = ordemTrabalho;
  vizinho.ordem = ordemVizinho;
  renderizarPortfolio();

  const cartao = document.querySelector<HTMLElement>(`[data-trabalho="${CSS.escape(trabalho.id)}"]`);
  mostrarEstado(cartao?.querySelector<HTMLElement>("[data-status]") ?? null, "Ordem guardada ✓ Falta publicar.");
}

/** Cartão para acrescentar um trabalho novo (foto + título + categoria). */
function abrirNovoTrabalho(): void {
  const lista = document.querySelector<HTMLElement>("[data-portfolio-lista]");
  if (!lista) return;

  const existente = lista.querySelector<HTMLElement>("[data-novo]");
  if (existente) {
    existente.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const filtro = document.querySelector<HTMLSelectElement>("[data-portfolio-filtro]");
  const categoriaInicial = filtro?.value || categoriasPortfolio()[0] || "";

  const cartao = document.createElement("article");
  cartao.className = "admin-portfolio-item is-novo";
  cartao.dataset.novo = "true";
  cartao.innerHTML = `
    <div class="admin-product__image">
      <img alt="" data-preview hidden />
      <label class="admin-product__upload">
        <input type="file" accept="image/jpeg,image/png,image/webp" data-upload hidden />
        <span>Escolher foto</span>
      </label>
    </div>

    <div class="admin-portfolio-item__fields">
      <label class="form-field">
        <span>Título</span>
        <input type="text" data-titulo maxlength="120" placeholder="Ex: Bolo de batizado com flores" />
      </label>

      <label class="form-field">
        <span>Categoria</span>
        <select data-categoria-select>${opcoesCategoria(categoriaInicial)}</select>
      </label>

      <label class="form-field" data-categoria-nova-campo hidden>
        <span>Nome da nova categoria</span>
        <input type="text" data-categoria-nova maxlength="60" />
      </label>

      <div class="admin-portfolio-item__actions">
        <button type="button" class="button button--primary button--small" data-criar>
          Adicionar ao portfólio
        </button>
        <button type="button" class="button button--secondary button--small" data-cancelar>
          Cancelar
        </button>
      </div>

      <span class="admin-photo-card__status" data-status></span>
    </div>
  `;

  lista.prepend(cartao);
  cartao.scrollIntoView({ behavior: "smooth", block: "center" });

  let urlFoto = "";
  const estado = cartao.querySelector<HTMLElement>("[data-status]");
  const imagem = cartao.querySelector<HTMLImageElement>("[data-preview]");
  const select = cartao.querySelector<HTMLSelectElement>("[data-categoria-select]");
  const campoNova = cartao.querySelector<HTMLElement>("[data-categoria-nova-campo]");

  select?.addEventListener("change", () => {
    if (campoNova) campoNova.hidden = select.value !== OPCAO_NOVA_CATEGORIA;
  });

  cartao.querySelector<HTMLInputElement>("[data-upload]")?.addEventListener("change", async (evento) => {
    const url = await enviarFoto(evento.target as HTMLInputElement, "portfolio", estado, async () => true);

    if (url && imagem) {
      urlFoto = url;
      imagem.hidden = false;
      imagem.src = url;
      mostrarEstado(estado, "Foto pronta. Preencha o título e carregue em Adicionar.");
    }
  });

  cartao.querySelector("[data-cancelar]")?.addEventListener("click", () => cartao.remove());

  cartao.querySelector<HTMLButtonElement>("[data-criar]")?.addEventListener("click", async (evento) => {
    const botao = evento.currentTarget as HTMLButtonElement;
    const titulo = cartao.querySelector<HTMLInputElement>("[data-titulo]")?.value.trim() ?? "";
    const categoria =
      select?.value === OPCAO_NOVA_CATEGORIA
        ? cartao.querySelector<HTMLInputElement>("[data-categoria-nova]")?.value.trim() ?? ""
        : select?.value ?? "";

    if (!urlFoto) return mostrarEstado(estado, "Escolha primeiro a foto.", true);
    if (!titulo) return mostrarEstado(estado, "Indique um título.", true);
    if (!categoria) return mostrarEstado(estado, "Indique a categoria.", true);

    botao.disabled = true;
    mostrarEstado(estado, "A adicionar…");

    const novo = await criarTrabalho({
      titulo,
      categoria,
      imagem_url: urlFoto,
      alt: null,
      destaque: false,
      ativo: true,
      ordem: ordemNoFimDe(categoria)
    });

    if (!novo) {
      botao.disabled = false;
      mostrarEstado(estado, "Não foi possível adicionar. Tente novamente.", true);
      return;
    }

    trabalhos.push(novo);
    renderizarPortfolio();

    const criado = document.querySelector<HTMLElement>(`[data-trabalho="${CSS.escape(novo.id)}"]`);
    criado?.scrollIntoView({ behavior: "smooth", block: "center" });
    mostrarEstado(criado?.querySelector<HTMLElement>("[data-status]") ?? null, "Adicionado ✓ Falta publicar.");
  });
}

/* ------------------------------------------------------------------ */

async function iniciar(): Promise<void> {
  if (!document.querySelector("[data-portfolio-lista]")) return;

  const autorizado = await exigirSessao();
  if (!autorizado) return;

  document.querySelector("[data-logout]")?.addEventListener("click", sair);
  document.querySelector("[data-novo-trabalho]")?.addEventListener("click", abrirNovoTrabalho);
  document.querySelector("[data-portfolio-filtro]")?.addEventListener("change", aplicarFiltro);

  trabalhos = await listarPortfolioAdmin();

  await Promise.all([renderizarFotosFixas(), renderizarCarrossel()]);
  renderizarPortfolio();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciar, { once: true });
} else {
  iniciar();
}
