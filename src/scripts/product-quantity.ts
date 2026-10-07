/**
 * Seletor de quantidade na página do produto. Começa na quantidade mínima
 * do produto e não deixa descer abaixo dela; o valor escolhido vai para o
 * botão "Adicionar à encomenda".
 *
 * O mínimo é lido do atributo `min` do campo a cada alteração, para que a
 * troca de tamanho (product-sizes.ts) possa mudá-lo.
 *
 * Em produtos com preço por quantidade (ex.: brigadeiros), atualiza também o
 * preço por unidade mostrado, a linha ativa da tabela e a nota com o total.
 */

import {
  QUANTIDADE_MAXIMA,
  currentPriceTier,
  nextPriceTier,
  normalizePriceTiers
} from "@/lib/pricing";

const euro = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR"
});

function lerEscaloes(): ReturnType<typeof normalizePriceTiers> {
  const tabela = document.querySelector<HTMLElement>("[data-price-tiers]");
  if (!tabela?.dataset.priceTiers) return [];

  try {
    return normalizePriceTiers(JSON.parse(tabela.dataset.priceTiers));
  } catch {
    return [];
  }
}

function actualizarPrecoPorQuantidade(quantidade: number): void {
  const escaloes = lerEscaloes();
  if (escaloes.length === 0) return;

  const addToCartButton = document.querySelector<HTMLButtonElement>("[data-add-to-cart]");
  const precoBaseTexto = addToCartButton?.dataset.productPrice ?? "";
  const precoBase =
    precoBaseTexto.trim() !== "" && Number(precoBaseTexto) > 0 ? Number(precoBaseTexto) : null;

  const escalao = currentPriceTier(escaloes, quantidade);
  const precoUnidade = escalao?.price ?? precoBase;

  const precoMostrado = document.querySelector<HTMLElement>("[data-price-display]");
  if (precoMostrado) {
    precoMostrado.textContent =
      precoUnidade !== null
        ? `${euro.format(precoUnidade)} / un.`
        : precoMostrado.dataset.priceLabel || "Sob consulta";
  }

  // Linha ativa da tabela: a de maior "a partir de" que já se atingiu.
  const linhas = Array.from(document.querySelectorAll<HTMLElement>("[data-tier-row]"));
  const activa = linhas
    .filter((linha) => quantidade >= Number(linha.dataset.tierMin))
    .pop();

  linhas.forEach((linha) => linha.classList.toggle("is-active", linha === activa));

  const nota = document.querySelector<HTMLElement>("[data-tier-note]");
  if (!nota) return;

  const partes: string[] = [];

  if (precoUnidade !== null) {
    partes.push(
      `${quantidade} un. × ${euro.format(precoUnidade)} = ${euro.format(precoUnidade * quantidade)}.`
    );
  }

  const seguinte = nextPriceTier(escaloes, quantidade);
  if (seguinte) {
    partes.push(
      `A partir de ${seguinte.min} un., cada uma fica a ${euro.format(seguinte.price)}.`
    );
  }

  nota.textContent = partes.join(" ");
  nota.hidden = partes.length === 0;
}

function bindQuantityPicker(): void {
  const picker = document.querySelector<HTMLElement>("[data-quantity-picker]");
  if (!picker || picker.dataset.quantityBound === "true") return;

  picker.dataset.quantityBound = "true";

  const input = picker.querySelector<HTMLInputElement>("[data-quantity-input]");
  const diminuir = picker.querySelector<HTMLButtonElement>("[data-quantity-decrease]");
  const aumentar = picker.querySelector<HTMLButtonElement>("[data-quantity-increase]");
  const nota = picker.querySelector<HTMLElement>("[data-minimum-note]");
  const notaValor = picker.querySelector<HTMLElement>("[data-minimum-value]");
  const addToCartButton = document.querySelector<HTMLButtonElement>("[data-add-to-cart]");

  if (!input) return;

  const aplicar = (valor: number): void => {
    const minimo = Math.max(1, Math.trunc(Number(input.min) || 1));
    const quantidade = Math.min(
      QUANTIDADE_MAXIMA,
      Math.max(minimo, Number.isFinite(valor) ? Math.trunc(valor) : minimo)
    );

    input.value = String(quantidade);

    if (diminuir) diminuir.disabled = quantidade <= minimo;
    if (aumentar) aumentar.disabled = quantidade >= QUANTIDADE_MAXIMA;

    if (nota) nota.hidden = minimo <= 1;
    if (notaValor) notaValor.textContent = String(minimo);

    if (addToCartButton) {
      addToCartButton.dataset.productQuantity = String(quantidade);
      addToCartButton.dataset.productMinQuantity = String(minimo);
    }

    actualizarPrecoPorQuantidade(quantidade);
  };

  diminuir?.addEventListener("click", () => aplicar(Number(input.value) - 1));
  aumentar?.addEventListener("click", () => aplicar(Number(input.value) + 1));
  input.addEventListener("change", () => aplicar(Number(input.value)));

  aplicar(Number(input.value));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindQuantityPicker, { once: true });
} else {
  bindQuantityPicker();
}

document.addEventListener("astro:page-load", bindQuantityPicker);
