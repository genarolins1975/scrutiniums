# Observatório Brasileiro de Eficiência Estatal (OBEE): início rápido

**Objetivo.** Apresentar indicadores públicos sobre recursos, atendimento e resultados do Estado brasileiro, com definição, fonte, período, perímetro e limitações declarados em cada número. O observatório apresenta os indicadores; o leitor tira as conclusões.

**Estado em 08/10/2026.** Etapa inicial entregue: arquitetura mínima, uma cadeia de dados real da fonte à interface e um painel de referência completo, **Educação municipal nas capitais** (redes municipais das 26 capitais estaduais). Não há outros painéis publicados.

## Onde está

| Item | Caminho |
| --- | --- |
| Painel | `/eficiencia-estatal/educacao-municipal-capitais` (a raiz `/eficiencia-estatal` redireciona para ele) |
| Página (servidor) | `src/app/eficiencia-estatal/educacao-municipal-capitais/page.tsx` |
| Componentes | `src/components/eficiencia/` |
| Consulta, tipos, leitura da gold | `src/lib/eficiencia/` |
| Pipeline (Python, biblioteca padrão) | `pipeline/eficiencia/` |
| Recortes versionados das fontes e manifesto | `pipeline/eficiencia/seed/` |
| Catálogo de indicadores (alimenta pipeline e passaportes) | `pipeline/eficiencia/catalogo_indicadores.json` |
| Gold e séries para download | `public/eficiencia/gold/educacao_capitais.json`, `public/eficiencia/series/*.csv` |
| Testes | `pipeline/tests/test_eficiencia.py`, `src/tests/obee-educacao.test.ts` |

## Executar

```bash
npm install
npm run dev                                   # http://localhost:3000/eficiencia-estatal
python3 -m pipeline.eficiencia.run            # reconstrói a gold a partir do seed, sem rede
python3 -m pipeline.eficiencia.run --coleta-siconfi   # recoleta DCA, RREO, entes e IPCA
python3 -m pipeline.eficiencia.run --inep <pasta>     # reextrai recortes dos .zip oficiais do INEP
python3 -m unittest pipeline.tests.test_eficiencia
npx vitest run src/tests/obee-educacao.test.ts
```

A reconstrução sem rede imprime as validações e termina com código 1 se alguma for reprovada.

## Documentos

| Documento | Conteúdo |
| --- | --- |
| [ARQUITETURA.md](./ARQUITETURA.md) | Inventário do repositório, decisões e arquitetura implementada |
| [METODOLOGIA.md](./METODOLOGIA.md) | Perímetros, fórmulas, estados de dado e regras de comparação do piloto |
| [CATALOGO_COBERTURA.md](./CATALOGO_COBERTURA.md) | Indicadores, fontes, períodos, cobertura e lacunas |
| [VALIDACAO.md](./VALIDACAO.md) | Verificações executadas, resultados e capturas de tela |
| [RODADA_2_CORRECOES.md](./RODADA_2_CORRECOES.md) | Rodada de correções: achados, política de conferência 1.1, casos Boa Vista 2024 e Campo Grande 2021, campos vazios, antes e depois |
| [CONTINUIDADE.md](./CONTINUIDADE.md) | Próximos módulos, decisões pendentes e tarefas delimitadas |

## Regra editorial (vale para todo o código e texto do domínio)

O painel mostra valores, séries, distribuições, decomposições verificáveis, definições, fontes e limitações. Não mostra diagnósticos, rankings, notas próprias, semáforos, estimativas de desperdício, recomendações nem blocos de "principais achados". Ordenar uma tabela por valor é recurso de leitura, não classificação. O teste `src/tests/obee-educacao.test.ts` varre o texto público e o catálogo em busca de linguagem avaliativa e de cores de semáforo.
