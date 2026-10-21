# Índice de resultados na vida dos moradores: metodologia da edição v4

Edição `indice-resultados-2022-v4` · referência 2022 · 26 capitais estaduais, sem o Distrito Federal · experimental, publicada na área logada. Decisões em [DECISAO_EDICAO_V4.md](DECISAO_EDICAO_V4.md).

## O que o índice mede

Sete resultados observados na vida de quem mora em cada capital. A nota resume a posição relativa da capital nesses sete resultados, entre as 26 capitais estaduais em 2022.

O índice **não** mede eficiência, satisfação, qualidade de um serviço específico ou efeito de uma gestão. Não atribui o resultado a prefeitura, governo estadual ou União. Saúde não está incluída: ainda não há medida municipal qualificada.

| Indicador | Direção | Fonte | Período |
|---|---|---|---|
| Frequência escolar de 4 e 5 anos (%) | maior é mais favorável | IBGE, Censo 2022, SIDRA 10056 | 2022 |
| Renda domiciliar por pessoa, mediana (R$ nominais) | maior é mais favorável | IBGE, Censo 2022, SIDRA 10295 | julho de 2022 |
| Mais de uma hora até o trabalho (%) | menor é mais favorável | IBGE, Censo 2022, SIDRA 10330 | 2022 |
| Esgotamento por rede ou fossa séptica (%) | maior é mais favorável | IBGE, Censo 2022, SIDRA 6805 | 2022 |
| Homicídios estimados por 100 mil habitantes | menor é mais favorável | Ipea e FBSP, Atlas da Violência 2024, tabela 3 | 2022 |
| Moradores em domicílios com mais de 3 por dormitório (%) | menor é mais favorável | IBGE, Censo 2022, SIDRA 9940 | 2022 |
| Domicílios com acesso à internet (%) | maior é mais favorável | IBGE, Censo 2022, SIDRA 9936 | 2022 |

## Como a nota é calculada

1. **Posição em cada indicador.** Para cada capital e indicador: `100 × (capitais com resultado menos favorável + metade das capitais com resultado igual) ÷ 26`. Uma posição de 75 significa que o resultado da capital é mais favorável que o de três quartos das capitais da referência.
2. **Nota.** Média simples das sete posições: cada indicador pesa 1/7. A nota vai de 0 a 100; a média das 26 capitais é 50 por construção, e 50 não é meta.
3. **Contribuição.** A nota é a soma exata das sete contribuições, cada uma igual à posição dividida por 7. A contribuição centrada, `(posição − 50) ÷ 7`, mostra quanto cada indicador afasta a capital da posição mediana.
4. **Aritmética.** Posições, notas, contribuições e limites de sensibilidade são calculados com frações exatas. A nota exata de cada capital está no campo `score_fraction`. Nenhum empate ou inversão é decidido com números arredondados.

A média permite compensação: um resultado desfavorável em um indicador pode ser compensado por outro. As distâncias nas unidades originais se perdem na posição relativa; por isso os valores originais aparecem ao lado de cada posição.

## Testes de sensibilidade

Declarados antes do cálculo das notas da v4. São cenários determinísticos, não intervalos de confiança.

| Família | Hipóteses |
|---|---|
| Pesos | Cada peso entre 75% e 125% de 1/7, com soma 1. Família contínua; os limites exatos são obtidos por programação linear |
| Habitação | Domicílios acima de 2, domicílios acima de 3 e moradores acima de 2, uma definição por vez |
| Definições | Saneamento apenas rede; homicídios apenas registrados; renda média (SIDRA 10295, variável 13431) em vez da mediana |
| Retirada | Retirar um indicador por vez; os seis restantes com pesos iguais |

A **faixa** de cada capital vai do menor ao maior valor da nota nessas quatro famílias. Para comparar duas capitais, os limites são calculados com as duas sob a mesma hipótese; subtrair extremos de faixas diferentes seria incorreto.

Cada par recebe uma classe: **ordem mantida** em todos os testes; **pode empatar** (algum teste leva a diferença a zero, sem inverter); **pode inverter** (algum teste inverte a ordem); **empate** (notas iguais na edição).

## Resultados da edição

Calculados em 14/10/2026 a partir das fontes congeladas listadas em `input_evidence` de `indice-resultados-v4.json`.

| Medida | Valor |
|---|---:|
| Pares com ordem mantida em todos os testes | 261 de 325 |
| Pares que podem inverter | 61 |
| Pares que podem empatar, sem inverter | 2 |
| Pares empatados na edição | 1 (Boa Vista e Recife) |
| Pares com dominância em todos os sete indicadores | 55 |
| Pares que podem inverter com pesos entre 50% e 150% de 1/7 | 82 |
| Nota mínima e máxima | 11,26 e 89,84 |

Entre os 61 pares que podem inverter, a inversão aparece na retirada de um indicador em 57, na família de pesos em 51, nas definições alternativas em 14 e nas definições de habitação em 7. Um par pode aparecer em mais de uma família.

| Capital | Nota | Faixa nos testes |
|---|---:|---:|
| Aracaju | 56,32 | 53,21 a 61,54 |
| Belém | 29,40 | 24,36 a 33,33 |
| Belo Horizonte | 73,35 | 69,64 a 82,69 |
| Boa Vista | 35,99 | 25,64 a 42,17 |
| Campo Grande | 60,16 | 57,05 a 64,74 |
| Cuiabá | 57,97 | 51,92 a 60,90 |
| Curitiba | 82,69 | 79,53 a 88,46 |
| Florianópolis | 89,84 | 81,59 a 92,95 |
| Fortaleza | 36,54 | 31,41 a 39,74 |
| Goiânia | 70,60 | 66,48 a 78,21 |
| João Pessoa | 60,71 | 58,97 a 62,23 |
| Macapá | 17,31 | 7,05 a 20,74 |
| Maceió | 31,04 | 26,92 a 34,62 |
| Manaus | 11,26 | 8,33 a 12,82 |
| Natal | 40,93 | 37,82 a 44,87 |
| Palmas | 66,21 | 62,18 a 69,87 |
| Porto Alegre | 61,26 | 56,32 a 68,59 |
| Porto Velho | 31,32 | 22,76 a 35,85 |
| Recife | 35,99 | 33,24 a 39,29 |
| Rio Branco | 34,34 | 24,36 a 39,84 |
| Rio de Janeiro | 47,53 | 42,58 a 54,49 |
| Salvador | 37,09 | 29,49 a 43,54 |
| São Luís | 37,36 | 29,81 a 41,35 |
| São Paulo | 59,07 | 53,71 a 68,59 |
| Teresina | 52,47 | 45,51 a 57,69 |
| Vitória | 83,24 | 80,49 a 88,46 |

Ordem alfabética. Valores arredondados a duas casas; os valores completos estão no JSON e no CSV.

## Mudança em relação à candidata v3

Comparação com o cenário de referência da v3 (`conjunta__domicilios_gt2__materiais_40pct`). A mudança de cada capital é decomposta, sem resíduo, em efeito da definição de habitação (domicílios acima de 2 para moradores acima de 3, com os pesos da v3) e efeito dos pesos (40% material para pesos iguais, com a nova definição).

| Medida | Valor |
|---|---:|
| Mudança absoluta média da nota | 2,62 pontos |
| Maior mudança absoluta | 7,80 pontos (Porto Alegre, inteiramente efeito dos pesos) |
| Pares com ordem invertida entre v3 e v4 | 21 de 325 |

A mudança de cesta não é evolução no tempo: dados, coorte e ano de referência são os mesmos.

## Limitações

* **Precisão municipal não quantificada.** Cinco medidas vêm da amostra do Censo, sem erro municipal publicado; homicídios combinam registros e modelo; saneamento é dado do universo. Diferenças pequenas entre notas não devem ser lidas como diferenças certas.
* **Cobertura parcial.** Sete indicadores não representam os 16 temas do observatório. Saúde está ausente.
* **Referência fixa de 2022.** A nota é relativa às 26 capitais naquele ano; não mostra evolução.
* **Renda nominal.** Sem ajuste de preços entre cidades.
* **Sem causalidade.** O índice descreve resultados; não identifica quem os produziu.

## Reprodução e integridade

```sh
python3 -m pipeline.eficiencia_resultados.indice_v4 --check      # recalcula e confere as saídas
python3 -m unittest pipeline.eficiencia_resultados.test_indice_v4
python3 -m pipeline.eficiencia_resultados.indice_v4 --verificar  # confere os hashes do pacote v4
```

O pacote `pacote-v4.json` fixa por SHA-256 o código, as saídas, estes documentos e as fontes. A função de congelamento recusa sobrescrever um pacote existente com conteúdo diferente: qualquer alteração exige nova edição.
