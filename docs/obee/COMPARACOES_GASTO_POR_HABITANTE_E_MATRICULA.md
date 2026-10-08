# Rodada 5: comparações de gasto por habitante e por matrícula

Painel: Educação municipal nas capitais (`/eficiencia-estatal/educacao-municipal-capitais`). Pipeline: `pipeline/eficiencia`, versão `obee-0.2.0`, catálogo `2026-10-08.3`, metodologia 1.2. Data de referência de todas as coletas e cálculos: 08/10/2026. Valores em R$ correntes, salvo indicação.

## 1. O que mudou para o leitor

| Problema do leitor antes | O que o painel faz agora | Onde |
| --- | --- | --- |
| O gráfico da despesa total esticava o eixo até R$ 23,6 bilhões (São Paulo) e as outras 25 capitais ficavam comprimidas à esquerda | Alternância entre **total**, **por habitante** e **por matrícula**, cada uma com eixo próprio, linear, começando em zero. São Paulo permanece visível nas três. O total continua disponível para quem quer o volume orçamentário | Seletor "Medida" e controle de escala da despesa |
| Não havia como comparar cidades de portes diferentes | Despesa por habitante: 26 capitais em 2022, 2024 e 2025, 25 em 2021 | Gráfico e tabela |
| Despesa por estudante estava bloqueada ("universos incompatíveis") e a coluna ficava vazia | Despesa de aplicação direta por matrícula da rede municipal, com ponte da DCA ao numerador e valor publicado em 102 de 130 pares capital × exercício. Nos 28 restantes, o motivo específico de cada par | Gráfico, ponte (`#decomposicao`), tabela |
| Uma mediana dos valores absolutos não situava a capital | Resumo do grupo: mediana, média simples, mínimo e máximo com a capital (e todas as empatadas), faixa dos 50% centrais (a partir de 8 valores) e razão agregada, com o número de capitais que participam | Abaixo de cada gráfico e em `#referencias` |
| Média simples e razão agregada se confundiam | Os dois números aparecem com nomes distintos e a conta da razão (soma do numerador ÷ soma do denominador dos mesmos pares) | Resumo do grupo |
| Faltava ver gasto, população, matrículas e resultados lado a lado | Tabela comparativa com 9 colunas, cabeçalho por grupo, ordenação, coluna da capital fixa, visões por grupo de colunas e CSV | `#tabela-comparativa` |
| Referências nacionais e internacionais não existiam ou se misturavam | Matriz de 12 candidatas examinadas, 6 aceitas ou contextuais e 6 rejeitadas, com motivo. Referência nacional do mesmo universo gera diferença; contexto internacional e outro universo nunca geram | `#referencias`, `#matriz-referencias` |
| O leitor não via o que entrou e o que ficou fora da despesa por matrícula | Ponte: total da DCA repartido em parcelas mutuamente exclusivas, com soma conferida | `#decomposicao` |

Capturas antes e depois: `docs/obee/capturas/rodada-5/` (24 arquivos, prefixos `antes-` e `depois-`; "antes" é o HEAD `ca6089142`). O par que demonstra o problema original: `antes-comparacao-despesa-sp-1440.png` contra `depois-comparacao-habitante-1440.png` e `depois-comparacao-matricula-1440.png`.

## 2. Definições e cobertura

### 2.1 Despesa por habitante (`edu.despesa.por_habitante`)

* Fórmula: despesa liquidada na função 12, Educação, do município (DCA Anexo I E, coluna "Despesas Liquidadas", total geral por função) ÷ população residente do município no mesmo ano (IBGE).
* Não é despesa por aluno, nem tributo por pessoa, nem benefício recebido. A participação da rede municipal na oferta varia entre capitais.
* População (IBGE, SIDRA 6579 e 4714), por ano, sem preencher lacunas:

| Ano | Publicação usada | Referência |
| --- | --- | --- |
| 2021 | Estimativa anterior ao Censo 2022 | 1º de julho de 2021 |
| 2022 | Censo Demográfico | 1º de agosto de 2022 |
| 2023 | **Sem publicação municipal do IBGE**: sem valor, sem interpolação, sem reaproveitar outro ano | não se aplica |
| 2024 | Estimativa posterior ao Censo 2022 | 1º de julho de 2024 |
| 2025 | Estimativa posterior ao Censo 2022 | 1º de julho de 2025 |

* Quebra de série: a população de 2021 tem base distinta (Censo 2010). A despesa por habitante de 2021 entra na comparação do próprio ano, mas a variação entre 2021 e os anos seguintes é bloqueada.
* Revisão: Aracaju 2025 foi publicado como 630.932 e vigora 621.408 no SIDRA; usa-se o valor vigente e registra-se a diferença (validação V14).
* Cobertura: 2021, 26 com valor e 25 na comparação (Campo Grande fora, perímetro distinto, valor oficial R$ 1.125 mostrado com o motivo); 2022, 26 e 26; **2023, 0**; 2024, 26 e 26; 2025, 26 e 26.

### 2.2 Despesa por matrícula (`edu.despesa.por_matricula_rede_propria`)

Rótulo público: "por matrícula", nunca "por aluno". Nome completo: despesa liquidada de aplicação direta por matrícula da rede municipal.

* Numerador: despesa liquidada da função 12 em **aplicação direta** (modalidade 90), na Matriz de Saldos Contábeis (MSC) agregada de dezembro (contas 6221303, 6221304 e 6221307), **menos** a subfunção 364 (ensino superior) e **menos** os elementos 01, 03 e 05 do grupo 3.1.90 (aposentadorias, pensões e outros benefícios previdenciários).
* Denominador: `QT_MAT_BAS` das escolas de dependência municipal (`TP_DEPENDENCIA = 3`) no município, Censo Escolar do ano. Educação básica inteira, de creche à EJA e à educação profissional.
* Regra de atribuição única: cada linha da MSC cai em exatamente um balde, na ordem: (1) modalidade diferente de 90, transferências (50 e 60 a instituições privadas; demais modalidades a outros entes); (2) subfunção 364; (3) inativos; (4) rede própria. A modalidade 91 (intraorçamentária) fica fora do total da DCA (em São Paulo 2025, R$ 3.670.575.154,22, que não entram em nenhuma parcela da tabela do item 2.3).
* O que **não** se faz, por desenho: não soma matrículas de escolas privadas conveniadas ao denominador; não rateia despesa por etapa; não divide a função inteira pela matrícula de parte da rede; não usa o SIOPE.
* Reconciliação: só se publica quando a soma da MSC sem intraorçamentárias fecha com a DCA (diferença até R$ 1,00, ou até 0,1% da DCA, igual à política de conferência 1.1; nesse segundo caso a diferença fica na ponte e não é atribuída a nenhuma parcela). Linha da MSC sem natureza da despesa, acima de R$ 1,00, impede a razão do par.
* Cobertura (publicado, de 26): 2021, 21; 2022, 19; 2023, 18; 2024, 23; 2025, 21. Total 102 de 130. Os 28 pares sem valor trazem a diferença da MSC contra a DCA na nota. Em 2025: Aracaju, Belém, Goiânia, Natal e Palmas.
* Campo Grande 2021 sem valor por matrícula; Boa Vista 2024 mantém a ressalva de reconciliação da DCA com o RREO e tem valor.

### 2.3 Como a ponte conta (São Paulo, 2025)

| Parcela | R$ | % do total |
| --- | --- | --- |
| Total da DCA, função 12, liquidado | 23.584.096.338,05 | 100,0 |
| Fora do numerador: transferências a instituições privadas | 6.703.641.425,41 | 28,4 |
| Fora do numerador: transferências a outros entes e demais modalidades | 188.166.861,79 | 0,8 |
| Fora do numerador: ensino superior (subfunção 364) | 0,00 | 0,0 |
| Fora do numerador: inativos | 0,00 | 0,0 |
| **Dentro do numerador: aplicação direta na rede própria** | **16.692.288.050,85** | **70,8** |

Divisão: 16.692.288.050,85 ÷ 702.936 matrículas = R$ 23.746,53 por matrícula. Por habitante: 23.584.096.338,05 ÷ 11.904.961 = R$ 1.981,03. Os dois números descrevem perímetros diferentes e não se substituem. Fontes: DCA e MSC, Siconfi (STN), coleta de 08/10/2026; população, IBGE; matrículas, INEP.

### 2.4 Referências estatísticas do grupo

Contrato único, calculado no pipeline (`referencias.py`) e conferido por teste exaustivo em TypeScript. Cartões, gráficos, tabela e CSV leem o mesmo valor.

* Universo do grupo: capitais estaduais com valor observado e elegível na política de conferência, no ano e etapa do recorte. Grupos: todas e as cinco regiões.
* **Média simples**: mesmo peso para cada capital. **Razão agregada**: soma dos numeradores ÷ soma dos denominadores dos mesmos pares (pesa cada capital pelo próprio denominador). **Indicador nacional**: outra coisa, sempre rotulado. Os três não se confundem.
* Mediana; quartis pelo método tipo 7 (equivalente a `QUARTIL.INC`); mínimo e máximo com todas as capitais empatadas; precisão original dos dados, sem arredondar antes de calcular; zero real preservado, ausência nunca vira zero.
* Política de apresentação: a faixa dos 50% centrais só aparece com **8 ou mais valores** (`LIMIAR_QUARTIS = 8`). Abaixo disso o painel mostra mínimo, mediana, máximo e o número de valores. Os quartis completos seguem no CSV de referências, com a coluna `quartis_exibidos`.
* Exemplo verificável, despesa por habitante 2025, 26 capitais: mediana R$ 1.159,81; média simples R$ 1.243,29; razão agregada R$ 1.361,35; mínimo R$ 701,95 (Belém); máximo R$ 2.361,51 (Vitória); quartis R$ 960,05 e R$ 1.464,31. Despesa por matrícula 2025, 21 capitais: mediana R$ 14.045,32; média simples R$ 15.644,88; razão agregada R$ 16.353,63; mínimo R$ 11.029,96 (Teresina); máximo R$ 23.746,53 (São Paulo).
* Diferença para a referência é descrita na escala da medida: R$ e %, matrículas e %, alunos por turma, pontos percentuais, pontos de Ideb ou Saeb. Base zero bloqueia a diferença relativa.

## 3. Matriz de referências

Fonte única: `matriz_referencias` da gold, exibida em `#matriz-referencias`. Classes: **nacional do mesmo universo** (gera diferença), **nacional de outro universo** (mostra, sem diferença), **internacional como contexto** (mostra, sem diferença, fora da distribuição das capitais) e **incompatível** (rejeitada).

### 3.1 Aceitas

| Id | Referência | Classe | Observação |
| --- | --- | --- | --- |
| `inep.atu.brasil` | Alunos por turma, Brasil, rede municipal (INEP) | Nacional, mesmo universo | 2025, anos iniciais: 22,0 alunos por turma. Não é a média das capitais |
| `inep.aprovacao.brasil` | Taxa de aprovação, Brasil, rede municipal (INEP) | Nacional, mesmo universo | 2025, anos finais: 94,6%; anos iniciais: 98,0% |
| `inep.ideb.brasil` | Ideb, Saeb, P e N, Brasil, rede municipal (INEP) | Nacional, mesmo universo | 2025, anos iniciais: Ideb 6,1; Saeb Matemática 227,79. Metas do Ideb seguem fora do painel |

### 3.2 Contextuais (nunca geram diferença nem entram na distribuição)

| Id | Referência | Classe | Observação |
| --- | --- | --- | --- |
| `inep.investimento_estudante` | Investimento público direto por estudante, educação básica, Brasil (INEP) | Nacional, outro universo | Só até 2021 (R$ de 2021), consolidado de União, estados, DF e municípios, em todas as redes públicas. 2021: R$ 9.015,88. Não é a rede municipal |
| `ocde.tamanho_turma` | OCDE, Education at a Glance, tamanho médio das turmas, ISCED 1 e 2, instituições públicas | Internacional, contexto | Anos iniciais (ISCED 1, 2024): Brasil 20,86; média da OCDE publicada 20,70; 39 países com dado. Anos finais (ISCED 2, 2024): Brasil 25,47; OCDE 22,88; 37 países. Mostra o ano mais recente e avisa quando difere do ano do painel |
| `ocde.despesa_estudante` | OCDE, despesa por estudante em tempo integral, ISCED 1, 2 e 1 a 8 | Internacional, contexto | 2023, USD PPC: Brasil 4.064 (ISCED 1), 4.390 (ISCED 2); OCDE 12.821 e 14.241. País inteiro, outro conceito de despesa e de PPC: nunca se compara a um município |

### 3.3 Rejeitadas

| Id | Candidata | Motivo |
| --- | --- | --- |
| `ocde.tamanho_turma.infantil` | OCDE, tamanho de turma na educação infantil | Outro conceito e sem dado de turma para creche e pré-escola do Brasil |
| `ocde.repetencia` | OCDE e UNESCO UIS, repetência | Indisponível para o Brasil e de outro conceito |
| `pisa.ideb` | PISA para Ideb e Saeb | O painel não converte nem equipara notas de escalas diferentes |
| `ocde.matriculas` | OCDE e UNESCO UIS, matrículas e taxas por idade | Cobertura da população por idade é outro tema; não vale para matrículas da rede municipal |
| `ibge.despesa_habitante` | Despesa municipal em Educação por habitante, Brasil | Não existe referência nacional publicada; o painel mostra o grupo das capitais |
| `fnde.siope.por_aluno` | SIOPE, indicadores de investimento por aluno | Examinada e **não adotada** (ver 4) |

## 4. Fontes examinadas e não adotadas

* **SIOPE (FNDE)**: a API gerencial responde, mas o relatório público antigo está protegido por reCAPTCHA. O indicador 4.9, multiplicado pelas matrículas da rede municipal do Censo, vale de 0,81 a 2,50 vezes a despesa liquidada da DCA em 130 pares (mediana 1,15; quartis 1,07 e 1,24). Dispersão grande demais para uma diferença uniforme de estágio contábil ou de universo, e a fórmula, o universo de matrículas e o estágio da despesa não constam de documentação pública que eu tenha encontrado. Medição M04 na gold. Não foi usado em nenhum valor publicado.
* **OCDE**: dados lidos da API SDMX (CSV), com proveniência e média da OCDE recomputada como média simples dos membros com dado (V18). Não li o texto do Education at a Glance 2026 nem as notas metodológicas por país. O mapeamento do ISCED brasileiro (anos iniciais como ISCED 1 e finais como ISCED 2) segue a classificação da própria base e **não foi conferido contra documento de mapeamento do INEP**.
* **UNESCO UIS**: examinada pela pesquisa de referências (`scratchpad` da sessão, não versionada); nenhum conjunto adotado. Repetência e matrículas por idade rejeitadas pelos motivos acima.
* **INEP financeiro**: o indicador de investimento por estudante termina em 2021. Não há edição para 2022 a 2025.

## 5. Exemplos verificáveis

Recomputação separada do código do pipeline (`scripts/obee/recomputacao_independente.py`, lê DCA, IBGE, MSC e Censo direto das sementes versionadas e compara com a gold). Escrita pelo mesmo autor do pipeline: é conferência por outro código, **não** revisão externa. Execução em 08/10/2026:

| Caso | Resultado |
| --- | --- |
| 2025: São Paulo, Palmas, Recife, Natal, Boa Vista, Porto Alegre, Rio de Janeiro, Campo Grande (portes de 328 mil a 11,9 milhões de habitantes) | Despesa DCA, população, despesa por habitante, matrículas e despesa por matrícula conferem em todos, ao centavo; Palmas e Natal sem valor por matrícula nos dois lados |
| 2024: Boa Vista (ressalva), Curitiba, Belém | Conferem |
| 2021: Campo Grande (fora das comparações) | Despesa por habitante R$ 1.125,42 confere; sem valor por matrícula nos dois lados |
| 2023: Manaus (sem população) | Sem despesa por habitante nos dois lados; despesa por matrícula R$ 8.734,50 confere |

Trilha completa de um número, no painel: `#decomposicao` (ponte) e "Passaporte". Para refazer sem rede: `python3 -m pipeline.eficiencia.run`.

## 6. Limitações específicas ainda existentes

Pendências materiais, em ordem de impacto:

1. **Despesa por matrícula sem valor em 28 de 130 pares** (21,5%), inclusive Aracaju, Belém, Goiânia, Natal e Palmas em 2025. A causa é a MSC não fechar com a DCA (diferenças de 0,7% a 12,1% da DCA em 2025). O dado necessário para destravar: a reconciliação da MSC e da DCA pelos municípios, ou o detalhamento das intraorçamentárias que a MSC não marca com a modalidade 91. Não foi feito rateio nem estimativa.
2. **Despesa por habitante inexistente para 2023** (o IBGE não publicou população municipal). Não há interpolação.
3. **A aplicação direta pode incluir pagamento a prestadores privados** que atendem alunos da rede (transporte, alimentação, vagas contratadas), pois a MSC não separa o beneficiário do serviço. A razão não é custo por aluno nem custo de uma etapa.
4. **Períodos desalinhados**: o Censo tem referência em maio e a despesa cobre o ano.
5. **Referência internacional**: o mapeamento ISCED não foi conferido contra fonte brasileira, e o ano da OCDE pode diferir do ano do painel (o painel avisa). Não há referência internacional de despesa por matrícula utilizável diretamente.
6. **Referência nacional de despesa por estudante** só até 2021, de outro universo.
7. **Alvos de toque de 32 px** nos botões "Passaporte" e em resumos recolhíveis em tela estreita: atendem o critério 2.5.8 do WCAG 2.2 AA (24 px), mas ficam abaixo dos 44 px do critério AAA. Não alterei para não deslocar o leiaute dos cartões.
8. **Leitor de tela real não testado.** A acessibilidade foi verificada com axe-core e por teclado.
9. `versao_codigo` da gold reflete o commit vigente na geração com árvore alterada (`cd9cc5630+alterado`); o hash dos dados (`hash_dados`) é o que identifica o conteúdo.

## 7. Resultado dos testes (08/10/2026)

* **Vitest**, suíte completa com `EXIGIR_BUILD_HTML=1` sobre o build: 137 arquivos, 2.575 testes aprovados e 1 ignorado. `npm run lint` sem avisos; `tsc --noEmit` limpo.
* **Python** (`unittest`, `test_eficiencia*.py`): 84 aprovados, incluindo os 43 de `test_eficiencia_comparacoes.py` (atribuição única da ponte, quartis tipo 7 conferidos à mão, empates, grupo pequeno, média contra razão agregada nos mesmos pares, população do ano correto e revisão, Campo Grande 2021 e Boa Vista 2024, denominador sem conveniadas, referência de contexto fora da distribuição, publicação bloqueada por validação crítica reprovada, CSV igual à gold). A reconstrução da gold é determinística: reexecutar `python3 -m pipeline.eficiencia.run` não alterou nenhum arquivo.
* **Cartão, gráfico, tabela e arquivo exportado** com a mesma regra: `src/tests/obee-comparacoes.test.ts` (17 testes) e o teste exaustivo pipeline contra TypeScript em `obee-educacao.test.ts` (53 testes), com limite de 650 kB para o payload do cliente.
* **Interações reais** (`scripts/obee/interacoes.mjs`): 39 de 39 em 1280 px e 39 de 39 em 390 px com toque.
* **Larguras e acessibilidade automatizada** (`scripts/obee/larguras-axe.mjs`): 320, 390, 768 e 1440 px × 8 recortes (padrão, por habitante, por matrícula, Boa Vista 2024, Campo Grande 2021, Manaus 2023 sem população, alunos por turma, Ideb), com todos os `details` abertos: 32 combinações, 0 estouro horizontal da página, 0 violação axe (WCAG 2.0, 2.1 e 2.2, A e AA), 0 erro de página. Um defeito real foi encontrado e corrigido nesta verificação: o bloco "Exemplos de reprodução" estourava a largura quando expandido.
* **Neutralidade**: o teste que varre componentes, página, catálogo e notas por termos avaliativos e cores de semáforo passa. Sem "eficiente", "melhor", "pior", "desperdício", nota, semáforo, pódio ou fronteira.

## 8. As oito perguntas do cidadão, respondidas pela interface

1. **Quanto a capital gastou no total e por habitante?** Cartões de recursos e gráfico por medida, com unidade, ano e universo junto ao número.
2. **Quanto por matrícula e quais despesas e matrículas entraram?** Gráfico por matrícula e ponte da DCA ao numerador em `#decomposicao`, com o denominador e o que ficou de fora. Nos 28 pares sem valor, o motivo.
3. **Como se situa diante da média, mediana e extremos?** Resumo do grupo sob o gráfico, com diferença na escala da medida.
4. **Quantas capitais participam?** "21 de 26 no grupo" no resumo, e a lista das excluídas com o motivo.
5. **Como evoluiu, descontada a inflação?** Séries com moeda corrente ou R$ de 2025 e a mediana do grupo por ano; variação bloqueada onde há quebra de série.
6. **Que dados de atendimento e resultado existem?** Cartões e colunas de conveniadas, alunos por turma, aprovação, Ideb e Saeb, cada um com o seu universo e ano.
7. **Qual referência nacional ou internacional posso usar e que diferenças de escopo considerar?** `#referencias`, com o escopo escrito e a classe de cada uma; matriz completa em `#matriz-referencias`.
8. **Consigo verificar a fonte e reproduzir o número?** Passaporte, trilha, CSVs com numerador e denominador, e o script de recomputação separada.

## 9. Próxima expansão proposta (não implementada)

Priorizada, sem alterar o escopo desta rodada:

1. **Fechar a reconciliação da MSC nos 28 pares** (Siconfi, MSC detalhada por poder e órgão): ganho direto de cobertura da despesa por matrícula.
2. **Estrutura administrativa, em dois recortes que não se misturam**: (a) servidores da atividade finalística, por área, a partir de RAIS e dos painéis de pessoal do ente, separando magistério, saúde e segurança; (b) administração, cargos comissionados e terceirização, a partir do Portal da Transparência de cada ente e do Siconfi (elemento de despesa 3.3.90.34 e 3.3.90.37). A pergunta é "quem faz o quê", não "quantos por habitante": pessoal por população não é diagnóstico de excesso, porque depende de responsabilidades institucionais, da rede própria e da terceirização. Cada ente precisa ter a sua tabela de atribuições registrada antes de qualquer razão.
3. **Saúde nas capitais** com o mesmo contrato (despesa por habitante e por unidade de atendimento, SIOPS e CNES), reaproveitando `derivados.py` e `referencias.py`.
4. **Referência internacional de despesa** apenas com documento de mapeamento do ISCED e conceito de despesa compatíveis.
