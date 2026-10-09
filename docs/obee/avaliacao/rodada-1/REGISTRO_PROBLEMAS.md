# Registro de problemas e correções, rodada 1

Origem: `avaliador-experiencia.md` (prefixo X) e `avaliador-dados.md` (prefixo D), na numeração de cada relatório. Gravidade: **alta** (bloqueio ou barreira a tarefa essencial), **média**, **baixa**. Estado: *a corrigir* até que o executor registre o commit e a verificação; a coluna final é atualizada ao longo da rodada de correções e só vale depois da reavaliação independente.

| Id | Problema | Gravidade | Frente | Estado |
| --- | --- | --- | --- | --- |
| D1 | Despesas intraorçamentárias (3% a 36% da função) fora do número sem aviso junto dele | alta, bloqueio | integridade | a corrigir |
| D2 / X1 | Evolução atravessa a quebra de população: a mediana sem capital não bloqueia a frase; o gráfico diz que marca a ruptura e não marca | alta, bloqueio | integridade | a corrigir |
| D3 | "Rede municipal" como rótulo de despesa total e por habitante (orçamento do município) | média | integridade | a corrigir |
| D4 | Comparar, visão Gráfico, sem ficha, CSV, nota material e referência externa | média | comparabilidade | a corrigir |
| D5 | Só o grupo das 26 capitais; a metodologia descreve o grupo regional | média | comparabilidade | a corrigir |
| D6 | Ano par na tabela comparativa: texto contraditório e motivo errado no CSV | média | integridade | a corrigir |
| D7 | Versões divergentes (CSV, metodologia, ficha) e histórico de revisões fora da página | média | rastreabilidade | a corrigir |
| D8 | Frase de evolução termina antes do fim da série sem dizer que não há edições posteriores | média | integridade | a corrigir |
| D9 | CSV sem dicionário; nome de arquivo não distingue nominal de real nem disciplina | média | rastreabilidade | a corrigir |
| D10 | Testes não cobrem o DOM nem a evolução da mediana | média | técnica | a corrigir |
| X2 | Gráficos de pontos cortam rótulos em 320 e 390 px; eixo vai além do máximo | alta | visualização | a corrigir |
| X3 | Controles que parecem texto: "Destacar capitais" (Comparar) e 44 de 45 `summary` de Métodos | alta | interação | a corrigir |
| X4 | Capital excluída some do gráfico e o motivo fica 1.300 a 1.900 px abaixo da frase que o anuncia | alta | didática | a corrigir |
| X5 | Panorama sem definição de Ideb e de "R$ correntes"; escala logarítmica da aba Total sem explicação no texto | média | didática | a corrigir |
| X6 | Resultados e Atendimento herdam o aviso de gasto e não têm aviso próprio; "Por valor, crescente" sem alerta | média | interpretação | a corrigir |
| X7 | Evolução sem valores por ponto; sem CSV em Evolução e Detalhe | média | utilidade | a corrigir |
| X8 | Comparar ignora `?cap=` | média | interação | a corrigir |
| X9 | Tabela cruzada em 320 e 390 px mostra uma coluna por vez, com rolagem aninhada | média | responsividade | a corrigir |
| X10 | Dados e métodos: 6.477 palavras sem índice | média | didática | a corrigir |
| X11 | Exemplos de reprodução não cobrem despesa por habitante, por matrícula nem população | média | rastreabilidade | a corrigir |
| X12 | Padrão nominal na evolução sem aviso junto da frase | média | interpretação | a corrigir |
| X13 | O painel não diz o que não mostra (cobertura, desigualdades) | média | relevância | a corrigir |
| D11 | Ordem dos empatados difere entre título e caixa de referências | baixa | integridade | a corrigir |
| D12 | Diferença exibida difere em uma unidade da conta em 95 de 415 frases | baixa | integridade | a corrigir |
| D13 | Centavos falsos acima de R$ 10 bilhões (compactação a 12 algarismos) | baixa | integridade | a corrigir |
| D14 | Data de referência do Censo 2022 (1º de agosto e 31 de julho) | baixa | integridade | a corrigir |
| D15 | "38 membros" (V18) contra 34 membros na caixa | baixa | integridade | a corrigir |
| D16 | `/favicon.ico` 404 | baixa | técnica | a corrigir |
| X14 a X23, D17 a D21 | Demais itens de gravidade baixa dos relatórios (parâmetros inválidos silenciosos, estado Tabela fora da URL, rodapé, prefetch, TLS do INEP etc.) | baixa | vários | triados na seção própria |
