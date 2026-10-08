# Continuidade

Para quem retoma o OBEE (pessoa ou agente). Ler antes: [README.md](./README.md), a regra editorial e [METODOLOGIA.md](./METODOLOGIA.md).

## 1. Padrões a manter

**Dados.** Toda fonte nova segue `fonte → seed (recorte + manifesto com URL, data, sha256, MD5 quando houver) → padroniza.py (observação tipada com status) → validacoes.py → gold.py`. Biblioteca padrão do Python; leitores de planilha em `fontes/xlsx.py` e `fontes/ods.py`. Arquivo oficial grande não entra no git: entra o recorte. Nenhuma ausência vira zero; zero só quando a fonte informa zero (campo vazio é ausência: `padroniza.ler_contagem`). Despesa nova passa pela política de `conferencia.py`; tolerâncias não se ampliam para fazer um caso passar, e diferença material sem explicação fica fora das comparações. Publicação só por `gold.promove`.

**Catálogo.** Indicador novo começa pela ficha em `catalogo_indicadores.json` (os 16 campos, estado de publicação). Sem ficha, sem número. O teste `test_fichas_completas_antes_da_publicacao` falha se faltar campo.

**Interface.** Cálculo fica no pipeline; `src/lib/eficiencia/consulta.ts` só seleciona, ordena e monta linhas. Medida nova na interface = entrada em `MEDIDA` (consulta.ts) + série em `PainelEducacao` + contexto de validações em `contexto.ts`. Cor só para seleção (`obee`) e neutro (`obee-neutro`); nada de semáforo, seta colorida ou ordenação inicial por valor.

**Convenções.** Ids de indicador `area.medida.perimetro` estáveis; estados em `base.STATUS`; textos públicos descritivos (o teste de neutralidade varre componentes, página, consulta, catálogo, notas e validações).

**Verificação mínima antes de cada push.** `python3 -m pipeline.eficiencia.run` (nenhuma validação reprovada), `python3 -m unittest pipeline.tests.test_eficiencia`, `npx vitest run src/tests/obee-educacao.test.ts`, `npx tsc --noEmit`, `npm run lint`. Mudança visual: capturas em 1440, 768, 390 e 320 px (roteiro em VALIDACAO.md).

## 2. Decisões pendentes (do responsável)

| # | Decisão | Opções | Efeito |
| --- | --- | --- | --- |
| P1 | Publicação em produção | Merge em `main` (Vercel) ou manter em branch | Hoje só a branch tem o painel |
| P2 | Registrar o OBEE em `src/lib/dominios.ts` (home, seletor de observatórios, rodapé) | Agora, com um painel; ou quando houver o segundo painel | Altera textos "dois observatórios" e testes de `dois-observatorios.test.ts` |
| P3 | Tratamento do Distrito Federal | Painel próprio com rede distrital e despesa distrital separada por competência; ou fora do OBEE municipal | Necessário para a futura visão de entes |
| P4 | Perímetro da despesa por matrícula | RREO Anexo 8 (MDE por etapa) + conveniadas no denominador; ou Siope; ou não publicar | Define se a razão entra na próxima etapa |

## 3. Tarefas delimitadas (adequadas a sessões curtas)

Distinção: **expansão de cobertura** (mesmo indicador, mais anos ou entes) não muda fichas; **indicador novo** exige ficha, validação e revisão editorial.

| # | Tipo | Tarefa | Arquivos | Aceite |
| --- | --- | --- | --- | --- |
| T1 | Cobertura | Estender despesa para 2019 e 2020 | `padroniza.py` (`ANOS_FINANCEIROS`), `run.py`, IPCA desde 2019 | V03 e V04 aprovadas para os novos anos; séries mostram 7 exercícios; testes passam |
| T2 | Cobertura | Estender Censo, ATU e aprovação para 2019 e 2020 | `fontes/inep_censo.py` (leiaute único), `padroniza.py` (`ANOS_CENSO`) | V05 e V06 (Sinopse 2019 e 2020 extraídas) sem diferença; anotação de 2020 (pandemia) na aprovação |
| T3 | Desempenho | Reduzir o bloqueio do fio principal na hidratação (TBT mediano de 1,34 s com CPU 4× mais lenta, rodada 2) | `PainelEducacao.tsx` (dividir em ilhas; tabela auditável sob demanda) | TBT abaixo de 600 ms na mesma medição; interações (36 checagens) continuam aprovadas |
| T10 | Qualidade | Coletar a MSC de dezembro de todos os pares DCA × RREO (hoje só os de diferença material e um controle) | `fontes/siconfi.py` (`coleta_msc_educacao`), `run.py` | V04 com a MSC conferindo também os casos sem diferença; nenhuma situação muda sem registro |
| T4 | Interface | Exportar imagem do gráfico com unidade, período, fonte e ressalva | `graficos.tsx` | PNG baixado contém título, unidade, período, fonte; botão só aparece onde funciona |
| T5 | Automação | Workflow anual de atualização (Siconfi em maio, INEP após cada divulgação) | `.github/workflows/`, `run.py` | Rodada sem rede alteração idempotente; abertura de PR com diff da gold e validações |
| T6 | Indicador novo | Despesa por natureza na função Educação (pessoal, outras correntes, investimento) | `fontes/siconfi.py` (RREO Anexo 8 ou Anexo 2 por natureza), catálogo, consulta | Ficha completa; categorias mutuamente exclusivas somando o total; validação de reconciliação |
| T7 | Indicador novo | Avaliar despesa em MDE por etapa ÷ matrículas da rede + conveniadas (P4) | `fontes/siconfi.py` (RREO Anexo 8), `validacoes.py` | Medição M01 refeita no novo perímetro; publicação só com decisão P4 e ficha aprovada |
| T8 | Cobertura | Censo 2026 e Ideb 2027 quando divulgados | `run.py --inep`, `padroniza.py` | Integridade (MD5) conferida; V06 sem diferença |
| T9 | Qualidade | Revisão externa da metodologia (não realizada até aqui) | `docs/obee/` | Parecer registrado; passaporte atualiza o campo 16 |

## 4. Expansão planejada (registrada, não implementada)

* **Entes e poderes**: União, 26 estados, DF (tratamento P3) e 26 capitais; Executivo, Legislativo e Judiciário, com Ministério Público, defensorias e tribunais de contas em categorias próprias. O modelo já separa ente responsável, local da unidade e rede.
* **Judiciário nas capitais**: órgãos que atendem o território, com vinculação institucional preservada; TJDFT com responsabilidade federal explícita, sem duplicar União e DF. Fontes: Justiça em Números e DataJud (CNJ).
* **Outras áreas**: saúde (SIOPS, CNES), assistência, segurança, administração.
* **Benchmark internacional**: só com compatibilidade documentada de conceito, perímetro, moeda (PPC) e período (por exemplo, OCDE Education at a Glance para gasto por estudante). Nada improvisado.
* **Fora de escopo por desenho**: notas próprias, índices sintéticos, DEA ou SFA, cenários de corte, assistente conversacional.

## 5. Registro de progresso

| Data | Entrega |
| --- | --- |
| 08/10/2026 | Etapa inicial: inventário, arquitetura, pipeline com 12 validações e 1 medição, painel Educação municipal nas capitais, documentação |
| 08/10/2026 | Rodada 2 de correções ([RODADA_2_CORRECOES.md](./RODADA_2_CORRECOES.md)): política de conferência 1.1 com MSC, elegibilidade separada do estado, portão de publicação, ausência sem zero, universo por indicador, CSVs autoexplicativos, metodologia 1.1 |
