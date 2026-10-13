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
