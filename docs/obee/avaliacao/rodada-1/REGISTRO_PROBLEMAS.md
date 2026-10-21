# Registro de problemas e correções, rodada 1

Origem: `avaliador-experiencia.md` (prefixo X) e `avaliador-dados.md` (prefixo D), na numeração de cada relatório. Gravidade: **alta** (bloqueio ou barreira a tarefa essencial), **média**, **baixa**. Estado: *a corrigir* até que o executor registre o commit e a verificação; a coluna final é atualizada ao longo da rodada de correções e só vale depois da reavaliação independente.

| Id | Problema | Gravidade | Frente | Estado (executor, antes da rodada 2) |
| --- | --- | --- | --- | --- |
| D1 | Despesas intraorçamentárias (3% a 36% da função) fora do número sem aviso junto dele | alta, bloqueio | integridade | corrigido (lote 1) |
| D2 / X1 | Evolução atravessa a quebra de população: a mediana sem capital não bloqueia a frase; o gráfico diz que marca a ruptura e não marca | alta, bloqueio | integridade | corrigido (lote 1) |
| D3 | "Rede municipal" como rótulo de despesa total e por habitante (orçamento do município) | média | integridade | corrigido (lote 1) |
| D4 | Comparar, visão Gráfico, sem ficha, CSV, nota material e referência externa | média | comparabilidade | corrigido (lote 2) |
| D5 | Só o grupo das 26 capitais; a metodologia descreve o grupo regional | média | comparabilidade | corrigido (lote 2) |
| D6 | Ano par na tabela comparativa: texto contraditório e motivo errado no CSV | média | integridade | corrigido (lote 2) |
| D7 | Versões divergentes (CSV, metodologia, ficha) e histórico de revisões fora da página | média | rastreabilidade | corrigido (lotes 3 e 5) |
| D8 | Frase de evolução termina antes do fim da série sem dizer que não há edições posteriores | média | integridade | corrigido (lote 2) |
| D9 | CSV sem dicionário; nome de arquivo não distingue nominal de real nem disciplina | média | rastreabilidade | corrigido (lote 3) |
| D10 | Testes não cobrem o DOM nem a evolução da mediana | média | técnica | parcial (testes de componente e roteiro de navegador; sem teste de DOM por cenário) |
| X2 | Gráficos de pontos cortam rótulos em 320 e 390 px; eixo vai além do máximo | alta | visualização | corrigido (lote 4) |
| X3 | Controles que parecem texto: "Destacar capitais" (Comparar) e 44 de 45 `summary` de Métodos | alta | interação | corrigido (lote 2) |
| X4 | Capital excluída some do gráfico e o motivo fica 1.300 a 1.900 px abaixo da frase que o anuncia | alta | didática | corrigido (lote 4) |
| X5 | Panorama sem definição de Ideb e de "R$ correntes"; escala logarítmica da aba Total sem explicação no texto | média | didática | corrigido (lote 4) |
| X6 | Resultados e Atendimento herdam o aviso de gasto e não têm aviso próprio; "Por valor, crescente" sem alerta | média | interpretação | corrigido (lote 4) |
| X7 | Evolução sem valores por ponto; sem CSV em Evolução e Detalhe | média | utilidade | corrigido (lote 4) |
| X8 | Comparar ignora `?cap=` | média | interação | corrigido (lote 2) |
| X9 | Tabela cruzada em 320 e 390 px mostra uma coluna por vez, com rolagem aninhada | média | responsividade | corrigido em parte (lote 5: colunas mais estreitas no celular; sem visão de duas capitais lado a lado) |
| X10 | Dados e métodos: 6.477 palavras sem índice | média | didática | corrigido (lote 3) |
| X11 | Exemplos de reprodução não cobrem despesa por habitante, por matrícula nem população | média | rastreabilidade | corrigido (lote 5) |
| X12 | Padrão nominal na evolução sem aviso junto da frase | média | interpretação | corrigido (lote 4) |
| X13 | O painel não diz o que não mostra (cobertura, desigualdades) | média | relevância | corrigido (lote 4) |
| D11 | Ordem dos empatados difere entre título e caixa de referências | baixa | integridade | corrigido (lote 2) |
| D12 | Diferença exibida difere em uma unidade da conta em 95 de 415 frases | baixa | integridade | corrigido (lote 2) |
| D13 | Centavos falsos acima de R$ 10 bilhões (compactação a 12 algarismos) | baixa | integridade | corrigido (lote 2) |
| D14 | Data de referência do Censo 2022 (1º de agosto e 31 de julho) | baixa | integridade | corrigido (lote 5) |
| D15 | "38 membros" (V18) contra 34 membros na caixa | baixa | integridade | corrigido (lote 5) |
| D16 | `/favicon.ico` 404 | baixa | técnica | corrigido (lote 2) |
| X14 a X23, D17 a D21 | Demais itens de gravidade baixa dos relatórios (parâmetros inválidos silenciosos, estado Tabela fora da URL, rodapé, prefetch, TLS do INEP etc.) | baixa | vários | triados na seção própria |
