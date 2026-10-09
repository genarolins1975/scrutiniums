# Saúde nas capitais: continuidade

Para quem retoma o módulo. Ler antes: [ESCOPO_E_FONTES.md](./ESCOPO_E_FONTES.md), [ARQUITETURA.md](./ARQUITETURA.md) e a regra editorial do OBEE em [../README.md](../README.md).

## 1. Estado em 09/10/2026

Módulo funcional com dados oficiais: 20 indicadores publicados com ressalvas (despesa, subfunção, natureza, ASPS, despesa por fonte, UBS, equipes, cobertura potencial, ICSAP, planos privados, população), 3 avaliados e não publicados, 8.777 observações (`hash_dados` ea1565fee6907c1a), 26 capitais, série financeira de 2021 a 2025 e resultados de 2021 a 2024. A entrada `/eficiencia-estatal` leva a Educação e a Saúde. Nada foi publicado em produção: o trabalho está na branch `claude/determined-knuth-21z58z` e em um PR aberto para revisão, sem merge.

A avaliação por critérios A a K é interna, feita por agentes distintos do executor, e consta de [MATRIZ_DE_AVALIACAO.md](./MATRIZ_DE_AVALIACAO.md). Não houve validação por pessoas, usuários reais nem especialistas externos.

## 2. Lacunas que dependem de dado externo

| # | Lacuna | O que falta | Efeito |
| --- | --- | --- | --- |
| L1 | Produção da APS (atendimentos, procedimentos, consultas) | Série municipal verificável e extraível do Siaps ou do Sisab, com contrato de unidade (atendimento, procedimento, pessoa) | Sem ela não há indicador de atendimento da APS; o módulo declara entrega parcial |
| L2 | Profissionais e carga horária | Extração do CNES em escala (cerca de 160 mil chamadas por competência) e decisão sobre dado pessoal | Capacidade de pessoal só pelas equipes registradas |
| L3 | Despesa por atendimento | Não é lacuna de dado: numerador e denominador têm perímetros diferentes. Só muda com uma fonte que ligue gasto e produção do mesmo financiador | Mantido como não publicável |
| L4 | Natureza da despesa em 14 pares, e Macapá 2025 | MSC ou DCA retificada pelo ente, ou DCA aberta por natureza | Nenhum rateio |
| L5 | Contexto internacional | Conceito verificado e API estável (por exemplo, gasto em saúde por habitante em PPC) | Registrado em F13 como não publicado |
| L6 | ICSAP de 2025 | O SIH por residência de 2025 é provisório | Resultados vão até 2024 |
| L7 | Revisão externa da metodologia | Parecer de especialista em financiamento ou atenção primária | O campo 16 da ficha continua sem revisão externa |

## 3. Tarefas delimitadas

| # | Tipo | Tarefa | Arquivos | Aceite |
| --- | --- | --- | --- | --- |
| S1 | Cobertura | Estender a despesa, o ASPS e o histórico do CNES para 2019 e 2020 | `padroniza.py` (`ANOS_FINANCEIROS`), `fontes/cnes.py`, IPCA | S02 a S08 aprovadas nos novos anos; séries com sete exercícios; a população de 2019 e 2020 tem base própria e quebra declarada |
| S2 | Cobertura | ICSAP de 2025 quando o SIH por residência for definitivo | `fontes/ripsa.py`, `ANOS_RESULTADOS` | S09 aprovada; o ano entra com nota de provisório se ainda for o caso |
| S3 | Indicador novo | Produção da APS se a série de L1 for obtida | catálogo, `fontes/`, `validacoes.py` | Ficha com contrato de unidade; validação contra o arquivo oficial; sem razão com despesa |
| S4 | Indicador novo | Leitos por 1.000 habitantes e leitos SUS (CNES) como contexto de oferta hospitalar, para qualificar a leitura do ICSAP | `fontes/cnes.py`, catálogo | Perímetro por gestão e vínculo SUS declarado; contexto, não comparação |
| S5 | Qualidade | Reconciliar as 5 capitais em que a API e o retrato do CNES divergem (M03) | `fontes/cnes.py` | Diferença explicada por data de referência ou tipo; ou fonte escolhida por regra escrita |
| S6 | Interface | Exportar imagem do gráfico com unidade, período, fonte e ressalva | `ExploradorSaude.tsx` | PNG com título, unidade, período e fonte |
| S7 | Automação | Atualização anual (Siconfi em maio, SIOPS, CNES mensal, RIPSA após divulgação) com PR que mostre o diff da gold e as validações | `.github/workflows/`, `run.py` | Reconstrução sem rede idempotente |
| S8 | Entes | Distrito Federal com tratamento próprio (saúde distrital reúne competências de estado e município) | `entes.py`, catálogo | Decisão P3 do OBEE tomada antes |

## 4. Decisões que cabem ao responsável

| # | Decisão | Opções |
| --- | --- | --- |
| P1 | Publicação em produção | Merge em `main` (Vercel) ou manter em branch. O PR está aberto e **não** foi mesclado |
| P2 | Distrito Federal no módulo de Saúde | Painel próprio com competências separadas, ou fora do OBEE municipal |
| P3 | Referência internacional | Aceitar apenas contexto, ou buscar conceito compatível (OMS, OCDE) com PPC |
| P4 | Produção da APS | Investir na extração do Siaps ou do Sisab, ou manter fora do escopo |

## 5. Padrões a manter

Os mesmos de Educação (cadeia fonte, seed, padronização, validações, gold e promoção atômica). Em Saúde, além deles:

* Despesa do município nunca é chamada de gasto total em saúde. O rótulo diz execução do município.
* Estrutura é cadastro: UBS e equipes não provam funcionamento, acesso nem pessoas atendidas. Cobertura potencial é capacidade teórica, sem teto de 100%.
* ICSAP é por município de residência, taxa bruta, AIH como unidade. Nunca se lê como falha da prefeitura ou da atenção primária.
* Estrutura, gasto e resultado não são alinhados em ano quando a periodicidade difere. Cada medida diz o seu ano.
* Indicador sem perímetro compatível fica avaliado e não publicado, com motivo na matriz de fontes. A existência de um portal não prova que a série é extraível e comparável.

## 6. Registro de progresso

| Data | Entrega |
| --- | --- |
| 09/10/2026 | Módulo Saúde nas capitais: pipeline com seed de Siconfi, SIOPS, CNES, Relatório APS e RIPSA; 16 validações e 5 medições; catálogo de 23 fichas; seis páginas; entrada `/eficiencia-estatal` com Educação e Saúde; testes Python e vitest; documentação em `docs/obee/saude/`; avaliação interna independente |
