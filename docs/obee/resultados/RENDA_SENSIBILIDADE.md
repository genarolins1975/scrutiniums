# Renda: interpretação e experimento separado

Verificado em 13/10/2026. A cesta preserva a **mediana nominal de julho de 2022**, em reais por morador elegível, sem ajuste espacial de preços. Fonte: [IBGE, Censo 2022, SIDRA 10295](https://sidra.ibge.gov.br/tabela/10295), variável 13534. As notas oficiais indicam resultados preliminares da amostra e exclusão de pensionistas, empregados domésticos e seus parentes. Evidências em `precisao-cesta-evidencias.json`.

Os valores publicados mostram amontoamento em números redondos e empates: **Rio de Janeiro, R$ 1.212,00; Porto Velho e São Luís, R$ 866,67**. Não permitem atribuir a causa do amontoamento, quantificar erro ou concluir igualdade de poder de compra. A ressalva aparece junto aos valores de renda do laboratório, na explicação da tabela e na coluna `renda_ressalva` do CSV; a mediana e os pesos não mudam.

## Adequação da média como sensibilidade

A variável **13431** mede a média mensal nominal domiciliar per capita na mesma tabela, ano, unidade e universo da mediana. Por isso serve para testar a dependência do resultado em relação ao **estimando de renda**. A justificativa é essa comparabilidade conceitual, definida antes da leitura dos resultados. A média dá maior influência à cauda superior e não substitui a mediana como descrição do morador central. Não corrige diferenças de preços, amontoamento ou falta de erros oficiais.

Foi reutilizada a aquisição oficial já preservada em `public/eficiencia/trabalho-renda/brutos/censo-renda.json`, capturada em **09/10/2026, 22:07:28 UTC**, conforme o manifesto de `snapshot.payload.gz.b64`; não se afirma nova captura de rede. Consulta original: [API SIDRA, 13431 e 13534, totais de sexo, cor ou raça e idade](https://apisidra.ibge.gov.br/values/t/10295/n1/all/n3/all/n6/all/v/13431,13534/p/2022/c2/6794/c86/95251/c58/95253).

SHA-256 do bruto conferido: `f3a411db4391e3603e391837688935e2c5749244fbd80bec757f4592859af83a`. O artefato complementar registra também os hashes do manifesto, piloto e cesta. As 26 medianas reconciliam exatamente com os valores originais congelados.

## Experimento reproduzível, referência julho de 2022

Gerador: `python3 scripts/obee_renda_sensibilidade.py`; conferência sem escrita: adicionar `--check`. Saída externa ao pacote: `sensibilidade-renda-media-v3.json`, com 26 linhas de renda e oito cenários conjuntos. Preserva coorte, demais seis medidas, quatro definições de habitação, dois modelos de pesos e normalização por postos médios. Aritmética racional nas comparações de escores preserva empates.

| Resultado calculado dos dados citados | Valor |
|---|---:|
| Correlação dos percentis de média e mediana | 0,970080 |
| Maior mudança absoluta no percentil de renda | 15,384615 pontos |
| Inversões estritas entre os 325 pares na renda isolada | 20 |
| Empates de renda desfeitos | 1 |
| Maior mudança de escore, pesos iguais | 2,197802 pontos |
| Maior mudança de escore, bloco material 40% | 1,538462 pontos |
| Inversões de escore nos oito cenários conjuntos | 2 a 7 pares por cenário |

São diferenças condicionais às estimativas publicadas, não intervalos, probabilidades ou evidência de significância. Não há escolha de estimando pelo ranking. O experimento não integra o seletor do laboratório nem substitui a cesta; permanece material complementar para revisão. `publication_ready` continua `false`, `approved_weights` continua `null` e a precisão municipal continua não quantificada.
