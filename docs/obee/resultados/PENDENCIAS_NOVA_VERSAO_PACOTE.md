# Proposta de nova versão do pacote — não executar

13/10/2026. O inventário de `revisao-v3-pacote.json` continua com seus 54 arquivos e hashes originais. Nada abaixo é autorização para editar o pacote, recongelar a v3 ou preencher pareceres. Pesos propostos, `approved_weights: null`, `publication_ready: false`, trava do piloto e chave de desligamento do laboratório permanecem intactos.

## Alterações que dependem de nova edição

| Pendência | Evidência e correção proposta | Arquivos congelados potencialmente afetados |
|---|---|---|
| Validação de entradas no percentil | `habitacao_cenarios.percentiles_lower([1.0, None])` lança `TypeError` em `math.isfinite`. Propor validação explícita de tipo/ausência, com `ValueError` consistente, antes de qualquer cálculo. Testar também lista vazia, NaN e infinito | `pipeline/eficiencia_resultados/habitacao_cenarios.py` e seu teste |
| Peso zero | `habitacao_cenarios.aggregate({'a': 50, 'b': 10}, {'a': 1, 'b': 0})` aceita e retorna 50; `motor.aggregate` exige pesos positivos. Propor contrato uniforme de pesos estritamente positivos. Exclusão de medida deve ser cenário explícito com cesta reduzida e pesos positivos renormalizados | `habitacao_cenarios.py`, `motor.py` se necessário, testes e eventuais resultados dependentes |
| Cobertura de precisão das sete medidas | Integrar o complemento `precisao-cesta-completa.json` ao protocolo formal, se aprovado. A natureza da fonte não quantifica erro; novos erros só entram com método oficial adequado, reconciliação e revisão | `precisao_candidatas.py`, `PRECISAO_CANDIDATAS.md`, `precisao-candidatas*.json`, inventário e testes |
| Microdados municipais | Executar a rota apenas após decisão institucional e autorização de acesso. Se novos pesos/edições ou estimativas divergirem do SIDRA congelado, propor nova referência rastreável e recomputar todos os dependentes; não sobrescrever seeds antigos | Seeds, funções de coleta, protocolos e resultados congelados que dependam da nova edição |
| Unidade e limiar de habitação | Incorporar decisão humana de moradores/domicílios e >2/>3, com fundamento conceitual. A paginação da SIS consultada continua pendente. Não selecionar pelo ranking | `habitacao.py`, `habitacao_cenarios.py`, `cesta_conjunta.py`, `cesta-conjunta.*`, `CESTA_CONJUNTA_V3.md` e demais dependentes, conforme a decisão |

As duas reproduções de contrato acima foram feitas em 13/10/2026, sem escrita. Não modificam os resultados válidos já reproduzidos; tampouco justificam alterar silenciosamente o código cujo hash integra o pacote.

## Procedimento proposto com `freeze()`

1. O editor delimita uma **nova edição** e aprova seu escopo, antes de qualquer alteração congelada. Preservar a v3, manifesto, pareceres e status como evidência imutável.
2. Preparar cópias versionadas de código, documentação e insumos da nova edição, com mapa explícito de arquivos substituídos e motivos. A função `freeze()` atual contém nomes e identidade v3 fixos: **não a executar para sobrescrever o manifesto existente**. Propor, na nova edição, uma função/entrada de congelamento que receba inventário e identidade da nova versão e escreva novos caminhos, mantendo o verificador da v3 disponível.
3. Acrescentar os testes de contrato propostos, regenerar os resultados da nova edição e produzir uma comparação com a v3, distinguindo alteração de fonte, definição, aritmética e apresentação. Nenhuma escolha será otimizada pelo ranking.
4. Após revisão humana do conteúdo concreto, usar `freeze()` da **nova edição** para calcular os hashes e a nova identidade do pacote. Conferir inventário completo e reprodutibilidade; não editar hashes manualmente. O novo protocolo deve impedir sobrescrita de edição já congelada.
5. Abrir nova rodada de pareceres vinculada ao novo hash. Aprovações da v3 não são transportadas. Autenticidade e independência humana requerem verificação própria; relatórios de IA são complementares. Congelamento e pareceres não autorizam, por si, publicação.

**Ponto de parada:** esta proposta termina antes do passo 1. Nenhuma chamada de escrita a `freeze()`, alteração dos 54 arquivos, redefinição de pesos ou migração de parecer foi executada neste trabalho. Aprovação do PR de complementos não equivale a aprovação desta nova edição.
