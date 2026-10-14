# Avaliação do Observatório Brasileiro de Gás Natural

Data: 14/10/2026. Diagnóstico anterior à implementação. Base: main, commit `4a0ed392c`. Os arquivos de gás são idênticos aos do checkout inicial `ca5b5a6ef`. Escopo: as doze rotas, componentes, leitores, cálculos, validações, nove arquivos gold e séries CSV. As notas abaixo são avaliações de interface, não avaliações dos estados ou do setor.

## 1. Sumário executivo

A estrutura já oferece perguntas claras, gráficos SVG com tabelas equivalentes, fontes identificadas e reprodução determinística. Os 22 testes Python existentes passaram. Todos os valores de referência numérica do anexo coincidem com a gold local, inclusive períodos e unidades. Isso comprova coerência com o snapshot, não uma nova validação dos números na origem. As consultas externas e seus erros constam em `ACESSO_FONTES_2026-10-14.json`.

Cinco problemas de maior impacto:

1. A soma da oferta na inicial aceita janelas diferentes. O código calcula `mesmaJanela`, mas só usa o resultado numa ressalva. Um próximo atraso de atualização pode produzir um total sem período coerente.
2. A importação acumulada soma meses disponíveis e divide pelos dias de doze meses. Em teste de perturbação, retirar setembro de 2025 ainda publica 15,663 milhões de m³/dia para a janela inteira. É dado de teste, não indicador real.
3. Um balanço incompleto pode ser marcado como válido. Ao retirar a queima de agosto de 2026, o código publica situação `ok` e diferença de 1,486%, pois a ausência entra na soma como zero. É dado de teste.
4. Fonte e nota material ficam dentro de detalhes recolhidos nas medidas. Na inicial, preços brasileiros com impostos aparecem junto de referências sem impostos sem ressalva imediatamente visível.
5. O percurso promete consumo e preço residencial que não mede. A inicial fala em quanto o país tem e usa, embora não publique reservas ou demanda total; a página de GNV mostra inflação residencial, não uma tarifa nacional.

Cinco melhorias de maior retorno:

1. Publicar ausência separadamente de inconsistência, exigir cobertura integral das janelas e testar casos adversos.
2. Condicionar o fluxo a períodos compatíveis e transportar totais e participações calculados para a gold, com fórmula e fonte.
3. Tornar fonte e ressalva visíveis junto de cada medida, ajustar a primeira dobra e criar navegação local pelas perguntas de cada página.
4. Inserir definições curtas no ponto de uso e uma rota de aprendizagem: produção, destinos, importação, infraestrutura, preços, consumidores, mercado, regulação e método. GLP aparece como cadeia distinta.
5. Permitir selecionar mês no balanço e preservar a UF na URL do explorador de preços, mostrando média, extremos amostrais e cobertura da seleção. Não criar conversões energéticas sem fatores oficiais.

## 2. Matriz de notas por página

Escala de 0 a 10, sem média compensatória. DA: direção de arte; H: hierarquia; D: didática; I: interação útil; M: método; C: comparabilidade; A: acessibilidade; R: responsividade. Avaliação estática do código e capturas locais. A não é certificação WCAG: leitor de tela real e todos os estados de teclado permanecem pendentes. As capturas de 320, 390, 768 e 1440 px ficam no artefato local `/tmp/gas-antes`; o resultado automatizado será registrado separadamente. Nenhuma nota implica verificação em produção.

| Página | DA | H | D | I | M | C | A | R |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inicial | 7 | 6 | 6 | 3 | 5 | 5 | 6 | 7 |
| Produção | 7 | 7 | 7 | 7 | 7 | 8 | 6 | 7 |
| Aproveitamento | 7 | 7 | 7 | 6 | 5 | 7 | 6 | 7 |
| Importação | 7 | 7 | 7 | 6 | 5 | 7 | 6 | 7 |
| Preços | 7 | 6 | 7 | 7 | 7 | 6 | 6 | 7 |
| Gás de cozinha | 7 | 6 | 8 | 7 | 7 | 7 | 6 | 7 |
| GNV e gás encanado | 7 | 6 | 6 | 7 | 7 | 7 | 6 | 7 |
| Mercado | 7 | 7 | 7 | 5 | 6 | 7 | 6 | 7 |
| Infraestrutura | 7 | 6 | 7 | 5 | 7 | 7 | 6 | 6 |
| Regulação | 7 | 7 | 7 | 3 | 6 | 8 | 6 | 7 |
| Dados | 6 | 5 | 6 | 3 | 8 | 8 | 6 | 6 |
| Metodologia | 7 | 7 | 7 | 3 | 6 | 8 | 6 | 7 |

### Evidência e limite de cada critério

As evidências comuns aplicam se às doze linhas. DA: `Blocos.tsx` reutiliza serifa, filetes, números tabulares e acento azul; a repetição de `SecaoGas` e a diferença dos tokens de papel e tinta em relação ao contrato impedem nota maior. H: pergunta e medida têm escala distinta; aberturas longas e fonte recolhida competem com a tarefa. D: cada página tem pergunta, explicação e próximos passos; falta uma síntese curta do que cada medida não permite concluir. I: `GraficoLinhas` oferece seleção e tabela, mas controles locais nem sempre preservam a seleção. M: gold declarativa e testes reproduzem o snapshot; ressalvas ocultas e ausência de confirmação externa limitam a confiança. C: unidades e períodos aparecem nos gráficos; bases fiscais e cobertura exigem leitura adicional. A: tabelas, labels e skip link estão presentes; nem todos os links têm alvo de 44 px e a paleta das séries não foi certificada em todos os estados. R: grades colapsam, tabelas têm rolagem própria; no celular as longas sequências dificultam chegar à pergunta desejada.

| Página e arquivo em `src/app/gas-natural` | Evidência específica | Limitação específica por critério |
| --- | --- | --- |
| `page.tsx` | Duas barras em escala comum, grupos por pergunta, atualidade | DA: sequência uniforme; H: oito medidas; D: confunde disponibilidade e uso; I: fluxo estático; M/C: janelas não bloqueiam soma; A: links pequenos; R: índice distante no celular |
| `producao/page.tsx` | Séries mar e terra, zoom, barras com zero, tabela por UF | DA/H: quatro figuras seguidas; D: explicar média diária junto do valor; I: seleção das UFs restrita às maiores; M: ausência estadual tratada como zero; C: produção não é reserva; A: validação manual pendente; R: tabela extensa |
| `aproveitamento/page.tsx` | Define quatro destinos e mostra diferença da identidade | DA/H: mesmas seções em sequência; D: não atribui causalidade por campo; I: falta consulta pontual; M: incompleto passa como válido; C: soma pode divergir; A: distinguir situação em texto; R: tabela estadual larga |
| `importacao/page.tsx` | Separa ANP em m³ e Comex em massa, informa ambos os calendários | DA/H: origem aparece após duas séries; D: gás gasoso não identifica sozinho toda rota física; I: zoom útil, sem exploração da janela; M: soma parcial; C: janela parcial anual; A: tabela equivalente existente; R: tabela por origem exige rolagem local |
| `precos/page.tsx` | Ponderação regional, PTAX, legendas e nota sobre tributos | DA/H: muitas linhas e cinco blocos; D: mercados não explicam diferenças contratuais; I: legenda útil; M: transporte não identificado; C: tributos não harmonizados; A: muitas cores; R: nota importante abaixo da figura |
| `gas-de-cozinha/page.tsx` | Aviso GLP, mapa por quantis, nominal e real, extremos da pesquisa | DA/H: mapa antes da tarefa pessoal; D: distinção GLP correta; I: UF perde seleção ao recarregar; M/C: banda nominal junto da série real; A: mapa tem tabela, falta testar leitor; R: tabela de sete colunas |
| `gnv-e-gas-encanado/page.tsx` | Preço amostral e IPCA residencial separados no texto | DA/H: quatro medidas e mapa; D: título promete preço residencial; I: seleção UF sem URL; M: cobertura de dez UFs não é preço zero; C: nível versus variação; A: verificar anúncio da seleção; R: longa sequência |
| `mercado/page.tsx` | Contagem por código, meses incompletos, aviso contra concentração | DA/H: três séries com o mesmo peso; D: contrato versus fluxo; I: pouco além de legendas; M: contagens por transportadora ainda podem mostrar zero em lacunas; C: soma de agentes duplicados não é total; A: descrição precisa de situação; R: notas extensas |
| `infraestrutura/page.tsx` | Cadeia física, quebras declaradas, capacidade sem unidade preservada como texto | DA/H: introdução em cinco colunas; D: importação é entrada alternativa, não etapa sequencial da produção; I: sem exploração de terminais; M: ato não prova operação atual; C: não somar capacidades; A: tabela equivalente; R: sete colunas textuais |
| `regulacao/page.tsx` | Links oficiais e indicação de revogação em dois atos | DA/H: lista clara, pouco contraste entre esferas; D: competências descritas; I: lista sem filtro; M: vigência atual não reconfirmada; C: não classifica estados; A: links pequenos; R: cronologia linear longa |
| `dados/page.tsx` | Catálogo com hash, data, licença, downloads e fórmulas | DA/H: catálogo domina antes dos indicadores; D: termos técnicos sem percurso leigo; I: sem busca; M: hash prova integridade do snapshot, não atualidade; C: unidade no valor; A/R: tabelas de 44 rem precisam de navegação local |
| `metodologia/page.tsx` | Regras, validações, glossário, limites; única rota pública | DA/H: hierarquia coerente mas repetitiva; D: glossário distante do uso; I: leitura estática; M: regra de ausência promete mais que o código; C: limites explícitos; A: âncoras e teclado precisam de revisão; R: coluna única extensa |

### Composição proposta

Largura principal mantém `ed-pagina`; prosa limitada, gráficos usam a largura disponível. Em 1440 px, abertura curta e referência aparecem antes das medidas. Em 390 px, título, síntese, atualização e atalhos vêm antes da primeira medida; não comprimir tabelas para caber na tela. Cada seção preserva a tabela e o download.

| Página | Ordem proposta e primeira dobra |
| --- | --- |
| Inicial | Pergunta sobre produção, oferta e preços; distinção GLP; percurso curto; fluxo; medidas; perguntas completas; calendário. Primeira dobra mostra a promessa e acesso ao percurso |
| Produção | Definição da média diária; medidas; evolução; UFs; anual; downloads. Primeira dobra mostra pergunta, período e medida principal |
| Aproveitamento | Destinos e limite; medidas; seletor mensal com situação; história; UFs; conferência. Primeira dobra apresenta reinjeção sem equivaler a perda |
| Importação | Dois registros e duas unidades; medidas; ANP; origem Comex; anual; downloads. Primeira dobra explicita o denominador |
| Preços | Elo de venda e incidência tributária; medidas; comparação internacional com aviso antes da figura; regiões; mercados; agentes. Primeira dobra não promete tarifa final |
| GLP | Distinção de produto; medidas; escolha da UF; mapa e tabela; nominal/real Brasil; IPCA; vendas. Primeira dobra aponta diretamente a seleção estadual |
| GNV | Preço e inflação como perguntas distintas; medidas; escolha UF; mapa; histórico; inflação. Primeira dobra declara ausência de tarifa residencial nacional |
| Mercado | Definição dos agentes; medidas; total válido; cobertura; por transportadora; vendas. Primeira dobra explica que contagem não mede concentração |
| Infraestrutura | Entradas alternativas e rede; transporte; quebras; atos; terminais. Primeira dobra distingue fluxo de autorização |
| Regulação | Duas esferas; competências; cronologia; lacunas estaduais. Primeira dobra distingue papel federal e estadual |
| Dados | Atalhos para fonte, série e indicador; catálogo; downloads; fichas. Primeira dobra permite ir direto à evidência |
| Metodologia | O que medir; regras; situações de ausência; validações; glossário; referências. Primeira dobra explica observado e calculado |

## 3. Achados metodológicos

Todas as evidências de código e gold foram consultadas em 14/10/2026. A gravidade descreve o efeito potencial, não afirma que um caso simulado ocorreu na série publicada.

### M1. Janela parcial da importação, grave

**Evidência:** `pipeline/gas/gold.py`, função `importacao`, usa `or 0` e filtra meses existentes antes de dividir pela janela completa. Retirar o primeiro mês da janela em memória preserva um resultado numérico. O dispêndio tem o mesmo problema.

**Inferência:** uma lacuna futura reduziria artificialmente a média. Seria refutada por uma validação anterior que bloqueasse toda janela incompleta; ela não existe no leitor ou no validador consultado.

**Recomendação:** exigir doze observações não nulas para cada grandeza, separadamente. Volume zero publicado continua zero. Denominador positivo e disponibilidade integral são requisitos adicionais da participação. Manter a ausência no CSV.

### M2. Balanço incompleto marcado como válido, grave

**Evidência:** `producao_e_aproveitamento` usa `soma += v or 0`. No teste com queima ausente no último mês, `situacao` continua `ok`. `validacoes.conferir` só verifica discrepância numérica, não cobertura.

**Inferência:** o leitor poderia interpretar uma falta de observação como diferença física. A hipótese é confirmada pelo teste de perturbação.

**Recomendação:** estado `incompleto`, diferença nula e parcelas não publicadas para esse balanço. Distinguir de `inconsistente`, cuja diferença é conhecida. Atualizar tipos, validação e testes. A regra atual escolhe o último mês com conjuntos presentes, não necessariamente aprovado, divergindo da descrição do anexo; declarar a regra sem recuar silenciosamente e esconder um mês reprovado.

### M3. Fluxo com janelas diferentes e cálculo na interface, grave

**Evidência:** `src/app/gas-natural/page.tsx` não usa `mesmaJanela` em `fluxoCompleto`. A barra soma os valores na interface e recalcula percentuais. A escala desconsidera o tamanho da oferta.

**Inferência:** atrasos diferentes permitem um total temporalmente incoerente; importação elevada pode cortar a barra. Não ocorre na captura atual, cujas janelas coincidem.

**Recomendação:** publicar composição na gold, verificar igualdade dos períodos e ausência, calcular escala pelo maior total e não desenhar composição incompatível. Denominar a soma como composição de volumes, sem alegar consumo final.

### M4. Preços com bases diferentes, moderado

**Evidência:** `precos` pondera `Σ preço regional × volume / Σ volume` e converte pela SGS 3698 do mesmo mês. Gold e teste concordam. `brasil_usd_mes.nota` explicita impostos, mas `MedidaGas` recolhe a nota. A figura internacional informa a diferença de base.

**Inferência:** a razão é aritmeticamente correta, mas não isola tributos, logística ou poder de mercado. Seria possível harmonizar apenas com dados adicionais não presentes no snapshot.

**Recomendação:** manter nota visível antes da comparação; não oferecer alternância tributária. Não afirmar que tarifa residencial é o preço ANP mais tributos novos, pois a medida ANP já contém impostos e o regime da fatura não está decomposto.

### M5. Deflação e lacuna no índice, moderado

**Evidência:** `_indice_encadeado` multiplica variações existentes sem exigir meses consecutivos. Preço real usa IPCA geral e base `min(ultimo_preco, ultimo_ipca)`. O teste confirma nominal igual a real no mês da base. GLP e GNV mostram uma banda nominal junto da linha real.

**Inferência:** falta interna de IPCA seria omitida no encadeamento. A banda pode parecer intervalo da série real, embora não seja. O snapshot atual não demonstra essa lacuna no índice geral.

**Recomendação:** interromper o encadeamento na primeira falta e marcar valores derivados ausentes; identificar a banda como nominal. Em um futuro modo real estadual, publicar série deflacionada pelo pipeline e corrigir também extremos, sem cálculos ocultos no cliente.

### M6. Cobertura estadual e de transportadoras, moderado

**Evidência:** somas por UF usam `.get(..., 0)`; o leitor ignora células vazias. A contagem nacional de carregadores é anulada em cobertura incompleta, mas `n:transportadora` preserva a contagem parcial ou zero. Existem quatro meses incompletos publicados.

**Inferência:** a ausência de linha pode representar ausência de atividade ou de informação; o catálogo local não resolve todo caso. Um leitor pode interpretar zero parcial como inexistência de agentes.

**Recomendação:** anular contagens da transportadora nos pares sinalizados; tratar cobertura estadual como limitação até existir regra documental da fonte. Não inventar série histórica estadual de aproveitamento nem converter toda UF sem linha em zero por conveniência.

### M7. Natureza e integridade do snapshot, moderado

**Evidência:** `atos_total` é `len(aut)` marcado OBSERVADO, embora a contagem seja calculada pelo pipeline. Hashes conferem arquivos integrais; nos recortes, o hash do original não pode ser recalculado a partir do recorte. `--coleta` substitui snapshots, e o Git registra revisões quando versionadas.

**Inferência:** integridade não certifica a verdade ou atualização na origem. Atos podem ser confundidos com ativos se a natureza e o rótulo não forem claros.

**Recomendação:** marcar a contagem como CALCULADO e declarar fórmula; preservar datas e hashes; revisar diffs nas atualizações, sem tratar novo download como ausência de revisão histórica.

### M8. Promessas e causalidade, moderado

**Evidência:** títulos da inicial e do GNV prometem uso, estoque ou preço residencial; as respectivas golds não têm essas grandezas. Infraestrutura enumera importação como terceira etapa de uma cadeia linear. Fonte NCM identifica estado físico, não necessariamente rota física detalhada.

**Inferência:** o leitor pode confundir oferta antes do processamento com consumo e inflação com nível de tarifa.

**Recomendação:** ajustar títulos e ligações, declarar entradas alternativas, distinguir gás associado de afirmações determinísticas de dependência e não atribuir reinjeção por campo a pressão ou CO₂ sem dados de composição e operação.

### Conferência das sete decisões e das famílias de fórmulas

| Decisão ou cálculo | Resultado da auditoria interna | Limite e ação |
| --- | --- | --- |
| Balanço e tolerância | Incorreto em ausência; identidade e discrepância do snapshot reproduzidas | Corrigir M2; tolerância de 2% é regra editorial, não precisão certificada da ANP |
| Movimentação | Correto com ressalva: filtro por mediana, código de carregador e lacunas nacionais | Mediana de toda a série muda com revisões; não prova erro da fonte. Corrigir contagens por transportadora |
| Preço ANP e referências | Correto com ressalva de tributos e elos | Conferência documental externa pendente; não interpretar razão como prêmio líquido |
| Participação importada | Denominador correto, cobertura incorreta | Corrigir M1, preservar importado dividido por importado mais disponível, não demanda |
| Comex | Correto manter kg e FOB separados de m³ e dispêndio | Meses sem operação e falha de captura precisam ser distinguidos pelo manifesto; não repartir volume ANP pela massa Comex |
| GLP e GNV | Observados replicados, variação e deflação reproduzidas | Amostra não representa censo; método de ponderação original não foi reconfirmado; corrigir M5 |
| GLP separado | Aviso correto na página própria | Estender a distinção à entrada do observatório |
| Média diária | mil m³ do mês dividido por dias e por mil | Ano bissexto testado; produção mensal total não equivale à média diária |
| Média de doze meses | Soma dividida por dias da janela | Exigir cobertura; não média simples das médias mensais |
| Variações | `(atual / anterior − 1) × 100` | Base nula ou zero não permite variação; esclarecer se compara volumes ou médias diárias |
| Preço ponderado | Pesos por volume de regiões com preço e volume | Zero publicado não deve ser confundido com região ausente; composição regional pode mudar |
| PTAX | SGS 3698, venda, média do mesmo mês | Nenhuma conversão física de m³ para MMBtu; fator calorífico não disponível |
| IPCA acumulado | Produto dos fatores mensais; base anterior ao início | Não atravessar lacunas; IPCAs dos subitens não substituem IPCA geral na deflação |
| Participações por UF e GLP vendido | Soma das parcelas sobre total no recorte | Cobertura estadual requer documentação adicional; m³ de GLP não são m³ de gás natural |
| Terminais | Último ato por terminal reconhecido por localização | Lista de identidade declarada; novo terminal desconhecido interrompe publicação; capacidade sem unidade não comparável |
| Atualidade | Datas individuais existem na gold | Inicial agrupa calendários distintos sob a data de produção ou GLP; separar |
| Abertura, tabela e CSV | Mesma gold e séries reconstruídas; 22 testes aprovados | Acrescentar igualdade do conteúdo CSV, hoje só existência é testada; arredondamento visual não altera unidade |

### Fontes adicionais candidatas, sem ingestão nesta entrega

| Tema | Fonte oficial e formato candidato | Licença e frequência | Viabilidade e condição |
| --- | --- | --- | --- |
| Demanda por segmento | [MME, publicações](https://www.gov.br/mme/pt-br/assuntos/secretarias/petroleo-gas-natural-e-biocombustiveis/publicacoes), boletim de gás, PDF e eventuais planilhas | Conferir licença do arquivo; boletim mensal | Média ou baixa sem tabela estável; validar extração contra totais |
| Reservas provadas | [ANP, dados abertos](https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos), boletim de reservas | Conferir licença específica; anual | Não usar volume in situ de campo como reserva 1P; estrutura do arquivo não acessada |
| Tarifas e consumidor livre | [ARSESP](https://www.arsesp.sp.gov.br/) e reguladores de cada UF, atos, PDF, tabelas | Licença e periodicidade por ato não verificadas | Baixa para conjunto nacional; declarar concessionária, faixa, tributos e vigência |
| Geometria e infraestrutura | [EPE, publicações](https://www.epe.gov.br/pt/publicacoes-dados-abertos/publicacoes), mapas e bases geográficas; catálogo ANP | Licença, formato e frequência do conjunto exato pendentes | Bloqueado até geometria oficial versionada; não geocodificar coordenadas aproximadas como oficiais |
| Capacidade de terminais | Atos específicos no [catálogo ANP](https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/dados-abertos-autorizacoes-gas-natural) | Frequência irregular; licença do ato por conferir | Campo atual sem unidade não permite soma; exigir unidade e condições de referência |
| Fatores energéticos | [ANP](https://www.gov.br/anp/), [EPE](https://www.epe.gov.br/) e [INMETRO](https://www.gov.br/inmetro/), normas e balanços | Fator, licença e vigência não verificados | Bloqueado: temperatura, pressão, composição e poder calorífico precisam acompanhar fator |

Estes links são pontos oficiais de investigação, não conjuntos novos verificados ou licenças presumidas. O catálogo usado no produto conserva as declarações já versionadas; o erro de consulta não confirma nem revoga essas declarações.

## 4. Textos didáticos prontos

Inserção proposta: após a abertura ou antes da figura indicada. Os textos abaixo não contêm valores estatísticos novos.

| Página e ponto | Texto |
| --- | --- |
| Inicial, título | Do poço ao consumidor: produção, oferta e preços do gás |
| Inicial, abertura | Comece pela produção, acompanhe os destinos do gás e veja como a importação complementa a oferta. Depois, explore os preços em cada elo. O botijão contém GLP, um produto diferente do gás natural. |
| Produção, antes da série | Milhões de metros cúbicos por dia expressam a média do mês. O volume mensal é dividido pelo número de dias daquele mês. Produção não é reserva e não mede quanto chegou ao consumidor. |
| Aproveitamento, antes do balanço | Reinjeção é o retorno do gás ao reservatório. Pode fazer parte da operação do campo e não equivale a queima ou perda. Estes dados não identificam o motivo de cada reinjeção nem a composição do gás por campo. |
| Aproveitamento, situação | Sem dado significa que uma parcela não foi publicada. Balanço inconsistente significa que as parcelas existem, mas a diferença ultrapassa a tolerância declarada. Nenhuma dessas situações é zero. |
| Importação, antes das medidas | A participação importada usa como base o gás importado mais o gás disponível da produção nacional. Essa soma não mede a demanda final. Os registros da ANP em volume e do Comex Stat em massa permanecem separados. |
| Preços, antes da comparação | A série brasileira inclui impostos. As referências internacionais têm outra base tributária e outros pontos de entrega. Colocar as séries na mesma moeda e unidade não elimina essas diferenças. |
| Preços, mercados | Mercado térmico reúne vendas para geração de eletricidade. Mercado não térmico reúne os demais usos registrados nesse conjunto. A diferença entre as médias não permite identificar, sozinha, o efeito de contratos, tributos ou transporte. |
| Preços, unidade | MMBtu é uma medida de energia. Metros cúbicos medem volume. Converter volume em energia exige condições de referência e poder calorífico compatíveis com o gás observado. |
| GLP, explorador | Escolha uma UF para comparar sua série com a média Brasil. Mínimo e máximo são preços encontrados na amostra, não um intervalo de confiança nem limites de todo o mercado. A correção pela inflação usa o IPCA geral e a base indicada. |
| GNV, título | Quanto custa o GNV e como varia o preço do gás encanado? |
| GNV, abertura | O preço do GNV é observado na pesquisa de postos. Para o gás encanado, esta página mostra a variação do IPCA, não uma tarifa nacional. A tarifa depende da distribuidora, da faixa de consumo e das regras locais. |
| Mercado, antes da série | O carregador contrata capacidade para movimentar gás. A transportadora opera a malha. A distribuidora presta o serviço local. Uma empresa pode atuar em mais de uma malha, por isso as contagens por transportadora não devem ser somadas. |
| Infraestrutura, antes dos elos | Produção nacional e importação são entradas distintas. O gás nacional pode passar por escoamento e processamento; o GNL importado passa por regaseificação. Transporte e distribuição são etapas diferentes, e um ato de autorização não comprova operação atual. |
| Regulação, abertura | As regras federais e estaduais têm objetos diferentes. A ANP regula as atividades de sua competência; os estados organizam os serviços locais de gás canalizado. O texto oficial de cada ato é a referência para sua aplicação. |
| Dados, início | Para conferir uma medida, encontre seu período, unidade e fonte. A fórmula explica a transformação feita pelo observatório. O arquivo original e seu hash permitem identificar o snapshot utilizado. |
| Metodologia, ausência | Um valor observado foi publicado pela fonte. Um valor calculado resulta de uma fórmula declarada. Uma lacuna não é uma medição de zero. Quando a cobertura é insuficiente, a comparação fica indisponível. |

Figuras explicativas: o fluxo físico deve usar entradas paralelas para produção e importação; relações contratuais devem ligar carregador e transportadora por contratação, sem larguras proporcionais; a figura regulatória deve separar competência federal e estadual, sem representar hierarquia entre preços. Nenhuma seta deve sugerir causalidade econômica que a base não identifica.

## 5. Fichas dos interativos priorizados

Os estados comuns são: padrão com seleção válida da gold; carregamento apenas durante hidratação, sem substituir dados por zero; ausência textual; quebra ou reprovação indicada por texto e lacuna; seleção extrema preservando escala e unidade; parâmetro inválido com retorno explícito ao padrão. Não há requisição externa no cliente. Controles nativos de 44 px, foco visível, tabelas equivalentes e ausência de animação são a base de acessibilidade.

### I1. Balanço por mês, prioridade imediata, M

**Pergunta:** como se distribui a produção no mês escolhido? **Aprendizagem:** distinguir composição e fechamento do balanço entre meses, inclusive meses incompletos ou reprovados. **Dados:** `aproveitamento.serie`, com unidade milhões de m³/dia, percentuais e situação; fontes ANP já catalogadas. **Reuso:** `GraficoBarras`, `TabelaGas`, `FonteFigura`, `formato.ts`. **Estados:** último mês no padrão; seletor validado; incompleto e inconsistente não desenham parcelas; produção zero não permite participação; erro de seleção usa padrão explicado. **Acessibilidade:** select com label, situação anunciada, tabela com cabeçalhos, nenhum hover necessário. **Celular:** controle e tabela de duas colunas, figura abaixo. **Aceite:** selecionar julho de 2005 mostra a reprovação sem transformar parcelas em zero; voltar ao mês válido restaura valores da gold. **Limite:** não promete GNL e gasoduto em volume separados nem fluxo até consumo final.

### I2. Preços no estado, prioridade imediata, M

**Pergunta:** como o preço da UF evolui em relação à média Brasil? **Aprendizagem:** a seleção muda trajetória e cobertura; extremos do último mês não são intervalo de confiança. **Dados:** `serie_uf`, `serie`, `por_uf`, `ultimo_mes` de GLP ou GNV. **Reuso:** `SeriePorUf`, `GraficoLinhas`, formatação existente. **Estados:** UF padrão declarada; URL inválida informa padrão; mês sem observação mantém lacuna; UF sem preço no último mês mostra ausência. **Acessibilidade:** label, foco, anúncio da UF e resumo; tabela equivalente da série. **Celular:** seleção acima do gráfico e resumo em uma coluna. **Aceite:** selecionar uma UF, recarregar e voltar no histórico preserva a escolha; mínimo, máximo, média e amostra coincidem com a gold. **Limite:** nominal estadual e real Brasil já existem, mas real estadual e distribuição histórica requerem novos campos calculados no pipeline; ficam para etapa seguinte, sem conversão no cliente.

### I3. Comparação internacional com bases explícitas, P

**Pergunta:** como evoluem referências com bases distintas? **Aprendizagem:** mesmo mês e moeda não garantem equivalência tributária. **Dados:** `precos.internacional`, indicadores e PTAX. **Reuso:** `GraficoLinhas` com legenda interativa e seleção temporal. **Estados:** padrão mostra todas as séries, lacunas preservadas, seleção de período validada; não existe estado de imposto removido. **Acessibilidade:** aviso anterior à figura, nomes completos e tabela. **Celular:** aviso e legenda quebram linhas sem ocultar a base. **Aceite:** preço brasileiro sempre identificado com impostos; nenhuma opção fictícia de preço líquido. **Esforço:** P.

### I4. Aproveitamento por UF, M para recorte atual, G para história

**Pergunta:** como a composição da UF difere do Brasil no mesmo período? **Aprendizagem:** participação estadual não é contribuição ao total nacional. **Dados:** `aproveitamento.por_uf` e indicadores nacionais, sem série estadual histórica publicada. **Reuso:** seletor de `SeriePorUf`, barras e tabela. **Estados:** cobertura ausente impede percentuais; seleção extrema mantém escala percentual; histórico indisponível com explicação. **Acessibilidade:** tabela comparativa e seleção nativa. **Celular:** Brasil e UF em linhas consecutivas. **Aceite:** mesmo período e denominador explícito; não preencher UF ausente. **Condição:** confirmar regra de ausência estadual antes da série histórica.

### I5. Linha do tempo regulatória, M

**Pergunta:** que ato mudou a regra de cada elo? **Aprendizagem:** distinguir transporte e distribuição e consultar o ato correspondente. **Dados:** marcos oficiais já citados em `regulacao/page.tsx`; novos campos elo e esfera são classificação editorial, não estatística. **Reuso:** `SecaoGas`, links e select. **Estados:** todos os marcos, filtro vazio com mensagem, ato revogado identificado, link indisponível sem substituir documento. **Acessibilidade:** lista ordenada sem arrasto obrigatório; foco em links; filtro anunciado. **Celular:** lista vertical. **Aceite:** filtro não muda datas ou vigência; cada afirmação tem artigo oficial conferido. **Condição:** reconferir textos oficiais antes de ampliar a classificação.

### I6. Teste seu entendimento, P por página

**Pergunta:** o que esta medida permite concluir? **Aprendizagem:** reconhecer denominador, unidade e limites. **Dados:** conceitos e, quando houver números, apenas a seleção da gold. **Reuso:** `NotaGas` e controles nativos. **Estados:** sem resposta, alternativa escolhida, explicação, reinício; indisponibilidade da gold remove pergunta numérica. **Acessibilidade:** fieldset e legend, resposta anunciada, sem temporizador. **Celular:** opções verticais. **Aceite:** resposta e explicação derivam do conteúdo da página; sem placar de desempenho ou valores fixos. **Exemplo:** a participação importada mede demanda final? Resposta: não, o denominador é importado mais disponível nacional.

### I7. Conversor físico, bloqueado, G

**Pergunta:** quanto uma quantidade representa em outra unidade? **Aprendizagem:** dependência de composição, pressão, temperatura e poder calorífico. **Dados:** fator oficial exato, licença, vigência e condições não verificados; fontes candidatas ANP, EPE e INMETRO listadas acima. **Pipeline:** cadastro de fatores versionados, unidade dimensional e propagação das condições; hipótese digitada pelo leitor separada de observação. **Reuso:** controles e formatação, sem biblioteca nova. **Estados:** nenhum fator padrão inventado; incompatível, ausência e entrada inválida explícitos. **Acessibilidade/celular:** campos com unidade e erro associado, uma coluna. **Aceite:** nenhuma conversão publicada antes de fonte e teste dimensional. Não implementar nesta entrega.

### I8. Mapa físico da infraestrutura, bloqueado, G

**Pergunta:** onde estão ativos e conexões documentados? **Aprendizagem:** proximidade não prova conexão ou capacidade disponível. **Dados:** geometria oficial, licença e atualização ainda não verificadas; registro de atos atual não fornece geometria. **Pipeline:** guardar arquivo geográfico e hash, identificador estável, vigência e unidade da capacidade. **Reuso:** `MapaCoropletico` apenas onde adequado; SVG e tabela para pontos e linhas, sem mapa comercial novo. **Estados:** carregamento de geometria, falha, ativo sem coordenada, cobertura parcial, seleção válida; capacidade desconhecida nunca zero. **Acessibilidade:** tabela por ativo com mesmo conteúdo, teclado e sem zoom obrigatório. **Celular:** lista alternativa antes do mapa. **Aceite:** todo ponto rastreável a geometria oficial e licença; nenhuma coordenada estimada. Não implementar nesta entrega.

## 6. Backlog por impacto e esforço

| Prioridade e frente | Arquivos | Critério de aceite | Verificação |
| --- | --- | --- | --- |
| P0 metodologia, M | `pipeline/gas/gold.py`, `validacoes.py`, `base.py`, tipos, gold e CSV | Janelas incompletas não publicam soma; balanço separa ausência e inconsistência; natureza de atos correta | `pipeline/tests/test_gas.py`: meses removidos, zero legítimo, dispêndio ausente, índice interrompido, igualdade CSV |
| P0 metodologia, M | inicial, modelo de fluxo na gold | Nenhuma composição entre janelas diferentes; escala contém ambas as barras; fontes e fórmulas dos novos totais | Python para composição e incompatibilidade; Vitest para condição de exibição |
| P1 visual, P | `Blocos.tsx`, layout e CSS do gás | Fonte e ressalva visíveis; tokens do contrato restritos ao gás; foco e controles legíveis | Capturas nas quatro larguras, contraste calculado; teste de renderização relevante |
| P1 didática, P | navegação, aberturas e metodologia | Títulos não prometem reservas ou tarifa residencial; definições no ponto de uso; percurso disponível | Revisão editorial e renderização sem alteração de autenticação |
| P1 interativos, M | novo explorador de balanço, `SeriePorUf.tsx`, páginas GLP e GNV | Estado na URL, seleção válida, ausência e inconsistência legíveis; tabela equivalente | Vitest de seleção e estados; navegador com recarga e histórico |
| P2 interativos, M | aproveitamento estadual e gold | Comparação apenas com cobertura documentada | Fixture de UF ausente e validação do denominador; depende da fonte |
| P2 didática, M | regulação e perguntas de entendimento | Artigos oficiais conferidos e perguntas sem valores fixos | Revisão das fontes e teclado; aguardam consulta documental |
| P2 metodologia, G | cobertura estadual, Comex e dados adicionais | Ausência de atividade distinta de ausência de captura | Testes com manifestos de cobertura e registros ausentes |
| Bloqueado | conversor e mapa físico | Fator ou geometria oficial, licença e vigência | Testes dimensionais ou geográficos após aquisição |

Implementação inicial: frentes P0 e P1, em quatro ramos e PRs encadeados quando houver dependência. Dados novos sem fonte permanecem no backlog. O contrato passa a declarar `incompleto` no balanço e eventual composição calculada adicional; a versão e os testes devem acompanhar. As mudanças de saneamento existentes ficam no checkout original.

Antes de cada push: `npx tsc --noEmit`, `npx next lint`, `npx vitest run` e `python3 -m unittest pipeline.tests.test_gas`. O Vitest pode usar dois workers para respeitar a memória do ambiente. Nenhum arquivo deve ser editado durante a suíte por causa da proteção de worktree do projeto.

## 7. O que não foi possível verificar

1. Nova consulta documental completa das fontes primárias. As tentativas HEAD das 18 fontes e da Lei do Gás falharam: ANP retornou 403; Comex, BCB e Banco Mundial tiveram CONNECT negado com 403; IBGE retornou 500; Planalto excedeu o tempo. HEAD malsucedido não prova que o documento inexiste. Não foram substituídos por fontes secundárias ou números do anexo.
2. Autenticidade dos dados perante a fonte atual e todas as revisões históricas. Os hashes e a reconstrução conferem o snapshot guardado; recortes não reconstituem integralmente a planilha original. Todos os valores de referência do anexo coincidem com a gold local, mas essa concordância não é comprovação externa independente.
3. Licenças específicas, estabilidade e disponibilidade das fontes novas propostas. Portais oficiais candidatos não equivalem a um conjunto adquirido.
4. Fatores de conversão física, geometria de infraestrutura, composição tributária completa e causas de reinjeção por campo. Nenhum valor foi estimado para preencher essas lacunas.
5. Auditoria com leitor de tela real, daltonismo e todos os estados de teclado. Capturas e ausência de transbordamento não certificam acessibilidade.
6. Experiência autenticada do site de produção. A avaliação usa código e servidor local com sessão de desenvolvimento; acesso público e restrito serão testados sem alterar a política.
7. Criação de PR: leitura e fetch por Git funcionam; `gh auth status` acusa token inválido. A publicação ainda precisa de tentativa concreta após implementação e testes. O resultado será registrado na entrega, sem afirmar PR criado antes disso.
