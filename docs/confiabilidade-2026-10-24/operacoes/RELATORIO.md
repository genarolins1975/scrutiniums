# Recuperação da confiabilidade — relatório de 24/10/2026

**Situação: correções demonstradas em quatro PRs; recuperação operacional ainda não homologada.** Nenhum PR desta missão foi integrado à main, nenhum dado foi publicado e nenhuma notificação real foi enviada.

Base auditada: `7d4c2ee77282c0d6c22fd3902869b9d2ac82cd7f`. O ambiente original e os arquivos de Famílias do usuário foram preservados.

## Atualização: homologação contra as fontes reais (24/10/2026, 10:30 a 12:30 UTC)

Nesta segunda etapa a rede alcançou BCB, Tesouro, IBGE (SIDRA), ANEEL, ONS, Open-Meteo e os logs e artefatos do GitHub. CCEE, DJEN e o endpoint `servicodados` do IBGE continuaram recusando. Os bloqueios de rede 1 e 2 da lista abaixo deixaram de valer para esta sessão. Nenhum PR foi integrado, nenhum dado publicado e nenhuma notificação enviada.

| Domínio | O que a fonte real mostrou | Estado | Depende de |
|---|---|---|---|
| Setor Elétrico | As 9 falhas da candidata retida foram reproduzidas. Causa principal: o SIGA diário da ANEEL de 23/10 deixou de trazer CNPJ dos proprietários (0 de 25.058 linhas), o que explica 5 delas. As demais: tarifas com vigência encerrada e troca de sigla, chuva prevista negativa no Open-Meteo, um texto acima de 40 palavras, teste do PLD sem o caso de quatro valores iguais (corrigido no [PR #376](https://github.com/genarolins1975/scrutiniums/pull/376)) | Retenção correta; gold ainda em 30/09 e 01/10 | Quatro decisões do dono ([detalhe](../energia/README.md)) |
| RTN | Agosto/2026 publicado em 29/09; identidades com resíduo zero; IPCA de agosto pelo SIDRA = 7.633,23; retificação de pessoal de julho (R$ 20,1 milhões a menos). O vigia não reconhecia o título real da edição; corrigido no [PR #377](https://github.com/genarolins1975/scrutiniums/pull/377) | Atualização pronta para preparar; snapshot ainda em julho/2026 | Decisão sobre o SIDRA como origem do IPCA; parametrizar a URL no importador ([detalhe](../rtn/README.md)) |
| Crédito | 11 coletores reais: falhas de SGS, DJEN, IF.data e DataJud retidas sem apagar dado. Desenrola com tipo 4 não documentado. Dez grupos parados na main desde 22/10 por um 0,00% que o próprio BCB publica (BCO RNX, semana de 02/10) | Comportamento do PR homologado; coleta completa não homologada | Duas decisões do dono ([detalhe](../credito/README.md)) |
| Notificações | Logs lidos: `BOLETIM_SECRET` vazio no GitHub Actions em 22 de 22 execuções do resumo e 4 de 4 dos alertas, desde 13/10; nenhuma requisição saiu | Causa confirmada no GitHub; Vercel não verificada | O mantenedor cadastrar o secret ([detalhe](README.md)) |

## Tabela executiva (primeira etapa)

| Problema | Causa demonstrada | Correção | Testes | Situação final do domínio |
|---|---|---|---|---|
| Setor Elétrico | Retenção da gold não restaurava CSVs; alerta atribuía data do manifesto aos produtos | Restauração conjunta e datas por produto; status da coleta na meta | 22 testes específicos e verificador rápido | [PR #376](https://github.com/genarolins1975/scrutiniums/pull/376); candidata real ainda retida por outros testes, artefato bloqueado nesta rede |
| Crédito/SGS | Conteúdo inválido podia produzir gravação parcial; erro disparava janela fixa | Validação integral, janelas históricas, transação e tentativas limitadas | Vazios, HTML, esquema, 403/503, timeout, NaN e retificações | [PR #375](https://github.com/genarolins1975/scrutiniums/pull/375); coleta oficial atual ainda não reconfirmada |
| Desenrola | Troca de tabela antes da validação completa; ausência convertida em zero | CSV validado antes da troca, histórico por hash, zero explícito e idempotência | Retenção diante de arquivo inválido, retificação e retorno a versão anterior | Mesmo PR; recurso oficial atual depende de acesso |
| Judicial/DJEN | Falha apagava tribunal; paginação/esquema incompletos aceitos; DataJud repetia tarefas após esgotar orçamento | Retenção por tribunal, fila persistente DataJud e rejeição de consulta incompleta | Independência dos tribunais, 403, esquema, truncamento e duas rodadas com timeout | Mesmo PR; DJEN/TST e alternativas nominais dependem de fonte autorizada, sem contornar WAF |
| RTN | HTTP 200 genérico tratado como nova edição; IPCA encerrava em mês fixo | Confirmação no título e IPCA definido pelo manifesto | 27 testes; 43 meses do IPCA vigente reproduzidos | [PR #377](https://github.com/genarolins1975/scrutiniums/pull/377); ainda julho/2026, edição nova não capturada |
| Notificações | Resumo retornava 200 após falha do provedor; ausência de simulação segura | 502 em falha, orçamento, GET autenticado sem efeitos; monitoramento independente | 50 testes de notificações e 5 de monitoramento | [PR #378](https://github.com/genarolins1975/scrutiniums/pull/378); configuração real de BOLETIM_SECRET não confirmada |

## Evidência

- Energia: [execução 40051919220](https://github.com/genarolins1975/scrutiniums/actions/runs/40051919220), posterior ao merge do [PR #363](https://github.com/genarolins1975/scrutiniums/pull/363), chegou à coleta/preparação e reteve publicação por testes. [Issue #297](https://github.com/genarolins1975/scrutiniums/issues/297#issuecomment-6379519867) lista as falhas. Meta principal em 30/09; arquivos PLD/hidrologia/rede em 30/09, carga/geração/CMO/síntese em 01/10. Não há prova de atualização diária normalizada. [Issue #295](https://github.com/genarolins1975/scrutiniums/issues/295).
- Crédito: [execução 39965904267](https://github.com/genarolins1975/scrutiniums/actions/runs/39965904267) reteve grupos; metadados por grupo conservam Desenrola/Judicial em 18/10 e Pix/outros em 23/10. O bloco de falhas de fontes é de 18/10; não é prova de disponibilidade atual. [Auditoria das oito famílias com falhas](https://github.com/genarolins1975/scrutiniums/blob/codex/confiabilidade-credito/docs/confiabilidade-2026-10-24/credito/fontes-auxiliares.md).
- RTN: snapshot integrado em julho; [issue #304](https://github.com/genarolins1975/scrutiniums/issues/304) registra agosto disponível. O workflow federal de 20/10 atualiza outras bases, não comprova importação RTN. Edição oficial mais recente não confirmada.
- Notificações: [resumo 40042804768](https://github.com/genarolins1975/scrutiniums/actions/runs/40042804768) e [alertas 39982207894](https://github.com/genarolins1975/scrutiniums/actions/runs/39982207894) falharam no passo de envio. Logs bloqueados e API de metadados de secrets sem permissão impedem reconfirmar a causa atual.
- Produção: a leitura anônima de ambas as golds em 24/10 às 09:33 UTC terminou no login, conforme [Energia](producao-energia.json) e [Crédito](producao-credito.json). Isso comprova a barreira de acesso, não o conteúdo recebido com sessão. A política de acesso foi preservada.

## Validação reproduzível

Preparação com `bash scripts/preparar-sessao.sh`, Node 22.23.3, Python 3.12, pyarrow oficial e Chromium do sistema. Cada PR tem comandos, resultados e reproduções de falha no seu diretório de evidências.

`npm run verificar:pr` passou na integração local `c161dfd2fde6866e165098e4c118c2064f1e3a72`: 2.423 testes Python principais e complementares, build, lint, tipos, 68 telas/224 verificações do Judiciário, 385 arquivos Vitest com 9.515 aprovados, 12 skipped preexistentes e 1 todo. Tempo: 18 min 41 s. [Log integral](integracao-completo.txt).

Esse commit reúne as implementações iniciais dos quatro PRs; os complementos posteriores incluem DataJud, reconhecimento do título RTN, diagnóstico das fontes auxiliares e continuação dos lotes de notificação. A suíte Python final de Crédito já passou com 2.417 testes principais, mais 73 de pesquisa e 66 complementares; RTN passou em 27 testes focados; monitoramento em cinco. A revalidação da composição final e o CI de cada cabeça são registrados nas descrições dos PRs. Não se atribui o log anterior a um commit posterior.

`npm run verificar:rapido` passou em cada domínio; [log final de Operações](rapido.txt). Não foram removidos ou enfraquecidos testes para permitir publicação. As falhas sintéticas esperadas aparecem nos logs como parte da prova de retenção.

## Inferências ainda não confirmadas

HTTP 403 registrado no DJEN não demonstra bloqueio geográfico atual. HTML no BCB não identifica sozinho manutenção, WAF ou contrato alterado. Falhas de envio não provam, sem logs/configuração, ausência ou divergência de BOLETIM_SECRET. Julho integrado e agosto mencionado em issue não comprovam qual é a edição oficial mais recente hoje.

## Monitoramento permanente

[Inventário](inventario.json): 373 registros/proveniências, não 373 coleções; três dentro dos prazos existentes, 312 retidos e 58 sem diagnóstico suficiente. Inclui Energia, SGS, grupos críticos, DJEN e falhas auxiliares. Sem fonte consultada, disponibilidade é desconhecida; captura e produção ausentes ficam nulas. Falhas preservadas trazem a data original do registro. Reutiliza SLAs do projeto, sem prazo universal. O workflow gera artefato de 30 dias independentemente de publicação/notificação.

## Bloqueios externos e recomendação

1. Revisar/salvar e publicar a configuração do **ambiente cloud de desenvolvimento**. O rascunho foi salvo; ele não aplica a rede atual nem publica o Scrutiniums. Estão incluídos os hosts oficiais BCB/Tesouro/ONS/ANEEL/CCEE, DataJud/DJEN/TST, Olinda, consumidor.gov.br e os hosts de logs/artefatos do GitHub. O proxy recusou CONNECT a BCB/Tesouro antes de atingir a origem; download do artefato Energia e dos logs também foi bloqueado. Não foram usados relays ou bypass.
2. Com acesso, baixar `energia-retida` da execução indicada e reproduzir Empresas, aliases, RALIE/SIGA, tarifas, PLD, previsão hídrica e malha sem relaxar testes. Capturar e validar dados oficiais; nenhuma execução que escreve na main foi disparada.
3. Capturar a edição RTN oficial e o IPCA correspondente, preservar SHA256/versões, reconciliar agregados e retificações históricas antes de propor dados novos.
4. O mantenedor deve conferir BOLETIM_SECRET no GitHub e no destino pelas interfaces seguras, sem copiar valores para esta auditoria. [Procedimento de simulação](README.md). Envio real permanece fora desta validação.
5. DJEN/TST podem exigir canal oficial autorizado; Pilar 3 precisa de respostas oficiais para investigar endpoint/TLS/esquema; Trends manual depende do arquivo autorizado. Não desativar TLS, transpor WAF ou substituir ausência por dados estimados.

**Critério de sucesso ainda aberto:** demonstrar coleta completa, validação e chegada dos dados novos à candidata de publicação. CI verde nestes PRs não substitui essa prova. Produção só poderá ser homologada depois de autorização e acesso autenticado apropriado.
