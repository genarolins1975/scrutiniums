# Educação nas capitais

Terceira entrega do [pedido](../PEDIDO.md), dependente das duas anteriores. Sem merge.

As três medidas do panorama passam a mostrar todas as 26 capitais, por nome, com a mediana e a seleção compartilhada com os laboratórios. Referências nacionais, quartis, tabelas equivalentes e CSV permanecem. Ausências e exclusões preservam o motivo e a seleção.

A capital escolhida abre cinco elos com os dados existentes: despesa por habitante, aplicação direta por matrícula, alunos por turma, aprovação e Ideb. Cada elo conserva fonte, período e universo próprios. O modelo não atribui causalidade. O laboratório reaproveita a ponte contábil do explorador e explicita que os numeradores, denominadores e conjuntos comparáveis das duas razões diferem; posição por valor não classifica gestão.

O bloco de escores não calculáveis passa do layout comum do painel para Dados e métodos, com selo em preparação e sem links. **Confirmação solicitada ao dono no PR:** aprovar esse destino dos escores antes de autorizar merge. Nenhum escore foi calculado ou apagado.

O convite do aperitivo informa o recurso das capitais com a contagem da gold. O aperitivo continua sem gráficos, laboratórios ou arquivos novos. Nenhum dado da publicação foi alterado nesta entrega.

## Componentes compartilhados

`GraficoPontos` aceita limites naturais opcionais; consumidores sem a opção conservam seu domínio anterior. `RecursoResultado` aceita uma sequência com números e notas locais, mantendo o ramo de temas existente. `EscoresServicos` recebe o modo em preparação apenas neste painel. `PanoramaInterativo` só é consumido por Educação nas capitais.

## Verificação

Preparação da sessão e 239 testes de contratos aprovados, incluindo os novos artefatos e a suíte OBEE Educação. Build, navegação, capturas, medidas e revisão visual final em andamento. Não se declara nota mínima 9 ou aprovação integral antes dessas verificações.
