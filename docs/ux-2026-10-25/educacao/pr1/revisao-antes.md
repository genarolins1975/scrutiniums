# Revisão visual independente: Educação, antes do PR 1

Revisor: agente independente `/root/revisao_educacao_1`. Data: 25/10/2026.
Base examinada: `/workspace/scrutiniums/docs/ux-2026-10-25/educacao/pr1/antes/`, build `BoAugzevtViVGeFmxDbPE`, conforme evidencias.md. Não executei servidor, build ou testes nesta revisão. Não alterei código.

## Capturas abertas

Abri pelo visualizador as 36 capturas de página completa: cada prefixo abaixo combinado com `-390-com-sessao.jpg`, `-390-sem-sessao.jpg`, `-768-com-sessao.jpg`, `-768-sem-sessao.jpg`, `-1440-com-sessao.jpg` e `-1440-sem-sessao.jpg`. Todos esses arquivos estão na pasta de base acima. Não confundir com os arquivos `primeira-tela`.

| Prefixo | Rota | 390 com/sem | 768 com/sem | 1440 com/sem |
|---|---|---|---|---|
| educacao_municipal | /educacao-municipal | abertos | abertos | abertos |
| educacao_municipal_ibge_2800100 | /educacao-municipal?ibge=2800100 | abertos | abertos | abertos |
| educacao_municipal_ibge_2611606 | /educacao-municipal?ibge=2611606 | abertos | abertos | abertos |
| educacao_municipal_municipio_2800100 | /educacao-municipal/municipio/2800100 | abertos | abertos | abertos |
| educacao_municipal_mapa | /educacao-municipal/mapa | abertos | abertos | abertos |
| eficiencia_estatal_educacao_municipal_capitais | /eficiencia-estatal/educacao-municipal-capitais | abertos | abertos | abertos |

Reabri em detalhe original: Amparo 1440 com sessão; Recife 390 com sessão; capitais 768 com sessão. A ferramenta ainda limita imagens muito compridas a 6.000 px de altura; a leitura de números miúdos em todas as capturas não está integralmente verificada. A composição completa, sequência de seções e distribuição de espaço foram examinadas, incluindo rodapés.

## Achados visuais

1. **Entradas com cidade: hierarquia insuficiente nas três larguras.** Amparo do São Francisco (2800100) e Recife (2611606) só surgem depois da abertura nacional, quatro indicadores, Para você e introdução/busca. A escala nacional e os cartões das capitais têm precedência sobre a resposta escolhida. Evidência: capturas completas com sessão dos dois parâmetros, especialmente 1440 e 390.
2. **Entradas com cidade: profundidade sem recolhimento suficiente.** Duas tabelas por edição interrompem o percurso, abertas, entre mecanismo e comparação. A composição móvel é longa e repetitiva. O mecanismo aparece no bloco estático, no laboratório da cidade e novamente no laboratório Brasil. As duas séries dividem a coluna em 1440 e a área efetiva para linhas e metas fica reduzida; em 768 elas já se empilham.
3. **Qualidades preserváveis.** Cor de destaque consistente para a cidade, estado e Brasil diferenciados, lacunas em Amparo visíveis na série, marcas de pandemia, fontes adjacentes, distribuição por porte e matrículas. As tabelas móveis têm indicação para deslizar; não concluo que houve perda de coluna só porque a captura registra apenas a parte inicial.
4. **Entrada sem cidade: organização mais equilibrada, busca ainda tardia.** Sem séries e tabelas municipais, o percurso é relativamente compacto. Em 390, quatro números nacionais empilhados e Para você precedem a tarefa de escolher município. O laboratório possui envelope com limitações; as seções finais estão recolhidas.
5. **Aperitivos: resposta mais direta que a entrada autenticada.** Cidade e dois números surgem logo após a abertura; fonte e explicação de rede municipal estão próximas. Convite descreve o conteúdo adicional. No celular há longa extensão do rodapé comum, que não deve ser atribuída exclusivamente ao conteúdo da Educação.
6. **Capitais: muita explicação para pouca comparação visível.** Gráficos de barras pretas mostram resumo agregado/extremos em vez das 26 cidades. Na captura 768, gasto tem três barras; alunos por turma e Ideb têm duas barras (mediana e Brasil). Portanto não é correto relatar que todos os três gráficos têm três barras. As 26 capitais estão em tabelas recolhidas. O bloco de escores mostra Pendente e Não calculável no corpo da página. A ressalva de não causalidade está explícita e deve ser preservada.
7. **Ficha e mapa ausentes na base.** Ambos mostram 404 com sessão e formulário de login sem sessão nas três larguras. Não há conteúdo anterior dessas páginas para pontuar. Essas capturas não são evidência de ficha/mapa implementados.

## Rubrica §10

Notas abaixo são julgamento visual desta revisão, não resultados de testes. Cada linha cobre as três larguras abertas; quando a evidência não permite concluir, uso NV (não verificado). NA significa conteúdo inexistente ou rota redirecionada para autenticação. Interação e acessibilidade funcional permanecem NV: imagens não demonstram teclado, leitor de tela, foco ou funcionamento dos controles. A responsividade avaliada é somente composição estática, não tarefas interativas.

| Rota/estado | Direção de arte | Hierarquia | Tipografia/acabamento | Densidade/profundidade | Didática visual | Comparabilidade | Interação/acessibilidade | Responsividade visual |
|---|---:|---:|---:|---:|---:|---:|---|---:|
| Entrada sem cidade, com sessão | 8 | 7 | 8 | 8 | 8 | 8 | NV | 7 |
| Entrada Amparo, com sessão | 8 | 5 | 7 | 5 | 7 | 8 | NV | 6 |
| Entrada Recife, com sessão | 8 | 5 | 7 | 5 | 7 | 8 | NV | 6 |
| Aperitivo sem cidade | 8 | 8 | 8 | 8 | 8 | 8 | NV | 8 |
| Aperitivo Amparo | 8 | 8 | 8 | 8 | 8 | 8 | NV | 8 |
| Aperitivo Recife | 8 | 8 | 8 | 8 | 8 | 8 | NV | 8 |
| Ficha Amparo, com/sem sessão | NA | NA | NA | NA | NA | NA | NA | NA |
| Mapa, com/sem sessão | NA | NA | NA | NA | NA | NA | NA | NA |
| Capitais, com sessão | 7 | 7 | 8 | 6 | 6 | 7 | NV | 7 |
| Capitais, sem sessão (login) | NA | NA | NA | NA | NA | NA | NA | NA |

Fundamentos das notas: identidade visual consistente sustenta 8 em direção de arte da Educação; busca tardia reduz hierarquia da entrada sem cidade a 7; cidade enterrada e conteúdo duplicado justificam 5 em hierarquia/densidade das entradas com cidade. Tipografia não apresenta colisão grosseira visível, mas séries pequenas e muitos detalhes reduzem acabamento a 7 nessas entradas. Escalas e universos descritos sustentam comparabilidade 8, sem certificar cada valor contra a gold. Nos aperitivos, a composição é clara e responde à tarefa, mas screenshots não demonstram excepcionalidade para 9. Nas capitais, barras de resumo pouco informativas e escores indisponíveis justificam 6 em didática e densidade. A longa passagem pelos números nacionais em 390 e o cromo alto em 768 limitam a responsividade da entrada.

## Medidas e verificações existentes (não executadas pelo revisor)

Dimensões dos arquivos exibidas pelo visualizador, que correspondem à captura completa, sem substituir execução de ux-medidas:

| Página com sessão | 390: altura da imagem | 768: altura da imagem | 1440: altura da imagem |
|---|---:|---:|---:|
| Entrada sem cidade | 7.985 | 5.838 | 4.790 |
| Entrada Amparo | 14.380 | 11.072 | 8.837 |
| Entrada Recife | 14.511 | 11.143 | 8.934 |
| Capitais | 9.055 | 6.616 | 5.548 |

Entradas com cidade excedem os tetos de 11.000 px em 390 e 6.500 px em 1440. Aperitivo Amparo em 390: imagem de 4.519 px; Recife: 4.650 px, ambos acima do teto aberto de 4.500 px, inclusive antes da nova linha do convite. Isso merece conferência nas medidas finais; não dizer que todos os aperitivos anteriores já estavam no orçamento. Aperitivo sem cidade em 390: 4.050 px.

Evidencias.md registra cromo da entrada autenticada em 195/332/222 px (390/768/1440); aperitivo em 93/142/142 px; capitais autenticadas em 183/316/228 px. Nas rotas existentes, registra axe 0, console 0, requisições ao login 0 e ausência de rolagem horizontal. Essas são evidências automatizadas fornecidas, não interação manual deste revisor. Ficha/mapa 404 têm erros e alguns prefetches ao login no relatório, consistentes com ausência das páginas.

## Limites e próxima comparação

Não verificados: seções recolhidas abertas, menus, foco e teclado, estados dos sliders após interação, seleção pela busca, contraste numérico, responsividade durante interação, rede e autenticação ao vivo. As capturas finais precisam demonstrar município na primeira tela, percurso da busca, tabelas completas recolhidas, séries ampliadas, uma instância de laboratório por página e orçamento com o convite atualizado. Reexaminar aperitivos em 390 é necessário, porque a base já ultrapassa o limite nos dois municípios.
