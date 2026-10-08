# Continuidade

Para quem retoma o OBEE (pessoa ou agente). Ler antes: [README.md](./README.md), a regra editorial e [METODOLOGIA.md](./METODOLOGIA.md).

## 1. Padrões a manter

**Dados.** Toda fonte nova segue `fonte → seed (recorte + manifesto com URL, data, sha256, MD5 quando houver) → padroniza.py (observação tipada com status) → validacoes.py → gold.py`. Biblioteca padrão do Python; leitores de planilha em `fontes/xlsx.py` e `fontes/ods.py`. Arquivo oficial grande não entra no git: entra o recorte. Nenhuma ausência vira zero; zero só quando a fonte informa zero (campo vazio é ausência: `padroniza.ler_contagem`). Despesa nova passa pela política de `conferencia.py`; tolerâncias não se ampliam para fazer um caso passar, e diferença material sem explicação fica fora das comparações. Publicação só por `gold.promove`.

**Catálogo.** Indicador novo começa pela ficha em `catalogo_indicadores.json` (os 16 campos, estado de publicação). Sem ficha, sem número. O teste `test_fichas_completas_antes_da_publicacao` falha se faltar campo.

**Interface.** Cálculo fica no pipeline; `src/lib/eficiencia/consulta.ts` só seleciona, ordena e monta linhas. Medida nova na interface = entrada em `MEDIDA` (consulta.ts) + série em `PainelEducacao` + contexto de validações em `contexto.ts`. Cor só para seleção (`obee`) e neutro (`obee-neutro`); nada de semáforo, seta colorida ou ordenação inicial por valor.

**Convenções.** Ids de indicador `area.medida.perimetro` estáveis; estados em `base.STATUS`; textos públicos descritivos (o teste de neutralidade varre componentes, página, consulta, catálogo, notas e validações).

**Verificação mínima antes de cada push.** `python3 -m pipeline.eficiencia.run` (nenhuma validação reprovada), `python3 -m unittest pipeline.tests.test_eficiencia`, `npx vitest run src/tests/obee-educacao.test.ts`, `npx tsc --noEmit`, `npm run lint`. O CI também gera o build e exige o HTML gerado sem `undefined`, `NaN` ou data ISO crua (`EXIGIR_BUILD_HTML=1`; texto de pipeline passa por `TextoComDatas` ou `TextoEnergia`, e evidência da fonte por `LiteralFonte`, ver APRESENTACAO_DATAS_ENERGIA.md). Mudança visual: capturas em 1440, 768, 390 e 320 px (roteiro em VALIDACAO.md).

## 2. Decisões pendentes (do responsável)

| # | Decisão | Opções | Efeito |
| --- | --- | --- | --- |
| P1 | Publicação em produção | Merge em `main` (Vercel) ou manter em branch | Hoje só a branch tem o painel |
| P2 | Registrar o OBEE em `src/lib/dominios.ts` (home, seletor de observatórios, rodapé) | **Decidida em 08/10/2026 pelo responsável e implementada**: OBEE no registro, na home (três cards), no seletor, na escolha pós login, no cabeçalho público, no rodapé e no seletor da SPA do Crédito | Textos "dois observatórios" passaram a "três"; teste em `src/tests/dois-observatorios.test.ts` |
| P3 | Tratamento do Distrito Federal | Painel próprio com rede distrital e despesa distrital separada por competência; ou fora do OBEE municipal | Necessário para a futura visão de entes |
| P5 | Autorização de merge da rodada 6 | O merge da rodada 5 **não** se estende a esta; depende de autorização específica do responsável | Nada da rodada 6 está em produção |
| P4 | Perímetro da despesa por matrícula | RREO Anexo 8 (MDE por etapa) + conveniadas no denominador; ou Siope; ou não publicar | Define se a razão entra na próxima etapa |

## 3. Tarefas delimitadas (adequadas a sessões curtas)

Distinção: **expansão de cobertura** (mesmo indicador, mais anos ou entes) não muda fichas; **indicador novo** exige ficha, validação e revisão editorial.

| # | Tipo | Tarefa | Arquivos | Aceite |
| --- | --- | --- | --- | --- |
| T1 | Cobertura | Estender despesa para 2019 e 2020 | `padroniza.py` (`ANOS_FINANCEIROS`), `run.py`, IPCA desde 2019 | V03 e V04 aprovadas para os novos anos; séries mostram 7 exercícios; testes passam |
| T2 | Cobertura | Estender Censo, ATU e aprovação para 2019 e 2020 | `fontes/inep_censo.py` (leiaute único), `padroniza.py` (`ANOS_CENSO`) | V05 e V06 (Sinopse 2019 e 2020 extraídas) sem diferença; anotação de 2020 (pandemia) na aprovação |
| T3 | Desempenho | Reduzir o bloqueio do fio principal na hidratação (TBT mediano de 1,34 s com CPU 4× mais lenta, rodada 2) | `PainelEducacao.tsx` (dividir em ilhas; tabela auditável sob demanda) | TBT abaixo de 600 ms na mesma medição; interações (36 checagens) continuam aprovadas |
| T10 | Qualidade | Coletar a MSC de dezembro de todos os pares DCA × RREO (hoje só os de diferença material e um controle) | `fontes/siconfi.py` (`coleta_msc_educacao`), `run.py` | V04 com a MSC conferindo também os casos sem diferença; nenhuma situação muda sem registro |
| T11 | Domínio Energia (fora do OBEE) | **Resolvida na rodada 4** ([APRESENTACAO_DATAS_ENERGIA.md](./APRESENTACAO_DATAS_ENERGIA.md)): as 23 rotas passaram a obedecer ao contrato de apresentação; literais da fonte têm classe registrada em `src/lib/literais-fonte.ts` | `src/components/energia/`, `src/lib/texto-datas.ts`, `src/lib/literais-fonte.ts` | `src/tests/html-gerado.test.ts` sem falha. Data ISO nova em prosa de Energia gerada por um módulo do pipeline reprova o gate até ser formatada (`TextoEnergia`) ou ter classe de literal registrada |
| T4 | Interface | Exportar imagem do gráfico com unidade, período, fonte e ressalva | `graficos.tsx` | PNG baixado contém título, unidade, período, fonte; botão só aparece onde funciona |
| T5 | Automação | Workflow anual de atualização (Siconfi em maio, INEP após cada divulgação) | `.github/workflows/`, `run.py` | Rodada sem rede alteração idempotente; abertura de PR com diff da gold e validações |
| T6 | Indicador novo | Despesa por natureza na função Educação (pessoal, outras correntes, investimento) | `fontes/siconfi.py` (RREO Anexo 8 ou Anexo 2 por natureza), catálogo, consulta | Ficha completa; categorias mutuamente exclusivas somando o total; validação de reconciliação |
| T7 | Indicador novo | Avaliar despesa em MDE por etapa ÷ matrículas da rede + conveniadas (P4) | `fontes/siconfi.py` (RREO Anexo 8), `validacoes.py` | Medição M01 refeita no novo perímetro; publicação só com decisão P4 e ficha aprovada |
| T8 | Cobertura | Censo 2026 e Ideb 2027 quando divulgados | `run.py --inep`, `padroniza.py` | Integridade (MD5) conferida; V06 sem diferença |
| T12 | Cobertura | **Resolvida em parte na rodada 6**: 21 dos 28 pares eram defeito do pipeline (soma da MSC em módulo) e foram recuperados; restam 7 com causa documentada (São Luís 2022 e 2023, Rio de Janeiro 2021 e 2022, Natal 2022 e 2023, Campo Grande 2021). O que falta é dado externo: MSC ou DCA retificada pelo ente, ou DCA aberta por modalidade | `diagnostico_pares.py`, `conferencia.py` | Cada par com causa documentada (feito); nenhum rateio |
| T13 | Referência | **Resolvida na rodada 6**: mapeamento ISCED do Brasil conferido na UNESCO UIS (o INEP não tem mapeamento próprio); membros oficiais da OCDE; despesa em instituições públicas. Continua contexto, não comparação direta. Pendente: notas por país da OCDE e Education at a Glance 2026 (403) | `referencias_externas.py`, matriz | Linha só passa de contexto para direta com conceito idêntico; não é o caso |
| T9 | Qualidade | Revisão externa da metodologia (não realizada até aqui) | `docs/obee/` | Parecer registrado; passaporte atualiza o campo 16 |

## 4. Expansão planejada (registrada, não implementada)

* **Entes e poderes**: União, 26 estados, DF (tratamento P3) e 26 capitais; Executivo, Legislativo e Judiciário, com Ministério Público, defensorias e tribunais de contas em categorias próprias. O modelo já separa ente responsável, local da unidade e rede.
* **Judiciário nas capitais**: órgãos que atendem o território, com vinculação institucional preservada; TJDFT com responsabilidade federal explícita, sem duplicar União e DF. Fontes: Justiça em Números e DataJud (CNJ).
* **Estrutura administrativa**: servidores da atividade finalística (por área) separados de administração, cargos comissionados e terceirização (elementos 3.3.90.34 e 3.3.90.37), com a tabela de atribuições de cada ente registrada antes de qualquer razão. Pessoal por população não é diagnóstico de excesso.
* **Outras áreas**: saúde (SIOPS, CNES), assistência, segurança, administração.
* **Benchmark internacional**: só com compatibilidade documentada de conceito, perímetro, moeda (PPC) e período (por exemplo, OCDE Education at a Glance para gasto por estudante). Nada improvisado.
* **Fora de escopo por desenho**: notas próprias, índices sintéticos, DEA ou SFA, cenários de corte, assistente conversacional.

## 5. Registro de progresso

| Data | Entrega |
| --- | --- |
| 08/10/2026 | Etapa inicial: inventário, arquitetura, pipeline com 12 validações e 1 medição, painel Educação municipal nas capitais, documentação |
| 08/10/2026 | OBEE incluído na home, no seletor, na escolha pós login, no cabeçalho, no rodapé e na SPA do Crédito (P2) |
| 08/10/2026 | Rodada 6 ([RODADA_6_CONSOLIDACAO_E_BENCHMARKS.md](./RODADA_6_CONSOLIDACAO_E_BENCHMARKS.md)): indicador por matrícula renomeado (razão de aplicação direta, parcela indeterminada medida), política de conferência 1.2 (saldo líquido da MSC; 123 de 130 pares), população de 2023 do Censo 2022 (relação do DOU), referência nacional calculada (5.060 municípios), validação OCDE/ISCED, proveniência por conteúdo. Decisões da rodada 5 superadas estão marcadas no documento dela |
| 08/10/2026 | Rodada 5 ([COMPARACOES_GASTO_POR_HABITANTE_E_MATRICULA.md](./COMPARACOES_GASTO_POR_HABITANTE_E_MATRICULA.md)): despesa por habitante e por matrícula, ponte da MSC, referências do grupo, nacionais e internacionais, tabela comparativa; T7 resolvida em parte (publicada em 102 de 130 pares com a ponte pela MSC; os demais pares dependem de reconciliação) |
| 08/10/2026 | Rodada 4: datas e literais da fonte em Energia, contrato estrutural do teste de HTML e inventário reconciliado ([APRESENTACAO_DATAS_ENERGIA.md](./APRESENTACAO_DATAS_ENERGIA.md)); T11 resolvida |
| 08/10/2026 | Verificação final ([VERIFICACAO_FINAL.md](./VERIFICACAO_FINAL.md)): data legível na gaveta de proveniência, gate obrigatório de HTML no CI, valor exato por toque e atalho para a tabela da comparação; gate reprovado por 21 páginas de Energia (T11) |
| 08/10/2026 | Rodada 2 de correções ([RODADA_2_CORRECOES.md](./RODADA_2_CORRECOES.md)): política de conferência 1.1 com MSC, elegibilidade separada do estado, portão de publicação, ausência sem zero, universo por indicador, CSVs autoexplicativos, metodologia 1.1 |
