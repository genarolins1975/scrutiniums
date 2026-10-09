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

## 8. Rodada 2, pedido ao pipeline: desconto negativo da Tarifa Social (ES e RJ)

- O que a fonte traz: no arquivo de Beneficiários da CDE (ANEEL) o desconto de algumas UF, em alguns meses, é negativo. A série mensal por UF (`public/energia/series/inclusao_cde_mensal_uf.csv`) tem 15 linhas assim: ES em 11 meses (mai/2025 a mar/2026; em mar/2026 o desconto é de R$ -11.456.619,05, o médio de R$ -41,84 por fatura, em 273.840 faturas) e RJ em 4 meses (jun a set/2025). A fonte não diz o motivo. No código, `resumo_cde_mes` soma `VlrSubsidio` sem inverter o sinal ("entram com o sinal da fonte"). O bronze e o silver da CDE não existem no ambiente do executor, então a distribuição de sinais por distribuidora não pôde ser vista.
- O que a página faz: mostra o valor como está na fonte, sem corrigir nem excluir, e põe junto do número a nota "valor negativo na fonte; a fonte não diz o motivo; pode refletir ajuste ou estorno, o que é inferência e não está confirmado". A nota aparece no mapa, na tabela por UF e no histórico, para qualquer UF e qualquer mês em que o desconto total ou o médio por fatura seja negativo (a regra é lida do dado, não é uma lista de UF). No mapa o negativo tem classe própria ("menos de 0", cor fora da escala de desconto positivo) e nunca entra no cálculo das classes positivas da legenda. A linha "não permite concluir" cita as UF do mês. Seletores `ufsComDescontoNegativo`, `mesesComDescontoNegativo`, `classificacaoMapaTsee` e `NOTA_DESCONTO_NEGATIVO` em `src/lib/energia/inclusao.ts`; testes em `energia-inclusao.test.ts` ("desconto negativo por UF e mês"), com dados sintéticos além do gold.
- Pedido: (a) publicar, por UF e mês, a soma por distribuidora e a contagem de linhas de sinal negativo e positivo do arquivo, para dizer se o negativo vem de poucas distribuidoras; (b) a ressalva que o coordenador pôs em `validar_gold` (`pipeline/energia/modulos/inclusao.py`) olha só o mês do mapa (`tarifa_social.ufs`), e a série mensal tem negativos em outros meses, então a validação deveria percorrer a série; (c) a gold publicada ainda não traz a ressalva. Depois da regeneração a página continua lendo o sinal do próprio dado, e a nota da gold pode aparecer ao lado, sem trocar a regra.

## 9. Rodada 2, pedidos ao pipeline: numerador da proxy por subclasse e fichas que faltam

A avaliação técnica pede o numerador da razão faturas por famílias do Cadastro Único aberto em BPC e multifamiliar (a avaliação mediu BPC em 10,9% das faturas e a subclasse 3.6, multifamiliar, em 0,8%, e diz que o arquivo da CDE permite separar). A gold publica as UC do BPC no SCS (1.784.519, 10,3% das 17.246.524 UC de mai/2025, em `tarifa_social.modalidades_referencia`) e a diferença de 2,12% entre faturas da CDE e UC do SCS (`tarifa_social.conferencia_scs_cde`), mas não as faturas da CDE por subclasse por UF e mês. Pedido: publicar as faturas por subclasse (3.2 a 3.6) por UF e mês, e uma variante da razão sem BPC. A página diz o limite (o numerador inclui BPC e equipamento médico, fora do denominador) e não separa o que a gold não traz. A avaliação aponta ainda multifamiliar 0 no SCS contra 142.193 faturas da subclasse 3.6 na CDE, sem explicação (números dela, não conferidos aqui: o bronze da CDE não está no ambiente).

Fichas "Comprove este número" que a gold não traz e que o controle do painel deixaria à vista em todas as escolhas: no Acesso, as participações pela rede geral e pelo tempo integral (hoje só o indicador sem energia tem `evidencia_sem_energia`); no Orçamento, a média das razões na renda do total e da maior faixa (só a da classe baixa tem ficha). Enquanto a ficha não existe, a página diz a razão ao lado do número (lista `SEM_FICHA_PROPRIA` em `energia-inclusao.test.ts`).

## 10. Rodada 2, pedidos de componente e dicionário

- `NotasDoPainel`: o rótulo "O que mudou" é fixo. Na Tarifa Social a base legal da regra de 80 kWh (MPV nº 1.300/2025 convertida na Lei nº 15.235/2025, conforme a linha do tempo da Regulação) entra nesse encaixe, porque é mudança regulatória, e a própria frase diz que é base legal. Um rótulo escolhido pelo painel (por exemplo "Base legal e mudanças") evitaria forçar o encaixe. Em Cobertura a mesma frase fica na seção de auditoria, ao lado da "Base legal" da gold.
- Sigla ESS: no dicionário (`siglas.ts`) é "Encargos de Serviços do Sistema"; na gold da família `ESS` também é a sigla de uma distribuidora (CNPJ 07282377000120, nas tabelas de distribuidoras e nas rupturas de série). As páginas da família passam a lista de siglas à legenda de forma explícita, então nelas não há expansão errada, mas uma varredura automática do texto confundiria as duas.
- `InclusaoPorEstado.tsx` (novo): três envoltórios de cliente (`InclusaoPorBasePof`, `InclusaoPorIndicadorPnad`, `InclusaoPorMedidaTsee`) que escolhem, pelo estado da URL, a variante da frase, dos cartões e da ficha renderizada no servidor. Um componente compartilhado que fizesse o mesmo para qualquer painel (variantes por valor de controle) tiraria a necessidade de envoltórios por família.

## 11. Rodada 2, pendências declaradas (não feitas por decisão do coordenador de concluir sem exigir nota 9)

- Anotação de ano orçado ou parcial nos três gráficos de barras anuais: CDE 2026 da Tarifa Social, CDE para Luz para Todos e CCC em 2026 e Luz para Todos por ano no Acesso (usar série `opcional` ou `empilhado` do `GraficoBarras`); a avaliação diz que a fonte não separa orçado de executado.
- Siglas CCC, MPV (fora da frase de base legal) e ESS sem expansão no primeiro uso em todos os pontos, e definição dos selos de natureza em texto visível.
- Navegação: faixa de navegação na síntese, "Onde aprofundar" com o Peso no orçamento e a pista `#municipios` do mapa municipal da Cobertura.
- Eixos e classes: histórico nacional do Acesso com 0 e 1 casa decimal, classes do mapa, contagem absoluta de faturas por UF com link ou versão proporcional.
- Tabelas largas em 390 px e a tabela de 45 colunas do Orçamento (dividir em tabelas menores).
- Numerador da proxy por subclasse (BPC, multifamiliar, excesso de faturas sobre UC): depende do pedido 9.
- Ressalvas de tempo integral e do dicionário do MME junto do número.
- Denominador da despesa total e faixa entre estimadores sensíveis.
- Quebras de série: queda do SCS em 2015 e a unidade da evolução da proxy (UC, termina em mai/2025).
- Rastreabilidade: código da gold com sufixo "alterado", fichas das faturas e do proxy sem detecção de revisões, fontes móveis sem snapshot, dicionário do CSV incompleto (excesso de faturas sobre UC), arredondamento duplo da faixa de 101 a 220 kWh (44,2% contra 44,147% exato), multifamiliar sem explicação, Tefé e a revisão do Luz para Todos depois da captura.
- Validação de dados só no pipeline (`validar_gold`), a cargo do coordenador; desempenho de campo (LCP, INP, CLS) e leitor de tela não podem ser medidos neste ambiente.
- Tarifa Social: os três cartões, cada um com a própria ficha "Comprove este número", já aparecem lado a lado; só a frase de resposta segue a Medida do painel.
