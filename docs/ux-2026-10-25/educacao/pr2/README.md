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

[Antes](antes.md). [Revisão independente do código](revisao-codigo.md), com adendo das correções. As medidas, capturas finais, rubrica e resultados das verificações serão anexados após o build. A análise externa `ANALISE.md` continua indisponível no repositório e nos anexos acessíveis; não se atribui conteúdo a ela.

## Verificações já concluídas

Preparação da sessão executada. Pipeline Educação: 29 testes passaram. Contratos da página e navegação da coleção: 72 testes passaram. A auditoria da publicação preservou todos os valores anteriores e registrou os hashes dos 29 arquivos novos.
