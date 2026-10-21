# Observatório Brasileiro do Saneamento

Domínio `saneamento` da plataforma Scrutiniums, em `/saneamento`. Organizado por perguntas sociais: quinze capítulos em cinco eixos, mais ferramentas transversais. Toda página publica fonte, período, universo, o que o dado permite observar e o que não permite concluir.

Documentos desta pasta:

- [VIABILIDADE.md](./VIABILIDADE.md): matriz pergunta × indicador × fonte × grão × cobertura × acesso × limitações × situação (gerada de `src/lib/saneamento/viabilidade.ts`).
- [METODOLOGIA.md](./METODOLOGIA.md): contrato metodológico, definição de cada medida, conferências entre bases e regras do simulador.
- [VALIDACAO.md](./VALIDACAO.md): evidências de teste e de inspeção visual por página, com o que não foi verificado.

## Mapa de painéis

| Eixo | Capítulo | Rota | Situação |
|---|---|---|---|
| A Acesso e qualidade | 1 Quantas pessoas estão sem atendimento adequado? | `/saneamento/acesso` | Publicado |
| | 2 Quem fica para trás? | `/saneamento/desigualdades` | Parcial (14 medidas do Censo 2022, com universos separados e supressões publicadas) |
| | 3 A água chega regularmente e com qualidade monitorada? | `/saneamento/continuidade` | Parcial (continuidade e SISAGUA de 2014 a 2025: seis parâmetros, plano de SAA e SAC desde 2023, população cadastrada; substâncias químicas, radioatividade e cianotoxinas em 2024 e 2025) |
| | 4 Para onde vai o esgoto? | `/saneamento/esgoto` | Publicado |
| B Preço regulado | 5 Preço regulado: o que pagamos, por que foi autorizado, o que financia | `/saneamento/preco-regulado` e subpainéis 5.1 a 5.5 | Parcial (amostra verificada) |
| | 6 A conta cabe no orçamento? A tarifa social chega a quem precisa? | `/saneamento/tarifa-social` | Parcial (economias por família elegível do CadÚnico; famílias beneficiadas não publicadas) |
| C Prestadores | 7 Quem presta o serviço e quem controla as empresas? | `/saneamento/prestadores` e `/saneamento/prestadores/[id]` | Parcial (controle societário só das 17 companhias abertas com FRE na CVM) |
| | 8 Como os prestadores se comparam? | `/saneamento/prestadores/comparar` | Parcial (sem seleção de pares) |
| D Investimento e planejamento | 9 Onde o investimento está chegando? | `/saneamento/investimento` | Parcial (sem obras) |
| | 10 De onde vem o dinheiro? | `/saneamento/financiamento` | Parcial (sem BNDES, CAIXA, Transferegov) |
| | 11 O planejamento é suficiente para a universalização? | `/saneamento/planejamento` | Parcial (IAA e IAE da NR 8 sem ICA, ICE e soluções alternativas; não declara cumprimento de meta) |
| | 12 Quem responde pelas metas, fiscaliza e atende? | `/saneamento/responsaveis` | Parcial (sem fiscalizações e sanções) |
| E Saúde, ambiente e resiliência | 13 Como saneamento, saúde e ambiente se relacionam? | `/saneamento/saude-ambiente` | Parcial (infecções intestinais, leptospirose e esquistossomose, 2022 a 2024, SIH e SIM; sem ajuste por idade, dengue, hepatite A e qualidade da água bruta) |
| | 14 O serviço está preparado para secas e eventos extremos? | `/saneamento/resiliencia` | Parcial (sem mananciais e Defesa Civil) |

Ferramentas: `/saneamento/municipio` e `/saneamento/municipio/[id]` (Meu município), `/saneamento/comparar?m=` (até quatro municípios), `/saneamento/prestadores/comparar?p=` (até quatro prestadores), `/saneamento/preco-regulado/simulador` (simulador da conta), atlas municipal em cada capítulo com estado na URL e CSV, `/saneamento/metodologia` (pública). `/saneamento/internacional` (Brasil no mundo, JMP da OMS e do UNICEF). O explorador de prioridades não foi construído.

## Arquitetura

- `pipeline/observatorio_saneamento/`: `fontes.py` (catálogo), `coletar.py` (baixa e extrai para `seed/` com sha256), `gold.py` (constrói a gold sem rede), `tarifas.py` (tabelas verificadas → `src/lib/saneamento/dados/tarifas.json`, com exemplos conferidos em Decimal), `atos.py` e `curadoria/` (catálogo de atos → `atos.json`).
- `public/saneamento/gold/`: `municipios.json|csv`, `desigualdades_municipios.json|csv` (capítulo 2, carregado só pelo atlas do capítulo), `qualidade_municipios.json|csv` (SISAGUA, capítulo 3, idem), `saude_municipios.json|csv` (SIH e SIM, capítulo 13, idem), `controle_societario.json|csv` (posição acionária das companhias abertas, capítulo 7, lida pela ficha do prestador e pelo capítulo), `jmp_paises.json|csv` (estimativas do JMP por país e série do Brasil, página `/saneamento/internacional`), `indice.json`, `agregados.json`, `prestadores.json|csv`, `reguladores.json`, `etes.json|csv`, `meta.json` (proveniência e conferências), `uf/SIGLA.json` (fichas municipais completas).
- `src/lib/saneamento/`: tipos, leitura da gold, catálogo de medidas, referências territoriais, capítulos, prestadores, viabilidade, simulador.
- `src/components/saneamento/`: cabeçalho, peças editoriais, atlas municipal, tabela de dados, comparadores, simulador.
- `src/app/saneamento/`: páginas estáticas lidas da gold no build; fichas de município e prestador renderizadas sob demanda e guardadas.
- Registro do domínio em `src/lib/dominios.ts`; só `/saneamento/metodologia` é pública (`src/lib/rotasPublicas.ts`); o resto exige sessão, como os demais painéis.

## Comandos

```bash
python3 -m pipeline.observatorio_saneamento.coletar --zips <pasta com os ZIPs do SINISA>   # com rede
python3 -m pipeline.observatorio_saneamento.coletar --so-cadunico                         # com rede
python3 -m pipeline.observatorio_saneamento.gold
python3 -m pipeline.observatorio_saneamento.saude --coletar                               # com rede (TabNet do DATASUS)
python3 -m pipeline.observatorio_saneamento.controle --coletar                            # com rede (FRE da CVM)
python3 -m pipeline.observatorio_saneamento.jmp --coletar                                 # com rede e openpyxl (JMP e API de países do IBGE)
python3 -m pipeline.observatorio_saneamento.tarifas
python3 -m pipeline.observatorio_saneamento.atos
python3 -m unittest pipeline.tests.test_observatorio_saneamento
python3 -m unittest pipeline.tests.test_saude pipeline.tests.test_controle pipeline.tests.test_jmp
npx vitest run src/tests/saneamento-gold.test.ts src/tests/saneamento-conta.test.ts src/tests/saneamento-saude.test.ts src/tests/saneamento-controle.test.ts src/tests/saneamento-internacional.test.ts
```

## Atualização e vigilância

O saneamento não tem coleta diária: a gold sai do seed versionado, e a proveniência de cada original (tamanho, sha256, Last-Modified) fica em `public/saneamento/gold/meta.json`. A recoleta é mensal (`.github/workflows/atualizar-saneamento.yml`, dia 6, 11:23 UTC): SINISA, CadÚnico, SISAGUA, DATASUS, CVM, JMP e ODS, cada um como grupo próprio, com a gold reconstruída e os testes do domínio decidindo a publicação de cada grupo (`config/atualizacao/saneamento.json`; detalhes e o que fica manual em `OPERACOES.md`, seção "Atualização agendada por domínio"). A vigília semanal (`python3 scripts/vigilancia.py saneamento`, job `saneamento` de `.github/workflows/vigilancia.yml`, segunda 09:40 UTC) compara essa proveniência com o que as fontes servem e abre a issue "Vigília: fonte do saneamento mudou desde a coleta" com o mantenedor como responsável.

| Fonte | O que acusa | Silêncio |
|---|---|---|
| SINISA, página de resultados | Link novo de arquivo; página sem link algum (vigia cego); página da edição seguinte publicada | Incluir o link em `pipeline/watch/saneamento_sinisa_links.txt` (`python3 scripts/vigilancia.py semear-saneamento` regrava o snapshot) |
| SINISA, ZIPs integrados | Tamanho diferente do registrado (retificação de arquivo já integrado) | Recoletar e reconstruir a gold |
| SISAGUA | Arquivo registrado reescrito 60 dias ou mais depois do Last-Modified registrado; arquivo anual novo a partir de março do ano seguinte | Recoletar e reconstruir a gold |
| CadÚnico | Mês mais recente da API, até o mês corrente, 3 ou mais meses à frente do mês da gold | `coletar --so-cadunico` e `gold` |
| JMP | Arquivo mundial de domicílios ou arquivo do Brasil com tamanho ou Last-Modified diferentes do registrado (nova atualização do JMP, em geral em julho ou agosto) | `jmp --coletar` e `gold` |
| CVM, FRE | Arquivo do ano atualizado depois da captura, com a captura já tendo 90 dias ou mais; arquivo do ano seguinte publicado a partir de junho | `controle --coletar` e `gold` |
| DATASUS, SIM | A página da tabulação declara dados finais até ano posterior ao fim da janela da gold; nota ausente (vigia cego) | `saude --coletar` e `gold`, com a nova janela |

Fonte que não responde vira linha "não verificado" na issue, nunca silêncio. Fora do alcance da vigília, por não haver sinal barato e confiável: Censo (decenal), atos tarifários dos reguladores (curadoria manual), conteúdo do módulo Gestão Municipal do SINISA além da presença do link, SIH (os últimos seis meses são revisados pela fonte, sem sinal de data) e fontes ainda não integradas. A API do CadÚnico lista meses cheios posteriores ao mês corrente (consulta de 16/10/2026: até 202612), por isso o cheque limita a consulta ao mês corrente.

## Fontes e períodos

| Fonte | Período | Uso |
|---|---|---|
| Ministério das Cidades, SINISA 2025 | Ano de referência 2024; publicação 18/12/2025; base municipal de água retificada em 25/05/2026 | Atendimento, volumes, continuidade, investimento, tarifa social, prestadores, balanços, estações, gestão municipal |
| IBGE, Censo Demográfico 2022 | 2022 | Moradores e domicílios por forma de abastecimento e destino do esgoto |
| IBGE, Censo Demográfico 2010 | 2010 | Evolução da rede de água e de esgoto |
| IBGE, estimativa de população | 2024 | Denominador do SINISA e domicílios estimados da NR 8 |
| Atos de ARSESP, ARSAE-MG, AGEPAR, ARPE e ADASA | 2023 a 2026 | Tabelas tarifárias, estudos de caso e catálogo de reajustes |
| MDS, CadÚnico (SAGI, API MI Social) | Dez/2024 e set/2026 | Famílias elegíveis à tarifa social pelo critério de renda |
| Ministério da Saúde, SISAGUA (dados abertos) | 2014 a 2025 (plano desde 2023); arquivos atualizados em out/2026, extraídos em 14/10/2026 | Controle mensal, plano de amostragem, vigilância e cadastro de população abastecida; Portaria GM/MS 888/2021 para os limites |
| Ministério da Saúde, DATASUS: SIH/SUS e SIM (TabNet), por local de residência | 2022 a 2024; extração de 16/10/2026 (SIM com dados finais até 2024) | Internações no SUS e óbitos por infecções intestinais, leptospirose e esquistossomose, por município, ao lado da carência de esgoto |
| WHO/UNICEF JMP, base de domicílios (washdata.org) e IBGE, API de países | JMP 2000 a 2024, atualização de agosto de 2025; captura de 17/10/2026 | Água e esgotamento por degrau de serviço em 223 países e áreas, série do Brasil, nomes de países em português; comparação com Censo 2022 e SINISA |
| CVM, Formulário de Referência (posição acionária) | FRE 2026, versões recebidas de maio a outubro de 2026; captura de 16/10/2026 | Acionistas, controlador e cadeia de controle de 17 companhias abertas prestadoras de água e esgoto, ligadas ao SINISA por CNPJ |
| Lei 11.445/2007, Lei 14.898/2024, NR ANA 8/2024, Decreto 12.797/2025 | Vigentes | Metas, tarifa social, medição das metas, salário-mínimo de 2026 |

## Relação com a Eficiência Estatal

O capítulo de saneamento da Eficiência Estatal usa os mesmos arquivos consolidados do SINISA (sha256 idênticos). O teste `src/tests/saneamento-gold.test.ts` compara os 429 valores consolidados comuns e exige igualdade exata. A divergência de população do módulo de esgoto registrada lá é explicada aqui: os 1.154 municípios com delegação sem atendimento entram no denominador consolidado (173.640.502 + 14.615.404 = 188.255.906).

## Desigualdades (Censo 2022)

Coleta: `python3 -m pipeline.observatorio_saneamento.desigualdades --coletar`.
O coletor valida todas as variáveis e classificações nos metadados antes das consultas, preserva 56 respostas de dados e 6 metadados originais comprimidos com `mtime=0`, e registra SHA-256 dos bytes JSON descomprimidos no manifesto. O build offline verifica os hashes antes de materializar a gold. Não é necessário recolher SINISA ou CadÚnico.

O capítulo contém comparação nacional por cor ou raça, recortes separados de quilombolas, indígenas e favelas, atlas com 14 medidas, tabelas e CSV para Brasil, UFs e municípios. As medidas estão disponíveis também no comparador municipal. Referências territoriais vêm das tabulações oficiais.

Limitações: ligação à rede de água para quilombolas e indígenas pela identificação ampliada, recortes urbano/rural e renda individual cruzada com saneamento não integrados. As tabelas 10105 e 9957 são de esgoto; a 9894 mede domicílios, a 9898 mede moradores. O capítulo permanece parcial.
