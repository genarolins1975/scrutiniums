# Resposta na entrada — revisão visual independente, rodada 1

> Registro histórico da primeira candidata. [Dados e capturas daquela rodada](rodada1/) foram preservados separadamente; os caminhos absolutos abaixo são os usados na execução original. Para o código final, consulte o [relatório de entrega](RELATORIO.md).

27/10/2026. Candidata renderizada: build `-nEfaEVClMB5e_WVWugBV`, registrado em `/workspace/resposta-evidencias/jornadas/jornadas.json` às 11:13:42 UTC. Evidência visual em `/workspace/resposta-evidencias/jornadas/`. Comparação com a revisão `8a7cd80b27e5`, examinada em `/workspace/resposta-layout-antes.md`.

**A direção funciona: a escolha passou para a abertura e a resposta local precede o panorama. A candidata ainda precisa de uma rodada antes de ser considerada concluída.** Em 390 × 900, o primeiro valor de inflação está cortado pela borda inferior e o custo do tanque não aparece. A Síntese das capitais ganhou a resposta correta, mas adicionou uma sequência extensa de resultados antes de repetir referências e réguas. Há também uma ambiguidade de unidade no delta de Combustíveis e limites na evidência de texto ampliado.

O parecer julga as imagens dessa candidata, não a intenção de implementação nem o código que começou a mudar durante a revisão. Não alterei o repositório nem executei testes. Produzi apenas este arquivo. As conclusões sobre medidas automatizadas abaixo citam resultados fornecidos; não são uma nova execução independente.

## O que foi examinado

- As 20 aberturas: cinco rotas em 320, 390, 768 e 1440 px, todas com seleção válida. Recife no IPCA, Educação e Conectividade; Pernambuco em Combustíveis; São Paulo comparado com Curitiba na Síntese.
- As cinco páginas móveis completas, incluindo meio e rodapé. Para ler os detalhes, examinei recortes em memória das imagens de 390 px nas respostas e na transição para o panorama; nenhum arquivo de imagem foi alterado.
- Amostras de `texto200` de IPCA, Educação e Síntese e `reflow200` de Combustíveis; script `/workspace/resposta-jornadas.mjs` e resultados estruturados.
- O código atual foi consultado só para confirmar estrutura, origem das medidas e contrato do orçamento. Ele já continha alterações posteriores às capturas; não atribuo a essas imagens o resultado das alterações mais recentes.
- Não há nesta pasta evidência renderizada de busca aberta, município ausente/parcial, parâmetro inválido, volume inválido ou estado inicial sem seleção. A revisão de teclado se limita ao relato do script: foco, Tab e Shift+Tab; não comprova a tarefa completa da busca.

## Evolução demonstrada

| Rota | Antes | Depois, nesta candidata | Efeito para o leitor |
|---|---|---|---|
| Custo de vida | Controle a 2.522 px; faixa nacional dominava a primeira tela. | Controle a 550 px; área selecionada vem antes do panorama, com janela e comparação nacional. | A escolha é imediata. Falta terminar de antecipar a leitura do primeiro valor em 390. |
| Conectividade | Controle a 2.724 px, depois de números e cartões. | Controle a 527 px; Recife e 18,3 acessos por 100 habitantes aparecem na primeira tela. | O município escolhido passa a comandar a abertura, com comparação da mesma medida. |
| Combustíveis | Controle a 2.607 px; o preço por litro respondia visualmente à pergunta sobre tanque. | Controle a 515 px; litros e produto alimentam custo do tanque em destaque. | A tarefa corresponde ao título. O resultado continua abaixo da primeira tela de 390. |
| Educação | Controle a 2.417 px; extrato e troca de município estavam separados. | Controle a 562 px; extrato de Recife e os dois Ideb aparecem logo depois. | Resolve primeira consulta e troca na mesma região, preservando a ficha completa. |
| Síntese das capitais | Controle a 2.385 px; título local seguido de medianas de 26 capitais. | Controle a 548 px; sete resultados de São Paulo, comparados com Curitiba, vêm antes das medianas. | Elimina a associação imediata entre o nome local e números do conjunto. |

Posições arredondadas, a 390 px. Antes: `conselho/evidencias/jornadas.json`; depois: `resposta-evidencias/jornadas/jornadas.json`. São posições, não tempos medidos de uso. Os estados antes/depois diferem pela seleção; a comparação documenta hierarquia e distância, não equivalência de todo o conteúdo exibido.

## Achados que pedem ajuste ou comprovação

| Prioridade | Antes / evidência da candidata | Depois necessário | Motivo |
|---|---|---|---|
| P1 — resposta visível | Em `custo_de_vida-390-primeira-tela.jpg`, a pergunta local e a longa identificação da resposta precedem um valor cortado no fim da tela. Em `combustiveis-390-primeira-tela.jpg`, aparece o título da resposta, mas nenhum custo. A 320, a distância aumenta. | Encerrar a abertura com uma resposta legível, por concisão e proximidade: campo, valor principal, unidade, período e limite. Não diminuir letra nem apagar a restrição geográfica do IPCA. | Mostrar o cabeçalho de um bloco não é entregar o número que o leitor procurou. |
| P1 — unidade do delta | O cartão de gasolina em `combustiveis-390.jpg` destaca **R$ 273,60 para 40 litros** e abaixo diz **R$ 0,30 (4,6%) acima da média do Brasil (R$ 6,54)**. O delta se refere ao litro. | Nomear explicitamente a comparação por litro, ou calcular e rotular a diferença para o tanque no mesmo volume. Manter ambos somente com unidades inequívocas. | Ao mudar o número dominante para o tanque, a frase de comparação precisa indicar a qual medida pertence. O número nacional entre parênteses ajuda, mas obriga inferência. |
| P1 — orçamento e repetição | `jornadas.json`: Combustíveis mede **11.313 px** a 390. Síntese mede **11.968 px** a 390 e **6.914 px** a 1440. Os tetos existentes são 11.000 e 6.500, respectivamente. | Reorganizar/recolher contexto secundário e repetições, mantendo resposta e ressalvas materiais abertas. Repetir a medida na candidata final. | `ux-orcamentos-comprimento.test.ts` mede o mesmo `documentElement.scrollHeight`, incluindo rodapé. A nova resposta não deve vir acompanhada de uma entrada cada vez mais extensa. |
| P1 — natureza da medida | Nos três resumos da Conectividade, a captura usa “informado à fonte”, inclusive na proporção de acessos por fibra. | Distinguir densidade publicada, percentual calculado e cobertura declarada conforme o contrato real. | A frase genérica não explica a origem da transformação. O código consultado já traz textos diferentes, mas a correção ainda precisa aparecer na captura final. |
| P1 — texto ampliado sem prova suficiente | As capturas `texto200` mostram alteração real de letras, mas vários retângulos e alturas registrados são iguais aos do estado normal. Algumas capturas começam no meio da página após foco; Educação a 320 mostra um link enorme, enquanto a maior parte do extrato conserva tamanho menor. | Aguardar o layout após mudar a escala, registrar tamanhos computados e `scrollY`, medir coordenadas do documento e capturar topo e região da consulta. Verificar a tarefa, não a permanência no primeiro viewport em texto ampliado. | Os números atuais não permitem concluir reflow íntegro nem legibilidade equivalente da consulta a 200%. |
| P2 — clareza do título da Conectividade | O H1 continua “Quem tem internet de verdade no Brasil?”, enquanto o resultado é contratual/cobertura de um município e não mede qualidade. | Considerar uma pergunta mais próxima da consulta municipal e do que a fonte observa. | A frase de apoio e as ressalvas já reduzem a ambiguidade; o título ainda promete um conceito que não tem medida única. |

O primeiro ajuste não exige uma meta rígida de encaixar todas as ressalvas e toda a resposta em 900 px. Exige que o leitor veja o valor que a escolha produziu, com seu significado, antes de começar outro assunto. Na versão final, medir o primeiro **valor** e sua unidade, além do topo de `[data-resposta-especifica]`.

## Página inteira, agrupamento e densidade

**Custo de vida.** A região local é contínua: seleção → limite das 16 áreas → área e Brasil → diferença → fonte → acesso aos nove grupos. O Brasil deixa de ser a falsa resposta à pergunta local. O panorama seguinte está identificado como “O Brasil e as áreas pesquisadas”. Ainda há repetição visual de medidas nacionais no panorama e nos cartões posteriores, mas não bloqueia a consulta. A leitura da fonte e da diferença em pontos percentuais está preservada. O seletor respeita a largura a 320; a opção longa é cortada dentro do controle nativo, mas o nome completo reaparece na resposta. Preservar essa identificação completa na revisão mais compacta.

**Conectividade.** É a composição mais direta da candidata: busca, título local, três medidas, comparação Brasil, ressalva e link para operadoras/4G/linhas/séries. A redução para três medidas é aceitável porque o restante tem acesso explícito e o script registra abertura do detalhe com tabela visível. Na página completa, os capítulos e o modelo continuam presentes. A ressalva “acessos são contratos, não pessoas” permanece fora de recolhidos. A medida 5G precisa continuar identificada como cobertura declarada e não serviço efetivo dentro da casa.

**Combustíveis.** Os quatro produtos se distinguem por rótulo e preservam preço por litro, mês e amostra. O custo calculado agora é reconhecível; a mudança melhora a pergunta central. No celular, UF e volume empilhados, nota de fórmula, título extenso e fonte antes do primeiro produto consomem espaço demais. Depois do resumo local, as médias nacionais repetem o mesmo padrão de quatro blocos. A profundidade sobre a pesquisa, série, estados e razão etanol/gasolina está preservada; o orçamento deve ser recuperado nessa organização, não retirando os produtos ou as amostras.

**Educação.** Busca e extrato estão juntos. A 390, os dois Ideb são visíveis e os rótulos distinguem etapas e rede. A 320, duas colunas ainda são legíveis, porém os textos das referências ficam apertados e longos; acompanhar isso com município/UF longos e ausência de Ideb, que tende a ocupar mais espaço. A comparação estadual mantém “rede pública de Pernambuco”; a nacional mantém “redes municipais do Brasil”. A fonte diz que os universos diferem. O acesso à ficha completa permanece destacado; a entrada não parece conter toda a análise por engano.

**Síntese das capitais.** A principal correção semântica está demonstrada: São Paulo no H1, São Paulo nos valores, Curitiba como referência, e medianas com identificação posterior. As sete medidas conservam fonte, período, natureza, notas de universo e precisão; homicídios não perdeu a menção à parcela estimada. Contudo, o resumo de sete medidas ocupa aproximadamente **1.550 px** a 390 antes de população/área/densidade, medianas, cartões, catálogo e régua. Há repetição de sete resultados em um extrato textual e no retrato gráfico. Manter uma resposta substantiva na entrada é obrigatório, mas a segunda representação e o contexto territorial podem ser aprofundamentos de acesso imediato. Não recolher as ressalvas materiais separadamente dos respectivos números.

As páginas completas mantêm caminho até método e rodapé. Isso é evidência de presença visual, não de funcionamento de cada link ou exportação. A candidata não introduz uma nova linguagem visual: papel, marfim, filetes, títulos e margens continuam coerentes com a plataforma.

## Adaptação e acessibilidade: o que a evidência permite afirmar

- **320/390:** controles permanecem dentro do documento nas 20 capturas; IPCA não apresenta o transbordamento previsto na revisão inicial. A Síntese passa a empilhar capital/comparador a 320. Não vi sobreposição nos estados capturados.
- **768:** a consulta continua inteira na largura disponível. O cabeçalho comum chega a cerca de 330 px antes do conteúdo e consome um terço da altura; é uma limitação anterior do cromo, não uma nova regressão demonstrada deste trabalho. Evitar justificar uma redução excessiva da tipografia do conteúdo por esse espaço.
- **1440:** as cinco rotas mostram escolha e valores locais na primeira tela. Comparações ganham colunas, com fontes legíveis. A concentração de texto no começo não deixou de usar a largura para o resultado.
- **Teclado:** o arquivo fornecido registra contorno de foco sólido e nenhum erro JavaScript nos estados visitados. O script não completa busca por município com setas/Enter nem verifica a transferência de foco para a resposta. Esses percursos seguem pendentes de prova.
- **Texto ampliado:** CSS de fonte ampliada e viewport reduzido são aproximações distintas. Reduzir 1440 para 720 × 450 não prova sozinho zoom real do navegador; a captura resultante mostra apenas a abertura. É necessário percorrer a região da resposta ampliada, manter controles operáveis, verificar cortes e a ordem de leitura.
- **Ausências e erros:** não foram renderizados nesta pasta. Manter o aceite anterior: ausência não vira zero ou média; parâmetro inválido mostra motivo junto da seleção; volume inválido não deixa custo aparentemente válido; dados parciais conservam o que é utilizável.
- **Sem sessão:** não há novas capturas dos aperitivos nesta rodada. A posição da resposta autenticada melhorou, mas isso não certifica a volta do login nem o comportamento aberto.

## Rubrica da candidata

Notas sobre os estados efetivamente capturados. “Responsividade” considera larguras normais; texto ampliado e interação completa seguem sem homologação. Nenhuma média compensa os ajustes pendentes.

| Rota | Arte | Hierarquia | Tipografia/acabamento | Densidade/profundidade | Didática | Comparabilidade | Interação/a11y | Responsividade normal |
|---|---:|---:|---:|---:|---:|---:|---|---:|
| Custo de vida | 8 | 8 | 8 | 8 | 8 | 8 | Parcial; busca/zoom não homologados | 7 |
| Conectividade | 8 | 9 | 8 | 8 | 8 | 8 | Parcial; busca/zoom não homologados | 8 |
| Combustíveis | 8 | 8 | 8 | 7 | 8 | 7 | Parcial; volume/zoom não homologados | 7 |
| Educação | 8 | 9 | 8 | 8 | 8 | 8 | Parcial; busca/zoom não homologados | 8 |
| Síntese das capitais | 8 | 8 | 8 | 7 | 8 | 8 | Parcial; zoom não homologado | 8 |

## Aceite da próxima captura

1. Em 390 × 900, ver escolha, resultado local principal legível e sua unidade nas cinco rotas; nenhum panorama se interpõe. Preservar campo e resposta próximos mesmo com seleção válida, ausência ou erro.
2. Combustíveis: unidade explícita na comparação ao Brasil depois de promover o custo do tanque.
3. Conectividade: natureza correta junto das três medidas. Manter acesso direto ao detalhe e limites visíveis.
4. Cumprir os orçamentos de comprimento na nova organização, sem apagar o conteúdo. Comparar o estado fechado da entrada; a análise aberta pode crescer para responder à ação do leitor.
5. Capturar o trecho da consulta em texto ampliado, com layout estabilizado e evidência de operação; conferir nomes longos, ausência de Ideb/cobertura e dropdown.
6. Revalidar as mesmas cinco páginas completas e ao menos uma entrada não participante do novo bloco para excluir efeito colateral do molde compartilhado.

O avanço é concreto: o leitor já encontra a escolha sem atravessar páginas de panorama. A próxima rodada precisa consolidar a resposta visível, a precisão das unidades e a densidade da página inteira.
