# Modelo de auditabilidade

Todo número publicado precisa permitir o caminho gráfico → número → série → transformação → fonte original. Esse caminho é um objeto de dados, não um texto.

## Objeto `Proveniencia`

| Campo | Obrigatório | Conteúdo |
| --- | --- | --- |
| `indicador` | sim | nome legível |
| `natureza` | sim | OBSERVADO, CALCULADO, ESTIMADO, PREVISTO ou CENARIO |
| `fonte.orgao`, `fonte.dataset`, `fonte.recurso` | sim | identificação primária |
| `fonte.url_primaria`, `fonte.url_dataset` | sim | onde conferir |
| `fonte.licenca` | sim | condição de uso |
| `unidade`, `frequencia` | sim | |
| `periodo_referencia` | sim | início e fim |
| `publicado_pela_fonte_em` | quando existe | metadado da fonte |
| `capturado_em` | sim | captura da Scrutiniums |
| `validado_em` | sim | execução do pipeline que passou nas validações |
| `cobertura_historica` | sim | início e fim da série disponível |
| `transformacoes` | sim (lista, pode ser vazia para OBSERVADO) | passos determinísticos |
| `formula` | sim para CALCULADO | expressão |
| `snapshot` | sim | identificador e sha256 da captura usada |
| `versao_pipeline`, `versao_codigo` | sim | versão e commit |
| `revisoes_conhecidas` | sim (lista) | revisões detectadas entre vintages |
| `limitacoes` | sim (lista não vazia) | o que o dado não permite concluir |
| `download` | quando pertinente | CSV da série |

O tipo TypeScript `Proveniencia` (`src/lib/energia/tipos.ts`) espelha o contrato; o teste `energia-gold-contrato.test.ts` falha se qualquer indicador publicado não tiver natureza, fonte, período, snapshot e limitações, ou se um CALCULADO não tiver fórmula.

## Taxonomia de natureza

| Natureza | Regra de atribuição | Exemplo no domínio |
| --- | --- | --- |
| OBSERVADO | valor publicado pela fonte, sem transformação além de tipo e unidade | PLD horário (CCEE); EAR % (ONS); CMO semanal (ONS) |
| CALCULADO | transformação determinística da Scrutiniums | PLD médio diário; participação por fonte; percentil histórico |
| ESTIMADO | procedimento estatístico com incerteza | decomposições, ajustes sazonais |
| PREVISTO | valor para período futuro, com modelo, versão e snapshot | previsão do PLD (somente modelo em PRODUÇÃO) |
| CENARIO | condicional a hipótese declarada | "se a ENA ficar em X% da MLT" |

Observação: o CMO é publicado pelo ONS como resultado do modelo DECOMP; para a Scrutiniums é OBSERVADO (valor oficial), com a nota de que é saída de modelo da fonte.

## Proibições verificadas por teste

* número sem natureza; dado sem fonte; métrica calculada sem fórmula;
* ausência serializada como zero;
* CENARIO rotulado como previsão; PREVISTO sem modelo, versão e snapshot;
* classificação ("baixo", "alto") sem regra estatística publicada;
* contribuição de modelo rotulada como causa.

## Drawer "Sobre este dado"

Todos os campos acima, em linguagem direta, com os botões **Baixar série** e **Abrir fonte primária**. Em celular abre em tela cheia.

## Linhagem de previsões

```
SOURCE VINTAGE → FEATURE SNAPSHOT → MODEL VERSION → FORECAST RELEASE → REALIZED → SCORING
```

Cada elo guarda o identificador e o sha256 do anterior. Ver `PLD_GOVERNANCA_PREVISAO.md`.

## Claims didáticos

Afirmações conceituais (definições, mecanismos) ficam em `src/lib/energia/conteudo/*.ts` com fonte primária e estado de conferência (`CONFERIDO` contra documento acessado, com data; `PENDENTE` quando a fonte primária não foi acessada). Conteúdo `PENDENTE` não é exibido como definição: aparece como "verbete em preparação".
