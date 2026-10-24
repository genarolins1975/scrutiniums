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
