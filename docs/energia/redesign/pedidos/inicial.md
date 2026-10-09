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

## 9. Mediana de tarifa ponderada e arquivo vivo da ANEEL

Origem: avaliação técnica, critério F e H. A inicial calcula, em `medianaPonderadaPorUc` (`src/lib/energia/home-sinais.ts`), a mediana da tarifa B1 pesada pelas unidades consumidoras de `qualidade.json` (R$ 0,8437 por kWh contra R$ 0,8212 sem peso; as 81 distribuidoras com tarifa em vigor têm UC publicadas) e a diz no cartão. Pedido ao pipeline: publicar essa mediana em `conta.json` (`tarifas.resumo.mediana_ponderada`) com ficha própria (fórmula, pesos, ano das UC, arquivos), para a inicial só ler. Pedido também: registrar na gold quantas distribuidoras o arquivo vivo da ANEEL traz na data da última verificação, ao lado das da captura, para o cartão dizer o número em vez de só dizer que o valor muda quando o arquivo é completado.

## 10. Ficha da fase de construção do SIGA e série mensal própria

Origem: avaliação técnica, critério H, e produto, critério C. `expansao.json` publica a ficha da potência em operação e a da obra não iniciada, mas não a da fase de construção (9.030,8 MW): o cartão diz isso. Pedido ao pipeline: `evidencias.construcao` com a soma por estágio do SIGA. A série de `historico_mensal` é do RALIE, outra medida, e não pode virar minigráfico desse número: se houver série mensal do estágio no SIGA, a inicial passa a desenhá-la.

## 11. Distribuição entre distribuidoras e quartis, com ficha

Origem: avaliação técnica, critério E. As faixas de referência da inicial usam o resumo da própria gold (tarifa, EAR, PLD) ou o refazem a partir das linhas por distribuidora (`resumo` de `src/lib/energia/distribuicao.ts`: DEC de 98 distribuidoras e perdas das 51 concessionárias do total). Pedido ao pipeline: publicar `distribuicao` (mínimo, quartis, máximo, n) de DEC e de perdas nas golds de Qualidade e Perdas, com ficha, para a inicial deixar de calcular e passar a ler.

## 12. Componentes compartilhados (pedido ao coordenador)

- `TermoDica` com `alvo`: o link interno tem `min-h-[24px]` dentro de uma área de 44 px. Pedido: `min-h-[44px]` no link com ponteiro grosso. A inicial contorna com `[&_a]:min-h-[44px]` no cartão, o que não vale para as outras páginas.
- `.rotulo` (globals.css) é 12 px: sobra de texto pequeno em rótulos de caixa alta em todas as páginas. Pedido: 13 px, como o resto do texto de apoio do domínio.
- Rodapé do site que transborda com texto a 200% (avaliação de produto, critério K): `Footer` compartilhado, fora dos arquivos da inicial.
- Memória da distribuidora: o seletor único da inicial guarda `{ cnpj, sigla }` em `localStorage` na chave `energia:sua-distribuidora`. Conta de luz (`?dist=`), Qualidade (`?dist=`) e Perdas (`?d=`) podem ler a mesma chave quando a URL não traz a escolha, e escrevê-la quando a pessoa escolhe, para a escolha valer entre as páginas.

## 13. Tarifa Social, arquivo da fonte e mês

Origem: produto, critério D. O cartão da inicial mostra o último mês completo do arquivo do SCS (mai/2025, 17 meses antes do processamento); o arquivo vai até jun/2025 com quatro distribuidoras faltando. Já existe no `inclusao.json` um indicador mais recente em outra unidade (faturas de Beneficiários da CDE, mar/2026). Pedido: se a fonte publicar meses posteriores, o pipeline os recolhe; senão, a gold poderia oferecer o indicador de faturas como série própria e com a diferença de unidade dita.

## 14. O que a inicial não mede nem corrige

- Peso do documento servido (745 KB na avaliação, contra o teste de markup abaixo de 400 KB): medir o documento servido exige `next build`, que a inicial não roda.
- CSV com veredito "reprovado" que não bloqueia a publicação, dado de campo (LCP, INP, CLS) e leitor de tela real: pipeline e avaliação, fora desta página.
- Evolução de tarifa, PLD e obras como série na própria inicial: a inicial mostra posição na faixa e remete aos módulos, que têm as séries.

## Equivalências desta rodada (o que mudou de lugar, sem perder visão)

- "Detalhe de cada página" (cartão de cada destino: para que serve, o que se encontra, recorte e conceito) virou o botão ▾ dentro do próprio item de "Todas as páginas, por tema"; o resumo de cada grupo passou para o cabeçalho do grupo.
- O mapa conceitual passou a vir logo depois das seis perguntas e antes do índice; o alto da página ganhou o quinto caminho "Entender como o sistema se liga" (âncora `#mapa-conceitual`).
- Os dois seletores "Sua distribuidora" (Perdas e Qualidade) viraram um só, no alto das perguntas, que também leva a Conta de luz (`?dist=`); a escolha fica guardada no navegador. As contagens (103, 98 mais 4 de parte do ano, 81) passaram para a frase sob o seletor.
- A explicação das unidades (MW, MWh, MWmed) ganhou uma linha à vista sob o seletor; o bloco recolhido "Nomes e réguas que se confundem" segue com a versão completa.
- Os parágrafos de universo, ressalva, denominador e conjuntos dos cartões de DEC e perdas foram encurtados (a ficha "Comprove este número" já traz o universo, a fórmula e o denominador nomeado); a faixa de referência de cada número substituiu a frase de quartis.

## Achados de conteúdo e de dado que a inicial não corrige

- Rodada 2: a taxa de perdas passou a ser escrita como "14,7%" (uma casa, a da ficha e da Visão geral), com o valor sem arredondar lido da própria evidência. O texto de resumo da página Perdas ainda escreve "14,75%" (duas casas): pedido ao executor do módulo, para o mesmo número ter a mesma casa em todas as páginas.
- Rodada 2: o cartão de reservatórios diz o dia e o valor da EAR que a Visão geral mostra ("de outra captura do ONS", 61,6% em 28/09), a partir de `sintese.json`. A diferença de um dia entre as duas golds segue: a captura do módulo de Água é recapturada depois da síntese.
- Rodada 2: o cartão de expansão diz, junto do número, que a ficha da fase de construção não existe na gold (pedido 10 acima). A ficha em si só o pipeline pode criar.
- No quadro de atualidade, Regulação segue como "2026, ano em curso": a publicação (`publicacao.json`) só conhece o ano desse conjunto, e a inicial não inventa o mês. Qualidade mostra jun/2026 porque o módulo de Qualidade publica `ultimo_mes_completo`.
