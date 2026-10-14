# Observatório Brasileiro do Saneamento

Domínio `saneamento` da plataforma Scrutiniums, em `/saneamento`. Organizado por perguntas sociais: catorze capítulos em cinco eixos, mais ferramentas transversais. Toda página publica fonte, período, universo, o que o dado permite observar e o que não permite concluir.

Documentos desta pasta:

- [VIABILIDADE.md](./VIABILIDADE.md): matriz pergunta × indicador × fonte × grão × cobertura × acesso × limitações × situação (gerada de `src/lib/saneamento/viabilidade.ts`).
- [METODOLOGIA.md](./METODOLOGIA.md): contrato metodológico, definição de cada medida, conferências entre bases e regras do simulador.
- [VALIDACAO.md](./VALIDACAO.md): evidências de teste e de inspeção visual por página, com o que não foi verificado.

## Mapa de painéis

| Eixo | Capítulo | Rota | Situação |
|---|---|---|---|
| A Acesso e qualidade | 1 Quantas pessoas estão sem atendimento adequado? | `/saneamento/acesso` | Publicado |
| | 2 Quem fica para trás? | sem rota | Em preparação (tabelas do Censo por cor ou raça, quilombolas, indígenas e favelas mapeadas) |
| | 3 A água chega regularmente e com qualidade monitorada? | `/saneamento/continuidade` | Parcial (continuidade publicada; SISAGUA não integrado) |
| | 4 Para onde vai o esgoto? | `/saneamento/esgoto` | Publicado |
| B Preço regulado | 5 Preço regulado: o que pagamos, por que foi autorizado, o que financia | `/saneamento/preco-regulado` e subpainéis 5.1 a 5.5 | Parcial (amostra verificada) |
| | 6 A conta cabe no orçamento? A tarifa social chega a quem precisa? | `/saneamento/tarifa-social` | Parcial (economias por família elegível do CadÚnico; famílias beneficiadas não publicadas) |
| C Prestadores | 7 Quem presta o serviço e quem controla as empresas? | `/saneamento/prestadores` e `/saneamento/prestadores/[id]` | Parcial (sem controle societário) |
| | 8 Como os prestadores se comparam? | `/saneamento/prestadores/comparar` | Parcial (sem seleção de pares) |
| D Investimento e planejamento | 9 Onde o investimento está chegando? | `/saneamento/investimento` | Parcial (sem obras) |
| | 10 De onde vem o dinheiro? | `/saneamento/financiamento` | Parcial (sem BNDES, CAIXA, Transferegov) |
| | 11 O planejamento é suficiente para a universalização? | `/saneamento/planejamento` | Publicado |
| | 12 Quem responde pelas metas, fiscaliza e atende? | `/saneamento/responsaveis` | Parcial (sem fiscalizações e sanções) |
| E Saúde, ambiente e resiliência | 13 Como saneamento, saúde e ambiente se relacionam? | sem rota | Em preparação (DATASUS e monitoramento de água bruta) |
| | 14 O serviço está preparado para secas e eventos extremos? | `/saneamento/resiliencia` | Parcial (sem mananciais e Defesa Civil) |

Ferramentas: `/saneamento/municipio` e `/saneamento/municipio/[id]` (Meu município), `/saneamento/comparar?m=` (até quatro municípios), `/saneamento/prestadores/comparar?p=` (até quatro prestadores), `/saneamento/preco-regulado/simulador` (simulador da conta), atlas municipal em cada capítulo com estado na URL e CSV, `/saneamento/metodologia` (pública). Comparação internacional (JMP) e explorador de prioridades não foram construídos.

## Arquitetura

- `pipeline/observatorio_saneamento/`: `fontes.py` (catálogo), `coletar.py` (baixa e extrai para `seed/` com sha256), `gold.py` (constrói a gold sem rede), `tarifas.py` (tabelas verificadas → `src/lib/saneamento/dados/tarifas.json`, com exemplos conferidos em Decimal), `atos.py` e `curadoria/` (catálogo de atos → `atos.json`).
- `public/saneamento/gold/`: `municipios.json|csv`, `indice.json`, `agregados.json`, `prestadores.json|csv`, `reguladores.json`, `etes.json|csv`, `meta.json` (proveniência e conferências), `uf/SIGLA.json` (fichas municipais completas).
- `src/lib/saneamento/`: tipos, leitura da gold, catálogo de medidas, referências territoriais, capítulos, prestadores, viabilidade, simulador.
- `src/components/saneamento/`: cabeçalho, peças editoriais, atlas municipal, tabela de dados, comparadores, simulador.
- `src/app/saneamento/`: páginas estáticas lidas da gold no build; fichas de município e prestador renderizadas sob demanda e guardadas.
- Registro do domínio em `src/lib/dominios.ts`; só `/saneamento/metodologia` é pública (`src/lib/rotasPublicas.ts`); o resto exige sessão, como os demais painéis.

## Comandos

```bash
python3 -m pipeline.observatorio_saneamento.coletar --zips <pasta com os ZIPs do SINISA>   # com rede
python3 -m pipeline.observatorio_saneamento.coletar --so-cadunico                         # com rede
python3 -m pipeline.observatorio_saneamento.gold
python3 -m pipeline.observatorio_saneamento.tarifas
python3 -m pipeline.observatorio_saneamento.atos
python3 -m unittest pipeline.tests.test_observatorio_saneamento
npx vitest run src/tests/saneamento-gold.test.ts src/tests/saneamento-conta.test.ts
```

## Fontes e períodos

| Fonte | Período | Uso |
|---|---|---|
| Ministério das Cidades, SINISA 2025 | Ano de referência 2024; publicação 18/12/2025; base municipal de água retificada em 25/05/2026 | Atendimento, volumes, continuidade, investimento, tarifa social, prestadores, balanços, estações, gestão municipal |
| IBGE, Censo Demográfico 2022 | 2022 | Moradores e domicílios por forma de abastecimento e destino do esgoto |
| IBGE, Censo Demográfico 2010 | 2010 | Evolução da rede de água e de esgoto |
| IBGE, estimativa de população | 2024 | Denominador do SINISA e domicílios estimados da NR 8 |
| Atos de ARSESP, ARSAE-MG, AGEPAR, ARPE e ADASA | 2023 a 2026 | Tabelas tarifárias, estudos de caso e catálogo de reajustes |
| MDS, CadÚnico (SAGI, API MI Social) | Dez/2024 e set/2026 | Famílias elegíveis à tarifa social pelo critério de renda |
| Lei 11.445/2007, Lei 14.898/2024, NR ANA 8/2024, Decreto 12.797/2025 | Vigentes | Metas, tarifa social, medição das metas, salário-mínimo de 2026 |

## Relação com a Eficiência Estatal

O capítulo de saneamento da Eficiência Estatal usa os mesmos arquivos consolidados do SINISA (sha256 idênticos). O teste `src/tests/saneamento-gold.test.ts` compara os 429 valores consolidados comuns e exige igualdade exata. A divergência de população do módulo de esgoto registrada lá é explicada aqui: os 1.154 municípios com delegação sem atendimento entram no denominador consolidado (173.640.502 + 14.615.404 = 188.255.906).
