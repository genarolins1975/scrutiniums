# Educação nas capitais

Terceira entrega do [pedido](../PEDIDO.md), dependente das duas anteriores. Sem merge.

As três medidas do panorama passam a mostrar todas as 26 capitais, por nome, com a mediana e a seleção compartilhada com os laboratórios. Referências nacionais, quartis, tabelas equivalentes e CSV permanecem. Ausências e exclusões preservam o motivo e a seleção.

A capital escolhida abre cinco elos com os dados existentes: despesa por habitante, aplicação direta por matrícula, alunos por turma, aprovação e Ideb. Cada elo conserva fonte, período e universo próprios. O modelo não atribui causalidade. O laboratório reaproveita a ponte contábil do explorador e explicita que os numeradores, denominadores e conjuntos comparáveis das duas razões diferem; posição por valor não classifica gestão.

O bloco de escores não calculáveis passa do layout comum do painel para Dados e métodos, com selo em preparação e sem links. **Confirmação solicitada ao dono no PR:** aprovar esse destino dos escores antes de autorizar merge. Nenhum escore foi calculado ou apagado.

O convite do aperitivo informa o recurso das capitais com a contagem da gold. O aperitivo continua sem gráficos, laboratórios ou arquivos novos. Nenhum dado da publicação foi alterado nesta entrega.

## Componentes compartilhados

`GraficoPontos` aceita limites naturais opcionais; consumidores sem a opção conservam seu domínio anterior. `RecursoResultado` aceita uma sequência com números e notas locais, mantendo o ramo de temas existente. `EscoresServicos` recebe o modo em preparação apenas neste painel. `PanoramaInterativo` só é consumido por Educação nas capitais.

## Verificação

Preparação da sessão e 239 testes de contratos aprovados, incluindo os novos artefatos e a suíte OBEE Educação. Build final aprovado. Navegação, capturas, medidas e revisão visual estão anexadas; os resultados gerais e limites estão discriminados abaixo.


## Arredondamento de apresentação

A revisão identificou uma divergência real em Recife: Ideb 5,8 menos mediana 6,05 resulta em −0,25; o gráfico mostrava −0,2 e a frase mostrava 0,3 abaixo. O formatador compartilhado passa a arredondar a magnitude antes de aplicar o sinal. Valores, diferenças e sentido ficam coerentes; zero negativo continua normalizado. A função usada para limites de classes dos mapas permanece intacta. O teste de regressão cobre empates positivos e negativos e o exemplo real. Nenhum valor da gold mudou.

## Evidências, acesso e limites

[Antes](../pr2/depois/evidencias.md): panorama anterior, incluindo Recife, e método, nas três larguras e duas condições de sessão. [Depois](depois/evidencias.md). [Revisão independente e rubrica](revisao-visual.md). Os recortes ampliados permitem ler os gráficos, os cinco elos, a ponte e o bloco de escores, que ficam pequenos nas capturas de páginas inteiras.

O panorama exige sessão; o método conserva a exceção pública de documentação prevista na skill de acesso. Nenhuma nova rota ou pasta de arquivos foi aberta. O aperitivo só ganhou a descrição das capitais no convite, com contagem da gold.

| Aperitivo | 1440 px | 390 px |
|---|---:|---:|
| Sem município | 2065 | 3990 |
| Amparo do São Francisco | 2267 | 4368 |
| Recife | 2381 | 4476 |

[Medidas do aperitivo](medidas-aperitivo/medidas.json), todas abaixo de 2500/4500 px, sem rolagem horizontal, imagens quebradas ou texto menor que 12 px. A entrada autenticada conserva as medidas do PR2, abaixo de 6500/11000 px. Cromo por rota e largura consta da coleta de evidências; a barra comum não foi alterada.

A tabela de escores em 390 px possui rolagem interna por teclado: foco na região e setas alcançam a última coluna; a página permanece com 390 px de largura. A prova e o recorte da coluna final estão anexados. Essa checagem não certifica toda a experiência com leitor de tela ou toque.

A análise externa `ANALISE.md` não foi encontrada no repositório ou nos anexos acessíveis. As decisões implementadas vêm do pedido anexado e da revisão do código. A decisão pendente do dono é a transferência dos escores para Dados e métodos, explicitamente solicitada no PR; nenhum merge foi realizado.

## Rubrica antes e depois

A [matriz anterior](revisao-antes.md) explica as lacunas concretas do panorama: hierarquia, profundidade, didática e comparabilidade receberam 8. A [matriz posterior](revisao-visual.md), incluindo o adendo após corrigir o arredondamento, atribui 9 aos critérios visuais observados do panorama e dos novos módulos. Interação manual global e os trechos do método inteiro sem resolução suficiente permanecem NV; não se declara certificação integral de todos os critérios.

A coleta final contém 48 casos no build `LCbawtF_QUVd7_Fr6eaCD`. Os relatórios antigos foram mantidos em `coleta-anterior`, sem apagar as ocorrências anteriores.

## Verificação geral e correção do molde

A suíte completa executou 9666 testes: 9648 aprovados, 12 skips e um todo preexistentes, cinco falhas. Duas apontaram o mesmo problema: os laboratórios estavam fora dos componentes admitidos no primeiro nível da fatia de figuras. O bloco passa a usar `Recolhido`, aberto por padrão, conservando os modelos internos. O contrato foi preservado e ganhou uma asserção sobre a abertura inicial. As outras três falhas foram timeouts: dois casos do cromo da plataforma e um de Crédito com fonte ampliada. O novo build passou. A repetição dos quatro arquivos passou com 113 testes: os contratos confirmaram a correção e os três timeouts não se repetiram ([registro](repeticao-falhas.txt)). Os 41 testes de componentes e arredondamento também passaram após o ajuste ([registro](envelope-unidade.txt)).

O roteiro completo do Judiciário passou: 68 telas, 224 checagens e nenhum erro ([registro](judiciario.txt)). O teste de integridade da árvore também passou.

A coleta de 48 casos após corrigir o arredondamento teve axe 0, console 0 e nenhuma rolagem horizontal em todos os casos. Ela antecede somente o envelope `Recolhido` dos laboratórios; as duas rotas afetadas foram fotografadas novamente no build final ([12 casos](depois-envelope/evidencias.md)), também com axe 0, console 0 e nenhuma rolagem horizontal. Os demais blocos permanecem idênticos.

## Resultado final local

A verificação rápida contra a base deste PR (`codex/educacao-2-artefatos`) passou: lint, tipos, derivados, cobertura bilíngue e 140 arquivos de testes, com 4706 aprovados, 7 skips e um todo preexistentes ([registro](verificar-rapido.txt)). Essa execução inclui os testes de navegador das capitais e dos consumidores compartilhados selecionados pelo grafo de dependências. A repetição explícita dos quatro arquivos que haviam falhado passou com 113 testes, sem alterar limites de tempo ou asserções existentes.

As [12 capturas após o envelope](depois-envelope/evidencias.md) complementam as 48 da coleta anterior. Os [24 recortes ampliados](recortes-envelope/) incluem o Ideb de Recife e o bloco aberto dos laboratórios nas três larguras. O build final é `GFOKxgFZcOaJbB-3QGFOq`. Nenhum merge foi realizado.

## Comprimento e cromo do panorama

Comprimentos em pixels das capturas completas com sessão, escala de dispositivo 1. São medidas do panorama, sem aplicar a ele o orçamento específico da entrada municipal.

| Panorama | Largura | Altura antes | Altura depois | Cromo antes/depois |
|---|---:|---:|---:|---:|
| Sem seleção | 390 | 9055 | 12704 | 183/183 |
| Sem seleção | 768 | 6616 | 9823 | 316/316 |
| Sem seleção | 1440 | 5548 | 8680 | 228/228 |
| Recife | 390 | 9372 | 16982 | 183/183 |
| Recife | 768 | 6858 | 12647 | 316/316 |
| Recife | 1440 | 5790 | 11073 | 228/228 |

Fonte: coleta anterior do PR2 e repetição final do panorama após o envelope. O aumento de altura torna as 26 capitais visíveis e, com seleção, acrescenta os dois modelos solicitados; a entrada municipal e o aperitivo continuam nos seus orçamentos.

A revisão independente final abriu as 12 capturas após o envelope e seis recortes específicos (Ideb e laboratórios nas três larguras). Não encontrou novo defeito concreto. A nota 9 dos critérios visuais observados foi mantida; interação manual global segue NV. O adendo está em [revisao-visual.md](revisao-visual.md).
