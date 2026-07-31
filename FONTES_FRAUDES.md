# FONTES_FRAUDES.md — Registro de fontes da aba "Fraudes financeiras e risco de crédito"

Data de corte da pesquisa: **31/07/2026**. Verificação de atualizações posteriores: 31/07/2026. Fonte de verdade da curadoria de `pipeline/curated/fraudes.json` (copiado ao gold pelo pipeline).

Níveis de confiabilidade: **A** dado administrativo oficial · **B** pesquisa oficial representativa · **C** acadêmico com método identificável · **D** estimativa privada com método publicado · **E** exploratório/não validado em fonte primária.

Colunas críticas desta aba: **risco de subnotificação** (quanto do fenômeno a fonte não vê) e **duplicidade** (com quais outras fontes o número se sobrepõe — números sobrepostos JAMAIS são somados).

## 1. Fontes administrativas oficiais

### BCB — Estatísticas de Fraude no Pix (MED), dados abertos
- Base: recurso "EstatisticasFraudesPix" no conjunto Pix do Portal de Dados Abertos; API OData olinda.bcb.gov.br
- URL: https://dadosabertos.bcb.gov.br/dataset/pix/resource/7eb5efdd-d4dd-47da-a74a-d93ce68ea185
- Conceito: transações contestadas via MED e devoluções; mensal, D+30
- Tipo de fraude coberto: golpes via Pix (engenharia social, conta invadida)
- Limitações: contestação ≠ fraude comprovada; não capta golpe não contestado; devolução limitada ao saldo na conta destino; quebra metodológica com o MED 2.0 (02/02/2026)
- Subnotificação: alta (só quem aciona o banco no prazo)
- Duplicidade: os valores contestados sobrepõem-se às perdas Febraban e à vitimização declarada
- Atualização automática: POSSÍVEL (API catalogada); o endpoint não é acessível do ambiente de build atual → integração via pipeline (GitHub Actions) na próxima iteração. Agregados atuais no painel: compilação de imprensa sobre a base ([O POVO+, 24/07/2026](https://mais.opovo.com.br/reportagens-especiais/2026/07/24/a-cada-rs-100-em-golpes-no-pix-instituicoes-devolvem-apenas-rs-890.html)) marcada E
- Número oficial confirmado: **MED 1.0 recuperou 9,3% do valor contestado em 2025** — [BCB, MED 2.0 Circuito Pix Dia 1 (PDF)](https://www.bcb.gov.br/content/estabilidadefinanceira/pix/MED/MED_2-0_Circuito_Pix-Dia_1.pdf) · **A**

### BCB — Relatório de Estabilidade Financeira (incidentes cibernéticos)
- 53 incidentes relevantes reportados em 2024; 59 até ago/2025 (Res. CMN 4.893)
- URLs: [REF nov/2025](https://www.bcb.gov.br/content/publicacoes/ref/202510/RELESTAB202510-refPub.pdf) · [apresentação](https://www.bcb.gov.br/conteudo/home-ptbr/TextosApresentacoes/REF_novembro2025_Apresentacao_coletiva_imprensa.pdf) · **A**
- Limitações: incidentes reportados pelas IFs; sem perdas em R$; não é fraude contra cliente

### FBSP/SINESP — Anuário Brasileiro de Segurança Pública (estelionato)
- Série 2018 a 2025: 426.799 → 2.261.055 ocorrências (+429%); eletrônico (§2º-A): 222,7 mil (2023), 286,2 mil (2024), 346,7 mil (2025)
- URL: https://forumseguranca.org.br/publicacoes/anuario-brasileiro-de-seguranca-publica/ (Anuário 2026 divulgado 28/07/2026) · **A** (consolidação padrão de registros administrativos; FBSP é OSCIP)
- Conceito: boletim de ocorrência (não vítima, não condenação)
- Subnotificação: >90% (2,26 mi BOs vs 26 a 42 mi de vítimas declaradas)
- Limitações: recorte eletrônico subestimado (SP e RJ não destacam a rubrica); revisões entre edições (2024: 2.166.552 → 2.193.122)

### Polícia Federal
- Sem série estatística pública; evidência por operações: Magna Fraus 2ª fase (out/2025, prejuízo >R$ 813 mi) — [gov.br/pf](https://www.gov.br/pf/pt-br/assuntos/noticias/2025/10/pf-deflagra-segunda-fase-de-operacao-contra-organizacao-criminosa-especializada-em-fraudes-bancarias-digitais); Projeto Tentáculos com Febraban · **A** (qualitativo)

### STJ
- Súmula 479 (2012): responsabilidade objetiva dos bancos por fortuito interno — [PDF](https://www.stj.jus.br/docs_internet/revista/eletronica/stj-revista-sumulas-2017_37_capSumulas479-483.pdf) · **A**
- Repetitivo golpe da falsa central (20/10/2025) — [notícia oficial](https://www.stj.jus.br/sites/portalp/Paginas/Comunicacao/Noticias/2025/21102025-Bancos-e-instituicoes-de-pagamento-devem-indenizar-clientes-por-falhas-que-viabilizam-golpe-da-falsa-central.aspx) · **A**

### CERT.br / Cetic.br
- Painéis oficiais: [stats.cert.br/incidentes](https://stats.cert.br/incidentes/) e [stats.cert.br/phishing](https://stats.cert.br/phishing/) — dinâmicos, sem endpoint estático conferível no build → integração futura; marcados como lacuna
- TIC Domicílios 2024: ~141 mi de usuários de internet — [cetic.br](https://cetic.br/pt/noticia/em-duas-decadas-proporcao-de-lares-urbanos-brasileiros-com-internet-passou-de-13-para-85-aponta-tic-domicilios-2024/) · **B** (contexto de exposição; não mede vitimização)

### Receita Federal, Senacon/consumidor.gov.br, CNJ/DataJud
- RFB: apenas alertas qualitativos de golpes com o nome do órgão (sem números) · lacuna declarada
- consumidor.gov.br: base aberta existe ([dados abertos](https://consumidor.gov.br/pages/dadosabertos/externo/)); sem ranking oficial de fraudes pronto → processamento na próxima iteração
- CNJ/DataJud: sem recorte público de ações por fraude bancária digital → lacuna declarada

## 2. Pesquisas oficiais representativas

### DataSenado — Panorama Político, 21ª ed. (out/2024)
- **24% da população 16+ perdeu dinheiro com crime cibernético em 12 meses (≈41,6 mi)**; CATI, n=21.808, campo 05 a 28/06/2024, ±1,22 p.p.
- URL: https://www12.senado.leg.br/noticias/materias/2024/10/01/golpes-digitais-atingem-24-da-populacao-brasileira-revela-datasenado · **B**
- Duplicidade: sobrepõe FBSP/Datafolha e surveys privados (conceitos próximos, populações distintas)

### FBSP/Datafolha — Pesquisa de Vitimização
- 2025: 24,5 mi vítimas de golpe do Pix/boleto (jul/2024 a jun/2025), perdas estimadas ~R$ 29 bi; mar/2026: 15,8% (26,3 mi) vítimas — [Rádio Senado](https://www12.senado.leg.br/radio/1/noticia/2025/08/18/mais-de-24-milhoes-de-pessoas-foram-vitimas-de-golpes-pelo-pix) · **B** (prevalência) / **E** (extrapolação monetária)

## 3. Estudos acadêmicos e benchmarks (biblioteca no fraudes.json)
Philadelphia Fed WP 16-27/20-33/21-41/25-29 (identity theft e crédito, C); Gurun/Stoffman/Yonker RFS 2018 (confiança, C); Boyle et al. Annals 2019 (idosos, C); DeLiema et al. 2020 + FINRA/FFRC 2015 (custos não financeiros, C); FTC Sentinel 2024 (A-EUA); FBI IC3 2025 (A-EUA); UK Finance 2026 + PSR (benchmark de reembolso, D); ACCC Targeting Scams 2025 (A-Austrália); BCBS d558 2025 (A-internacional); Europol IOCTA 2025 (qualitativo). URLs no fraudes.json.

## 4. Fontes privadas e setoriais
- **Febraban**: perdas com golpes e fraudes **R$ 8,6 bi (2023) e R$ 10,1 bi (2024)**, divulgação com MJSP, sem nota técnica pública — [Poder360](https://www.poder360.com.br/poder-economia/golpes-causaram-prejuizo-de-r-101-bi-em-2024-diz-febraban/) · **D**; Pix: R$ 2,7 bi acumulados 2023-24. Interesse: entidade dos bancos. 2025 não publicado até o corte. Pesquisa Febraban de Tecnologia Bancária (Deloitte) mede investimento, não perdas — [PDF 2025](https://cmsarquivos.febraban.org.br/Arquivos/documentos/PDF/Pesquisa%20Febraban%20de%20Tecnologia%20Banca%CC%81ria%202025%20-%20Vol_01%20-%205.pdf)
- **Serasa Experian — Indicador de Tentativas de Fraude** (mensal, modelo probabilístico + biometria/documental): jan/2025 1,242 mi (+41,6%); 1S2025 6,94 mi; jan-set 10,8 mi (imprensa) — [release](https://www.serasaexperian.com.br/sala-de-imprensa/indicadores/recorde-quase-7-milhoes-de-tentativas-de-fraude-foram-registradas-no-1-semestre-de-2025-setor-bancario-e-principal-alvo/) · **D**. Conceito: TENTATIVA, nunca somar com perdas. Interesse: vende antifraude
- **Serasa survey (jun/2026)**: 51% já sofreram golpe; 20% perderam até R$ 5 mil — [release](https://www.serasaexperian.com.br/sala-de-imprensa/prevencao-a-fraude/mais-da-metade-dos-brasileiros-ja-foi-vitima-de-fraude-e-20-deles-perderam-ate-rdollar-5-mil-revela-estudo-inedito-da-serasa-experian/) · **D**
- **CNDL/SPC Brasil (jun/2026)**: 31% sofreram fraude em 12 meses (survey online, margem não divulgada) — [release](https://cndl.org.br/varejosa/1-em-cada-3-brasileiros-ja-sofreu-golpe-financeiro-e-o-problema-nao-para-de-crescer/) · **D**
- **Silverguard (2025)**: perda média golpe Pix R$ 2.540 (PF) e R$ 5.200 (PJ); 65% dos fluxos a contas PJ; base autosselecionada — [Finsiders](https://finsidersbrasil.com.br/estudos-e-relatorios/cresce-uso-de-contas-pj-em-golpes-com-pix-devolucao-de-dinheiro-cai/) · **D**
- **Kaspersky (2025)**: 553 mi de bloqueios de phishing em 12 meses (telemetria própria; bloqueio ≠ vítima) — [TI Inside](https://tiinside.com.br/10/09/2025/ataques-de-mensagens-falsas-crescem-80-no-brasil-e-atingem-553-milhoes-de-deteccoes/) · **D**
- **GASA — State of Scams in Brazil 2025**: estimativa R$ 99 bi/ano (survey online, extrapolação agressiva) — [GASA](https://gasa.org/knowledge-base/reports/state-of-scams-in-brazil-2025) · **E** (apenas teto especulativo)

## 5. Fontes avaliadas e NÃO utilizadas como número
- **ACI Worldwide Scamscope**: projeção que destoa fortemente do reportado (Febraban) sem método detalhado → descartada
- **PSafe/dfndr, Visa, Mastercard Brasil**: sem divulgação recente com metodologia descrita → descartadas
- **IBM Cost of a Data Breach**: mede custo de violação corporativa, não fraude ao consumidor → fora de escopo
- **LexisNexis True Cost of Fraud**: amostra de 54 decisores; custo operacional de empresas → fora de escopo
- Números de imprensa sobre a base MED entram somente com selo E até conferência no endpoint oficial

## 6. Matriz de duplicidade (por que nada é somado)
| Par de fontes | Sobreposição |
|---|---|
| Febraban × MED/BC | perdas Pix estão nos dois; conceitos distintos (perda consumada vs valor contestado) |
| Febraban × Datafolha/DataSenado | o reportado aos bancos está contido na vitimização declarada |
| Serasa (tentativas) × qualquer perda | tentativa bloqueada não vira perda; modelo, não evento |
| FBSP (BOs) × vitimização | BO é subconjunto (~5 a 10%) das vítimas declaradas |
| GASA × todas | extrapolação que engloba os demais recortes |

## 7. Processo de atualização manual
1. Anuário FBSP (julho): atualizar série `estelionato` e `estelionato_eletronico`.
2. REF do BCB (semestral): atualizar `incidentes_ciberneticos`.
3. Febraban (anual, geralmente 1º trimestre): atualizar `perdas_febraban` somente com divulgação institucional.
4. Serasa (mensal): atualizar pontos selecionados (não replicar mês a mês; o painel não é espelho de release comercial).
5. MED: prioridade é integrar a API oficial ao pipeline (GitHub Actions tem acesso à rede) e substituir os agregados E por série mensal A com a quebra fev/2026 marcada.
6. Números de imprensa nunca substituem oficiais; promoção a `oficial` só com URL primária.
