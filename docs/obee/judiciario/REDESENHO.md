# Judiciário — revisão da apresentação

Pedido de 17/10/2026: o usuário reprovou a exposição anterior como burocrática, sem ilustrações e abaixo da qualidade dos demais painéis. As notas estéticas da implementação anterior não representam aceite do usuário.

## Diagnóstico e referência

Capturas anteriores em `/workspace/judiciario-design-antes`: Crédito, Energia, entrada do Judiciário, Recursos, Tempo e Comparação, com sessão local. Crédito apresenta título curto, cena editorial, acesso principal e números destacados. A entrada anterior do Judiciário abria com pergunta longa, metadados, quatro medidas, aviso e uma jornada formada apenas por botões/texto. Os capítulos começavam pela linguagem das limitações antes de explicar a pergunta.

No comparativo local, a cena principal de Energia não carregou; a captura não é evidência da qualidade dessa imagem em produção. Sua estrutura de gravuras, percursos e explicações foi examinada no código. A cena do Crédito carregou e serviu como referência visual confirmada.

## Mudança implementada

- Abertura curta, ilustração arquitetônica original, três medidas nacionais com universo explícito e comparação a um clique.
- Busca por sigla para as 57 fichas, exemplo real de comparação de três TJs de grande porte e exploração interativa dos três ramos.
- Jornada ilustrada: seis momentos selecionáveis, com acordos, recursos e execução direta descritos como possibilidades. Não há sequência obrigatória, funil quantitativo ou coorte inventada.
- Índice ilustrado dos oito destinos e fonte/cobertura ao fim. A distinção entre baixa e cumprimento permanece visível.
- Aberturas dos capítulos e fichas com pictogramas conceituais. Composição financeira e comparação de universos temporais com gráficos adicionais e tabelas equivalentes preservadas.
- Comparador com destaques dos selecionados e pontos dos pares em escala comum, com mediana identificada. Sem nota própria, inferência causal ou ordenação de qualidade.
- Navegação curta, controles e tabelas reorganizados; fontes, arquivos, filtros na URL, ausências e autenticação preservados.

A ilustração é identificada como conceitual e gerada por IA. Representa um edifício imaginado; não é fotografia, mapa, tribunal real ou dado. Origem, dimensões, limites e hash estão em [ilustracoes.json](ilustracoes.json). O WebP de 226.620 bytes é servido em `/home`, prefixo público já existente, sem abertura de painéis ou arquivos de dados.

## Invariantes e validação

Nenhum snapshot, CSV ou cálculo do pipeline foi alterado. As três medidas da abertura são nacionais, sem apresentar os três ramos como todo o Judiciário. A razão aproximada entre saídas e entradas continua no capítulo de Filas. A composição financeira usa as rubricas e totais publicados; as médias de baixados e pendentes mantêm seus próprios universos.

Primeira rodada: lint, tipos, build, 31 testes direcionados e navegador (56 telas, 144 verificações, zero erros) aprovados. Inspeção mostrou que o cabeçalho existente ainda consumia espaço excessivo no celular. A segunda rodada compacta essa navegação no próprio Judiciário: marca e menu nativo com os oito destinos, acesso à conta sensível à sessão e links de contexto preservados. A abertura foi encurtada para dar lugar à cena já na primeira tela.

Validação final: lint e tipos aprovados pelo build; build de produção com 718 páginas; 49 testes direcionados aprovados; inventário de tradução atualizado. No navegador, **56 telas e 157 verificações, zero erros**, em 320, 390, 768 e 1440 px, com sessão local real e contexto anônimo. Inclui menu com/sem sessão e Escape, imagem carregada, busca por teclado, três ramos, exemplo com três TJs grandes, filtros/URL/CSV, downloads privados, texto ampliado e regressão dos acessos dos demais observatórios. Nenhum arquivo em `public/eficiencia/judiciario` ou `pipeline/judiciario` foi alterado.

Inspeção visual manual: começo, meio e fim da entrada; primeira tela móvel; Recursos e Tempo em desktop/celular; comparação de três tribunais. A cena está inteira na primeira tela de 390 × 844. As tabelas continuam com rolagem local e indicação; não há rolagem horizontal da página. Automação de acessibilidade sem violações nos estados capturados não equivale a conformidade integral: leitor de tela e zoom nativo do navegador não foram verificados.

## Evidências para revisão

- [Antes: entrada](evidencias/redesenho/entrada-antes-1440.png).
- Depois: [primeira tela desktop](evidencias/redesenho/entrada-primeira-tela-1440.png), [primeira tela móvel](evidencias/redesenho/entrada-primeira-tela-390.png), [entrada completa](evidencias/redesenho/entrada-1440.png).
- [Recursos](evidencias/redesenho/recursos-1440.png), [Tempo móvel](evidencias/redesenho/tempo-390.png), [Comparação](evidencias/redesenho/comparacao-tres-tribunais.png).
- [Relatório completo do navegador](evidencias/redesenho/resultado.json), iniciado em 17/10/2026 às 10:15 UTC. Os nomes das verificações e seu resultado estão no arquivo.

## Autoavaliação por página/modelo

Esta é uma avaliação do implementador, não revisão independente nem aceite estético do usuário. Ordem dos critérios: direção de arte, hierarquia, tipografia, densidade, didática visual, comparabilidade, interação/acessibilidade e responsividade. Notas abaixo do objetivo 9 registram limitações concretas; não representam defeitos de dados ou tarefas essenciais inacessíveis.

| Rota/estado | Notas na ordem acima | Evidência e limite remanescente |
|---|---|---|
| Entrada | 9 / 9 / 9 / 9 / 9 / 8 / 8 / 9 | Cena final, busca, ramos, jornada e oito destinos; comparação não controla composição dos processos. |
| Panorama | 8 / 9 / 9 / 9 / 8 / 8 / 8 / 9 | Abertura ilustrada e três medidas de movimento preservadas; séries processuais ainda restritas à edição disponível. |
| Recursos | 9 / 9 / 9 / 9 / 9 / 9 / 8 / 9 | Composição com rubricas reais, série de 17 anos e tabelas/CSV; leitura assistiva manual não verificada. |
| Tempo | 9 / 9 / 9 / 9 / 9 / 9 / 8 / 9 | Barras em escala comum, universos distintos explícitos; leitura assistiva manual não verificada. |
| Filas | 8 / 9 / 9 / 9 / 8 / 8 / 8 / 9 | Abertura ilustrada; indicador de saídas/entradas continua aproximação arredondada documentada. |
| Entrega | 8 / 9 / 9 / 9 / 8 / 8 / 8 / 9 | Conciliação histórica preservada e limite baixa/cumprimento visível; cumprimento material não medido. |
| Acesso | 8 / 9 / 9 / 9 / 8 / 8 / 8 / 9 | Abertura ilustrada e conexões existentes preservadas; cobertura de Defensorias mantém seu universo próprio. |
| Comparar — três selecionados | 9 / 9 / 9 / 9 / 9 / 8 / 8 / 9 | Destaques, pontos/mediana, tabela/CSV/filtros; composição de assuntos não controlada. |
| Métodos — anônimo/logado | 8 / 9 / 9 / 9 / 8 / 9 / 8 / 9 | Menu/conta conforme sessão, fontes e limites; predominância textual é própria da reprodução. |
| Ficha TJSP | 8 / 9 / 9 / 9 / 8 / 8 / 8 / 9 | Quatro larguras, mesma ficha reutilizável; não mede qualidade jurídica. |
| Ficha TJDFT | 8 / 9 / 9 / 9 / 8 / 8 / 8 / 9 | Quatro larguras, DF e Territórios preservados; não mede qualidade jurídica. |
| Ficha TRF3 | 8 / 9 / 9 / 9 / 8 / 8 / 8 / 9 | Quatro larguras e busca por teclado; sem UF da sede, porte ou despesa individual inventados. |
| Ficha TRT3 | 8 / 9 / 9 / 9 / 8 / 8 / 8 / 9 | Quatro larguras e ramo próprio; não mede qualidade jurídica. |

## Integração e publicação

A evidência acima é do build local, com conta de teste isolada. CI, revisão, merge e deploy serão registrados no PR deste redesenho. A conferência de produção distinguirá deploy/rotas públicas e barreiras de login de inspeção autenticada, que requer conta real.

## Ajuste após CI

A primeira execução integrada (`39024656779`, head `570807373`) aprovou build e fluxos do navegador; a suíte geral terminou com 6.399 testes aprovados, um pulado e uma falha: a regra compartilhada do OBEE proíbe cores hexadecimais nos componentes. As cores secundárias de composição/tempo foram trocadas pelos tokens existentes do próprio OBEE/Atlas, mantendo rubricas, dados, geometria e interações. Nenhum teste foi removido ou flexibilizado. A regra compartilhada e os quatro arquivos de regressão passaram localmente após o ajuste: 272 testes em cinco arquivos. As capturas versionadas acima documentam a composição anterior a esse alinhamento de tons; a nova execução do CI gera a evidência do build corrigido. O resultado definitivo está no PR #255: https://github.com/genarolins1975/scrutiniums/pull/255.
