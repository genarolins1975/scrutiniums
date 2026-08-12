# FONTES_OPERACIONAL.md — registro de fontes dos indicadores operacionais (Fase 0)

Verificação empírica das três fontes: 05/08/2026 (downloads reais, estruturas
conferidas coluna a coluna); cobertura ampliada e reverificada em 06/08/2026.
Classificação de confiabilidade: **A** dado administrativo oficial (mesma escala
dos painéis de bets e fraudes).

## 0. Universo coberto — critério e fronteira

O painel deixou de seguir apenas o recorte da B3 (18 companhias do piloto de
mercado). O universo passou a ser objetivo e verificável na própria fonte:
**toda companhia que a CVM classifica no setor de atividade "Bancos" com
registro ativo**, lido da tabela `fca_cia_aberta_geral_{ano}.csv`. Entram ainda,
por fontes próprias, três instituições sem registro de companhia aberta: Caixa e
Safra (rede do ESTBAN) e Nubank (clientes via SEC).

O cadastro inteiro da CVM é guardado no silver (`oper_cadastro_cvm`), o que
permite publicar no gold — e na tela — **quais bancos registrados ainda estão
fora**, com nome, CNPJ e o ano da última entrega do FCA. Registro "ativo" com
entrega antiga costuma ser caso encerrado que nunca foi baixado na CVM; nenhum
dos que ficam de fora publica a tabela de empregados do FRE, e entrariam como
linha vazia.

A chave de coleta carrega uma assinatura do conjunto de instituições
(`CADASTRO_SHA`): incluir uma instituição faz o pipeline reabsorver todos os
anos de FRE/FCA uma vez, para que ela nasça com a série inteira em vez de um
único ano.

## 1. CVM — Formulário de Referência (FRE), dados abertos

- URL do dataset: https://dados.cvm.gov.br/dataset/cia_aberta-doc-fre
- Arquivos: `fre_cia_aberta_{ano}.zip` (≈8,5 MB/ano); tabela usada:
  `fre_cia_aberta_empregado_posicao_local_{ano}.csv` (item 10.1 — empregados por
  posição Liderança/Não-liderança e por região Norte/Nordeste/Centro-Oeste/
  Sudeste/Sul/Exterior)
- Primeiro ano com a tabela: **2023** (Resolução CVM 59)
- Frequência: anual, com retificações ao longo do ano (campo `Versao`; fica a maior)
- População: companhias abertas registradas na CVM. Além das 18 do piloto de
  mercado, entram os demais bancos do setor "Bancos" da CVM com tabela de
  empregados publicada: Banpará, Daycoval, Paraná Banco, Banco Pan, Banco RCI,
  Investimentos Bemge, Mercantil Financeira e Inter & Co (holding do Banco
  Inter, CNPJ 42.737.954/0001-21 — distinto do CNPJ 00.416.968 usado no ESTBAN).
  Caixa, Safra e Nubank não têm registro de companhia aberta e ficam fora desta
  fonte
- Limitações: escopo declarado pela companhia (pode ser holding, banco ou
  consolidado — difere entre companhias e do conglomerado prudencial do IF.data);
  data de referência conforme informada pela CVM · Confiabilidade: **A**

## 2. CVM — Formulário Cadastral (FCA), dados abertos

- URL do dataset: https://dados.cvm.gov.br/dataset/cia_aberta-doc-fca
- Arquivos: `fca_cia_aberta_{ano}.zip` (≈0,4 MB/ano); tabela usada:
  `fca_cia_aberta_auditor_{ano}.csv` (auditor independente, CNPJ, datas de início
  e fim de atuação)
- Anos coletados: 2021 em diante · Frequência: anual com retificações
- Uso: auditor vigente (sem data de fim) + histórico de trocas de auditor
- Confiabilidade: **A**

## 3. BCB — cadastro de agências, postos e postos eletrônicos (Unicad)

- Página do BC: https://www.bcb.gov.br/fis/info/agencias.asp
- APIs (Olinda, CSV): `Informes_Agencias/Agencias`, `Informes_PostosDeAtendimento/PostosAtendimento`,
  `Informes_PostosDeAtendimentoEletronico/PostosAtendimentoEletronico`
- Granularidade: uma linha por dependência, com CNPJ-raiz da instituição, tipo
  de posto declarado, município (código IBGE) e UF
- Volume verificado em 06/08/2026 (posição 05/08/2026): 13.895 agências,
  22.738 postos de atendimento e 22.249 PAEs
- **Não é série**: o BC republica o arquivo com a posição corrente e não divulga
  histórico. O pipeline grava a posição em `dep_unidades` e acumula o agregado
  por instituição em `dep_hist`, de modo que a série passa a existir a partir da
  primeira coleta — nunca reconstruída de memória.
- **Conceito distinto do ESTBAN, jamais somado nem reconciliado**: aqui são
  agências CADASTRADAS; lá são as PROCESSADAS no mês (as que entregaram
  balancete). Os totais diferem em conceito e em data-base, e o painel exibe os
  dois lado a lado dizendo por quê.
- Uso no painel: contagem por instituição (agências, postos, PAEs, municípios
  atendidos) e cobertura municipal do país — 5.193 dos 5.570 municípios têm
  algum ponto; 2.292 são atendidos só por posto ou terminal, sem agência; 377
  não têm nenhum dos três · Confiabilidade: **A**
- Alcance além do painel: o cadastro traz 1.181 instituições, muito mais do que
  as 29 do painel. A página de QUALQUER instituição com CNPJ-raiz conhecido
  passa a exibir a rede de atendimento, inclusive quem não tem FRE, auditor nem
  ESTBAN — para essas, é o único indicador operacional disponível. O comparador
  ganha a coluna de postos e PAE, com data-base própria declarada.
- Números citáveis derivados na síntese de `/imprensa`: municípios sem nenhum
  ponto (377), municípios só com posto ou terminal (2.292) e total de postos e
  PAEs (44.987). O conceito registra que **não é medida de acesso**:
  correspondentes bancários e canais digitais ficam fora deste cadastro.

## 3b. BCB — Correspondentes no País (cadastro por contratante e município)

- Página do BC: https://www.bcb.gov.br/fis/info/correspondentes.asp
- API (Olinda, CSV): `Informes_Correspondentes/Correspondentes`
- Granularidade: uma linha por ponto de atendimento de correspondente, com
  CNPJ-raiz da instituição CONTRATANTE, CNPJ do correspondente, tipo do ponto
  (sede, filial, posto) e município (código IBGE)
- Volume verificado em 06/08/2026 (posição 05/08/2026): **215.617 pontos**,
  279 instituições contratantes, 175.782 correspondentes distintos, 5.571
  municípios alcançados
- **Contratante não é grupo econômico.** A contratação é da entidade que assina
  o contrato — frequentemente a financeira e não o banco (Santander e Safra são
  os casos maiores). As contagens ficam por CNPJ-raiz contratante, como o BC
  publica; consolidar por grupo exigiria um mapa de controle que a fonte não traz.
- **Ponto não é exclusividade.** O mesmo estabelecimento pode ser correspondente
  de várias instituições e é contado uma vez para cada uma: somar instituições
  superestima pontos físicos distintos.
- **Serviço prestado varia** pelos incisos da Resolução 3.954: um ponto que só
  recebe boleto não faz o mesmo que um que abre conta e origina crédito. O
  cadastro não é medida de acesso a crédito.
- Sem série histórica publicada: a coleta grava a posição e acumula o agregado
  por instituição, como nos demais cadastros · Confiabilidade: **A**

### Correção de um número já publicado

A primeira versão da cobertura municipal usou o literal 5.570 como denominador
e contou como "com dependência" todo código de município que aparecia no
cadastro do BC. Dois códigos não pertenciam à malha usada (um inválido e
**Boa Esperança do Norte/MT**, instalado depois do Censo 2022), e o painel
publicou **377 municípios sem ponto de atendimento**.

O número correto, contra a lista de municípios do IBGE que o próprio pipeline
carrega (5.571 registros, incluindo Fernando de Noronha e Boa Esperança do
Norte), é **379 municípios sem agência, posto ou PAE**. E o mais importante:
**todos os 379 têm correspondente contratado** — o país tem **zero** municípios
sem nenhum ponto físico de atendimento. A lacuna real não é de presença, é de
TIPO de ponto disponível. O denominador passou a vir da tabela `ibge_municipios`
e um teste proíbe o literal.

## 4. BCB — ESTBAN, Estatística Bancária Mensal por município

- URL: https://www.bcb.gov.br/estatisticas/estatisticabancariamunicipios
- Lista de arquivos via API do próprio site (mesma infraestrutura do painel de
  penetração, `pipeline/sources/estban.py`); arquivos mensais ≈0,9 MB
- Colunas usadas: `CNPJ` (raiz de 8 dígitos do banco), `NOME_INSTITUICAO`,
  `AGEN_PROCESSADAS`, `CODMUN`
- Cobertura no corte: 38 data-bases (2023-02 a 2026-03), ~110 bancos com agência
- Defasagem: ~3 meses (padrão da fonte)
- Limitações: agências processadas ≠ postos de atendimento ≠ correspondentes;
  o CNPJ é do banco operacional, não da holding; migrações societárias produzem
  saltos reais na série de um CNPJ (flag automática acima de 15% em 12 meses)
- Confiabilidade: **A**

## 5. CVM — IPE (Informações Periódicas e Eventuais) — Fase 2

- URL do dataset: https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/IPE/DADOS/
  (`ipe_cia_aberta_{ano}.zip`, ≈1,4 MB/ano; PDFs baixados de rad.cvm.gov.br)
- Uso: descoberta **estruturada** dos releases de resultados dos bancos S1/S2
  listados (Itaú "Análise Gerencial da Operação", BB "Análise do Desempenho" e
  "BB Notícias", Bradesco "Relatório de Análise Econômica e Financeira" e
  "Press Release", Santander "Release de Resultados", BTG "Earnings Release",
  Banrisul e BNB "Apresentação de Resultados")
- Regras de seleção explícitas por banco em `pipeline/sources/releases.py`;
  reentrega substitui a versão anterior (rastreado em `substituido_por`)
- Conteúdo extraído: contagens de clientes, com página e trecho literal como
  evidência obrigatória e **revisão humana antes de publicar**
  (ver METODOLOGIA_OPERACIONAL.md, Fase 2)
- Limitações: número **reportado pela companhia**, no conceito dela —
  comparabilidade C (nunca entre bancos, nunca em ranking); cobertura desigual
  por desenho (quem não divulga aparece como ausência com motivo)
- Confiabilidade do protocolo: **A** (registro administrativo da CVM); o valor
  divulgado é `reportado` pela companhia

## 6. Fontes fora da CVM — Fase 2 (Caixa, Safra, Nubank e Inter)

- **SEC/EDGAR** (Nubank — Nu Holdings, CIK 1691493; Inter & Co, CIK 1864163):
  arquivos 6-K com os earnings releases, baixados do domínio da própria SEC
  (www.sec.gov). A descoberta de 6-K novos é automática (índice EDGAR por CIK,
  registrada como AVISO em `rel_ext_avisos` para a sessão de curadoria — um
  6-K pode ser qualquer coisa, então nada é baixado às cegas) · **A**
  (registro administrativo da SEC); valor `reportado` pela companhia
- **RI da Caixa** (não listada; plataforma MZ, api.mziq.com): Relatório de
  Análise de Desempenho trimestral, com URL verificada e registrada no
  cadastro explícito de `pipeline/sources/releases_ext.py` — sem crawler;
  documento novo entra no cadastro a cada temporada · valor `reportado`
- Limitações: mesmos conceitos próprios por companhia (comparabilidade C);
  o Nubank divulga piso ("mais de 115 milhões no Brasil"), não contagem exata

## Instituições cobertas no corte

18 companhias listadas do piloto (Itaú, BB, Bradesco, Santander, BTG, ABC,
Banrisul, BMG, Pine, Amazônia, Nordeste, Banestes, Mercantil, BRB, Banese,
BR Partners, Alfa, BMI) + 2 só-rede (Caixa, Safra). Cobertura por bloco no
próprio gold (`cobertura`): empregados e auditoria para as listadas; rede para
os CNPJs com dependências no ESTBAN.

## 7. Quadro de pessoal por divulgação própria (Fase 2)

Instituições sem registro de companhia aberta não entregam o item 10.1 do FRE.
Quando publicam o quadro no próprio relatório, o número entra pela Fase 2, com
evidência obrigatória e revisão humana (as três observações abaixo foram
aprovadas pelo proprietário em 06/08/2026 e estão publicadas), e **em tabela
separada da série do FRE**
— conceito, escopo e data-base são os da divulgação, e somar as duas coisas
criaria comparação falsa.

| Instituição | Métrica | Valor | Referência | Documento (p.) |
|---|---|---|---|---|
| Caixa | Empregados CAIXA | 84.363 | 1T26 | Relatório de Análise de Desempenho 1T26 (p. 8) |
| Caixa | Colaboradores (inclui estagiários e aprendizes) | 90.039 | 1T26 | idem (p. 8) |
| Banco Safra | Colaboradores do Conglomerado (indivíduos) | 8.339 | mar/2026 | Resumo Consolidado e Principais Indicadores — mar/2026 (p. 1) |

- Documento da Caixa: plataforma MZ do RI (mesmo protocolo já usado para clientes).
- Documento do Safra: https://www.safra.com.br/data/files/D2/E4/8D/BC/1582E910BB0B22D901B9F9C2/Resumo%20Consolidado%20e%20Principais%20Indicadores%20-%20mar%202026.pdf — identidade conferida pelo CNPJ 58.160.789/0001-28 impresso no cabeçalho.
- Ausência registrada: o resumo do Safra não separa empregados de estagiários e aprendizes; a métrica de empregados fica ausente, nunca estimada.
- Um relatório anual de 2025 devolvido por busca como sendo do Safra foi **descartado** na conferência: o documento era de uma companhia agrícola (menciona fazendas e 6.729 colaboradores). Nenhum número dele entrou. Documento só entra depois de conferida a identidade no próprio arquivo.

## 8. Presença bancária física por município (gold `presenca_mun.json`)

Junção dos dois cadastros do BC no nível do município, contra a lista de
municípios do IBGE. Construída por `pipeline/presenca.py`; alimenta o mapa
categórico da aba operacional.

Classes, ordenadas por profundidade do atendimento:

| Classe | Significado | Municípios |
|---|---|---|
| Com agência | ao menos uma agência cadastrada | 2.901 (52,1%) |
| Só posto ou terminal | sem agência, com posto de atendimento ou PAE | 2.291 (41,1%) |
| Só correspondente | sem dependência própria; atendimento só por terceiro contratado | 379 (6,8%) |
| Nenhum ponto físico | nada nos dois cadastros | 0 |

Concentração da classe "só correspondente": Piauí (96 de 224 municípios, 43%),
Paraíba (68 de 223, 30%), Rio Grande do Norte (46 de 167, 28%) e Tocantins
(39 de 139, 28%).

**O que o mapa não diz** (declarado na tela e travado em teste): não mede
acesso — canais digitais ficam fora; não mede qualidade, horário nem distância
percorrida; correspondentes de escopos muito diferentes caem na mesma classe,
porque o cadastro declara serviço por contrato e não por ponto de forma
comparável.

**Malha × denominador:** a malha desenha 5.570 polígonos e as contagens usam os
5.571 municípios da lista do IBGE — Boa Esperança do Norte (MT), instalado
depois do Censo 2022, entra nas tabelas e ainda não no desenho. A diferença
aparece na legenda do mapa em vez de ser resolvida em silêncio.

## 8. PNCP — contratações de folha de pagamento com instituições financeiras

- **Fonte:** Portal Nacional de Contratações Públicas (Lei 14.133/2021),
  https://pncp.gov.br — API pública, sem cadastro. A busca (`api/search`) é o
  índice; o detalhe do contrato (`api/pncp/v1/orgaos/{cnpj}/contratos/{ano}/{seq}`)
  traz fornecedor (razão social + CNPJ), valor, vigência e o flag `receita`.
- **Coletor:** `pipeline/sources/pncp_folha.py` → silver `pncp_folha_contratos`,
  `pncp_folha_editais`. Incremental por `numero_controle_pncp`; backfill
  RETOMÁVEL (o PNCP derruba conexões sob carga contínua — medido em 08/2026 —
  então cada execução avança o que a fonte aceitar e marca o backfill completo
  só depois de uma passada inteira sem falha).
- **Classificação de IF:** heurística declarada sobre a razão social do
  fornecedor (denominações do sistema financeiro + marcas: "ITAU UNIBANCO S/A"
  não contém "BANCO"). Agrupamento por CNPJ-raiz — a mesma instituição chega
  em várias grafias.
- **Semântica do valor — a limitação central:** na cessão onerosa o banco PAGA
  ao ente (contrato nasce como `receita`); em contratos de tarifa o ente paga;
  muitos registros trazem valor simbólico (R$ 0,01). Por isso o gold rankeia
  por CONTAGEM de contratos e nunca soma valores.
- **Cobertura:** desde a obrigatoriedade do PNCP (2023-24). Leilões anteriores
  (ex.: Fortaleza 2019) vivem na camada curada `pipeline/curated/folha_leiloes.json`,
  com fonte e nível (A = oficial; B = imprensa congruente) por entrada.
- **INSS (pregão 90.005/2024):** ordem de preferência em 26 lotes para pagar
  os novos benefícios 2025-2029 (Crefisa 25, Banco Mercantil o lote 3 — MT/MS).
  Os lances por lote estão no Termo de Adjudicação e Homologação (SEI nº
  18539061) e aguardam extração pelo processo da Fase 2 — ausência declarada.
- **Rodada 2 (proposta):** cruzar com o intangível "direitos de gestão de
  folhas de pagamento" das DFP/ITR (CVM) — o que os bancos pagam pela folha
  pelo lado do balanço.

## 9. CVM/ENET — intangível de folha nas DFP (Fase 2, rodada 2 do painel de folha)

- **Fonte:** notas explicativas das DFP 31/12/2025, baixadas pelo canal oficial
  ENET (`rad.cvm.gov.br/ENET/frmDownloadDocumento.aspx`, links do CSV-mestre
  `dfp_cia_aberta_{ano}.zip` de dados.cvm.gov.br). O plano de contas
  ESTRUTURADO (BPA) só traz o agregado do intangível — verificado: zero contas
  com "folha" — então a abertura vem só das notas (PDF), pelo processo da
  Fase 2 (extração com documento, página, trecho; publica só `aprovado`).
- **Curadoria:** `pipeline/curated/folha_balanco.json`. O que cada banco
  divulga é DIFERENTE, e cada observação declara `exclusivo_folha`:
  - **BB** isola "Direitos de gestão de folhas de pagamento" (nota 16);
  - **Bradesco** publica a categoria mais ampla "Aquisição de direitos
    financeiros" (nota 15, IFRS) — inclui folha, não exclusivamente;
  - **Itaú** mistura folha em "Outros Ativos Intangíveis" (nota 14), mas
    divulga a despesa de amortização específica de folha em texto;
  - **Santander** não isola (relacionamento com clientes adquiridos +
    prêmios de folha em recebíveis) — ausência declarada.
- **Regra editorial:** conceitos e unidades não comparáveis entre bancos
  (R$ mil × R$ milhões; isolado × categoria ampla) — nunca somar, nunca
  ranquear; comparabilidade C, cada série vale contra ela mesma.

## 10. IF.data UI — funding e DRE por conglomerado (custo de captação e modelo de negócio)

- **Fonte:** arquivos JSON da interface do IF.data
  (`www3.bcb.gov.br/ifdata/rest/arquivos?nomeArquivo=ifdata_2025_2030`,
  `dados{AAAAMM}_1.json`), a mesma infraestrutura já usada pelo coletor de
  carteiras. Traz o passivo (depósitos à vista/poupança/prazo/interfinanceiro/
  outros, captações totais) e a DRE (despesa de juros de captações, resultado
  de intermediação, rendas de serviços/tarifas/pagamentos) por entidade.
- **Coletor:** `pipeline/sources/ifdata_funding.py` → `institution_metrics`
  (`fund:*`, `dre:*`), com o mesmo mapa de tradução de conglomerado prudencial
  do `ifdata_ui`. Inclui despesas de pessoal (lid 141858) e administrativas
  (141859) — rodada 1 de custos operacionais. O marcador de recência do
  coletor é a métrica MAIS NOVA da tabela: lids novos forçam a releitura
  idempotente dos períodos já coletados.
- **Duas semânticas medidas empiricamente (Itaú 2025-12 × 2026-03) que viajam
  com o dado:**
  1. **A DRE acumula POR SEMESTRE** — mar/set = 3 meses, jun/dez = 6. Qualquer
     anualização declara os meses do período; nunca um ×4 cego.
  2. **Layouts contábeis:** lids da Res. 4.966 (14xxxx) de 2025 em diante;
     layout antigo (78xxx) antes. O coletor faz fallback e a fronteira fica
     documentada no módulo.
- **Custo de captação (DADO CALCULADO, `institutions.json → captacao`):**
  |despesa de juros de captações| anualizada pelos meses da DRE ÷ média das
  captações totais nas pontas atual e anterior (ou ponta única, sinalizado).
  É estimativa: estoque de pontas (não saldo médio diário), funding de varejo
  e mercado misturados. Custo fora de 0,05–100% a.a. é DESCARTADO (unidade ou
  tradução suspeita; o piso, no valor bruto, evita que um 0,004% vire 0,00
  publicado após o arredondamento — memória do Banco Clássico, 12/08/2026) —
  nunca publicado. Fórmula declarada por instituição.
- **Modelo de negócio (`institutions.json → modelo_negocio`):** peso dos
  serviços na receita operacional (serviços ÷ intermediação + serviços;
  omitido quando a intermediação é negativa), crédito/ativo e captações/ativo;
  o perfil de carteira (modalidades PF/PJ, PME, HHI) segue em
  `carteira_perfil`. Métrica ausente ⇒ campo omitido, nunca imputado.
- **Índice de eficiência (`modelo_negocio.eficiencia_pct`):** (|pessoal| +
  |administrativas|) ÷ (intermediação + serviços) do MESMO período semestral
  da DRE — a razão é consistente sem anualização. Quanto menor, mais
  eficiente. Fora de 0,5–300% é omitido (unidade/tradução suspeita; piso no valor bruto). Não
  inclui tributárias nem outras operacionais — declarado no conceito.
- **Escala:** `config.ifdata.top_n_by_assets = 100` — o corte scorado vai às
  top 100 por ativo. A coleta já cobria o universo inteiro; grupos de pares
  com <5 membros seguem caindo para o conjunto completo, com sinalização.

## 11. Custos de TI dos bancos — DFP (Fase 2) + agregado Febraban

- **Fonte primária:** notas explicativas das DFP 31/12/2025 (canal oficial
  CVM/ENET) — os MESMOS quatro documentos da curadoria do intangível de folha,
  com identidade verificada no arquivo. Curadoria em
  `pipeline/curated/custos_ti.json`; bloco `custos_ti` do gold
  `operacional.json` publica só `aprovado` (Fase 2), com documento, página e
  trecho por observação.
- **O que cada banco divulga é DIFERENTE** — e cada observação declara regime
  e escopo (`exclusivo_ti`):
  - **BB**: "Processamento de dados" isolado, em BRGAAP consolidado (nota
    25.b) e em IFRS (nota 12, com comparativo 2024);
  - **Bradesco**: "Processamento de dados" isolado, IFRS consolidado (nota
    34, série 2023-2025);
  - **Itaú**: "Processamento de Dados e Telecomunicações" (nota 23) — INCLUI
    telecom, não comparável; R$ milhões;
  - **Santander**: BRGAAP "Processamento de Dados" (nota 25; o Banco
    individual supera o consolidado por eliminações intragrupo — a Santander
    Tecnologia fatura ao banco) e IFRS "Tecnologia e sistemas" (nota 40,
    categoria mais ampla).
- **Regra editorial:** conceitos e regimes NÃO comparáveis entre bancos
  (BRGAAP × IFRS; com/sem telecom; R$ mil × R$ milhões) — nunca somar, nunca
  ranquear; comparabilidade C, cada série contra ela mesma.
- **É DESPESA (opex):** o capex de TI capitalizado no intangível fica fora.
  Por isso a camada agregada — Pesquisa Febraban de Tecnologia Bancária 2025
  (Deloitte; 20 bancos, 85% dos ativos): orçamento de R$ 47,8 bi previsto para
  2025 (R$ 42,3 bi em 2024), conceito capex+opex — entra à parte e NUNCA se
  compara às linhas das DFP.
- **Próximo degrau:** ITRs 2T26 (agosto) inauguram a série intra-anual das
  mesmas rubricas pelos mesmos documentos oficiais.

## 12. Timeline regulatória transversal (aba Regulação)

- **Camada 100% curada:** `pipeline/curated/timeline_regulatoria.json` → gold
  `regulacao.json` (builder `pipeline/regulacao.py`). Cada marco tem norma,
  órgão, data, URL OFICIAL (Planalto / BCB-CMN — nenhum link inferido) e os
  painéis do Observatório que afeta.
- **Régua editorial, não censo:** entram os marcos que explicam quebras
  visíveis nas NOSSAS séries (Res. 4.966 e a fronteira contábil 2025; Lei
  14.690 e o teto do rotativo; MP 1.292/Lei 15.179 e o consignado CLT; Pix,
  MED e endurecimentos antifraude; Lei 14.133/PNCP; Open Finance; bets).
- **Marcadores nas séries:** `serie_x` (AAAA-MM) é o mês da VIGÊNCIA (quando
  difere da publicação) em que o marco vira linha vertical nos gráficos de
  pix (MED), consignado (junto às mudanças de margem já marcadas) e
  desenrola, via `marcosRegulatorios(painel)` na SPA. O aviso acompanha:
  coincidência no tempo não é efeito — o marcador existe para permitir
  inspeção, nunca para atribuir variação à norma.
- **Timelines temáticas continuam nas abas:** bets (2018–2026) e fraudes
  (2020–2026) são mais detalhadas e a aba Regulação aponta para elas.

## 13. Guidance × entregue (Fase 2 — aba Instituições)

- **Fonte:** documentos de resultados protocolados pelos próprios bancos na
  CVM (IPE/ENET) — Análise Gerencial (Itaú), Análise do Desempenho (BB),
  Relatório de Análise Econômica e Financeira (Bradesco), Informe de
  Resultados (Santander). Curadoria em `pipeline/curated/guidance.json`;
  builder `pipeline/guidance_bancos.py` → gold `guidance.json` publica só
  ciclos `aprovado`, com evidência (documento, página, trecho).
- **Ciclos da rodada 1:** BB 2025 (fechado, aferido pela companhia — Agro
  abaixo do intervalo, desvio declarado pelo próprio BB) e 2026; Bradesco
  2025 (fechado, aferido pela companhia — carteira expandida e seguros acima)
  e 2026; Itaú 2025 (fechado, pareamento do OBSERVATÓRIO sobre a DRE
  gerencial da própria companhia, fórmula declarada por métrica) e 2026
  (base ajustada NOVA, declarada; mantido no 1T26); Santander — AUSÊNCIA
  DECLARADA (não publica guidance quantitativo).
- **Regras editoriais (testadas):** cada banco SÓ contra o próprio guidance —
  nunca comparar, somar ou ranquear cumprimento entre bancos; `situacao`
  (dentro/acima/abaixo) é posição aritmética no intervalo, não juízo de
  mérito (recomputada em teste); aferição do Observatório exige fórmula por
  métrica; guidance não é promessa jurídica; mudança de base entre ciclos é
  declarada e quebra a comparabilidade entre eles.
- **Cadência:** ciclos vigentes são acompanhados a cada divulgação
  trimestral (ITR/releases via IPE) e fechados na divulgação anual seguinte.
  Cada acompanhamento é uma extração própria com o próprio gate de aprovação
  (`acompanhamentos[]` no ciclo): revisões de intervalo apontam a métrica
  revisada; realizado parcial de semestre NUNCA vira aferição — a aferição só
  existe no fechamento do ciclo. Rodada 2T26 (12/08/2026): Itaú REVISOU
  serviços/seguros (5-9% → 2-5%, demais mantidos); Bradesco manteve tudo e
  publicou o realizado 1S26; BB ainda não havia divulgado (pendência
  declarada); Santander segue sem guidance. A rodada também inaugurou a
  série intra-anual de TI (§11) e a amortização de folha 1S26 do Itaú (§9).

## 14. Backfill histórico do IF.data (2015-2024)

- **Fonte:** Olinda IF.data, relatório Resumo, TipoInstituicao=2 — os mesmos
  endpoints do coletor diário, estendidos a 40 trimestres (2015-03 a 2024-12,
  `config.ifdata.anomes_history`). Validado empiricamente: ~1.300-1.570
  instituições por período, maior ativo coerente (BB R$ 1,37 tri em 2015).
- **Plano contábil antigo:** até 2024 a carteira é a "Carteira de Crédito
  Classificada" (Res. 2.682) e o passivo tem outro nome — mapeados em
  `COL_MAP_HISTORICO`. A fronteira 2024/2025 (Res. 4.966) atravessa a série,
  é declarada no método do gold e está marcada na aba Regulação.
- **Salvaguardas:** backfill CAPADO (`backfill_por_execucao`, 10/run ≈ 3 min)
  e idempotente — se o cache do CI expirar, reconverge em 4 execuções diárias;
  falha consome o cap (nunca trava num período quebrado). Cadastro histórico
  com INSERT OR IGNORE: instituições extintas entram com o nome da época e o
  registro ATUAL nunca é sobrescrito por dado antigo.
- **Leituras que a série longa habilita:** score através de ciclos completos
  (2015-16, pandemia, aperto 2021-23), "maior/menor desde X", validação das
  elasticidades. Segmentação prudencial ATUAL aplicada retroativamente
  (declarado); Basileia/carteiras detalhadas/DRE históricas ficam para a
  próxima rodada (arquivos da UI por bundle antigo).

## 15. Pilar 3 (KM1) via DASFN — liquidez e capital regulatórios

- **Fonte:** arranjo de dados abertos do SFN (DASFN): o BCB mantém o REGISTRO
  central (Olinda, api `pilar3`) e cada instituição serve os próprios JSONs
  KM1 no padrão da Res. BCB 54/2020. Medido em 08/2026: 75 instituições com
  KM1; grandes atualizados ao trimestre corrente; cada payload traz 5
  trimestres (colunas t..t_4).
- **Coletor:** `pipeline/sources/pilar3.py` → silver `pilar3_km1`. Só
  métricas-RAZÃO (ICP, Nível 1, Basileia, ACP, margem, alavancagem, LCR,
  NSFR): linhas monetárias têm unidade ambígua entre bancos (R$ mil ×
  milhões) e ficam fora — omitido, nunca adivinhado. Escalas heterogêneas
  (BB em %, Itaú/Santander em fração) normalizadas por régua de
  plausibilidade POR MÉTRICA; fora de régua é descartado. Sistêmicos
  primeiro (PRIORIDADE), retry para resets, cap por execução, falha consome
  o cap.
- **Gold `pilar3.json` + card na página da IF:** join pelo CNPJ do líder do
  conglomerado (códigos de conglomerado mudam entre períodos; o CNPJ-raiz
  não). Mínimos regulatórios anotados por métrica (LCR/NSFR 100%; Basileia
  8%; alavancagem 3%).
- **Cautelas centrais:** requerimento de LCR/NSFR alcança S1/S2 — ausência
  não é descumprimento; cobertura é a do arranjo (Bradesco NÃO registra —
  verificado, zero registros; Caixa parou em 2022) — ausências declaradas,
  nunca silenciosas. Validação: BB LCR 167,7%/NSFR 113,9%; Itaú 195,1/122,0;
  Santander 189,1/115,2; BTG 160,9/102,2 (2026-1), coerentes com os PDFs de
  Pilar 3 (KM1 do Itaú conferida no documento do IPE).

## 16. Regimes de resolução do BCB — vigentes + memória acumulada

- **Fonte:** Olinda `regimes_especiais` (dados abertos do BCB, atualização
  diária): a lista VIGENTE de instituições sob intervenção, RAET ou
  liquidação extrajudicial, com tipo, data de decretação e responsável
  nomeado. Coletor `pipeline/sources/regimes.py`; gold `regimes.json`;
  seção na aba Instituições.
- **Memória institucional:** a fonte só publica o estado atual — o silver
  guarda `regimes_vigentes` (espelho) e `regimes_hist` (append-only por
  cnpj+início): um regime que sai da lista permanece na história com o
  último visto. É assim que o 'risco realizado' acumula daqui para frente.
- **Salvaguardas:** lista vazia é tratada como FALHA de fonte (espelho
  anterior preservado — sempre há liquidações em curso); regime em
  instituição pequena não é sinal sistêmico (cautela publicada); a
  decretação tem rito legal próprio (Lei 6.024/74, DL 2.321/85) e a
  listagem não substitui os atos oficiais.
- **Fronteira declarada:** casos anteriores à primeira coleta (as grandes
  resoluções de 1995-2015) entram por curadoria própria em rodada futura.

## 17. Recordes automáticos + kit de imprensa

- **Builder:** `pipeline/recordes.py` → gold `recordes.json`, recalculado do
  zero a cada execução (séries do SGS são revisáveis — nada é memorizado).
  Para a observação mais recente de cada série elegível: máximo/mínimo de
  toda a série histórica ou 'maior/menor desde <mês>' com janela mínima de
  24 meses.
- **Réguas editoriais (testadas):** só séries de razão (%, p.p., meses) —
  séries nominais em R$ e índices de nível (IVG-R, IBC-Br) crescem com o
  tempo e fariam recorde trivial todo mês, então ficam fora; recorde é
  posição aritmética na própria série, nunca juízo de mérito.
- **Superfícies:** bloco 'Recordes nas séries' na Visão geral (ligado por
  padrão, personalizável) e seção 'Para a imprensa' na aba Sobre (como
  citar, pauta pronta, RSS, pedido editorial de preservar as cautelas).
- **Primeira safra real (08/2026):** comprometimento de renda das famílias
  no máximo de toda a série (28,48%); inadimplência do consignado privado
  no máximo histórico (8,63%); taxa média PF maior desde 2017.

## 18. Remuneração da administração — FRE item 8 (dataset estruturado da CVM)

- **Fonte:** CSVs `fre_cia_aberta_remuneracao_total_orgao` e
  `remuneracao_maxima_minima_media` dentro de `fre_cia_aberta_{ano}.zip`
  (dados.cvm.gov.br) — NADA de PDF. Coletor
  `pipeline/sources/remuneracao.py`, filtrado aos bancos do cadastro CVM
  (setor 'Bancos', registro ativo; coleta é adiada se o cadastro estiver
  vazio no silver — nunca coletar sem filtro). Reapresentações: vence a
  maior versão por (cnpj, exercício, órgão).
- **Semântica:** o FRE do ano N traz o exercício N PREVISTO (proposta
  aprovada em assembleia) e os anteriores REALIZADOS (remuneração
  reconhecida no resultado) — nunca misturados no painel. Nº de membros é
  média anual ponderada (45,5 é normal) e viaja junto de toda média.
- **Bloco `remuneracao` no operacional.json + seção 'Quanto ganha a
  administração' na aba Operacional:** Diretoria Estatutária (total,
  membros, média/membro, maior individual quando divulgada), Conselho de
  Administração e a proposta do ano corrente. 21 bancos listados na
  primeira coleta (Itaú R$ 812,9 mi realizado 2025, média R$ 17,9
  mi/membro, maior individual R$ 87,0 mi; BB estatal R$ 64,0 mi, média
  R$ 2,0 mi).
- **Cautelas:** escopo da diretoria estatutária varia por governança;
  média ≠ mediana; só companhias abertas (ausência estrutural dos não
  listados); estatais sob regras próprias (SEST).

## 19. Cooperativas no corte + interconexão interfinanceira

- **Cooperativas:** o corte das top-100 já continha 23 instituições
  cooperativas (2 bancos cooperativos B1 — Sicredi e Sicoob — e 21
  centrais/singulares B3C/B3S); o que faltava era VISIBILIDADE. A aba
  Instituições ganhou filtro por tipo (bancos × cooperativas × não
  bancárias) pela classificação TCB do próprio BCB — nunca heurística de
  nome — e um card-síntese do segmento (contagem, centrais, ativo somado e
  share DO CORTE, com o denominador declarado).
- **Correção de fonte (dep_total):** o lid 140221 (total de depósitos) NÃO
  existe nos dados da UI do IF.data — é linha de grupo sem valor; por isso o
  mix de depósitos saiu nulo na primeira geração. O total agora é a SOMA
  declarada das cinco famílias (vista, poupança, prazo, interfinanceiro,
  outros) — verificado: 2.175 entidades têm os componentes em dados_1.
- **Interconexão:** seção 'funding interfinanceiro' na aba Instituições —
  depósitos interfinanceiros ÷ captações totais por IF, calculado dos
  blocos de captação publicados. É PROXY do lado passivo: a matriz bilateral
  (quem deve a quem) não é pública, e isso é dito. Interfinanceiro alto em
  CENTRAL cooperativa é desenho do sistema (as singulares depositam na
  central), não fragilidade — a tabela nunca é ranking de risco.

## 20. Camada didática de conceitos

- **O que é:** todo conceito importante do painel (26 na primeira safra: ROE,
  Basileia, CET1, RWA, ACP, alavancagem, LCR, NSFR, inadimplência 90d,
  atraso 15-90, ativos problemáticos, perda esperada/4.966, carteira,
  spread, custo do crédito, custo de captação, eficiência, HHI,
  percentis/quartis, o score do painel, segmentação S1-S5, guidance,
  Pilar 3, regimes de resolução, consignado, rotativo) vira um termo
  CLICÁVEL (sublinhado pontilhado) que abre a explicação em seis camadas:
  resumo de uma linha, INTUIÇÃO com analogia concreta, cálculo (e como o
  painel usa), um pouco de HISTÓRIA (sempre ancorada em ano), a REGULAÇÃO
  sem juridiquês e as ARMADILHAS de leitura — com infográfico SVG quando o
  desenho explica melhor (Basileia, LCR, aging do atraso, colchões ACP,
  eficiência, spread).
- **Onde:** dicionário `CONCEITOS` + motor `termo()`/`abrirConceito()` na
  SPA; termos aplicados nos cabeçalhos e cards mais visíveis (lista e ficha
  de instituições, Pilar 3, guidance, regimes, atraso por produto); lista
  completa em Metodologia ('Conceitos, do zero').
- **Contrato testado (conceitos.test.ts):** as seis camadas obrigatórias e
  substanciais em todo verbete; história com ano concreto (nunca
  'antigamente'); referências cruzadas apontando para verbetes existentes;
  infográficos referenciados existentes; ≥12 aplicações de termo() nas
  superfícies. O glossário técnico (/glossario, verbetes formais) segue
  como camada complementar.

## 21. Ficha da IF completa — guidance, TI, remuneração e folha por instituição

- A junção da ficha (página da IF) com os dados de companhia listada é pela
  RAIZ do CNPJ da holding (cadastro CVM), emitida como `cnpj8` em cada linha
  de `operacional.instituicoes` — separada do `cnpj8_rede` (banco operacional
  no ESTBAN), que difere nos conglomerados (ex.: Itaú holding 60872504 ×
  banco 60701190). Nunca junção por nome.
- Seções por IF (só aparecem quando a IF tem o dado; ausência não vira zero):
  guidance × realizado (ciclos + acompanhamentos, mesmo bloco de render da
  aba Instituições — `guidCicloBloco` compartilhado para as duas superfícies
  nunca divergirem), custos de TI, remuneração da administração (FRE item 8),
  folhas de pagamento no balanço, e aviso de regime de resolução vigente
  (quase sempre ausente — quando presente, é a primeira coisa da ficha).
- `fmt.money` ganhou o degrau de milhões: valores < R$ 1 bi eram exibidos
  como "R$ 0,x bi" (média por membro virava "R$ 0,0 bi") — agora "R$ x,y mi".
