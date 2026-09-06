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

## 22. HHI setorial — tratamento do resíduo "outros" (piso + cobertura)

- O balde "outros" da abertura por CNAE do IF.data é um AGREGADO residual —
  a soma de muitos setores não individualizados pela fonte, não um setor.
  Elevá-lo ao quadrado fabricava concentração: cooperativas e IPs com a
  carteira PJ inteira em "outros" saíam com HHI ~10.000 ("monopólio"), e o
  artefato disparava alerta de concentração e penalizava o score (dimensão
  concentração setorial). 249 alertas publicados eram artefato.
- Tratamento: "outros" permanece no denominador e no top_cnae (a composição
  mostrada é a real), mas NUNCA entra na soma de quadrados. O HHI publicado
  é um PISO sobre os setores identificados (o residual é tratado como
  pulverizado — verdadeiro por Cauchy: Σs² só cresce ao individualizar),
  com `hhi_cobertura_pct` declarada ao lado. Piso publicado só com
  cobertura ≥ 25% (abaixo disso é vácuo); o SCORE só usa a dimensão com
  cobertura ≥ 70% (pisos de coberturas díspares não são comparáveis em
  percentil) — ausência cai na máquina normal de dimensões indisponíveis.
- O alerta "concentração setorial elevada" só dispara quando o PISO já
  excede 3.000 — nunca mais um falso positivo por resíduo. Correção
  cirúrgica no gold publicado refez 755 perfis (piso = quadrados dos
  identificados visíveis no top-5; o ciclo diário completa a cauda exata);
  scores se recalculam no ciclo seguinte.

## 23. Varredura anti-artefato de resíduo (sequela da lição do HHI)

Auditoria sistemática das três formas do artefato "balde residual tratado
como categoria real": (1) índices quadráticos, (2) re-escala sobre "só o
identificado" sem cobertura declarada, (3) superlativos que coroam o resíduo.

Corrigidos nesta rodada:
- Frase-síntese dos pilotos "Carteira PJ concentrada em: outros (…)" —
  contrassenso; virou "Setores identificados na carteira PJ: …", com a
  fatia não individualizada declarada à parte.
- Superlativo do Panorama ("a deterioração é maior em …") passou a excluir
  o grupo "Outros" do SCR — aponta sempre produto identificável; a
  deterioração do residual segue visível nos ALERTAS, agora com nota de
  agregado ("a taxa é real, mas não aponta um produto único").
- SPA: "outros" na lista de setores PJ é exibido como
  "outros (não classificados)", nunca como se fosse um setor.

Verificados e LIMPOS (sem linha residual no universo ou tratamento já
declarado): HHI do Desenrola (73 conglomerados reais do SCR), HHI municipal
de moradia (bancos reais do ESTBAN), HHI por produto do IF.data (universo
reportante declarado), hhi_parcial do Open Finance (declarado "limite
inferior parcial" desde a origem), pme_share_pct (denominador "classificada
por porte" declarado na própria frase), mix de depósitos/funding (composição
exibida, nunca quadrática), recordes (sem categorias), pior faixa de renda
(exclui "Indisponível"; "Sem rendimento" é categoria real, não resíduo).

## 24. Recorte por segmento prudencial nos gráficos de produto

- Botões Todos/S1–S5 na página de cada produto recortam os três gráficos
  (carteira, atraso ≥15d, taxas), a matriz, o scatter e o histograma. A
  classificação vem do `sr` do cadastro BCB (Res. 4.553) — nunca heurística;
  nas taxas, o segmento da IF resolve por cnpj8 → conglomerado → cadastro.
- Salvaguardas de n mínimo, declaradas: ponto de volume só com ≥3
  reportantes, ponto de atraso só com ≥5 pares carteira+vencido, taxa do
  segmento só com ≥5 IFs na janela — "S2 com duas IFs" viraria a série
  daquelas duas com cara de mercado. Ponto omitido, nunca aproximado; com
  recorte ativo e agregado indisponível, a SPA declara a omissão e NUNCA
  cai para a série do universo (bug pego em teste sintético de render).
- Séries por segmento vivem em prod/{slug}.json (por_segmento no produto e
  por item de taxa; sr em cada linha de ranking); o resumo products.json
  não as carrega. Materializam no ciclo diário seguinte ao merge.

## 25. Painel Pix: perspectiva do recebedor, recortes PF/PJ e mapas de calor

- CONSERTO da perspectiva "Recebedor" no mapa por UF: as métricas por
  habitante e o valor médio do recebedor são DERIVADOS dos próprios números
  publicados (habitantes = transações pagas ÷ transações/habitante; tíquete
  do recebedor = valor recebido ÷ transações recebidas) — antes o clique
  zerava o mapa. Crescimento 12m existe só para o pagador: o botão fica
  desabilitado com o motivo, e a métrica cai para Valor total.
- Recortes Total/PF/PJ onde a fonte permite: valor pago no mapa por UF
  (v_pag_pf/v_pag_pj), série de usuários do DICT, e filtro por natureza do
  PAGADOR (P2*/B2*) na tabela de fluxos. Onde a fonte não abre (municípios,
  chaves por tipo), não há botão — ausência não é aproximada.
- Mapa de calor natureza: as classes P2P/P2B/… da própria fonte re-arranjadas
  em matriz pagador × recebedor (Pessoa/Empresa/Governo), com quantidade,
  valor e tíquete — nada estimado.
- Mapa de calor setorial (tabela especial EPAE): a matriz completa
  setor-pagador × setor-recebedor (23×21) de uma vez; a COR usa escala
  logarítmica declarada (fluxos variam 4 ordens de grandeza), o número é o
  valor real; diagonal = comércio intrassetorial real; célula ausente = fluxo
  não publicado. Universo SPI próprio, nunca somado à EPAE aberta.

## 26. Desenrola: consolidação financeiro + prudencial por grupo

- A fonte (SCR) reporta o MESMO grupo sob dois escopos de consolidação —
  conglomerado financeiro e conglomerado prudencial (ex.: Caixa 51626 +
  80738; Itaú 10069 + 80099) — e o painel os exibia como credores
  distintos, distorcendo o ranking: a Caixa, líder real em operações
  (22,1% consolidada), aparecia atrás do Nubank.
- Consolidação por mapa CURADO de códigos (14 pares, verificados
  empiricamente contra a base publicada em 12/08/2026 — nunca por nome),
  canônico = escopo financeiro. Operações, volume, faixas e período são
  somados; UFs distintas recontadas na base; tíquete, partes, HHI e top-5
  recalculados APÓS a consolidação (HHI 1.183 → 1.446; top-5 69,3% →
  78,4%). Cada linha consolidada declara os componentes, e a SPA exibe o
  rótulo "consolidado ⓘ" com a explicação e os componentes no tooltip.

## 27. P0 da auditoria de 12/08 — cinco correções

1. **Score setorial 100% observado**: os componentes demonstrativos
   (RJ 0,20 + emprego 0,15 = 35% do peso) saíram do número — pesos
   renormalizados para atividade 0,69 + condições de crédito 0,31; os
   demonstrativos seguem visíveis como "em construção", com peso ZERO.
   Invariante transversal novo em teste: nenhum número composto publicado
   contém componente não-observado com peso. Gold recalculado dos z
   publicados (27 setores).
2. **Histórico longo nas fichas**: o corte `[:5]` no builder escondia o
   backfill de 40 trimestres — `periods_hist` alimenta a evolução base-100
   com a fronteira da Res. 4.966 (2025-T1) declarada na nota ("mudança de
   régua, não de negócio"). Materializa no ciclo diário seguinte.
3. **CNPJ no cabeçalho**: instituições individuais = o código IF.data É a
   raiz; conglomerados = mapa curado (cadastro CVM/operacional), nunca por
   nome, nunca completando dígitos que a fonte não deu. 1.360 fichas
   corrigidas cirurgicamente.
4. **Vintage do score**: "calculado em DD/MM" no cartão do score e no
   cabeçalho da coluna — número composto nunca mais sem data.
5. **Placeholders fora de produção**: promessa "fase 2" do mapa municipal
   do Pix removida; menu "Relatórios" renomeado para "Perguntas rápidas"
   (o conteúdo é o assistente de consultas determinísticas).

## 28. Kit visual dos dossiês (P1 nº 3 da auditoria)

- Três componentes de FORMA reutilizáveis: `subnavFixa` (padrão da ficha de
  IF), `secWrap` (seção ancorada) e `placar` (números-tese da página em
  cinco segundos, cada um linkando à sua seção; valores sempre do gold,
  nunca fixos no código).
- Aplicados: Pix (9 seções ancoradas + subnav), Indicadores operacionais
  (10), Bets (10), Fraudes (9), Consignado (placar de abertura: inad INSS ×
  privado com o múltiplo calculado, reclamações, carteira total). Moradia e
  Consignado já tinham índice próprio de capítulos.
- Alertas com contexto: cada alerta macro carrega `serie_recente` (24 meses
  da própria série, embutidos pelo pipeline) e a Central exibe o sparkline
  no cartão — um Δ sem a curva ao lado induz leitura sem contexto. Os
  sparklines materializam no ciclo diário seguinte.
- Invariante de arco narrativo do Pix atualizado no teste: a ordem dos
  capítulos agora é verificada pela sequência das seções ancoradas.

## 29. P1 rodada 2 — BB aprovado, "O que mudou", Penetração e presets

- **Guidance BB 2T26 publicado**: o acompanhamento (tipo revisão) recebeu
  aprovação do proprietário em sessão de 13/08 e saiu de `em_revisao` para
  `aprovado` no curado; o gold foi reconstruído pelo próprio builder
  (`guidance_bancos.build()` escreve `data/gold/` e o publicado é cópia) —
  1 acompanhamento publicado, 0 em revisão. Documento-fonte da API de RI do
  BB (host mziq permitido na allowlist com `identidade` verificada dentro
  do arquivo).
- **Overview "O que mudou"** (`overview.novidades`): consolidado por regra
  determinística na execução diária — alertas em primeiro disparo (o flag
  `recorrente` do histórico), entradas em regimes de resolução nos últimos
  45 dias, recordes com referência recente e revisões de guidance do
  trimestre corrente/anterior (rótulos civis calculados, nunca fixos).
  Máximo de 8 itens, famílias distintas jamais ranqueadas entre si — a nota
  do bloco declara a régua. Dependências via `ler_gold_opcional`: gold
  ausente não derruba o overview, só encolhe o bloco.
- **Penetração**: a página abre no mapa (aviso → filtros → mapa → perfil),
  com agregados e cobertura depois — a pergunta que traz o leitor é
  "onde?". O ranking ativo ganhou exportação CSV (todos os campos dos dois
  métodos + coluna `metodos_divergem`) e a marcação "métodos divergem"
  quando modelo estatístico e benchmark de pares discordam sobre o SINAL do
  gap — o pior caso para citação fica sinalizado na linha, nunca escondido
  numa média.
- **Comparador com presets dinâmicos**: "maiores cooperativas" (TCB B3* do
  top-100, por ativo), "maiores S2" e "maiores S3" (segmento do índice de
  instituições, só conglomerados prudenciais — nível único, porque misturar
  níveis é bloqueado). Sempre calculados dos gold no momento do clique,
  nunca listas de nomes: quando o ranking muda na fonte, o preset muda
  junto.
- Versão 0.75.0; travas em `src/tests/novidades-presets.test.ts`.

## 30. Cenário → Basileia pós-choque (P1 nº 1 do Top 10)

- A aba Cenários fecha a promessa "impacto em instituições": o Δinad do
  cenário (elasticidades × choques dos sliders, rampa completa de 12 m)
  vira dedução no índice de Basileia das 100 maiores IFs — provisão do
  estoque ADICIONAL de inadimplência (carteira × Δinad × LGD 50%), com RWA
  constante e sem efeito fiscal.
- **Declarado como piso, antes da tabela**: a perda acumulada de 12 meses é
  maior (baixas recicladas não entram); o resultado escala linearmente com
  a LGD (40–60% ⇒ ×0,8–1,2). Choque favorável leva o aviso simétrico: não
  se modela reversão de provisões.
- **Δinad crítico** (slider-independente): colchão até a referência de PR
  10,5% (mínimo 8% + conservação 2,5%; adicionais sistêmicos de S1 fora,
  declarado) ÷ (carteira/RWA × LGD) — quantos p.p. de inadimplência
  adicional esgotariam o colchão. É a métrica que diferencia as IFs mesmo
  quando o choque dos presets é pequeno.
- 92 das 100 IFs entram (8 IPs sem RWA/carteira ficam fora e são contadas;
  carteira 0 com RWA existe — Cielo — e produz dedução 0 e crítico nulo).
  CSV com premissas no cabeçalho. Versão 0.76.0; travas em
  `src/tests/cenario-basileia.test.ts`.

## 31. Transformações de série no Pulso (P1 do Top 10 — "distância do FRED")

- **Quatro réguas nos gráficos dos blocos** (nível · variação a/a · base-100
  · R$ constantes), calculadas no navegador sobre as séries observadas do
  gold. Deflator IPCA construído da própria série do gold (SGS 433, produto
  acumulado da variação mensal, rebase no último mês disponível).
- Regras de honestidade: transformação inaplicável NUNCA é aproximada (R$
  constantes recusa séries em %; mês sem IPCA fica fora); série que JÁ é
  taxa ganha a/a em **pontos percentuais**, não variação relativa
  ("inadimplência subiu 24%" é a leitura errada); projeções, bandas e
  marcadores de regime são de nível e somem nas demais réguas — declarado
  na tela.
- **Comparar séries**: sobreposição de 2–3 séries do Pulso APENAS em
  base-100 (trajetórias) ou variação a/a (ritmos) — unidades distintas
  jamais dividem um eixo em nível, e o texto do card explica a regra. CSV
  da sobreposição ativa.
- Versão 0.77.0; travas em `src/tests/pulso-transformacoes.test.ts`
  (cobertura do IPCA sobre as janelas de R$, deflator ≈1 no último mês e
  >1,5 em 2012, base-100 exata no primeiro ponto).

## 32. Backtest publicado (P1 do Top 10 — credibilidade dos modelos)

- `forecast.py` passa a registrar as previsões POR ORIGEM do walk-forward
  e a reconstruir o ensemble origem a origem (pesos finais aplicados
  retroativamente — pseudo-backtest, declarado como tal onde aparece).
- **Cobertura da banda fora da calibração**: split temporal — a primeira
  metade dos erros calibra os quantis 10–90, a segunda mede a cobertura.
  Publicada com n e uma leitura em texto; abaixo de 40% a leitura obriga o
  aviso de mudança de regime dos erros ("banda publicada é piso de
  incerteza, não garantia"). Resultado real da primeira publicação:
  inadimplência h=12 com cobertura 0% (o modelo sobre-previa em 2024 e o
  padrão de erro virou), taxa PJ com 84,6% — os dois publicados igualmente.
- **Trajetória previsto × realizado (h=12)**: as últimas 24 origens, com o
  realizado conferido contra a própria série do gold (trava de teste).
- **Seção "Validação dos modelos"** na aba Cenários: tabela por horizonte
  (MAE ensemble × ingênuo, ganho — negativo em cor de alerta, n,
  cobertura), gráfico previsto × realizado e o parágrafo que separa o que
  se valida (projeção-base, elasticidades ±2 EP sem HAC) do que não tem
  backtest possível (o resultado condicional dos sliders). Cards do Pulso
  linkam "backtest completo →".
- Gold publicado atualizado por patch com guarda de identidade (MAE novo ==
  MAE publicado nas 15 séries antes de mesclar os campos novos). Versão
  0.78.0; travas em `src/tests/backtest-publicado.test.ts`.

## 33. Linhagem automatizada (P1 do Top 10 — promessa de linhagem cumprida)

- `pipeline/lineage_map.py`: análise estática do PRÓPRIO repositório a cada
  execução — nunca mantido à mão. Para cada objeto gold: produtor (quem
  chama `write_gold`), fontes (hosts literais do módulo + coletores de
  bronze que ele lê + armazém de séries/estruturado + curadoria),
  dependências gold→gold (`ler_gold_opcional`) e consumo (VIEW_DATA,
  OV_BLOCO_DATA, CORE_FILES, fetches diretos e famílias por item da SPA;
  feeds RSS e kit de imprensa declarados).
- Padrões dinâmicos resolvidos por REGRA, não por mapa manual: templates
  f-string casados contra o inventário publicado (`{nome}_mun.json` →
  penetracao_mun/moradia_mun/consignado_mun; `cmp/{cod}.json` → família
  `cmp/*`), e a republicação integral de `pipeline/curated/` herdada
  arquivo a arquivo. Dependências invertidas viram consumo ("insumo de X"),
  inclusive curadoria lida por outros módulos.
- Resultado: 63 objetos mapeados, ZERO publicados sem produtor — e o teste
  trava isso (`linhagem-mapa.test.ts`: cobertura total do inventário, nada
  órfão, vínculos conhecidos conferidos). `lineage.json` ganha o `mapa` ao
  lado da linhagem recente bronze→gold (SHA-256), e a Metodologia mostra a
  tabela completa com o método declarado.
- Versão 0.79.0.

## 34. PMS e PMC no risco setorial (último P1 do Top 10)

- **"País de serviços sem serviços" resolvido**: o painel setorial cobria só
  a indústria (PIM). Entram a Pesquisa Mensal de Serviços (Sidra t8688,
  v7167, índice de VOLUME 2022=100, c11046=56726) e a Pesquisa Mensal de
  Comércio ampliado (t8883, v7169, volume, c11046=56736) — mesma régua do
  PIM já coletado (volume, 2022=100, sem ajuste sazonal). Coletor genérico
  `_sidra_atividades` em `pipeline/sources/ibge.py`; 29 séries PMS + 14 PMC
  no armazém.
- **Seleção declarada, nunca por nome solto**: totais das pesquisas ficam
  fora (total não é setor); PMS entra pelos 5 grandes grupos (nomes
  numerados) — subdivisões ficam no armazém; PMC exclui os 3 recortes que
  duplicam categorias-mãe (hiper/super; móveis; eletros). Resultado: 43
  setores (27 indústria + 5 serviços + 11 comércio).
- **Score inalterado na forma** (100% observado, 0,69 atividade + 0,31
  condições de crédito), com a fonte de atividade da própria pesquisa;
  códigos PIM preservam o CNAE puro (URLs de ficha já publicadas), PMS/PMC
  usam o key prefixado (`pms_106869`), únicos por construção.
- **SPA**: tabela agrupada por pesquisa (universos distintos nunca numa
  lista única — o z compara cada setor com a própria história); ficha do
  setor rotula a medida pela pesquisa (volume nunca vira "produção");
  método e limitações reescritos.
- Gold publicado antecipado por coleta+rebuild local (PIM recoletado junto).
  Versão 0.80.0; travas em `src/tests/setorial-pms-pmc.test.ts`.

## 35. P2 rodada 1 — pontes, bump de posições nos Juros e Tendências enxuta

- **Pontes entre painéis irmãos** ("o produto tem as pontas; faltam as
  pontes"): helper `ponte()` navega e desce até a âncora, e o texto SEMPRE
  declara a mudança de universo — Panorama↔Penetração (SCR por UF ≠ ESTBAN
  por município, nos dois sentidos), RJ→Exposições e PGFN→Exposições
  (destino ancorado `#sec-exposicoes`, com as cautelas de não-causalidade e
  de universos jamais somados), Fraudes→MED do Pix (`#px-med`, contestação
  ≠ fraude confirmada). Cenários↔Basileia já vivia na própria aba (§30).
- **Juros**: `bump` por modalidade no gold — posição das 10 mais baratas da
  janela atual nas últimas 12 janelas mensais, posições calculadas sobre
  TODAS as IFs da janela, ausência nunca interpolada. Renderizado com o
  `bumpChart` existente; materializa no próximo ciclo diário (o armazém
  local perdeu o txjuros no reset do container — a SPA é graceful).
  Exportação CSV da modalidade ativa (o global existia; o recorte citável
  não).
- **Tendências**: a página se auto-resume — "As 3 anomalias do mês" abrem o
  painel (maior |z| contra a história do PRÓPRIO termo, mês parcial fora,
  régua publicada ao lado) e as seções pesadas (mapa de calor, termo a
  termo, variações, nível×aceleração, sazonalidade, catálogo) ficam sob
  `<details>`; a temperatura por família e as defasagens contra a
  inadimplência seguem abertas.
- Versão 0.81.0; travas em `src/tests/p2-rodada1.test.ts`.

## 36. Kit padronizado: exportação, tooltips e âncoras (P2)

- **Download com helper ÚNICO**: `dlFile` aceita texto ou Blob e adia o
  revoke do object URL (revogar na hora quebrava o download em alguns
  browsers — a versão antiga de `dlFile` tinha exatamente esse bug);
  `download` e `dlXlsx` viraram aliases/delegações.
- **Rótulos de exportação padronizados**: verbo "baixar" + formato +
  qualificador entre parênteses ("baixar CSV (base completa)"); os dez
  rótulos divergentes ("exportar CSV", "exportar planilha", "baixar dados
  (CSV)", "exportar ▾"...) foram convergidos; teste proíbe "exportar
  FORMATO" em botão.
- **Regra de tooltips documentada e com helper**: `dica(texto)` — title
  nativo com ⓘ e cursor de ajuda — para explicação curta de UM conceito;
  `data-tip` (tooltip rico) reservado a gráficos, onde há valores
  estruturados por ponto. Seis ocorrências ad-hoc convertidas.
- **Âncoras nas densas que faltavam**: Panorama ganhou subnav fixa + seções
  ancoradas (Mapa · Comparação · Perfis · Alertas · Explorador ·
  Metodologia) e a Metodologia ganhou subnav sobre cabeçalhos ancorados
  (Catálogo · Dicionário · Model cards · Score cards · Versões · Linhagem ·
  Referências).
- Versão 0.82.0; travas em `src/tests/kit-padronizado.test.ts`.

## 37. Split do bundle por rota (P2 — infra)

- `app.js` segue como fonte canônica ÚNICA no git (testes e patches leem
  dele) e continua funcional servido inteiro: o despacho do roteador virou
  por NOME (`window[RENDER[v]]`) e o carregador (`ensureChunk`) checa a
  presença da função antes de buscar — com o arquivo completo, nada é
  baixado.
- O build (`scripts/minify-obs.mjs`, mesmo comando do CI) extrai as regiões
  marcadas `/* @chunk:NOME:ini|fim */` e minifica separado:
  **core 555 KB** (era 744 KB inteiro, −25% no carregamento inicial) +
  `app-municipal.min.js` 133 KB (Desenrola, Penetração, Moradia,
  Consignado) + `app-emergentes.min.js` 57 KB (Bets, Fraudes, Juros),
  carregados na primeira visita à rota, com fallback de erro visível.
- `penEscala` (escala dos mapas municipais) subiu para o core — três
  painéis a compartilham. Falha de rede no chunk mostra cartão de erro em
  vez de loading eterno.
- Verificação em navegador real (Chromium local): 15 vistas navegadas e 3
  deep-links diretos em rotas de chunk — conteúdo renderizado, chunks
  baixados sob demanda, zero erros de JS.
- Versão 0.83.0; travas em `src/tests/split-bundle.test.ts` (marcadores
  pareados, renderizadores na região certa, core sem os painéis dos chunks
  e ≤ 620 KB, penEscala fora dos chunks).

## 38. Embeds e permalinks por gráfico (P2 — último item do backlog da auditoria)

- **Citação no rodapé metodológico obrigatório**: todo gráfico com
  `chartFooter` ganhou "copiar link" (URL da página com o parâmetro `sec`
  da seção ancorada mais próxima, preservando os filtros atuais) e "embed"
  (iframe pronto apontando para `/obs/embed.html?g=view.secao`). Clipboard
  indisponível cai num prompt de cópia manual.
- **Permalink**: `?sec=` é lido no parse da URL e consumido após o render —
  scroll até a seção com destaque visual temporário. Funciona nos dois
  modos de rota (path da produção e hash local).
- **Página de embed** (`/obs/embed.html`, noindex): a MESMA SPA sem cromo —
  o boot honra `window.__EMBED__`, o recorte esconde tudo que não é
  ancestral/descendente da seção citada e uma barra fixa de atribuição
  ("Observatório Brasileiro de Crédito · ver no site →") acompanha sempre.
  Sem seção, incorpora a vista inteira. Null-guards nos elementos de cromo
  (themeToggle, tabs, sidebar, observer do main) — a página não quebra.
- Verificação em navegador real: embed recortado (`pix.px-med` — só a seção
  visível + atribuição), embed de vista inteira (`juros`, via chunk sob
  demanda) e permalink com scroll+destaque — zero erros de JS.
- Versão 0.84.0; travas em `src/tests/embed-permalink.test.ts`.

## 39. Modelo de migração 15→90: inadimplência >90d ESTIMADA por produto × IF

- **A lacuna**: o IF.data público não cruza o NPL >90d com modalidade. Por
  produto×IF existe o atraso ≥15d (rel. 123/128); o >90d só existe total
  por IF (Res. 4.966) e por produto no agregado do sistema (SCR).
- **O modelo** (`pipeline/models/migracao_npl.py`, chamado por
  `products.py` com os agregados de `scr_uf_produto`):
  `est(i,p) = φ_i × β × m_p × atraso15(i,p)`.
  · `m_p` — perfil relativo de migração do produto (inad arrastada ÷ banda
    15-90 no SCR, normalizado p/ média ponderada 1; mapa explícito
    produto→SCR; sem par = neutro 1,0 sinalizado);
  · `β` — MQO PELA ORIGEM entre as 957 IFs da data-base (>90d total = β ×
    atraso composto): β=1,058 (EP 0,018), R² não centrado 0,794. Sem
    intercepto de propósito: um intercepto de nível dominava os produtos de
    atraso baixo (87% das estimativas iam ao teto — o teto virava a
    estimativa);
  · `φ_i` — >90d observado ÷ ajustado, winsorizado [0,25; 4] (33/957): faz
    a média ponderada das estimativas da IF RECONCILIAR com o >90d total
    observado dela (trava de teste; desvios só onde winsor/teto mordem,
    ambos contados e marcados por linha).
- **Achado conceitual documentado**: o "vencido ≥15d" dos rel. 123/128
  comporta-se como banda curta (consignado BB 0,45% ≈ banda 15-90 SCR
  0,42%) — o >90d NÃO é subconjunto dele, e a estimativa pode excedê-lo
  (migração acumulada, não fração do atraso corrente).
- **No painel**: coluna "Inad. >90d NO PRODUTO (estimada)" na matriz de
  cada produto (ordenável; decomposição completa no ⓘ da linha: atraso ×
  perfil × β × fator da IF, com cobertura do modelo e ⚠ abaixo de 25%);
  cartão de metodologia no fim da página com fórmula, coeficientes,
  hipóteses, conceito do atraso e "o que este número NÃO é"; CSV com o selo
  ESTIMADO em coluna própria. Sanidade: BB consignado 1,15% (sistema INSS
  ~1,9%), Nubank cartão 12,0%, Caixa consignado 3,98%.
- Gold antecipado por seed local (perfis do SCR reconstruídos do
  juros.json publicado — mesmos agregados da tabela); o ciclo diário
  recalcula da fonte. Versão 0.85.0; travas em
  `src/tests/migracao-npl.test.ts`.

## 40. Painel de produtos consertado (taxa POR MODALIDADE) + incidente dos 6 ciclos cegos

- **Bug central (gráficos do produto)**: a "taxa do produto" por IF era a
  MEDIANA entre modalidades da própria IF — rotativo (~490% a.a.) e
  parcelado (~160%) do cartão viravam um número sem significado, usado na
  dispersão atraso×taxa. Correção em `products.py`: `_taxa_por_cod` agora
  publica `taxas_novas` = {modalidade: taxa} (uma ENTRADA por modalidade,
  nunca média entre elas) + `taxa_casamento` (cnpj8/nome). O campo escalar
  `taxa_aa` da matriz foi aposentado e tem trava contra retorno.
- **SPA (v0.86.0)**: dispersão e a NOVA coluna "Taxa a.a. — {modalidade}"
  da matriz seguem o MESMO seletor de modalidade da seção de taxas
  (`TX_STATE.idx`, duplicado acima da dispersão); cor = segmento
  prudencial com legenda; `scatterPlot` ganhou escala numérica (ticks nos
  extremos REAIS dos dados) e 6% de folga de domínio (bolhas não cortam);
  último rótulo do eixo x do `lineChart` ancora para dentro ("03/2026"
  não corta mais); CSV/XLSX com uma coluna de taxa POR modalidade.
  Valores verbatim da fonte: txjuros publica 0% (promocional) e rotativos
  >1.300% a.a. — travas de plausibilidade em [0; 3000).
- **Incidente descoberto no caminho**: push de bot (GITHUB_TOKEN do ciclo
  diário) NÃO dispara o CI — 6 ciclos (13→19/08) quebraram 8 testes gated
  sem sinal vermelho. Causas e correções:
  · `regimes.json` era escrito por DOIS produtores (detecção estatística
    CUSUM em `gold.py` e resolução do BCB em `regimes_gold.py`) — o
    estatístico clobberava o painel de resolução. Separado:
    `regimes_series.json` (estatístico; pulse/research/leading/inad) ×
    `regimes.json` (resolução; institutions/inst). Gold restaurado.
  · A cópia verbatim de `pipeline/curated/*.json` para o gold clobberava
    o `guidance.json` CONSTRUÍDO com gate de aprovação — expunha a
    curadoria crua (risco de vazar em_revisao). Denylist
    `CURADO_COM_BUILDER` + gold reconstruído (7 ciclos aprovados).
  · `lineage.json` era escrito ANTES dos writers municipais: em ambiente
    limpo o mapa não resolvia `{nome}_mun.json` (famílias sem produtor).
    Movido para o FIM do build; mapa republicado completo (64 objetos).
  · Coletor de regimes registrava linhagem com sha "-": agora usa o
    SHA-256 real do bronze; entradas legadas "-" filtradas do publicado.
  · Travas de HHI refeitas com tolerância fundamentada no arredondamento
    de 1 casa dos publicados (±10 pontos); gate do histórico morde no
    comprimento só quando o backfill converge (25/40 trimestres em 19/08).
  · **Guarda nova**: `ci.yml` ganhou `schedule` diário (11:45 UTC) — roda
    a suíte sobre o main ~1h após a publicação dos dados.
- Suíte: 824 testes / 65 arquivos verdes; travas novas em
  `products-data.test.ts` (per-modalidade nunca mediana; escalar não
  volta; rotativo ≫ parcelado no cartão; ticks e folga na dispersão).

## 41. Avaliação completa dos painéis (05/09/2026) e as correções da rodada

- **Documento:** `docs/AVALIACAO_PAINEIS_2026-09.md` — técnica, layout e
  didática das 34 rotas, medidas em navegador a 1440 px e 390 px; menu por
  pergunta do leitor; dez painéis novos priorizados por valor sobre esforço
  (crédito rural pelo Sicor, BNDES, crédito ampliado com ofertas CVM e
  CRI/CRA, PTC e Focus, entrantes do SFN, conduta, Caged, páginas por UF,
  funding, consórcios); mapa dos 54 conjuntos abertos da CVM (6 usados).
- **Correções aplicadas (v0.87.0):** RJ sem ficção na rota pública; LinkedIn
  pelo `<head>`; vigília `pane` (fonte parada com gold íntegro) e faixa na
  aba; alertas operacionais com nível pela regra e FRE ausente consolidado
  (crachá 21 → 9); "O que mudou" com vaga por família; guia em toda aba e
  rota dinâmica; um nome por aba e menu em seis grupos; ações recolhidas e
  método depois do número; modo capítulo nos dossiês; piso tipográfico nos
  SVG e escala log no Mercado; `fontes_reais` derivada do status da coleta;
  `/metodologia` e `/fontes` redirecionam para a metodologia viva; toast no
  lugar de `alert()` e `href` real nas âncoras de navegação.
- **Correção de leitura:** a varredura móvel da primeira versão contou
  elementos além da viewport, mas quase todos rolam dentro de `.tblwrap`;
  o corte real é residual (histograma do produto, `.seg` sem quebra, 8 px
  em dois cartões) e ficou como P2.
- **Travas:** `src/tests/avaliacao-set26.test.ts`; `central-alertas.test.ts`
  e `guia-navegacao.test.ts` estendidos; `observatorio-publico` com o nome
  novo de Fraudes.

## 42. Crédito rural — Matriz de Dados do Crédito Rural (MDCR/Sicor)

- **Fonte:** BCB, dados abertos (ODbL), API OData
  `https://olinda.bcb.gov.br/olinda/servico/SICOR/versao/v2/odata/`, catálogo em
  dadosabertos.bcb.gov.br (`matrizdadoscreditorural`). Contratações registradas
  no Sicor, agregadas pelo próprio BCB por mês de emissão e dimensão. Mensal
  desde 2013. Nível A (registro administrativo obrigatório das cédulas).
- **Medido em 05/09/2026:** `$filter` por ano e mês de emissão, `$select` e
  `$orderby` funcionam; `$apply` (agregação no servidor) e `$count` não (403).
  Sem paginação. Um mês: RegiaoUF 1,5 mil linhas em 2 s; SegmentoIF 3,6 mil em
  29 s; municipal (CusteioInvestimentoComercialIndustrialSemFiltros) 35 mil
  linhas, 11 MB, 37 s; produtos por UF 10 mil linhas em 22 s. A soma do recurso
  Faixa (universo completo) bate com a soma do municipal no mesmo mês
  (R$ 30,98 bi × R$ 30,97 bi em 2026-06).
- **Coletor** `pipeline/sources/sicor.py` → silver `sicor_uf` (RegiaoUF, toda
  a história, uma requisição por ano), `sicor_fonte`, `sicor_faixa`,
  `sicor_genero` (toda a história), `sicor_if` (13 meses), `sicor_mun` (12
  meses), `sicor_produto` (12 meses), `sicor_nomes` (programa e subprograma).
  Mês corrente e anterior são PARCIAIS (cédulas entram com atraso) e são
  recoletados a cada execução; meses mais antigos são fechados e imutáveis.
  Cap de 40 requisições pesadas por execução: a primeira carga converge em
  poucos dias; falha consome o cap.
- **Builder** `pipeline/rural.py` → `rural.json` + `rural_mun.json` (array
  municipal separado pelo mesmo mecanismo dos demais golds municipais).
  Janela de 12 meses fechada no último mês completo; safra = julho a junho;
  famílias de fonte por padrão explícito no nome (poupança rural, LCA,
  exigibilidades MCR 6.2, fundos constitucionais, BNDES/Finame, recursos
  livres, Funcafé, Tesouro); população do Censo 2022 via gold da penetração.
  Tudo é FLUXO (contratação); o saldo rural do sistema segue no IF.data e no
  SGS, e a aba diz isso na ponte para Produtos.
- **Dicionário de códigos:** Atividade 1 = agrícola, 2 = pecuária; cdSexo
  1 = feminino, 2 = masculino (confirmado em 05/09/2026 pelo subprograma 57 do
  PRONAF, "MULHER (MCR 10-9)": em 2026-03, 100% dos 1.674 contratos desse
  subprograma no recurso RegiaoUFGenero têm cdSexo = 1; no mesmo mês o código 1
  responde por 71.114 dos 198.641 contratos com sexo informado); segmentos de IF pelos códigos do
  recurso SegmentoIF (108 banco múltiplo, 109 cooperativa de crédito, 111
  banco cooperativo, 110 agência de fomento, 115 SCFI).
- **Aba** `/observatorio/rural-credit` (view `rural`, chunk municipal, grupo
  "Produtos e preços"): síntese e placar, evolução mensal por finalidade ou
  atividade, safras, programas (PRONAF, PRONAMP, sem programa, demais),
  fontes por família com taxa controlada e equalizada, faixas de valor
  (concentração), gênero e instituições, mapa municipal com ranking por
  habitante (piso de 5 mil habitantes), UFs, produtos de custeio e
  investimento, método e cautelas. CSV municipal com procedência.
- **Cautelas publicadas:** contratação ≠ saldo ≠ inadimplência; meses
  parciais fora de toda razão; programa/fonte/finalidade são os declarados na
  cédula; IF é o CNPJ contratante, sem consolidação; por habitante e por
  hectare são intensidades, não acesso.
- **Universo, medido na carga de 05/09/2026:** os recursos FonteRecursos
  (nacional), SegmentoIF e o municipal fecham com o recurso Faixa ao centavo
  em todos os meses; RegiaoUF fica 2% a 8% ABAIXO em todos os meses (o BCB não
  documenta a diferença; provavelmente cédulas sem UF atribuída). Por isso a
  série nacional vem de FonteRecursos, o recorte estadual é o municipal
  agregado pelo prefixo do código IBGE, e RegiaoUF entra só como nota de
  cobertura publicada no gold (`universo.cobertura_regiao_uf_pct`). Produto
  cobre custeio e investimento (72% a 84% do valor), como a fonte define.
- **Estado da primeira carga (05/09/2026, noite):** a API alternou respostas
  em segundos com horas de HTTP 504 (Azure Application Gateway), inclusive em
  repouso. A janela publicada (2025-08 a 2026-07) ficou completa nos cinco
  recursos: R$ 344,4 bi em 2.538.458 contratos, 5.487 municípios com
  contratação, reconciliação municipal × nacional de 100,0%. A cauda histórica
  (FonteRecursos e Faixa desde 2013, gênero desde 2013) converge nas execuções
  diárias, meses recentes primeiro; enquanto isso a variação sobre os 12 meses
  anteriores fica nula e a série mensal começa em 2025-07. A verificação do
  código de sexo pelo subprograma PRONAF Mulher (cdSubPrograma 57), que recebeu
  504 em três tentativas em 05/09, foi concluída no mesmo dia (ver dicionário de
  códigos acima). A API não aceita `$filter` por cdSubPrograma nem `$top`
  (400: tipos String e Int16 incompatíveis); a checagem foi feita baixando o mês
  inteiro do recurso e agregando localmente.
- **Travas:** `src/tests/rural-data.test.ts` (janela sem meses parciais,
  composições que fecham, reconciliação municipal × estadual dentro de 3%,
  ausência como nulo, piso do ranking por habitante, registro completo na SPA).

## 43. Crédito ampliado e mercado de capitais (05/09/2026)

- **Pergunta:** quanto do crédito a empresas e famílias vem dos bancos e quanto vem do
  mercado; quanto se capta em ofertas públicas; como paga o lastro de CRI e CRA.
  Painel nº 3 da avaliação de 05/09 (§6), P1 no backlog; resolve E13 (subíndice não
  bancário com um componente).
- **Fontes (três réguas, nunca somadas entre si):**
  1. BCB/SGS, família "crédito ampliado ao setor não financeiro" (26 séries, códigos
     28183 a 28217 e 28846 a 28868, mensal desde 2013-01, R$ milhões e % do PIB).
     Chaves `amp_*` em `config/config.json`, coletadas pelo `bcb_sgs` existente.
  2. CVM, ofertas públicas de distribuição: `oferta_distribuicao.zip` (5,6 MB) com dois
     CSV sem sobreposição: regime anterior (ICVM 400, 476 e 555, 2008 a 2022, mais os
     ritos ordinários da Res. 160) e rito automático da Res. 160 (2023 em diante).
     Coletor `pipeline/sources/cvm_ofertas.py`, uma linha por oferta em `cvm_ofertas`.
  3. CVM, informes mensais de securitizadoras (Res. 60): um zip por ano e por tipo
     (CRI e CRA), desde 2019. Coletor `pipeline/sources/cvm_securit.py`: última versão
     por certificado e mês em `securit_cert`; segmentos do lastro em `securit_seg`;
     situação das séries em `securit_classe`. Ano corrente e anterior rebaixados a cada
     execução; anos fechados uma vez.
- **Builder:** `pipeline/ampliado.py` → `ampliado.json` (300 KB). Blocos `saldo`
  (composição por credor e segmento, desintermediação das empresas dezembro a dezembro),
  `emissoes` (12 meses fechados por família, anual, Res. 160 por público e regime de
  distribuição, top emissores e coordenadores com HHI), `securitizacao` (CRI e CRA:
  série de vencidos e atraso sobre créditos vinculados, segmentos, situação das séries),
  `fidc` (já coletado). Aba `/observatorio/broad-credit`, chunk `emergentes`.
- **Achados na primeira carga (05/09/2026):**
  - Registros de fundos abertos (ICVM 555) trazem valores cadastrais absurdos (R$ 100
    trilhões numa linha); ficam fora de todo total. Sem essa exclusão o regime anterior
    somaria R$ 221 trilhões.
  - Na Res. 160, ofertas em andamento ("Registro Concedido") carregam o teto registrado
    (um FIAGRO com R$ 250 bilhões em 2026-08); só ofertas encerradas entram nos totais.
    Debêntures encerradas: R$ 231 bi em 2023, R$ 481 bi em 2024, R$ 457 bi em 2025,
    compatíveis com o consolidado da ANBIMA.
  - CRI: o campo de créditos vinculados só vem preenchido a partir de 2022-07; a série
    começa ali. CRA informa desde 2019-09.
  - Erro de unidade nos informes: em 2026-06 uma securitizadora enviou créditos mil
    vezes maiores (R$ 87,6 bi num certificado que tinha R$ 88 mi em maio). Regra: salto
    acima de 50 vezes entre meses consecutivos, vencido maior que o crédito, ou todo o
    crédito marcado vencido num único mês (zero antes e depois) exclui o certificado do
    mês, com contagem publicada.
  - Entrega parcial: o último mês dos informes chega com 70% dos certificados (CRI
    2026-07: 1.686 de 2.332) e o do FIDC com 15% dos fundos (2026-08: 625 de 4.188).
    Mês com menos de 90% do mês anterior é parcial e fica fora de KPI e de z-score. O
    mês parcial do FIDC era o que puxava o subíndice não bancário a +3,33σ (E13).
- **Sinais Antecedentes:** a família não bancária passa de um para quatro componentes
  (`fidc_inad_pct`, `cri_venc_pct`, `cra_venc_pct`, `emissoes_divida_yoy`, este com sinal
  invertido: queda de emissões é aperto). Um mês só entra no subíndice com pelo menos
  metade dos componentes presentes. `leading.json` é regenerado pela execução diária;
  não foi republicado à mão porque a silver local não tem todas as fontes do painel.
- **Vintages e vigília:** `cvm_ofertas` (último mês com oferta encerrada, prazo 45 dias)
  e `securit` (último mês com informe, prazo 90 dias) em `meta.vintages`.
- **Travas:** `src/tests/ampliado-data.test.ts` (composição do saldo fecha, janela de 12
  meses fechados, anual = soma do mensal, razões entre 0 e 100, parciais fora dos KPIs,
  família não bancária com quatro componentes, aba registrada em todos os mapas).
- **Pendências:** colocação efetiva das ofertas da Res. 160 não é publicada oferta a
  oferta (o painel usa o valor registrado e diz isso); consórcio de distribuição não é
  aberto (só o líder entra no HHI); CDA de fundos (quem detém CDB e LF de quais bancos)
  segue no backlog como painel de funding.

## 44. Crédito direcionado e BNDES (05/09/2026)

- **Pergunta:** quanto do crédito do SFN tem taxa regulada ou funding público; o que o
  Sistema BNDES desembolsa, para quem, para quê, onde e por quais agentes; o que o
  banco contrata operação a operação. Painel nº 2 da avaliação de 05/09 (§6), P2 no
  backlog.
- **Fontes (três réguas, nunca somadas entre si):**
  1. BCB/SGS, estatísticas de crédito com recursos direcionados: 19 séries (`dir_*` em
     `config/config.json`): saldo, concessões, taxa, inadimplência e prazo, total, PJ,
     PF e "com recursos do BNDES" (códigos 20593 a 20616, 20685 a 20708, 20756 a
     20768, 20896, 20906, 21132 a 21155). Coletadas pelo `bcb_sgs` existente.
  2. BNDES dados abertos (dadosabertos.bndes.gov.br, ODbL), coletor
     `pipeline/sources/bndes.py`: estatísticas mensais desde 1995 em R$ milhões
     (desembolsos por porte, porte PF e PJ, UF, setor BNDES, setor CNAE, subsetor CNAE
     agrupado, forma de apoio e produto; MPME por UF; aprovações por porte e UF;
     consultas por porte; FINAME mensal), desembolsos anuais por agente credenciado e
     quantidade anual de operações por porte, fontes de recursos e instituições
     credenciadas. Silver em formato longo (`bndes_mensal`, `bndes_anual`).
  3. BNDES, operações não automáticas (diretas e indiretas não automáticas), contrato a
     contrato desde 2002 (23.815 linhas, 20 MB): `bndes_op`. As indiretas automáticas
     (arquivo de 1,2 GB) ficam fora da Fase 0.
  Os recursos são localizados pelo nome no catálogo CKAN a cada execução; hash por
  arquivo evita regravar.
- **Builder:** `pipeline/bndes.py` → `bndes.json` (160 KB): `saldo` (série de
  participação do direcionado, BNDES no crédito PJ, taxa e inadimplência PJ por origem),
  `desembolsos` (série mensal com soma de 12 meses, anual, porte, funil consultas →
  aprovações → desembolsos, setor e subsetor, produto com cobertura declarada, UF e
  região por habitante, FINAME, agentes com HHI, quantidade de operações), `operacoes`
  (12 meses: top clientes, recortes por produto, natureza, subsetor, custo, garantia e
  porte, custo financeiro ano a ano, municípios), `funding` (passivo do BNDES por fonte).
  Aba `/observatorio/directed-credit-bndes`, chunk `emergentes`, grupo Produtos e preços.
- **Achados na primeira carga (05/09/2026):**
  - As estatísticas mensais do BNDES terminam em 2026-03 (publicadas com cerca de cinco
    meses de defasagem); o FINAME vai a 2026-06 e as operações não automáticas a
    2026-07. A aba mostra cada data-base e nunca alinha uma régua pela outra.
  - As tabelas por forma de apoio e produto somam 47% do desembolso da janela: as
    indiretas automáticas (Finame, BNDES Automático, cartão) não estão nelas. A aba
    declara a cobertura em vez de escalar.
  - Por UF e por porte fecham com o total ao centavo; MPME por UF fecha com micro +
    pequena + média da tabela por porte.
  - Nas operações não automáticas, "SEM MUNICÍPIO" tem código 9999999 e "IE" marca
    operações multi-UF ou de exportação; 66% do valor contratado em 12 meses não tem
    município único, e por isso não há mapa municipal neste painel.
  - Linhas idênticas no CSV de operações são subcréditos distintos do mesmo contrato;
    a chave da silver é a posição no arquivo, não os campos.
  - A API do SGS devolveu HTTP 502 durante toda a tarde de 05/09; as 19 séries
    `dir_*` estão registradas e o bloco `saldo` abre sozinho na primeira execução que
    as coletar. O gold publicado nesta data traz `saldo.disponivel = false` e a aba
    mostra a seção como "ainda não coletada".
- **Vintage e vigília:** `bndes` (último mês das estatísticas de desembolso) em
  `meta.vintages`, prazo de 200 dias pela defasagem de publicação do banco.
- **Travas:** `src/tests/bndes-data.test.ts` (janela fechada no último mês publicado,
  anual = soma do mensal, portes e UFs fecham com o total, cobertura por produto
  declarada e menor que 100%, operações sem "SEM MUNICÍPIO" no ranking, aba registrada
  em todos os mapas; o bloco de saldo é testado quando existe).
- **Pendências:** operações indiretas automáticas (1,2 GB) por agregação prévia fora do
  pipeline diário; desembolsos mensais detalhados (750 MB) idem; deflator para leitura
  de longo prazo (a série nominal desde 1995 mede inflação).

## 45. Páginas por UF (05/09/2026)

- **Pergunta:** "como está o crédito no meu estado?" Painel nº 8 da avaliação de 05/09
  (§6), P2 no backlog: SEO programático como o das páginas municipais, sem coleta nova.
- **Fonte:** nenhuma nova. `pipeline/ufs.py` roda no fim do `gold.build_all` e lê os
  golds já escritos: Panorama (SCR.data por UF), Penetração municipal (somada por UF:
  crédito, renda anual, adultos, municípios abaixo do modelo), Presença bancária
  (`por_uf`), Pix (`geografia.ufs`), Moradia (`estados`), Consignado (`estados`),
  Crédito rural (`ufs`), BNDES (`desembolsos.ufs`), Dívida ativa (`mapa`) e o Explorer
  (`fatos.uf_produto`, PF e PJ somados por produto). Gold `ufs.json` (145 KB), 27 UFs.
- **Rotas:** índice `/observatorio/states` (aba "Estados" no grupo Território) e uma
  página por UF em `/observatorio/states/{SIGLA}` (view dinâmica `estado`, prefixo em
  `PREFIXOS_DINAMICOS`). O route handler resolve título e description a partir da
  síntese do gold; sigla fora do gold, ou em minúsculas, é 404 com noindex. O sitemap
  lista as 27 rotas. O painel de UF do Panorama aponta a página do estado.
- **Regras:** cada bloco leva a própria data-base e a própria fonte; posições (1º a 27º)
  são calculadas dentro de cada régua e nunca cruzam blocos; bloco ausente é painel de
  origem sem recorte estadual, nunca zero; per capita usa a população do Censo 2022 já
  embutida nos golds de origem.
- **Travas:** `src/tests/estados-data.test.ts` (27 UFs, carteira do SCR fecha com o total
  nacional, participações somam 100, posições são permutações de 1..27, municípios
  somam 5.570 e a penetração nacional reconcilia, head e sitemap, aba registrada).
- **Pendências:** série histórica por UF (hoje só a posição corrente e as variações
  já publicadas pelos golds de origem); mapa de calor no índice.

## 46. Expectativas de mercado (Focus) nos Cenários (05/09/2026)

- **Pergunta:** o que o consenso do mercado espera para juros, atividade, desemprego e
  câmbio, e o que isso faz com a inadimplência projetada. Metade estruturada do painel
  nº 4 da avaliação de 05/09 (§6). A outra metade, a Pesquisa Trimestral de Condições de
  Crédito (PTC), é publicada só em PDF e fica fora da Fase 0 por regra editorial; entra
  quando houver dado estruturado.
- **Fonte:** BCB, Expectativas de mercado (Focus), API Olinda (`ExpectativasMercadoAnuais`
  e `ExpectativasMercadoSelic`), base 0 (todos os respondentes dos últimos 30 dias).
  Coletor `pipeline/sources/focus.py`: Selic, IPCA, PIB Total, Câmbio e Taxa de
  desocupação, divulgações dos últimos 400 dias (histórico das revisões), mais a Selic por
  reunião do Copom. Silver `focus_anual` e `focus_selic`; idempotente por hash.
  Séries observadas para a conta dos presets, novas em `config.json`: desocupação PNAD
  (SGS 24369) e PTAX de venda média mensal (SGS 3698); Selic meta (432) e IBC-Br (24363)
  já existiam.
- **Builder:** `pipeline/expectativas.py`, chamado por `gold.py` antes de gravar
  `scenario.json`: bloco `expectativas` (tabela indicador × ano com mediana, média, dp,
  mínimo, máximo e respondentes; histórico semanal para o ano corrente e o seguinte;
  Selic por reunião; observado hoje) e presets `focus_{ano}` para o ano corrente e o
  seguinte, calculados como mediana para o fim do ano menos o observado (Selic meta,
  PNAD, IBC-Br em 12 meses como proxy do PIB, PTAX), arredondados ao passo de cada
  controle e limitados à sua faixa. Os presets entram no dicionário da aba ao lado de
  base, otimista, adverso e severamente adverso.
- **Aba:** Cenários ganha o cartão "Expectativas de mercado (Focus)" abaixo dos
  controles, com a tabela, a derivação de cada preset (bruto e arredondado), a Selic por
  reunião e as revisões do consenso. Vintage `focus` e prazo de vigília de 14 dias.
- **Achado da primeira carga (05/09/2026, divulgação de 2026-08-28):** Selic esperada
  de 13,75% para o fim de 2026 e 12,00% para 2027 contra meta de 14,00%; desocupação
  5,4% e 5,9% contra 5,3% observado; PIB 1,9% e 1,5% contra IBC-Br de 12 meses; câmbio
  R$ 5,20 e R$ 5,30 contra PTAX de R$ 5,15. O preset `focus_2027` é, portanto, um
  cenário de afrouxamento monetário com desemprego em alta, o oposto dos presets
  arbitrários da aba.
- **Travas:** `src/tests/focus-cenarios.test.ts` (última divulgação, três anos, cinco
  indicadores, presets no passo e na faixa reconciliando com a derivação, Selic por
  reunião ordenada, cautelas com consenso ≠ previsão e PTC em PDF, coletor registrado).
- **Pendências:** PTC quando houver dado estruturado; Top-5 do Focus (respondentes mais
  precisos) como segunda leitura.

## 47. Entrantes e saídas do SFN (05/09/2026)

- **Pergunta:** quem está autorizado a funcionar hoje, quem entrou e quem saiu, quem
  mudou de tipo, quem foi para regime de resolução. Painel nº 5 da avaliação de 05/09
  (§6), P3 no backlog.
- **Fontes (três réguas, nunca somadas):**
  1. BCB/Unicad, API Olinda `Instituicoes_em_funcionamento`: quatro relações (bancos,
     cooperativas, sociedades, consórcios), 1.743 sedes em 05/09/2026. Só posição atual,
     sem data de início. Coletor `pipeline/sources/sfn_cadastro.py`: espelho
     (`sfn_sedes`), histórico próprio por CNPJ com primeiro e último visto e mudança de
     segmento (`sfn_hist`) e contagem por coleta (`sfn_contagem`). Uma relação fora do ar
     descarta a coleta inteira, para que a falha não vire onda de saídas.
  2. BCB/IF.data, já coletado pelo pipeline (cadastro e resumo trimestral desde 2015-03,
     tipo de instituição 2): presença de cada código no relatório resumo por trimestre.
     Entrada = primeiro trimestre reportado; saída = deixou de reportar; conversão =
     mesmo nome sai com um tipo de consolidado e entra com outro.
  3. Regimes de resolução: gold `regimes.json` já publicado.
- **Builder:** `pipeline/sfn.py` → `sfn.json`: cadastro por grupo (Bancos, Cooperativas,
  Instituições de pagamento, Fintechs de crédito, Financeiras e crédito especializado,
  Mercado de capitais e câmbio, Fomento e desenvolvimento, Consórcios), segmento, UF e
  região; cooperativas por sistema (Sicoob, Sicredi, Cresol, Unicred, Ailos, CrediSIS,
  Uniprime, pela central de filiação ou pelo nome), critério de associação e categoria;
  IF.data com série trimestral de reportantes por tipo de consolidado (b1 a n4), entradas
  e saídas por trimestre, listas nominais dos últimos oito trimestres com ativo total,
  conversões; regimes vigentes e decretados em 12 meses. Aba
  `/observatorio/sfn-entries-exits` no grupo Instituições, chunk `emergentes`.
- **Achados na primeira carga (05/09/2026):** o cadastro tem 166 bancos (154 na relação de
  bancos, mais 12 de investimento; os 3 de desenvolvimento e o BNDES ficam em fomento), 752 cooperativas, 194
  instituições de pagamento, 148 fintechs de crédito (136 SCD e 12 SEP); São Paulo sedia
  421 das 707 sociedades. No IF.data, 1.430 reportantes em 2025-12, com 92 entradas e 77
  saídas nos quatro trimestres fechados; 2026-03 ainda provisório. Os SGS 24881 a 25581 (quantidade de sedes por segmento e
  região) são anuais e param em 2022: registrados como fronteira, não usados.
- **Regras:** o trimestre mais recente do IF.data recebe retardatários por semanas; as
  saídas nele são provisórias e ficam marcadas; KPIs usam os quatro trimestres fechados.
  Saída não é quebra: fusão, incorporação e troca de código também tiram um nome da
  lista, e a leitura é nominal.
- **Travas:** `src/tests/sfn-data.test.ts` (grupos, UFs e regiões somam o total; série
  trimestral fecha em n = n anterior + entradas − saídas; provisório marcado; listas só
  dos últimos oito trimestres; regimes coerentes com regimes.json; aba registrada).
- **Pendências:** distinguir motivo da saída (fusão, incorporação, cancelamento) pelo
  ato do BCB (Sisbacen, texto) fica fora da Fase 0; a série do cadastro com nomes
  cresce daqui em diante.

## 48. Conduta e enforcement (05/09/2026)

- **Pergunta:** como o supervisor pune, em quanto tempo, com que penalidade e se a multa
  é paga. Painel nº 6 da avaliação de 05/09 (§6), P3 no backlog, com a regra editorial
  já fixada lá: nunca ranking por instituição.
- **Fontes (três réguas, nunca somadas):**
  1. BCB/Gepad, API Olinda: `Gepad_QuadroPenalidades` (penalidades aplicadas em PAS,
     uma linha por apenado e decisão, 1ª e 2ª instâncias, multa, recurso, situação da
     cobrança; 16.939 linhas, decisões desde 2013-01) e `Gepad_QuadrosGeraisInternet`
     (inabilitados e proibidos de atuar vigentes). Coletor
     `pipeline/sources/bcb_pas.py`: acervo inteiro substituído a cada coleta, chave
     posicional (a mesma pessoa pode ter mais de uma penalidade na mesma decisão),
     hash evita regravar.
  2. CVM, dados abertos `processo_sancionador.zip` (processo: objeto, abertura, área
     instrutora, fase, subfase, local, última movimentação; acusados: nome e situação).
     Coletor `pipeline/sources/cvm_pas.py`. A base traz a fase, não o resultado.
  3. Ranking de reclamações do BCB, já coletado (`reclamacoes`): mediana e p90 do índice
     entre as instituições, sem nome.
- **Builder:** `pipeline/conduta.py` → `conduta.json` (41 KB): BCB ano a ano (processos,
  decisões, multas e valor, inabilitações, sem penalidade, recursos, PJ e PF), janela de
  12 meses com penalidades, situação e mediana e p90 das multas, cobrança das multas no
  acervo, tempo entre citação e decisão (mediana e p90 nas decisões dos últimos 36
  meses), inabilitados por prazo; CVM ano a ano, fases, áreas, duração dos finalizados,
  idade dos em curso, acusados por processo; listas nominais só cronológicas. Aba
  `/observatorio/conduct-enforcement` no grupo Riscos e temas, chunk `emergentes`.
- **Achados na primeira carga (05/09/2026):** nos 12 meses até 2026-09-03 o BCB decidiu
  1.295 processos (1.408 decisões por apenado), 94% com multa somando R$ 75,8 milhões,
  mediana de R$ 25 mil e p90 também de R$ 25 mil (a maior parte é a multa padrão de descumprimento de prazo de
  remessa de informação); 89% das multas do acervo estão pagas, 5,5% transferidas para
  cobrança, 1,3% vencidas e não pagas. Tempo mediano entre citação e decisão de 1ª
  instância: 2,8 meses, p90 de 29 meses. CVM: 68 processos abertos em 12 meses, 251 em
  curso com idade mediana de 23 meses (94 acima de 36), finalizados em 30 meses de
  mediana.
- **Regra editorial aplicada:** nenhuma lista ordenada por instituição, multa ou volume;
  as listas nominais (decisões e processos recentes) são cronológicas; a página diz que
  volume não é irregularidade e que multa aplicada não é multa paga.
- **Travas:** `src/tests/conduta-data.test.ts` (janela coerente, penalidades somam as
  decisões, cobrança soma 100, ano corrente parcial, listas cronológicas, fases da CVM
  somam os processos, cautela da regra editorial, SPA sem ordenação por nome ou valor,
  aba registrada).
- **Pendências:** resultado dos julgamentos da CVM (absolvição, multa, termo de
  compromisso) só em texto, fora da Fase 0; a série de reclamações depende da silver de
  produção (vazia neste ambiente).

## 49. Emprego formal setorial, Novo Caged (05/09/2026)

- **Pergunta:** o emprego formal sustenta o crédito de qual setor. Painel nº 7 da avaliação
  de 05/09 (§6), P3 no backlog: fecha o componente "capacidade financeira" do Risco
  setorial, até aqui demonstrativo com peso zero.
- **Fonte primária inacessível deste ambiente:** o portal do MTE (`pdet.mte.gov.br`) e o
  FTP de microdados (`ftp.mtps.gov.br`) encerram a conexão TLS antes do handshake
  (medido em 05/09/2026, com e sem o CA do proxy); `dados.gov.br` exige token (HTTP 401).
  As republicações oficiais cobrem o que o painel precisa:
  1. **BCB/SGS 28763 a 28804**: estoque de empregos formais do Novo Caged, total e 20
     recortes por seção CNAE 2.0 (A, B, C, SIUP = D + E, D, E, F, G, Serviços = H a S, H,
     I, J, K, L, M, N, O, P, Q e "Outras atividades de serviços"), sem ajuste (28763 a
     28783) e com ajuste sazonal do BCB (28784 a 28804), mensais desde 1992 (o BCB
     encadeia o Caged antigo; a série não mostra degrau em 2020-01). Nomes confirmados
     pelo serviço SOAP `FachadaWSSGS.getUltimoValorXML` em 05/09/2026 (o catálogo do
     `sgspub` estava indisponível). Entram em `config/config.json` como `emp_*` e
     `emp_sa_*`, categoria `emprego`, pelo coletor `bcb_sgs` já existente (42 séries).
  2. **Ipeadata, séries ADMISNC e DESLIGNC** (MTE/Novo Caged sem ajuste): admissões e
     desligamentos por território, mensais desde 2020-01. O recurso OData não aceita
     `$filter` e devolve todos os níveis (5.570 municípios, 63 MB por série); o coletor
     `pipeline/sources/ipea_caged.py` baixa a série, guarda só Brasil e 27 UFs na silver
     `caged_uf` e pula a coleta se rodou nos últimos 3 dias. As seções R, T e U não são
     itemizadas pelo BCB e ficam dentro de Serviços (2,4% do total em 2026-07).
- **Conferência entre as fontes:** admissões − desligamentos do Ipeadata para o Brasil
  fecha ao vínculo com a variação do estoque do SGS em 2026-07 (+58.568 nas duas); a
  diferença é publicada em `reconciliacao`. Brasil − soma das UFs = 803 admissões e 566
  desligamentos sem UF identificada no mês, publicados em `ufs_nao_identificado`, nunca
  rateados. Total − grandes grupos = −7 vínculos (`nao_classificado`).
- **Builder:** `pipeline/emprego.py` → `emprego.json` (160 KB): Brasil (estoque, saldo do
  mês com e sem ajuste, saldo em 12 meses, variação a/a, admissões, desligamentos,
  rotatividade), série de 72 meses, 21 recortes por seção com z-score da variação a/a
  contra a própria história desde 2013-01 (mínimo 24 observações; uma janela desde 2022
  rotularia como contração qualquer crescimento abaixo do rebote pós-pandemia), 27 UFs
  com saldo, retenção (saldo ÷ admissões em 12 meses) e posições. Roda ANTES do score
  setorial em `gold.py`, que o consome.
- **Score setorial (`pipeline/indicators.py`):** "capacidade financeira" passa a observado:
  cada atividade herda o z da variação a/a do estoque de vínculos da(s) seção(ões) CNAE
  listada(s) em `SECOES_EMPREGO` (PIM: divisões herdam C, extrativa B, indústria geral a
  média de B e C; PMS: famílias I + S, informação J, profissionais M + N, transportes H,
  outros serviços E + K + L + S; PMC: G), sinal invertido. Pesos originais 0,45 / 0,20 /
  0,15 renormalizados sobre os observados: 0,5625 / 0,25 / 0,1875. Sem o gold de
  emprego, o score volta a 0,69 / 0,31 e o componente a demonstrativo com peso zero.
  Efeito medido em 05/09/2026 contra o gold publicado: variação média de 2,0 pontos
  no score (máxima 5,7); faixas passam de 23 elevado / 20 atenção para 21 / 22.
- **Aba:** `/observatorio/formal-employment` ("Emprego formal", grupo Riscos e temas,
  chunk `emergentes`), cinco seções (Brasil, seções, UFs, score, método), CSV por seção;
  bloco "Emprego formal" nas 27 páginas por UF (`ufs.py`, posições por saldo em 12 meses
  e retenção). Vintage `caged` em `meta.json`; prazo de vigília 45 dias.
- **Achados na primeira carga (dados até 2026-07, preliminar):** 48.082.866 vínculos,
  +880.717 em 12 meses (+1,87% a/a; +1.537.837 nos 12 meses anteriores), +58.568 no
  mês (+29.068 com ajuste sazonal); rotatividade de 53% do estoque em 12 meses. Contra a
  própria história, a folha mais fraca está na agropecuária (z −0,84, −0,8% a/a) e a
  mais forte em eletricidade e gás (z +2,1, +5,1% a/a); indústria de transformação em
  +0,2% a/a (z −0,03) e comércio em +1,1% (z −0,33). São Paulo lidera o saldo em 12
  meses (+191.224).
- **Travas:** `src/tests/emprego-data.test.ts` (saldo = variação do estoque; reconciliação
  Ipeadata × SGS; seções + não itemizado = total; agregados somam as partes; z com janela
  e mínimo declarados e faixa coerente; 27 UFs, saldo = admissões − desligamentos, soma
  das UFs + não identificado = Brasil, posições 1 a 27; score com capacidade financeira
  observada, pesos dos observados somando 1 e RJ com peso zero; divisões herdam C;
  bloco de emprego nas páginas por UF; aba registrada). `score-observado.test.ts` passa
  a travar a declaração `PESOS_SCORE` e a renormalização.
- **Pendências:** corte por divisão CNAE e por UF × seção só com os microdados do MTE
  (fora deste ambiente); massa salarial (salário médio de admissão) existe no Novo Caged
  e não é republicada pelo SGS nem pelo Ipeadata por seção.

## 50. Funding e captação (06/09/2026)

- **Pergunta:** de onde vem o dinheiro que os bancos emprestam, quanto de cada instituição
  depende do mercado e quem, entre os fundos, carrega o papel de cada banco. Painel nº 9 da
  avaliação de 05/09 (§6), P3 no backlog.
- **Fontes (três réguas, nunca somadas):**
  1. **BCB/SGS, meios de pagamento amplos** (27789, 27790, 1835, 7836, 27805 a 27816): saldos
     de fim de mês em poder do público, em R$ mil (convertidos para R$ no builder). Dezesseis
     séries novas em `config/config.json`, categoria `funding`, coletor `bcb_sgs`. Nomes
     confirmados pelo SOAP `FachadaWSSGS` em 05/09/2026.
  2. **BCB/IF.data, relatório Passivo** (API Olinda, TipoInstituicao=2): captações por
     instituição abertas em depósitos (à vista, poupança, interfinanceiros, a prazo, outros),
     compromissadas, LCI, LCA, letras financeiras, TVM no exterior, demais títulos e
     empréstimos e repasses, mais dívida elegível a capital, PL e passivo total. Coletor
     `pipeline/sources/ifdata_passivo.py`: colunas casadas por prefixo do nome porque os nomes
     e as letras entre parênteses mudam nos planos contábeis de 2016, 2023 e 2025 ("Outros
     depósitos" virou "Conta de pagamento pré-paga" + "Depósitos outros"; PL passa de (j) a
     (i)). Histórico 2015-03 a 2026-03 carregado neste ambiente (45 trimestres, 1.046 a
     1.551 instituições por período), capado por execução no CI como o Resumo.
  3. **CVM, CDA bloco 5** ("Depósitos a prazo e outros títulos de IF", um zip mensal de 16 a
     27 MB): letra financeira, CDB/RDB, DPGE e afins, posição a posição, com CNPJ do emissor,
     vencimento e marcação de emissor ligado. Coletor `pipeline/sources/cvm_cda.py`: guarda só
     a agregação mês × emissor (CNPJ raiz) × tipo × ligado, mais o PL total e o número de
     classes do arquivo PL; 24 meses de história, 3 downloads por rodada, os 4 meses mais
     novos recoletados a cada 7 dias.
- **Achado de fonte, registrado:** o gestor pode adiar por até 90 dias a divulgação de uma
  posição; nesse período a CVM publica o valor por classe e tipo, sem emissor, no arquivo
  CONFID. Em 2026-07 havia R$ 442,7 bilhões do bloco 5 sob sigilo (liberação até
  2027-01-27), contra R$ 481,2 bilhões abertos; em 2026-06, R$ 405,3 bilhões. O builder
  marca como parcial todo mês com menos de 90% das classes com papel bancário do máximo dos
  três meses anteriores e usa como referência o último mês pleno (2026-05, 3.206 classes);
  comparar só com o mês anterior mascararia o segundo mês do sigilo. O valor sob sigilo e a
  data de liberação são publicados por mês.
- **Ponte CVM → IF.data:** o relatório Passivo é publicado por conglomerado FINANCEIRO
  (código C..., ex.: "BRADESCO", C0010045) e o cadastro aponta, para cada CNPJ, o conglomerado
  PRUDENCIAL (outro código C...). O builder faz CNPJ raiz do emissor → prudencial → código
  financeiro presente no relatório, e agrega os emissores por essa chave (Itaú Unibanco S.A.
  e Itaú Unibanco Holding viram um emissor). Denominador da razão "LF em fundos ÷ balanço":
  letras financeiras (c3) mais instrumentos de dívida elegíveis a capital (h), onde ficam as
  LF subordinadas e perpétuas; sem o (h), BB dava 216% e Santander 156%.
- **Builder:** `pipeline/funding.py` → `funding.json` (114 KB): sistema (componentes de M4
  com share e variação, série de 120 meses, poupança SBPE e rural), bancos (agregado,
  composição por instrumento, grupos varejo/mercado/repasses que somam as captações, LTD só
  onde depósitos são ao menos 10% das captações, HHI, 40 maiores com composição, por
  segmento e por TCB, série trimestral desde 2015) e fundos (por tipo, 30 maiores emissores
  com LF, CDB, DPGE, ligado, vencimento em 12 meses e razão contra o balanço, série mensal
  com meses parciais e valor sob sigilo). Aba `/observatorio/funding` no grupo Instituições,
  chunk `emergentes`, CSV das instituições; vintage `cda` em `meta.json`; vigília 60 dias.
- **Achados na primeira carga:** M4 de R$ 15,82 trilhões em 2026-07 (+12,0% em 12 meses);
  quotas de fundos monetários são 38% e depósitos a prazo 25%; títulos federais crescem
  30,8% e depósitos à vista caem 1,4%. IF.data 2026-03: R$ 13,96 trilhões captados por 1.046
  instituições, 53% varejo, 34% mercado, 13% repasses; crédito ÷ depósitos 1,18; cinco
  maiores com 64% (HHI 924); S2 é o segmento mais dependente de mercado (59%), S5 o menos
  (1%). CDA 2026-05: R$ 898,0 bilhões de papel bancário em 3.206 classes (6,5% do PL das
  classes), 80% em letras financeiras, 16% em emissor ligado, 42% vencendo em 12 meses; 162
  emissores, cinco maiores com 52% (HHI 754); Bradesco lidera com R$ 160,9 bilhões.
- **Travas:** `src/tests/funding-data.test.ts` (shares sobre M4 e M2 ≤ M3 ≤ M4; varejo +
  mercado + repasses = captações no agregado e por instituição; composição soma 100;
  segmentos somam o corte; série trimestral sem buraco; tipos somam o total dos fundos;
  emissores em ordem; papéis somam o valor; mês parcial excluído; razão só com LF no
  balanço; aba registrada; coletores, gold e vintage no pipeline).
- **Pendências:** custo de captação por instrumento e por instituição não existe em fonte
  aberta (a taxa média de CDB do SGS 28663 parou em 2024-01); LCI e LCA em fundos estão no
  bloco 6 do CDA (R$ 0,04 bilhão em 2026-07, irrelevante) e ficaram fora; pessoas físicas
  como detentoras de LF e CDB não têm fonte pública por emissor.

## 51. Consórcios (06/09/2026)

- **Pergunta:** quanto do carro e da casa se compra sem crédito, pelo consórcio; quantas
  cotas, quanto de carteira, quem contempla, quem sai, quanto custa e onde. Painel nº 10 da
  avaliação de 05/09 (§6), prioridade baixa; fecha a lista do §6.
- **Fonte (uma régua):** BCB, Panorama de Consórcios, API Olinda `PANORAMA_DE_CONSORCIOS`
  (function imports `CadastroDeMetricas()`, `GrupoDeMetricas()` e `Metricas(DataBase=@DataBase)`;
  os parênteses são obrigatórios e o `$format` precisa ir codificado como `%24format`).
  125 métricas em 19 grupos por trimestre (DataBase = fim de trimestre), 2015-T1 a
  2026-T1 (45 trimestres, todos com as 125 métricas). Coletor
  `pipeline/sources/bcb_consorcios.py`: histórico uma vez, dois trimestres mais novos
  recoletados a cada 7 dias, trimestre sem dado registrado como ausência.
  As séries anuais do SGS sobre consórcios (27452 a 27499: administradoras por tipo,
  cotas por região, cotistas por renda) pararam em 2022 e ficaram fora: dado parado não
  é dado.
- **Achado de fonte, registrado:** três rótulos de unidade do Panorama estão errados e
  foram corrigidos por conferência aritmética, publicada em `conferencias`: métrica 37
  (contempladas de motos, "mi") é a soma de 38 e 39 em mil; métrica 68 (recursos a
  coletar, total, "R$ milhões") é a soma de 69 a 72 em R$ bilhões; métrica 77 (RNP
  devolvido via SVR, "R$ bilhões") é da ordem do saldo de RNP (73), em R$ milhões. A
  carteira de veículos pesados não é publicada em separado (fica em "veículos
  automotores" com comerciais leves e motos) e o painel declara a diferença em vez de
  atribuí-la.
- **Builder:** `pipeline/consorcios.py` → `consorcios.json` (38 KB): panorama do
  trimestre (administradoras, grupos, cotas, carteira, contempladas por sorteio e lance,
  excluídas e índice de exclusão, comercializadas, inadimplência e pré-inadimplência,
  recursos coletados e a coletar, RNP, taxa de administração, crédito médio e prazo dos
  grupos novos), cinco segmentos, série trimestral de 45 pontos, 27 UFs com cotas por mil
  habitantes (população do Censo 2022 via `ufs.json`) e posições. Roda ANTES das páginas
  por UF em `gold.py` (que carregam o bloco na mesma execução) e lê a população do
  `ufs.json` publicado na execução anterior. Aba
  `/observatorio/consortia` no grupo Produtos e preços, chunk `emergentes`, CSV da série;
  bloco "Consórcios" nas 27 páginas por UF; vintage `consorcios`; vigília 135 dias.
- **Achados na primeira carga (2026-T1):** 13.002.100 cotas ativas (+12,2% em 12 meses)
  em 16.374 grupos de 125 administradoras; carteira de R$ 156,9 bilhões (+18,9%) e
  R$ 888,6 bilhões a coletar; imóveis 23% das cotas e 42% da carteira, automóveis 42% e
  32%, motos 25% e 7%; 1.826.960 contempladas em 12 meses (79% por lance; 14% das
  cotas), 5.489.090 comercializadas; inadimplência 2,25% (2,41% há um ano), índice de
  exclusão 48,8%; taxa média de administração dos grupos novos 18,9% (imóveis 21,2%,
  automóveis 15,0%, pesados 12,7%), crédito médio R$ 106,7 mil, prazo 168 meses
  (imóveis 217). Brasil com 60,9 cotas por mil habitantes; São Paulo com 22% das cotas e
  Paraná com 98,8 por mil habitantes.
- **Travas:** `src/tests/consorcios-data.test.ts` (conferências fecham em menos de
  0,1%; unidades corrigidas declaradas; ordens de grandeza em unidades e R$; sorteio +
  lance = 100; contemplação = contempladas ÷ cotas; pesados com carteira nula; série
  trimestral contínua até o trimestre publicado; 27 UFs com share 100 e posições 1 a
  27; bloco nas páginas por UF; aba e pipeline registrados).
- **Pendências:** corte por administradora e por município não existe na fonte aberta;
  o Panorama não traz valor médio de lance nem prazo de contemplação.

