import { supabase } from "@/lib/supabase";
import type { PortfolioRow } from "@/lib/portfolio";

/** Fotos fixas guardadas (chave → url). As que faltam usam a foto de origem. */
export async function listarFotosSite(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("fotos_site").select("chave, url");

  if (error) {
    console.error("[listarFotosSite]", error.message);
    return {};
  }

  return Object.fromEntries(
    ((data ?? []) as { chave: string; url: string }[]).map((linha) => [linha.chave, linha.url])
  );
}

export async function guardarFotoSite(chave: string, url: string): Promise<boolean> {
  const { error } = await supabase
    .from("fotos_site")
    .upsert({ chave, url, atualizado_em: new Date().toISOString() });

  if (error) {
    console.error("[guardarFotoSite]", error.message);
    return false;
  }

  return true;
}

export interface CategoriaCarrossel {
  slug: string;
  nome: string;
  imagem_url: string;
}

/**
 * Categorias que aparecem no carrossel da página inicial: ativas, em destaque
 * e com pelo menos um produto ativo (a mesma regra do site). "packs" conta
 * com os produtos da categoria "packs-festa".
 */
export async function listarCategoriasCarrossel(): Promise<CategoriaCarrossel[]> {
  const [categorias, produtos] = await Promise.all([
    supabase
      .from("categorias")
      .select("slug, nome, imagem_url, destaque, ativa, ordem")
      .eq("ativa", true)
      .eq("destaque", true)
      .order("ordem"),
    supabase.from("produtos").select("categoria_slug").eq("ativo", true)
  ]);

  if (categorias.error || produtos.error) {
    console.error(
      "[listarCategoriasCarrossel]",
      categorias.error?.message ?? produtos.error?.message
    );
    return [];
  }

  const comProdutos = new Set(
    ((produtos.data ?? []) as { categoria_slug: string }[]).map((produto) =>
      produto.categoria_slug === "packs-festa" ? "packs" : produto.categoria_slug
    )
  );

  return ((categorias.data ?? []) as CategoriaCarrossel[]).filter((categoria) =>
    comProdutos.has(categoria.slug)
  );
}

export async function guardarFotoCategoria(slug: string, url: string): Promise<boolean> {
  const { error } = await supabase
    .from("categorias")
    .update({ imagem_url: url })
    .eq("slug", slug);

  if (error) {
    console.error("[guardarFotoCategoria]", error.message);
    return false;
  }

  return true;
}

/** Todos os trabalhos do Portfólio, incluindo os escondidos. */
export async function listarPortfolioAdmin(): Promise<PortfolioRow[]> {
  const { data, error } = await supabase
    .from("portfolio")
    .select("id, titulo, categoria, imagem_url, alt, destaque, ativo, ordem")
    .order("ordem");

  if (error) {
    console.error("[listarPortfolioAdmin]", error.message);
    return [];
  }

  return (data ?? []) as PortfolioRow[];
}

export type TrabalhoEdicao = Partial<Omit<PortfolioRow, "id">>;

export async function actualizarTrabalho(id: string, campos: TrabalhoEdicao): Promise<boolean> {
  const { error } = await supabase.from("portfolio").update(campos).eq("id", id);

  if (error) {
    console.error("[actualizarTrabalho]", error.message);
    return false;
  }

  return true;
}

export async function criarTrabalho(
  campos: Omit<PortfolioRow, "id">
): Promise<PortfolioRow | null> {
  const { data, error } = await supabase
    .from("portfolio")
    .insert(campos)
    .select("id, titulo, categoria, imagem_url, alt, destaque, ativo, ordem")
    .single();

  if (error) {
    console.error("[criarTrabalho]", error.message);
    return null;
  }

  return data as PortfolioRow;
}

export async function eliminarTrabalho(id: string): Promise<boolean> {
  const { error } = await supabase.from("portfolio").delete().eq("id", id);

  if (error) {
    console.error("[eliminarTrabalho]", error.message);
    return false;
  }

  return true;
}
