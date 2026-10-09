# Saúde nas capitais: arquitetura e reutilização

## 1. Cadeia de dados

```
fonte oficial → seed (recorte + manifesto: URL, data, sha256) → padroniza.py (observação tipada) → derivados.py
             → validacoes.py (S01 a S16, M01 a M05) → gold.py (JSON + CSVs) → promove (atômico) → interface
```

| Etapa | Arquivo | Regra |
| --- | --- | --- |
| Coleta | `pipeline/eficiencia_saude/fontes/{siconfi,siops,cnes,relatorio_aps,ripsa}.py` | Só com `--coleta-*`; a reconstrução padrão não usa rede. Coletas longas são retomáveis |
| Seed | `pipeline/eficiencia_saude/seed/` (4,5 MB) e `manifesto.json` | Recortes versionados. O arquivo oficial grande não entra no git: entra o recorte com hash |
| Conferência da despesa | `conferencia.py` | Política 1.2 de Educação aplicada à função 10: DCA × RREO 02 e, na diferença material, MSC de dezembro (saldo líquido C menos D; modalidade 91 é intraorçamentária) |
| Padronização | `padroniza.py` | Observação tipada: indicador, ente, ano, componente, valor, status, nota, elegibilidade, registro de origem e cálculo (numerador e denominador). Ausência nunca vira zero |
| Derivados | `derivados.py` | Natureza (pessoal, outras correntes, capital) só se a soma reproduz a DCA com tolerância de R$ 1,00 |
| Validações | `validacoes.py` | 16 automáticas e 5 medições. Uma reprovada impede a promoção |
| Referências | `pipeline.eficiencia.referencias` (compartilhado) e `referencias_externas.py` | Mediana, média, quartis e razão agregada calculados no pipeline sobre as observações elegíveis, por grupo (todas e regiões). A razão agregada sai na unidade do indicador (fator por 10 mil, por 100 mil ou em %), registrado em cada linha. Mínimo legal de 15% e referência nacional com fonte e data |
| Gold e séries | `gold.py` | `public/eficiencia/gold/saude_capitais.json` (6,2 MB) e 24 arquivos `sau_*` e `saude_*` em `public/eficiencia/series/` (23 CSV e o manifesto das capturas em JSON), com fonte legível, endereço e data de captura em cada linha |
| Promoção | `gold.promove` | Gera tudo numa área de trabalho e só substitui a saída pública sem validação reprovada; em falha, grava diagnóstico e mantém a última versão válida |

Estados de dado (`OBSERVADO`, `NAO_APLICAVEL`, `NAO_DIVULGADO`, `AUSENTE_NA_COLETA`, `INCONSISTENTE` e outros) são os de Educação (`base.STATUS`). Elegibilidade para comparação é um campo separado do estado: a observação pode ter valor oficial e estar fora das medianas.

## 2. Interface

| Camada | Arquivos | Papel |
| --- | --- | --- |
| Rotas | `src/app/eficiencia-estatal/page.tsx` (entrada) e `src/app/eficiencia-estatal/saude-capitais/{page,gastos,rede-e-atencao-primaria,atendimento-e-resultados,comparar,metodos}` | Páginas estáticas (`force-static`); cada uma recebe só os indicadores de que precisa (`INDICADORES_DA_PAGINA`) |
| Leitura da gold | `src/lib/eficiencia/saude/dados.ts`, `payload.ts` | Payload compacto por página (tuplas); `payload.ts` não importa `node:fs`, por isso é seguro no cliente |
| Medidas | `medidas.ts` | 10 medidas selecionáveis (despesa, despesa por habitante, ASPS, UBS, eSF, eAP, cobertura APS, ICSAP taxa, ICSAP número, participação) com definição, o que não é, unidade e formato |
| Consulta | `consulta.ts` | Seleciona, ordena e monta linhas. Nenhum cálculo contábil: referências e elegibilidade vêm da gold. Mesma regra para gráfico, resumo, tabela e CSV |
| Texto | `frases.ts`, `contexto.ts` | Frases factuais geradas dos dados; contexto de validações por indicador |
| Estado | `rotas.ts` e `useEstadoUrl` (compartilhado) | Parâmetros `cap vs med ano moeda den vis ord dir grp reg`; recorte compartilhável por link |
| Componentes | `src/components/eficiencia/saude/` | Cabeçalho, navegação, explorador de tema, panorama, comparador, referências, detalhes por tema, catálogo e ficha |

Primeira tela a 1440 por 900: a pergunta, o seletor e o gráfico principal ficam acima da dobra, em duas colunas (controles e definição à esquerda, visual à direita). Em telas estreitas, as colunas se empilham e as tabelas largas têm rolagem local.

## 3. Reutilização de Educação e isolamento

| Reutilizado (componentes e utilitários) | Alteração necessária |
| --- | --- |
| `MiniSerie`, `DistribuicaoCapitais`, `FaixaResumo`, `BarrasComposicao`, `Selecao`, `Alternancia`, estados vazios e de erro, `TabelaSimples`, `useEstadoUrl`, `formato.ts` | `DistribuicaoCapitais` ganhou `alturaLinha` opcional (padrão igual ao anterior) |
| `FichaConteudo` e `SobreEsteDado` (ficha de 16 campos) | Prop `codigo` para o rótulo de conferência; tipo `FichaExibivel` em `tipos.ts`; valor `regra_aplicada_com_pendencias` |
| `Siglas` | Siglas de Saúde (SUS, SIOPS, CNES, APS, ASPS, ICSAP, RIPSA, SIH, AIH, ANS, UBS, eSF, eAP) |
| `pipeline/eficiencia` (entes, população, IPCA, referências, conferência) | Importados, nunca alterados; o hash do gerador de Saúde inclui o código de Educação de que depende |

Isolamento verificado por teste: promoção em área isolada grava apenas arquivos `saude_*` e `sau_*`; os hashes dos arquivos `edu*` e `ctx_populacao_residente*` não mudam; componentes de Saúde não importam `goldEducacao` nem `dadosPainel`.

## 4. Integração ao site

`/eficiencia-estatal` virou página de entrada com os dois módulos. Registro em `src/lib/dominios.ts` (rota raiz e descrições), cabeçalho público, rodapé, mapa do site e a SPA do Crédito (`public/obs/index.html`) apontam para a entrada. O redirecionamento antigo para Educação foi removido de `next.config.mjs`.

## 5. Como acrescentar uma medida

1. Ficha em `catalogo_indicadores.json` (16 campos e estado de publicação). Sem ficha, sem número.
2. Coletor em `fontes/` e linha no manifesto; padronização em `padroniza.py` com estados e elegibilidade.
3. Validação em `validacoes.py` que reprove o defeito plausível (teste com defeito injetado em `test_eficiencia_saude.py`).
4. Entrada em `MEDIDAS_SAUDE`, indicador em `INDICADORES_DA_PAGINA` e validações em `VALIDACOES_DO_INDICADOR_SAUDE`.
5. `python3 -m pipeline.eficiencia_saude.run` e `python3 -m pipeline.eficiencia_saude.documenta`.
