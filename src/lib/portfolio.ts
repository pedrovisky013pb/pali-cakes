import { supabase } from "@/lib/supabase";
import { portfolioItems as portfolioDeOrigem, type PortfolioItem } from "@/data/portfolio";

/** Linha da tabela public.portfolio (gerida no admin, aba "Fotos do site"). */
export interface PortfolioRow {
  id: string;
  titulo: string;
  categoria: string;
  imagem_url: string;
  alt: string | null;
  destaque: boolean;
  ativo: boolean;
  ordem: number;
}

/**
 * Ordena os trabalhos agrupados por categoria (as categorias pela ordem do
 * seu primeiro trabalho) e, dentro de cada uma, pela ordem. Assim um
 * trabalho novo fica junto dos da mesma categoria e o separador da grelha
 * não se repete.
 */
export function ordenarPortfolio<T extends { categoria: string; ordem: number }>(itens: T[]): T[] {
  const primeiraOrdem = new Map<string, number>();

  for (const item of itens) {
    const actual = primeiraOrdem.get(item.categoria);
    if (actual === undefined || item.ordem < actual) {
      primeiraOrdem.set(item.categoria, item.ordem);
    }
  }

  return [...itens].sort(
    (a, b) =>
      (primeiraOrdem.get(a.categoria) ?? 0) - (primeiraOrdem.get(b.categoria) ?? 0) ||
      a.categoria.localeCompare(b.categoria) ||
      a.ordem - b.ordem
  );
}

/**
 * Trabalhos ativos do Portfólio. Lê da base de dados; se a tabela ainda não
 * existir ou a leitura falhar, usa a lista de origem (src/data/portfolio.ts).
 */
export async function getPortfolioItems(): Promise<PortfolioItem[]> {
  const { data, error } = await supabase
    .from("portfolio")
    .select("id, titulo, categoria, imagem_url, alt, destaque, ativo, ordem")
    .eq("ativo", true);

  if (error || !data) {
    console.warn("[getPortfolioItems] a usar o portfólio de origem:", error?.message);
    return portfolioDeOrigem.filter((item) => item.active);
  }

  return ordenarPortfolio(data as PortfolioRow[])
    .filter((linha) => linha.titulo?.trim() && linha.imagem_url?.trim())
    .map((linha) => ({
      id: linha.id,
      title: linha.titulo.trim(),
      category: linha.categoria.trim() || "Outros",
      image: linha.imagem_url.trim(),
      alt: linha.alt?.trim() || `${linha.titulo.trim()} — criação da Pali Cakes`,
      featured: linha.destaque,
      active: linha.ativo
    }));
}
