# Ações judiciais e instituições financeiras — auditoria de viabilidade (Fase 0)

Auditoria executada em 2026-08-02 chamando cada endpoint. **Conclusão que determina todo o
desenho do módulo: não existe fonte pública nacional que atribua processos judiciais a uma
instituição financeira identificada.** O que segue é a evidência.

## 1. Fontes que identificam nominalmente os litigantes

| Fonte | Teste | Resultado |
|---|---|---|
| **TST — Ranking das Partes** (tst.jus.br/web/estatistica/tst/ranking-das-partes) | ✓ HTTP 200, `robots.txt` permite (`User-agent: * / Allow: /`) | **ÚNICA fonte nominal viável.** Tabela HTML com os 10 maiores litigantes do mês em casos novos no TST. Junho/2026: Correios (3.921), Petrobrás (2.804), **Bradesco (2.790)**, Casas Bahia (2.661), **Itaú Unibanco (2.269)**, **Caixa (2.199)**, **Santander (2.011)**, Estado de SP (1.814), **Banco do Brasil (1.648)**, União (1.496). Cinco IFs entre as dez maiores. |
| **CNJ — Painel de Grandes Litigantes** | ✗ **HTTP 503** em `grandes-litigantes.stg.cloud.cnj.jus.br` (URL de *staging* publicada no site do CNJ); sem API documentada, sem arquivo para download | **NÃO INTEGRÁVEL.** Painel instável e sem camada de dados aberta. Reavaliar quando publicado em domínio de produção com dados abertos. |
| Bases nominais de TJs/TRTs | consulta processual exige número do processo e, em vários tribunais, CAPTCHA | **NÃO INTEGRÁVEL** (e coleta em massa contraria os termos de uso). |
| Agregadores jurídicos comerciais | — | **NÃO USADOS**: exigiriam licença; a especificação os proíbe como fonte primária sem licença e validação. |

## 2. Fonte com metadados processuais (sem partes) — DataJud

Consulta real a `api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search` retornando o documento
completo. **Campos existentes**: `id`, `tribunal`, `grau`, `numeroProcesso`, `dataAjuizamento`,
`nivelSigilo`, `orgaoJulgador` (com `codigoMunicipioIBGE`), `classe` (código + nome), `sistema`,
`formato`, `dataHoraUltimaAtualizacao`, `movimentos[]` (código, dataHora, nome, complementos),
`assuntos[]` (código + nome).

**Campos de parte: inexistentes.** Busca literal no documento por `parte`, `polo`, `cpf`, `cnpj`,
`litigante`, `requerente`, `requerido`, `autor`, `réu` → todos ausentes. Logo **é tecnicamente
impossível atribuir um processo do DataJud público a uma instituição financeira**, e igualmente
impossível distinguir polo ativo de polo passivo. Qualquer atribuição por inferência seria
invenção — e não foi feita.

### Armadilha das datas (confirmada)
`date_histogram` sobre `dataAjuizamento` devolve buckets nos anos **2609–2612**: processos migrados
do SAJ gravam a data como `yyyyMMddHHmmss`, que o índice lê como *epoch-millis*. Um `range` com
`format` explícito só alcança o subconjunto ISO-8601 (ex.: assunto 9607 no TJSP, 2025 → 1.261 de um
universo na casa dos milhões). **Consequência**: contagens por assunto (sem recorte temporal) são
confiáveis; séries temporais exigiriam baixar e reinterpretar as datas localmente, documento a
documento — fora do escopo desta fase e declarado como lacuna.

## 3. Taxonomia TPU descoberta empiricamente
Não presumimos códigos: foram obtidos por agregação sobre os índices reais.

**Cível (TJSP)** — revisionais: 9607 Contratos Bancários · 14926 Revisão de Juros Remuneratórios.
Capitalização/Anatocismo · 10585 Capitalização/Anatocismo · 10586 Limitação de Juros · 11807 Tarifas ·
11974 Cláusulas Abusivas · 6007 Repetição de indébito · 11806 Empréstimo consignado · 7772 e 9585
Cartão de Crédito · 7773 Financiamento de Produto · 4960 Cédula de Crédito Bancário · 7770
Interpretação/Revisão de Contrato. **Indenizatórias**: 7779 Dano Moral · 7780 Dano Material · 11811
Práticas Abusivas. **Garantias e cobrança promovidas pela IF (mantidas SEPARADAS)**: 9582 Alienação
Fiduciária · 9584 Arrendamento Mercantil · 4970 Cheque.

**Trabalhista (TRT2)** — os TRTs usam vocabulário próprio (o código 7752 "Bancários" do TJSP retorna
zero na JT): 13994 Aviso Prévio · 13998 Multa de 40% do FGTS · 14000 Multa do art. 477 · 13999 Multa
do art. 467 · 13769/13787/13799 Horas Extras e adicionais · 13772 Intervalo Intrajornada · 13875
Adicional de Insalubridade · 13968 Rescisão Indireta · 13719 FGTS · 13970 Verbas Rescisórias.

## 4. Denominadores para normalização
Disponíveis no projeto: ativo total, carteira de crédito, patrimônio líquido, lucro (IF.data/CVM).
**Indisponíveis**: número de clientes, de empregados e de agências — logo as métricas "por 100 mil
clientes", "por mil empregados" e "por agência" **não são calculadas** e aparecem como indisponíveis,
sem estimativa silenciosa.

**Provisões cíveis e trabalhistas por IF**: a CVM estruturada traz apenas "Provisões" agregado
(contas 2.03/2.04); a quebra por natureza vive nas notas explicativas em texto livre. Não integrada —
extraí-la exigiria parsing de texto com risco de erro material.

## 5. Desenho aprovado (duas camadas que nunca se cruzam)
- **Camada A — Litigiosidade bancária no país (DataJud, SEM instituição)**: volume por assunto e
  tribunal, taxonomia cível e trabalhista, casos únicos × registros (cardinalidade sobre
  `numeroProcesso`), distribuição geográfica. Rotulada em toda a interface como *não atribuível a
  instituição*.
- **Camada B — Grandes litigantes nominais (TST)**: os dez maiores do mês, com as IFs identificadas
  por resolução de entidades revisada manualmente, e normalização pela escala (ativo/carteira).
  Rotulada como *apenas TST, apenas top-10, apenas casos novos do mês*.

Nenhuma das duas é apresentada como "processos do banco X no Brasil", porque esse número não existe
publicamente.

## 6. O que seria necessário para cobertura nacional por instituição
1. Publicação, pelo CNJ, do Painel de Grandes Litigantes em domínio de produção **com dados abertos**
   (CSV/API) — hoje é um painel de staging fora do ar.
2. Inclusão de um identificador de parte pessoa jurídica (CNPJ raiz) no DataJud público, ainda que
   restrito a PJ e sem dados de pessoas naturais — juridicamente viável, já que CNPJ de PJ não é dado
   pessoal, e suficiente para toda a análise deste módulo.
3. Alternativamente, convênio ou licença com os tribunais para acesso nominativo a PJ, com contrato
   que permita publicação de resultados agregados.
