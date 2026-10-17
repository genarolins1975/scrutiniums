# Agronegócio: escopo e decisões

Edição de 17/10/2026. Entrega **parcial em relação à especificação**, com oito capítulos, sete fichas de cadeia e, desde a fase 1 da economia do setor, quatro páginas de perguntas com coleta oficial automática (ver seção abaixo). Não foi entregue um observatório completo de produção por estado, preços, custos de referência e ambiente. Todas as páginas distinguem dado observado, explicação conceitual e cenário do usuário.

Pergunta central: como produção, financiamento, trabalho e consumo se relacionam, e o que cada medida permite concluir? Economia e distribuição social aparecem em eixos separados; não existe nota de impacto ou ranking de eficiência.

## Cobertura por capítulo

| Capítulo | Artefatos implementados | Cobertura substantiva | Bloqueados |
|---|---:|---|---|
| A — Produção e produtividade | 4 | Unidades, decomposição hipotética, escala versus rendimento e guia conceitual de leitura da safra | A1, A3 |
| B — Custos e renda | 6 | Cenários de lavoura; IPCA geral observado só para converter valores informados | Nenhum widget bloqueado; referências Conab não medidas |
| C — Alimentos e consumo | 4 | Orçamento hipotético; PNADC 2023/2024, Brasil e Grandes Regiões | C3, C4 |
| D — Crédito e proteção | 5 | Crédito por UF/finalidade, Brasil por programa e modelos de financiamento/proteção | D6 |
| E — Logística e mercados | 5 | Destinos de exportação (E3) e insumos importados (E6) observados no Comex Stat; armazenagem, concentração e decomposição FOB hipotéticas | E1 |
| F — Empresas e trabalho | 4 | Seção A nacional; mecanismos e cenários de estoque/valor | F4, F6 |
| G — Clima e ambiente | 4 | Água, uso do solo e vulnerabilidade hipotéticos; limites de atribuição | G1, G2 |
| H — Políticas e inclusão | 6 | Programas de crédito observados, alcance hipotético e leitura crítica | Custo fiscal e resultados não medidos |
| T — Transversais | 8 | Explorador, histórias, percursos, glossário, comparação, impressão, oficinas e cobertura | Instâncias não aumentam a contagem |
| K — Complementares | 11 | Caixa, VPL, operação, perdas, logística, câmbio, valor adicionado, HHI/CV, energia, custo por entrega e especialização | K7 |
| X — Adicional | 1 | Grupo ocupacional qualificado por UF e sexo, Censo Demográfico 2022 | Não substitui emprego formal territorial |

Total: **58 tarefas distintas implementadas**, de 69 contratos (68 originais + X1); **9 com dados observados, 16 conceituais e 33 cenários** (32 numéricos e um qualitativo). Existem 11 itens bloqueados integralmente. Um cenário operacional NÃO satisfaz a medição observada exigida no item original: o catálogo identifica isso em `medicaoRequerida`, além dos 13 bloqueios integrais. Quatro funções pedagógicas de uma seção não significam quatro novas estatísticas.

## Economia do setor: fase 1 (coleta oficial automática)

Quatro páginas respondem às perguntas sobre o agro como negócio, todas com dados observados e atualização automática (`.github/workflows/atualizar-agro.yml`, dias 9 e 24):

| Pergunta | Rota | Medidas | Fonte |
|---|---|---|---|
| Qual o tamanho do agro na economia? | `/agronegocio/tamanho` | Valor adicionado da agropecuária e parcela no total, crescimento em volume, parcela agro nas exportações | IBGE SIDRA 1846 e 5932; Comex Stat |
| Como vai o negócio neste ano? | `/agronegocio/conjuntura` | Safra estimada (produção, área, rendimento), crescimento trimestral, exportações do ano, crédito rural (snapshot) | IBGE LSPA, SIDRA 6588; SIDRA 5932; Comex Stat; BCB/Sicor preservado |
| Quanto custa produzir? | `/agronegocio/insumos` | Fertilizantes (posições 3101 a 3105) e defensivos (3808) importados, valor unitário, origem, relação com a soja exportada | Comex Stat |
| Para quem vendemos e de quem dependemos? | `/agronegocio/mercados` | Exportações por capítulo e por país, destinos da soja em grão, origem dos fertilizantes | Comex Stat |

Decisões: agropecuária é a das Contas Nacionais (dentro da porteira), não o agronegócio ampliado; o recorte agro do comércio é por capítulo do Sistema Harmonizado (01 a 24, 41, 44, 47, 50 a 53), não a lista do Agrostat; valor unitário de comércio não é preço na fazenda; a relação de troca compara o mesmo intervalo de meses nos dois anos; safras de milho e feijão somam produção, nunca área. O Comex Stat aplica o intervalo de meses do período a cada ano quando há detalhe mensal, por isso séries anuais usam anos fechados e o acumulado do ano tem consulta própria. Conab (custos de referência) não respondeu na coleta de 17/10/2026 e continua fora.

## Cobertura por cadeia

| Cadeia | Produção física e calendário observado | Crédito preservado | Outros conteúdos |
|---|---|---|---|
| Soja | Não integrado | Item Soja entre maiores itens do custeio | História conceitual e cenários de lavoura |
| Milho | Não integrado; safras não somadas como área física | Item Milho no custeio | Usos e safras conceituais; cenários |
| Arroz | Não integrado; casca não equivale a beneficiado | Item Arroz no custeio | Beneficiamento conceitual; cenários |
| Feijão | Não integrado | Não identificado nos 15 maiores preservados; não é zero | História conceitual; cenários |
| Café | Não integrado | Item Café no custeio e investimento | Unidades e processamento conceituais; cenários |
| Carne bovina | Rebanho, abate e carcaça não integrados | Item Bovinos, **sem separar corte de leite** | Fluxos e unidades próprios; não usa margem por hectare de lavoura |
| Leite | Litros, vacas e rendimento não integrados | Não atribuímos o item genérico Bovinos ao leite | Volume e perecibilidade conceituais; caixa |

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
| F | 2 | 2 | 3 | 7 |
| G | 0 | 1 | 3 | 4 |
| H | 1 | 4 | 2 | 7 |
| T | 2 | 6 | 0 | 8 |

Idioma do observatório: português. A entrada da plataforma foi integrada às duas versões da home; o nome do produto permanece em português e sua breve explicação inglesa não equivale à tradução de todo o observatório.
