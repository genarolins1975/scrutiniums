# Metodologia do piloto: Educação municipal nas capitais

Versão metodológica 1.0, catálogo de 08/10/2026. As fichas completas (16 campos) estão em `pipeline/eficiencia/catalogo_indicadores.json` e na seção Métodos e fontes do painel.

## 1. Universo e perímetros

* **Universo elegível**: os 26 municípios capitais de estado. Códigos IBGE conferidos contra a lista de entes do Siconfi (validação V01).
* **Fora do universo**: Distrito Federal. Não há prefeitura nem rede municipal; a rede pública de Brasília é distrital (dependência "Estadual" no Censo Escolar) e a despesa distrital reúne competências de estado e de município.
* **Rede municipal**: escolas com `TP_DEPENDENCIA = 3` localizadas no município. Escolas estaduais, federais e privadas na capital não entram.
* **Escolas privadas conveniadas com o município**: `TP_DEPENDENCIA = 4`, `IN_PODER_PUBLICO_PARCERIA = 1`, `TP_PODER_PUBLICO_PARCERIA = 1` (até 2021, `IN_CONVENIADA_PP` e `TP_CONVENIO_PODER_PUBLICO`). Mostradas ao lado da rede, nunca somadas a ela. Parceria simultânea com estado e município (código 3) fica fora do indicador.

## 2. Recursos

* **Fonte**: DCA, Anexo I-E (Despesa por Função), Siconfi.
* **Estágio**: liquidado. Empenhado, liquidado e pago não se somam. Restos a pagar não processados inscritos no exercício não estão no liquidado.
* **Perímetro**: função 12 (Educação), qualquer subfunção, despesas exceto intraorçamentárias (a DCA traz as intraorçamentárias em linha separada e sem abertura por função).
* **Correção monetária opcional**: valor × (média do número-índice IPCA de 2025 ÷ média do ano). IPCA do IBGE, tabela 1737, variável 2266; média aritmética dos 12 meses. Fatores publicados na gold com 10 casas decimais.
* **Conferência cruzada**: RREO do 6º bimestre, Anexo 02, despesa liquidada até o bimestre na função Educação, exceto intraorçamentárias. Resultado em 130 pares: 125 iguais até R$ 1,00; 3 diferenças inferiores a 0,03%; 2 materiais:
  * Campo Grande 2021: diferença de R$ 124.200.913,05, igual ao bloco intraorçamentário do RREO. A declaração incluiu intraorçamentárias na função Educação. O valor fica na série e na tabela, marcado como **não comparável**, fora da comparação entre capitais.
  * Boa Vista 2024: RREO com R$ 122.547.917,75 liquidados, incompatível com o empenho do próprio RREO e com a DCA (R$ 658.077.936,34). Diferença não explicada por conceito, período ou perímetro; o painel usa a DCA e registra a divergência na tabela e na validação V04.
* **Composição**: subfunções da função 12 na DCA (361, 362, 363, 364, 365, 366, 367, 368, 122 e "FU12, demais subfunções"). Publicada só se a soma reconcilia com o total (tolerância R$ 1,00). Exibida em barras de cor única na ordem da classificação funcional, não pelo valor.

## 3. Atendimento

* **Matrículas**: soma de `QT_MAT_BAS` e das colunas por etapa das escolas do perímetro, nos microdados do Censo Escolar (arquivo de escolas até 2024; `Tabela_Matricula` em 2025).
* **Partição por etapa** (mutuamente exclusiva): creche, pré-escola, anos iniciais, anos finais, ensino médio, EJA e "educação profissional não integrada" = `QT_MAT_BAS` − soma das anteriores. `QT_MAT_PROF` não entra direto porque inclui o técnico integrado ao médio e à EJA (dupla contagem). Educação especial é transversal e já está nas etapas.
* **Conferência independente**: Sinopse Estatística do INEP 2021, 2024 e 2025 (total, creche e pré-escola da rede municipal; conveniadas com o município em 2025). 260 comparações, nenhuma diferença (V06).
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
| DCA com perímetro diferente (intraorçamentárias) | Valor exibido, fora da comparação (não comparável) |

Zero só aparece quando a fonte informa zero (etapa sem matrícula na rede).

## 6. Comparações

* Critério definido antes dos valores: mesma medida, mesma fonte, mesmo ano, mesma etapa, rede municipal; entram as capitais com valor observado e comparável.
* Grupos: todas as capitais ou as capitais da região da capital selecionada.
* Referência: mediana simples das capitais do grupo com valor. Não é estatística nacional nem padrão.
* Ordem inicial alfabética; ordem por valor só quando o leitor escolhe.
* Sem ajuste por contexto: comparação descritiva. Sem gráfico de dispersão entre despesa e resultado (perímetros e períodos não alinhados).

## 7. Despesa por matrícula: avaliada, não publicada

Numerador e denominador não representam o mesmo universo:

1. a despesa pode financiar matrículas em escolas privadas conveniadas, que o Censo registra como privadas (em 2025, de 0,0% a 49,7% das matrículas da rede municipal, mediana de 3,9%; medição M01);
2. a despesa pode incluir itens sem matrícula correspondente (ensino superior, inativos classificados na função, programas de outras etapas), com práticas que variam entre municípios;
3. os períodos diferem (exercício financeiro e data de referência do Censo em maio).

Caminho para a próxima etapa em CONTINUIDADE.md (tarefa T7).
