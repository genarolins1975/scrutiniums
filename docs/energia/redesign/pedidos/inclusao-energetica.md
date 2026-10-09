# Pedidos de mudança compartilhada: família Inclusão energética

Rotas `/setor-eletrico/inclusao-energetica` (síntese), `/acesso`, `/cobertura`, `/orcamento` e `/tarifa-social`. Cada pedido diz o que mudar, por que e em que arquivo. Nenhum deles bloqueia as páginas: elas seguem com a melhor solução local, descrita em cada item.

## 0. Arquivo sem uso para apagar no fim (regra do coordenador: não apagar componente com o servidor no ar)

- `src/components/energia/InclusaoLinkPainel.tsx`: nenhum arquivo o importa mais. O rodapé de cada painel e da síntese passou a usar o `SeguirPainel` compartilhado (pelo envoltório `InclusaoSeguir`, em `InclusaoPagina.tsx`), com o mesmo botão "Copiar link deste painel", o mesmo endereço e a mesma mensagem de cópia. Nenhum teste depende dele.

## 1. `SeguirPainel`: a lista de arquivos nunca abre sozinha

Com mais de um arquivo o componente usa `DetalheDoNivel` com `abreEm="nunca"`: em Analisar e Auditar, onde o leitor procura os dados, a lista continua recolhida atrás de "Baixar os dados (N arquivos)". Nada se perdeu (o inventário mecânico de visões conta os mesmos arquivos de antes: 16 na síntese, 5 em Acesso, 5 em Tarifa Social, 2 em Cobertura e 1 em Orçamento), e cada tabela interativa traz "Baixar CSV" e "Baixar XLSX" à vista. O pedido é de uso: `abreEm="analisar"` abriria a lista nesses níveis. Arquivo: `src/components/energia/SeguirPainel.tsx`. Local: a síntese passa os 16 arquivos e uma nota de formato (`extra`), que o leitor encontra ao abrir a lista.

## 2. A regra de `globals.css` que põe `[data-resposta]` primeiro age dentro de `SecaoDoPainel`

`[class*="space-y-"] > [data-resposta]:not([data-resposta-depois]) { order: -1; ... }` também vale para o contêiner de `SecaoDoPainel` (que usa `space-y-4`): uma `RespostaCurta` colocada direto numa seção da síntese subia para antes do título da seção. Local: nos quatro blocos da síntese (`page.tsx`, seções `sintese-p059`, `sintese-p060`, `sintese-p062` e o painel de orçamento) a resposta vai dentro de um `<div>`, que escapa da regra, e nas páginas filhas ela entra por um encaixe (`resposta`) de um grid. A propriedade `depois` de `RespostaCurta` (commit `eaac0d3ba`) resolveria o mesmo sem o `<div>`; fica a critério do coordenador trocar. Proposta alternativa, mais estrutural: `SecaoDoPainel` usar `flex flex-col gap-4` em vez de `space-y-4`, porque a regra de ordem deixaria de alcançar as seções.

## 3. `GraficoBarras`: a linha de referência tracejada atravessa rótulos no celular

Em `src/components/energia/GraficoBarras.tsx`, com `referencias` e `orientacao="horizontal"`, abaixo de 480 px o rótulo da categoria fica acima das barras e a linha tracejada vertical (a razão de médias de todas as famílias, 2,48%) passa por cima dele ("Mais de R$ 5.724 a R$ 9.540") e de rótulos de valor ("2,42", "2,30", "1,96"). Medido em 390 px na figura de despesa por faixa de renda da página de orçamento e na síntese. Não esconde número, mas risca o texto. Proposta: começar a linha depois da faixa dos rótulos de categoria ou desenhar os rótulos por cima, com um fundo da cor da página. Local: nenhum ajuste, a figura é a do componente. Em outro ponto o ajuste foi local: com três séries, sete faixas passam do `alturaMaxima` padrão (480 px) e o gráfico mostrava só seis faixas e meia, com "Mostrar todas as 7"; as três figuras de barras horizontais da família passam `alturaMaxima={900}` e aparecem inteiras.

## 4. `Numero variante="faixa"`: não há campo para o recorte da medida, só para o período

Na faixa de métricas da síntese e do orçamento duas medidas são de uma faixa de renda ("Até R$ 1.908", "Mais de R$ 23.850") e precisam dizer a faixa e o período juntos. Hoje a propriedade `periodo` leva os dois, como texto (`"Até R$ 1.908 · POF jul/2017 a jul/2018"`). Funciona à vista, mas mistura recorte e período numa propriedade que a coleta e os testes leem como período. Proposta: uma propriedade `recorte?: string` que `Numero` mostra antes do período, separada por ponto médio. Arquivo: `src/components/energia/Numero.tsx`. Local: a mistura acima, em `page.tsx` e `orcamento/page.tsx`.

## 5. Dicionário de siglas sem PNAD, PASI, MDS e CV

`src/lib/energia/siglas.ts` (`SIGLAS`) não traz a Pesquisa Nacional por Amostra de Domicílios (PNAD), o Portal de Acompanhamento e Informações dos Sistemas Isolados (PASI), o Ministério do Desenvolvimento e Assistência Social (MDS) nem o coeficiente de variação (CV), e `LegendaDeSiglas` só expande o que está no dicionário. As páginas da família usam as quatro. Local: cada uma é expandida no primeiro uso, em texto da página (cabeçalho e notas), e um teste (`energia-inclusao.test.ts`, "siglas fora do dicionário compartilhado") confere que a primeira aparição é a da própria expansão. Se o coordenador acrescentar as quatro ao dicionário, a legenda passa a cobri-las sozinha e as expansões em texto podem ficar.

## 6. `LegendaDeSiglas`: o resumo "Mais N siglas" tem 24 px de altura

Em `src/components/energia/LegendaSiglas.tsx` o `<summary>` usa `min-h-[24px]`. Medido em 390 px nas cinco páginas, o alvo tem 73 por 24 px (e 65 por 24 px com "Mais 1 sigla"), abaixo dos 44 px que o sistema pede para controles no toque. Proposta: `min-h-[44px]` abaixo de 768 px (ou sempre, como o resumo do `SeguirPainel`). Local: nenhum ajuste, o componente é compartilhado.

## 7. Achados de dado (não corrigidos, fora do que a família pode mudar)

- `public/energia/gold/inclusao.json`, `tarifa_social.proveniencia.cde`: a ficha "Faturas com desconto da Tarifa Social por município e UF (Beneficiários da CDE)" declara `download: /energia/series/inclusao_municipios.csv`, e a série mensal por UF que o gráfico e o mapa leem está em `inclusao_cde_mensal_uf.csv`. A página mostra o link da ficha como a gold o entrega.
- `public/energia/gold/inclusao.json`, `cobertura.pergunta`: "Quem pode estar ficando de fora?" enquadra a razão como exclusão, e a razão faturas por famílias não mede quem fica fora. A página cita a pergunta entre aspas, em "o que não é possível concluir", e usa um título neutro; os testes que exigem a pergunta no HTML continuam passando.
- `src/lib/energia/conteudo/conceitos-inclusao.ts` só traz o verbete da Tarifa Social. Não há verbete conferido na fonte para Cadastro Único, MI Social, POF, PNAD nem PASI (o Aprenda não os define). As páginas dizem o que cada um conta, no ponto de uso, e usam a definição da Tarifa Social do verbete; não escrevem definições de memória.
- Ficha "Comprove este número" só existe para a razão total, o numerador da cobertura e as medidas que a gold publica com `evidencia`. Os destaques de menor e maior faixa de renda (POF), a razão com todas as cadastradas e o denominador da cobertura saem dos mesmos seletores, sem ficha própria, e a página diz a razão ao lado (lista `SEM_FICHA_PROPRIA` em `energia-inclusao.test.ts`).
