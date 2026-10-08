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
| `edu.despesa_por_matricula` | Despesa anual por matrícula da rede municipal | Recursos | Calculado | Não publicável nesta etapa | Não se aplica | Avaliação: DCA e Censo |

## Fontes, papel e captura

| Fonte | Papel | Arquivos | Integridade |
| --- | --- | --- | --- |
| Siconfi, DCA Anexo I-E | Despesa e composição | 130 respostas (26 capitais × 2021 a 2025), coletadas em 08/10/2026 | Resposta inteira gravada com sha256 |
| Siconfi, RREO 6º bimestre, Anexo 02 | Só conferência | 130 respostas (linhas da Educação e totais) | sha256 |
| Siconfi, lista de entes | Conferência de códigos | 1 | sha256 |
| IBGE, IPCA número-índice | Correção monetária | jan/2021 a dez/2025 | sha256 |
| INEP, microdados do Censo Escolar | Matrículas | 2021 a 2025 (2024 republicado pelo INEP em 08/07/2026; 2025 "v2" de 31/07/2026) | MD5 publicado pelo INEP conferido |
| INEP, Sinopse Estatística | Só conferência | 2021, 2024, 2025 (2025 "V2" de 28/07/2026) | MD5 conferido |
| INEP, ATU por município | Alunos por turma | 2021 a 2025 | MD5 conferido (2022: `.ods`, ver ARQUITETURA.md) |
| INEP, taxas de rendimento por município | Aprovação | 2021 a 2025 | MD5 conferido |
| INEP, Ideb 2025 por município | Ideb, P, N, Saeb | anos iniciais e anos finais | MD5 conferido |

Detalhes de cada captura (URL, membro, datas, sha256, linhas do recorte): `pipeline/eficiencia/seed/manifesto.json`.

## Cobertura observada

Elegíveis: 26 capitais em todos os recortes.

* **Despesa e composição**: 26 de 26 em todos os exercícios de 2021 a 2025. Campo Grande 2021 fica fora da comparação (não comparável).
* **Matrículas (rede e conveniadas)**: 26 de 26 em todos os anos e etapas (zero quando a fonte informa zero).
* **Alunos por turma e aprovação, anos finais**: 23 de 26 em 2021 a 2023 (Rio Branco, Boa Vista e Macapá sem anos finais na rede: não aplicável); 24 de 26 em 2024 (Rio Branco não aplicável; Macapá não divulgado); 24 de 26 em 2025 (Rio Branco e Macapá não aplicável). Demais etapas: 26 de 26.
* **Ideb e Saeb, anos iniciais**: 26 de 26 em todas as edições, exceto 2013 (São Paulo, não divulgação solicitada) e 2017 (Porto Alegre, não divulgado).
* **Ideb e Saeb, anos finais**: entre 22 e 25 de 26 conforme a edição; 2025: 23 de 26 (Rio Branco e Macapá não aplicável; Boa Vista não divulgado). Lista completa por edição na seção de métodos do painel e em `cobertura` da gold.

## Lacunas conhecidas

* Siope (FNDE) não integrado: o portal de dados abertos não respondeu em 08/10/2026 e não era necessário ao piloto.
* Despesa por natureza (pessoal, custeio, investimento) da função Educação não integrada: exige RREO Anexo 8 ou Siope.
* Censo 2025: situação de funcionamento da escola não consta da `Tabela_Matricula` (não usada nas somas).
