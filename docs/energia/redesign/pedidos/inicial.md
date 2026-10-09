# Pedidos da página inicial

Rota `/setor-eletrico`. Cada pedido diz o que mudar, por que e em que arquivo. Nenhum bloqueia a página: ela segue com a melhor solução local, descrita em cada item.

## 0. Arquivos sem uso, para o coordenador apagar no fim (com o servidor parado)

Nenhum. Todos os componentes que a inicial anterior importava seguem em uso (`BuscaObservatorio`, `MapaConceitual`, `EscolhaDistribuidora`, `RedirecionaAncoraAntiga`, `ComproveNumero`, `Termo`, `Unidade`, `SeloNatureza`, `MarcaVisita`). Nenhum arquivo foi apagado.

## 1. Verbetes de ONS, CCEE e ANEEL (depois EPE e IBGE) para a dica de glossário

Origem: avaliação de produto da inicial, achado `raiz-siglas-agentes` (ONS 28 vezes, CCEE 17 e ANEEL 12 sem nome por extenso). O `Termo` só dá dica para verbete de `conteudo/conceitos*.ts`, e nenhum desses órgãos tem verbete. A inicial já expande cada sigla na primeira ocorrência à vista (ANEEL, ONS e CCEE na linha de fontes da abertura; SIN no sinal de reservatórios; CNPJ no mapa; EPE, IBGE, CVM e MCTI na legenda "Órgãos" abaixo da tabela de atualidade), mas a dica ao passar o ponteiro ou ao tocar exige verbete conferido em fonte oficial, e verbete é conteúdo do Aprenda. Pedido ao dono do Aprenda: criar `ons`, `ccee` e `aneel` (e depois `epe` e `ibge`) com fonte primária. Quando existirem, a inicial troca o texto simples da linha de fontes por `Termo` (uma linha em `src/app/setor-eletrico/page.tsx`, na linha "Fonte: N órgãos, entre eles ...").

## 2. A dica do `Termo` traz a definição literal da fonte

Origem: avaliação de produto, achado `raiz-definicoes-literais` ("exposições dos agentes", "usinas a jusante na cascata", sem frase leiga antes). `src/components/evidencia/Termo.tsx` (compartilhado) mostra `emUmaFrase`. Os verbetes que têm `emPalavrasSimples` poderiam mostrar essa frase primeiro e a definição da fonte depois. Mudança proposta: `const dica = c.emPalavrasSimples ?? c.emUmaFrase` com a definição literal logo abaixo, só quando as duas existem.

## 3. Território aceitar o texto da busca na URL

Origem: avaliação de produto, achado `raiz-busca-lexica` ("Campinas" devolvia "Nada no observatório"). A busca da inicial não indexa município (são milhares, e o HTML pesaria centenas de KB). Quando a consulta não acha nada, ou sempre que há texto no campo, a tela mostra "Procura um município? A busca por cidade está em Minha região", com link para a página, sem levar o nome digitado. Pedido ao dono de Território: aceitar `?busca=<texto>` (ou `?q=`), que preencha a busca de município ao abrir a página. Com isso, `src/components/energia/BuscaObservatorio.tsx` passa a montar o link com o texto digitado (uma linha).

## 4. Nome do item do menu e a palavra "agora" em `navegacao.ts`

Origem: avaliação de produto, achado `raiz-menu-nome`. Em `src/lib/energia/navegacao.ts`, a página inicial aparece como "Mapa" (linha 31) e "Mapa do observatório" (linha 96), mas é a porta de entrada, com busca, seis perguntas e índice, e o mapa é só uma das seções. Proposta: "Início" nos dois lugares (o teste `energia-mapa` confere `MODULOS_ENERGIA[0]` por `slug` e `href`, não pelo rótulo). O mesmo arquivo tem "agora" no resumo do grupo "Comece aqui" (linha 202, "o que está acontecendo agora") e no resumo do PLD (linha 33, "o que acontece agora"), contra a regra editorial de não escrever "agora" como data.

## 5. Cabeçalho em três camadas na inicial

Origem: avaliação de produto, achado `raiz-cabecalho-camadas`: seletor de observatório, seis menus de grupo e abas de página somam cerca de 185 px da primeira tela em 390 px e 16 paradas de Tab antes da busca (há link para pular). Proposta, em `CabecalhoEnergia` (compartilhado): na inicial, fundir grupo e página numa só camada, ou recolher a camada de abas.

## 6. Denominador das perdas e reconciliação, no pipeline

Origem: avaliação técnica da inicial (critérios F, G e H) e do cruzamento entre páginas. A taxa de 14,75% (valor exibido na ficha: "14,7%") usa como denominador a "energia injetada de referência" (612,65 TWh), que em 47 das 51 concessionárias é a energia requerida (42) ou mista (5), e não a linha de energia injetada que a ANEEL publica (632,05 TWh nas mesmas 51, que daria 14,30%). A ficha da gold descreve o denominador só como "Σ energia injetada de referência (MWh)" e registra `reconciliacao: null`.

Pedido ao pipeline (`pipeline/energia/modulos/perdas.py` e `evidencia.py`): (a) nomear a origem no próprio `denominador.descricao`; (b) registrar a base alternativa (energia injetada publicada) na ficha, com a taxa que ela daria; (c) uma reconciliação por outro caminho para 2025 (a gold só traz a comparação com o relatório da ANEEL para 2024, em `qualidade.comparacao_relatorio_aneel`).

Solução local enquanto isso: `src/lib/energia/home-sinais.ts` exporta `denominadorDePerdas`, `descreverDenominador` e `evidenciaComDenominadorNomeado`. O primeiro refaz, a partir da gold e do arquivo `perdas_distribuidoras.csv`, as contagens por origem e a soma da energia injetada publicada (e só devolve valor quando as duas fontes concordam linha a linha); o terceiro acrescenta a origem à descrição do denominador na ficha, sem mudar valor, numerador, fórmula, testes nem arquivo, e só quando o denominador da ficha é a soma refeita. Quando o pipeline nomear o denominador, a composição pode sair. A Visão geral e o Território mostram o mesmo 14,7% e podem usar as mesmas funções para nomear o denominador nos cartões e nas fichas (o dono delas decide).

## 7. Verbete DEC sem a frase sobre apurado e expurgos

Origem: avaliação técnica, critério G. O verbete `dec` (`src/lib/energia/conteudo/conceitos-qualidade.ts`) não diz que o DEC divulgado é o apurado e que a regra exclui parcelas (emergência, dia crítico, origem externa e cortes pedidos pelo ONS), cuja soma com o apurado dá um total maior. A inicial já diz isso no elo "Vida das pessoas" do mapa e na ressalva do sinal de Qualidade (com os valores lidos da gold). Pedido: uma frase no verbete, em `limitacoes` ou em `comoEMedido`, sem número.

## 8. Sistemas isolados fora do mapa

Origem: avaliação técnica, critério E ("o mapa não coloca os sistemas isolados na cadeia"). O verbete `sin` registra que a abrangência do SIN ("quais sistemas isolados ficam de fora") não foi conferida em documento do ONS, e por isso a inicial não afirma nada sobre eles. Para entrar no mapa (por exemplo, como nota em "Rede" ou em "O que o mapa não diz"), precisa de verbete conferido. Pedido ao Aprenda: conferir o escopo do SIN e dos sistemas isolados em fonte do ONS.

## Achados de conteúdo e de dado que a inicial não corrige

- O valor exibido da ficha de perdas é "14,7%" (uma casa), e a inicial mostra "14,75%" (duas casas, como o número da gold e a Visão geral). A ficha confere (o valor de cálculo arredonda para os dois), mas o leitor vê duas grafias do mesmo número. Alinhar a casa decimal fica com quem gera a evidência.
- A Visão geral lê a EAR de 28/09 (61,6% no `sintese.json`), e o módulo de Água, a de 29/09 (61,54% no `agua_detalhe.json`): o mesmo SIN, com um dia de diferença entre as duas golds. A inicial usa o dia do módulo.
- A gold de Expansão não publica ficha para a fase de construção (a potência em construção da inicial), então esse sinal fica sem "Comprove este número". Já está em `transicao-e-expansao.md`, item 2.
- No quadro de atualidade, Regulação segue como "2026, ano em curso": a publicação (`publicacao.json`) só conhece o ano desse conjunto, e a inicial não inventa o mês. Qualidade mostra jun/2026 porque o módulo de Qualidade publica `ultimo_mes_completo`.
