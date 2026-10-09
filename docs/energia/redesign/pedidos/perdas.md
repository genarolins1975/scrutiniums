# Pedidos de mudança compartilhada: família Perdas de energia

Rotas `/setor-eletrico/perdas`, `/perdas/composicao`, `/perdas/regulatorio` e `/perdas/custo-e-contexto`. Cada pedido diz o que mudar, por que e em que arquivo. Nenhum bloqueia a família: as páginas seguem com a melhor solução local, descrita em cada item.

## 0. Arquivos sem uso para apagar no fim (regra do coordenador: não apagar componente com o servidor no ar)

- `src/components/energia/PerdasLinkPainel.tsx`: nenhum arquivo o importa mais. O rodapé de cada painel passou a usar o `SeguirPainel` compartilhado, por meio de `PerdasSeguir` (em `PerdasPainel.tsx`).
- `src/components/energia/PerdasLinkConsulta.tsx`: nenhum arquivo o importa mais. A consulta escolhida (período, medida e distribuidora) agora aparece como "Consulta aplicada", com o botão "Restaurar a consulta padrão", dentro de `PerdasExplorador.tsx`.
- Nenhum teste depende dos dois arquivos. Ao apagar, ajustar `docs/observatorios/energia/modulos/perdas.md`: a linha 18 (lista de componentes) cita os dois e não cita os dois componentes novos (`PerdasDistribuicao.tsx` e `PerdasLevaEscolha.tsx`), e as seções 1 e 1.1 descrevem a estrutura anterior das páginas (cartões de destino, painel com título fixo da especificação, contagem de 40 testes).

## 1. `NotasDoPainel` repete o nome acessível das três notas quando a página tem dois painéis

`src/components/evidencia/PainelEvidencia.tsx`, linha 137: os três `aside` levam `aria-label` fixos ("O que mudou", "Como interpretar", "O que não é possível concluir"). Na abertura de Perdas (painel da comparação e painel da evolução) e em Custo e contexto (painel do custo e painel do contexto) os seis rótulos aparecem duas vezes na mesma página, e o axe-core aponta `landmark-unique` (gravidade moderada). Proposta: aceitar uma propriedade opcional `nome` (por exemplo "comparação entre distribuidoras") que entre no fim do `aria-label` ("O que mudou: comparação entre distribuidoras"). Local: `NotasDoPainelNomeadas`, em `src/components/energia/PerdasPainel.tsx`, com a mesma marcação e os mesmos atributos `data-*` da compartilhada; com ela, o axe fica sem violações nas quatro páginas, nos três níveis. A composição e o percentual regulatório têm um painel só e seguem com a compartilhada. Quando a compartilhada aceitar `nome`, trocar a local por ela e apagar `NotasDoPainelNomeadas`.

## 2. `GraficoPontos` só sabe dizer "acima" e "abaixo da referência"

`src/components/energia/GraficoPontos.tsx`, linha 102 (`TEXTO_SENTIDO`): o rótulo da referência é configurável (`rotuloReferencia`, e a página passa "Trecho anterior"), mas o texto de sentido da dica, da coluna de diferença e do leitor de tela é fixo: "acima da referência", "abaixo da referência" e "igual à referência". Na página do percentual regulatório, o losango vazado é o trecho anterior da própria distribuidora, e não uma meta regulatória: ao lado de "Trecho anterior 4,500%", a dica diz "acima da referência", que pode ser lido como "acima da meta". Proposta: aceitar os três textos de sentido por propriedade (por exemplo "maior que no trecho anterior", "menor que no trecho anterior", "igual ao trecho anterior"), ou montá-los com `rotuloReferencia`. Local: não foi possível trocar o texto da dica; o "Como interpretar" da página diz, ao lado do gráfico, que "referência" quer dizer o trecho anterior da própria distribuidora, e não uma meta regulatória, e o "O que não é possível concluir" nega a leitura como meta.

## 3. `NavegacaoLocal` e `SeguirPainel` (a próxima pergunta) não levam um parâmetro de URL do módulo

A escolha da distribuidora (`?d=`, CNPJ de 14 dígitos) precisa seguir de uma página de Perdas para outra (mapa, composição, percentual regulatório, custo). Os dois componentes compartilhados montam o destino (a faixa de páginas, os capítulos e o link "Próxima pergunta") sem conhecer parâmetros próprios de cada família. Proposta: uma propriedade `preservar` (lista de nomes de parâmetro, por exemplo `["d"]`) em `NavegacaoLocal` e em `SeguirPainel`, que copie esses parâmetros da página atual para o destino. Local: `src/components/energia/PerdasLevaEscolha.tsx`, um ouvinte de clique na janela (fase de captura) que, havendo `?d=` válido, acrescenta o parâmetro ao link para outra página `/setor-eletrico/perdas*` e mantém o nível `?modo=` pelo mesmo `urlComNivel` do `ModoProfundidade`. Link com modificador de tecla, de outra origem, de download ou para a mesma página segue sem alteração; sem JavaScript, o link vai sem a escolha. Quando houver `preservar`, apagar o componente.

## 4. Mesmo bloco "Período, universo e unidade" em quase todas as famílias, cada uma com seu componente

O atributo `data-recorte-painel` aparece em componentes locais de mais de vinte arquivos de `src/components/energia` (Água, Carga, Rede, PLD, Geração, Regulação, Qualidade, Empresas, Expansão, Previsões, Inclusão, Transição e Perdas) e em `src/app/setor-eletrico/conta-de-luz/partes.tsx`. Proposta: um `RecortePainel` compartilhado com `periodo`, `universo` e `unidade`, no mesmo `dl`. Local: `Recorte`, em `src/components/energia/PerdasPainel.tsx`.

## 5. Perguntas e promessas antigas de Perdas em arquivos de outras áreas

A abertura de Perdas passou a se chamar "Onde a energia se perde?" (a pergunta da tela 13 da galeria, constante `PERGUNTA_ABERTURA` em `PerdasPainel.tsx`), e a página do percentual regulatório não compara a perda realizada com a referência regulatória (a comparação está indisponível nesta publicação, com o bloqueio e a evidência na própria página). Os textos abaixo ainda dizem o contrário ou repetem a pergunta antiga:

- `src/lib/energia/navegacao.ts`, linha 144: pergunta "Onde se perde energia, quanto e com que efeito econômico?" (trocar por "Onde a energia se perde?"); linha 145: resumo "…o realizado diante da referência regulatória e o custo que chega à tarifa" (sugestão: "…o percentual técnico regulatório e o custo que chega à tarifa");
- `src/lib/energia/mapa.ts`, linha 123: a mesma pergunta antiga; linha 517: rótulo "Realizado diante da referência regulatória" (sugestão: "Percentual técnico regulatório por distribuidora"); linha 634: "…a evolução e a comparação com a referência regulatória" (sugestão: "…a evolução e o percentual técnico regulatório"); linha 728: "quanto a sua distribuidora perde e quanto disso a regulação reconhece" sugere a comparação completa, que a página não faz, e pede revisão;
- `src/app/setor-eletrico/empresas/distribuidoras/page.tsx`, linha 217: texto de reserva do link "próximo" com a pergunta antiga;
- `src/lib/telemetry.ts`, linha 216: rótulo "Perdas: realizado e regulatório" (sugestão: "Perdas: percentual técnico regulatório");
- `docs/observatorios/energia/ESPECIFICACAO.md`, linha 242: a tabela de perguntas guarda a pergunta antiga.

As três páginas filhas também têm pergunta nova: "Como se separam as perdas técnicas e não técnicas?" (composição), "Como mudou o percentual regulatório de perdas técnicas?" (regulatório) e "Qual é a dimensão econômica e territorial das perdas?" (custo e contexto), constantes `PERGUNTA_*` de `PerdasPainel.tsx`.

## 6. Texto de verbete que assimila perda não técnica a causa única

`src/lib/energia/conteudo/conceitos-perdas.ts`, linha 81: a frase em uma linha do verbete "Perdas não técnicas" diz que a perda "decorre principalmente de furto, fraude e erros de medição e de faturamento". A direção da família é que perda não técnica nunca seja equiparada a furto, e as páginas dizem "inclui furto, fraude e erros de medição, de leitura e de faturamento" (a fonte não separa as categorias). Sugestão: "inclui", no lugar de "decorre principalmente de". É texto do glossário (CONFERIDO), por isso não foi alterado.

## 7. Equivalências para a matriz de preservação

- `/perdas/custo-e-contexto`: o painel "Qual é a dimensão econômica das perdas na tarifa?" passou a se chamar "Quanto da tarifa residencial remunera as perdas?" (o mesmo `id="painel-custo"`, o mesmo nível Entender). O rastreador não o casa pelo título (semelhança abaixo de 0,6), então a linha precisa de equivalência manual.
- `/perdas`: o mapa (diagrama da seção `perdas-territorio`, sem `nivel`) aparece no rastreador só em Analisar e Auditar porque a malha municipal chega depois da primeira leitura da página; aberta em Entender, a figura fica visível 0,6 s depois do carregamento (medido). A malha (1,3 MB) e a relação município × distribuidora (565 KB) são lidas ao montar; carregá-las sob demanda (ao chegar perto da seção) faria o rastreador perder o mapa em todos os níveis, a menos que ele role a página.
- `/perdas`, painel "Onde estão as perdas e como evoluíram?": virou "Como variam as perdas entre as distribuidoras?" (`id="painel-mapa"`, Entender). O comparador de até quatro distribuidoras foi promovido de Analisar para Entender (`perdas-comparar`); as séries nacionais de técnica e não técnica e suas tabelas, em `/perdas/composicao`, também (`separacao-nacional`).
