# Decisão editorial: edição v4 do índice de resultados

14/10/2026 · Decisões do titular do repositório (`genarolins1975`), tomadas em resposta a quatro perguntas formuladas pela assistência técnica que implementou a edição. As alternativas, a evidência de cada uma e a recomendação técnica estavam à vista no momento da escolha.

## O que foi decidido

| Questão | Decisão | Fundamento registrado |
|---|---|---|
| Promessa ao leitor | **Resultados na vida dos moradores**, sem atribuição de causa ou responsabilidade a um governo | Os sete indicadores descrevem condições observadas nos territórios. Nenhum deles liga gasto ou serviço a resultado, nem separa as competências de União, estado e município |
| Habitação, unidade | **Moradores** (SIDRA 9940) | O índice trata da vida das pessoas; a parcela de moradores expostos é o estimando coerente com essa promessa |
| Habitação, limiar | **Mais de 3 moradores por dormitório** | Conceito de adensamento excessivo do IBGE, SIS 2018, p. 63 do PDF (sem numeração impressa), e conceito histórico da FJP, p. 62 impressa. O limiar de 2 não tem respaldo de conceito oficial como regra geral |
| Pesos | **Iguais, 1/7 por indicador** | Regra mais simples de explicar e auditar. O bloco material de 40% da v3 foi proposto para preservar a v2, o que não é justificativa de conteúdo |
| Publicação | **Página principal do OBEE, área logada**, como edição experimental | A nota aparece com contribuições, faixa de sensibilidade, aviso de inversão possível por par, ressalva de precisão, memória de cálculo e CSV |

As escolhas de habitação e de pesos foram feitas por fundamento conceitual, antes de calcular as notas da v4. Nenhuma foi selecionada pelo efeito na ordem das capitais.

## O que a decisão não faz

* **Não é revisão independente.** Os seis critérios do pacote v3 continuam pendentes e não são transportados. A v4 abre seu próprio ciclo de revisão, vinculado ao `packet_sha256` de `pacote-v4.json`.
* **Não quantifica a precisão municipal.** As sete medidas seguem com erro municipal não quantificado. A rota proposta em `PRECISAO_ROTA_MICRODADOS.md` depende de acesso institucional ainda não solicitado.
* **Não altera a v3.** Os 54 arquivos do pacote v3, seus pareceres e seu status permanecem intactos. A v4 lê as mesmas fontes congeladas e grava apenas em `docs/obee/resultados/v4/`.
* **Não incorpora Saúde.** O capítulo continua sem medida municipal qualificada.
* **Não transforma o índice em nota de gestão.** O texto público mantém a regra editorial: nenhuma conclusão sobre eficiência, desperdício ou responsabilidade.

## Correções de contrato incorporadas

As duas falhas reproduzidas em 13/10/2026 (`PENDENCIAS_NOVA_VERSAO_PACOTE.md`) foram corrigidas no código da v4, sem editar os arquivos congelados da v3:

1. `percentiles` recusa lista vazia, ausência, valor não numérico, booleano, NaN e infinito com `ValueError`.
2. `aggregate` exige pesos racionais estritamente positivos com soma exata 1. Peso zero é recusado; retirar uma medida é cenário explícito com pesos renormalizados.

## Pendências que continuam abertas

Revisão humana independente da v4; precisão municipal das medidas amostrais; Saúde; nome público definitivo do índice; protocolo de registro de análises por IA (`PROTOCOLO_REVISAO_IA_PROPOSTA.md`).
