> Parecer histórico do commit 304b6dba. Os dois P1 foram reavaliados e encerrados na [revisão final de legibilidade](revisao-legibilidade.md). As notas desta candidata não são uma homologação de excelência do código final. Os [dados daquela candidata](revisao-candidata/jornadas.json) e as [capturas próprias da revisão](revisao-candidata/evidencias/) estão separados das evidências finais; os caminhos absolutos no parecer são os originais da execução.

# Resposta na entrada — revisão independente da candidata final

27/10/2026. Commit `304b6dba31c0810f2eee66c9d0a992c368633a8f`; build `woQGXRcnqBp8uUHrAebiy`. Checkout `/workspace/scrutiniums-resposta-na-entrada`. Parecer limitado a esta revisão, sem alterações no repositório.

**Decisão:** a reorganização resolve a precedência da tarefa nas cinco entradas autenticadas. A 390 × 900, os controles e o primeiro valor com sua unidade aparecem inteiros antes do panorama. Aprovo a estrutura de Custo de vida, Conectividade e Síntese das capitais no escopo examinado. Combustíveis e Educação ainda precisam de correção localizada para encerrar o aceite de texto ampliado: a 320 px com raiz a 200%, números decimais se partem entre linhas. Isso é um problema visual real, embora a consulta funcione e não haja overflow horizontal.

Não há homologação humana, certificação WCAG integral ou comprovação de ganho de conversão neste parecer. O ganho demonstrado é de proximidade, ordem e coerência entre a escolha e a resposta.

## Evidência, método e limites

- Base anterior: `/workspace/resposta-layout-antes.md`, capturas autenticadas em `/workspace/resposta-evidencias/antes/` e avaliação do conselho da mesma base `8a7cd80b27e5110f0024236fc73ae1fabb61de69`. Revi as cinco aberturas móveis anteriores nesta rodada.
- Candidata: examinei as 20 aberturas de `/workspace/resposta-evidencias/jornadas/`, nas larguras 320, 390, 768 e 1440 px, altura 900; as dez páginas completas de 390 e 1440; as cinco consultas a 390 com raiz a 200% e Educação a 320. As imagens completas servem à sequência/densidade; os textos foram conferidos nas aberturas, no código e nas capturas aproximadas.
- Reproduzi jornadas com `scripts/servidor-local.mjs` e `/usr/bin/chromium`, em scripts próprios, usando no máximo um navegador por vez. Sessão local autenticada, toque simulado e teclado; não substituem aparelho físico, Safari/Firefox nem leitor de tela. Saída exclusiva em `/workspace/resposta-revisao-final/`.
- Capturei adicionalmente o **valor efetivo**, depois de rolar até ele, a 320 e 390 com raiz a 200%, nas cinco páginas. Essa inspeção encontrou os dois problemas numéricos que a posição do bloco e a ausência de overflow não revelaram.
- `jornadas.json` identifica commit/build corretos. Seus 20 estados registram zero achados axe e zero erros de página; larguras do documento coincidem com os viewports em normal e raiz ampliada. É evidência mecânica complementar, não prova suficiente da leitura ou da conformidade integral. Não rodei novamente axe, npm testes ou build.
- A simulação `html { font-size: 200% }` não duplica textos definidos em px: por exemplo, o H1 da Educação continua com 30 px a 390. O arquivo `reflow200` do coletor reduz o viewport de 1440 × 900 para 720 × 450; não equivale, por si só, a uma auditoria de zoom nativo de navegador. Não chamar essas evidências de “todo o conteúdo ampliado em 200%”.
- Reapliquei as referências já lidas de Observatório Layout, Emil, Impeccable/Layout e Design Taste. O launcher Impeccable permanece ausente; não há alegação de detector Impeccable aprovado. A leitura visual precedeu a síntese com as medições.
- Não revalidei as bases inteiras, todas as opções, todos os downloads ou a produção. Os aperitivos foram conferidos como preservação de acesso, sem atribuir a eles toda a mudança visual das entradas autenticadas.

## Antes → depois e decisão por página

As posições anteriores dos controles são as medições do conselho a 390 × 900; as novas são do `jornadas.json` final, com recorte selecionado. Medidas arredondadas em px, não tempos de tarefa. “Base do valor” inclui o elemento que contém valor/unidade; em Conectividade a unidade é o rótulo imediatamente acima.

| Página / recorte final capturado | Antes: topo do controle | Depois: topo do controle | Primeiro valor a 390; base | Base a 320 | Decisão |
|---|---:|---:|---|---:|---|
| Custo de vida / RM Recife | 2.522 | 518 | 4,79% em 12 meses; 789 | 854 | Estrutura aprovada; limite territorial explícito. |
| Conectividade / Recife | 2.724 | 495 | 18,3 acessos fixos por 100 habitantes; 724 | 803 | Estrutura aprovada; manter ressalva editorial do H1 abaixo. |
| Combustíveis / Pernambuco, 40 L | 2.607 | 483 | R$ 273,60 para 40 litros; 823 | 913 | Ordem e cálculo aprovados; encerrar texto ampliado depende de P1-1. |
| Educação / Recife, Ideb 2025 | 2.417 | 538 | 5,8 de 0 a 10, anos iniciais municipais; 825 | 914 | Escolha/extrato aprovados; encerrar texto ampliado depende de P1-2. |
| Síntese / São Paulo × Curitiba | 2.385 | 498 | 91,1%, escola de 4 e 5 anos; 759 | 878 | Estrutura aprovada; os sete resultados antecedem catálogo e contexto. |

O estado anterior da Síntese nomeava Recife e abria com medianas das 26 capitais; agora o título, os controles e os valores locais concordam. Não comparar os números de Recife e São Paulo como se fossem uma evolução temporal: a comparação aqui é da estrutura de apresentação.

A 320 × 900, os valores de Combustíveis e Educação terminam respectivamente cerca de 13 e 14 px abaixo do viewport. Uma pequena rolagem os revela por inteiro. Isso **não** é corte por contêiner nem overflow horizontal, mas impede prometer “valor e unidade inteiros na primeira tela em todos os estados de 320”. Nenhuma das cinco páginas intercala cartões, contexto nacional ou catálogo entre a escolha e a resposta.

## Achados priorizados

### P1-1 — Combustíveis parte o número monetário em texto ampliado a 320

Evidência independente: [captura do valor](revisao-candidata/evidencias/combustiveis-320-valor-texto200.jpg). Na raiz a 200%, a resposta aparece como `R$ 273,` na primeira linha e `60 para 40` na seguinte. O número perdeu sua unidade visual, embora todos os caracteres estejam presentes. A 390 ampliado, `R$ 273,60` permanece junto.

Aceite: conservar os algarismos de cada valor monetário como um número indivisível; permitir reorganização do símbolo, da unidade e dos rótulos em linhas próprias se necessário, sem esconder centavos, reduzir texto essencial para caber ou criar rolagem horizontal do documento. Repetir 320/390 ampliado, litros válidos, volume inválido e valores maiores. O problema não é o resultado calculado: PE, 60 litros retornou corretamente R$ 410,40.

### P1-2 — Educação conserva duas colunas quando o número ampliado já não cabe

Evidência independente: [captura a 320](revisao-candidata/evidencias/educacao-municipal-320-valor-texto200.jpg) e [a 390](revisao-candidata/evidencias/educacao-municipal-390-valor-texto200.jpg). A 320 ampliado, `5,8` vira `5,` / `8` e `4,9` vira `4,` / `9`. A unidade `de 0 a 10` também se distancia verticalmente do valor. A 390, os decimais ficam inteiros, mas a unidade ainda se divide com grande intervalo. A regra nova `.edm-extrato-entrada dl` mantém duas colunas no móvel; a largura disponível não acompanha a ampliação em rem do valor.

Aceite: cada etapa deve acomodar número e unidade como uma leitura contínua; usar uma coluna quando o espaço real deixar de comportar as duas. Conferir Recife, nome longo e ausência de Ideb em 320/390, normal e ampliado. Não basta marcar o `<dd>` como visível ou esperar `scrollWidth === innerWidth`.

### P2 — abertura normal extrema requer rolagem curta em duas páginas

A ressalva dos 13–14 px acima é separada dos P1. Não há perda de conteúdo. O contrato de proximidade está atendido; o contrato mais forte de tudo caber na primeira tela a 320 não está. Não reduzir fonte ou eliminar fonte/limite para obter esse número.

### P2 — o H1 de Conectividade ainda promete mais que a fonte

“Quem tem internet de verdade no Brasil?” permanece na entrada autenticada. A nova introdução e a nota junto da resposta descrevem corretamente acessos e cobertura declarada, mas o título pode sugerir qualidade real medida. É herança da versão anterior, não regressão desta reorganização. Uma futura redação alinhada à consulta municipal evitaria a ambiguidade. O aperitivo já usa “Como é a internet na minha cidade?”.

## Avaliação espacial independente

| Dimensão | Antes | Depois e evidência |
|---|---|---|
| Ordem de leitura / squint test | H1 seguido de panorama; a ação só aparecia várias telas abaixo. | H1 → campo → resultado. Nas 20 aberturas, valor e controle formam o segundo foco; filetes e contraste mantêm os grupos legíveis. |
| Agrupamento | Escolha misturada a caminhos de outros temas; Educação separava extrato da troca; Síntese separava seleção da régua. | Busca e extrato estão contíguos; resumo das sete condições vem antes de qualquer catálogo. Âncoras abrem detalhes correspondentes ao recorte. |
| Ritmo | Faixas de números e cartões tinham precedência repetida em todas as coleções. | A abertura ganha cadência curta de operação; contexto recolhido vem depois. Modelo, perguntas e aprofundamentos mantêm intervalos maiores. O rodapé continua comprido no celular, mas não bloqueia a tarefa. |
| Estrutura | Molde de apresentação dominava uma tarefa de consulta. | Cinco consultas usam a mesma posição estrutural com respostas apropriadas: inflação comparável, cálculo do tanque, retrato municipal e síntese de condições. |
| Densidade | Informação nacional ocupava o espaço da escolha. | A área inicial contém informação pertinente ao caso. Combustíveis tem quatro produtos; Síntese tem sete condições com prova e limite. É conteúdo legítimo, mas justifica notas de densidade moderadas, não excelência automática. |
| Adaptação | Empilhamento conservava a precedência errada. | Campos cabem em 320; valores comparados distribuem-se em desktop e se empilham onde previsto. O par de seletores da Síntese se empilha a 320. Educação e Combustíveis ainda falham na unidade visual do número ampliado. |
| Extremos | Não havia evidência independente de interação ou ausências na rodada inicial. | Busca aberta não foi cortada; teclado e toque funcionaram; ID inválido e fonte ausente têm mensagens específicas. Texto ampliado foi operável, mas revelou os P1. |

Comprimento total das páginas, incluindo rodapé, com recortes selecionados e detalhes recolhidos:

| Página | 390 px | 1440 px |
|---|---:|---:|
| Custo de vida | 7.661 | 4.307 |
| Conectividade | 8.357 | 4.802 |
| Combustíveis | 10.357 | 5.736 |
| Educação | 7.801 | 4.913 |
| Síntese | 9.996 | 5.962 |

Todas ficam abaixo dos orçamentos existentes de 11.000/6.500 px nessas duas larguras. Isso confirma que a antecipação não produziu as violações de comprimento vistas na rodada 1; não prova que todas as regiões tenham densidade ideal.

## Jornadas executadas por esta revisão

Os scripts e registros estão em [evidências independentes](revisao-candidata/evidencias/). Foram 19 jornadas funcionais, mais 12 verificações complementares de extremos. Os registros automáticos aprovam geometria/estado; os dois P1 foram encontrados na leitura das imagens e prevalecem sobre esses resultados.

| Jornada | Resultado observado |
|---|---|
| Conectividade e Educação: buscar “Recife PE”, navegar opções com setas e Enter | Recorte `2611606`, identidade e resposta correspondentes; foco visível. |
| Ambas: trocar Recife por “Olinda PE” com toque simulado | Recorte `2609600` e novo resultado; campo continua disponível. |
| Ambas: “Bom Jesus”, nomes repetidos, Escape | Opções distinguem UF; Escape fecha e limpa a busca. |
| Ambas: `ibge=7777777` | Aviso com código, campo para correção e nenhuma medida municipal indevida. |
| Conectividade: Boa Esperança do Norte | Dados disponíveis permanecem; cobertura ausente explicitada, sem zero inventado. |
| Educação: Fernando de Noronha | “Sem Ideb” da edição corrente; não se substitui silenciosamente por edição anterior. |
| Conectividade: abrir contexto e link de detalhes | Panorama abre; detalhe do município é revelado e há tabela acessível. |
| IPCA: Brasil → Recife → abrir grupos → Goiânia → recarregar | Recife 4,79%; nove grupos preservados; área e resposta de Goiânia sobrevivem ao recarregamento. |
| Combustíveis: PE, 60 L → SP → 0 L | R$ 410,40; UF acompanha escolha; zero gera aviso de 1 a 1.000 L e preço por litro, sem tanque de zero/NaN. Delta explícito “Preço por litro: R$ 0,30 … (R$ 6,54 por litro)”. |
| Síntese: Recife/Curitiba → São Paulo/Rio → régua → recarregar | H1, resumo e comparação mudam juntos; sete réguas existem; capital e comparador persistem na URL. |
| Educação a 390, raiz 200%: procurar e tocar Olinda | Consulta permanece operável; resultado local correto, sem rolagem horizontal. Isso não elimina a falha visual a 320. |
| Sem sessão: Conectividade, Educação, Síntese e consulta direta de combustível | Aperitivos carregam com recorte, sem redirecionamento indevido ao login ou falhas de resposta registradas. |
| Cinco páginas a 320/390 com raiz 200%, rolar até primeiro valor | Valor pode ser alcançado e documento não transborda; leitura visual reprova números partidos em duas páginas a 320. |
| IPCA e combustível: área/UF inválida | Aviso explícito de retorno ao Brasil; referência nacional não se apresenta como local. |

Arquivos principais: [jornadas funcionais](revisao-candidata/evidencias/resultados.json), [reexecução do combustível](revisao-candidata/evidencias/resultados-combustiveis.json), [extremos](revisao-candidata/evidencias/resultados-extremos.json). O primeiro registro contém uma falha do **script** por label antigo “Litros no tanque”; na primeira reexecução, um seletor sem `exact` também coincidiu com o nome da região. Corrigi apenas os seletores externos e a jornada passou. Esses erros não são falhas do produto. Todos os registros finais têm `erros: []` de execução de página.

## Resposta e limites da fonte

- **Custo de vida:** Recife é identificado como região metropolitana, 4,79% em 12 meses, outubro/2025 a setembro/2026. Brasil 4,58% na mesma janela; diferença 0,21 ponto percentual. A nota próxima informa as 16 áreas e que cidade fora da lista não tem IPCA próprio. A resposta não se apresenta como inflação pessoal nem comparação de níveis de preço.
- **Conectividade:** 18,3 acessos por 100 habitantes; fibra 81,0%; cobertura 5G 99,9%. Meses próprios e natureza acompanham cada medida: densidade publicada, proporção calculada, cobertura declarada. A nota distingue contratos de pessoas e cobertura de velocidade/sinal dentro da casa. Não se trata de avaliação de qualidade real.
- **Combustíveis:** tanque calculado pela média da ANP × volume; produto, UF, mês, preço por litro e amostra sustentam o resultado. A diferença para Brasil voltou a ser inequívoca por litro. Não é cotação de posto, preço garantido nem recomendação de rendimento do etanol.
- **Educação:** rede municipal, etapas, ano e escala são visíveis. Referências “rede pública de Pernambuco” e “redes municipais do Brasil” conservam universos distintos. Ausência da edição foi reproduzida. A ficha é caminho de profundidade; o extrato não se apresenta como nota de uma escola individual ou da gestão.
- **Síntese:** sete valores locais com comparador e período; 26 capitais, sem DF, e ausência de atribuição causal à gestão explícitos. Limites materiais acompanham as medidas, inclusive precisão municipal não quantificada e homicídios estimados. A régua explica posição relativa, não nota/meta.

## Oito dimensões antes/depois

Escala independente: 7–8 significa bom com limites; 9 exige excelência demonstrada. `NV` = não verificado na rodada anterior. Interação/a11y é uma nota **parcial do escopo observado**, não conformidade integral. A matriz não é média de aprovação e não apaga os P1.

| Página | Arte | Hierarquia | Tipografia/acabamento | Densidade/profundidade | Didática | Comparabilidade | Interação/a11y | Responsividade da tarefa |
|---|---|---|---|---|---|---|---|---|
| Custo de vida | 8→8 | 5→8 | 8→8 | 6→8 | 7→8 | 6→8 | NV→7 parcial | 6→8 |
| Conectividade | 8→8 | 5→8 | 8→8 | 6→8 | 7→7 | 7→8 | NV→7 parcial | 6→8 |
| Combustíveis | 8→8 | 5→8 | 8→7 | 6→7 | 7→8 | 8→8 | NV→6 parcial | 6→7 |
| Educação | 8→8 | 5→8 | 8→7 | 6→8 | 7→8 | 7→8 | NV→6 parcial | 6→7 |
| Síntese | 8→8 | 4→8 | 8→8 | 6→7 | 6→8 | 6→8 | NV→7 parcial | 6→8 |

A identidade de papel/marfim, serifa, acentos e filetes foi preservada. A hierarquia melhorou pela mudança de ordem, não por decoração. As reduções de nota em tipografia refletem evidência nova da ampliação extrema, ausente na primeira rodada; não alegam regressão comparativa do mesmo teste anterior. Para fechar as cinco páginas sem ressalva de ampliação, corrigir P1-1/P1-2 e repetir as capturas dos valores e a operação nesses estados. Não é necessário reabrir a arquitetura aprovada.
