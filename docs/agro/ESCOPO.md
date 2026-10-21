# Agronegócio: escopo e decisões

Edição de 17/10/2026. Entrega **parcial em relação à especificação**, com oito capítulos, doze fichas de cadeia com produção por estado e comércio exterior e oito páginas de perguntas sobre o setor, todos com coleta oficial automática (fases 1 a 3, ver seções abaixo). Não foi entregue um observatório completo de preços, custos de referência, calendário agrícola e ambiente territorial. Todas as páginas distinguem dado observado, explicação conceitual e cenário do usuário.

Pergunta central: como produção, financiamento, trabalho e consumo se relacionam, e o que cada medida permite concluir? Economia e distribuição social aparecem em eixos separados; não existe nota de impacto ou ranking de eficiência.

## Cobertura por capítulo

| Capítulo | Artefatos implementados | Cobertura substantiva | Bloqueados |
|---|---:|---|---|
| A — Produção e produtividade | 5 | Produção por estado das doze cadeias (A1, IBGE); unidades, decomposição hipotética, escala versus rendimento e guia conceitual | A3 |
| B — Custos e renda | 6 | Cenários de lavoura; IPCA geral observado só para converter valores informados | Nenhum widget bloqueado; referências Conab não medidas |
| C — Alimentos e consumo | 4 | Orçamento hipotético; PNADC 2023/2024, Brasil e Grandes Regiões | C3, C4 |
| D — Crédito e proteção | 5 | Crédito por UF/finalidade, Brasil por programa e modelos de financiamento/proteção | D6 |
| E — Logística e mercados | 5 | Destinos de exportação (E3) e insumos importados (E6) observados no Comex Stat; armazenagem, concentração e decomposição FOB hipotéticas | E1 |
| F — Empresas e trabalho | 5 | Seção A nacional; estrutura de estabelecimentos e agricultura familiar no Censo Agro 2017 (F4); mecanismos e cenários de estoque/valor | F6 |
| G — Clima e ambiente | 4 | Água, uso do solo e vulnerabilidade hipotéticos; limites de atribuição | G1, G2 |
| H — Políticas e inclusão | 6 | Programas de crédito observados, alcance hipotético e leitura crítica | Custo fiscal e resultados não medidos |
| T — Transversais | 8 | Explorador, histórias, percursos, glossário, comparação, impressão, oficinas e cobertura | Instâncias não aumentam a contagem |
| K — Complementares | 11 | Caixa, VPL, operação, perdas, logística, câmbio, valor adicionado, HHI/CV, energia, custo por entrega e especialização | K7 |
| X — Adicional | 1 | Grupo ocupacional qualificado por UF e sexo, Censo Demográfico 2022 | Não substitui emprego formal territorial |

Total: **60 tarefas distintas implementadas**, de 69 contratos (68 originais + X1); **11 com dados observados, 16 conceituais e 33 cenários** (32 numéricos e um qualitativo). Existem 9 itens bloqueados integralmente. Um cenário operacional NÃO satisfaz a medição observada exigida no item original: o catálogo identifica isso em `medicaoRequerida`, além dos 13 bloqueios integrais. Quatro funções pedagógicas de uma seção não significam quatro novas estatísticas.

## Economia do setor: fase 1 (coleta oficial automática)

Quatro páginas respondem às perguntas sobre o agro como negócio, todas com dados observados e atualização automática (`.github/workflows/atualizar-agro.yml`, dias 9 e 24):

| Pergunta | Rota | Medidas | Fonte |
|---|---|---|---|
| Qual o tamanho do agro na economia? | `/agronegocio/tamanho` | Valor adicionado da agropecuária e parcela no total, crescimento em volume, parcela agro nas exportações | IBGE SIDRA 1846 e 5932; Comex Stat |
| Como vai o negócio neste ano? | `/agronegocio/conjuntura` | Safra estimada (produção, área, rendimento), crescimento trimestral, exportações do ano, crédito rural (snapshot) | IBGE LSPA, SIDRA 6588; SIDRA 5932; Comex Stat; BCB/Sicor preservado |
| Quanto custam os insumos importados? | `/agronegocio/insumos` | Fertilizantes (posições 3101 a 3105) e defensivos (3808) importados, valor unitário, origem, relação com a soja exportada | Comex Stat |
| Para quem vendemos e de quem dependemos? | `/agronegocio/mercados` | Exportações por capítulo e por país, destinos da soja em grão, origem dos fertilizantes | Comex Stat |

Decisões: agropecuária é a das Contas Nacionais (dentro da porteira), não o agronegócio ampliado; o recorte agro do comércio é por capítulo do Sistema Harmonizado (01 a 24, 41, 44, 47, 50 a 53), não a lista do Agrostat; valor unitário de comércio não é preço na fazenda; a relação de troca compara o mesmo intervalo de meses nos dois anos; safras de milho e feijão somam produção, nunca área. O Comex Stat aplica o intervalo de meses do período a cada ano quando há detalhe mensal, por isso séries anuais usam anos fechados e o acumulado do ano tem consulta própria. Conab (custos de referência) não respondeu na coleta de 17/10/2026 e continua fora.

## Fase 2: perguntas 5 a 8

| Pergunta | Rota | Medidas | Fonte |
|---|---|---|---|
| Quem produz, quem trabalha e quanto ganha no campo? | `/agronegocio/produtores` | Estabelecimentos, área, pessoal e valor da produção por agricultura familiar e faixa de área (F4); ocupados e renda do trabalho no campo | IBGE Censo Agro 2017 (SIDRA 6754, 6884, 6898); PNAD Contínua (SIDRA 5434, 5442) |
| Quanto custa o apoio público e quem recebe? | `/agronegocio/apoio` | Taxa média contratada por programa e origem do recurso, contra a Selic; subvenções pagas pelo Tesouro por ação; crédito por programa | BCB Sicor (microdados) e SGS 4189; Tesouro Transparente (subsídios financeiros) |
| Quanto se desmata e quanto o campo emite? | `/agronegocio/ambiente` | Taxa PRODES da Amazônia Legal, incremento mapeado nos demais biomas, emissões da agropecuária e da mudança de uso da terra, área de agropecuária e de vegetação nativa | INPE PRODES (TerraBrasilis); SEEG 13.0 (API); MapBiomas (estatísticas por bioma e estado) |
| Quanto custa a comida para as famílias? | `/agronegocio/prato` | IPCA de alimentação no domicílio e fora, itens da cesta com peso, segurança alimentar | IBGE IPCA (SIDRA 1419 e 7060); PNADC (preservada) |

Decisões: a taxa média do crédito rural usa só contratos sem indexador (código 9 da tabela de encargos do Sicor, cerca de 93% do valor), ponderada pelo valor; os grupos de fonte vêm da descrição oficial (equalizada, controlada, livre). Pagamentos do Tesouro são por data de pagamento e referem-se a safras anteriores. Taxa PRODES (Amazônia Legal) e incremento mapeado (demais biomas) não se somam; a estimativa preliminar do INPE fica marcada. SEEG é estimativa da sociedade civil, não inventário oficial; a licença de redistribuição não é explícita, só a citação. Custo de produção da Conab fica fora: licença CC BY-ND (sem derivação) e planilhas com formato diferente por aba. Subvenção ao seguro rural (PSR) fica fora: portal de dados do MAPA respondeu 403 e a execução mensal do Portal da Transparência exige baixar um arquivo por mês.

## Fase 3: cadeias com produção e comércio, simuladores depois do dado

Doze cadeias, escolhidas por duas lentes declaradas na página `/agronegocio/cadeias`: as maiores exportações do agro (soja, café, carnes, açúcar, celulose, milho, algodão) e alimentos de peso na cesta do IPCA (arroz, feijão, leite, frango, carne). Juntas, somam cerca de 82% das exportações do recorte agro em 2025 (Comex Stat, coleta de 17/10/2026). Ficam de fora, entre outras, suco de laranja e fumo, além de trigo, frutas, hortaliças, ovos e pescado.

Cada ficha mostra produção do último ano por estado, série de dez anos, exportação e importação por ano, principais destinos e, quando existe, o item do IPCA. O módulo é `pipeline/agro/producao.py` (sementes `producao.json.gz` e `comexcadeias.json.gz`), coletado na mesma rotina das demais fontes.

| Cadeia | Produção (IBGE) | Comércio (posições SH) | IPCA |
|---|---|---|---|
| Soja | PAM, quantidade, área e valor | 1201, 2304, 1507 | Óleo de soja |
| Milho | PAM | 1005 | Não |
| Cana-de-açúcar | PAM | 1701, 2207 (inclui álcool de outras origens) | Açúcar refinado |
| Café | PAM | 0901 | Café moído |
| Algodão | PAM, em caroço | 5201, pluma | Não |
| Arroz | PAM, em casca | 1006 | Arroz |
| Feijão | PAM | 0713 (leguminosas secas, inclui outros grãos) | Feijão-carioca |
| Carne bovina | Abate trimestral (carcaça) e rebanho PPM | 0201, 0202 | Carnes (bovina e suína) |
| Frango | Abate trimestral (carcaça) | 0207 (inclui outras aves) | Frango inteiro |
| Carne suína | Abate trimestral (carcaça) e rebanho PPM | 0203 | Não |
| Leite | PPM, mil litros e valor | 0401 a 0406 | Leite longa vida |
| Celulose | PEVS, madeira em tora para papel e celulose (m³) | 4703 | Não |

Decisões: cada cadeia mantém sua medida física; toneladas, litros, cabeças e metros cúbicos não se somam. Abate é o local do frigorífico, só sob inspeção, e estados com dado sigiloso ficam sem valor, nunca zero; as barras dizem quanto do total os estados com valor somam. Rebanho é estoque em 31 de dezembro, não produção. A PEVS mede madeira, não a celulose produzida, que não tem série oficial do IBGE. O atlas abre na produção por estado e mantém crédito e ocupações como outras medidas.

Nos capítulos de custos, alimentos, logística e ambiente, o dado observado do tema abre a página, com link à pergunta correspondente; os simuladores vêm depois, recolhidos e marcados como modelo didático. Nenhum simulador foi removido. A ilustração do cartão da home troca prédio e fábrica por lavoura, silos, floresta plantada e pasto.

## Cobertura por cadeia

Produção por estado e comércio exterior das doze cadeias estão na seção da fase 3. O crédito rural preservado segue o recorte dos 15 maiores itens por finalidade: soja, milho, arroz, café e bovinos aparecem; feijão, leite e as cinco cadeias novas não aparecem nesse recorte, o que não é zero. O item Bovinos não separa corte de leite.

Território: 27 UFs para crédito e grupo ocupacional; Brasil no emprego formal; Brasil e cinco Grandes Regiões na segurança alimentar. Não há estatística agro municipal nova. Não cruzamos UF × produto × programa quando a fonte preservada não permite esse grão.

## Calendários, classificações e unidades

Crédito: fluxo contratado de 2025-08 a 2026-07; série mensal 2013-01 a 2026-08, último mês parcial fora da janela fechada. Comparação anterior adjacente recalculada: 2024-08 a 2025-07. Não reutilizar a janela anterior não adjacente da gold de origem.

Emprego: vínculos celetistas da seção A da CNAE 2.0 nacional, julho/2026 preliminar; séries de diferenças do estoque. Não é toda a cadeia do agronegócio, pessoa única ou rendimento. Censo: grupo ocupacional 12635, pessoas de 14 anos ou mais ocupadas com rendimento em 2022, 28 territórios × três categorias de sexo. Grupo ocupacional não é CNAE nem formalidade. PNADC: domicílios, 2023/2024, sem correspondência causal com produção agrícola. IPCA geral: janeiro/2023 a julho/2026, base dezembro/1993=100; não é inflação de alimentos ou deflator de insumo agrícola.

Moedas e períodos são preservados; cenário usa a unidade declarada. Saca exige massa informada; arroba = 15 kg de massa, sem converter peso vivo em carcaça. Cabeças e litros não viram massa por hipótese. FOB/quantidade é valor unitário, não preço puro. Lucro, margem operacional, caixa, produção bruta, valor adicionado e renda não são intercambiáveis.

## Arquitetura e acesso

Next/React existentes; tokens, fontes locais, mapa oficial e banco existentes; sem dependência nova. Dados observados ficam no servidor e em downloads autenticados. Apenas metodologia e glossário são públicos. A ilustração pública da vitrine é conceitual, sem mapa ou estatística fictícia.

Inputs dos cenários ficam em memória no navegador. O registro opcional de uso contém somente nome fixo da ação e data; não inclui parâmetros nem identificador do usuário no registro. Sessão continua necessária para autenticar a ação. Métricas de uso não demonstram benefício econômico ou social.

Catálogo completo, contratos e razões individuais: [CATALOGO.md](CATALOGO.md), [catalogo-artefatos.json](catalogo-artefatos.json), [dicionario-indicadores.json](dicionario-indicadores.json). O campo `requisito` preserva o requisito; `medicaoRequerida` explicita sua realização parcial. Nenhuma empresa identificada nem logo comercial foi adicionado.

## Contagem por capítulo de uso, incluindo complementares

Não somar esta tabela à tabela anterior: é a mesma entrega, redistribuída pelo capítulo em que cada tarefa é usada. K não é contado outra vez. X1 pertence a F; D1 fica no atlas, associado a D. T contém transversais distintos.

| Capítulo | Observados | Conceituais | Cenários | Total |
|---|---:|---:|---:|---:|
| A | 0 | 1 | 3 | 4 |
| B | 0 | 0 | 11 | 11 |
| C | 1 | 1 | 2 | 4 |
| D | 1 | 1 | 3 | 5 |
| E | 2 | 0 | 6 | 8 |
| F | 3 | 2 | 3 | 8 |
| G | 0 | 1 | 3 | 4 |
| H | 1 | 4 | 2 | 7 |
| T | 2 | 6 | 0 | 8 |

Idioma do observatório: português. A entrada da plataforma foi integrada às duas versões da home; o nome do produto permanece em português e sua breve explicação inglesa não equivale à tradução de todo o observatório.
