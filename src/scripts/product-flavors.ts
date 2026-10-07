function selectFlavor(
  option: HTMLButtonElement,
  allOptions: HTMLButtonElement[],
  productImage: HTMLImageElement | null,
  addToCartButton: HTMLButtonElement | null
): void {
  const flavorName = option.dataset.flavorName ?? "";
  const flavorImage = option.dataset.flavorImage ?? "";

  allOptions.forEach((otherOption) => {
    const isSelected = otherOption === option;

    otherOption.classList.toggle("is-selected", isSelected);
    otherOption.setAttribute(
      "aria-pressed",
      isSelected ? "true" : "false"
    );
  });

  if (productImage && flavorImage) {
    productImage.src = flavorImage;
    productImage.alt = flavorName || productImage.alt;
  }

  if (addToCartButton) {
    addToCartButton.dataset.productFlavor = flavorName
      ? `Sabor: ${flavorName}`
      : "";

    if (flavorImage) {
      addToCartButton.dataset.productImage = flavorImage;
    }
  }

  aplicarPrecoDoSabor(option, addToCartButton);
}

const euroSabor = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR"
});

/**
 * Sabores com preço próprio (ex.: Hambúrguer Dubai). Se o produto tiver
 * tamanhos com preço, é o tamanho que manda no preço e isto não faz nada.
 */
function aplicarPrecoDoSabor(
  option: HTMLButtonElement,
  addToCartButton: HTMLButtonElement | null
): void {
  if (document.querySelector("[data-size-group]")) return;

  const precoMostrado = document.querySelector<HTMLElement>("[data-price-display]");
  if (!precoMostrado) return;

  const precoSabor = Number(option.dataset.flavorPrice);
  const precoBase = Number(precoMostrado.dataset.basePrice);

  const preco =
    option.dataset.flavorPrice && Number.isFinite(precoSabor) && precoSabor > 0
      ? precoSabor
      : precoMostrado.dataset.basePrice && Number.isFinite(precoBase) && precoBase > 0
        ? precoBase
        : null;

  precoMostrado.textContent =
    preco !== null ? euroSabor.format(preco) : precoMostrado.dataset.priceLabel || "Sob consulta";

  if (addToCartButton) {
    addToCartButton.dataset.productPrice = preco !== null ? String(preco) : "";
  }

  // Produtos com preço por quantidade: recalcula o preço por unidade.
  if (document.querySelector("[data-price-tiers]")) {
    document
      .querySelector<HTMLInputElement>("[data-quantity-input]")
      ?.dispatchEvent(new Event("change"));
  }
}

function bindFlavorSelectors(): void {
  document
    .querySelectorAll<HTMLElement>("[data-flavor-group]")
    .forEach((group) => {
      if (group.dataset.flavorBound === "true") {
        return;
      }

      group.dataset.flavorBound = "true";

      const options = Array.from(
        group.querySelectorAll<HTMLButtonElement>("[data-flavor-option]")
      );

      const productImage = document.querySelector<HTMLImageElement>(
        "[data-product-image-display]"
      );

      const addToCartButton = document.querySelector<HTMLButtonElement>(
        "[data-add-to-cart]"
      );

      options.forEach((option) => {
        option.addEventListener("click", () => {
          selectFlavor(option, options, productImage, addToCartButton);
        });
      });

      // Setas sobre a foto: avançam/recuam entre os sabores, tal como
      // clicar directamente num dos botões com o nome do sabor.
      const imageWrapper = productImage?.closest(
        ".product-detail__image"
      );
      const prevButton = imageWrapper?.querySelector<HTMLButtonElement>(
        "[data-flavor-prev]"
      );
      const nextButton = imageWrapper?.querySelector<HTMLButtonElement>(
        "[data-flavor-next]"
      );

      if (options.length > 1 && (prevButton || nextButton)) {
        const irPara = (deslocamento: number): void => {
          const indiceActual = options.findIndex((option) =>
            option.classList.contains("is-selected")
          );
          const base = indiceActual === -1 ? 0 : indiceActual;
          const proximoIndice =
            (base + deslocamento + options.length) % options.length;

          selectFlavor(
            options[proximoIndice],
            options,
            productImage,
            addToCartButton
          );
        };

        prevButton?.addEventListener("click", () => irPara(-1));
        nextButton?.addEventListener("click", () => irPara(1));
      }
    });
}

function initialiseProductFlavors(): void {
  bindFlavorSelectors();
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initialiseProductFlavors,
    { once: true }
  );
} else {
  initialiseProductFlavors();
}

document.addEventListener(
  "astro:page-load",
  initialiseProductFlavors
);
