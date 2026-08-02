# Pix e Meios de Pagamento — Auditoria das APIs (Fase 0)

Auditoria executada em 2026-07-29 contra os endpoints REAIS (Olinda/OData). Nada abaixo foi presumido de
relatórios: cada recurso foi chamado, cada esquema extraído do `$metadata`, cada unidade validada por
reconciliação numérica.

## 1. Serviços e recursos validados

### Pix_DadosAbertos (olinda.bcb.gov.br/olinda/servico/Pix_DadosAbertos/versao/v1/odata/)
| Recurso | Parâmetro | Grão | Conteúdo real (campos do $metadata) |
|---|---|---|---|
| `EstatisticasTransacoesPix(Database=@Database)` | `@Database='AAAAMM'` — retorna **do mês pedido até o mais recente** (69 meses desde 202011 em 1 chamada; ~13,6 mil linhas/mês; CSV pt-BR: vírgula decimal, sem separador de milhar) | mensal, totalmente cruzado | PAG/REC_PFPJ · PAG/REC_REGIAO · **PAG/REC_IDADE** (7 faixas) · FORMAINICIACAO (DICT, MANU, QRES, QRDN, APES, APDN, **INIC**=iniciador, **AUTO**=Pix Automático) · NATUREZA (P2P, P2B, B2P, B2B, P2G, G2P, B2G, G2B, G2G — **governo identificável**) · FINALIDADE (Pix, **Pix Saque**, **Pix Troco**) · VALOR · QUANTIDADE |
| `TransacoesPixPorMunicipio(DataBase=@DataBase)` | idem (janela) | mensal × 5.570 municípios | VL/QT × Pagador/Recebedor × PF/PJ + QT_PES_* (nº de **pessoas** distintas por perspectiva) |
| `PixUsuariosCadastradosDICT` | sem parâmetro | snapshots | PF, PJ, total de usuários cadastrados no DICT |
| `ChavesPix(Data=@Data)` | `@Data='AAAA-MM-DD'` (fim de mês) | estoque por participante | ISPB, Nome, NaturezaUsuario, TipoChave, qtdChaves, Segmento |
| `EstatisticasFraudesPix(Database=@Database)` | janela | mensal (MED) | contestados, aceitas/rejeitadas, aceitas/100 mil, usuários e chaves com marcação de fraude, devolvidos integral/parcial, residual, motivos de não devolução, % devolução, bloqueio cautelar |
| `CnaePorteRecebedor(Database=@Database)` | janela | mensal, cruzado | **é a EPAE**: tipopessoa, formainic, finalidade, porte, MEI, **cnssecao (seção CNAE do RECEBEDOR)**, mesma titularidade, naturezarel (P2B/B2B/…), qt pagadores, qt recebedores, qt/vl lançamentos liquidados, vl compra, vl dinheiro em espécie |

### MPV_DadosAbertos (Estatísticas de Meios de Pagamento)
| Recurso | Grão | Conteúdo |
|---|---|---|
| `MeiosdePagamentosMensalDA(AnoMes=@AnoMes)` | mensal desde **2015-01** (138 meses em 1 chamada) | Pix, TED, TEC, Cheque, Boleto, DOC — quantidade (**milhares**) e valor (**R$ milhões**) — unidades validadas por reconciliação |
| `MeiosdePagamentosTrimestralDA` | trimestral | TODOS os instrumentos: + cartões crédito/débito/pré-pago, transferências intrabancárias, convênios, débito direto, **saques** |
| `Quantidadeetransacoesdecartao` | trimestral | cartões emitidos/ativos por bandeira/função/produto; transações nacionais/internacionais |
| demais (MDR, intercâmbio, POS/PDV, ATM, credenciados, intrabancárias, canal) | trimestral | infraestrutura e tarifas — fase 2, exceto uso pontual |

### SPI (olinda.bcb.gov.br/olinda/servico/SPI/versao/v1/odata/)
`PixLiquidadosAtual` (diário: quantidade, total, média) · `PixLiquidadosIntradia` (curva média por horário) ·
`PixDisponibilidadeSPI` (índice mensal vs mínimo normativo) · `PixInterrupcaoSPI` · `PixRemuneracaoContaPI`.

### IBGE
População por UF (SIDRA 6579, já no silver via geo_uf) — denominadores. IPCA (SGS 433, já no silver) — deflação.

## 2. Reconciliações medidas (mai/2026)
- **MPV (universo, doc 1201)**: 7,855 bi transações · R$ 3,478 tri.
- **Base transacional (EstatisticasTransacoesPix, liquidação SPI)**: 7,122 bi · R$ 2,957 tri.
- **Gap medido: −9,3% em quantidade e −15,0% em valor** = transações liquidadas fora do SPI (nos livros
  dos participantes). Decisão: **séries e KPIs usam o MPV (universo completo)**; composições
  (natureza, idade, forma de iniciação, finalidade, região) usam a base transacional **com a cobertura
  declarada ao lado** (~91% da quantidade). Nunca misturar os dois num mesmo gráfico sem rótulo.

## 3. Indisponível na fonte pública (declarar, não estimar)
- Lado **pagador** por seção CNAE (a EPAE pública detalha a CNAE do recebedor; o pagador aparece só como PF/PJ/G via naturezarel) → matriz completa pagador×recebedor por setor **impossível**; entregamos a visão por setor recebedor com origem PF/PJ/Governo.
- Pix Cobrança e transações agendadas como séries próprias → sem recurso público; QR dinâmico (QRDN) é o proxy observável de cobrança — rotulado como proxy, não como "Pix Cobrança".
- "Usuário ativo" → inexistente oficialmente; usamos "usuários cadastrados no DICT" (estoque) e nunca chamamos de ativos. Chave ≠ usuário (uma pessoa tem várias chaves) — razão chaves/usuário sempre rotulada.
- Mapa municipal coroplético (malha de 5.570 polígonos ~2-5 MB) → fase 2; entregamos ranking/tabela municipal com busca por UF.
- Uso de dinheiro em espécie → apenas **saques** (MPV trimestral) e vl_dinespec do Pix Saque/Troco; declarado como proxy parcial.

## 4. Cautelas metodológicas aplicadas (da spec + achados)
1. Pix não é categoria homogênea: seções separam P2P/P2B/B2B/G — nunca "Pix substitui X".
2. Cartão de crédito = pagamento + financiamento; comparações sempre em 3 lentes (quantidade, valor, tíquete), nunca uma conclusão única de substituição.
3. TED: tíquete ~R$ 65 mil (65.541 mil transações × R$ 3,8 tri em 202605) — comparada por lente, com nota.
4. Regra temporal: mensal só para instrumentos mensais (Pix, TED, TEC, Boleto, Cheque, DOC); comparação completa em trimestres, agregando mensais por SOMA (nunca interpolando trimestrais).
5. Estoques (usuários, chaves, cartões ativos) nunca somados no tempo; sempre fim de período.
6. Ausência = null (DOC/TEC zerados após descontinuação são zeros REAIS da fonte; meses sem dado ficam null).
7. Valores nominais e reais (IPCA) separados e rotulados; acumulado 12m disponível.
8. MED: "contestação" ≠ "fraude confirmada"; usamos exatamente os campos oficiais (contestados, aceitas, devolvidos, % devolução) e a marcação de fraude aparece como "usuários/chaves com marcação de fraude" (conceito DICT).

## 5. Modelo silver
```
mp_mensal      (anomes, instrumento, qtd_mil, valor_mi)          ← MPV mensal 2015-01+
mp_trimestral  (tri, instrumento, qtd_mil, valor_mi)             ← MPV trimestral
pix_tx         (anomes, pag_pfpj, rec_pfpj, pag_regiao, rec_regiao, pag_idade, rec_idade,
                forma, natureza, finalidade, valor, qtd)         ← base transacional 2020-11+
pix_mun        (anomes, cod_ibge, municipio, uf, regiao, vl/qt × pag/rec × pf/pj, qt_pes_*)  ← 14 meses
pix_dict       (data, pf, pj, total)                             ← estoque
pix_chaves     (data, ispb, nome, natureza, tipo, qtd, segmento) ← estoques (últ. + 12m antes)
pix_med        (anomes, 24 campos oficiais)                      ← MED completo
pix_cnae       (anomes, cnssecao, naturezarel, finalidade, mei, qtd, valor, vl_compra, vl_dinespec, qt_recebedor) ← EPAE agregada
spi_diario     (data, quantidade, total)  · spi_intradia (horario, qtd_media, total_medio)
spi_disp       (database, indice, minimo)
```
Regra anti-dupla-contagem: cada gold parte de UMA tabela; MPV nunca somado com base transacional.

## 6. Plano
F1 (este ciclo): coletores + silver + gold `pix.json` (+ `pix_mun.json` lazy) + página completa (10 seções,
com indisponibilidades declaradas) + catálogo de métricas + testes de reconciliação + deploy.
F2: malha municipal, MDR/intercâmbio, remuneração conta PI, histórico de chaves por tipo (série), Sankey EPAE.
