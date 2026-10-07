import { supabase } from "@/lib/supabase";

/**
 * Fotos fixas das páginas, editáveis no admin (aba "Fotos do site").
 * Guardadas na tabela public.fotos_site (chave → url). Se a tabela não
 * existir ou falhar, o site usa estas fotos de origem.
 */
export const FOTOS_PADRAO = {
  "inicio-topo-1": "/images/hero/hero-bolo-flores.jpg",
  "inicio-topo-2": "/images/hero/hero-chocolates.jpg",
  "inicio-topo-3": "/images/hero/hero-cupcakes.jpg",
  "inicio-topo-4": "/images/hero/hero-bolo-frutos.jpg",
  "inicio-sobre-bruna": "/images/about/about-pali.JPG",
  "sobre-topo": "/images/about/about-pali.JPG",
  "sobre-bruna": "/images/about/about-bruna.jpg"
} as const;

export type ChaveFoto = keyof typeof FOTOS_PADRAO;

export interface FotoFixa {
  chave: ChaveFoto;
  /** Onde aparece (título da secção no admin). */
  secao: string;
  nome: string;
}

/** Ordem e nomes mostrados no admin. */
export const FOTOS_FIXAS: FotoFixa[] = [
  { chave: "inicio-topo-1", secao: "Página inicial — topo", nome: "Foto 1 (esquerda)" },
  { chave: "inicio-topo-2", secao: "Página inicial — topo", nome: "Foto 2" },
  { chave: "inicio-topo-3", secao: "Página inicial — topo", nome: "Foto 3" },
  { chave: "inicio-topo-4", secao: "Página inicial — topo", nome: "Foto 4 (direita)" },
  { chave: "inicio-sobre-bruna", secao: "Página inicial — Sobre a Bruna", nome: "Foto de fundo" },
  { chave: "sobre-topo", secao: "Página Sobre", nome: "Foto do topo" },
  { chave: "sobre-bruna", secao: "Página Sobre", nome: "Foto da Bruna" }
];

let pedido: Promise<Record<ChaveFoto, string>> | null = null;

async function lerFotos(): Promise<Record<ChaveFoto, string>> {
  const fotos: Record<ChaveFoto, string> = { ...FOTOS_PADRAO };

  const { data, error } = await supabase.from("fotos_site").select("chave, url");

  if (error) {
    console.warn("[getSitePhotos] a usar as fotos de origem:", error.message);
    return fotos;
  }

  for (const linha of (data ?? []) as { chave: string; url: string | null }[]) {
    if (linha.chave in fotos && typeof linha.url === "string" && linha.url.trim()) {
      fotos[linha.chave as ChaveFoto] = linha.url.trim();
    }
  }

  return fotos;
}

/** Fotos fixas do site (uma só leitura por build). */
export function getSitePhotos(): Promise<Record<ChaveFoto, string>> {
  pedido ??= lerFotos();
  return pedido;
}
