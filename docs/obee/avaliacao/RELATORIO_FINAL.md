# Relatório final da avaliação independente dos painéis de educação do OBEE

Situação: **parcialmente aprovado**. A meta de nota mínima 9,0 em cada critério de cada painel não foi atingida. Dos 66 pares de painel e critério, 14 chegam a 9,0 ou mais na última avaliação independente (rodada 3). Nenhum bloqueio de aprovação ficou sem tratamento, mas dois bloqueios localizados apontados na rodada 3 foram corrigidos depois dela e **não foram reavaliados** por avaliador independente.

## 1. Matriz final (rodada 3, notas de avaliadores independentes)

Estado avaliado: ramo `claude/obee-avaliacao-educacao` no commit `ad30e90db`, build de produção local em 09/10/2026. Experiência (A, B, C, D, H, I, J): `rodada-3/avaliador-experiencia.md`. Dados e método (E, F, G, K): `rodada-3/avaliador-dados.md`.

| Painel | A | B | C | D | E | F | G | H | I | J | K | Mínima |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Panorama | 8,6 | 8,6 | 8,2 | 8,5 | 8,7 | 8,7 | 8,8 | 8,4 | 8,5 | 7,6 | 9,2 | **7,6** |
| Gastos | 8,4 | 8,7 | 8,7 | 8,8 | 8,5 | 8,3 | 9,1 | 8,4 | 8,4 | 8,8 | 8,9 | **8,3** |
| Atendimento | 8,5 | 8,6 | 8,4 | 8,6 | 9,0 | 9,0 | 9,1 | 8,5 | 8,6 | 8,8 | 9,2 | **8,4** |
| Resultados | 8,5 | 8,7 | 8,5 | 8,7 | 9,0 | 8,9 | 9,1 | 8,2 | 8,6 | 8,7 | 9,2 | **8,2** |
| Comparar capitais | 8,4 | 8,3 | 8,8 | 8,6 | 8,6 | 8,6 | 9,0 | 8,5 | 8,5 | 8,5 | 9,0 | **8,3** |
| Dados e métodos | 7,6 | 8,2 | 8,3 | 8,3 | 9,1 | 8,7 | 9,3 | 7,8 | 8,0 | 8,0 | 9,2 | **7,6** |
| **Mínima por critério** | 7,6 | 8,2 | 8,2 | 8,3 | 8,5 | 8,3 | 8,8 | 7,8 | 8,0 | 7,6 | 8,9 | |

Critérios: A layout e hierarquia; B didática; C utilidade para análise e decisão; D relevância e impacto social; E indicadores, referências e comparabilidade; F rigor metodológico; G rastreabilidade e reprodutibilidade; H visualizações; I navegação e interação; J acessibilidade e responsividade; K confiabilidade técnica e desempenho.

Trajetória da nota mínima por painel (menor nota entre os critérios avaliados):

| Painel | Rodada 1 | Rodada 2 | Rodada 3 |
|---|---|---|---|
| Panorama | 7,0 | 8,5 | 7,6 |
| Gastos | 7,0 | 8,2 | 8,3 |
| Atendimento | 7,4 | 8,4 | 8,4 |
| Resultados | 7,4 | 8,2 | 8,2 |
| Comparar capitais | 6,9 | 8,0 | 8,3 |
| Dados e métodos | 6,8 | 7,8 | 7,6 |

A matriz inicial completa está em `rodada-1/MATRIZ_INICIAL.md`; as matrizes da rodada 2 estão nos relatórios de `rodada-2/`. **Leitura da trajetória (inferência):** a primeira rodada partiu de mínimas entre 6,8 e 7,4 e a terceira terminou entre 7,6 e 8,4, mas a rodada 3 não é uniformemente superior à 2. Panorama e Dados e métodos recuaram na mínima porque cada rodada usou avaliadores novos, em contexto limpo, e o da rodada 3 mediu e penalizou defeitos que os anteriores não testaram (estouro de largura em 320 px com a tabela de valores aberta; extensão de Dados e métodos). Notas de agentes diferentes não são séries comparáveis ponto a ponto: a variação entre avaliadores é parte da incerteza declarada.

## 2. Bloqueios de aprovação

* Rodada 1: dois bloqueios confirmados (intraorçamentárias sem aviso junto do número; evolução da mediana atravessando a quebra da base populacional). Ambos corrigidos no lote 1 e não reapareceram nas rodadas 2 e 3.
* Rodada 2: nenhum bloqueio.
* Rodada 3 (avaliador de dados): dois bloqueios localizados. **A1**, a evolução da mediana sem capital compara conjuntos diferentes de capitais por ano e a frase não dizia isso. **A5**, a parcela intraorçamentária de Boa Vista em 2024 aparecia como 23,0%, calculada com um RREO que o próprio painel declara divergente da DCA (pela MSC seria 5,3%). Ambos foram corrigidos depois da rodada 3 (a frase da evolução passou a informar quantas capitais entram em cada ano e que o conjunto muda; a parcela passou a vir da MSC onde o RREO diverge e a MSC confirma a DCA), com teste automatizado. **Não houve nova avaliação independente.** Até que haja, os dois contam como corrigidos pelo executor, não como aprovados.
* Avaliador de experiência da rodada 3: nenhum bloqueio.

## 3. Integridade dos números (evidência)

Rodada 3: 140.693 checagens de exibição contra recálculo próprio a partir da gold, sem divergência de valor; conferência ao vivo em 09/10/2026 com DCA e RREO (130 de 130 pares iguais), populações do IBGE (104 iguais), IPCA, 3.016 valores do INEP e 78 da Sinopse 2025, e razão por matrícula refeita pela MSC para quatro capitais, igual ao centavo; reconstrução isolada da gold sem rede com `hash_dados` idêntico. Itens não verificados contra a fonte, declarados pelo avaliador: soma de `QT_MAT_BAS` nos microdados do Censo, matrículas e rendimento de 2021 a 2024, referências nacionais do INEP, referência calculada pelo OBEE com 5.060 municípios, despesa por estudante da OCDE e o arquivo da relação do DOU de 2023.

## 4. O que falta para 9,0 (problemas abertos, por prioridade)

Da última avaliação independente, ainda sem correção ou sem reavaliação:

1. **Primeira tela dos painéis temáticos sem o gráfico** (A): em 1440 por 900 px o gráfico começa a cerca de 1.370 px em Gastos, e a 1.890 a 2.370 px no celular. Pedido de menos texto antes do gráfico, não feito.
2. **Dados e métodos** (A, B, H, I, J): cerca de 45 mil caracteres, jargão contábil, blocos de JSON bruto e tabelas largas. Não reestruturado além do índice e das versões.
3. **Panorama em 320 px** (J): estouro de largura com a tabela de valores aberta, corrigido (`min-w-0` e tabela mais estreita) e medido em 320, 360 e 390 px pelo executor, sem reavaliação independente.
4. **Siglas por `abbr`** (B, J): expandem por hover e foco; no toque não há equivalente visível além do glossário.
5. **Mudança de base na evolução por habitante** (C, H, I): a política bloqueia variações com 2023 (população oficial de 2023 é a do Censo 2022), o que deixa, em reais constantes, só 2024 para 2025 legível numa capital. O CSV passou a trazer a marca e a mudança de base de forma coerente com o dicionário; a política em si foi mantida.
6. **Perímetro intraorçamentário heterogêneo** (E, F): de 0,0% a 32,2% da função em 2025 (até 41,4% em 2021), declarado junto do número e disponível por capital na tabela completa e no CSV, sem variante de sensibilidade. É limite do dado (a DCA não permite separar).
7. **Ressalva do denominador da razão por matrícula** (F): agora na definição e na ponte, mas ainda não no gráfico do Panorama.
8. Itens sem tratamento: nota "Incluída, com nota" de uma capital sem leitura direta em Gastos; link do repositório no painel; tempo até o recorte aparecer em links com parâmetros (até 4,1 s em celular com CPU e rede lentas em laboratório, com liberação por prazo de 5 s).

## 5. Entregáveis

| Entregável | Local |
|---|---|
| Rubrica e papéis | `RUBRICA.md` |
| Inventário e relatório do executor, com lotes, verificações e limitações | `EXECUCAO.md` |
| Matriz inicial e registro de problemas com o estado de cada item | `rodada-1/MATRIZ_INICIAL.md`, `rodada-1/REGISTRO_PROBLEMAS.md` |
| Relatórios dos avaliadores independentes e capturas por rodada | `rodada-1/`, `rodada-2/`, `rodada-3/` |
| Capturas antes (rodada 1) e depois (build final) nos mesmos recortes | `rodada-1/evidencias/experiencia/`, `depois/` |
| Roteiros de verificação | `scripts/obee/redesenho-verificacao.mjs`, `scripts/obee/interacoes-redesenho.mjs`, `scripts/obee/capturas-avaliacao.mjs` |

## 6. Relatório de regressões

Nenhuma regressão detectada pelos roteiros do executor (80 combinações de rota e largura sem violação do axe, 59 de 59 interações em 1280 e em 390 px, 2.668 testes aprovados e 1 ignorado, 41 testes do pipeline). Mudanças intencionais de comportamento: nome do CSV de Gastos com a moeda, ordem por valor crescente e decrescente, botão de CSV da série, ocultação do conteúdo até a leitura do recorte da URL, cabeçalho do Saeb com a disciplina. Uma execução isolada da suíte teve 1 falha não identificada que não se repetiu em duas execuções seguintes (provável efeito de carga).

## 7. Limitações da avaliação

* Separação de papéis por agentes distintos em contexto limpo, dentro do mesmo ambiente: não é revisão externa.
* Nenhum teste com pessoas, leitor de tela real, aparelho físico, Safari ou Firefox. As oito tarefas por quatro perfis são inspeção heurística de agentes, sem tempos nem taxas de sucesso.
* Produção não avaliada; só build local.
* Notas de rodadas diferentes vêm de avaliadores diferentes e não formam série estatística.
* As correções posteriores à rodada 3 (A1, A5, Saeb por disciplina, ressalva do denominador, Panorama em 320 px, CSV de mudança de base, link da ponte) foram verificadas só pelo executor.

## 8. Próximos passos que dependem de decisão

* Autorizar a abertura do PR da branch `claude/obee-avaliacao-educacao` para revisão (nenhum PR foi aberto e nenhum merge foi feito).
* Decidir se se faz uma rodada 4 de avaliação independente, cobrindo as correções posteriores à rodada 3 e os itens 1 e 2 da seção 4, antes de qualquer merge.
