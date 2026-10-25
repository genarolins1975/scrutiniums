# Educação: entrada e ficha do município

Base: `1400e0383c2050da98b57e59b7569fddc54549e6` da main, 25/10/2026. Pedido: [documento do dono](../PEDIDO.md). Este é o primeiro de três PRs, sem autorização de merge.

A cidade escolhida passa a preceder os números nacionais. Sua ficha reúne séries, componentes, laboratório, comparação, matrículas, tabelas completas e downloads. O aperitivo continua limitado à consulta individual.

## Diagnóstico e direção

O arquivo `docs/ux-2026-10-25/educacao/ANALISE.md` citado no pedido não foi encontrado na main atualizada nem entre os anexos disponíveis. O diagnóstico usa o código, a descrição do pedido e as capturas do build de partida. Não se atribui conteúdo a uma análise que não foi lida.

A tarefa da entrada é localizar a cidade e contextualizar o resultado; a ficha permite entender sua evolução e composição. A identidade existente é preservada: papel, serifa editorial e acento do domínio apenas no dado. Sem bibliotecas ou animações novas.

Skills aplicadas: observatorio-layout e seus seis anexos solicitados, emil-design-eng, impeccable (caminho Launcher unavailable) e design-taste-frontend (app-screens). Os executáveis do Impeccable e Taste não estão instalados, conforme ORIGEM.md. Capturas e inspeção usam Playwright do projeto. O sistema da plataforma prevalece sobre sugestões conflitantes de cores, tipografia e rótulos das skills auxiliares.

## Inventário preservado

| Conteúdo | Antes | Depois |
|---|---|---|
| Extrato municipal, UF e Brasil | Dentro do Para você, abaixo da escala | Logo depois da abertura; também na ficha |
| Séries das duas etapas e metas | Duas colunas na entrada | Largura total na ficha; meta cheia ou vazada conforme o Ideb da edição |
| N, P, Saeb de português e matemática | Tabelas abertas | Pequenos múltiplos por etapa e tabelas completas recolhidas |
| Laboratório municipal | Ao lado do mecanismo estático | Um ModeloDidatico na ficha, com controles de aprovação integral e restauração |
| Laboratório nacional | Artefato da entrada | Um único laboratório nacional no artefato |
| Comparação UF, Brasil, porte e posição | Entrada | Ficha; referências por porte e UF também preservadas nos recolhidos da entrada |
| Matrículas, escolas e ressalva de creche | Entrada | Ficha |
| Cobertura, estados, porte e capitais | Recolhidos | Preservados |
| Fontes, método e downloads | Método da entrada | Preservados; downloads também antes do método na ficha |

## Contratos alterados de propósito

O molde recebe uma única fatia opcional `seu-municipio`, antes de `escala`, a pedido explícito do dono. Demais consumidores mantêm a ordem anterior. O teste do molde inclui a nova fatia sem remover a prova dos números, o artefato, o método ou seus limites.

O teste antigo que verificava série e componentes na entrada passa a verificá-los na ficha. As mesmas provas de valores, posição, matrículas e ausência permanecem. O teste novo de acesso inicialmente falhou porque a ficha não retornava ao aperitivo; por isso o registro de aperitivos recebe o prefixo da ficha, sem tornar nenhuma rota ou arquivo público. Educação mantém o resumo `?ibge=` com sessão; Saneamento conserva seu redirecionamento anterior.

O laboratório inicia nos N e P publicados na gold, sem arredondamento prévio dos controles; o produto pode diferir do Ideb oficial e isso aparece ao lado. Os gráficos não conectam lacunas, não substituem ausência por zero e mantêm a anotação de 2021.

## Evidências e limites

[Antes: capturas, acesso e axe](antes/evidencias.md). [Comprimento anterior](medidas-antes/medidas.json). [Hashes da gold antes](gold-antes.json).

Os resultados finais e os limites da revisão estão registrados abaixo.

## Verificações intermediárias

* Educação e aperitivo: 30 testes passaram.
* Pipeline Educação: 24 testes passaram; os 28 arquivos da gold continuam com os mesmos SHA256 registrados antes.
* Revisão independente do código: três achados corrigidos (fragmento da busca que pulava o extrato, passos de teclado dos controles e equivalente textual da meta). A revisão estática confirmou as correções; não substitui a conferência visual.
* A primeira execução de verificar:rapido encontrou a lista de rotas desatualizada. Ela foi regenerada por `node scripts/rotas-do-app.mjs`. A execução foi interrompida para reconstruir a aplicação e será repetida no estado final.

## Resultado medido no build final

[Depois](depois/evidencias.md), [medidas finais](medidas-depois/medidas.json), [revisão independente](revisao-final.md) e [adendo da revisão](revisao-acoes.md).

| Entrada | Antes 1440 | Depois 1440 | Antes 390 | Depois 390 |
|---|---:|---:|---:|---:|
| Sem cidade |4790|4776|7985|7996|
| Amparo do São Francisco, SE |8837|4930|14380|8108|
| Recife, PE |8934|4930|14511|8053|

Tetos da entrada:6500px a1440 e11000px a390, atendidos nos três recortes. Primeiro número nacional no recorte com cidade a1440:833px. Cromo da entrada a768:332→310px, sem alteração na barra comum. Aperitivo a390:3937px sem cidade,4360px em Amparo e4468px em Recife, dentro de4500px.

O código2800100 é Amparo do São Francisco(SE). As seis rotas foram capturadas nas três larguras, com e sem sessão. O mapa autenticado ainda retorna404 porque é a entrega2; isso está registrado nas evidências, não contado como fluxo entregue. Capitais permanece como na base até a entrega3. Nas quatro rotas alteradas, todas as capturas finais tiveram axe0, console0 e nenhum desvio ao login. A ficha anônima retorna ao aperitivo com o município; os arquivos continuam protegidos.

## Rubrica e limites da revisão

A matriz antes está em `revisao-antes.md`; a matriz depois em `revisao-final.md`, qualificada pelo adendo `revisao-acoes.md`. A revisora inspecionou24 capturas completas e24 primeiras telas das rotas alteradas. Não há novo defeito visual bloqueante demonstrado. O adendo corrige o uso indevido de notas8 genéricas como prova de reprovação: elas não tinham deficiência específica que sustentasse a distância até9. Isso tampouco autoriza declarar9 automaticamente. Interação permanece não verificada pela revisora estática; os resultados de navegador constam separadamente nos testes. A meta de9 em todos os critérios ainda não está comprovada.

Melhorias opcionais identificadas: aproximar a troca de cidade do extrato selecionado e agrupar a ressalva repetida nos pequenos múltiplos. A entrada sem cidade foi preservada por determinação explícita do pedido.

## Decisões para o dono

Revisar a fatia opcional `seu-municipio` do molde compartilhado, mínima para colocar o extrato antes da escala, e a separação entre entrada e ficha. Nenhuma autorização de merge foi inferida; este PR depende de revisão do dono. Não há dado novo nem alteração dos28 arquivos da gold nesta entrega.

## Testes no estado final

Preparação da sessão executada. Pipeline Educação: 24 testes aprovados. Verificação completa: lint, tipos, geração de derivados, build de produção e etapas Python aprovados (2450 testes do pipeline, além das suítes complementares). Vitest: 9637 aprovados, 12 skips preexistentes e um todo; duas falhas: cadastro da nova ficha, corrigido no inventário, e timeout de cinco segundos em equatorial-pi, a repetir isoladamente. Os testes de Educação no navegador passaram.

A etapa do Judiciário falhou em duas execuções: restauração da URL internacional após reload e duplicata internacional na referência, ambas a 390 px. Nenhum teste foi enfraquecido ou excluído, e o código do Judiciário não foi alterado. A verificação geral ainda não está integralmente verde.

Repetição isolada de Equatorial PI: os três testes passaram em 5,3 s, sem alterar timeout ou asserções. O filtro executou apenas essa página; os demais casos já constam da execução completa.
