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


## Segunda entrega: encadeamento e inversões de comparação

O módulo `hierarquia.py` encadeia a normalização por componente, a média dos três pilares de cada capítulo e o agregado dos cinco capítulos. As referências devem estar validadas; perfis comparados precisam compartilhar edição, janela e âncoras de normalização. As duas geografias podem ser diferentes, mas os registros de cada perfil precisam corresponder ao território declarado.

O laboratório aplica 16 cenários: dez alterações nos pesos de capítulos e seis nos pesos comuns dos pilares, sempre um peso por vez em ±20%. O relatório mantém notas dos capítulos, agregado, diferenças, pesos efetivos e motivos de bloqueio. Uma mudança de sinal é registrada como inversão; empates numéricos (tolerância 1e-9 ponto) ficam separados. Essa tolerância é apenas computacional, não evidência de equivalência estatística.

Demonstração: perfil A tem notas de capítulos 95/50/70/70/70; perfil B tem 70/70/70/70/70. Cada capítulo sintético recebe três pilares iguais à sua nota. A começa abaixo de B e ultrapassa B em dois dos 16 cenários. Isso ilustra dependência dos pesos, não mede probabilidade ou frequência de inversão no mundo real. Dados ausentes tornam a comparação incomparável em todos os cenários, sem exclusão de capítulos.

```sh
python3 -m unittest pipeline.eficiencia_escores.test_calibracao pipeline.eficiencia_escores.test_hierarquia -v
python3 -m pipeline.eficiencia_escores.hierarquia --output docs/obee/calibracao/hierarquia-sintetica.json
```

17 testes locais aprovados (oito da calibração e nove hierárquicos). A saída continua interna e sintética. Esta entrega substitui a limitação anterior de operar somente em um nível: o encadeamento agora existe. Permanecem pendentes sensibilidade conjunta de múltiplos parâmetros, propagação das perturbações de âncoras pela hierarquia, validação empírica e critérios de aceitação. Nenhuma posição real ou nota pública foi produzida.

## Terceira entrega: demonstração interativa interna

`laboratorio-interativo.html` é um arquivo autossuficiente, sem bibliotecas externas ou requisições de rede. Abra-o em um navegador para editar os três pilares de qualquer um dos cinco capítulos dos perfis sintéticos A/B, observar a propagação das notas e comparar os 16 cenários. Os pesos da referência permanecem iguais; os pesos alternativos são exibidos na tabela. Alterações não persistem após recarregar.

Os controles “Sem dado”, “Equilibrar em 70” e “Restaurar exemplo” permitem examinar ausência, empate e a demonstração inicial. Valores ausentes bloqueiam o agregado; zero é preservado. Nenhuma ficha real ou rota pública é modificada.

Verificação: `node docs/obee/calibracao/verificar-laboratorio.cjs` compara a referência e os 16 cenários JavaScript com a saída Python versionada, incluindo inversões; verifica ausência, zero e empate. Os 17 testes Python também passaram. A inspeção visual e os testes de interação, responsividade e zoom em navegador permanecem pendentes: o navegador disponível bloqueou a abertura local por política de URL. Não se declara homologação visual desta entrega.

## Quarta entrega: referências propagadas até o agregado

`ancoras.py` aplica a mesma alteração de referência aos dois perfis comparados e propaga a nota normalizada pelo capítulo até o agregado. São 60 cenários: 15 componentes × duas âncoras (inferior/superior) × dois deslocamentos (±10% da amplitude original). Apenas uma âncora muda por cenário; os pesos ficam iguais e fixos. Esta entrega resolve a pendência anterior de propagação isolada de âncoras pela hierarquia.

A base precisa passar pelos bloqueios de elegibilidade, recorte e referências. Base incompleta produz relatório bloqueado sem cenários. As referências alternativas são hipóteses e retornam explicitamente `validated: false`; não são gravadas nas fichas nem aprovadas pelo experimento. O cálculo contrafactual reutiliza a elegibilidade da base apenas para operações internas. Não exporta registros candidatos como componentes elegíveis para publicação.

O relatório preserva a referência inicial, notas por capítulo, agregado, diferenças entre perfis, mudança do agregado contra a base, inversões e indicação de valores no piso/teto. “No limite” inclui igualdade exata com 0/100 e não significa necessariamente extrapolação ou erro de dado.

Resultado do exemplo sintético: 60 cenários, nenhuma inversão e três cenários com componente no limite da escala. Isso não demonstra estabilidade geral; o exemplo de pesos continua com duas inversões. Resultados dependem dos perfis e das hipóteses escolhidas.

```sh
python3 -m unittest pipeline.eficiencia_escores.test_calibracao pipeline.eficiencia_escores.test_hierarquia pipeline.eficiencia_escores.test_ancoras
python3 -m pipeline.eficiencia_escores.ancoras --output docs/obee/calibracao/ancoras-sinteticas.json
```

26 testes locais aprovados. A demonstração HTML continua dedicada aos pesos; esta entrega de âncoras é analítica, em Python/JSON. Permanecem pendentes variações simultâneas, critérios de aceitação, dados empíricos compatíveis e aprovação metodológica. Nenhuma nota real publicada.

## Quinta entrega: cenários conjuntos de pesos e referências

`conjunta.py` recebe uma lista explícita de cenários e aplica as mesmas hipóteses aos dois perfis. Cada cenário pode combinar pesos de capítulos, pesos comuns dos pilares e deslocamentos das duas âncoras de vários componentes. Os deslocamentos são frações da amplitude original; cada um deve ter módulo menor que 0,5. Pesos positivos, cesta completa, contexto compatível e referências-base explicitamente validadas continuam obrigatórios. Hipóteses retornam `validated: false`, sem alteração de fichas.

A demonstração usa um desenho fatorial 2⁴, totalizando 16 combinações dos extremos destes quatro fatores:

| Fator | Nível inferior | Nível superior |
|---|---:|---:|
| Peso bruto de Educação | 0,8 | 1,2 |
| Peso bruto de Acesso, comum aos capítulos | 0,8 | 1,2 |
| Âncora inferior de educação.acesso | −10% da amplitude | +10% da amplitude |
| Âncora superior de saúde.qualidade | −10% da amplitude | +10% da amplitude |

Demais pesos brutos permanecem em 1; participações efetivas são normalizadas e registradas. Demais referências ficam fixas. Os sinais se referem ao deslocamento da âncora, não à melhora do serviço. Os identificadores de componentes no código são `education.access` e `health.quality`.

Resultado sintético: oito inversões frente à comparação-base em 16 cenários; agregado A entre 68,1644 e 70,9385, B entre 69,3070 e 70,6863. As faixas são marginais entre cenários: não se deve comparar extremos de cenários diferentes como se fossem uma mesma hipótese. A frequência de inversões não é probabilidade, nem estimativa populacional. O desenho cobre os extremos dos quatro fatores selecionados, não todos os parâmetros ou valores intermediários.

```sh
python3 -m unittest pipeline.eficiencia_escores.test_calibracao pipeline.eficiencia_escores.test_hierarquia pipeline.eficiencia_escores.test_ancoras pipeline.eficiencia_escores.test_conjunta
python3 -m pipeline.eficiencia_escores.conjunta --output docs/obee/calibracao/conjunta-sintetica.json
```

35 testes locais aprovados. Incluem identidade sem mudanças, equivalência ao teste isolado de âncora, reprodutibilidade, preservação dos insumos, ausência, zero, empate e rejeição de cenários inválidos. Esta entrega resolve a capacidade técnica de testar mudanças simultâneas. Permanecem pendentes a seleção empírica de hipóteses plausíveis, dependências entre indicadores, critérios de aceitação, cobertura real e aprovação metodológica. O HTML continua restrito à análise de pesos; não houve alteração visual ou publicação.
