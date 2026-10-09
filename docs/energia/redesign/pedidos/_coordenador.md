# Correções de dados e componentes compartilhados (lista do coordenador)

Itens achados pelas avaliações independentes iniciais e pelos executores que não cabem a uma família de páginas. Cada linha diz onde foi achado, o que muda, quem faz e o estado.

## Dados e pipeline

| Id | Achado | Origem | Ação | Estado |
| --- | --- | --- | --- | --- |
| D1 | FEC de jun/2025 da ELEKTRO usa 22.562 de 3.036.447 UCs (0,74%) como mês completo; o anual 3,25 fica 4,1% abaixo do refeito por FECIP + FECIND (3,38); 128 conjuntos aparecem com FEC de 11 meses e "meses 12"; a contagem acima do limite de FEC (341) omite 2 | T-U09, bloqueio de Qualidade | Pipeline: `controle_cobertura_fec` (mínimo de 95% das UCs do mês) tira o mês do FEC da distribuidora e do Brasil, com a coluna `controle_fec` no CSV mensal e novo controle de validação; testes em `pipeline/tests/test_energia_qualidade.py`. A gold atual não pode ser refeita aqui (o silver e o bronze de continuidade não estão neste ambiente, e uma recoleta traria dados novos): a página trata o caso com campos da gold atual (FEC anual marcado como de cobertura parcial, valor refeito pelas parcelas ao lado: com 3,38 o DGC calculado fica 0,70, igual ao publicado pela ANEEL) | código feito; gold atualiza na próxima coleta; página com o executor de Qualidade |
| D2 | `conta_subsidios_anual.csv` mistura linhas de categoria e de total: somar `valor_rs` de 2025 dá R$ 37,6 bilhões, o dobro dos R$ 18,82 bilhões da página | T-U09 | Coluna `eh_total` no arquivo (ou total em arquivo à parte) | pendente |
| D3 | 12 de 243 custos por perfil diferem R$ 0,005 do arredondamento meio para cima (ENEL CE, 100 kWh: 70,17 exibido para 70,175 exato) | T-U09 | Arredondar em decimal, meio para cima, no pipeline e na interface | pendente |
| D4 | Versão do código com `+alterado` no gold e no manifesto: o rótulo não identifica o commit que produziu o dado | T-U09 | Gerar a versão com árvore limpa antes da publicação final | pendente (fim) |
| D6 | As fichas "Comprove" de EAR e ENA dizem "Nenhuma revisão detectada entre as capturas integradas" enquanto a tabela de revisões do ONS na mesma página mostra EAR e ENA revisadas entre duas capturas | T-U03 | Interface: `Numero` aceita `revisoes` e a página passa o texto montado com a tabela de revisões. Pipeline: o texto da ficha vem de `c.snapshot_de(...).get("revisoes")` em `agua_detalhe.py` (linhas 3314 a 3525); na próxima coleta, alimentar a ficha com a mesma comparação entre capturas que gera a tabela | interface com o executor de Água; pipeline pendente |
| D7 | A limitação das caixas "Sobre este dado" do PLD diz que os limites regulatórios não foram auditados e que a regra do teto estrutural é conferência empírica, mas a REN ANEEL 1.032/2022 (art. 22 a 24) a escreve e o módulo Regulação a cita | T-U06 | Texto das limitações em `pld_detalhe.py`/`pld.py`; a página trata o texto visível | pipeline pendente (próxima coleta) |
| D5 | O arquivo exportado trazia 22.189999999999998 e 15.950000000000001 para valores exibidos como 22,19 e 15,95 | P-U06 | `numeroMaquina` de `tabela.ts` tira o ruído de decimais curtos (até 12 algarismos significativos, dentro de 4 ulp) e mantém inteiros os valores que usam todos os algarismos | feito |

## Componentes e regras compartilhados

| Id | Achado | Ação | Estado |
| --- | --- | --- | --- |
| S1 | Ano exibido como "2.026" em tabelas (bloqueio de valor incorreto em Água) | `ehColunaDeAno` em `lib/energia/tabela.ts`: coluna numérica cujo rótulo começa por "Ano" (casas 0) sai sem separador de milhar | feito |
| S2 | Âncoras de verbetes e do cartão de Qualidade apontavam para o painel vizinho | `evidencias-verbetes.ts` (`#p051`, `#p052`, `#p053`) e `mapa.ts` (`#expurgos`, `#p053`, `#p054`) | feito |
| S3 | Título de capítulos dentro de painel era `h2` | `NavegacaoLocal` aceita `nivelTitulo={3}` | feito |
| S4 | Regra de ordem pôs a resposta curta antes das figuras mesmo quando a faixa de métricas já traz o número | `RespostaCurta` aceita `depois` e `globals.css` respeita `data-resposta-depois` | feito |
| S5 | Legenda interativa de `GraficoLinhas` gastava cerca de 90 px acima da figura | Botões de 32 px só em tela larga com ponteiro fino (44 px no toque e abaixo de 768 px) | feito |
| S7 | Ficha "Comprove" com texto de revisões que contradiz a tabela da página | `Numero` aceita `revisoes?: string` e substitui só a linha "Revisões" da ficha | feito |
| S8 | Barra de profundidade presa ao topo cobria o controle focado (WCAG 2.2, 2.4.11) e tinha fundo translúcido | `ModoProfundidade`: fundo opaco e, ao receber foco, a página rola o suficiente para o controle ficar abaixo da barra | feito |
| S9 | Seletor de profundidade passava da borda em 390 px com texto a 175% ou mais; tabelas largas cortavam números no limite da janela sem indicação visual além do aviso em texto | `ModoProfundidade`: botões com quebra de linha; `TabelaInterativa` marca `data-mais-direita` e o CSS esmaece a borda direita enquanto há mais colunas | feito |
| S6 | Cores diferentes para a mesma entidade entre gráficos da mesma página | Regra no guia dos executores (mesma cor por entidade); verificação na reavaliação | em curso |

## Arquivos sem uso para apagar no fim (com o servidor parado)

Os executores listam os seus em `docs/energia/redesign/pedidos/<família>.md`. Conferidos até agora: `AguaLinkPainel.tsx` (e a linha 5 de `docs/observatorios/energia/modulos/agua.md`, que o cita), `QualidadeLinkPainel.tsx`, `PrevisoesLinkPainel.tsx` e `ArquivoPrevisoes.tsx` (este exige ajustar `energia-governanca.test.ts`).
