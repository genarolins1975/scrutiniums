# Metodologia do piloto: Educação municipal nas capitais

Versão metodológica 1.3, catálogo `2026-10-09.1` (histórico: 1.3 na rodada 6, ver [RODADA_6_CONSOLIDACAO_E_BENCHMARKS.md](./RODADA_6_CONSOLIDACAO_E_BENCHMARKS.md); 1.0 na etapa inicial; 1.1 na rodada de correções, ver [RODADA_2_CORRECOES.md](./RODADA_2_CORRECOES.md); 1.2 na rodada 5, ver [COMPARACOES_GASTO_POR_HABITANTE_E_MATRICULA.md](./COMPARACOES_GASTO_POR_HABITANTE_E_MATRICULA.md)). As fichas completas (16 campos) estão em `pipeline/eficiencia/catalogo_indicadores.json` e na seção Métodos e fontes do painel.

## 1. Universo e perímetros

* **Universo elegível**: os 26 municípios capitais de estado. Códigos IBGE conferidos contra a lista de entes do Siconfi (validação V01).
* **Fora do universo**: Distrito Federal. Não há prefeitura nem rede municipal; a rede pública de Brasília é distrital (dependência "Estadual" no Censo Escolar) e a despesa distrital reúne competências de estado e de município.
* **Rede municipal**: escolas com `TP_DEPENDENCIA = 3` localizadas no município. Escolas estaduais, federais e privadas na capital não entram.
* **Universo por indicador**: cada ficha declara o seu (`universo_curto`), e o painel o repete no critério da comparação e nos CSVs. A despesa é do orçamento do município na função 12, não da rede municipal; as matrículas são das escolas de dependência municipal; as conveniadas são de escolas privadas com parceria exclusiva com o município.
* **Escolas privadas conveniadas com o município**: `TP_DEPENDENCIA = 4`, `IN_PODER_PUBLICO_PARCERIA = 1`, `TP_PODER_PUBLICO_PARCERIA = 1` (até 2021, `IN_CONVENIADA_PP` e `TP_CONVENIO_PODER_PUBLICO`). Mostradas ao lado da rede, nunca somadas a ela. Parceria simultânea com estado e município (código 3) fica fora do indicador.

## 2. Recursos

* **Fonte**: DCA, Anexo I-E (Despesa por Função), Siconfi.
* **Estágio**: liquidado. Empenhado, liquidado e pago não se somam. Restos a pagar não processados inscritos no exercício não estão no liquidado.
* **Perímetro**: função 12 (Educação), qualquer subfunção, despesas exceto intraorçamentárias (a DCA traz as intraorçamentárias em linha separada e sem abertura por função).
* **Correção monetária opcional**: valor × (média do número-índice IPCA de 2025 ÷ média do ano). IPCA do IBGE, tabela 1737, variável 2266; média aritmética dos 12 meses. Fatores publicados na gold com 10 casas decimais.
* **Conferência e elegibilidade (política 1.2; a 1.1 somava a MSC em módulo, ver rodada 6)**: cada valor da DCA é comparado com o RREO do 6º bimestre, Anexo 02 (liquidado até o bimestre, função Educação, exceto intraorçamentárias). `d = DCA − RREO`.

  | Situação | Regra | Comparações, medianas e variações |
  | --- | --- | --- |
  | Não conferido | RREO ausente ou sem a linha | Fora |
  | Confere | \|d\| ≤ R$ 1,00 | Dentro |
  | Diferença menor | \|d\| ≤ 0,1% da DCA | Dentro, com nota |
  | Reconciliada pela MSC | MSC de dezembro sem intraorçamentárias = DCA | Dentro, com ressalva |
  | Perímetro distinto | MSC total = DCA e parcela de modalidade 91 > R$ 1,00 | Fora; quebra de série |
  | Pendente | Diferença material sem reconciliação | Fora |

  MSC: Matriz de Saldos Contábeis agregada de dezembro, função 12, contas 6.2.2.1.3.03, .04 e .07 (liquidado), com a modalidade 91 identificando as intraorçamentárias. Coincidência aritmética com o bloco intraorçamentário do RREO não basta. A evidência é refeita a cada execução, com sha256 das três fontes; DCA retificada ou exercício novo não herdam reconciliação. Valor real e subfunções herdam a elegibilidade do total. Variação entre anos só entre valores elegíveis.

  Resultado em 130 declarações: 125 conferem; 3 diferenças menores (Boa Vista 2021, Palmas 2021, Macapá 2022); Boa Vista 2024 reconciliada pela MSC (RREO diverge da DCA e da MSC, sem retificação até a captura); Campo Grande 2021 com perímetro distinto (R$ 124.200.913,05 em modalidade 91 dentro da função Educação), publicado para consulta e fora das comparações. Evidências em RODADA_2_CORRECOES.md, seção 3.
* **Composição**: subfunções da função 12 na DCA (361, 362, 363, 364, 365, 366, 367, 368, 122 e "FU12, demais subfunções"). Publicada só se a soma reconcilia com o total (tolerância R$ 1,00). Exibida em barras de cor única na ordem da classificação funcional, não pelo valor.

## 3. Atendimento

* **Matrículas**: soma de `QT_MAT_BAS` e das colunas por etapa das escolas do perímetro, nos microdados do Censo Escolar (arquivo de escolas até 2024; `Tabela_Matricula` em 2025).
* **Partição por etapa** (mutuamente exclusiva): creche, pré-escola, anos iniciais, anos finais, ensino médio, EJA e "educação profissional não integrada" = `QT_MAT_BAS` − soma das anteriores. `QT_MAT_PROF` não entra direto porque inclui o técnico integrado ao médio e à EJA (dupla contagem). Educação especial é transversal e já está nas etapas.
* **Campos vazios**: contagem vazia nos microdados é ausência, não zero (o dicionário do INEP não define vazio como zero). Escola sem contagem só entra como contribuição nula quando a Sinopse do mesmo ano, município e dependência confirma o total; sem confirmação, o agregado fica `INCOMPLETO` e não é publicado como total. Medição M02: registros vazios em 2022, 2023 e 2024, todos os grupos confirmados.
* **Conferência cruzada no próprio INEP**: Sinopse Estatística 2021 a 2025 (total, creche e pré-escola da rede municipal; conveniadas com o município em 2025). 416 comparações, nenhuma diferença (V06). Não é verificação externa: as duas publicações são do INEP.
* **Média de alunos por turma**: indicador oficial do INEP, reproduzido sem recálculo (linha Total, dependência Municipal).

## 4. Resultados educacionais

* **Taxa de aprovação**: oficial do INEP, anos iniciais e finais, rede municipal, ano letivo.
* **Ideb e componentes**: planilhas do Ideb 2025 (série 2005 a 2025), rede municipal: Ideb (`VL_OBSERVADO`), P (`VL_INDICADOR_REND`), N (`VL_NOTA_MEDIA`). Ideb = N × P conferido nas 542 combinações com os três valores (V11).
* **Saeb**: médias de proficiência em Matemática e Língua Portuguesa da mesma planilha. Escalas não se somam entre disciplinas nem entre anos escolares.
* **Metas do Ideb**: não exibidas (primeiro ciclo encerrado em 2021; a exibição induziria leitura de cumprimento).
* **Quebras anotadas**: 2021 (pandemia de covid-19) no Ideb, no Saeb e na aprovação, conforme nota informativa do INEP sobre o Ideb 2021.

## 5. Estados de dado e ausências

| Situação na fonte | Estado no painel |
| --- | --- |
| Célula `--` no ATU ou nas taxas e a rede não tem matrícula na etapa no Censo do mesmo ano | Não aplicável |
| Célula `--` com matrícula na etapa | Não divulgado |
| `-` no Ideb ou Saeb | Não divulgado (ou não aplicável, nas edições 2021+, se o Censo confirma zero matrícula na etapa) |
| `ND`, `ND*`, `ND***` | Não divulgado, com a legenda do INEP |
| Captura ausente | Ausente na coleta |
| Composição que não reconcilia | Inconsistente (não exibida) |
| DCA com perímetro distinto ou conferência pendente | Valor oficial exibido com ressalva, fora de comparações, medianas e variações |
| Contagem vazia sem confirmação da Sinopse | Incompleto (soma parcial não publicada como total) |

Zero só aparece quando a fonte informa zero (etapa sem matrícula na rede).

## 6. Comparações

* Critério definido antes dos valores: mesma medida, mesma fonte, mesmo período, mesma etapa, universo do indicador; entram as capitais com valor observado e elegível.
* Uma regra só para gráfico, mediana, tabela e CSV. O painel mostra três contagens: capitais no grupo, com valor oficial e na comparação; as demais aparecem listadas com estado, valor oficial quando houver e motivo.
* Grupos: todas as capitais ou as capitais da região da capital selecionada.
* Referências do grupo (rodada 5): mediana, média simples, mínimo e máximo com empates, quartis tipo 7 (faixa dos 50% centrais exibida a partir de 8 valores) e, para despesa por habitante e por matrícula, a razão agregada (soma dos numeradores ÷ soma dos denominadores dos mesmos pares). Rotuladas com o número de capitais. Não são estatística nacional, meta nem padrão. Média simples, razão agregada e indicador nacional são grandezas distintas e nunca se confundem.
* Referências externas: nacional do mesmo universo gera diferença; nacional de outro universo e contexto internacional são mostrados sem diferença e fora da distribuição das capitais; incompatíveis ficam só na matriz.
* Ordem inicial alfabética; ordem por valor só quando o leitor escolhe.
* Sem ajuste por contexto: comparação descritiva. Sem gráfico de dispersão entre despesa e resultado (perímetros e períodos não alinhados).

## 7. Despesa por habitante e razão por matrícula (rodadas 5 e 6)

* **Despesa por habitante**: despesa liquidada na função 12 (DCA) ÷ população residente do IBGE do mesmo ano (estimativa 2021, Censo 2022, relação do DOU de 31/08/2023 para 2023, estimativas 2024 e 2025; a população de 2023 é censitária, a mesma de 2022, e não estimativa de julho de 2023). A população de 2021 e a de 2023 têm outra base: variações que as envolvem são bloqueadas.
* **Razão da despesa de aplicação direta por matrícula da rede municipal** (`edu.despesa.aplicacao_direta_por_matricula`; substitui `edu.despesa.por_matricula_rede_propria`): despesa liquidada de aplicação direta (modalidades 90, 93 e 94) na função 12, na MSC de dezembro em saldo líquido, sem a subfunção 364 e sem os elementos 01, 03 e 05 do grupo 3.1, ÷ `QT_MAT_BAS` das escolas municipais. A parcela de beneficiário indeterminado (elementos 18, 39, 41, 45, 48 e compras de consórcio) é medida e publicada, sem limite de aceitabilidade. Regra de atribuição única das linhas da MSC a baldes mutuamente exclusivos, ponte conferida contra a DCA. Sem soma de conveniadas ao denominador, sem rateio por etapa, sem uso do SIOPE (examinado e não adotado).
* Publicada em 123 de 130 pares capital × exercício; nos 7 restantes, a causa do par. Referência nacional da despesa por habitante calculada pelo OBEE (2025, 5.060 municípios). Detalhes, cobertura, matriz de referências e limitações em [COMPARACOES_GASTO_POR_HABITANTE_E_MATRICULA.md](./COMPARACOES_GASTO_POR_HABITANTE_E_MATRICULA.md).
* A definição anterior, "despesa da função inteira ÷ matrículas totais" (`edu.despesa_por_matricula`), continua **não publicada**: numerador e denominador não representam o mesmo universo (conveniadas, itens sem matrícula, períodos diferentes; medição M01).
