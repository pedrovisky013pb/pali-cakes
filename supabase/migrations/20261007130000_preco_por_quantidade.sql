begin;

-- =====================================================================
-- Preço por quantidade (escalões)
-- =====================================================================
-- opcoes.precos_quantidade = [{ "quantidade_minima": 30, "preco": 1.7 }, …]
-- A partir de X unidades, TODAS as unidades passam a custar o preço do
-- escalão. Abaixo do primeiro escalão vale o preço normal do produto.
-- Editável no admin (Produtos → "Preço por quantidade").
-- =====================================================================

-- Brigadeiros: 12 a 29 un. preço normal (1,80 €); 30 a 49 → 1,70 €;
-- 50 a 79 → 1,60 €; 80 ou mais → 1,50 €.
update public.produtos
   set opcoes = coalesce(opcoes, '{}'::jsonb)
       || jsonb_build_object(
         'precos_quantidade',
         '[
           {"quantidade_minima": 30, "preco": 1.70},
           {"quantidade_minima": 50, "preco": 1.60},
           {"quantidade_minima": 80, "preco": 1.50}
         ]'::jsonb
       )
 where slug = 'brigadeiros';

-- criar_encomenda: igual à anterior, mas o servidor aplica o preço do
-- escalão (o total gravado fica certo mesmo com um carrinho antigo).
create or replace function public.criar_encomenda(
  p_cliente_nome text,
  p_cliente_telefone text,
  p_cliente_email text,
  p_metodo_entrega text,
  p_morada text,
  p_codigo_postal text,
  p_localidade text,
  p_data_evento date,
  p_tipo_celebracao text,
  p_observacoes text,
  p_itens jsonb,
  p_horario_preferido text default null,
  p_imagens_referencia jsonb default '[]'::jsonb,
  p_cupao text default null
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id         uuid;
  v_ref        text;
  v_item       jsonb;
  v_total      numeric := 0;
  v_cupao      text := nullif(upper(trim(coalesce(p_cupao, ''))), '');
  v_percentual numeric;
  v_desconto   numeric;
  v_minimo     integer;
  v_quantidade integer;
  v_preco      numeric;
  v_escalao    numeric;
begin
  if coalesce(trim(p_cliente_nome), '') = '' then
    raise exception 'O nome é obrigatório.';
  end if;

  if coalesce(trim(p_cliente_telefone), '') = '' then
    raise exception 'O telefone é obrigatório.';
  end if;

  if p_metodo_entrega not in ('levantamento', 'entrega') then
    raise exception 'Método de entrega inválido.';
  end if;

  if jsonb_typeof(p_itens) <> 'array'
     or jsonb_array_length(p_itens) = 0 then
    raise exception 'A encomenda não tem produtos.';
  end if;

  if jsonb_array_length(p_itens) > 50 then
    raise exception 'Demasiados produtos numa só encomenda.';
  end if;

  if v_cupao is not null then
    if not public.validar_cupao(v_cupao, p_cliente_email) then
      raise exception 'Cupão inválido.';
    end if;

    select cupao_desconto_percentagem
      into v_percentual
      from public.definicoes_lancamento
     where id;

    v_percentual := coalesce(v_percentual, 6);
  end if;

  insert into public.encomendas (
    cliente_nome, cliente_telefone, cliente_email,
    metodo_entrega, morada, codigo_postal, localidade,
    data_evento, tipo_celebracao, observacoes, horario_preferido,
    imagens_referencia, cupao, desconto_percentagem
  ) values (
    left(trim(p_cliente_nome), 120),
    left(trim(p_cliente_telefone), 40),
    nullif(left(trim(coalesce(p_cliente_email, '')), 160), ''),
    p_metodo_entrega,
    nullif(left(trim(coalesce(p_morada, '')), 240), ''),
    nullif(left(trim(coalesce(p_codigo_postal, '')), 20), ''),
    nullif(left(trim(coalesce(p_localidade, '')), 120), ''),
    p_data_evento,
    nullif(left(trim(coalesce(p_tipo_celebracao, '')), 60), ''),
    nullif(left(trim(coalesce(p_observacoes, '')), 2000), ''),
    nullif(left(trim(coalesce(p_horario_preferido, '')), 120), ''),
    case
      when jsonb_typeof(p_imagens_referencia) = 'array'
        then p_imagens_referencia
      else '[]'::jsonb
    end,
    v_cupao,
    v_percentual
  )
  returning id, referencia into v_id, v_ref;

  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    -- Mínimo do tamanho escolhido (se existir); senão, o mínimo do produto.
    select coalesce(
             (
               select (t->>'quantidade_minima')::int
                 from jsonb_array_elements(
                        case
                          when jsonb_typeof(p.opcoes->'tamanhos') = 'array'
                            then p.opcoes->'tamanhos'
                          else '[]'::jsonb
                        end
                      ) as t
                where t->>'nome' = v_item->'personalizacao'->>'tamanho'
                limit 1
             ),
             p.quantidade_minima
           )
      into v_minimo
      from public.produtos p
     where p.slug = v_item->>'slug'
     limit 1;

    v_minimo := greatest(1, least(coalesce(v_minimo, 1), 99));

    v_quantidade := greatest(
      v_minimo,
      least(coalesce((v_item->>'quantidade')::int, 1), 999)
    );

    -- Preço por quantidade (ex.: brigadeiros 30+ un. a 1,70 €): o escalão
    -- atingido vale para todas as unidades; abaixo dele, o preço enviado.
    select (e->>'preco')::numeric
      into v_escalao
      from public.produtos p,
           jsonb_array_elements(
             case
               when jsonb_typeof(p.opcoes->'precos_quantidade') = 'array'
                 then p.opcoes->'precos_quantidade'
               else '[]'::jsonb
             end
           ) as e
     where p.slug = v_item->>'slug'
       and jsonb_typeof(e->'quantidade_minima') = 'number'
       and jsonb_typeof(e->'preco') = 'number'
       and (e->>'preco')::numeric > 0
       and (e->>'quantidade_minima')::numeric <= v_quantidade
     order by (e->>'quantidade_minima')::numeric desc
     limit 1;

    v_preco := coalesce(v_escalao, (v_item->>'preco')::numeric);

    insert into public.encomenda_itens (
      encomenda_id, produto_slug, produto_nome,
      categoria, quantidade, preco_unitario, personalizacao
    ) values (
      v_id,
      left(coalesce(v_item->>'slug', 'desconhecido'), 120),
      left(coalesce(v_item->>'nome', 'Produto'), 200),
      left(coalesce(v_item->>'categoria', ''), 120),
      v_quantidade,
      v_preco,
      case
        when jsonb_typeof(v_item->'personalizacao') = 'object'
          then v_item->'personalizacao'
        else '{}'::jsonb
      end
    );

    v_total := v_total + coalesce(v_preco * v_quantidade, 0);
  end loop;

  v_desconto := case
    when v_percentual is not null and v_total > 0
      then round(v_total * v_percentual / 100, 2)
    else null
  end;

  update public.encomendas
     set total_estimado = nullif(v_total - coalesce(v_desconto, 0), 0),
         desconto_valor = v_desconto
   where id = v_id;

  return v_ref;
end;
$function$;

notify pgrst, 'reload schema';

commit;
