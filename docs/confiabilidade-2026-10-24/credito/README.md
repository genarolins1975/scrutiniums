# Crédito: retenção íntegra dos coletores

Base examinada: main `7d4c2ee77282c0d6c22fd3902869b9d2ac82cd7f`, em 24/10/2026. Nenhuma publicação ou envio de mensagem real foi executado.

## Evidência

- [Execução de 23/10](https://github.com/genarolins1975/scrutiniums/actions/runs/39965904267): falhou em “Sinalizar publicação retida”. A gold publicada contém grupos novos em 23/10 e Desenrola/Judicial preservados com metadados do grupo em 18/10. Não é falha global de publicação.
- `public/obs/data/gold/meta.json` registra respostas não JSON no SGS, HTML no Desenrola, HTTP 403 no DJEN e desafio WAF HTTP 202 no TST. A hipótese de indisponibilidade ou bloqueio do provedor não foi reconfirmada nesta rede: o proxy local recusou CONNECT antes de chegar às fontes.
- Regressões reproduzidas sem rede: [SGS e Desenrola antes](antes.txt), [DJEN antes](djen-antes.txt). Dados inválidos eram aceitos ou apagavam linhas anteriores. O commit do orquestrador depois da exceção consolidava a perda.

## Correção

1. SGS valida conteúdo, esquema, datas reais, valores finitos e duplicatas conflitantes antes da gravação. Uma série só é instalada após todas as janelas; revisões usam a tabela existente. A série diária é dividida em intervalos menores que dez anos, preservando o início histórico; nenhum erro dispara o fallback fixo para 2019.
2. Desenrola valida todo o CSV antes de trocar o estado. Zero precisa ser explícito; mês inválido, quantidade negativa, volume não finito, duplicata e desaparecimento de mês retêm a versão anterior. Savepoint protege a troca e a linhagem. `desenrola_historico` preserva valores por hash, além do bronze imutável; retorno a um hash antigo também é aplicado corretamente.
3. DJEN e credores fazem troca atômica por tribunal. HTTP 403 e esquema sem `items` não apagam processos. Paginação truncada é retida; todas as páginas válidas ficam no bronze e na linhagem. Tribunal acessível pode atualizar independentemente dos demais.
4. HTTP registra código, causa e número de tentativas. Não repete 401/403 nem outros erros permanentes de requisição. Timeout, 408, 429 e 5xx mantêm tentativas limitadas, com espera exponencial sem pausa depois da última tentativa.

Nenhuma fórmula, taxonomia processual, política de acesso ou fonte foi substituída. DataJud sem partes não substitui nominalmente DJEN/TST; não foi tentado contornar bloqueios.

## Testes

`python -m unittest pipeline.tests.test_coleta_credito_integridade pipeline.tests.test_publicar_gold pipeline.tests.test_sicor_rural`: 54 testes aprovados. Casos incluem resposta vazia, esquema alterado, HTML, HTTP 403, timeout, HTTP 503, data impossível, NaN, número negativo, retificação, idempotência e independência dos tribunais. A suíte existente de publicação por grupo foi preservada.

`npm run verificar:rapido`: aprovado ([log](rapido.txt)). `npm run verificar:pr`: aprovado em 18 min 21 s ([log integral](completo.txt)): 2.411 testes da suíte Python principal, suítes complementares, lint, tipos, build, 68 telas/224 verificações do Judiciário e 384 arquivos Vitest (9.506 aprovados, 12 ignorados preexistentes e 1 todo). Nenhum teste foi removido ou enfraquecido. [Testes específicos](testes.txt).

## Limites e próximo passo

A normalização da coleta viva de SGS/Desenrola e a verificação das alternativas oficiais judiciais dependem de acesso às fontes. Os domínios foram incluídos no rascunho de rede do ambiente, ainda sujeito a publicação da configuração. Não se declara série atualizada nem defeito do provedor resolvido por estes testes. É necessária uma coleta real e sua validação antes de aprovar dados novos para produção. Conteúdo inválido permanece retido, com erro explícito.

## Complemento: DataJud e demais fontes

A revisão das falhas auxiliares encontrou fila fixa que adia reiteradamente os mesmos tribunais e publicação de consulta paginada incompleta. [Antes](datajud-antes.txt): cinco testes, oito falhas em subcasos. Agora a fila persistente prioriza tarefas nunca tentadas/mais antigas, mesmo após erro, e o funil dispõe de um terço do orçamento existente de 900 segundos antes da coleta de séries. Esquema ausente, total inexato/inconsistente, cursor ausente, paginação truncada e todos os documentos sem data válida retêm a série. HTTP 401/403 não é repetido. Não altera metodologia de contagem, classes ou calendário.

[Depois](datajud-depois.txt): 27 testes aprovados (seis novos, mais as regressões de resposta parcial e integridade de Crédito). [Verificador rápido final](rapido-final.txt): aprovado, mantendo também o teste existente do orçamento. O log completo acima corresponde à implementação anterior a este complemento; a suíte Python final e a validação de integração são identificadas separadamente.

[Inventário das oito famílias com falha e limitações](fontes-auxiliares.md). As respostas de Pilar 3 e do TST e o arquivo manual Trends continuam dependendo de fonte/arquivo autorizado; não foram substituídos por estimativa ou fonte incompatível.

Complemento DataJud: `npm run verificar:pr -- --etapas compileall,python` aprovado em 4 min 04 s, com toda a suíte Python e complementares. [Log final](python-final.txt).

## Homologação contra as fontes reais (24/10/2026, 10:38 a 12:26 UTC)

O bloqueio de rede da primeira auditoria deixou de valer. O código deste PR (`ca5880e9`) rodou contra as fontes reais em diretório isolado, partindo do estado durável público de 23/10/2026 16:24 (release `pipeline-estado.20261023162440`, sha256 conferido pelo manifesto). Foram executados 11 dos 55 coletores, os de maior risco, em 61 minutos; os outros 44 reaproveitaram o silver de 23/10. Nada foi publicado e o diretório foi restaurado ao fim.

**Evidência por fonte**

| Fonte | Resposta (UTC) | Publicado na main | Coletado | Decisão do validador |
|---|---|---|---|---|
| SGS, 142 séries | 200, com dois 502 repetidos com sucesso; 10:38 a 10:43 | 08/2026 (inadimplência 21082 = 5,04%) | 08/2026, sem observação nova nem revisão | 139 aceitas; 3 retidas (20714, 432 e 28207) por HTML com HTTP 200, que minutos depois veio em JSON |
| Desenrola | 10:43: HTML "Requisição inválida!" com HTTP 200 | data base 06/2026 | Às 12:23, CSV válido com tipos 1 a 3 até 08/2026 (13.638 linhas, sha256 `14b4deec...`) | Retido de qualquer forma: 2.396 linhas de 05/2026 a 08/2026 têm `TIPO_DESENROLA` 4, e a documentação do BCB (alterada em 11/09/2026) descreve só os tipos 1, 2 e 3 |
| DJEN, recuperação judicial e credores | 16 respostas 403 do CloudFront | sem fichas | nada | Retido por tribunal; nada apagado; WAF não contornado |
| Pix (Olinda) | 200 | 09/2026 | 09/2026; SPI diário até 22/10 | Aceito, inalterado |
| SCR.data | 200 | 08/2026 | 08/2026 | Aceito, inalterado |
| IF.data OData | 15 respostas 500 "Erro desconhecido" | 06/2026 | nada | Falha; silver preservado |
| DataJud, funil (8 tribunais) | 200 | 14.841 documentos (coleta de 28/07) | 15.592 documentos | Aceito |
| DataJud, recuperação judicial TJSP | 200, com 504 e 429 repetidos | soma 2019 a 2026 = 2.332 | 2.334; seis meses revistos | Aceito |
| DataJud, falência TJSP | 200 nas 15 páginas | soma = 2.029 | truncada em 15.000 de 30.485 documentos | Retida como paginação incompleta |
| DataJud, demais 14 pares tribunal e classe | não consultados | | | Adiados pelo orçamento de 900 s (a tarefa do TJSP levou 1.562 s) |

**Portão de publicação** (os mesmos testes do workflow, sobre a coleta real): 47 grupos seriam publicados e 12 retidos. Os 12 retidos são os que já estão parados na main desde 18/10 (`desenrola`, `judicial`) e 22/10 (os outros dez); nenhum foi retido por este PR. Dez deles param no teste `credito-consultas.test.ts`, que exige que "Quanto meu banco cobra?" nunca mostre 0,00% ao ano. A fonte publica 0,00% ao mês e ao ano para o BCO RNX S.A., posição 1 em crédito pessoal não consignado prefixado, semana de 02/10 a 08/10/2026 (Olinda `TaxasJurosDiariaPorInicioPeriodo`, consultado às 12:25 UTC, sha256 `72b8820f...`).

**Inferência.** O PR se comportou como projetado diante das falhas reais: nenhum dado íntegro foi apagado e nenhuma resposta inválida foi gravada. A coleta real do Crédito **não está homologada por completo**: Desenrola, DJEN, IF.data OData e 14 pares do DataJud não trouxeram dado novo. Sobre o cabeçalho `Accept` do Desenrola, a evidência é inconclusiva: às 10:43 `application/json` devolveu HTML e `*/*` devolveu CSV, mas às 12:23 os dois devolveram o mesmo CSV em seis tentativas ([registro](desenrola-accept-1223utc.txt)). O agregado judicial de 06 a 08/2026 soma só os tribunais já coletados no mês; isso é anterior a este PR, mas pode sugerir queda que não houve.

**Decisões pendentes do dono**

1. Desenrola tipo 4: aguardar a documentação do BCB (com consulta formal) ou publicar os tipos 1 a 3 até 08/2026 declarando o tipo 4 fora do recorte.
2. Taxa de 0,00% publicada pela fonte: exibir como publicada, com ressalva, ou tratar como valor a confirmar com o BCB. Hoje trava dez grupos.
3. Endurecimentos opcionais neste PR: uma nova tentativa limitada quando o SGS responder HTML com HTTP 200; `Accept: */*` no download do CSV do Desenrola; cobertura por tribunal declarada no agregado judicial.
