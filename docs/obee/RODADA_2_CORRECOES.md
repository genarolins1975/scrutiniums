# Rodada 2: correções do painel Educação municipal nas capitais

Registro da rodada de correções do PR genarolins1975/scrutiniums#117, executada em 08/10/2026 no ambiente de nuvem do Claude Code.

* **Commit examinado**: `8ad77dbbffbe25e382ce839f701aab9104cee042` (HEAD da branch `claude/new-session-h7p70p` no início da rodada). Todos os achados foram confirmados nesse commit antes da correção.
* **Commit final**: o último commit da branch nesta rodada; o SHA está na descrição do PR. A gold registra em `meta.versao_codigo` o commit de código que a gerou.
* **Versões**: catálogo `2026-10-08.2` (metodologia 1.1 nos indicadores publicados; histórico 1.0 → 1.1 no próprio catálogo), política de conferência 1.1, pipeline `obee-0.2.0`.

## 1. Achados, causa, correção

| # | Achado confirmado no commit examinado | Causa | Correção | Arquivos |
| --- | --- | --- | --- | --- |
| C1.1 | Divergência material sem explicação (Boa Vista 2024) entrava em comparações, mediana e variações | `conferencia_rreo` marcava `diverge` com `comparavel: True` | Três dimensões separadas por observação: valor oficial (status), resultado da conferência (`conferencia.situacao`) e elegibilidade (`elegivel_comparacao`). Pendente e não conferido ficam fora | `pipeline/eficiencia/conferencia.py` (novo), `padroniza.py` |
| C1.2 | V04 nunca reprovava | Resultado fixo | V04 reprova se alguma observação contraria a política; V13 confere a elegibilidade de todas as observações, incluídos valor real e subfunções | `validacoes.py` |
| C1.3 | Validação reprovada já tinha sobrescrito a saída pública | `gold.publica` era chamada antes do portão | `gold.promove` monta a gold e as séries em pasta temporária e só substitui `public/eficiencia` sem validação reprovada; com reprovação, grava em `data/eficiencia/diagnostico` e sai com código 1 | `gold.py`, `run.py` |
| C1.4 | Campo Grande 2021 classificado por coincidência aritmética (diferença = bloco intraorçamentário do RREO) | Sem terceira fonte | Coincidência não basta: sem MSC o caso fica pendente. Com a MSC de dezembro, perímetro comprovado pela modalidade 91 | `conferencia.py`, `fontes/siconfi.py` |
| C1.5 | Subfunções e valor real de Campo Grande 2021 elegíveis | Ressalva só no valor nominal | Valor real e subfunções herdam elegibilidade e ressalva; participação recebe nota sobre o total com ressalva | `padroniza.py` |
| C2.1 | CSV da comparação mostrava incluída com nota como "Observado" sem a nota | Nota descartada na exportação | Uma regra (`comparar`) serve a gráfico, mediana, tabela e CSV; CSV lista todas as capitais do grupo com elegibilidade, inclusão, conferência, motivo, nota, mediana e contagens | `src/lib/eficiencia/consulta.ts` |
| C2.2 | CSVs dependiam do site para serem lidos | Colunas mínimas | Séries públicas com indicador, capital e código IBGE, tipo de período, unidade e base monetária, universo, estado, elegibilidade, conferência, motivo, nota, materialidade, fonte, versão metodológica, data e hash; participação em coluna própria | `gold.py`, `consulta.ts` |
| C2.3 | Ressalva só no passaporte | Sem componente junto ao dado | `Ressalva` (details/summary, abre por teclado) nos cartões, lista "Incluídas com nota", lista "Fora da comparação" com valor oficial e motivo, losango e quebra de linha na série | `PainelEducacao.tsx`, `graficos.tsx` |
| C3.1 | Critério da comparação dizia "rede municipal" para a despesa | Texto fixo | Universo de cada indicador vem do catálogo (`universo_curto`, `universo_rotulo`), coerente com o passaporte: despesa = orçamento do município na função 12; matrículas = escolas de dependência municipal; conveniadas = parceria exclusiva com o município | `catalogo_indicadores.json`, `consulta.ts`, `PainelEducacao.tsx` |
| C3.2 | Contagem e mediana não declaravam o conjunto | Uma contagem só | Três contagens (no grupo, com valor oficial, na comparação); mediana rotulada "das N capitais na comparação"; aviso de poucos pares conta as capitais na comparação | `PainelEducacao.tsx`, `graficos.tsx` |
| C4 | `_int()` convertia campo vazio em zero | Leitura permissiva | `ler_contagem`: vazio e coluna ausente → ausência; texto não numérico → erro. Agregado com componente ausente não vira total; escola sem contagem só conta como contribuição nula quando a Sinopse do mesmo ano, município e dependência confirma o total; sem confirmação, estado `INCOMPLETO` | `padroniza.py`, `base.py`, `validacoes.py` (M02) |

## 2. Política de conferência 1.1

`d = DCA − RREO do 6º bimestre (exceto intraorçamentárias)`, despesa liquidada na função 12.

| Situação | Regra | Comparações, medianas, variações |
| --- | --- | --- |
| Não conferido | RREO ausente ou sem a linha da Educação | Fora |
| Confere | \|d\| ≤ R$ 1,00 | Dentro |
| Diferença menor | \|d\| ≤ 0,1% da DCA | Dentro, com nota |
| Reconciliada pela MSC | Diferença material e MSC de dezembro sem intraorçamentárias = DCA | Dentro, com ressalva |
| Perímetro distinto (MSC) | Diferença material, MSC total = DCA e parcela de modalidade 91 > R$ 1,00 | Fora; quebra de série |
| Pendente | Diferença material sem reconciliação | Fora |

Tolerâncias fixadas antes de examinar os casos e não ampliadas. A evidência é refeita a cada execução a partir dos arquivos preservados; a conferência grava o sha256 da DCA, do RREO e da MSC usados. Exercício novo ou DCA retificada não herdam reconciliação. Valores fora continuam publicados para consulta, com o motivo ao lado. Variação entre dois anos só é calculada quando os dois são elegíveis.

Resultado em 130 declarações (26 capitais, 2021 a 2025): 125 conferem; 3 diferenças menores (Boa Vista 2021, 0,028%; Palmas 2021, 0,003%; Macapá 2022, 0,0015%); 1 reconciliada (Boa Vista 2024); 1 perímetro distinto (Campo Grande 2021); 0 pendentes; 0 não conferidas. Fonte: Siconfi, DCA Anexo I-E, RREO Anexo 02 e MSC, capturados em 08/10/2026.

## 3. Casos investigados

Evidências gravadas em `pipeline/eficiencia/seed/siconfi/msc_funcao12/` e `seed/siconfi/evidencias_divergencia/` (extrato de entregas e RREO do 5º bimestre), com sha256 no manifesto. Capturas de 08/10/2026.

### Boa Vista 2024: reconciliada, elegível com ressalva

Evidência:

* DCA 2024, função 12, liquidado exceto intraorçamentárias: R$ 658.077.936,34. Homologada em 14/05/2025.
* RREO 6º bimestre: R$ 122.547.917,75 exceto intraorçamentárias; R$ 36.694.376,38 intraorçamentárias. Homologado em 11/03/2025, sem retificação registrada no extrato de entregas.
* RREO 5º bimestre: acumulado de R$ 490.235.762,44 exceto intraorçamentárias, maior que o acumulado do 6º bimestre.
* MSC agregada de dezembro (enviada em 10/03/2025), função 12, contas 6.2.2.1.3.03, .04 e .07: R$ 694.772.312,72; modalidade 91: R$ 36.694.376,38; sem intraorçamentárias: R$ 658.077.936,34, igual à DCA.

Inferência: DCA e MSC concordam entre si; o RREO do 6º bimestre diverge das duas e do seu próprio 5º bimestre (acumulado decrescente). O valor da DCA é usado e é elegível.

Não explicado: por que o RREO do 6º bimestre registra acumulado menor. O painel não declara o RREO errado; registra que diverge da DCA e da MSC e que não foi retificado até a captura.

### Campo Grande 2021: perímetro distinto, fora das comparações

Evidência:

* DCA 2021, função 12: R$ 1.030.887.330,50. Retificada em 30/06/2023 (status "RE" no extrato); o painel usa a versão vigente na captura.
* RREO 6º bimestre: R$ 906.686.417,45 exceto intraorçamentárias; R$ 124.200.913,05 intraorçamentárias.
* MSC de dezembro, função 12, liquidado: R$ 1.030.887.330,50, igual à DCA; modalidade 91 (aplicação direta em operações intraorçamentárias): R$ 124.200.913,05.

Inferência: a DCA deste exercício reúne na função Educação despesas intraorçamentárias que as demais declarações apresentam em linha separada. A MSC comprova o enquadramento pela modalidade da despesa, não só a coincidência aritmética.

Tratamento: valor oficial publicado sem subtração; fora de comparações, medianas e variações (nominal, real e subfunções); quebra de série na linha do tempo (losango sem ligação com os anos vizinhos); variações 2021 → 2022 bloqueadas com motivo.

## 4. Campos vazios nos microdados (C4)

Dicionário de dados do Censo Escolar (INEP), edições 2021 a 2025: as colunas `QT_MAT_*` são contagens; o dicionário não define campo vazio como zero. Equivalência não comprovada, logo vazio = ausência.

Varredura (medição M02, recortes das 26 capitais):

| Ano | Rede municipal, registros sem contagem | Privadas, registros sem contagem | Capitais afetadas | Confirmadas pela Sinopse |
| --- | --- | --- | --- | --- |
| 2021 | 0 | 0 | 0 | não se aplica |
| 2022 | 342 | 6.447 | 22 (municipal), 26 (privada) | todas |
| 2023 | 314 | 3.162 | 23, 26 | todas |
| 2024 | 336 | 2.401 | 23, 26 | todas |
| 2025 | 0 | 0 | 0 | não se aplica |

Nenhum registro com contagem parcial ou valor não numérico. Em todos os grupos afetados, a Sinopse Estatística do mesmo ano, município e dependência confirma que a soma das escolas com contagem é o total; por isso esses registros entram como contribuição nula, com nota. Sinopses 2022 e 2023 foram extraídas nesta rodada (MD5 conferido) para essa confirmação.

Impacto: **nenhum valor publicado alterado** e nenhum estado alterado. Notas novas em 696 observações de matrículas (544 da rede, 152 de conveniadas).

## 5. Antes e depois

Comparação entre a gold do commit examinado e a gold final, por chave (indicador, capital, ano, etapa, componente). Mesmas 6.667 observações.

| Tipo de mudança | Quantidade | Detalhe |
| --- | --- | --- |
| Valor | 0 | Nenhum valor publicado mudou |
| Estado do dado | 0 | |
| Elegibilidade efetiva | 4 | Subfunções de Campo Grande 2021 (122, 361, 362, 365) saem das comparações; nominal e real já estavam fora |
| Base da elegibilidade | 1 caso | Boa Vista 2024 continua elegível, agora por reconciliação documentada (antes, por regra que aceitava divergência) |
| Notas | 714 | 10 despesa, 8 subfunções, 544 matrículas da rede, 152 conveniadas |
| Metadados | todas | Campos novos: `elegivel_comparacao`, `nota_material`, `conferencia` (situação, evidências, sha256), universo por indicador |
| Regras | 3 | Política de conferência 1.1; ausência sem zero; portão de publicação |
| Textos | catálogo e página | Universo por indicador; conveniadas "com parceria exclusiva com o município"; glossário com "liquidada", "reais de 2025", "mediana", "fora da comparação", "MSC" |

## 6. Testes e verificações

| Conjunto | Resultado |
| --- | --- |
| `python3 -m unittest pipeline.tests.test_eficiencia` | 41 testes aprovados (20 na rodada anterior) |
| `npx vitest run src/tests/obee-educacao.test.ts` | 49 aprovados (43 na rodada anterior) |
| Suítes completas, tipos, lint, build | Ver VALIDACAO.md, seção 2 |
| `scripts/obee/interacoes.mjs` | 36 de 36 checagens |
| `scripts/obee/casos.mjs` | 7 casos × 4 larguras: sem rolagem horizontal, sem erro de console, axe sem violações em 1440 e 390 px |

Regressões cobertas por fixtures sintéticas (nunca publicadas): DCA e RREO compatíveis; limites de R$ 1,00 e de 0,1%; diferença material sem explicação; coincidência com o intraorçamentário do RREO sem MSC; reconciliação pela MSC e reconciliação que não se transfere a DCA diferente; MSC vinculada ao exercício; RREO ausente, linha ausente e RREO zerado (sem divisão por zero); zero explícito, vazio, coluna ausente e valor inválido; agregado com componente ausente (sem total nem resíduo fabricado); `INCOMPLETO` não vira "não aplicável"; reprovação que preserva a saída pública; violação da elegibilidade que reprova V04 e V13. Com dados reais: Boa Vista 2024 e Campo Grande 2021 em comparação, série, variação, composição e CSV; mudança de elegibilidade recalcula mediana e contagens; universos distintos por indicador.

## 7. Revisão visual, acessibilidade e desempenho

Capturas em `capturas/rodada-2/`, do build de produção: Campo Grande 2021 (comparação, cartões, série), Boa Vista 2024, poucos pares (Centro-Oeste 2021, 2 capitais na comparação de 3 com valor), ausência (Rio Branco, aprovação nos anos finais), zero real (Rio Branco, matrículas nos anos finais em 2021), ano par com edição do Ideb (Recife 2024), conferência em Métodos e o padrão em 320 px.

Ajustes desta revisão: mediana rotulada pelo conjunto; aviso de poucos pares contando capitais na comparação; legenda "capital selecionada" só quando a capital está no gráfico; "R$ 1,03 bilhão" no singular; parênteses aninhados e separador de milhar nos textos de validação.

Teclado: ressalvas e passaporte abrem por teclado; Esc fecha o passaporte; dica do gráfico por setas. Leitor de tela real (NVDA, VoiceOver): não testado.

Desempenho, mesmo protocolo da rodada anterior (`desempenho.mjs`, 390 px, CPU 4× mais lenta e rede emulada de 1,6 Mbps e 150 ms), três execuções por build, mesma máquina e mesmo momento:

| Métrica (mediana de 3) | Commit examinado | Final |
| --- | --- | --- |
| TBT | 1.305 ms | 1.343 ms |
| LCP | 1.256 ms | 1.240 ms |
| CLS | 0,027 | 0,027 |
| HTML transferido | 128,9 kB | 142,0 kB |
| JavaScript próprio da rota | 20,3 kB | 22,2 kB |

Dispersão entre execuções do mesmo build (TBT de 1.043 a 1.345 ms no commit examinado; 1.156 a 1.718 ms no final) maior que a diferença entre medianas. Medição de laboratório, não de campo.

Neutralidade: teste automático de termos avaliativos aprovado; revisão manual interna de cartões, legendas, listas, notas, glossário e cabeçalhos dos CSVs: textos descrevem estado e motivo, sem juízo sobre as administrações. "Reconciliada" e "perímetro distinto" descrevem a conferência, não a qualidade da gestão.

## 8. Limitações remanescentes

* Motivo da divergência do RREO de Boa Vista 2024 não explicado pela fonte.
* MSC coletada só para os casos com diferença material; os demais exercícios conferem pelo RREO.
* Revisão metodológica por terceiro independente: não realizada. A conferência com a Sinopse é cruzamento entre publicações do próprio INEP.
* Leitor de tela real e medição de desempenho em campo: não realizados.
* TBT sob limitação de CPU continua acima de 1 s (tarefa T3 de CONTINUIDADE.md).
* Inclusão do OBEE na home, no seletor e no rodapé: fora do escopo (decisão P2).
