# Revisão da sincronização entre controles — 27/10/2026

A [revisão automática do PR #398](https://github.com/genarolins1975/scrutiniums/pull/398#discussion_r4391537072) identificou um defeito real: editar consumo e trocar distribuidora enquanto a digitação aguardava gravação fazia a primeira ilha ignorar também município e distribuidora. Ao terminar a espera, seu estado antigo sobrescrevia a escolha mais recente.

## Reprodução antes e depois

Dois testes novos falharam no código anterior, sem erros de console: consumo 600 conservava distribuidora/município antigos; uma edição antiga de 600 não absorvia a edição mais recente de 750, com espera menor. O [log anterior](logs/concorrencia-antes.log) conserva os resultados.

`useEstadoUrl` passa a conservar apenas os campos com edição pendente. Os outros campos absorvem a URL atual. As revisões são transmitidas pelo nome do parâmetro, inclusive quando dois esquemas usam nomes locais distintos. Uma edição mais recente do mesmo parâmetro substitui a pendente; se não restar campo pendente, o timer é cancelado. Voltar/avançar descarta as pendências e restaura a URL. Voltar ao valor padrão também avisa as outras ilhas quando a URL já representa esse valor.

| Jornada no Chromium, com o hook real | Resultado após a correção |
|---|---|
| Consumo pendente + distribuidora/município alterados em outra ilha | Seleção conservada, inclusive no link capturado antes do timer e após recarregar |
| Mesmo parâmetro editado em duas ilhas, com timers em ordem inversa | A edição mais recente prevalece após ambos os prazos |
| Retorno ao padrão em outra ilha, sem mudança necessária na URL | Edição antiga cancelada; link capturado inclui o padrão correto |
| Voltar enquanto há consumo pendente e depois avançar | Timer descartado; campos compartilhados restaurados pelo histórico |

As asserções verificam estado, valores e endereço, sem fixar texto editorial. Os testes anteriores de busca, tanque, Ideb e cópia recusada permanecem intactos.

## Verificações

- `I18N_CHROMIUM_EXECUTABLE=/usr/bin/chromium npx vitest run src/tests/analise-recuperavel-browser.test.ts src/tests/analise-recuperavel.test.ts src/tests/energia-comp-estado-url.test.ts`: 50 testes aprovados, incluindo oito jornadas de navegador. [Log](logs/concorrencia-depois.log).
- `npm run verificar:rapido`: 4.362 testes aprovados em 132 arquivos; 7 skips e 1 todo preexistentes. Tipos, derivados e cobertura bilíngue aprovados. [Log](logs/concorrencia-rapido.log).
- O warning da referência ao Set no cleanup foi eliminado capturando a instância estável no efeito; `npm run lint` repetido, sem warnings. [Log](logs/concorrencia-lint.log).
- A repetição da suíte completa e os checks do commit destinado ao merge são registrados no [PR #398](https://github.com/genarolins1975/scrutiniums/pull/398). Os resultados históricos do README continuam atribuídos aos commits em que foram executados.

Não houve alteração de cálculo, dados, acesso, contrato visual ou exigência dos testes existentes. A fixture de navegador reproduz ilhas de componentes; a página completa continua exigindo as jornadas de integração documentadas no relatório principal. Os limites de acessibilidade e de produção autenticada registrados ali permanecem.
