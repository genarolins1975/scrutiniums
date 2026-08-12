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
  do `ifdata_ui`.
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
  e mercado misturados. Custo fora de 0–100% a.a. é DESCARTADO (unidade ou
  tradução suspeita) — nunca publicado. Fórmula declarada por instituição.
- **Modelo de negócio (`institutions.json → modelo_negocio`):** peso dos
  serviços na receita operacional (serviços ÷ intermediação + serviços;
  omitido quando a intermediação é negativa), crédito/ativo e captações/ativo;
  o perfil de carteira (modalidades PF/PJ, PME, HHI) segue em
  `carteira_perfil`. Métrica ausente ⇒ campo omitido, nunca imputado.
- **Escala:** `config.ifdata.top_n_by_assets = 100` — o corte scorado vai às
  top 100 por ativo. A coleta já cobria o universo inteiro; grupos de pares
  com <5 membros seguem caindo para o conjunto completo, com sinalização.
