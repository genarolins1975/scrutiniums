# Aceite independente — Segurança Alimentar

**Aceite do build local: as 12 telas implementadas e a integração à entrada OBEE atingiram notas acima de 9 em cada um dos 8 critérios.** O mínimo é 9,1; nenhuma média compensa nota abaixo do limiar. Notas são julgamento editorial das telas, não certificação absoluta de acessibilidade nem nota sobre eficiência dos territórios. O avaliador não implementou o produto.

## Matriz por tela

DA: direção de arte; H: hierarquia; TA: tipografia/acabamento; DP: densidade/profundidade; DV: didática visual; C: comparabilidade; IA: interação/acessibilidade; R: responsividade.

|Tela|DA|H|TA|DP|DV|C|IA|R|
|---|---:|---:|---:|---:|---:|---:|---:|---:|
|Panorama|9,2|9,2|9,2|9,1|9,2|9,3|9,1|9,2|
|Insegurança alimentar|9,2|9,2|9,2|9,2|9,3|9,3|9,1|9,2|
|Desigualdades|9,2|9,2|9,2|9,3|9,3|9,3|9,1|9,2|
|Territórios|9,2|9,2|9,1|9,3|9,3|9,3|9,2|9,1|
|Preços e poder de compra|9,2|9,2|9,2|9,2|9,3|9,3|9,1|9,2|
|Alimentação escolar|9,2|9,2|9,2|9,3|9,3|9,3|9,2|9,1|
|Equipamentos e atendimento|9,2|9,2|9,2|9,2|9,3|9,3|9,2|9,1|
|Aquisição e abastecimento|9,2|9,2|9,1|9,3|9,3|9,3|9,1|9,1|
|Alimentação e saúde|9,2|9,2|9,2|9,1|9,3|9,3|9,1|9,2|
|Gestão e recursos|9,2|9,2|9,2|9,2|9,3|9,3|9,1|9,2|
|Comparar|9,2|9,2|9,2|9,1|9,2|9,3|9,1|9,2|
|Métodos|9,2|9,3|9,1|9,3|9,3|9,3|9,1|9,1|
|Entrada OBEE|9,3|9,2|9,2|9,2|9,2|9,3|9,1|9,2|

## Evidência do aceite

- 48 estados das 12 rotas em 320/390/768/1440 px e 4 estados da entrada OBEE, sem rolagem horizontal global. Capturas e pranchas foram inspecionadas no início, meio e fim. Métodos 320 precisou três capturas por altura após timeout da captura completa; DOM completo também foi registrado.
- Quatro rotas afetadas por correções finais foram retestadas nas quatro larguras. A fonte no recorte fora da cobertura e a data emBrasília foram conferidas no mesmo build por servidor isolado 3032.
- Teclado:Enter no recorte e no mapa, foco 3 pxvisível em controles e região tabular, limpeza restaurando 2025, rolagem horizontal da tabela em 320 px sem rolar a página. Busca “fortaleza ce” localizou o município; cenário com PBF 44.890 e sem PBF 43.139 permaneceram próprios, com URL e recarga persistentes.
- Fora da cobertura:São Paulo com sexo da pessoa responsável manteve “Não disponível” e aviso explícito, sem substituir porBrasil; fonte 9553. CSV do recorte teve zero linhas de dados.
- PNAE 2026: “Não comparável”, ponto aberto separado e ressalva visível; tabela/CSV qualificam exercício em curso. Preços têm comparação de quatro categorias e duas casas decimais. Saúde mostra quantidade e cobertura das cinco fases, sem evolução inventada. AçõesMUNIC 2023 não herdam 2025 do PAA.
- Contraste calculado por DOM nas 12 rotas: nenhuma falha encontrada nos textos/controles verificados. Nenhum controle de formulário sem nome foi encontrado. Na entrada, o checkbox de 20 px tem rótulo clicável de 48 px.

## Dados e exportações

Recomputação independente de **210.673 observações em 8 bases**, sem divergências de valores:EBIA 2.884;CadInsan 27.990;MUNIC estrutura 78.442;MUNIC ações 39.221;IPCA 360;PNAE 28.172;SISVAN 10;PAA 33.594. Foram conferidos hashes dos brutos, contagens, razõesEBIA e CV, valores originaisMUNIC, agregações e cobertura. O PDFSISVAN foi reextraído por ferramenta diferente da usada pelo construtor. Fichas oficiaisPAA IN 002/IN 003 sustentam período anual e modalidadesCDS/PAA-Leite; ausência não virou zero.

Os 8 CSVs completos foram efetivamente recebidos do build por HTTP streaming: **210.673 linhas e 136.306.539 bytes**, cabeçalho/BOM únicos e zero divergências numéricas e de metadados confrontados com osJSONs. Quatro recortes adicionais concordam com a UI: PNAE 2026,EBIA fora da cobertura,CadInsan Fortaleza eIPCA 4,21%. Estes testes comprovam respostaHTTP local; não afirmam gravação do download em todos os navegadores.

A distribuição canônica tem 35 arquivos em 49 partes e suplementoPAA 6 arquivos em 3 partes. Todos 41 arquivos decodificados são byte a byte iguais ao runtime. Sete testes isolados passaram: válido, parte ausente,Base 64 inválida,gzip inválido,SHA incorreto,caminho de escape e suplemento ausente. Erros abortam sem aceitarJSONlegado como fallback. O trace serverless foi conferido independentemente: exatamente 8 JSONs,69.533.388 bytes, sem incluir brutos/chunks/índices.

## Limites que permanecem

Leitor de tela, zoom nativo de 200% e auditoriaaxe integral não foram executados. Contraste DOM e tarefas manuais não equivalem a conformidade integral. Os testes deURL e recarga confirmam o estado após hidratação; não certificam a experiência sem JavaScript. Não foram simuladas todas as falhas de rede possíveis.

CadInsan: o corpo do relatório tem 21.460.006 famílias e o anexo 21.236.683; diferença 223.323 não reconciliada, visível e sem calibrar valores. Em 270 municípios o cenário sem PBF é menor que com PBF; não há afirmação causal. PNAE tem 921 campos financeiros ausentes e 18 nomes sem conciliação municipal; quantidades registradas não são pessoas únicas/refeições. SISVAN mantém denominador não detalhado e exclui cobertura total não reconciliada do gráfico 19. PAA é extrato disponível com cobertura parcial; não todo PAA reconciliado.

O aceite cobre telas reais e seus contratos limitados. Não significa que todas as dimensões de segurança alimentar estejam integralmente respondidas: estado nutricional, filas, volume entregue e orçamento familiar não são inventados. Merge, deploy e disponibilidade pública serão verificados separadamente.

Fundamentos e notas por critério estão em MATRIZ_INDEPENDENTE.json. Provas:Sweep 52 estados,Retestes 16 estados,NUCLEO_FINAL_INDEPENDENTE,SECUNDARIAS_INDEPENDENTE,CADINSAN_INDEPENDENTE,CSV_HTTP_INDEPENDENTE eDISTRIBUICAO_INDEPENDENTE.
