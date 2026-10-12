# Resultados para o Cidadao: piloto tecnico 2022

Decisao de 12/10/2026, autorizada na conversa: substituir, para o novo indice descritivo, a exigencia uniforme de acesso/resposta/qualidade por uma cesta fixa de resultados e condicoes de vida. Implementacao em namespace proprio `pipeline/eficiencia_resultados`; as fichas anteriores continuam documentando um construto diferente de qualidade dos servicos.

## Entrega desta etapa

Motor de percentis com referencia congelada, agregacao aritmetica, limites de identificacao para ausencias, matriz de cobertura e calculo real para 26 capitais estaduais. Nao e o escore integral do OBEE, nem nota de eficiencia, satisfacao ou avaliacao causal do governo. Os tres indicadores nao equivalem a tres capitulos completos. Dados de 2022: nao descrevem automaticamente a situacao atual de 2026.

A cesta foi selecionada por coerencia temporal e disponibilidade ja auditada, sendo um piloto de implementacao. Sua validade de conteudo como resumo amplo da vida do cidadao ainda depende de expansao para saude, saneamento e seguranca. `publication_ready=false` preserva essa distincao; os resultados numericos sao reais, nao sinteticos.

## Cesta e cobertura

| Indicador examinado | Cobertura | Decisao |
|---|---:|---|
| Frequencia escolar, residentes de 4 a 5 anos, 2022 | 26/26 | Entra; maior e melhor; redes publica e privada |
| Mediana da renda domiciliar por pessoa, julho de 2022 | 26/26 | Entra; maior e melhor; reais nominais, resultado preliminar da amostra |
| Parcela com mais de uma hora ate o trabalho, 2022 | 26/26 | Entra; menor e melhor; universo de deslocamento definido na fonte |
| Cobertura potencial APS, dezembro de 2025 | 26/26 | Excluida: capacidade teorica e periodo distinto |
| Aprendizagem ou Ideb municipal total | Nao auditada nesta etapa | Proxima revisao; evitar dupla contagem com componentes do Ideb |
| Mortalidade infantil, vacinacao | Nao auditada nesta etapa | Conferir janela, denominadores e cobertura |
| Agua e esgotamento adequado | Nao auditada nesta etapa | Conferir conceitos e cobertura municipal |
| Mortalidade por violencia | Nao auditada nesta etapa | Conferir residencia/ocorrencia, causas e janela |

A matriz JSON distingue cobertura numerica de pertinencia conceitual. Fonte detalhada, universo e ressalvas continuam no panorama original. A copia local foi conferida contra o blob Git da branch antes do calculo; o motor confere SHA-256 desse snapshot. Isso verifica integridade da entrada versionada, nao constitui nova coleta primaria.

## Contrato de calculo

Referencia: 26 capitais, sem DF, distribuições de 2022 explicitamente armazenadas em `referencia-2022-v1.json`. Mesmo conjunto para todos os indicadores. Cada capital pesa igualmente na distribuicao de referencia; nao e media populacional do Brasil.

Pontuacao = 100 x (numero de referencias piores + metade das iguais) / N. Empates exatos na precisao publicada recebem a mesma pontuacao. A polaridade de deslocamento e invertida. Um novo valor pode chegar a 0 ou 100 fora da referencia. Na edicao-base, os extremos sem empate sao aproximadamente 1,92 e 98,08. A media da referencia e 50 por construcao; nao e um diagnostico de desempenho satisfatorio.

A referencia e congelada: alteracao dos bytes de entrada interrompe a reproducao e exige revisao/versionamento. Novas edicoes devem aplicar a referencia antiga, ou recalcular uma serie inteira com nova referencia explicitamente identificada. A funcao de percentil aceita valores novos contra referencia fixa; este gerador especifico reproduz somente a edicao 2022.

Agregado do piloto: media aritmetica dos tres indicadores, peso 1/3 cada. Em cestas maiores, definir primeiro pesos de capitulos e depois pesos internos; o peso efetivo e o produto dos dois. Mais indicadores nao aumentam automaticamente o peso de um capitulo. A compensacao entre dimensoes e uma escolha normativa. Percentis perdem distancias em unidades originais; pequenas diferencas amostrais podem alterar posicoes.

Ausencias: preservar todos os pesos. Limite inferior e a soma das contribuicoes conhecidas; superior acrescenta 100 vezes o peso ausente. Pontuacao pontual so existe se a cesta estiver completa. Zero observado e valido; ausencia e `None`; NaN, infinito, booleanos e pesos invalidos sao rejeitados. Exemplo: contribuicao conhecida 58 e peso ausente 20% geram [58,78], sem ponto medio imputado. Limites de identificacao nao sao intervalos de confianca. Nao aplicar automaticamente este piloto aos 16 capitulos: cesta e pesos integrais ainda precisam de contrato.

## Resultados e sensibilidade

Saidas: `piloto-2022.json` (valores originais, pontos, pesos, cobertura, cenarios e comparacoes) e `piloto-2022.csv` (26 linhas). Sem ranking apresentado como conclusao substantiva.

Recife: 41,67; Curitiba: 72,44. Escala relativa deste recorte de tres indicadores. Sob os oito cenarios fatoriais de pesos +/-20%, renormalizados em cada cenario: Recife [39,84;43,27], Curitiba [68,96;75,55]. Essas faixas refletem somente escolhas de pesos, nao erro amostral.

52 de 325 pares apresentam inversao estrita da ordem em pelo menos um cenario. Empates nao contam como inversao. Oito cenarios sao uma analise deterministica, nao uma distribuicao probabilistica de preferencias. Para essa media linear fracionaria com multiplicadores independentes no intervalo [0,8;1,2], os vertices delimitam os extremos sobre a caixa de pesos; isso nao cobre outras escolhas de indicadores ou normalizacao. Retirada de cada indicador tambem calculada separadamente: altera o construto e nao entra no intervalo principal.

Nao ha nesta entrega intervalos amostrais, nova auditoria de aprendizado, comparacao internacional ou publicacao da nota na pagina inicial. Comparabilidade de pequenos contrastes continua limitada pela precisao das fontes. Proxima etapa: ampliar a matriz com saude, saneamento e seguranca; testar outras normalizacoes e revisar validade de conteudo antes da integracao visual.

## Reproducao e verificacao

```sh
python3 -m pipeline.eficiencia_resultados.piloto
python3 -m unittest pipeline.eficiencia_resultados.test_motor
```

11 testes: empates, polaridade, referencia fixa, limites, ausencia versus zero, dados invalidos, pesos e cesta, composicao hierarquica, cobertura real, media da referencia e sensibilidade.

## Referencias metodologicas

- OECD/JRC, Handbook on Constructing Composite Indicators (2008): https://www.oecd.org/en/publications/handbook-on-constructing-composite-indicators-methodology-and-user-guide_9789264043466-en.html
- OECD Regional Well-Being user guide: https://www.oecdregionalwellbeing.org/assets/downloads/Regional-Well-Being-User-Guide.pdf
- UNDP, notas tecnicas HDR 2025 (contraste com agregacao geometrica do HDI): https://hdr.undp.org/sites/default/files/2025_HDR/HDR25_Technical_Notes.pdf

A formula de percentil, a cesta, os pesos e o agregado aqui implementados sao decisoes do projeto; nao sao um indice oficial dessas instituicoes.

## Continuidade — expansão v2

A [expansão v2](EXPANSAO_V2.md) acrescenta saneamento e violência letal ao piloto de 2022, com 130 observações, 32 cenários de pesos e um contrato separado de seis dimensões que mantém saúde ausente. A v1 e seus resultados permanecem preservados; a mudança entre versões é de composição, não temporal.
