# Aceite independente — Trabalho e Renda

**Aceite do build local: as 14 rotas implementadas e a integração à entrada OBEE atingiram notas acima de 9 em cada um dos 8 critérios.** Notas são julgamento editorial documentado, não certificação absoluta nem nota sobre a eficiência dos territórios. O avaliador não implementou o produto.

## Matriz por tela

DA: direção de arte; H: hierarquia; TA: tipografia e acabamento; DP: densidade e profundidade; DV: didática visual; C: comparabilidade; IA: interação e acessibilidade; R: responsividade. Nenhuma média compensa uma nota inferior ao limite.

|Tela|DA|H|TA|DP|DV|C|IA|R|
|---|---:|---:|---:|---:|---:|---:|---:|---:|
|Panorama|9,3|9,2|9,2|9,1|9,2|9,2|9,1|9,2|
|Acesso ao trabalho|9,2|9,2|9,2|9,2|9,2|9,3|9,2|9,2|
|Ocupações|9,2|9,3|9,1|9,3|9,3|9,2|9,1|9,1|
|Qualificação|9,2|9,2|9,2|9,3|9,3|9,3|9,2|9,2|
|Qualidade do trabalho|9,2|9,2|9,2|9,1|9,2|9,2|9,1|9,2|
|Renda do trabalho|9,2|9,2|9,2|9,1|9,2|9,3|9,1|9,2|
|Renda das famílias|9,2|9,3|9,2|9,3|9,3|9,3|9,2|9,1|
|Desigualdade|9,2|9,3|9,2|9,3|9,3|9,3|9,1|9,1|
|Cadastro Único|9,2|9,2|9,1|9,1|9,3|9,2|9,3|9,2|
|Proteção da renda|9,2|9,1|9,2|9,2|9,3|9,3|9,1|9,2|
|Emprego formal|9,2|9,2|9,2|9,2|9,3|9,3|9,1|9,2|
|Recursos públicos|9,2|9,2|9,1|9,3|9,3|9,3|9,1|9,2|
|Comparar|9,2|9,2|9,2|9,1|9,2|9,3|9,2|9,2|
|Métodos|9,2|9,3|9,2|9,3|9,3|9,3|9,2|9,2|
|Entrada OBEE|9,3|9,3|9,2|9,2|9,3|9,3|9,2|9,2|

## O que fundamenta o aceite

- Revisão de14 capturas completas em desktop e celular, com início, seções analíticas e fim;56 estados em 320, 390, 768 e 1440 px sem rolagem horizontal da página e sem violações automáticas A/AA após as correções.
- Filtros por São Paulo, mulheres e 1º trimestre de 2025, persistência na URL, limpeza, tabela equivalente, foco visível e expansão pelo teclado. Busca municipal em 320 px encontrou Campinas/SP, manteve a seleção em busca vazia e preservou a cobertura com no máximo100 opções na DOM.
- Catálogo de cursos: busca com 104 registros, paginação, resultado vazio, limpeza sincronizada e distinção entre autorização, oferta, vaga e atendimento. Exportação HTTP streaming completa com 90.587 registros(31.920.026bytes), BOM/cabeçalho únicos e zero divergências de campos; recorte de 104também íntegro.
- Recomputação independente:29.972 observações de trabalho/renda,17.049 do Cadastro Único e130 financeiras;12 hashes de fontes do núcleo e4 do Cadastro Único correspondem aos brutos.90.587 registros de cursos confrontados com o CSV original. Nenhuma divergência de extração encontrada.
- As reprovações iniciais geraram correções concretas: navegação mobile, ticks sobrepostos, barras comprimidas, KPI longo, fontes repetidas, filtro municipal massivo, semântica do catálogo, limpeza da UF, informalidade confundida com emprego formal, referência administrativa tratada como estimativa e saldo confundido com diferença de estoques.

Os três painéis afetados por enquadramentos conceituais e a entrada OBEE foram reavaliados no build 3021 em 1440/390 px. As últimas mudanças exclusivamente textuais foram conferidas no HTML HTTP sem script/style e no código; não houve uma nova captura visual de cada palavra após esse último ajuste.

## Limites que permanecem

Leitor de tela e zoom nativo de 200%não foram confirmados. A automação não equivale a conformidade integral. O evento de download do CUA travou; a integridade do catálogo foi comprovada pela resposta HTTP efetivamente recebida, e não por uma gravação final observada em todos os navegadores.

Este aceite cobre as telas existentes. A agenda de 12 dimensões continua parcialmente respondida: mobilidade individual exige base longitudinal e outras lacunas permanecem declaradas. Não se deve anunciar 12 dimensões integralmente concluídas. O avaliador não atesta merge, deploy ou publicação no domínio público; essa verificação é separada.

As notas por rota, fundamentos, capturas e provas detalhadas estão em MATRIZ_INDEPENDENTE.json, UI_56_ESTADOS.json, RETESTES_BUILD.json, TEXTOS_BUILD_FINAL.json e CSV_STREAM_INDEPENDENTE.json.
