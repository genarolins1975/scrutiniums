# Educação: análises com os dados publicados

Segunda entrega do [pedido](../PEDIDO.md), sobre a ficha e a hierarquia da primeira. Sem autorização de merge.

O leitor pode comparar duas edições e separar matematicamente os movimentos de aprendizagem e aprovação; consultar as metas do INEP por edição; localizar o Ideb no mapa municipal; acompanhar as séries nacionais e estaduais; ver a cidade nas distribuições do Brasil e do estado; e entender a composição das matrículas.

Rotas: `/educacao-municipal`, `/educacao-municipal/municipio/2800100`, `/educacao-municipal/municipio/2611606` e `/educacao-municipal/mapa`. O mapa entra na navegação da coleção. Painéis e arquivos continuam com conta; o aperitivo apenas descreve os recursos disponíveis.

## Base, derivação e limites

Versão nova: `educacao-1.1.0`. [Auditoria dos valores e hashes](auditoria-publicados.json). Todos os campos anteriores dos 28 arquivos foram comparados com o commit `9750d2d0c`, preservando inclusive números, ausências, marcas e ordem das séries; apenas versão e hash da publicação mudam. Há 29 arquivos na nova publicação, incluindo o mapa compacto. Não houve coleta ou substituição de seed.

As contribuições logarítmicas são calculadas no pipeline para todos os pares de edições com Ideb, N e P publicados. A soma fecha a diferença do produto N × P. Variações abaixo de 0,05 ponto e componentes zero não recebem divisão; o limiar decimal evita classificar o valor exato pelo erro de ponto flutuante. A página distingue o produto do Ideb oficial e não atribui causalidade.

As metas usam o Ideb publicado, preservam o motivo de ausência também quando não existe projeção e mostram o denominador das contagens. Não se usa matrícula atual para inferir ausência histórica. O universo de códigos é o da base atual, explicitado junto das contagens.

O mapa reconcilia cada valor e motivo com a gold completa, além de conferir cobertura por estado e Brasil antes da publicação. Usa a geometria municipal existente, classes fixas de meio ponto e textura para ausência. A tabela oferece a mesma consulta com teclado.

A fonte só separa municipal, estadual, federal e privada para a educação básica total. Para anos iniciais e finais, as redes estadual e federal ficam juntas; em creche e pré escola, a base só distingue municipal e demais redes. A interface identifica esses agrupamentos. Nenhuma estimativa preenche a separação ausente.

Pré calcular todos os pares aumenta a publicação municipal de aproximadamente 15 MB para cerca de 66 MB. As páginas individuais enviam apenas a cidade selecionada; o mapa usa seu arquivo compacto. O tamanho total e os hashes estão na auditoria.

## Evidências e revisão

[Antes](antes.md). [Revisão independente do código](revisao-codigo.md), com adendo das correções. As medidas, capturas, rubrica e resultados disponíveis estão anexados abaixo. A análise externa `ANALISE.md` continua indisponível no repositório e nos anexos acessíveis; não se atribui conteúdo a ela.

## Verificações já concluídas

Preparação da sessão executada. Pipeline Educação: 29 testes passaram. Contratos da página e navegação da coleção: 72 testes passaram. A auditoria da publicação preservou todos os valores anteriores e registrou os hashes dos 29 arquivos novos.


## Resultado da revisão e medidas

As [48 capturas depois](depois/evidencias.md) cobrem oito rotas ou estados, três larguras e as duas condições de sessão. A [revisão independente](revisao-visual.md) abriu as 30 capturas completas das rotas alteradas. Os blocos expandidos têm [revisão própria](revisao-blocos.md). A rubrica final por página está nesses relatórios: critérios visuais observados com nota 9; interação e acessibilidade manual independente permanecem não verificadas. Axe e testes automatizados de teclado não substituem essa inspeção.

| Entrada autenticada | Antes PR2, 1440 | Depois, 1440 | Antes PR2, 390 | Depois, 390 |
|---|---:|---:|---:|---:|
| Sem cidade | 4776 | 5221 | 7996 | 8407 |
| Amparo do São Francisco | 4930 | 5375 | 8108 | 8498 |
| Recife | 4930 | 5375 | 8053 | 8442 |

Todos os comprimentos ficam abaixo de 6500/11000 px. O primeiro número da cidade selecionada fica a 833 px em 1440. [Medidas brutas](medidas/medidas.json). O cromo da entrada a 768 permanece 310 px (332 antes do PR1); a barra comum não mudou. Valores de cromo por rota e sessão constam da coleta.

A coleta registrou axe 0, nenhuma rolagem horizontal da página e nenhuma requisição secundária desviada ao login nos 48 casos. O mapa anônimo abre Entrar, conforme a proteção; a ficha anônima volta ao aperitivo da cidade. A documentação de métodos mantém o acesso público já existente. Portanto, Login 0 no relatório não significa mapa público.

Houve um erro de carregamento de chunk durante prefetch no mapa 1440 no lote completo; [repetição isolada no mesmo build](repeticao-mapa/evidencias.md) terminou com console 0. A ocorrência original foi preservada e a causa não foi comprovada. As capturas precedem apenas a inclusão de resumo e termos no cadastro de busca, sem alteração do desenho.

## Limites da validação

A análise externa `ANALISE.md` não foi localizada nos anexos acessíveis nem no repositório. A implementação se baseia no pedido anexado e no código existente. Não há certificação manual com leitor de tela ou dispositivo de toque.

A revisão detectou repetição da unidade no resumo dos extremos do mapa; é uma limitação editorial pequena registrada no relatório, sem alteração dos valores ou da escala.

A etapa local do Judiciário falhou ao consultar o agregado federal antes de sua atualização. Uma reprodução isolada aguardando o valor selecionado confirmou os agregados federal e do trabalho; isso não equivale à aprovação do roteiro completo. Nenhum código ou teste do Judiciário foi alterado.

## Testes de regressão

A etapa completa Vitest executou 9657 testes: 9640 passaram, 12 foram pulados pelos contratos existentes, 1 ficou como tarefa futura e 4 falharam. Duas falhas eram o resumo e os termos ausentes no cadastro do mapa, corrigidos em `35fca80cd`; as outras duas eram estouros de tempo em Crédito e Saneamento. A repetição dos três arquivos afetados passou: 33 testes, sem alterar testes ou limites de tempo. [Execução completa](vitest-completo.txt) e [repetição](repeticao-falhas.txt).

As etapas de dados e Python passaram, incluindo 2455 testes Python com 11 ausências preexistentes. Os três cenários de navegador do mapa passaram nas três larguras, com seleção por teclado, URL, recarga e proteção de acesso. A verificação rápida final e o build após o ajuste de busca serão registrados ao terminar.

## Rubrica antes e depois

| Página | Antes desta entrega | Depois desta entrega |
|---|---|---|
| Entrada e aperitivo, com e sem cidade | [Rubrica PR1 e ressalvas](../pr1/revisao-acoes.md); avaliação anterior não certificou 9 em todos os critérios | [Matriz por estado](revisao-visual.md): critérios visuais observados 9; interação manual NV |
| Ficha municipal | [Revisão PR1](../pr1/revisao-final.md), qualificada pelo adendo | [Matriz final](revisao-visual.md): critérios visuais observados 9, com limites dos recortes; interação manual NV |
| Mapa | Rota inexistente; não aplicável | [Matriz final](revisao-visual.md): critérios visuais observados 9; interação manual NV |

As notas antigas sem defeito concreto não são convertidas retroativamente em aprovação. As tabelas detalhadas preservam os critérios e as limitações de cada revisão.

Os [recortes dos blocos expandidos](blocos-intermediarios/) foram capturados após os ajustes de legibilidade, mas antes da retirada dos títulos internos duplicados na entrada; são evidência intermediária identificada, não uma captura do último build.
