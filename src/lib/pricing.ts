/**
 * Preço por quantidade (escalões). Ex.: brigadeiros a 1,80 €/un., mas a
 * partir de 30 un. ficam a 1,70 €, a partir de 50 a 1,60 € e a partir de 80
 * a 1,50 €. O preço do escalão aplica-se a TODAS as unidades; abaixo do
 * primeiro escalão vale o preço normal do produto.
 *
 * Guardado em produtos.opcoes.precos_quantidade como
 * [{ "quantidade_minima": 30, "preco": 1.7 }, …]. O servidor (criar_encomenda)
 * aplica a mesma regra, por isso o total gravado é sempre o certo.
 *
 * Sem dependências do navegador: usado nas páginas (build) e nos scripts.
 */

export interface PriceTier {
  /** A partir de quantas unidades vale este preço. */
  min: number;
  /** Preço por unidade neste escalão. */
  price: number;
}

/** Quantidade máxima por produto numa encomenda (igual no servidor). */
export const QUANTIDADE_MAXIMA = 999;

/** Lê os escalões vindos da base de dados ou do carrinho, ignorando lixo. */
export function normalizePriceTiers(raw: unknown): PriceTier[] {
  if (!Array.isArray(raw)) return [];

  const tiers = raw
    .map((item): PriceTier | null => {
      if (typeof item !== "object" || item === null) return null;

      const registo = item as Record<string, unknown>;
      const min = Number(registo.min ?? registo.quantidade_minima);
      const price = Number(registo.price ?? registo.preco);

      if (!Number.isFinite(min) || min < 2 || !Number.isFinite(price) || price <= 0) {
        return null;
      }

      return { min: Math.min(QUANTIDADE_MAXIMA, Math.trunc(min)), price };
    })
    .filter((tier): tier is PriceTier => tier !== null)
    .sort((a, b) => a.min - b.min);

  // Um só escalão por quantidade (fica o último indicado).
  return tiers.filter((tier, indice) => tiers[indice + 1]?.min !== tier.min).slice(0, 10);
}

/** Escalão que se aplica a esta quantidade (null = preço normal). */
export function currentPriceTier(tiers: PriceTier[], quantity: number): PriceTier | null {
  let actual: PriceTier | null = null;

  for (const tier of tiers) {
    if (quantity >= tier.min) actual = tier;
  }

  return actual;
}

/** Próximo escalão, para sugerir "com X un. cada uma fica a Y €". */
export function nextPriceTier(tiers: PriceTier[], quantity: number): PriceTier | null {
  return tiers.find((tier) => tier.min > quantity) ?? null;
}

/** Preço por unidade para esta quantidade. */
export function unitPriceFor(
  basePrice: number | null,
  tiers: PriceTier[],
  quantity: number
): number | null {
  return currentPriceTier(tiers, quantity)?.price ?? basePrice;
}

/**
 * Linhas da tabela "Preço por quantidade", incluindo a faixa do preço
 * normal (do mínimo até ao primeiro escalão).
 */
export function priceTierRows(
  basePrice: number | null,
  tiers: PriceTier[],
  minQuantity: number
): { label: string; price: number | null; min: number }[] {
  if (tiers.length === 0) return [];

  const faixa = (de: number, ate: number | null): string =>
    ate === null ? `${de} ou mais` : de === ate ? `${de}` : `${de} a ${ate}`;

  const linhas: { label: string; price: number | null; min: number }[] = [];

  if (tiers[0].min > minQuantity) {
    linhas.push({ label: faixa(minQuantity, tiers[0].min - 1), price: basePrice, min: minQuantity });
  }

  tiers.forEach((tier, indice) => {
    const seguinte = tiers[indice + 1];
    linhas.push({
      label: faixa(Math.max(tier.min, minQuantity), seguinte ? seguinte.min - 1 : null),
      price: tier.price,
      min: tier.min
    });
  });

  return linhas;
}
