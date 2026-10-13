# Validação das pendências da candidata v3

Base: `main` em `f1e6cece305ac72ab8554330721b5dd49cad1622` (PR #158). Em 13/10/2026 UTC, antes das alterações, `git log --oneline -5` confirmou esse commit. Checkout raso obtido pela conexão GitHub; árvore integral reconciliada com o SHA Git `57a47ed399b24e6390242f8bdae75c0155c90b99`. Branch: `codex/obee-v3-pendencias`.

Parecer lido: anexo do usuário `Texto colado(20261013-002844).txt`, intitulado “Parecer técnico cruzado: OBEE, candidata v3”, com adendo de 13/10/2026. Não incorporado aos pareceres humanos do pacote.

## Base, antes das correções

Ambiente: macOS arm64, Python 3.12.13, Node 25.9.0, Next 14.2.35, Vitest 4.1.10. O CI usa Python 3.12 e Node 22; a validação remota continua necessária.

| Verificação | Resultado |
|---|---|
| `python3 -m unittest discover -s pipeline/tests -t .` | Primeira execução: 1.514 testes, 69 erros e 1 falha por ausência de PyArrow; 6 ignorados. Reexecução com PyArrow 24 do cache local: **1.608 testes, OK, 6 ignorados** |
| `python3 -m unittest discover -s pesquisa/tests -t .` | **69 testes, OK** |
| Onze módulos `pipeline.eficiencia_resultados.test_*` do CI | **66 testes, OK** |
| Auditor, sensibilidade pareada e robustez ampliada | **20 testes, OK** |
| `npm run lint` | **OK** |
| `npx tsc --noEmit` | **OK** |
| `npm run build` | **OK** |
| `EXIGIR_BUILD_HTML=1 npx vitest run` | **211 arquivos; 4.715 testes aprovados, 1 ignorado** |
| Integridade congelada | **54/54 SHA-256 conferem** |

O build/setup materializou `public/eficiencia/trabalho-renda/snapshot.json` e alterou seus bytes versionados, reproduzindo M4. A alteração produzida pela validação foi restaurada antes da implementação. Nenhuma falha metodológica foi mascarada como ajuste de ambiente.

Os complementos não resolvem a precisão municipal: erros e intervalos seguem ausentes. Pesos, coorte, referência temporal, pareceres e travas permanecem os da edição congelada. Sem merge ou deploy.

## M4: materialização sem escrita em arquivo versionado

`snapshot.json` é agora saída derivada, ignorada pelo Git, reconstruída do mesmo `snapshot.payload.gz.b64` canônico. O payload, seu hash esperado e os brutos permanecem intactos. O JSON anteriormente versionado tinha diferenças nos metadados `indicadores`, o que acionava a reescrita; não era mera diferença de espaços. O prebuild continua gerando o mesmo conteúdo servido em produção. O arquivo gerado só é escrito quando os bytes diferem, como antes.

A configuração Vitest não importa mais o materializador como efeito lateral. O setup global captura `git status` e hashes dos diffs antes da materialização e devolve uma verificação executada depois de toda a suíte. Ela detecta inclusive nova edição num arquivo que já estava modificado antes dos testes. Um repositório temporário nos testes exercita modificações, exclusões, arquivos novos e mudanças do índice. O CI exige também árvore limpa ao terminar build e testes.

## Validação final local, 13/10/2026 UTC

| Verificação | Resultado |
|---|---|
| Python: pipeline / pesquisa / módulos OBEE | **1.608 (6 ignorados) / 69 / 66, todos OK** |
| Auditor, pares e robustez ampliada | **20 testes, OK** |
| Complemento de precisão / renda | **7 / 4 testes, OK**, ambos geradores com `--check` |
| `npm run lint` e `npx tsc --noEmit` | **OK** |
| `npm run build` | **OK** |
| `EXIGIR_BUILD_HTML=1 npx vitest run` | **212 arquivos; 4.718 aprovados, 1 ignorado; OK** |
| Pós-suíte | **`git status --porcelain` vazio**, verificador global aprovado |
| Pacote, manifesto, pareceres, status e travas | **54/54 hashes intactos**, arquivos protegidos sem diff |
| Reconciliação aritmética e HTML | Saídas atuais dos geradores; o único ajuste na reconciliação é o hash do HTML após a ressalva de renda |

A primeira invocação local automatizada da comparação do auditor tratou o pipe do CI como argumento; foi reexecutada com comparação JSON equivalente. Essa comparação identificou o hash antigo do HTML, atualizado pelo gerador no artefato complementar. Não houve alteração aritmética. A validação do CI remoto e seu SHA serão registrados no PR.

Pendências explícitas: erro municipal oficial ainda não obtido; decisões editoriais e acesso institucional não realizados; nova edição do pacote apenas proposta; página impressa da SIS 2018 não obtida por falha de acesso ao PDF, embora conceito e catálogo oficiais tenham sido localizados. Essa limitação documental de R1 não é apresentada como tarefa integralmente resolvida.
