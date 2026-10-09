# Saúde nas capitais: validações, reconciliações e reprodução

Estado em 09/10/2026, depois da rodada 1 de correções. Gold: `hash_dados` `ce882081d96f44d5`, catálogo 2026-10-09.1, pipeline `obee-saude-0.1.0`, 8.777 observações. Nenhuma validação reprovada.

## 1. Validações automáticas e medições

Rodam em toda reconstrução (`pipeline/eficiencia_saude/validacoes.py`). Uma reprovada impede a promoção da gold e mantém a última versão válida. Medições quantificam fatos que sustentam decisões e não aprovam nem reprovam.

| Id | O que confere | Resultado | Fato medido |
| --- | --- | --- | --- |
| S01 | Códigos IBGE das 26 capitais e do DF contra a lista de entes do Siconfi | Aprovada | 27 entes marcados como capital no Siconfi; 26 capitais municipais e o DF fora, com motivo |
| S02 | DCA: soma das subfunções igual à função Saúde | Aprovada | 130 declarações; 0 fora da tolerância de R$ 1,00 |
| S03 | Conferência da despesa: DCA × RREO do 6º bimestre e, na diferença material, MSC de dezembro | Regra aplicada, com pendências | 125 conferem; 2 com diferença abaixo de 0,1%; 1 reconciliada pela MSC (Boa Vista 2024); 1 de perímetro distinto (Campo Grande 2021); 1 pendente (Macapá 2025) |
| S04 | Natureza da despesa: três categorias reproduzem a DCA | Aprovada, com divergências documentadas | 116 de 130 pares publicados; 14 sem abertura, com a diferença registrada e nenhuma categoria estimada |
| S05 | ASPS (Anexo 12): III = I + II e XVI = XII − XIII − XIV − XV | Aprovada | 130 demonstrativos; 0 divergências |
| S06 | Percentual ASPS reproduz XVI ÷ III | Aprovada | 130 percentuais; 0 fora da tolerância de 0,011 ponto percentual; 0 abaixo do mínimo informado |
| S07 | Despesa por fonte: as nove fontes reproduzem o total | Aprovada, com divergências documentadas | 128 de 130 fecham; Fortaleza e São Paulo em 2021 sem valor publicado |
| S08 | Cobertura potencial reproduz a fórmula da Nota Técnica nº 2/2025 | Aprovada | 104 valores de dezembro (2022 a 2025) reproduzidos; 2021 fora das comparações |
| S09 | ICSAP: soma dos 19 grupos igual ao total; participação até 100% | Aprovada | 104 pares; 0 divergências |
| S10 | Estados de dado: só observado tem valor | Aprovada | 8.777 observações; 44 sem valor, todas com motivo |
| S11 | Elegibilidade: só observado e conferido entra em comparações | Aprovada | 44 com valor oficial fora das comparações |
| S12 | Nenhuma observação do Distrito Federal | Aprovada | |
| S13 | Uma observação por indicador, capital, ano e componente | Aprovada | |
| S14 | Despesa por habitante recalculada, elegibilidade herdada | Aprovada | 260 valores; 2 pares fora por herança (Campo Grande 2021, Macapá 2025) |
| S15 | Razões por população recalculadas do numerador e do denominador | Aprovada | 1.222 observações; 0 fora da tolerância |
| S16 | Indicadores não publicáveis sem observação, arquivo e com motivo | Aprovada | 3 indicadores avaliados e não publicados |
| M01 | MSC: soma em módulo × saldo líquido | Medição | 52 de 130 MSC com linhas D; a soma em módulo difere do saldo líquido em 34; o saldo líquido é a regra |
| M02 | Ordem dos estágios da despesa | Medição | 1 declaração com ordem violada na própria fonte; o módulo usa o liquidado |
| M03 | UBS: API × retrato do arquivo diário | Medição | 5 capitais com contagens diferentes entre as duas competências; datas de referência distintas |
| M04 | População do RIPSA × população do OBEE | Medição | Mediana de +3,3%, de −10,7% a +11,1%; as duas taxas são publicadas |
| M05 | Cobertura potencial: troca da base da população de referência entre dezembro de 2022 e dezembro de 2023 | Medição | A população de referência cai 8,5% em mediana (de −16,6% a +4,4%); a mediana da cobertura vai de 62,2% a 76,9%, e 9,1 dos 14,6 pontos percentuais vêm só do denominador. Dezembro de 2022 e de 2023 não são comparáveis como variação |

Os testes automatizados também injetam defeitos: uma observação do DF faz S12 reprovar; um valor numérico em observação inconsistente é percebido; promover uma gold reprovada não toca a saída pública.

## 2. Reconciliações e casos tratados

| Caso | Tratamento |
| --- | --- |
| Boa Vista 2024 | A DCA (R$ 503,2 milhões) é mais de cinco vezes o RREO exceto intraorçamentárias (R$ 93,5 milhões); a MSC (saldo líquido, sem modalidade 91) reproduz a DCA. Entra na comparação, com nota material e a DCA não retificada |
| Campo Grande 2021 | A MSC mostra a modalidade 91 dentro do valor da DCA: perímetro distinto. Valor oficial disponível; fora de comparações, medianas e variações, com quebra de série |
| Macapá 2025 | Diferença material: a MSC sem a modalidade 91 (R$ 503.269.686,89) é igual ao RREO e a DCA (R$ 495.269.686,89) é R$ 8.000.000,00 menor, a única das três fontes com valor distinto. Valor oficial disponível, fora das comparações; natureza não publicada. O OBEE não corrige a DCA |
| Natureza em 14 pares | A abertura por natureza não reproduz a DCA; nenhuma categoria é estimada nem completada. A nota distingue MSC sem registros (São Luís 2022 e 2023, Rio de Janeiro 2022), MSC com linhas sem natureza identificável (Florianópolis 2022 e 2023) e MSC que não fecha |
| Despesa por fonte, Fortaleza e São Paulo 2021 | A soma das fontes difere do total informado (R$ 849.201,92 em Fortaleza e R$ 859.458,68 em São Paulo); contexto sem valor |
| População por exercício | Três bases: 2021 é estimativa anterior ao Censo 2022; 2022 e 2023 usam a mesma população do Censo 2022 (a relação do DOU de 2023 repete a de 2022 nas 26 capitais); 2024 e 2025 são estimativas posteriores ao Censo. A variação por habitante só é calculada dentro da mesma base: 2022 para 2023 e 2024 para 2025. As passagens 2021 para 2022 e 2023 para 2024 ficam bloqueadas |
| Cobertura potencial de 2021 e 2022 | Dezembro de 2021 segue regra anterior à Nota Técnica nº 2/2025 e fica fora das comparações. A população de referência de dezembro de 2022 é anterior ao Censo 2022: a variação entre dezembro de 2022 e dezembro de 2023 é bloqueada (M05) |
| ICSAP e população | A taxa principal usa a população do próprio RIPSA; a taxa de sensibilidade usa a população do exercício (IBGE). Diferença mediana de 3,3% |
| CNES | Retrato do arquivo diário (UBS por natureza e gestão) e histórico por estabelecimento (série de dezembro). Cinco capitais diferem entre as duas fontes na competência mais recente |

## 3. Exemplos de reprodução

Todos usam só arquivos do repositório (`pipeline/eficiencia_saude/seed/`, gold e CSVs) e as fórmulas do catálogo.

**Despesa por habitante, São Paulo, 2025.** Linha `10 - Saúde`, coluna `Despesas Liquidadas`, do Anexo I-E da DCA de 2025 (código 3550308): R$ 23.342.248.911,99 (seed `siconfi/dca_anexo_i_e/3550308_2025.json.gz`). População de 1º de julho de 2025 (IBGE, SIDRA 6579, variável 9324): 11.904.961. Razão: 23.342.248.911,99 ÷ 11.904.961 = R$ 1.960,72 por habitante. Em reais de 2025 o fator é 1,0000 (a série em reais de 2022, por exemplo, multiplica por 1,1464).

**ICSAP, São Paulo, 2024.** RIPSA MRB.4.02, município de residência 355030, ano 2024: 83.391 internações. População estimada do indicador: 11.895.578. Taxa: 83.391 ÷ 11.895.578 × 100.000 = 701,03 por 100 mil habitantes. A soma dos 19 grupos de causa reproduz as 83.391 internações (validação S09).

**Cobertura potencial da APS, São Paulo, dezembro de 2025.** Equipes registradas: 1.723 eSF, 336 eAP de 20 horas e 160 eAP de 30 horas, mais pessoas com cadastro vinculado de eCR e eAPP. Capacidade: 1.723 × 3.500 + 336 × 1.750 + 160 × 2.625 + cadastro vinculado = 7.074.342. População de referência do Ministério: 11.895.578. Cobertura potencial: 59,47%. É capacidade teórica das equipes, não pessoas atendidas, e o serviço não limita o valor a 100%.

**Percentual aplicado em ASPS, Recife, 2025.** SIOPS, RREO Anexo 12, 6º bimestre: valor aplicado em ASPS (XVI) R$ 1.111.965.826,08 ÷ receita de impostos e transferências (III) R$ 5.628.463.971,49 = 19,756%. O SIOPS informa 19,75 (valor truncado) e é esse o percentual publicado. O mínimo de 15% (LC 141/2012, art. 7º) é referência normativa, não meta.

**Reconstruir tudo.**

```bash
python3 -m pipeline.eficiencia_saude.run          # sem rede; imprime S01 a S16 e M01 a M05
python3 -m pipeline.eficiencia_saude.documenta    # regenera CATALOGO_COBERTURA_FORMULAS.md
python3 -m unittest pipeline.tests.test_eficiencia_saude
npx vitest run src/tests/obee-saude.test.ts
```

Cada linha de cada CSV traz registro de origem, versão metodológica, `dados_gerados_em` e `hash_dados`, e o hash é recalculável a partir das observações.

## 4. Testes

| Arquivo | Cobertura |
| --- | --- |
| `pipeline/tests/test_eficiencia_saude.py` (56 testes) | Reconstrução idempotente; gold publicada igual ao seed; 26 capitais e DF fora com motivo de Saúde; despesa lida da resposta preservada no estágio liquidado; reais constantes; por habitante; população de 2021; casos Campo Grande, Boa Vista e Macapá; herança de inelegibilidade; subfunções e natureza que reconciliam; despesa por fonte inconsistente; ASPS; contagens do CNES; cobertura potencial; ICSAP; ausência nunca vira zero; fichas completas; indicadores não publicáveis; referências só com elegíveis; download igual à gold; isolamento de Educação; promoção atômica; política de conferência; validações que reprovam defeitos injetados; razão agregada na unidade do indicador e dentro do intervalo do grupo; bases da população e marcas de quebra; troca de base da cobertura potencial (M05); notas de natureza que distinguem ausência de zero; CSV com fonte legível, números limpos e dicionário completo; textos sem causalidade implícita |
| `src/tests/obee-saude.test.ts` (67 testes) | Payload por página; indicadores não publicáveis fora da interface; regras de comparação (Macapá 2025, Campo Grande 2021, mediana dos incluídos, recorte regional, ordenação); CSV da comparação igual à tabela; quebras de série e variação por base; composições agregadas com universo e capitais fora da soma; razão agregada na unidade; diferenças em pontos percentuais; CSV da série e metadados das exportações; aviso do período; medidas; frases; rotas e sitemap; neutralidade de texto e cores; isolamento de Educação |
| `src/tests/html-gerado.test.ts` | Com `EXIGIR_BUILD_HTML=1`: sem data ISO crua, `undefined` nem `NaN` nas seis páginas de Saúde e na entrada |
| `src/tests/obee-educacao.test.ts`, `dois-observatorios.test.ts` | Regressão de Educação e da integração ao site |

Estado verificado em 09/10/2026: suíte `vitest` completa (143 arquivos, 2.745 testes aprovados antes das últimas edições, 4 ignorados por exigirem build), testes Python de Educação e de Saúde aprovados (144), `tsc` e `lint` sem erros, `next build` concluído, gate de HTML aprovado.

## 5. Verificação visual e de interação

Capturas e medições em 320, 390, 768 e 1440 px das sete rotas (entrada e seis do módulo): nenhuma com rolagem horizontal da página, nenhum erro de console, um `h1` por página, todos os campos com rótulo. A primeira tela a 1440 por 900 mostra o gráfico principal em Gastos, Rede e APS, Resultados e Comparar; no Panorama, o primeiro visual (despesa por habitante) começa a cerca de 570 px de altura. Alvos de toque menores que 44 px restam no rodapé do site e no link inline de CSV da ficha, ambos componentes compartilhados fora do módulo.
