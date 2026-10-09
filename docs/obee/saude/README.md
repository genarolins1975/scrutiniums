# Saúde nas capitais: início rápido

Módulo do OBEE em `/eficiencia-estatal/saude-capitais`: despesa do município em Saúde, estrutura e cobertura da atenção primária, e internações por condições sensíveis à atenção primária nas 26 capitais estaduais, em três perímetros que não se misturam. Sem nota, classificação de gestão, semáforo, fronteira estatística, estimativa de perda ou recomendação.

| Documento | Conteúdo |
| --- | --- |
| [ESCOPO_E_FONTES.md](./ESCOPO_E_FONTES.md) | Pergunta, perímetros, decisões de escopo, resumo da matriz de fontes, lacunas declaradas |
| [CATALOGO_COBERTURA_FORMULAS.md](./CATALOGO_COBERTURA_FORMULAS.md) | Gerado da gold: fórmulas, fontes, períodos, cobertura por ano, matriz de fontes completa (`python3 -m pipeline.eficiencia_saude.documenta`) |
| [ARQUITETURA.md](./ARQUITETURA.md) | Cadeia de dados, interface, reutilização de Educação, isolamento, como acrescentar uma medida |
| [VALIDACOES_E_REPRODUCAO.md](./VALIDACOES_E_REPRODUCAO.md) | S01 a S16 e M01 a M04, reconciliações, exemplos de reprodução, testes, verificação visual |
| [avaliacao/RUBRICA.md](./avaliacao/RUBRICA.md) | Critérios A a K, bloqueios e tarefas dos avaliadores |
| [MATRIZ_DE_AVALIACAO.md](./MATRIZ_DE_AVALIACAO.md) | Notas por página e critério, evidências, correções e reavaliação (avaliação interna) |
| [CONTINUIDADE.md](./CONTINUIDADE.md) | Lacunas externas, tarefas delimitadas, decisões do responsável, padrões a manter |

```bash
python3 -m pipeline.eficiencia_saude.run          # reconstrói a gold a partir do seed, sem rede
python3 -m unittest pipeline.tests.test_eficiencia_saude
npx vitest run src/tests/obee-saude.test.ts
npm run build && EXIGIR_BUILD_HTML=1 npx vitest run src/tests/html-gerado.test.ts
```
