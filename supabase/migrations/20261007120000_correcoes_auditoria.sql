-- Correções da auditoria de 07/10/2026.
-- Erro de escrita no nome/endereço do "Bolo branco com flores".
-- O endereço antigo continua a funcionar (redirect em astro.config.mjs).

update public.produtos
set nome = 'Bolo branco com flores',
    slug = 'bolo-branco-com-flores'
where slug = 'bolo-brnaco-com-flores';
