# FONTES_BETS.md — Registro de fontes da aba "Bets e risco financeiro"

Data de corte da pesquisa: **31/07/2026**. Verificação de atualizações posteriores: realizada em 31/07/2026 (nenhum Panorama SPA do 1S2026 publicado até o corte; padrão de publicação é fim de agosto). Este arquivo é a fonte de verdade da curadoria de `pipeline/curated/bets.json` (copiado ao gold pelo pipeline).

Classificação de confiabilidade usada no painel: **A** dado administrativo oficial · **B** pesquisa oficial representativa · **C** estudo acadêmico com método identificável · **D** estimativa privada com metodologia publicada · **E** associação exploratória ou sinal não validado em fonte primária.

## 1. Fontes administrativas oficiais

### SPA/MF — 1º Panorama Semestral do Mercado de Apostas
- Instituição: Secretaria de Prêmios e Apostas, Ministério da Fazenda
- Documento: apresentação oficial (PDF), 1º Panorama
- URL: https://www.gov.br/fazenda/pt-br/composicao/orgaos/secretaria-de-premios-e-apostas/apresentacoes/copy_of_apresentacao_spamf_relatoriodo1osemestre_versao1.pdf
- Publicação: 26/08/2025 · Período de referência: jan a jun/2025
- População: mercado autorizado (bet.br) · Conceitos: apostadores no semestre (17,7 mi), GGR (R$ 17,4 bi), 78 empresas/182 marcas, destinações (R$ 2,14 bi), taxa de fiscalização (R$ 49,3 mi), fiscalização, 15 mil+ sites bloqueados
- Frequência: semestral · Granularidade: nacional, agregada
- Coleta: registro administrativo SIGAP
- Limitações: não divulga depósitos, prêmios pagos, turnover, renda, UF nem distribuição individual
- Atualização automática: NÃO (PDF; processo manual documentado abaixo) · Confiabilidade: A

### SPA/MF — 2º Panorama Semestral (ano 2025)
- URL: https://www.gov.br/fazenda/pt-br/composicao/orgaos/secretaria-de-premios-e-apostas/apresentacoes/apresentacao-spa-mf-relatorio-periodico-2026.pdf
- Publicação: 23/01/2026 · Período: jan a dez/2025
- Conceitos: 25.245.319 CPFs únicos; 87,67 mi contas por operador; 100,78 mi contas por marca; GGR R$ 36.959.783.379,70; perfil (68,3% homens; 28,6% na faixa 31 a 40); 132 processos de fiscalização; ~550 contas encerradas; 133 URLs bloqueadas por processo formal
- Notícia complementar (arrecadação 2025: tributos R$ 9,95 bi; destinações R$ 4,53 bi; outorgas R$ 2,5 bi; taxa R$ 95,5 mi; 25 mil+ sites; 217 mil autoexclusões em 40 dias): https://www.gov.br/fazenda/pt-br/assuntos/noticias/2026/janeiro/em-um-ano-de-mercado-regulado-spa-registra-mais-de-25-mil-sites-ilegais-bloqueados
- Limitações: idem 1º Panorama; contagem de contas ≠ CPFs (documentado no painel) · Confiabilidade: A

### SPA/MF — Lista oficial de empresas autorizadas
- URL: https://www.gov.br/fazenda/pt-br/composicao/orgaos/secretaria-de-premios-e-apostas/lista-de-empresas (planilha de 06/05/2026: ~85 empresas, ~240 domínios; contagem por extração automatizada, com ressalva)
- Frequência: contínua · Confiabilidade: A (contagens derivadas: E até conferência manual)

### SPA/MF — Plataforma Centralizada de Autoexclusão
- Lançamento: 12/12/2025 · Atos: Portaria SPA/MF 2.579/2025 + IN 31/2025
- 574,6 mil solicitações até 29/05/2026 (41% perda de controle/saúde mental; 69% prazo indeterminado): https://www.gov.br/fazenda/pt-br/assuntos/noticias/2026/maio/mais-de-meio-milhao-de-pessoas-ja-utilizaram-a-plataforma-centralizada-de-autoexclusao (A)
- 925 mil (09/07/2026): apenas imprensa (BNLData) — E, aguardando publicação primária
- Limitação central: demanda voluntária ≠ prevalência de dependência

### BCB — Estudo Especial nº 119/2024 (Pix e apostas)
- URL: https://www.bcb.gov.br/conteudo/relatorioinflacao/EstudosEspeciais/EE119_Analise_tecnica_sobre_o_mercado_de_apostas_online_no_Brasil_e_o_perfil_dos_apostadores.pdf
- Publicação: set/2024 · Período: jan a ago/2024 (pré-regulação)
- Conceito: transferências Pix BRUTAS a contas de operadoras (R$ 18 a 21 bi/mês; ago/2024: R$ 20,8 bi; ~24 mi pagadores; recorte Bolsa Família: 5 mi de responsáveis, R$ 3 bi, mediana R$ 100)
- Método: identificação de contas por CNAE + lista de 56 operadoras + padrão comportamental
- Limitações (declaradas pelo BC): preliminar; não separa legal/ilegal; não distingue depósito de aposta; fluxo bruto ≠ perda (retenção ~15% estimada); recorte BF contestado (CPF do responsável; origem do recurso)
- Atualização: NENHUMA publicada até 31/07/2026 (REFs de abr/2025, nov/2025 e mai/2026 verificados: sem boxe de bets) · Confiabilidade: A com contestação documentada

### BCB/SGS — séries de crédito usadas no explorador (via pipeline do Observatório)
- inad_pf (21084, inadimplência PF >90d, % — carteira total), inad_total (21082), comprometimento (29034), endividamento (29037), taxa_pf, concessoes_pf, saldo_pf, desemprego, ipca, selic_meta
- URL padrão: https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados · Frequência: mensal · Atualização automática: SIM (pipeline diário)
- Séries identificadas e AINDA NÃO integradas (próxima coleta): atraso 15-90d PF (21005), rotativo saldo/juros/inad (20587/22022/21127), cheque especial (20741/21113), não consignado e composição de dívidas (20574/20575/21114) · Confiabilidade: A

### TCU — acórdão TC 015.852/2025-3 (mercado ilegal)
- URL: https://portal.tcu.gov.br/imprensa/noticias/apostas-on-line-tcu-avalia-acoes-de-prevencao-do-governo (PDF do relatório circulado pela imprensa)
- Publicação: 19/05/2026 · Conceito: consolida estimativas de participação ilegal (41% a 51%; até R$ 40 bi/ano) e faz 8 recomendações à SPA
- Limitação: é documento oficial que CONSOLIDA estimativas privadas; não é medição administrativa · Confiabilidade do intervalo: D

### Ministério da Saúde / SUS
- 10.553 atendimentos por transtorno do jogo (CID F63.0), jan/2018 a mai/2025, +104%: divulgado pelo MS em audiência na Câmara (28/05/2026, https://www.camara.leg.br/noticias/1277447-ministerio-da-saude-revela-aumento-dos-atendimentos-de-saude-mental-no-sus-por-vicio-em-apostas/) — sem painel público dedicado no DATASUS; subnotificação forte · A (com limitação de captação)
- Linha de Cuidado (2025): https://bvsms.saude.gov.br/bvs/publicacoes/linha_cuidado_problemas_jogos_apostas.pdf · Guia nacional (15/01/2026): https://www.gov.br/saude/pt-br/assuntos/noticias/2026/janeiro/ministerio-da-saude-lanca-guia-nacional-para-enfrentar-impactos-das-apostas-online-na-saude

### STF, Planalto e DOU (linha do tempo)
- Lei 13.756/2018: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/L13756.htm
- Lei 14.790/2023: https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/L14790.htm
- LC 224/2025: https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp224.htm (escalonamento de alíquotas: parcialmente confirmado; conferir texto)
- ADI 7.721, liminar 12/11/2024: https://noticias-stf-wp-prd.s3.sa-east-1.amazonaws.com/wp-content/uploads/wpallimport/uploads/2024/11/13134254/ADI-7721-decisao-liminar-fux.pdf · decisão 19/12/2025: https://noticias.stf.jus.br/postsnoticias/stf-mantem-proibicao-de-novos-cadastros-de-beneficiarios-sociais-em-bets-e-antecipa-conciliacao/
- Portarias SPA/MF no DOU (615, 827, 1.231, 1.475/2024; 566/2025; 2.217/2025 + IN 22; 2.579/2025 + IN 31; 1.237/2026 + IN 3/2026) e MP 1.355/2026: URLs no bets.json (timeline) · Confiabilidade: A

## 2. Pesquisas oficiais representativas

### DataSenado 2024 — Panorama Político (apostas)
- URL: https://www.senado.leg.br/institucional/datasenado/relatorio_online/pesquisa_aposta_esportiva/2024/interativo.html
- Publicação: 01/10/2024 · Campo: 05 a 28/06/2024 · Método: CATI, n=21.808, ≥16 anos, margem média 1,22 p.p. (IC 95%)
- Conceitos: prevalência 30 dias (13%; 22,13 mi), perfil, faixas de gasto (sem média/mediana), endividamento (42% vs 32% com atraso >90d), extremos regionais
- Limitações: autodeclarado; recall de 30 dias; não mede uso de dinheiro de necessidades básicas · Confiabilidade: B

### DataSenado 2025 — Legalização de jogos
- URL: https://www.senado.leg.br/institucional/datasenado/relatorio_online/pesquisa_legalizacao_apostas/2025/interativo.html · CATI, n=5.039, ±1,72 p.p. · foco em opinião (não prevalência de bets) · B

### IBGE — POF 2024-2025
- Rubrica de apostas incluída pela primeira vez (anúncio: https://agenciabrasil.ebc.com.br/economia/noticia/2024-10/ibge-vai-medir-peso-das-bets-nos-gastos-do-brasileiro). Resultados NÃO publicados até 31/07/2026 → painel exibe a lacuna, sem placeholder.

## 3. Estudos acadêmicos (nível C)
| Estudo | Veículo | Desenho | URL |
|---|---|---|---|
| Baker et al., Gambling Away Stability | JFE 2026 (ex NBER WP 33108) | causal (DiD escalonado, EUA) | https://www.nber.org/papers/w33108 |
| Hollenbeck, Larsen, Proserpio | SSRN WP (marcado como WP) | causal (DiD, bureau de crédito) | https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4903302 |
| Muggleton et al. | Nature Human Behaviour 2021 | associação (não causal) | https://www.nature.com/articles/s41562-020-01045-w |
| Kearney | J. Public Economics 2005 | causal (loterias estaduais) | https://www.sciencedirect.com/science/article/abs/pii/S0047272704001343 |
| Hankins, Hoekstra, Skiba | REStat 2011 | quase-experimental | https://direct.mit.edu/rest/article/93/3/961/57917 |
| Karlsson, Håkansson | J. Behavioral Addictions 2018 | coorte de registro | https://akjournals.com/view/journals/2006/7/4/article-p1091.xml |

## 4. Fontes privadas e setoriais (nível D; entram só com metodologia disponível)
- **Itaú Macro Visão (ago/2024)**: apostas brutas ~R$ 68 bi/12m; perda líquida ~R$ 24 bi; método publicado (balanço de pagamentos + checagens). https://macroattachment.cloud.itau.com.br/attachments/a77e92d9-319f-45ca-b657-6c721241804b/13082024_MACRO_VISAO_Apostas_on-line.pdf
- **CNDL/SPC Brasil (set/2024)**: survey online n=821, ±3,42 p.p.; gasto médio declarado R$ 186/mês; 15% deixaram de pagar contas. https://cndl.org.br/varejosa/consumidores-gastam-cerca-de-r-6-bilhoes-ao-mes-com-jogos-e-apostas-online-no-brasil-revela-pesquisa-cndl-spc-brasil/
- **Serasa/Opinion Box (nov/2024)**: n=4.463 endividados; metodologia incompleta (sem margem); entra com ressalva forte. https://borainvestir.b3.com.br/noticias/57-dos-endividados-que-apostaram-em-bets-nao-eram-inadimplentes-antes-de-comecarem-a-apostar-revela-pesquisa-da-serasa/
- **Febraban/IPESPE (dez/2024)**: n=2.000; pesquisa de percepção. https://portal.febraban.org.br/noticia/4238/pt-br
- **Datafolha (mai/2026)**: presencial, n=1.907, ±2 p.p.; 7% dos adultos; R$ 241/mês declarado (via imprensa especializada; registro TSE BR-07489/2026)
- **ANBIMA/Datafolha Raio-X (abr/2026)**: 17% da população (conceito distinto)
- **CNC (abr/2026)**: DiD sobre Peic declarado, nota técnica completa NÃO publicada; contestado pelo IBJR → entra como estimativa contestada. https://movimentoeconomico.com.br/economia/varejo/2026/04/29/cnc-bets-drenam-r-30-bi-por-mes-e-e-levam-270-mil-familias-a-inadimplencia/
- **Locomotiva/IBJR (jun/2025)**: n=2.000 digital, ±2,2 p.p.; encomendado pelo setor (interesse declarado). https://ibjr.org.br/wp-content/uploads/2025/09/Pesquisa-Instituto-Locomotiva_Incidencia-de-Apostas-Ilegais-no-Brasil-2025_divulgacao-10.06.2025.pdf
- **LCA/IBJR (2024-25)**: perda fiscal R$ 7,2 a 10,8 bi/ano; premissas publicadas. https://ibjr.org.br/wp-content/uploads/2024/10/LCA_IBJR_Mercado-de-Apostas-1.pdf

## 5. Fontes avaliadas e NÃO utilizadas como número
- **Yield Sec, H2 Gambling Capital**: metodologia proprietária não publicada → citadas apenas como existentes (E)
- **Números exclusivamente de imprensa sem fonte primária**: usados somente com selo "IMPRENSA · AGUARDA FONTE PRIMÁRIA" (1T2026 do SIGAP; 925 mil autoexclusões; 2,8 mi CPFs impedidos; 54 mil sites; RFB jan-mai/2026)
- **CNJ/DataJud**: sem recorte público de ações sobre bets até o corte → lacuna registrada
- **Consumidor.gov.br**: >1.000 reclamações jan-abr/2025 (Senacon); não integrado como série por falta de recorte público estável

## 6. Divergências registradas entre briefing e fontes (em 31/07/2026)
| Número do briefing | Situação verificada |
|---|---|
| 17,7 mi apostadores 1S2025 | Confirmado (conceito: pessoas no semestre) |
| GGR R$ 17,4 bi 1S2025 | Confirmado |
| ~R$ 164/mês por apostador | Confirmado como derivação do 1S2025 (média, não mediana) |
| 78 operadores / 182 marcas | Desatualizado: 79 empresas (2025); ~85 empresas/~240 domínios (mai/2026) |
| 15 mil sites bloqueados | Desatualizado: 25 mil+ (2025, oficial); ~54 mil (jul/2026, imprensa) |
| 41% a 51% ilegal | Confirmado como estimativa consolidada pelo TCU (mai/2026) |
| 603 mil autoexclusões em 6 meses | Compatível com recorte de jun/2026 (imprensa), mas superado: 574,6 mil (mai/2026, oficial) e 925 mil (jul/2026, imprensa) |

## 7. Processo de atualização manual (fontes sem API)
1. Ao sair novo Panorama SPA (fim de fevereiro e fim de agosto): baixar o PDF, registrar URL + data de publicação aqui, atualizar `pipeline/curated/bets.json` (séries `ggr_regulado`, `apostadores`, `arrecadacao`, `bloqueios_ilegais`, síntese) e rodar `python3 -m pytest`/`npx vitest run` (testes de consistência conceitual).
2. Números de imprensa NUNCA substituem os oficiais: entram com `status: "imprensa"` e são promovidos a `oficial` apenas com URL primária gov.br.
3. Snapshot: o próprio bets.json versionado no git é o snapshot verificável (data em `gerado_em`); nada de scraping contra termos de uso.
4. Nunca transformar observações isoladas (ex.: um mês de Pix) em série contínua.
