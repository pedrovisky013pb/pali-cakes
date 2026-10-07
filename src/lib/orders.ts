import { supabase } from "@/lib/supabase";
import type { Personalizacao } from "@/types/database";

export interface OrderItemInput {
  slug: string;
  nome: string;
  categoria: string;
  quantidade: number;
  preco: number | null;
  personalizacao?: Personalizacao;
}

export interface OrderInput {
  clienteNome: string;
  clienteTelefone: string;
  clienteEmail: string;
  metodoEntrega: "levantamento" | "entrega";
  morada: string;
  codigoPostal: string;
  localidade: string;
  dataEvento: string;
  tipoCelebracao: string;
  observacoes: string;
  horarioPreferido: string;
  itens: OrderItemInput[];
  /** Caminhos (no bucket privado "encomendas-referencias") das fotos de referência enviadas pelo cliente. */
  imagensReferencia?: string[];
  /** Cupão de desconto (ex.: PALI07), já validado no checkout. */
  cupao?: string;
}

/**
 * Desconto dos cupões das avaliações. Tem de coincidir com o valor em
 * public.definicoes_lancamento.cupao_desconto_percentagem (é o servidor que
 * grava o desconto final na encomenda).
 */
export const DESCONTO_CUPAO_PERCENTAGEM = 6;

/** Normaliza o código escrito pelo cliente (espaços e minúsculas). */
export function normalizarCupao(codigo: string): string {
  return codigo.replace(/\s+/g, "").toUpperCase();
}

/**
 * Confirma se o cupão pode ser usado por este email (existe, pertence à
 * avaliação feita com este email, está no prazo e ainda não foi usado).
 * Devolve null se não foi possível verificar (ex.: falha de rede).
 */
export async function validarCupao(
  codigo: string,
  email: string
): Promise<boolean | null> {
  const { data, error } = await (supabase.rpc as any)("validar_cupao", {
    p_cupao: normalizarCupao(codigo),
    p_email: email.trim()
  });

  if (error) {
    console.error("[validarCupao]", error.message);
    return null;
  }

  return data === true;
}

export type OrderResult =
  | { ok: true; referencia: string }
  | { ok: false; erro: string };

const REFERENCE_BUCKET = "encomendas-referencias";

/**
 * Carrega uma foto de referência/inspiração enviada pelo cliente no checkout.
 * O bucket é privado — devolve apenas o caminho do ficheiro (não um URL),
 * que fica guardado na encomenda para o admin ver mais tarde com um link
 * temporário.
 */
export async function carregarImagemReferencia(
  ficheiro: File
): Promise<string | null> {
  const extensao = ficheiro.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const sufixo = Math.random().toString(36).slice(2, 8);
  const caminho = `ref-${Date.now()}-${sufixo}.${extensao}`;

  const { error } = await supabase.storage
    .from(REFERENCE_BUCKET)
    .upload(caminho, ficheiro, {
      cacheControl: "3600",
      upsert: false
    });

  if (error) {
    console.error("[carregarImagemReferencia]", error.message);
    return null;
  }

  return caminho;
}

export async function criarEncomenda(
  input: OrderInput
): Promise<OrderResult> {
  const { data, error } = await (supabase.rpc as any)("criar_encomenda", {
    p_cliente_nome: input.clienteNome,
    p_cliente_telefone: input.clienteTelefone,
    p_cliente_email: input.clienteEmail || null,
    p_metodo_entrega: input.metodoEntrega,
    p_morada: input.morada || null,
    p_codigo_postal: input.codigoPostal || null,
    p_localidade: input.localidade || null,
    p_data_evento: input.dataEvento || null,
    p_tipo_celebracao: input.tipoCelebracao || null,
    p_observacoes: input.observacoes || null,
    p_itens: input.itens,
    p_horario_preferido: input.horarioPreferido || null,
    p_imagens_referencia: input.imagensReferencia ?? [],
    p_cupao: input.cupao ? normalizarCupao(input.cupao) : null
  });

  if (error) {
    console.error("[criarEncomenda]", error.message);

    if (
      error.message.includes("Cupão inválido") ||
      error.message.includes("encomendas_cupao_uso_unico")
    ) {
      return {
        ok: false,
        erro: "O cupão não é válido para este email ou já foi utilizado. Confirme o código e o email usado na avaliação, ou deixe o campo vazio."
      };
    }

    return {
      ok: false,
      erro: "Não foi possível enviar a encomenda. Tente novamente ou contacte-nos diretamente."
    };
  }

  const referencia = data as string;

  // Aviso por email é "melhor esforço": a encomenda já está gravada,
  // por isso uma falha aqui não deve impedir a confirmação ao cliente.
  notificarEncomendaNova(referencia, input).catch((notificationError) => {
    console.error("[notificarEncomendaNova]", notificationError);
  });

  return { ok: true, referencia };
}

async function notificarEncomendaNova(
  referencia: string,
  input: OrderInput
): Promise<void> {
  const { error } = await supabase.functions.invoke("order-notification", {
    body: {
      referencia,
      clienteNome: input.clienteNome,
      clienteTelefone: input.clienteTelefone,
      clienteEmail: input.clienteEmail,
      metodoEntrega: input.metodoEntrega,
      morada: input.morada,
      codigoPostal: input.codigoPostal,
      localidade: input.localidade,
      dataEvento: input.dataEvento,
      tipoCelebracao: input.tipoCelebracao,
      observacoes: input.observacoes,
      horarioPreferido: input.horarioPreferido,
      cupao: input.cupao ? normalizarCupao(input.cupao) : "",
      descontoPercentagem: input.cupao ? DESCONTO_CUPAO_PERCENTAGEM : 0,
      fotosReferencia: input.imagensReferencia?.length ?? 0,
      itens: input.itens
    }
  });

  if (error) {
    console.error("[notificarEncomendaNova]", error.message);
  }
}