# Previsão do PLD: disparo externo da rodada diária

## Por que existe

A rodada diária da previsão precisa ser emitida entre o corte das 07h00 e o prazo das 08h00 de Brasília. O cron do GitHub Actions não garante horário. Em 18/10/2026, as cinco execuções agendadas de `previsao-pld.yml` começaram entre 12h48 e 14h08 UTC, ou seja, entre 09h48 e 11h08 de Brasília, todas depois do prazo (API do Actions, consultada em 19/10/2026). Uma rodada atrasada é registrada com o alerta `ATRASADO_APOS_08H` e não conta como rodada no prazo, de modo que a rotina não pode ser comprovada enquanto o disparo depender só do cron.

## Como funciona

Um agendador externo chama a API do GitHub no horário e dispara o workflow com a entrada `agendador=externo`.

| Disparo | `modo` registrado | `gatilho` registrado |
| --- | --- | --- |
| cron do GitHub | agendada | cron do GitHub |
| `workflow_dispatch` com `agendador=externo` e sem `origem` | agendada | agendador externo |
| `workflow_dispatch` com `agendador=manual` | manual | manual |
| `workflow_dispatch` com `origem` informada (rodada retroativa) | manual | manual |

Regras que continuam valendo, qualquer que seja o gatilho:

- a rodada só é emitida depois do corte das 07h00; se o disparo chegar antes, o workflow espera o corte;
- a emissão depois das 08h00 é marcada como atrasada;
- se a rodada do dia já estiver registrada, a execução termina sem emitir;
- os crons do GitHub continuam ativos como reserva.

O gatilho de cada rodada fica no arquivo de emissões (`execucao.gatilho`), junto com a conta do GitHub que acionou a execução (`execucao.acionado_por`) e o endereço da execução (`execucao.run_url`). A gold leva o gatilho de cada rodada (`rodadas[].gatilho`) e a contagem das rodadas agendadas por gatilho (`rotina.agendadas_por_gatilho`). Assim, quem audita vê quais rodadas vieram do agendador externo e quais do cron.

**Limite da garantia.** O GitHub só aceita `workflow_dispatch` de quem tem permissão de escrita no repositório, e a entrada `agendador=externo` não autentica o agendador: uma pessoa com essa permissão também pode escolhê-la. Com um token pessoal, a conta registrada em `acionado_por` é a mesma do dono do repositório. A rodada externa é, portanto, atestada pelo dono, não autenticada de forma independente. Separar as identidades exigiria uma conta ou uma GitHub App exclusiva do agendador, cujo token gera um ator próprio em `acionado_por`.

## Configuração (feita pelo dono do repositório)

1. **Token.** Criar um token *fine-grained* do GitHub com acesso só ao repositório `genarolins1975/scrutiniums` e permissão **Actions: Read and write**. Nenhuma outra permissão é necessária. Guardar o token só no agendador; ele não entra no repositório.
2. **Agendador.** Em qualquer serviço que faça uma requisição HTTP em horário fixo, criar uma tarefa diária no fuso America/Sao_Paulo às **06h50** e, de reserva, uma segunda às **07h20**:
   - método: `POST`;
   - endereço: `https://api.github.com/repos/genarolins1975/scrutiniums/actions/workflows/previsao-pld.yml/dispatches`;
   - cabeçalhos: `Accept: application/vnd.github+json`, `Authorization: Bearer <token>`, `X-GitHub-Api-Version: 2022-11-28`;
   - corpo: `{"ref":"main","inputs":{"agendador":"externo"}}`.
3. **Conferência.** A resposta esperada é `204`. Na aba Actions, a execução aparece como `workflow_dispatch`. No arquivo de emissões, a rodada traz `"modo": "agendada"` e `"gatilho": "agendador externo"`.

A segunda tarefa, às 07h20, só emite se a primeira não tiver registrado a rodada: as execuções ficam na mesma fila (`concurrency: previsao-pld`) e conferem o arquivo antes de emitir.
