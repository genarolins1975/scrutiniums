# Catálogo e cobertura

Fonte única das fichas: `pipeline/eficiencia/catalogo_indicadores.json`. A tabela abaixo resume; não substitui as fichas.

## Indicadores

| Id | Indicador | Família | Natureza | Estado | Períodos | Fonte |
| --- | --- | --- | --- | --- | --- | --- |
| `edu.despesa.funcao_educacao` | Despesa liquidada na função Educação (nominal e em R$ de 2025) | Recursos | Observado | Publicável com ressalvas | Exercícios 2021 a 2025 | Siconfi, DCA Anexo I-E; IBGE, IPCA |
| `edu.despesa.subfuncao` | Composição da despesa por subfunção | Recursos | Calculado | Publicável com ressalvas | Exercícios 2021 a 2025 | Siconfi, DCA Anexo I-E |
| `edu.matriculas.rede_municipal` | Matrículas na rede municipal, total e por etapa | Atendimento | Calculado | Publicável | Censo 2021 a 2025 | INEP, microdados do Censo Escolar |
| `edu.matriculas.conveniadas_municipais` | Matrículas em escolas privadas conveniadas com o município | Atendimento | Calculado | Publicável com ressalvas | Censo 2021 a 2025 | INEP, microdados do Censo Escolar |
| `edu.atu.rede_municipal` | Média de alunos por turma (creche, pré-escola, anos iniciais, anos finais) | Atendimento | Observado | Publicável | Censo 2021 a 2025 | INEP, Indicadores Educacionais |
| `edu.aprovacao.rede_municipal` | Taxa de aprovação (anos iniciais e finais) | Resultado | Observado | Publicável | Anos letivos 2021 a 2025 | INEP, Taxas de Rendimento |
| `edu.ideb.rede_municipal` | Ideb, com P e N (anos iniciais e finais) | Resultado | Observado | Publicável | Edições 2005 a 2025 | INEP, Ideb 2025 |
| `edu.saeb.rede_municipal` | Proficiência no Saeb, Matemática e Língua Portuguesa (5º e 9º anos) | Resultado | Observado | Publicável | Edições 2005 a 2025 | INEP, Ideb 2025 |
| `ctx.populacao.residente` | População residente do município | Contexto | Observado | Publicável com ressalvas | 2021, 2022, 2024 e 2025 (2023 sem publicação) | IBGE, SIDRA 6579 e 4714 |
| `edu.despesa.por_habitante` | Despesa liquidada em Educação por habitante | Recursos | Calculado | Publicável com ressalvas | Exercícios 2021 a 2025 (2023 sem valor) | DCA e IBGE |
| `edu.despesa.por_matricula_rede_propria` | Despesa de aplicação direta por matrícula da rede municipal | Recursos | Calculado | Publicável com ressalvas | Exercícios 2021 a 2025, 102 de 130 pares | MSC, DCA e Censo Escolar |
| `edu.despesa.ponte_matricula` | Ponte da DCA ao numerador por matrícula | Recursos | Calculado | Publicável com ressalvas | Exercícios 2021 a 2025 | MSC e DCA |
| `edu.despesa_por_matricula` | Função inteira ÷ matrículas totais (definição descartada) | Recursos | Calculado | Não publicável | Não se aplica | Avaliação: DCA e Censo |

## Fontes, papel e captura

| Fonte | Papel | Arquivos | Integridade |
| --- | --- | --- | --- |
| Siconfi, DCA Anexo I-E | Despesa e composição | 130 respostas (26 capitais × 2021 a 2025), coletadas em 08/10/2026 | Resposta inteira gravada com sha256 |
| Siconfi, RREO 6º bimestre, Anexo 02 | Só conferência | 130 respostas (linhas da Educação e totais) | sha256 |
| Siconfi, MSC agregada de dezembro, classe 6 | Conferência e numerador da despesa por matrícula | 130 pares (26 capitais × 2021 a 2025), função 12 | sha256 do recorte e da resposta completa |
| IBGE, população (SIDRA 6579 e 4714) | Despesa por habitante | 2021, 2022, 2024, 2025 | sha256 e publicação original preservada |
| INEP, indicadores nacionais da rede municipal | Referência nacional | ATU, rendimento, Ideb e Saeb, Brasil | MD5 conferido |
| OCDE, Education at a Glance (SDMX) | Contexto internacional | Tamanho de turma e despesa por estudante | sha256 |
| FNDE, SIOPE | Examinado e não adotado | 130 pares | sha256 (medição M04) |
| Siconfi, extrato de entregas e RREO 5º bimestre | Evidência documental, não alimenta valores | Boa Vista 2024, Campo Grande 2021 | sha256 |
| Siconfi, lista de entes | Conferência de códigos | 1 | sha256 |
| IBGE, IPCA número-índice | Correção monetária | jan/2021 a dez/2025 | sha256 |
| INEP, microdados do Censo Escolar | Matrículas | 2021 a 2025 (2024 republicado pelo INEP em 08/07/2026; 2025 "v2" de 31/07/2026) | MD5 publicado pelo INEP conferido |
| INEP, Sinopse Estatística | Só conferência e confirmação de escolas sem contagem | 2021 a 2025 (2025 "V2" de 28/07/2026) | MD5 conferido |
| INEP, ATU por município | Alunos por turma | 2021 a 2025 | MD5 conferido (2022: `.ods`, ver ARQUITETURA.md) |
| INEP, taxas de rendimento por município | Aprovação | 2021 a 2025 | MD5 conferido |
| INEP, Ideb 2025 por município | Ideb, P, N, Saeb | anos iniciais e anos finais | MD5 conferido |

Detalhes de cada captura (URL, membro, datas, sha256, linhas do recorte): `pipeline/eficiencia/seed/manifesto.json`.

## Cobertura observada

Elegíveis: 26 capitais em todos os recortes.

* **Despesa e composição**: 26 de 26 com valor oficial em todos os exercícios de 2021 a 2025; 26 na comparação, exceto 2021 (25: Campo Grande, perímetro distinto, fora da comparação no valor nominal, no real e nas subfunções). A gold registra por recorte `com_valor`, `comparaveis` e `fora_da_comparacao`.
* **Matrículas (rede e conveniadas)**: 26 de 26 em todos os anos e etapas (zero quando a fonte informa zero). Em 2022, 2023 e 2024 há escolas sem contagem nos microdados; em todos os casos a Sinopse confirma o total (medição M02), sem valor alterado.
* **Alunos por turma e aprovação, anos finais**: 23 de 26 em 2021 a 2023 (Rio Branco, Boa Vista e Macapá sem anos finais na rede: não aplicável); 24 de 26 em 2024 (Rio Branco não aplicável; Macapá não divulgado); 24 de 26 em 2025 (Rio Branco e Macapá não aplicável). Demais etapas: 26 de 26.
* **Ideb e Saeb, anos iniciais**: 26 de 26 em todas as edições, exceto 2013 (São Paulo, não divulgação solicitada) e 2017 (Porto Alegre, não divulgado).
* **Ideb e Saeb, anos finais**: entre 22 e 25 de 26 conforme a edição; 2025: 23 de 26 (Rio Branco e Macapá não aplicável; Boa Vista não divulgado). Lista completa por edição na seção de métodos do painel e em `cobertura` da gold.

## Lacunas conhecidas

* SIOPE (FNDE) examinado e não adotado para valores (medição M04): fórmula e universo não reproduzíveis com fontes abertas.
* Despesa por matrícula sem valor em 28 de 130 pares (MSC não fecha com a DCA) e despesa por habitante sem valor em 2023 (população). Ver COMPARACOES_GASTO_POR_HABITANTE_E_MATRICULA.md.
* Despesa por natureza (pessoal, custeio, investimento) da função Educação não integrada: exige RREO Anexo 8 ou Siope.
* Censo 2025: situação de funcionamento da escola não consta da `Tabela_Matricula` (não usada nas somas).
