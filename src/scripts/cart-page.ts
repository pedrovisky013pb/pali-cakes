import {
  getCart,
  getUnitPrice,
  saveCart,
  type CartItem
} from "./cart";
import {
  QUANTIDADE_MAXIMA,
  currentPriceTier,
  nextPriceTier
} from "@/lib/pricing";

const currencyFormatter = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR"
});

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character] ?? character;
  });
}

function getItemHref(item: CartItem): string {
  const categorySlug = encodeURIComponent(item.categorySlug);
  const productSlug = encodeURIComponent(item.productSlug);

  return item.categorySlug === "packs-festa"
    ? `/packs-festa/${productSlug}`
    : `/catalogo/${categorySlug}/${productSlug}`;
}

function formatItemPrice(item: CartItem): string {
  const unitPrice = getUnitPrice(item);

  if (unitPrice === null) {
    return item.priceLabel;
  }

  return currencyFormatter.format(
    unitPrice * item.quantity
  );
}

/**
 * Linha do preço por quantidade (ex.: "50 un. × 1,60 € (preço por
 * quantidade)") e sugestão do escalão seguinte. Vazio nos outros produtos.
 */
function formatTierInfo(item: CartItem): string {
  if (item.priceTiers.length === 0) {
    return "";
  }

  const unitPrice = getUnitPrice(item);
  const tier = currentPriceTier(item.priceTiers, item.quantity);
  const next = nextPriceTier(item.priceTiers, item.quantity);

  const linhas: string[] = [];

  if (unitPrice !== null) {
    linhas.push(
      `${item.quantity} un. × ${currencyFormatter.format(unitPrice)}${
        tier ? " (preço por quantidade)" : ""
      }`
    );
  }

  if (next) {
    linhas.push(
      `A partir de ${next.min} un., cada uma fica a ${currencyFormatter.format(next.price)}.`
    );
  }

  return linhas
    .map((linha) => `<small class="cart-item__tier">${escapeHtml(linha)}</small>`)
    .join("");
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

function renderCartPage(): void {
  const cartLayout =
    document.querySelector<HTMLElement>("[data-cart-layout]");

  const cartList =
    document.querySelector<HTMLElement>("[data-cart-list]");

  const emptyState =
    document.querySelector<HTMLElement>("[data-cart-empty]");

  const itemsCount =
    document.querySelector<HTMLElement>(
      "[data-cart-items-count]"
    );

  const totalElement =
    document.querySelector<HTMLElement>("[data-cart-total]");

  const summaryNote =
    document.querySelector<HTMLElement>(
      "[data-cart-summary-note]"
    );

  if (
    !cartLayout ||
    !cartList ||
    !emptyState ||
    !itemsCount ||
    !totalElement ||
    !summaryNote
  ) {
    return;
  }

  const cart = getCart();

  if (cart.length === 0) {
    cartLayout.hidden = true;
    emptyState.hidden = false;
    cartList.innerHTML = "";
    return;
  }

  cartLayout.hidden = false;
  emptyState.hidden = true;

  cartList.innerHTML = cart
    .map((item) => {
      const href = escapeHtml(getItemHref(item));
      const id = escapeHtml(item.id);
      const name = escapeHtml(item.name);
      const image = escapeHtml(item.image);
      const price = escapeHtml(formatItemPrice(item));
      const eyebrow = item.flavor
        ? escapeHtml(item.flavor)
        : "Produto selecionado";

      return `
        <article
          class="cart-item"
          data-cart-item
          data-product-id="${id}"
        >
          <a
            href="${href}"
            class="cart-item__image"
          >
            <img
              src="${image}"
              alt="${name}"
            />
          </a>

          <div class="cart-item__content">
            <div>
              <span class="cart-item__eyebrow">
                ${eyebrow}
              </span>

              <h2>
                <a
                  href="${href}"
                >
                  ${name}
                </a>
              </h2>

              <strong class="cart-item__price">
                ${price}
              </strong>

              ${formatTierInfo(item)}

              ${
                item.minQuantity > 1
                  ? `<small class="cart-item__minimum">Mínimo de ${item.minQuantity} unidades</small>`
                  : ""
              }
            </div>

            <button
              type="button"
              class="cart-item__remove"
              data-cart-action="remove"
            >
              Remover
            </button>
          </div>

          <div
            class="cart-item__quantity"
            aria-label="Quantidade de ${name}"
          >
            <button
              type="button"
              aria-label="Diminuir quantidade"
              data-cart-action="decrease"
              ${item.minQuantity > 1 && item.quantity <= item.minQuantity ? "disabled" : ""}
            >
              −
            </button>

            <input
              type="number"
              inputmode="numeric"
              min="${item.minQuantity}"
              max="${QUANTIDADE_MAXIMA}"
              step="1"
              value="${item.quantity}"
              aria-label="Quantidade"
              data-cart-quantity-input
            />

            <button
              type="button"
              aria-label="Aumentar quantidade"
              data-cart-action="increase"
              ${item.quantity >= QUANTIDADE_MAXIMA ? "disabled" : ""}
            >
              +
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  const quantity = cart.reduce(
    (total, item) => total + item.quantity,
    0
  );

  itemsCount.textContent = String(quantity);

  totalElement.textContent = currencyFormatter.format(
    calculateKnownTotal(cart)
  );

  const hasItemsUnderQuote = cart.some(
    (item) => getUnitPrice(item) === null
  );

  summaryNote.textContent = hasItemsUnderQuote
    ? "Os produtos sob consulta serão orçamentados pela Pali Cakes. O total apresentado inclui apenas os itens com preço definido."
    : "O valor final será confirmado pela Pali Cakes após a análise dos detalhes da encomenda.";
}

function handleCartAction(event: MouseEvent): void {
  const target = event.target as HTMLElement;

  const button = target.closest<HTMLButtonElement>(
    "[data-cart-action]"
  );

  if (!button) {
    return;
  }

  const cartItem = button.closest<HTMLElement>(
    "[data-cart-item]"
  );

  const productId = cartItem?.dataset.productId;
  const action = button.dataset.cartAction;

  if (!productId || !action) {
    return;
  }

  const cart = getCart();

  const itemIndex = cart.findIndex(
    (item) => item.id === productId
  );

  if (itemIndex === -1) {
    return;
  }

  if (action === "increase") {
    cart[itemIndex].quantity += 1;
  }

  if (action === "decrease") {
    const minimo = cart[itemIndex].minQuantity;

    if (cart[itemIndex].quantity > minimo) {
      cart[itemIndex].quantity -= 1;
    } else if (minimo <= 1) {
      cart.splice(itemIndex, 1);
    }
    // Com mínimo > 1, não desce abaixo dele; para retirar usa-se "Remover".
  }

  if (action === "increase") {
    cart[itemIndex].quantity = Math.min(QUANTIDADE_MAXIMA, cart[itemIndex].quantity);
  }

  if (action === "remove") {
    cart.splice(itemIndex, 1);
  }

  saveCart(cart);
  renderCartPage();
}

/** Quantidade escrita à mão (útil em produtos com muitas unidades). */
function handleQuantityInput(event: Event): void {
  const input = event.target;

  if (
    !(input instanceof HTMLInputElement) ||
    !input.matches("[data-cart-quantity-input]")
  ) {
    return;
  }

  const productId =
    input.closest<HTMLElement>("[data-cart-item]")?.dataset.productId;

  if (!productId) {
    return;
  }

  const cart = getCart();
  const item = cart.find((cartItem) => cartItem.id === productId);

  if (!item) {
    return;
  }

  const valor = Math.trunc(Number(input.value));

  item.quantity = Math.min(
    QUANTIDADE_MAXIMA,
    Math.max(item.minQuantity, Number.isFinite(valor) ? valor : item.minQuantity)
  );

  saveCart(cart);
  renderCartPage();
}

function initialiseCartPage(): void {
  const cartList =
    document.querySelector<HTMLElement>("[data-cart-list]");

  if (!cartList) {
    return;
  }

  cartList.addEventListener("click", handleCartAction);
  cartList.addEventListener("change", handleQuantityInput);
  renderCartPage();
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initialiseCartPage,
    { once: true }
  );
} else {
  initialiseCartPage();
}
