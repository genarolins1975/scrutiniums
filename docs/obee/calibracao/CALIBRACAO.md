# Etapa 5 — laboratório de calibração

Primeira entrega técnica da etapa 5. A etapa 4 permanece aberta: participação, denominadores e outros componentes reais ainda não estão completos. Não há aprovação empírica de pesos, referências ou escores nesta entrega.

## O que foi implementado

- Média geométrica ponderada com os mesmos bloqueios da fundação: cesta completa, valores válidos, referências validadas e contexto compatível.
- Sensibilidade de pesos: um componente por vez recebe fator 0,8 ou 1,2, partindo de pesos iguais. Toda a cesta é renormalizada; nenhum componente desaparece ou ganha peso zero.
- Sensibilidade de referências: cada âncora se desloca isoladamente em ±10% da amplitude original. Direção e limites 0–100 seguem a normalização existente. Âncoras alternativas são hipóteses, não referências aprovadas.
- Saída interna separada dos arquivos públicos, com casos explicitamente sintéticos e sem nomes de cidades.

Os fatores ±20% e ±10% são escolhas exploratórias deste laboratório, não parâmetros OBEE aprovados. A faixa entre cenários não é intervalo de confiança nem medida de erro amostral. O teste varia uma hipótese por vez; não cobre mudanças simultâneas, dependência entre indicadores ou toda a incerteza metodológica.

## Exemplos sintéticos

| Acesso / resposta / qualidade | Escore com pesos iguais | Interpretação matemática |
|---|---:|---|
| 70 / 70 / 70 | 70,0 | Alterar os pesos não afeta componentes iguais |
| 95 / 95 / 20 | 56,5 | O componente baixo reduz fortemente a média geométrica |
| 80 / 0 / 75 | 0,0 | Zero observado é preservado |
| 80 / ausente / 75 | Bloqueado | Ausência não vira zero nem é excluída da cesta |

São demonstrações da fórmula, sem diagnóstico sobre qualquer território. O valor zero deve ser debatido na calibração empírica: uma referência que leve um componente ao piso pode zerar o agregado geométrico. Não foi introduzido epsilon para contornar essa propriedade.

## Como usar na arquitetura do escore

Aplicar a análise primeiro aos três pilares de cada capítulo. Depois, aplicar aos cinco capítulos completos da cesta experimental. Não misturar diretamente indicadores brutos de unidades distintas. A implementação opera em um nível por chamada; não entrega uma análise hierárquica conjunta ou um ranking de cidades.

A análise de referências retorna resultados normalizados de um componente. Ela não recalcula automaticamente a hierarquia inteira. Quando as fichas reais forem validadas, será necessário encadear normalização, nota do capítulo e agregado com versões e recortes compatíveis.

## Execução e verificação

```sh
python3 -m unittest pipeline.eficiencia_escores.test_calibracao -v
python3 -m pipeline.eficiencia_escores.calibracao --output docs/obee/calibracao/cenarios-sinteticos.json
```

Oito testes locais aprovados: equivalência à fundação com pesos iguais; invariância no caso equilibrado; bloqueios por ausência, referência e contexto; zero; direção da sensibilidade; parâmetros inválidos; preservação das referências originais; separação entre demonstração e dados reais.

## Condições para concluir a etapa 5

1. Completar ao menos dois territórios com a mesma cesta, período e recortes validados.
2. Definir referências por indicador e avaliar concentração nos pisos/tetos.
3. Examinar sensibilidade conjunta, correlação e duplicação entre componentes.
4. Avaliar estabilidade das comparações sob cenários; definir critérios de aceitação antes de publicar.
5. Documentar a escolha dos pesos e suas consequências. Submeter versão metodológica à aprovação.

As 15 fichas da edição atual seguem com referências não validadas. O laboratório não transforma disponibilidade de dados em qualidade do serviço, satisfação do cidadão ou eficiência causal.
