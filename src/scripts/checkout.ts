
import {
  criarEncomenda,
  carregarImagemReferencia,
  validarCupao,
  normalizarCupao,
  DESCONTO_CUPAO_PERCENTAGEM,
  type OrderItemInput
} from "@/lib/orders";
import { getCart, clearCart, getUnitPrice, type CartItem } from "./cart";
import { currentPriceTier } from "@/lib/pricing";
import { calcularEntrega } from "@/lib/delivery";


let taxaEntregaActual: number | null = null;
let entregaVerificada = false;
let pedidoEntregaActual = 0;

// Categorias em que faz sentido pedir uma foto de referência/inspiração
// (bento cakes, bolos personalizados, cupcakes e miniaturas — cookies,
// cake pops e futuramente cake sicles entram todos em "miniaturas").
const CATEGORIAS_COM_REFERENCIA = [
  "bolos-personalizados",
  "bento-cakes",
  "cupcakes",
  "miniaturas",
  "packs-festa"
];

const CATEGORIA_PACKS = "packs-festa";

const PLACEHOLDER_NOTAS =
  "Tema, cores, sabores, quantidade de pessoas e outros detalhes importantes.";
const PLACEHOLDER_NOTAS_PACK =
  "Ex.: Bolo — massa de chocolate, recheio de brigadeiro. Brigadeiros — tradicional e Nido. Cupcakes — baunilha com frutos vermelhos. Tema e cores da festa…";

function temPack(cart: CartItem[]): boolean {
  return cart.some((item) => item.categorySlug === CATEGORIA_PACKS);
}

const MAX_IMAGENS_REFERENCIA = 4;

interface ReferenciaEnviada {
  caminho: string;
  nome: string;
}

let imagensReferencia: ReferenciaEnviada[] = [];

const currencyFormatter = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR"
});

async function actualizarEntrega(): Promise<void> {
  const pedidoEntrega = ++pedidoEntregaActual;
  const opcao = document.querySelector<HTMLInputElement>(
    'input[name="fulfillmentType"]:checked'
  );

  const campoCP = document.querySelector<HTMLInputElement>(
    'input[name="postalCode"]'
  );

  const resultado = document.querySelector<HTMLElement>("[data-delivery-result]");
  const linha = document.querySelector<HTMLElement>("[data-delivery-line]");
  const valor = document.querySelector<HTMLElement>("[data-delivery-fee]");

  const isDelivery = opcao?.value === "delivery";

  if (!isDelivery) {
    taxaEntregaActual = null;
    entregaVerificada = false;
    if (resultado) resultado.hidden = true;
    if (linha) linha.hidden = true;
    renderCheckoutSummary();
    return;
  }

  const cp = campoCP?.value.trim() ?? "";

  if (cp.replace(/\D/g, "").length < 4) {
    taxaEntregaActual = null;
    entregaVerificada = false;
    if (resultado) resultado.hidden = true;
    if (linha) linha.hidden = true;
    renderCheckoutSummary();
    return;
  }

  entregaVerificada = false;
  renderCheckoutSummary();
  const entrega = await calcularEntrega(cp);

  if (pedidoEntrega !== pedidoEntregaActual) {
    return;
  }

  if (!entrega.encontrada) {
    taxaEntregaActual = null;
    entregaVerificada = false;

    if (resultado) {
      resultado.textContent = entrega.foraDoLimite
        ? "Infelizmente não entregamos a partir de 45 km. Pode optar por levantamento ou combinar connosco um ponto de recolha mais próximo."
        : "Não efetuamos entregas nesta zona. Pode optar por levantamento ou contactar-nos.";
      resultado.className = "checkout-delivery__result is-error";
      resultado.hidden = false;
    }

    if (linha) linha.hidden = true;
    renderCheckoutSummary();
    return;
  }

  taxaEntregaActual = entrega.preco ?? null;
  entregaVerificada = true;

  if (resultado) {
    resultado.textContent =
      `${entrega.zona} — taxa de entrega ${currencyFormatter.format(entrega.preco ?? 0)}`;
    resultado.className = "checkout-delivery__result";
    resultado.hidden = false;
  }

  if (linha && valor) {
    valor.textContent = currencyFormatter.format(entrega.preco ?? 0);
    linha.hidden = false;
  }

  renderCheckoutSummary();
}

function calculateKnownTotal(cart: CartItem[]): number {
  return cart.reduce((total, item) => {
    const unitPrice = getUnitPrice(item);

    if (unitPrice === null) {
      return total;
    }

    return total + unitPrice * item.quantity;
  }, 0);
}

function createSummaryItem(item: CartItem): HTMLElement {
  const article = document.createElement("article");

  article.className = "checkout-summary__item";

  const image = document.createElement("img");

  image.src = item.image;
  image.alt = item.name;

  const content = document.createElement("div");

  const name = document.createElement("strong");

  name.textContent = item.name;

  const details = document.createElement("span");

  const unitPrice = getUnitPrice(item);

  details.textContent =
    `${item.quantity} × ${
      unitPrice === null
        ? item.priceLabel
        : currencyFormatter.format(unitPrice)
    }`;

  content.append(name, details);

  // Preço por quantidade: deixar claro quanto fica cada unidade.
  const tier = currentPriceTier(item.priceTiers, item.quantity);

  if (tier) {
    const tierNote = document.createElement("span");

    tierNote.className = "checkout-summary__tier";
    tierNote.textContent =
      `Preço por quantidade: cada unidade fica a ${currencyFormatter.format(tier.price)}` +
      (item.price !== null && item.price > tier.price
        ? ` (em vez de ${currencyFormatter.format(item.price)}).`
        : ".");

    content.append(tierNote);
  }

  if (item.flavor) {
    const flavor = document.createElement("span");

    flavor.textContent = item.flavor;
    flavor.className = "checkout-summary__flavor";

    content.append(flavor);
  }

  article.append(image, content);

  return article;
}

function renderCheckoutSummary(): CartItem[] {
  const itemsContainer =
    document.querySelector<HTMLElement>(
      "[data-checkout-items]"
    );

  const totalElement =
    document.querySelector<HTMLElement>(
      "[data-checkout-total]"
    );

  const submitButton =
    document.querySelector<HTMLButtonElement>(
      "[data-checkout-submit]"
    );

  if (
    !itemsContainer ||
    !totalElement ||
    !submitButton
  ) {
    return [];
  }

  const cart = getCart();
  const isDelivery =
    document.querySelector<HTMLInputElement>(
      'input[name="fulfillmentType"]:checked'
    )?.value === "delivery";

  actualizarVisibilidadeReferencias(cart);

  itemsContainer.replaceChildren();

  if (cart.length === 0) {
    const message = document.createElement("p");

    message.textContent =
      "A sua encomenda está vazia. Volte ao catálogo para escolher os produtos.";

    itemsContainer.append(message);

    totalElement.textContent =
      currencyFormatter.format(0);

    submitButton.disabled = true;

    return [];
  }

  cart.forEach((item) => {
    itemsContainer.append(
      createSummaryItem(item)
    );
  });

  const subtotalProdutos = calculateKnownTotal(cart);
  const desconto = calcularDescontoCupao(subtotalProdutos);

  actualizarLinhaDesconto(desconto, cart);

  totalElement.textContent = currencyFormatter.format(
    subtotalProdutos - desconto + (taxaEntregaActual ?? 0)
  );

  submitButton.disabled = isDelivery && !entregaVerificada;

  return cart;
}

function actualizarVisibilidadeReferencias(cart: CartItem[]): void {
  const campo = document.querySelector<HTMLElement>("[data-references-field]");
  if (!campo) return;

  const relevante = cart.some((item) =>
    CATEGORIAS_COM_REFERENCIA.includes(item.categorySlug)
  );

  campo.hidden = !relevante;

  // Com pack: aviso, observações obrigatórias e foto do bolo obrigatória.
  const comPack = temPack(cart);

  const aviso = document.querySelector<HTMLElement>("[data-pack-notice]");
  if (aviso) aviso.hidden = !comPack;

  const notas = document.querySelector<HTMLTextAreaElement>("[data-notes-input]");
  if (notas) {
    notas.required = comPack;
    notas.placeholder = comPack ? PLACEHOLDER_NOTAS_PACK : PLACEHOLDER_NOTAS;
  }

  const rotuloNotas = document.querySelector<HTMLElement>("[data-notes-label]");
  if (rotuloNotas) {
    rotuloNotas.textContent = comPack
      ? "Observações e personalização * (massa, recheio e sabores)"
      : "Observações e personalização";
  }

  const rotuloFotos = document.querySelector<HTMLElement>("[data-references-label]");
  if (rotuloFotos) {
    rotuloFotos.textContent = comPack
      ? "Fotos de referência * (pelo menos uma para o bolo do pack)"
      : "Fotos de referência (opcional)";
  }
}

function mostrarEstadoReferencia(texto: string, erro: boolean): void {
  const status = document.querySelector<HTMLElement>("[data-reference-status]");
  if (!status) return;

  status.hidden = texto === "";
  status.textContent = texto;
  status.classList.toggle("is-error", erro);
}

function renderizarReferencias(): void {
  const lista = document.querySelector<HTMLElement>("[data-reference-list]");
  if (!lista) return;

  lista.replaceChildren();

  imagensReferencia.forEach((referencia, indice) => {
    const chip = document.createElement("span");
    chip.className = "checkout-references__chip";

    const nome = document.createElement("span");
    nome.textContent = referencia.nome;

    const remover = document.createElement("button");
    remover.type = "button";
    remover.setAttribute("aria-label", `Remover ${referencia.nome}`);
    remover.textContent = "×";
    remover.addEventListener("click", () => {
      imagensReferencia.splice(indice, 1);
      renderizarReferencias();
    });

    chip.append(nome, remover);
    lista.append(chip);
  });
}

async function handleReferenceFiles(files: FileList): Promise<void> {
  const restantes = MAX_IMAGENS_REFERENCIA - imagensReferencia.length;

  if (restantes <= 0) {
    mostrarEstadoReferencia(
      `Pode enviar no máximo ${MAX_IMAGENS_REFERENCIA} fotos.`,
      true
    );
    return;
  }

  const ficheiros = Array.from(files).slice(0, restantes);

  for (const ficheiro of ficheiros) {
    if (ficheiro.size > 5 * 1024 * 1024) {
      mostrarEstadoReferencia(
        `"${ficheiro.name}" excede 5 MB e não foi enviada.`,
        true
      );
      continue;
    }

    mostrarEstadoReferencia(`A enviar ${ficheiro.name}…`, false);

    const caminho = await carregarImagemReferencia(ficheiro);

    if (!caminho) {
      mostrarEstadoReferencia(
        `Não foi possível enviar "${ficheiro.name}".`,
        true
      );
      continue;
    }

    imagensReferencia.push({ caminho, nome: ficheiro.name });
    renderizarReferencias();
  }

  mostrarEstadoReferencia("", false);
}

// ---------------------------------------------------------------------
// Cupão de desconto
// ---------------------------------------------------------------------

type EstadoCupao = "vazio" | "valido" | "invalido" | "indisponivel";

const MENSAGEM_CUPAO_PADRAO =
  `Com um cupão válido, os ${DESCONTO_CUPAO_PERCENTAGEM}% de desconto são aplicados ao total.`;

let estadoCupao: EstadoCupao = "vazio";
/** Código do cupão já confirmado como válido (o desconto só entra com ele). */
let cupaoAplicado: string | null = null;

/** Desconto sobre os produtos com preço conhecido (não inclui a entrega). */
function calcularDescontoCupao(subtotalProdutos: number): number {
  if (!cupaoAplicado || subtotalProdutos <= 0) return 0;
  return Math.round(subtotalProdutos * DESCONTO_CUPAO_PERCENTAGEM) / 100;
}

function actualizarLinhaDesconto(desconto: number, cart: CartItem[]): void {
  const linha = document.querySelector<HTMLElement>("[data-discount-line]");
  const rotulo = document.querySelector<HTMLElement>("[data-discount-label]");
  const valor = document.querySelector<HTMLElement>("[data-discount-value]");
  const nota = document.querySelector<HTMLElement>("[data-discount-note]");
  if (!linha || !rotulo || !valor) return;

  const temSobConsulta = cart.some((item) => getUnitPrice(item) === null);

  linha.hidden = !cupaoAplicado;

  if (nota) {
    nota.hidden = !cupaoAplicado || !temSobConsulta;
  }

  if (!cupaoAplicado) return;

  rotulo.textContent = `Cupão ${cupaoAplicado} (−${DESCONTO_CUPAO_PERCENTAGEM}%)`;
  valor.textContent = desconto > 0 ? `−${currencyFormatter.format(desconto)}` : "no orçamento";
}
let pedidoCupaoActual = 0;
let temporizadorCupao: number | undefined;

function mostrarEstadoCupao(texto: string, tipo: "" | "is-success" | "is-error"): void {
  const status = document.querySelector<HTMLElement>("[data-coupon-status]");
  if (!status) return;

  status.textContent = texto;
  status.classList.remove("is-success", "is-error");
  if (tipo) status.classList.add(tipo);
}

async function verificarCupao(): Promise<EstadoCupao> {
  const input = document.querySelector<HTMLInputElement>("[data-coupon-input]");
  const pedido = ++pedidoCupaoActual;
  const codigo = normalizarCupao(input?.value ?? "");

  if (!codigo) {
    estadoCupao = "vazio";
    cupaoAplicado = null;
    renderCheckoutSummary();
    mostrarEstadoCupao(MENSAGEM_CUPAO_PADRAO, "");
    return estadoCupao;
  }

  const email =
    document
      .querySelector<HTMLInputElement>('input[name="customerEmail"]')
      ?.value.trim() ?? "";

  if (!email) {
    estadoCupao = "invalido";
    cupaoAplicado = null;
    renderCheckoutSummary();
    mostrarEstadoCupao(
      "Preencha primeiro o seu email (o mesmo que usou na avaliação) para validar o cupão.",
      "is-error"
    );
    return estadoCupao;
  }

  mostrarEstadoCupao("A verificar o cupão…", "");

  const resultado = await validarCupao(codigo, email);

  // Ignora respostas de verificações antigas (o cliente continuou a escrever).
  if (pedido !== pedidoCupaoActual) {
    return estadoCupao;
  }

  if (resultado === true) {
    estadoCupao = "valido";
    cupaoAplicado = codigo;
    mostrarEstadoCupao(
      `Cupão ${codigo} aplicado ✓ ${DESCONTO_CUPAO_PERCENTAGEM}% de desconto.`,
      "is-success"
    );
  } else if (resultado === false) {
    estadoCupao = "invalido";
    cupaoAplicado = null;
    mostrarEstadoCupao(
      "Cupão não válido: confirme o código e use o mesmo email da avaliação. Cada cupão só pode ser usado uma vez e dentro do prazo de validade.",
      "is-error"
    );
  } else {
    estadoCupao = "indisponivel";
    cupaoAplicado = null;
    mostrarEstadoCupao(
      "Não foi possível verificar o cupão agora. Será confirmado ao enviar a encomenda.",
      ""
    );
  }

  renderCheckoutSummary();

  return estadoCupao;
}

function ligarCampoCupao(): void {
  const input = document.querySelector<HTMLInputElement>("[data-coupon-input]");
  if (!input || input.dataset.couponBound === "true") return;

  input.dataset.couponBound = "true";

  input.addEventListener("input", () => {
    estadoCupao = "vazio";

    if (cupaoAplicado) {
      cupaoAplicado = null;
      renderCheckoutSummary();
    }

    window.clearTimeout(temporizadorCupao);
    temporizadorCupao = window.setTimeout(() => {
      void verificarCupao();
    }, 700);
  });

  input.addEventListener("change", () => {
    window.clearTimeout(temporizadorCupao);
    void verificarCupao();
  });

  // O cupão está ligado ao email: se o email mudar, volta a verificar.
  document
    .querySelector<HTMLInputElement>('input[name="customerEmail"]')
    ?.addEventListener("change", () => {
      if (input.value.trim()) {
        window.clearTimeout(temporizadorCupao);
        void verificarCupao();
      }
    });
}

// Antecedência mínima divulgada na FAQ ("pelo menos 30 dias").
const DIAS_ANTECEDENCIA_MINIMA = 30;

function configureMinimumDate(): void {
  const dateInput =
    document.querySelector<HTMLInputElement>(
      'input[name="eventDate"]'
    );

  if (!dateInput) {
    return;
  }

  const dataMinima = new Date();
  dataMinima.setDate(dataMinima.getDate() + DIAS_ANTECEDENCIA_MINIMA);

  const localDate = new Date(
    dataMinima.getTime() -
    dataMinima.getTimezoneOffset() * 60_000
  );

  dateInput.min =
    localDate.toISOString().split("T")[0];
}

function updateDeliveryFields(): void {
  const selectedOption =
    document.querySelector<HTMLInputElement>(
      'input[name="fulfillmentType"]:checked'
    );

  const deliveryFields =
    document.querySelector<HTMLElement>(
      "[data-delivery-fields]"
    );

  if (!selectedOption || !deliveryFields) {
    return;
  }

  const isDelivery =
    selectedOption.value === "delivery";

  deliveryFields.hidden = !isDelivery;

  deliveryFields
    .querySelectorAll<HTMLInputElement>("input")
    .forEach((input) => {
      input.required = isDelivery;
    });

  updateScheduleField(isDelivery);
}

function updateScheduleField(isDelivery: boolean): void {
  const label =
    document.querySelector<HTMLElement>("[data-schedule-label]");

  const input =
    document.querySelector<HTMLInputElement>("[data-schedule-input]");

  const helper =
    document.querySelector<HTMLElement>("[data-schedule-helper]");

  if (!label || !input || !helper) {
    return;
  }

  if (isDelivery) {
    label.textContent = "Horário de entrega preferido";
    input.placeholder = "Ex: ao final da tarde, por volta das 18h...";
    helper.textContent =
      "O horário de entrega é sempre combinado consigo. Indique aqui a sua preferência e entraremos em contacto para confirmar.";
  } else {
    label.textContent = "Horário de recolha preferido";
    input.placeholder = "Ex: ao final da manhã, por volta das 15h...";
    helper.textContent =
      "Recolhas: seg a sex, 10h às 16h · sáb, dom e feriados, 10h às 12h. Vamos contactá-lo(a) para confirmar o horário exato.";
  }
}

function readTextValue(
  formData: FormData,
  fieldName: string
): string {
  const value = formData.get(fieldName);

  return typeof value === "string"
    ? value.trim()
    : "";
}


function toOrderItems(cart: CartItem[]): OrderItemInput[] {
  return cart.map((item) => ({
    slug: item.productSlug,
    nome: item.name,
    categoria: item.categorySlug,
    quantidade: item.quantity,
    preco: getUnitPrice(item),
    personalizacao:
      item.flavor || item.size
        ? {
            ...(item.flavor ? { sabor: item.flavor } : {}),
            ...(item.size ? { tamanho: item.size } : {})
          }
        : undefined
  }));
}


async function handleCheckoutSubmit(
  event: SubmitEvent
): Promise<void> {
  event.preventDefault();

  const form = event.currentTarget;

  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const cart = getCart();

  const submitButton =
    form.querySelector<HTMLButtonElement>("[data-checkout-submit]");

  const helper =
    form.querySelector<HTMLElement>("[data-checkout-helper]");

  if (cart.length === 0) {
    if (helper) {
      helper.textContent =
        "A encomenda está vazia. Adicione pelo menos um produto.";
    }
    return;
  }

  if (!form.reportValidity()) {
    return;
  }

  const formData = new FormData(form);

  const fulfillmentValue = readTextValue(formData, "fulfillmentType");
  const isDelivery = fulfillmentValue === "delivery";

  if (isDelivery && !entregaVerificada) {
    if (helper) {
      helper.textContent =
        "Confirme um código postal abrangido pela zona de entrega ou escolha levantamento.";
    }
    form.querySelector<HTMLInputElement>('input[name="postalCode"]')?.focus();
    return;
  }

  if (temPack(cart) && imagensReferencia.length === 0) {
    if (helper) {
      helper.textContent =
        "Para encomendas com pack, envie pelo menos uma foto de referência para o bolo.";
    }
    document
      .querySelector<HTMLElement>("[data-references-field]")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const cupao = normalizarCupao(readTextValue(formData, "cupao"));

  if (cupao && estadoCupao !== "valido" && estadoCupao !== "indisponivel") {
    window.clearTimeout(temporizadorCupao);

    if ((await verificarCupao()) === "invalido") {
      if (helper) {
        helper.textContent =
          "O cupão não é válido para este email ou já foi utilizado. Confirme ou deixe o campo vazio.";
      }
      form.querySelector<HTMLInputElement>("[data-coupon-input]")?.focus();
      return;
    }
  }

  // Bloqueia envios duplicados enquanto aguarda resposta
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "A enviar…";
  }

  if (helper) {
    helper.textContent = "A enviar a sua encomenda…";
  }

  const resultado = await criarEncomenda({
    clienteNome: readTextValue(formData, "customerName"),
    clienteTelefone: readTextValue(formData, "customerPhone"),
    clienteEmail: readTextValue(formData, "customerEmail"),
    metodoEntrega: isDelivery ? "entrega" : "levantamento",
    morada: isDelivery ? readTextValue(formData, "deliveryAddress") : "",
    codigoPostal: isDelivery ? readTextValue(formData, "postalCode") : "",
    localidade: isDelivery ? readTextValue(formData, "city") : "",
    dataEvento: readTextValue(formData, "eventDate"),
    tipoCelebracao: readTextValue(formData, "eventType"),
    observacoes: readTextValue(formData, "notes"),
    horarioPreferido: readTextValue(formData, "horarioPreferido"),
    itens: toOrderItems(cart),
    imagensReferencia: imagensReferencia.map((item) => item.caminho),
    cupao: cupao || undefined
  });

  if (!resultado.ok) {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Preparar pedido de encomenda";
    }

    if (helper) {
      helper.textContent = resultado.erro;
    }

    return;
  }

  clearCart();
  imagensReferencia = [];
  renderizarReferencias();

  if (submitButton) {
    submitButton.textContent = "Encomenda enviada ✓";
  }

  if (helper) {
    helper.textContent =
      `A sua encomenda foi registada com a referência ${resultado.referencia}. ` +
      "A Pali Cakes entrará em contacto para confirmar os detalhes e o orçamento.";
  }

  form
    .querySelectorAll<HTMLElement>(".checkout-form__section, .checkout-consent")
    .forEach((section) => {
      section.hidden = true;
    });
}

function initialiseCheckout(): void {
  const form =
    document.querySelector<HTMLFormElement>(
      "[data-checkout-form]"
    );

  if (!form) {
    return;
  }

  renderCheckoutSummary();
  configureMinimumDate();
  updateDeliveryFields();

  document
    .querySelectorAll<HTMLInputElement>(
      'input[name="fulfillmentType"]'
    )
    .forEach((option) => {
      option.addEventListener("change", () => {
        updateDeliveryFields();
        actualizarEntrega();
      });
    });

  document
    .querySelector<HTMLInputElement>('input[name="postalCode"]')
    ?.addEventListener("input", actualizarEntrega);

  ligarCampoCupao();

  const referenceInput = document.querySelector<HTMLInputElement>(
    "[data-reference-input]"
  );

  if (referenceInput && referenceInput.dataset.referenceBound !== "true") {
    referenceInput.dataset.referenceBound = "true";

    referenceInput.addEventListener("change", () => {
      if (referenceInput.files && referenceInput.files.length > 0) {
        void handleReferenceFiles(referenceInput.files).then(() => {
          referenceInput.value = "";
        });
      }
    });
  }

  if (form.dataset.checkoutBound !== "true") {
    form.dataset.checkoutBound = "true";

    form.addEventListener(
      "submit",
      handleCheckoutSubmit
    );
  }
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initialiseCheckout,
    { once: true }
  );
} else {
  initialiseCheckout();
}

document.addEventListener(
  "astro:page-load",
  initialiseCheckout
);
