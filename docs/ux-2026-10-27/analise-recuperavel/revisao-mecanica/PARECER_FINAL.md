# Confirmação mecânica independente final — frente 3

27/10/2026. Commit: `32db0c3d24e17e207ce913555dfabd9a57de31b9`. Build renderizado: `zdkU37XJIzk4uJJiZ55kv`.

**Este parecer supera as conclusões intermediárias da revisão mecânica.** Depois da primeira rodada residual, foi reproduzida uma falha adicional: com o consumo focado em 600 kWh, voltar no navegador restaurava 450 kWh na URL e no resultado, enquanto o campo ainda mostrava 600. Esse achado impedia considerar fiel a recuperação pelo histórico. A correção foi agora conferida em navegador, sem alterar o checkout.

| Before | After verificado | Evidência |
| --- | --- | --- |
| Voltar mantendo foco deixava o campo com 600, embora URL e cálculo fossem de 450 kWh. | Voltar restaura 450 no campo e na URL, com o resultado de R$ 367,97; o campo continua focado. | Consulta pública e painel autenticado, português e inglês, 390 px. |
| Avançar precisava continuar coerente após a restauração. | Avançar restaura 600 no campo e na URL, mantendo o foco e o resultado correspondente. | Mesmas quatro jornadas, sem blur entre edição e histórico. |
| Dois links da Minha conta apresentavam contraste insuficiente na auditoria de página inteira. | Axe não encontrou violações na página inteira em 390 e 1440 px. | `axe.run(document)` com regras WCAG 2 A/AA, 2.1 A/AA e 2.2 AA disponíveis. |

**Conclusão dentro do escopo testado:** a regressão do campo focado foi corrigida. Não restou divergência conhecida entre campo, URL e resultado nas jornadas de recuperação examinadas. A confirmação final do contraste cobre a página Minha conta inteira, não apenas a lista de recortes.

Esta é uma confirmação residual: as jornadas mais amplas de salvar, copiar, citações, recuperação e passagem pública→autenticada estão documentadas nos pareceres anteriores com seus respectivos commits/builds. Não foram repetidas integralmente nesta rodada. Não se declara conformidade integral WCAG: leitor de tela, zoom nativo e dispositivo físico continuam não verificados. O acabamento textual menor do estado de distribuidora inexistente permanece documentado no parecer residual anterior, sem substituição indevida de valores.

## Reprodução

Roteiro independente: `/tmp/analise-confirmacao-foco-final.mjs`.

Cada caso abre Recife/Neoenergia PE com 450 kWh; muda a distribuidora na consulta pública ou a classe no painel autenticado, criando uma entrada no histórico; digita 600 kWh e mantém o campo focado; aciona `history.back()` e `history.forward()` sem blur; confronta URL, texto visível, foco e resultado.

Resultados completos em `confirmacao-final.json`; execução em `execucao.log`; capturas `foco-{pt,en}-{com,sem}-sessao.png` e `minha-conta-{390,1440}.png`. Os oito movimentos de histórico das quatro jornadas passaram. Axe retornou zero violações nas duas larguras da Minha conta.

Todos os servidores e navegadores locais foram encerrados. Nenhum arquivo do repositório foi alterado pelo revisor.
