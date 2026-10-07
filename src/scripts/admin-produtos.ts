import { exigirSessao, sair } from "@/lib/auth";
import {
  listarProdutosAdmin,
  listarCategoriasAdmin,
  actualizarProduto,
  criarProduto,
  eliminarProduto,
  carregarImagem,
  TAMANHO_MAXIMO_FOTO
} from "@/lib/admin-products";
import type {
  Produto,
  Categoria,
  VarianteSabor,
  GrupoVariante,
  VarianteTamanho,
  EscalaoPreco
} from "@/types/database";

let produtos: Produto[] = [];
let categorias: Categoria[] = [];

interface OpcaoCategoria {
  valor: string;
  nome: string;
}

/**
 * Categorias que se podem escolher para um produto. A categoria "packs" da
 * tabela corresponde, nos produtos, a "packs-festa" (é esse o slug que a
 * página Packs Festa procura).
 */
function opcoesCategoria(): OpcaoCategoria[] {
  return categorias.map((categoria) => ({
    valor: categoria.slug === "packs" ? "packs-festa" : categoria.slug,
    nome: categoria.nome
  }));
}

function nomeCategoria(slug: string): string {
  return opcoesCategoria().find((opcao) => opcao.valor === slug)?.nome ?? slug;
}

function campoCategoria(produto: Produto, isNovo: boolean): string {
  const opcoes = opcoesCategoria();
  const actual = produto.categoria_slug;
  const actualConhecida = opcoes.some((opcao) => opcao.valor === actual);

  return `
    <label class="form-field">
      <span>Categoria</span>
      <select data-campo="categoria_slug">
        ${
          isNovo && !actual
            ? `<option value="" selected disabled>Escolha a categoria…</option>`
            : ""
        }
        ${
          actual && !actualConhecida
            ? `<option value="${actual}" selected>${actual}</option>`
            : ""
        }
        ${opcoes
          .map(
            (opcao) =>
              `<option value="${opcao.valor}" ${opcao.valor === actual ? "selected" : ""}>${opcao.nome}</option>`
          )
          .join("")}
      </select>
    </label>
  `;
}

function slugify(texto: string): string {
  const MARCAS_COMBINADAS = new RegExp("[\\u0300-\\u036f]", "g");

  return texto
    .normalize("NFD")
    .replace(MARCAS_COMBINADAS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Minúsculas e sem acentos, para pesquisa/comparação insensível a maiúsculas e acentos. */
function normalizar(texto: string): string {
  const MARCAS_COMBINADAS = new RegExp("[\\u0300-\\u036f]", "g");

  return texto.normalize("NFD").replace(MARCAS_COMBINADAS, "").toLowerCase();
}

function produtoVazio(): Produto {
  return {
    id: "",
    slug: "",
    nome: "",
    descricao: "",
    // Sem categoria pré-escolhida: obriga a escolher uma de propósito.
    categoria_slug: "",
    imagem_url: "",
    imagens: [],
    preco: null,
    preco_label: "Sob consulta",
    destaque: false,
    ativo: true,
    ordem: 0,
    opcoes: {},
    quantidade_minima: 1,
    criado_em: "",
    atualizado_em: ""
  };
}

function criarCartao(produto: Produto, isNovo = false): HTMLElement {
  const artigo = document.createElement("article");
  artigo.className = `admin-product${produto.ativo ? "" : " is-inactive"}${isNovo ? " is-novo" : ""}`;
  artigo.dataset.id = produto.id;
  if (isNovo) {
    artigo.dataset.novo = "true";
  } else {
    artigo.dataset.pesquisa = normalizar(
      `${produto.nome} ${nomeCategoria(produto.categoria_slug)}`
    );
  }

  // Categoria editável em todos os produtos (antes só nos novos), para se
  // poder corrigir um produto criado na categoria errada.
  const categoriaCampo = campoCategoria(produto, isNovo);

  const slugCampo = isNovo
    ? `
      <label class="form-field">
        <span>Slug (URL)</span>
        <input type="text" data-campo="slug" value="${produto.slug}" placeholder="gerado automaticamente a partir do nome" />
      </label>
    `
    : "";

  artigo.innerHTML = `
    <div class="admin-product__image">
      <img
        src="${produto.imagem_url ?? ""}"
        alt="${produto.nome}"
        onerror="this.onerror=null;this.classList.add('is-broken')"
      />
      <label class="admin-product__upload">
        <input type="file" accept="image/jpeg,image/png,image/webp" data-upload hidden />
        <span>Trocar foto</span>
      </label>
    </div>

    <div class="admin-product__fields">
      ${categoriaCampo}

      <label class="form-field">
        <span>Nome</span>
        <input type="text" data-campo="nome" value="${produto.nome}" />
      </label>

      ${slugCampo}

      <label class="form-field">
        <span>Descrição</span>
        <textarea data-campo="descricao" rows="2">${produto.descricao ?? ""}</textarea>
      </label>

      ${
        produto.categoria_slug === "packs-festa"
          ? `
      <label class="form-field">
        <span>O que inclui o pack — um item por linha</span>
        <textarea
          data-pack-conteudo
          rows="${Math.max(3, (produto.opcoes?.conteudo ?? []).length)}"
          placeholder="Ex: Bolo — 1 kg&#10;Brigadeiros — 6 unidades"
        >${(produto.opcoes?.conteudo ?? []).join("\n")}</textarea>
      </label>`
          : ""
      }

      <div class="admin-product__row">
        <label class="form-field">
          <span>Preço (€)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            data-campo="preco"
            value="${produto.preco ?? ""}"
            placeholder="Vazio = sob consulta"
          />
        </label>

        <label class="form-field">
          <span>Etiqueta de preço</span>
          <input type="text" data-campo="preco_label" value="${produto.preco_label}" />
        </label>

        <label class="form-field">
          <span>Qtd. mínima</span>
          <input
            type="number"
            min="1"
            max="99"
            step="1"
            data-campo="quantidade_minima"
            value="${produto.quantidade_minima ?? 1}"
          />
        </label>

        <label class="form-field">
          <span>Ordem</span>
          <input type="number" data-campo="ordem" value="${produto.ordem}" />
        </label>
      </div>

      <div class="admin-product__toggles">
        <label>
          <input type="checkbox" data-campo="ativo" ${produto.ativo ? "checked" : ""} />
          Visível no site
        </label>

        <label>
          <input type="checkbox" data-campo="destaque" ${produto.destaque ? "checked" : ""} />
          Destaque na página inicial
        </label>
      </div>

      <div class="admin-product__flavors">
        <span class="admin-product__flavors-label">
          Galeria de fotos
          <small>Fotos extra do produto, além da principal. Pode escolher várias de uma vez.</small>
        </span>

        <div class="admin-gallery" data-gallery-rows></div>

        <label class="button button--secondary button--small admin-gallery__add">
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple data-gallery-upload hidden />
          + Adicionar fotos
        </label>
      </div>

      <div class="admin-product__flavors">
        <span class="admin-product__flavors-label">
          Sabores / variantes
          <small>Se este produto tiver sabores à escolha, adicione aqui um nome e uma foto para cada um. Se o sabor tiver um preço diferente, preencha o preço; se ficar vazio, usa o preço do produto.</small>
        </span>

        <div class="admin-flavor-rows" data-flavor-rows></div>

        <button type="button" class="button button--secondary button--small" data-add-flavor>
          + Adicionar sabor
        </button>
      </div>

      <div class="admin-product__flavors">
        <span class="admin-product__flavors-label">
          Variantes adicionais (grupos)
          <small>Para produtos com várias escolhas, como massa, cobertura ou recheio. A foto do produto não muda com estas variantes.</small>
        </span>

        <div class="admin-flavor-rows" data-group-rows></div>

        <button type="button" class="button button--secondary button--small" data-add-group>
          + Adicionar grupo de variantes
        </button>
      </div>

      <div class="admin-product__flavors">
        <span class="admin-product__flavors-label">
          Tamanhos (com preço)
          <small>Só para produtos em que o tamanho muda o preço e a quantidade mínima (ex.: brownie Mini / Normal / Inteiro). Preço vazio = sob consulta.</small>
        </span>

        <div class="admin-flavor-rows" data-size-rows></div>

        <button type="button" class="button button--secondary button--small" data-add-size>
          + Adicionar tamanho
        </button>
      </div>

      <div class="admin-product__flavors">
        <span class="admin-product__flavors-label">
          Preço por quantidade
          <small>Desconto por quantidade (ex.: brigadeiros). A partir do número de unidades indicado, todas as unidades passam a custar esse preço. Abaixo do primeiro valor vale o preço normal do produto.</small>
        </span>

        <div class="admin-flavor-rows" data-tier-rows></div>

        <button type="button" class="button button--secondary button--small" data-add-tier>
          + Adicionar preço por quantidade
        </button>
      </div>

      <div class="admin-product__actions">
        <button type="button" class="button button--primary" data-guardar>
          ${isNovo ? "Criar produto" : "Guardar"}
        </button>
        ${
          isNovo
            ? `<button type="button" class="button button--secondary" data-cancelar-novo>Cancelar</button>`
            : `<button type="button" class="admin-product__delete" data-eliminar>Eliminar produto</button>`
        }
        <span class="admin-product__status" data-status></span>
      </div>
    </div>
  `;

  return artigo;
}

function criarLinhaSabor(sabor: VarianteSabor, indice: number): string {
  const semFoto = !sabor.imagem.trim();

  return `
    <div class="admin-flavor-row" data-flavor-row data-indice="${indice}">
      <div class="admin-flavor-row__image">
        <img
          src="${sabor.imagem}"
          alt=""
          class="${semFoto ? "is-broken" : ""}"
          onerror="this.onerror=null;this.classList.add('is-broken')"
        />
        <label class="admin-flavor-row__upload">
          <input type="file" accept="image/jpeg,image/png,image/webp" data-flavor-upload hidden />
          <span>Foto</span>
        </label>
      </div>

      <input
        type="text"
        class="admin-flavor-row__nome"
        data-flavor-nome
        value="${sabor.nome}"
        placeholder="Nome do sabor (ex: Ninho)"
      />

      <input
        type="number"
        step="0.01"
        min="0"
        class="admin-flavor-row__nome"
        data-flavor-preco
        value="${sabor.preco ?? ""}"
        placeholder="Preço € (opcional)"
        aria-label="Preço do sabor"
      />

      <button type="button" class="admin-flavor-row__remove" data-remove-flavor aria-label="Remover sabor">
        ✕
      </button>
    </div>
  `;
}

interface GrupoVarianteEdicao {
  nome: string;
  /** Texto em edição, com as opções separadas por vírgula. */
  opcoesTexto: string;
}

function criarLinhaGrupo(grupo: GrupoVarianteEdicao, indice: number): string {
  return `
    <div class="admin-flavor-row admin-flavor-row--group" data-group-row data-indice="${indice}">
      <input
        type="text"
        class="admin-flavor-row__nome"
        data-group-nome
        value="${grupo.nome}"
        placeholder="Nome do grupo (ex: Tipo de massa)"
      />

      <input
        type="text"
        class="admin-flavor-row__nome"
        data-group-opcoes
        value="${grupo.opcoesTexto}"
        placeholder="Opções separadas por vírgula (ex: Chocolate, Baunilha, Red Velvet)"
      />

      <button type="button" class="admin-flavor-row__remove" data-remove-group aria-label="Remover grupo">
        ✕
      </button>
    </div>
  `;
}

interface TamanhoEdicao {
  nome: string;
  preco: string;
  minimo: string;
  imagem: string;
}

function criarLinhaTamanho(tamanho: TamanhoEdicao, indice: number): string {
  const semFoto = !tamanho.imagem.trim();

  return `
    <div class="admin-flavor-row admin-flavor-row--size" data-size-row data-indice="${indice}">
      <div class="admin-flavor-row__image">
        <img
          src="${tamanho.imagem}"
          alt=""
          class="${semFoto ? "is-broken" : ""}"
          onerror="this.onerror=null;this.classList.add('is-broken')"
        />
        <label class="admin-flavor-row__upload">
          <input type="file" accept="image/jpeg,image/png,image/webp" data-size-upload hidden />
          <span>Foto</span>
        </label>
      </div>

      <input
        type="text"
        class="admin-flavor-row__nome"
        data-size-nome
        value="${tamanho.nome}"
        placeholder="Tamanho (ex: Mini)"
      />

      <input
        type="number"
        step="0.01"
        min="0"
        class="admin-flavor-row__nome"
        data-size-preco
        value="${tamanho.preco}"
        placeholder="Preço €"
        aria-label="Preço"
      />

      <input
        type="number"
        step="1"
        min="1"
        max="99"
        class="admin-flavor-row__nome"
        data-size-minimo
        value="${tamanho.minimo}"
        placeholder="Mín."
        aria-label="Quantidade mínima"
      />

      <button type="button" class="admin-flavor-row__remove" data-remove-size aria-label="Remover tamanho">
        ✕
      </button>
    </div>
  `;
}

interface EscalaoEdicao {
  minimo: string;
  preco: string;
}

function criarLinhaEscalao(escalao: EscalaoEdicao, indice: number): string {
  return `
    <div class="admin-flavor-row admin-flavor-row--tier" data-tier-row data-indice="${indice}">
      <label class="admin-flavor-row__tier-field">
        <span>A partir de</span>
        <input
          type="number"
          step="1"
          min="2"
          max="999"
          class="admin-flavor-row__nome"
          data-tier-minimo
          value="${escalao.minimo}"
          placeholder="Ex: 30"
          aria-label="A partir de quantas unidades"
        />
        <span>un.</span>
      </label>

      <label class="admin-flavor-row__tier-field">
        <input
          type="number"
          step="0.01"
          min="0"
          class="admin-flavor-row__nome"
          data-tier-preco
          value="${escalao.preco}"
          placeholder="Ex: 1.70"
          aria-label="Preço por unidade"
        />
        <span>€ / un.</span>
      </label>

      <button type="button" class="admin-flavor-row__remove" data-remove-tier aria-label="Remover preço por quantidade">
        ✕
      </button>
    </div>
  `;
}

function ligarEventos(artigo: HTMLElement, produto: Produto, isNovo = false): void {
  const status = artigo.querySelector<HTMLElement>("[data-status]");

  const mostrar = (texto: string, erro = false): void => {
    if (!status) return;
    status.textContent = texto;
    status.classList.toggle("is-error", erro);
    if (!erro) {
      window.setTimeout(() => { status.textContent = ""; }, 3000);
    }
  };

  // Só existe em cartões de produto novo.
  const campoNome = artigo.querySelector<HTMLInputElement>('[data-campo="nome"]');
  const campoSlug = artigo.querySelector<HTMLInputElement>('[data-campo="slug"]');

  const obterSlugActual = (): string => {
    const valorSlug = campoSlug?.value.trim();
    if (valorSlug) return slugify(valorSlug);
    return slugify(campoNome?.value.trim() ?? "");
  };

  if (isNovo && campoNome && campoSlug) {
    let slugEditadoManualmente = false;

    campoSlug.addEventListener("input", () => {
      slugEditadoManualmente = campoSlug.value.trim() !== "";
    });

    campoNome.addEventListener("input", () => {
      if (!slugEditadoManualmente) {
        campoSlug.value = slugify(campoNome.value);
      }
    });
  }

  // Estado local dos sabores/variantes, editado antes de "Guardar".
  const sabores: VarianteSabor[] = (produto.opcoes?.sabores ?? []).map(
    (sabor) => ({ ...sabor })
  );

  const linhasContainer = artigo.querySelector<HTMLElement>("[data-flavor-rows]");

  const renderizarSabores = (): void => {
    if (!linhasContainer) return;

    linhasContainer.innerHTML = sabores
      .map((sabor, indice) => criarLinhaSabor(sabor, indice))
      .join("");

    linhasContainer.querySelectorAll<HTMLElement>("[data-flavor-row]").forEach((linha) => {
      const indice = Number(linha.dataset.indice);

      linha.querySelector<HTMLInputElement>("[data-flavor-nome]")?.addEventListener(
        "input",
        (evento) => {
          sabores[indice].nome = (evento.target as HTMLInputElement).value;
        }
      );

      linha.querySelector<HTMLInputElement>("[data-flavor-preco]")?.addEventListener(
        "input",
        (evento) => {
          const valor = (evento.target as HTMLInputElement).value.replace(",", ".").trim();
          const preco = Number(valor);
          sabores[indice].preco = valor !== "" && Number.isFinite(preco) && preco > 0 ? preco : null;
        }
      );

      linha.querySelector<HTMLButtonElement>("[data-remove-flavor]")?.addEventListener(
        "click",
        () => {
          sabores.splice(indice, 1);
          renderizarSabores();
        }
      );

      linha.querySelector<HTMLInputElement>("[data-flavor-upload]")?.addEventListener(
        "change",
        async (evento) => {
          const input = evento.target as HTMLInputElement;
          const ficheiro = input.files?.[0];
          if (!ficheiro) return;

          if (ficheiro.size > TAMANHO_MAXIMO_FOTO) {
            mostrar("A imagem excede 20 MB.", true);
            input.value = "";
            return;
          }

          mostrar("A carregar foto do sabor…");

          const slugBase = isNovo ? obterSlugActual() || "novo-produto" : produto.slug;
          const url = await carregarImagem(ficheiro, `${slugBase}-sabor`);

          if (!url) {
            mostrar("Não foi possível carregar a foto.", true);
            input.value = "";
            return;
          }

          sabores[indice].imagem = url;
          mostrar("Foto carregada. Não esqueça de Guardar.");
          renderizarSabores();
        }
      );
    });
  };

  renderizarSabores();

  artigo.querySelector("[data-add-flavor]")?.addEventListener("click", () => {
    sabores.push({ nome: "", imagem: "", preco: null });
    renderizarSabores();
  });

  // Estado local dos grupos de variantes (massa, cobertura, recheio, etc.).
  const grupos: GrupoVarianteEdicao[] = (produto.opcoes?.grupos_variantes ?? []).map(
    (grupo) => ({ nome: grupo.nome, opcoesTexto: grupo.opcoes.join(", ") })
  );

  const gruposContainer = artigo.querySelector<HTMLElement>("[data-group-rows]");

  const renderizarGrupos = (): void => {
    if (!gruposContainer) return;

    gruposContainer.innerHTML = grupos
      .map((grupo, indice) => criarLinhaGrupo(grupo, indice))
      .join("");

    gruposContainer.querySelectorAll<HTMLElement>("[data-group-row]").forEach((linha) => {
      const indice = Number(linha.dataset.indice);

      linha.querySelector<HTMLInputElement>("[data-group-nome]")?.addEventListener(
        "input",
        (evento) => {
          grupos[indice].nome = (evento.target as HTMLInputElement).value;
        }
      );

      linha.querySelector<HTMLInputElement>("[data-group-opcoes]")?.addEventListener(
        "input",
        (evento) => {
          grupos[indice].opcoesTexto = (evento.target as HTMLInputElement).value;
        }
      );

      linha.querySelector<HTMLButtonElement>("[data-remove-group]")?.addEventListener(
        "click",
        () => {
          grupos.splice(indice, 1);
          renderizarGrupos();
        }
      );
    });
  };

  renderizarGrupos();

  artigo.querySelector("[data-add-group]")?.addEventListener("click", () => {
    grupos.push({ nome: "", opcoesTexto: "" });
    renderizarGrupos();
  });

  // Tamanhos com preço e mínimo próprios, editados antes de "Guardar".
  const tamanhos: TamanhoEdicao[] = (produto.opcoes?.tamanhos ?? []).map((tamanho) => ({
    nome: tamanho.nome,
    preco: tamanho.preco === null || tamanho.preco === undefined ? "" : String(tamanho.preco),
    minimo: String(tamanho.quantidade_minima ?? 1),
    imagem: tamanho.imagem ?? ""
  }));

  const tamanhosContainer = artigo.querySelector<HTMLElement>("[data-size-rows]");

  const renderizarTamanhos = (): void => {
    if (!tamanhosContainer) return;

    tamanhosContainer.innerHTML = tamanhos
      .map((tamanho, indice) => criarLinhaTamanho(tamanho, indice))
      .join("");

    tamanhosContainer.querySelectorAll<HTMLElement>("[data-size-row]").forEach((linha) => {
      const indice = Number(linha.dataset.indice);

      const ligarCampo = (seletor: string, campo: keyof TamanhoEdicao): void => {
        linha.querySelector<HTMLInputElement>(seletor)?.addEventListener("input", (evento) => {
          tamanhos[indice][campo] = (evento.target as HTMLInputElement).value;
        });
      };

      ligarCampo("[data-size-nome]", "nome");
      ligarCampo("[data-size-preco]", "preco");
      ligarCampo("[data-size-minimo]", "minimo");

      linha.querySelector("[data-remove-size]")?.addEventListener("click", () => {
        tamanhos.splice(indice, 1);
        renderizarTamanhos();
      });

      linha.querySelector<HTMLInputElement>("[data-size-upload]")?.addEventListener(
        "change",
        async (evento) => {
          const input = evento.target as HTMLInputElement;
          const ficheiro = input.files?.[0];
          if (!ficheiro) return;

          if (ficheiro.size > TAMANHO_MAXIMO_FOTO) {
            mostrar("A imagem excede 20 MB.", true);
            input.value = "";
            return;
          }

          mostrar("A carregar foto do tamanho…");

          const slugBase = isNovo ? obterSlugActual() || "novo-produto" : produto.slug;
          const url = await carregarImagem(ficheiro, `${slugBase}-tamanho`);

          if (!url) {
            mostrar("Não foi possível carregar a foto.", true);
            input.value = "";
            return;
          }

          tamanhos[indice].imagem = url;
          mostrar("Foto carregada. Não esqueça de Guardar.");
          renderizarTamanhos();
        }
      );
    });
  };

  renderizarTamanhos();

  artigo.querySelector("[data-add-size]")?.addEventListener("click", () => {
    tamanhos.push({ nome: "", preco: "", minimo: "1", imagem: "" });
    renderizarTamanhos();
  });

  // Preço por quantidade (escalões), editado antes de "Guardar".
  const escaloes: EscalaoEdicao[] = (produto.opcoes?.precos_quantidade ?? []).map((escalao) => ({
    minimo: String(escalao.quantidade_minima ?? ""),
    preco: String(escalao.preco ?? "")
  }));

  const escaloesContainer = artigo.querySelector<HTMLElement>("[data-tier-rows]");

  const renderizarEscaloes = (): void => {
    if (!escaloesContainer) return;

    escaloesContainer.innerHTML = escaloes
      .map((escalao, indice) => criarLinhaEscalao(escalao, indice))
      .join("");

    escaloesContainer.querySelectorAll<HTMLElement>("[data-tier-row]").forEach((linha) => {
      const indice = Number(linha.dataset.indice);

      linha.querySelector<HTMLInputElement>("[data-tier-minimo]")?.addEventListener("input", (evento) => {
        escaloes[indice].minimo = (evento.target as HTMLInputElement).value;
      });

      linha.querySelector<HTMLInputElement>("[data-tier-preco]")?.addEventListener("input", (evento) => {
        escaloes[indice].preco = (evento.target as HTMLInputElement).value;
      });

      linha.querySelector("[data-remove-tier]")?.addEventListener("click", () => {
        escaloes.splice(indice, 1);
        renderizarEscaloes();
      });
    });
  };

  renderizarEscaloes();

  artigo.querySelector("[data-add-tier]")?.addEventListener("click", () => {
    escaloes.push({ minimo: "", preco: "" });
    renderizarEscaloes();
  });

  // Galeria de fotos extra, editada antes de "Guardar".
  const galeria: string[] = Array.isArray(produto.imagens) ? [...produto.imagens] : [];

  const galeriaContainer = artigo.querySelector<HTMLElement>("[data-gallery-rows]");

  const renderizarGaleria = (): void => {
    if (!galeriaContainer) return;

    galeriaContainer.innerHTML = galeria
      .map(
        (url, indice) => `
          <div class="admin-gallery__item" data-gallery-item data-indice="${indice}">
            <img src="${url}" alt="" onerror="this.onerror=null;this.classList.add('is-broken')" />
            <button type="button" class="admin-gallery__remove" data-remove-gallery aria-label="Remover foto">✕</button>
          </div>
        `
      )
      .join("");

    galeriaContainer.querySelectorAll<HTMLElement>("[data-gallery-item]").forEach((item) => {
      const indice = Number(item.dataset.indice);

      item.querySelector("[data-remove-gallery]")?.addEventListener("click", () => {
        galeria.splice(indice, 1);
        renderizarGaleria();
        mostrar("Foto removida. Não esqueça de Guardar.");
      });
    });
  };

  renderizarGaleria();

  artigo.querySelector<HTMLInputElement>("[data-gallery-upload]")?.addEventListener(
    "change",
    async (evento) => {
      const input = evento.target as HTMLInputElement;
      const ficheiros = Array.from(input.files ?? []);
      if (ficheiros.length === 0) return;

      const slugBase = isNovo ? obterSlugActual() || "novo-produto" : produto.slug;
      let carregadas = 0;
      let falhadas = 0;

      for (const [posicao, ficheiro] of ficheiros.entries()) {
        if (ficheiro.size > TAMANHO_MAXIMO_FOTO) {
          falhadas += 1;
          continue;
        }

        mostrar(`A carregar foto ${posicao + 1} de ${ficheiros.length}…`);

        const url = await carregarImagem(ficheiro, `${slugBase}-galeria`);

        if (url) {
          galeria.push(url);
          carregadas += 1;
          renderizarGaleria();
        } else {
          falhadas += 1;
        }
      }

      input.value = "";

      if (falhadas > 0) {
        mostrar(
          `${carregadas} foto(s) carregada(s), ${falhadas} falharam (máx. 20 MB cada). Não esqueça de Guardar.`,
          true
        );
      } else {
        mostrar(`${carregadas} foto(s) carregada(s). Não esqueça de Guardar.`);
      }
    }
  );

  // Imagem principal: em produtos novos ainda não há id, por isso a foto
  // fica em memória e só é gravada quando se clica em "Criar produto".
  let imagemUrl = produto.imagem_url ?? "";

  artigo.querySelector("[data-cancelar-novo]")?.addEventListener("click", () => {
    artigo.remove();
  });

  artigo.querySelector("[data-eliminar]")?.addEventListener("click", async () => {
    const confirmado = window.confirm(
      `Eliminar definitivamente "${produto.nome}"? Esta ação não pode ser desfeita.`
    );
    if (!confirmado) return;

    mostrar("A eliminar…");

    const sucesso = await eliminarProduto(produto.id);

    mostrar(sucesso ? "Eliminado ✓" : "Não foi possível eliminar.", !sucesso);

    if (sucesso) await carregar();
  });

  // Guardar alterações
  artigo.querySelector("[data-guardar]")?.addEventListener("click", async () => {
    const campos: Record<string, unknown> = {};

    artigo.querySelectorAll<HTMLElement>("[data-campo]").forEach((elemento) => {
      const campo = elemento.dataset.campo;
      if (!campo) return;

      if (elemento instanceof HTMLInputElement && elemento.type === "checkbox") {
        campos[campo] = elemento.checked;
      } else if (elemento instanceof HTMLInputElement && elemento.type === "number") {
        const valor = elemento.value.trim();
        campos[campo] = valor === "" ? null : Number(valor);
      } else if (
        elemento instanceof HTMLSelectElement ||
        elemento instanceof HTMLInputElement ||
        elemento instanceof HTMLTextAreaElement
      ) {
        campos[campo] = elemento.value.trim();
      }
    });

    // A foto é opcional; só é preciso o nome do sabor.
    const saborIncompleto = sabores.some(
      (sabor) => sabor.nome.trim() === "" && sabor.imagem.trim() !== ""
    );

    if (saborIncompleto) {
      mostrar("Há um sabor com foto mas sem nome. Adicione o nome ou remova a foto.", true);
      return;
    }

    // Um grupo só é válido com nome e pelo menos uma opção.
    const grupoIncompleto = grupos.some((grupo) => {
      const nome = grupo.nome.trim();
      const opcoes = grupo.opcoesTexto.split(",").map((o) => o.trim()).filter(Boolean);
      return (nome !== "" && opcoes.length === 0) || (nome === "" && opcoes.length > 0);
    });

    if (grupoIncompleto) {
      mostrar("Há um grupo de variantes com nome mas sem opções (ou o contrário). Complete ou remova-o.", true);
      return;
    }

    const gruposVariantes: GrupoVariante[] = grupos
      .map((grupo) => ({
        nome: grupo.nome.trim(),
        opcoes: grupo.opcoesTexto.split(",").map((o) => o.trim()).filter(Boolean)
      }))
      .filter((grupo) => grupo.nome !== "" && grupo.opcoes.length > 0);

    const tamanhosValidos: VarianteTamanho[] = tamanhos
      .map((tamanho) => {
        const preco = Number(tamanho.preco.replace(",", "."));
        const minimo = Number(tamanho.minimo);

        return {
          nome: tamanho.nome.trim(),
          preco: tamanho.preco.trim() !== "" && Number.isFinite(preco) && preco > 0 ? preco : null,
          quantidade_minima:
            Number.isFinite(minimo) && minimo >= 1 ? Math.min(99, Math.trunc(minimo)) : 1,
          imagem: tamanho.imagem.trim()
        };
      })
      .filter((tamanho) => tamanho.nome !== "");

    // Escalões válidos, do menor para o maior, sem quantidades repetidas.
    const escaloesValidos: EscalaoPreco[] = escaloes
      .map((escalao) => ({
        quantidade_minima: Math.trunc(Number(escalao.minimo)),
        preco: Number(escalao.preco.replace(",", "."))
      }))
      .filter(
        (escalao) =>
          Number.isFinite(escalao.quantidade_minima) &&
          escalao.quantidade_minima >= 2 &&
          escalao.quantidade_minima <= 999 &&
          Number.isFinite(escalao.preco) &&
          escalao.preco > 0
      )
      .sort((a, b) => a.quantidade_minima - b.quantidade_minima)
      .filter(
        (escalao, indice, lista) =>
          lista.findIndex((outro) => outro.quantidade_minima === escalao.quantidade_minima) === indice
      );

    const campoConteudo = artigo.querySelector<HTMLTextAreaElement>("[data-pack-conteudo]");
    const conteudoPack = campoConteudo
      ? campoConteudo.value
          .split("\n")
          .map((linha) => linha.trim())
          .filter((linha) => linha !== "")
      : produto.opcoes?.conteudo ?? [];

    campos.opcoes = {
      // Mantém outras opções que existam no produto (não se perde nada ao guardar).
      ...(produto.opcoes ?? {}),
      conteudo: conteudoPack,
      sabores: sabores
        .map((sabor) => ({
          nome: sabor.nome.trim(),
          imagem: sabor.imagem.trim(),
          preco: typeof sabor.preco === "number" && sabor.preco > 0 ? sabor.preco : null
        }))
        .filter((sabor) => sabor.nome !== ""),
      grupos_variantes: gruposVariantes,
      tamanhos: tamanhosValidos,
      precos_quantidade: escaloesValidos
    };

    campos.imagens = [...galeria];

    // Vazio ou inválido = sem mínimo (1). Limite de 99, como no carrinho.
    const minimo = Number(campos.quantidade_minima);
    campos.quantidade_minima =
      Number.isFinite(minimo) && minimo >= 1 ? Math.min(99, Math.trunc(minimo)) : 1;

    if (isNovo) {
      const nome = String(campos.nome ?? "").trim();
      const categoriaSlug = String(campos.categoria_slug ?? "").trim();
      const slug = obterSlugActual();

      if (!nome) {
        mostrar("Indique o nome do produto.", true);
        return;
      }

      if (!categoriaSlug) {
        mostrar("Escolha uma categoria.", true);
        return;
      }

      if (!slug) {
        mostrar("Indique um slug (ou preencha o nome para o gerar).", true);
        return;
      }

      if (produtos.some((existente) => existente.slug === slug)) {
        mostrar("Já existe um produto com este slug. Escolha outro.", true);
        return;
      }

      mostrar("A criar…");

      const novo = await criarProduto({
        nome,
        categoria_slug: categoriaSlug,
        slug,
        descricao: String(campos.descricao ?? ""),
        preco: (campos.preco as number | null) ?? null,
        preco_label: String(campos.preco_label ?? "Sob consulta"),
        imagem_url: imagemUrl,
        imagens: [...galeria],
        destaque: Boolean(campos.destaque),
        ativo: Boolean(campos.ativo),
        ordem: (campos.ordem as number | null) ?? 0,
        quantidade_minima: campos.quantidade_minima as number,
        opcoes: campos.opcoes as {
          sabores?: VarianteSabor[];
          grupos_variantes?: GrupoVariante[];
          tamanhos?: VarianteTamanho[];
          conteudo?: string[];
          precos_quantidade?: EscalaoPreco[];
        }
      });

      mostrar(novo ? "Produto criado ✓" : "Não foi possível criar o produto.", !novo);

      if (novo) await carregar();
      return;
    }

    // Nunca gravar um produto existente sem categoria.
    if (!String(campos.categoria_slug ?? "").trim()) {
      delete campos.categoria_slug;
    }

    mostrar("A guardar…");

    const sucesso = await actualizarProduto(produto.id, campos);

    mostrar(sucesso ? "Guardado ✓" : "Não foi possível guardar.", !sucesso);

    if (sucesso) await carregar();
  });

  // Upload de imagem
  artigo.querySelector<HTMLInputElement>("[data-upload]")?.addEventListener(
    "change",
    async (evento) => {
      const input = evento.target as HTMLInputElement;
      const ficheiro = input.files?.[0];
      if (!ficheiro) return;

      if (ficheiro.size > TAMANHO_MAXIMO_FOTO) {
        mostrar("A imagem excede 20 MB.", true);
        input.value = "";
        return;
      }

      mostrar("A carregar imagem…");

      const slugBase = isNovo ? obterSlugActual() || "novo-produto" : produto.slug;
      const url = await carregarImagem(ficheiro, slugBase);

      if (!url) {
        mostrar("Não foi possível carregar a imagem.", true);
        input.value = "";
        return;
      }

      const imagemElemento = artigo.querySelector<HTMLImageElement>(".admin-product__image img");
      if (imagemElemento) {
        imagemElemento.classList.remove("is-broken");
        imagemElemento.src = url;
      }

      if (isNovo) {
        imagemUrl = url;
        mostrar("Foto carregada. Não esqueça de criar o produto.");
        return;
      }

      const guardado = await actualizarProduto(produto.id, { imagem_url: url });

      mostrar(guardado ? "Imagem actualizada ✓" : "Erro ao guardar.", !guardado);

      if (guardado) await carregar();
    }
  );
}

function filtrarProdutos(termo: string): void {
  const lista = document.querySelector<HTMLElement>("[data-products-list]");
  if (!lista) return;

  const termoNormalizado = normalizar(termo.trim());
  const cartoes = lista.querySelectorAll<HTMLElement>(".admin-product:not([data-novo])");

  let visiveis = 0;

  cartoes.forEach((cartao) => {
    const corresponde =
      !termoNormalizado || (cartao.dataset.pesquisa ?? "").includes(termoNormalizado);
    cartao.hidden = !corresponde;
    if (corresponde) visiveis += 1;
  });

  let semResultados = lista.querySelector<HTMLElement>("[data-sem-resultados]");

  if (visiveis === 0 && termoNormalizado && cartoes.length > 0) {
    if (!semResultados) {
      semResultados = document.createElement("p");
      semResultados.className = "admin-loading";
      semResultados.dataset.semResultados = "true";
      semResultados.textContent = "Nenhum produto encontrado.";
      lista.append(semResultados);
    }
  } else {
    semResultados?.remove();
  }
}

function renderizar(): void {
  const lista = document.querySelector<HTMLElement>("[data-products-list]");
  if (!lista) return;

  lista.replaceChildren();

  if (produtos.length === 0) {
    const vazio = document.createElement("p");
    vazio.className = "admin-loading";
    vazio.textContent = "Ainda não há produtos.";
    lista.append(vazio);
    return;
  }

  produtos.forEach((produto) => {
    const artigo = criarCartao(produto);
    lista.append(artigo);
    ligarEventos(artigo, produto);
  });

  const campoPesquisa = document.querySelector<HTMLInputElement>("[data-produto-pesquisa]");
  if (campoPesquisa?.value.trim()) {
    filtrarProdutos(campoPesquisa.value);
  }
}

async function carregar(): Promise<void> {
  [produtos, categorias] = await Promise.all([
    listarProdutosAdmin(),
    listarCategoriasAdmin()
  ]);

  renderizar();
}

function adicionarRascunho(): void {
  const lista = document.querySelector<HTMLElement>("[data-products-list]");
  if (!lista) return;

  // Só um rascunho de cada vez.
  const rascunhoExistente = lista.querySelector<HTMLElement>('[data-novo="true"]');
  if (rascunhoExistente) {
    rascunhoExistente.scrollIntoView({ behavior: "smooth", block: "start" });
    rascunhoExistente.querySelector<HTMLInputElement>('[data-campo="nome"]')?.focus();
    return;
  }

  lista.querySelector(".admin-loading")?.remove();

  const rascunho = produtoVazio();
  const artigo = criarCartao(rascunho, true);
  lista.prepend(artigo);
  ligarEventos(artigo, rascunho, true);

  artigo.scrollIntoView({ behavior: "smooth", block: "start" });
  artigo.querySelector<HTMLInputElement>('[data-campo="nome"]')?.focus();
}

async function iniciar(): Promise<void> {
  const lista = document.querySelector("[data-products-list]");
  if (!lista) return;

  const autorizado = await exigirSessao();
  if (!autorizado) return;

  document.querySelector("[data-logout]")?.addEventListener("click", sair);
  document.querySelector("[data-novo-produto]")?.addEventListener("click", adicionarRascunho);

  const campoPesquisa = document.querySelector<HTMLInputElement>("[data-produto-pesquisa]");
  campoPesquisa?.addEventListener("input", () => filtrarProdutos(campoPesquisa.value));

  await carregar();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciar, { once: true });
} else {
  iniciar();
}