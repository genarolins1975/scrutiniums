# Pedidos da família Mercado e Regulação

Rotas `/setor-eletrico/mercado` (e `/agentes`, `/mre-e-gsf`, `/encargos`) e `/setor-eletrico/regulacao` (e `/linha-do-tempo`, `/consultas-e-agenda`). Cada pedido diz o que mudar, por que e em que arquivo. Nenhum bloqueia as páginas: elas seguem com a melhor solução local, descrita em cada item.

## 0. Arquivos sem uso, para o coordenador apagar no fim (com o servidor parado)

Nenhum componente foi apagado por este executor. Saíram só os arquivos temporários que ele mesmo criou (`zz_tmp_mr_*.test.ts`), que nada importava.

- `src/components/energia/RegulacaoLinkPainel.tsx`: nenhum import restante. O rodapé de cada painel passou a usar o `SeguirPainel` compartilhado (mesmo botão "Copiar link deste painel"). Ao apagar, tirar a menção da linha 20 de `docs/observatorios/energia/modulos/regulacao.md` (lista de componentes). O teste `energia-regulacao.test.ts` varre a pasta por prefixo `Regulacao`, então não precisa de ajuste.
- `src/components/energia/VisaoLinkPainel.tsx`: o último importador era `MercadoPainel.tsx` (a Visão geral já havia deixado de usá-lo, como diz `pedidos/visao-territorio.md`, linha 10). Hoje nenhum arquivo de `src` o importa. Citado em `docs/observatorios/energia/CONTINUIDADE.md` (linha 97).
- Exports removidos de arquivos que continuam em uso (sem arquivo para apagar): `RegulacaoResposta`, `RegulacaoAnalise`, `RegulacaoAuditoria`, `RegulacaoLeitura` e `RegulacaoSeguir` (de `RegulacaoPagina.tsx`); `MercadoResposta` antigo, `MercadoAnalise`, `MercadoAuditoria`, `MercadoSeguir` e `MercadoOutrasPerguntas` (de `MercadoPainel.tsx`). Nenhum teste os importava.

## 1. `NavegacaoLocal variante="capitulos"` não aceita resumo por item

Na abertura do Mercado, cada capítulo precisa do veredito do painel (resposta curta, com a resposta completa da gold por trás em Analisar) e do link. `NavegacaoLocal` aceita só rótulo, descrição e href. Proposta: aceitar `resumo?: ReactNode` por item (e o título do item como `h3`). Local do que foi escrito à mão: `MercadoCapitulos`, em `src/components/energia/MercadoPainel.tsx` (um `nav` com `data-navegacao-local="capitulos"`, `h2` "As outras perguntas sobre o mercado" e um `RespostaCurta` com `data-resposta-resumo` por capítulo, que o teste de M1 conta). A abertura da Regulação usa o `NavegacaoLocal` como está (`RegulacaoCapitulos`, com `nivelTitulo={3}`).

## 2. `FaixaMetricas`: a `nota` fica em largura de leitura, não na da faixa

A `nota` da faixa usa `max-w-prose2` (cerca de 42 rem). Na abertura do Mercado, a nota dos dois universos (EPE e CCEE), que o teste de conteúdo exige antes do painel, tem cinco linhas ao lado de uma faixa de 1.160 px, cerca de 85 px que empurram a figura para baixo. Proposta: deixar a nota ocupar a largura da faixa a partir de 1024 px. Arquivo: `src/components/energia/FaixaMetricas.tsx`.

## 3. `GraficoBarras`: o eixo vertical cruza a primeira letra do rótulo de categoria em 390 px

Nas barras horizontais com o rótulo acima da barra (largura estreita), a linha do eixo passa sobre a primeira letra de cada rótulo ("Q|ualidade", "P|LD", "C|onta de luz"). Evidência: `/setor-eletrico/regulacao/consultas-e-agenda`, em 390 px, gráfico "Atividades da agenda por painel relacionado e ano previsto" (o mesmo ocorre em "Eventos da linha do tempo por painel ligado", em `/linha-do-tempo`). Proposta: começar o texto do rótulo 6 px à direita do eixo. Arquivo: `src/components/energia/GraficoBarras.tsx`.

## 4. Divergências entre catálogo, mapa, navegação, galeria e página (Mercado e Regulação)

1. Galeria (tela 11) mostra o Mercado "em integração". No código: `navegacao.ts` marca `integrado: true` (e o teste `energia-mercado-pagina` confere `publicado`), `mapa.ts` marca `estado: "integrado"` e o catálogo (`catalogo.json`) marca 24 conjuntos como PUBLICADO ligados a páginas de mercado (CCEE 18, ANEEL 3, EPE 2, MME 1), o mesmo número das 24 `fontes` da gold do módulo. Os três concordam entre si; a galeria é de antes de 06/10/2026, data em que a coleta dos conjuntos abertos da CCEE foi autorizada (`acesso_ccee.decisao.decidida_em`). A abertura agora diz isso com número lido do catálogo (seção "O que o observatório ainda não mostra sobre o mercado?") e a tabela de fontes está em Auditar.
2. O que falta de fato no Mercado é "contratação" no sentido de contratos: 10 conjuntos `ccee:contrato_montante_*` do catálogo estão só em RECURSO VERIFICADO (existem e respondem, não foram integrados; nenhum é consumido pela gold do módulo). Preço de contrato não é publicado pelo observatório. A página diz as duas coisas sem número de contrato, sem barra e sem data de entrega. Se algum desses conjuntos for integrado, a contagem e a frase mudam sozinhas (seletor `resumoCatalogoMercado`).
3. `src/lib/energia/mapa.ts:118` pergunta "Como a energia é contratada e liquidada?" para o Mercado; o título da página é "Como a energia é contratada, alocada e liquidada?" (`TITULO_PAGINA_MERCADO`) e a tela 11 pergunta "Como a energia é contratada?". Sugestão: alinhar `mapa.ts` ao título da página (ou o contrário) e, se couber, a pergunta do menu.
4. `src/lib/energia/navegacao.ts:41` descreve a Regulação como "ANEEL, CCEE, ONS e MME com linha do tempo e documentos primários", mas a linha do tempo tem eventos de ANEEL (19), Congresso Nacional (4), Presidência da República (1), CREG (1) e MME (1), nenhum da CCEE nem do ONS (`orgaosDosEventos` e gold `linha_do_tempo.eventos[].orgao`). Sugestão: "ANEEL, MME, Congresso e Presidência, com linha do tempo e documentos primários", ou incluir a CCEE e o ONS quando houver evento deles.
5. `src/lib/energia/mapa.ts:121` pergunta da Regulação: "Que regras mudaram, quando e com qual efeito declarado?". A tela 19 pergunta "Que regra vale em cada período?", que passou a ser o título da abertura (`PAINEIS_REGULACAO`, painel P044). O título da linha do tempo ficou "Que regras mudaram e quando passaram a valer?" e o da página de consultas "Quais decisões da ANEEL estão abertas ou próximas?". O mapa pode citar a pergunta da abertura.

## 5. Pergunta do painel e título da página (regra de 5 a 9 palavras)

A pergunta que a gold publica para o painel de MRE e GSF tem 11 palavras ("Como foi o ajuste da garantia física das hidrelétricas do MRE?") e a de encargos, 11 ("Quais custos públicos aparecem na liquidação do mercado de curto prazo?"). As páginas usam como título duas versões de 9 e 8 palavras (`TITULO_PAGINA_MERCADO`: "Como foi o ajuste da garantia física do MRE?" e "Quais custos públicos aparecem na liquidação do mercado?"), e o título do painel (h2) é outra pergunta, sobre a primeira figura. Da pergunta da gold (`paineis[].pergunta`) a página só usa a do painel de livre e regulado, como título do painel da abertura. Se a regra de 5 a 9 palavras valer também para a pergunta do painel, trocar o texto na gold (pipeline `mercado.py`).

## 6. Pedidos ao pipeline (dados), sem efeito imediato sobre as páginas

- A agenda regulatória foi atualizada pela Portaria nº 7.157, de 8 de setembro de 2026, e o texto da atualização não pôde ser lido (HTTP 403 em leis.org). A página diz, à vista, que os anos e a contagem de atividades (59) são os da versão original. Uma cópia legível da portaria permitiria conferir.
- Regulação, valores de 2021 (REH nº 2.828/2020) e de 2023 (REH nº 3.167/2022 e retificação): o texto do ato não está acessível e os valores foram lidos em voto ou nota técnica do mesmo processo; a data de publicação de 2021 não foi conferida e fica vazia (nunca a data de captura). A página diz isso por ato, em Analisar.
