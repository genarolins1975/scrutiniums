# Validação da etapa inicial

Execução de 08/10/2026, ambiente de nuvem do Claude Code (Linux, Node 22, Python 3.13, Chromium headless via Playwright). Verificações de produto, não de governos: conferem cálculo, integridade, perímetros, interface e linguagem.

## 1. Dados e método (pipeline)

Validações automáticas, executadas a cada `python3 -m pipeline.eficiencia.run` (resultado completo em `validacoes` da gold e na seção Métodos e fontes do painel):

| Id | Verificação | Resultado |
| --- | --- | --- |
| V01 | Códigos IBGE das 26 capitais e do DF conferem com a lista de entes do Siconfi | Aprovada (27 capitais no Siconfi) |
| V02 | Integridade dos arquivos do INEP pelo MD5 publicado no pacote | Aprovada com divergência documentada: ATU 2022 `.xlsx` não confere; lido o `.ods`, que confere; 380 linhas das capitais idênticas entre os dois |
| V03 | DCA: soma das funções = total exceto intraorçamentárias; soma das subfunções = função Educação | Aprovada em 130 de 130 declarações (tolerância R$ 1,00) |
| V04 | DCA × RREO do 6º bimestre, despesa liquidada na função Educação | 125 iguais; 3 com diferença abaixo de 0,03%; 2 materiais explicadas ou registradas (Campo Grande 2021, intraorçamentárias; Boa Vista 2024, RREO incompatível) |
| V05 | Partição das matrículas por etapa reconcilia com `QT_MAT_BAS` | Aprovada em 42.201 registros de escola municipal |
| V06 | Somas dos microdados × Sinopse Estatística do INEP (2021, 2024, 2025) | 260 comparações, 0 diferenças |
| V07 | Sem duplicidade de escola no Censo nem de conta e coluna na DCA | Aprovada |
| V08 | Nenhuma observação do DF no recorte municipal | Aprovada |
| V09 | Só observação "observado" tem valor; ausência nunca vira zero | Aprovada (6.667 observações; 169 sem valor, todas com motivo) |
| V10 | Unidades e faixas possíveis de cada medida | Aprovada |
| V11 | Ideb publicado = N × P na mesma linha | Aprovada em 542 combinações |
| V12 | Aprovação nos anos iniciais: planilha do Ideb × taxas de rendimento | 78 pares, 0 diferenças |
| M01 | Medição do perímetro despesa × matrículas | Conveniadas com o município entre 0,0% e 49,7% da rede municipal em 2025 (mediana 3,9%) |

Comparação com a fonte original, não só com outro cálculo: V06 (publicação tabular do INEP), V04 (outro demonstrativo do Tesouro), V11 e V12 (componentes e outra publicação do INEP), trilhas de reprodução por indicador (gold, `trilhas`).

Idempotência: duas execuções seguidas com o mesmo seed produzem o mesmo `hash_dados` e CSVs idênticos byte a byte (conferido por sha256 e pelo teste `test_reconstrucao_idempotente`).

## 2. Testes automatizados

| Conjunto | Comando | Resultado |
| --- | --- | --- |
| OBEE, pipeline | `python3 -m unittest pipeline.tests.test_eficiencia` | 20 testes, todos aprovados |
| OBEE, interface e consulta | `npx vitest run src/tests/obee-educacao.test.ts` | 43 testes, todos aprovados |
| Suíte Python do repositório | `python3 -m unittest discover -s pipeline/tests -t .` | 1.236 testes aprovados, 6 ignorados (com `pyarrow` instalado, como no CI) |
| Suíte `pesquisa` | `python3 -m unittest discover -s pesquisa/tests -t .` | 69 aprovados |
| Suíte vitest do repositório | `npx vitest run` | 2.507 aprovados, 1 ignorado (133 arquivos) |
| Tipos e lint | `npx tsc --noEmit`; `npm run lint` | Sem erros |
| Build de produção | `npm run build` | Concluído; rota estática, 20,3 kB de JavaScript próprio, 116 kB no primeiro carregamento |

Os testes do OBEE cobrem os casos específicos pedidos: período financeiro diferente do educacional (edição do Ideb declarada no cartão e na tabela), rede estadual na capital fora da rede municipal (São Paulo: 702.936 na rede × 2.512.355 no território em 2025), despesa ampla demais para o denominador (razão não publicada), dado não divulgado (códigos ND preservados), composição que não reconcilia (estado inconsistente; nenhum caso ocorreu), poucos pares (aviso abaixo de 3 capitais), quebra de série (2021 anotado), download igual ao exibido, DF fora do recorte, falha de atualização (estado "ausente na coleta"; coleta com novas tentativas e erro registrado no manifesto).

## 3. Interface no navegador

Roteiros em `scripts/obee/` (Playwright global, `PLAYWRIGHT_DIR`), executados contra o build de produção (`next start`):

* `interacoes.mjs`: **27 de 27** checagens aprovadas. Filtros alteram valores; capital, ano, etapa, medida, grupo e ordem gravados na URL; link copiado reabre o mesmo recorte; parâmetros inválidos voltam ao padrão; Ideb com etapa creche mostra estado de escopo; ano par mostra aviso da edição bienal com botões, sem troca silenciosa; passaporte abre em diálogo com os 16 campos, fecha com Esc e não altera a URL; grupo regional e ordenação por valor; CSV da tabela com as mesmas linhas exibidas; CSV da comparação com incluídas e excluídas; "voltar ao recorte inicial"; 26 capitais sem Brasília; Rio Branco anos finais como "não aplicável"; Campo Grande 2021 como "não comparável"; dica do gráfico por teclado; nenhum erro de página.
* `capturas.mjs`: 1440, 768, 390 e 320 px, sem rolagem horizontal da página; nenhum erro ou aviso de console; **axe-core** (WCAG 2.0, 2.1 e 2.2, níveis A e AA) sem violações em 1440 e 390 px.
* `desempenho.mjs` (local, não é medição de campo): sem limitação, TTFB 41 ms, LCP 220 ms, CLS 0, TBT 46 ms; com CPU 4× mais lenta e rede emulada de 1,6 Mbps e 150 ms de latência, LCP 1,33 s, CLS 0,03, TBT 1,46 s. HTML de 129 kB comprimido. O TBT sob limitação vem da hidratação do painel (tarefa T3 em CONTINUIDADE.md).

Contraste dos tokens do OBEE testado em `obee-educacao.test.ts` (texto ≥ 4,5:1 sobre superfície, papel e fundo do domínio; neutro dos pares ≥ 3:1). Paleta de seleção validada pelo script da skill de visualização (separação para daltonismo ΔE 10,8; visão normal ΔE 15,7).

Ajustes feitos depois da primeira rodada de capturas: rótulo de valor cortado na comparação (margem direita), nomes de capitais cortados no celular (margem esquerda proporcional), sobreposição de rótulos do eixo a 320 px (duas marcas), casas decimais supérfluas nos eixos, separador decimal em textos de validação, colunas da tabela auditável.

## 4. Neutralidade

* Teste automático varre componentes, página, consulta, catálogo, notas e validações em busca de termos avaliativos ("eficiente", "desperdício", "melhor", "pior", "ranking", "insight", "merece atenção", "sinaliza", "excesso" e outros) e de cores de semáforo ou hexadecimais soltos nos componentes: nenhuma ocorrência.
* Revisão manual (interna) dos títulos, legendas, dicas, cores, ordenação, textos alternativos, exportações e mensagens: cor só para seleção; ordem inicial alfabética; mediana descrita como estatística do grupo, não referência; variações numéricas sem seta nem cor; nenhuma conclusão sobre redes ou governos.

## 5. O que não foi feito

* Revisão externa da metodologia: não realizada.
* Medição de desempenho em campo (usuários reais): não realizada; os números acima são de laboratório.
* Leitor de tela real (NVDA, VoiceOver): não testado; a verificação de acessibilidade foi automática (axe) e por navegação de teclado.

## 6. Capturas

Em `capturas/`, a partir do build de produção:

1. `01-desktop-1440-topo.png`
2. `02-desktop-1440-orientacao-e-series.png`
3. `03-desktop-1440-comparacao-e-composicao.png`
4. `04-desktop-1440-tabela-e-metodos.png`
5. `05-tablet-768-topo.png`
6. `06-celular-390-topo.png`
7. `07-estreito-320-comparacao.png`
8. `08-desktop-dica-por-teclado.png`
