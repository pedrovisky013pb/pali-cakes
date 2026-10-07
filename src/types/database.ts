export type EstadoEncomenda =
  | "novo"
  | "confirmado"
  | "em_producao"
  | "pronto"
  | "entregue"
  | "cancelado";

export type MetodoEntrega = "levantamento" | "entrega";

/** Uma opção de sabor de um produto, com a sua própria foto. */
export interface VarianteSabor {
  nome: string;
  imagem: string;
  /** Preço próprio do sabor (opcional). Vazio = usa o preço do produto. */
  preco?: number | null;
}

/**
 * Um grupo de variantes com várias opções (ex: "Tipo de massa" com
 * Chocolate/Baunilha/Red Velvet). Ao contrário do sabor, não tem foto —
 * a imagem do produto não muda consoante a escolha.
 */
export interface GrupoVariante {
  nome: string;
  opcoes: string[];
}

/**
 * Tamanho do produto com preço e quantidade mínima próprios (ex.: brownie
 * Mini / Normal / Inteiro). É a única variante que altera o preço.
 */
export interface VarianteTamanho {
  nome: string;
  /** null = sob consulta. */
  preco: number | null;
  quantidade_minima: number;
  /** Foto do tamanho (opcional); troca a foto principal ao ser escolhido. */
  imagem?: string;
}

/**
 * Preço por quantidade: a partir de `quantidade_minima` unidades, todas as
 * unidades passam a custar `preco` (ex.: brigadeiros 30+ a 1,70 €).
 */
export interface EscalaoPreco {
  quantidade_minima: number;
  preco: number;
}

/** Formato usado dentro da coluna jsonb `produtos.opcoes`. */
export interface OpcoesProduto {
  sabores?: VarianteSabor[];
  grupos_variantes?: GrupoVariante[];
  tamanhos?: VarianteTamanho[];
  /** Preço por quantidade (escalões), do menor para o maior. */
  precos_quantidade?: EscalaoPreco[];
  /** Conteúdo de um pack, uma linha por item ("Bolo — 1 kg"). */
  conteudo?: string[];
  [chave: string]: unknown;
}

export interface Categoria {
  id: string;
  slug: string;
  nome: string;
  grupo: string | null;
  descricao: string | null;
  imagem_url: string | null;
  href: string;
  preco: number | null;
  preco_label: string;
  destaque: boolean;
  ativa: boolean;
  ordem: number;
  criado_em: string;
}

export interface Produto {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  categoria_slug: string;
  imagem_url: string | null;
  imagens: string[];
  preco: number | null;
  preco_label: string;
  destaque: boolean;
  ativo: boolean;
  ordem: number;
  opcoes: OpcoesProduto;
  /** Quantidade mínima por encomenda (1 = sem mínimo). */
  quantidade_minima: number;
  criado_em: string;
  atualizado_em: string;
}

export interface Encomenda {
  id: string;
  referencia: string;
  criado_em: string;
  estado: EstadoEncomenda;
  cliente_nome: string;
  cliente_telefone: string;
  cliente_email: string | null;
  metodo_entrega: MetodoEntrega;
  morada: string | null;
  codigo_postal: string | null;
  localidade: string | null;
  data_evento: string | null;
  observacoes: string | null;
  total_estimado: number | null;
  imagens_referencia: string[];
  cupao: string | null;
  desconto_percentagem: number | null;
  desconto_valor: number | null;
}

export interface Personalizacao {
  sabor?: string;
  tamanho?: string;
  [chave: string]: unknown;
}

export interface EncomendaItem {
  id: string;
  encomenda_id: string;
  produto_slug: string;
  produto_nome: string;
  categoria: string | null;
  quantidade: number;
  preco_unitario: number | null;
  personalizacao: Personalizacao;
}

export interface OrderItemPayload {
  slug: string;
  nome: string;
  categoria: string;
  quantidade: number;
  preco: number | null;
  personalizacao?: Personalizacao;
}

export interface Encomenda {
  id: string;
  referencia: string;
  criado_em: string;
  estado: EstadoEncomenda;
  cliente_nome: string;
  cliente_telefone: string;
  cliente_email: string | null;
  metodo_entrega: MetodoEntrega;
  morada: string | null;
  codigo_postal: string | null;
  localidade: string | null;
  data_evento: string | null;
  tipo_celebracao: string | null;
  observacoes: string | null;
  total_estimado: number | null;
}

// Estrutura que o Supabase espera para tipar as queries
export interface Database {
  public: {
    Functions: {
      criar_encomenda: {
        Args: {
          p_cliente_nome: string;
          p_cliente_telefone: string;
          p_cliente_email: string | null;
          p_metodo_entrega: string;
          p_morada: string | null;
          p_codigo_postal: string | null;
          p_localidade: string | null;
          p_data_evento: string | null;
          p_tipo_celebracao: string | null;
          p_observacoes: string | null;
          p_itens: OrderItemPayload[];
          p_horario_preferido?: string | null;
          p_imagens_referencia?: string[];
          p_cupao?: string | null;
        };
        Returns: string;
      };
    };
    Tables: {
      categorias: {
        Row: Categoria;
        Insert: Omit<Categoria, "id" | "criado_em">;
        Update: Partial<Categoria>;
      };
      produtos: {
        Row: Produto;
        Insert: Omit<Produto, "id" | "criado_em" | "atualizado_em">;
        Update: Partial<Produto>;
      };
      encomendas: {
        Row: Encomenda;
        Insert: Omit<Encomenda, "id" | "referencia" | "criado_em" | "estado">;
        Update: Partial<Encomenda>;
      };
      encomenda_itens: {
        Row: EncomendaItem;
        Insert: Omit<EncomendaItem, "id">;
        Update: Partial<EncomendaItem>;
      };
    };
  };
}
