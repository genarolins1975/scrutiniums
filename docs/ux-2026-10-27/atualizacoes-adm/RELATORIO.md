# Quadro de atualização e tarefas manuais do ADM

27/10/2026. Rotas: `/app/admin` e `/app/admin/atualizacoes`. Base: `8a7cd80b27e5110f0024236fc73ae1fabb61de69`. [Commit da implementação](https://github.com/genarolins1975/scrutiniums/commit/e928326677e20b2fabf9e693ec9d1dc3d1eb7096). Build auditado: `mXMizLsighsc8Sf0SmbFi`.

Interface restrita a administradores. Não houve acesso ao banco de produção, envio de e-mail, merge ou publicação de gold. A entrega prepara a operação; não comprova que as bases retidas voltaram a atualizar.

## Antes, depois e motivo

| Antes | Depois | Por quê |
|---|---|---|
| Administração com uso, cadastro e auditoria, sem quadro operacional | Resumo na entrada e quadro de frescor das 13 áreas | Identificar onde os dados exigem atenção sem visitar cada painel |
| Inspeção de execuções e procura de pendências em documentos/issues | Monitor horário das 23 rotinas; fila ligada à execução/tentativa, issue ou PR | Reduzir inspeção manual e manter o diagnóstico disponível quando a publicação é retida |
| Encaminhamentos fora do ADM | Tarefa com responsável, prazo, nota, conclusão e reabertura; persistência compartilhada | Evitar decisões e integrações sem acompanhamento |
| Crédito/Energia podiam validar sem HTML da candidata | Build obrigatório antes dos testes de HTML; Crédito recompila cada composição | Testar a composição que será publicada, sem aproveitar HTML anterior |
| Regiões de tabela existentes sem acesso por teclado e textos em bronze claro | Região nomeada e focável; contraste com bronze escuro | Permitir percorrer tabelas e ler os estados na entrada do ADM |

[Arquitetura, limites de automação e ativação](ARQUITETURA.md). O catálogo explica por área o que já é automático e o que exige revisão. O procedimento está em `OPERACOES.md`.

## Evidência visual reproduzível

Linha de base: build da main antes da interface, banco PGlite descartável e conta sintética. Capturas completas: [390 px](antes/admin-390.png) e [1440 px](antes/admin-1440.png). A rota nova não existia.

Versão final: [16 capturas e medições das duas rotas](depois/evidencias.md), com e sem sessão, a 320, 390, 768 e 1440 px. [Jornadas e campos preenchidos](jornadas/jornadas.json), [identificador longo a 320 px](jornadas/identificador-longo-320.png) e [texto ampliado](jornadas/texto-200.png). Todas essas imagens vieram do build identificado acima; capturas de rodadas intermediárias não foram apresentadas como resultado final.

Estados sintéticos, separados da consulta observada: [monitor vencido](estados/vencido/evidencias.md), [parcial](estados/parcial/evidencias.md) e [indisponível](estados/indisponivel/evidencias.md), a 390 e 1440 px. A referência de frescor continua vindo dos arquivos publicados; nenhuma falha do monitor transforma ausência em aprovação.

A [consulta real preservada](estado-observado.json) registra o GitHub em 27/10/2026 às 09h15 UTC: 23 rotinas, oito com última execução em falha, quatro aprovadas e 11 sem execução encontrada na main; 16 encaminhamentos abertos, sem erro de consulta. É observação datada, não estado futuro nem garantia de publicação de todos os grupos de cada rotina.

## Comandos e resultados

| Comando / rotina | Resultado |
|---|---|
| `npm run verificar:rapido` | Aprovado: lint, tipos, cobertura e 2.621 testes em 108 arquivos; seis skips preexistentes. [Log](logs/verificar-rapido.log) |
| `npm run verificar:pr` | Executado integralmente: lint, tipos, contratos, Python, build, cobertura e Judiciário passaram. Vitest: 9.683 aprovados, uma falha, 12 skips e um todo preexistentes. **A rodada completa não ficou verde.** [Log](logs/verificar-pr.log) |
| Python do comando completo | Suíte principal: 2.488 testes, com 11 skips preexistentes; verificações complementares aprovadas |
| Python focado de operação/publicação | 32 testes aprovados. [Log](logs/python-focados.log) |
| `npx vitest run src/tests/graficos-identificacao-browser.test.ts` | Aprovado: oito testes, com worktree congelado; nenhuma asserção ou implementação alterada. [Log](logs/regressao-grafico.log) |
| Rotina de evidências | Duas rotas × quatro larguras × dois estados de sessão; zero violações axe e zero erros de console/overflow indevido |
| `node scripts/evidencias-adm.mjs` | 11 verificações aprovadas na repetição integral; [resultado](jornadas/jornadas.json) |
| Jornada independente | Sete verificações aprovadas; [resultado separado](revisao-independente/jornada.json) |
| Estados adversos do monitor | Seis capturas (três estados × duas larguras), sem violação axe, erro de console ou overflow |

A falha global ocorreu em `graficos-identificacao-browser.test.ts:83`: a amostra inicial do gráfico estava vazia (`expected 0 to be greater than 0`), antes do redimensionamento. Esse teste e o gráfico não foram alterados. A repetição do arquivo completo preserva todas as asserções; não converte a rodada global reprovada em aprovação nem prova que a instabilidade foi eliminada. O CI do PR deve decidir o estado da revisão.

Preparação: `bash scripts/preparar-sessao.sh`; Node com heap de 4 GB, Chromium em `/usr/bin/chromium` e dependências Python em `/workspace/.venv-ux`. Os relatórios não escondem testes preexistentes ignorados pelas próprias suítes. Nenhum teste foi apagado, relaxado ou marcado para pular nesta mudança.

A primeira rodada completa encontrou duas falhas desta implementação: inventário de rotas precisava ser regenerado e nome do monitor acionava o contrato reservado a publicadores de gold. Ambos foram corrigidos. Uma verificação intermediária invalidou a fotografia do worktree por edição simultânea; a rodada completa final manteve os arquivos congelados. A primeira repetição isolada aprovou os oito testes, mas registrou alteração do worktree durante o commit; foi repetida novamente com a árvore congelada. A primeira jornada final excedeu a espera por rede ociosa ao recarregar; a repetição integral passou sem modificar código ou asserções, e a revisão independente confirmou a navegação esperando DOM e controles.

## Matriz funcional e de acessibilidade

| Verificação | Evidência e resultado | Limite |
|---|---|---|
| Sem sessão / conta comum / ADM | Redirecionamento 307; conta comum 404; ADM acessa e grava | Banco e contas locais descartáveis |
| Criação, nota, responsável e prazo | Persistem ao recarregar; conclusão e reabertura funcionam | Sem sincronização em tempo real entre abas |
| Conflito e falha de gravação | Teste de versão retorna 409; falha 503 anuncia erro e preserva texto, nova tentativa salva | Não foi provocada falha no banco de produção |
| Proteção de escrita | API exige ADM e Origin; origem externa rejeitada com 403 | Revisão delimitada, não auditoria completa de segurança |
| Teclado | Tab/Shift+Tab, Enter/Espaço, foco visível e retorno ao filtro conferidos | Não houve teste com leitor de tela |
| Mouse e toque | Abrir, criar, editar e salvar; dispositivo com toque e movimento reduzido ativos | Emulação Chromium, sem aparelho físico |
| Filtros e histórico | URL preserva recorte; voltar, avançar e atualizar mantêm seleção | Chromium local |
| Larguras 320/390/768/1440 | Duas rotas, página inteira; sem overflow indevido; conteúdo longo também conferido | Não cobre todas as combinações de navegador e dispositivo |
| Axe | Zero violações nas capturas WCAG 2.1 A/AA e nos formulários com tags 2.2 AA | Não equivale à verificação integral de WCAG 2.2 AA |
| Contraste, estrutura e estados | Ajustes de bronze; títulos, rótulos, avisos e foco examinados; andamento anunciado | Pronúncia e navegação por leitor de tela não verificadas |
| Texto ampliado | 200% em viewport de 720 px sem overflow | Zoom nativo não verificado; não são testes equivalentes |
| Monitor ausente/parcial/vencido | Ressalva visível, sem aprovação inventada; fila salva preservada pelo modelo | Upload/consulta da primeira release real ainda não executados |

## Revisões e limites

[Revisão independente por agente](REVISAO-INDEPENDENTE.md), com contexto separado e jornada própria. Encontrou dois P2 funcionais — precisão das datas e identidade de reexecuções — corrigidos e reconferidos. As correções visuais também foram reexaminadas. As oito dimensões e seus limites estão no parecer; não há homologação humana ou certificação integral de acessibilidade.

[Revisão documental do sistema visual](DOCUMENTACAO.md): preservados tokens, fontes e shell existentes. Os controles da fila são uma variação local; não se afirma reutilização integral dos componentes de formulário nem se cria nova regra global. O launcher Impeccable não existe neste checkout; as instruções foram lidas diretamente.

O monitor observa o GitHub; sucesso de execução não comprova deploy. A correção do preparo da validação não substitui correções de contrato das fontes. Energia depende da revisão/integração do PR #379 e de publicação efetivamente aprovada. RTN e outras edições com curadoria mantêm seus procedimentos.

Permanecem não verificados: workflow novo na main e release real; migração e operação em produção; futuras golds; Safari/Firefox, zoom nativo, leitores de tela e administradores reais. Notas permanecem no banco administrativo, sem nova política de exclusão automática. A fila orienta a não incluir segredos ou dados pessoais de leitores.
