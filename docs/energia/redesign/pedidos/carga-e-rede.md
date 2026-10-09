# Pedidos da família Carga e Rede (páginas /setor-eletrico/carga, /perfil-horario, /clima-e-calendario, /setor-eletrico/rede, /balanco-e-exterior, /restricoes e /programado)

Registro dos pedidos ao coordenador: arquivos sem uso (para apagar no fim, com o servidor parado), mudanças em componentes compartilhados, achados de dado e de pipeline, equivalências para a matriz de preservação e o que foi aplicado a partir da avaliação independente de produto U05. Nenhum pedido bloqueia a família: cada página segue com a melhor solução local, descrita no item.

## 0. Arquivos sem uso, para o coordenador apagar

Nenhum arquivo foi apagado por este executor, conforme a regra do servidor de desenvolvimento.

- `src/components/energia/CargaLinkPainel.tsx`: nenhum arquivo o importa mais; o rodapé de cada painel usa o `SeguirPainel` (por `CargaPagina.tsx`). `docs/observatorios/energia/modulos/carga.md` ainda o cita na lista de componentes do módulo.
- `src/components/energia/RedeLinkPainel.tsx`: mesmo caso, por `RedePagina.tsx`. `docs/observatorios/energia/modulos/rede.md` o cita.
- `src/components/energia/RedeMapaFluxos.tsx`: substituído por `RedeEsquemaFluxos.tsx` (é um esquema sem escala geográfica, e a palavra "mapa" saiu do texto da Rede). O mesmo `rede.md` o cita. O teste "nenhum número da gold escrito à mão" já lista o arquivo novo.

## 1. Componentes compartilhados (nenhum foi alterado por este executor)

1.1 `GraficoBarras`, rótulos de categoria. O eixo trunca o nome da categoria com espaço sobrando: P030 ("Fluxo da Interligação Nordest…"), P031 ("Nordeste → Sudeste/Centro-Oes…"), P025 no gráfico anual ("2026 (271 d…") e o gráfico de sensibilidade da P027. Localmente: P029 passou a usar nomes curtos das contas ("Balanço interno", "Perímetro", "Soma dos subsistemas", com a conta escrita sob o gráfico) e P030 marca com asterisco a sigla sem definição pública. Pedido: coluna de rótulos proporcional à largura disponível, ou quebra de linha.

1.2 `GraficoBarras`, avisos e linha de referência. Em P031 a 390 px, a nota "O gráfico mostra só parte das 6 categorias" aparece com as 6 desenhadas, o botão "Mostrar todas as 6" só troca o texto, e a linha do limiar passa por cima dos rótulos. Pedido: corrigir a condição da nota e desenhar a linha atrás dos rótulos.

1.3 `GraficoBarras`, série nula por construção. Tentei separar o ano parcial dos cortes de carga numa segunda série (outra cor, legenda "ano parcial"): no modo empilhado o componente desenha a hachura de "sem dado" sobre toda barra de ano completo, o que lê como ausência de dado em todos os anos. Voltei a uma série só e o título do gráfico diz qual barra é parcial; o eixo, por outro lado, omite o rótulo da barra parcial (afinamento dos rótulos). Pedido: opção para série ausente por construção (sem hachura) ou cor por ponto.

1.4 `GraficoLinhas`, rótulo de marco. Em 390 px o texto do marco, ancorado à direita do traço, sai da área do gráfico (P029, resíduo mensal: a anotação ficava 199 px fora da borda). Localmente o rótulo passou a ser curto ("29/04/2023: MMGD") e a explicação inteira está no parágrafo sob o gráfico. Pedido: quebra de linha ou ancoragem pela borda da área.

1.5 `MapaCalor` (P026, hora do pico por ano). Em 390 px a tabela tem 840 px num contêiner de 316 px, com rolagem interna sem aviso, e a primeira vista mostra as horas 0 a 6, sem pico; as horas 18 e 19 exigem rolar. Pedido: indicador de rolagem (como o `data-mais-direita` da `TabelaInterativa`) e coluna inicial configurável.

1.6 Texto pequeno. Controles, selos e legendas usam 11,5 px, e com a fonte raiz a 200% em 390 px o botão Auditar sai da tela (a correção S9 trata a barra de profundidade; falta conferir selos e chips). Sem ação local.

1.7 `navegacao.ts` e `mapa.ts`. A pergunta do módulo Rede ("Como a energia circula entre regiões e que restrições são documentadas?", 11 palavras) e a de Carga ("Quanto o sistema consome?") divergem dos títulos das páginas ("Como a energia circula entre regiões?", "Quanto o sistema está consumindo?"). Há teste que iguala a de Rede a `PERGUNTA_MODULO_REDE`; a decisão é do coordenador.

1.8 `conceitos-rede.ts` (linha 85, `vejaNoPortal`) e documentos de especificação. A pergunta do P029 mudou de "De onde vem a diferença de energia?" para "As contas do balanço de energia fecham?" (a avaliação U05 apontou que a antiga sugere causa, e a página só confere contas e mostra onde sobra resíduo). O rótulo do verbete aponta para a rota certa com o texto antigo; atualizar também `MATRIZ_PAINEIS.md`, `ESPECIFICACAO.md` e `modulos/rede.md`. A pergunta vive só em `PAINEIS_REDE` (`rede.ts`).

1.9 Arquivos para baixar (`tabela.ts` e downloads da gold). Os CSV estáticos usam códigos internos (`7d`, `equivalente`, `mesmo_regime`) e não trazem fonte, unidade nem data; os CSV das tabelas usam ponto decimal com ponto e vírgula. Pedido: linha de metadados ou arquivo companheiro, e decimal padronizado.

## 2. Dado e pipeline (a página trata o caso, com a limitação dita; a solução é no dado)

2.1 Fichas com uma casa. `p025_7d_equivalente` mostra "+11,4%" e `a07_reproducao` "+10,5%" (`valor_exibido`), enquanto a página publica duas casas (11,45% e 10,54%, valores 11,4498 e 10,5396 antes do arredondamento). Cada cartão diz agora "Na ficha de prova: +11,4%, com uma casa". Pedido: publicar `valor_exibido` com as mesmas casas da página.

2.2 Dia da ficha do pico (P026). `p026_pico_sin` prova o dia 28/09/2026 (98.741 MWmed às 19h), mas a série vai até 29/09/2026 (pico de 100.610 MWmed às 11h na curva). O cartão diz os dois. Pedido: gerar a ficha para o último dia publicado, ou dizer na própria ficha por que o dia é outro.

2.3 Cortes de carga (P030). A gold não traz consumidores atingidos, duração nem UF por perturbação, e a página não situa os 30.734,6 MWh frente a DEC e FEC. A avaliação pede isso (restricoes_cortes_sem_consumidor). Pedido: publicar consumidores, duração e UF por perturbação, e a soma por região.

2.4 Resíduo do balanço (P029). As 2.472 horas com resíduo do balanço interno do SIN estão todas entre 01/01 e 14/05/2026, em todas as regiões, e de 2021 a 2025 o balanço fecha em todas as horas conferidas. A página diz o ano no veredito e não atribui causa. Vale conferir se há mudança de arquivo ou de medida do ONS em 2026 (não atribuído aqui).

2.5 ATLS, siglas sem definição pública conferida: FBTA, FJUSC e FNS+NESE (marcadas com asterisco no gráfico). Nada a corrigir na página; se o ONS publicar a definição, entra pela gold.

2.6 Texto da ficha. O campo `indicador` de `a07_reproducao` ainda diz "(reprodução do diagnóstico)", expressão interna que a página trocou por "a taxa que o observatório publicou antes" no rótulo do cartão. Pedido: revisar o texto da ficha no pipeline.

2.7 Erro funcional corrigido (não é de dado): a escala Hora do P028 nunca saía de "Carregando a janela horária…" (o efeito dependia do próprio estado de carregamento e descartava o resultado do download). Já era assim no commit de linha de base. Corrigido em `RedeCirculacao.tsx`, com teste de código que protege a correção e "Tentar de novo" funcionando.

## 3. Equivalências para o comparador de visões (`equivalencias.json`)

Os títulos dos painéis mudaram (o título da página é a pergunta; o do painel é o da primeira figura). Além deles, o título da figura da P027 deixou de dizer "janela do achado" e o filtro/coluna "Estado no arquivo atual da fonte" (P025) passou a "Estado no arquivo da última captura da fonte"; nos dois a semelhança de título passa de 0,6.

```json
{
  "/setor-eletrico/carga": [
    {"antes": "painel|quanto o sistema está consumindo?", "depois": "painel|cada janela frente à janela de comparação", "justificativa": "O título da página (h1) é a pergunta do painel; o painel ganhou título próprio da primeira figura."}
  ],
  "/setor-eletrico/carga/perfil-horario": [
    {"antes": "painel|qual parcela da carga é estimada e quando ocorre o pico?", "depois": "painel|um dia típico: carga global, mmgd e carga líquida", "justificativa": "Idem."}
  ],
  "/setor-eletrico/carga/clima-e-calendario": [
    {"antes": "painel|quanto da variação da carga é compatível com clima e calendário?", "depois": "painel|a janela de 22/09/2026 a 28/09/2026 contra um ano antes, decomposta", "justificativa": "Idem; as datas vêm da gold."}
  ],
  "/setor-eletrico/rede": [
    {"antes": "painel|como a energia circula entre regiões?", "depois": "painel|o saldo de cada fronteira, por dia e por hora", "justificativa": "Idem."}
  ],
  "/setor-eletrico/rede/balanco-e-exterior": [
    {"antes": "painel|de onde vem a diferença de energia?", "depois": "painel|as contas do balanço, conferidas hora a hora", "justificativa": "Idem; a pergunta da página passou a 'As contas do balanço de energia fecham?'."}
  ],
  "/setor-eletrico/rede/restricoes": [
    {"antes": "painel|quando há evidência publicada de limitação da rede?", "depois": "painel|horas acima do limite e cortes de carga publicados", "justificativa": "Idem."}
  ],
  "/setor-eletrico/rede/programado": [
    {"antes": "painel|quanto o fluxo divergiu do programa?", "depois": "painel|o desvio de cada hora contra o programa", "justificativa": "Idem."}
  ]
}
```

Nenhuma visão foi retirada nem consolidada. Controles de data dos gráficos ("Início: ...", "Fim: ..."): o texto traz a data exibida, que muda porque o gráfico diário da P025 passou a abrir nos últimos 90 dias; a quantidade de controles é a mesma.

## 4. Mapa das visões (visão anterior, nova localização, nível)

Todas as visões do inventário continuam; âncoras, parâmetros de URL, `data-resposta`, `data-nivel` e `data-grafico` foram mantidos.

- P025 (/carga). Faixa de abertura (Entender): carga média, janela de comparação e variação, com a alternância "Comparar com" (antes na linha de filtros do painel) e as duas fichas Comprove. Painel (Entender): gráfico de pontos, tabela equivalente, calendário das duas janelas, gráfico diário (abre em 90 dias; "Restaurar intervalo" volta aos três anos), controles Região, Janela e Ordenar por. Seções com âncora (Entender): `historico` (série desde 2000 e quebras), `mensal` (Comparador, gráfico e tabelas), `anual` (barras, acumulado e tabelas). Analisar: `a07`. Auditar: `a07-capturas`, `revisoes`, `validacao`, `comparacoes-todas`.
- P026 (/perfil-horario). Faixa (Entender): parcela da MMGD, pico do dia e dias modais. Painel (Entender): dia típico com os gráficos de carga verificada e de curva, filtros Região, Mês e Tipo de dia, resumo das cargas (novo), seções `pico` (mapa de calor e barras), `mmgd`, `horas` e `conceitos`. Analisar: perfil por subsistema, evolução entre anos, picos e recordes, `a11`. Auditar: `compatibilidade`. A escolha "Anos no mapa" só aparece quando as duas opções diferem.
- P027 (/clima-e-calendario). Faixa (Entender, sincronizada com região, comparação e variante). Painel: decomposição (barras e tabela). Seções (Entender): `validacao` (agora com a cobertura medida dos intervalos), `sensibilidade`, `temperatura-resposta`. Analisar: `calendario` e o texto completo da resposta (`p027-decomposicao`). Auditar: `modelo` e `temperatura`.
- P028 (/rede). Faixa (Entender): saldo de 30 dias das quatro fronteiras. Painel (Entender): esquema (antes "mapa"), gráfico por sentido, tabelas, controles Escala, Dia e Hora (a escala Hora volta a funcionar). Seções: `dois-sentidos` (barras e as quatro fichas), `subsistemas`, `saldos` (Entender); resumo de 30 dias (Analisar); `fluxo-e-preco` (Analisar, como era); `p028-regras`, `p028-fonte`, `p028-cobertura` (Auditar).
- P029 (/balanco-e-exterior). Faixa (Entender): três fichas. Painel: contas conferidas (barras e tabela). Seções (Entender): `residuo-mensal`, `residuo-horas` (subiu de Analisar), `exterior`. Analisar: `itaipu`, `a05`. Auditar: `quebra-mmgd`, `identidades`, `cobertura-exterior`, `dicionarios`.
- P030 (/restricoes). Faixa (Entender): fluxos acima do limite, fluxo de mais horas e energia não suprida. Painel: bloco "Limites operativos de intercâmbio: sem fonte aberta" (Entender, ao lado do veredito), barras do ATLS, ficha do fluxo, histórico, seção `cortes-de-carga` (antes bloco sem âncora). Analisar: tabela de busca dos limites, `perturbacoes`. Auditar: `atls-todos-os-fluxos`, `documentos`, `dicionarios-restricoes`, `metodologia-a06` (título agora "Nota de revisão sobre a página de metodologia").
- P031 (/programado). Faixa (Entender, sincronizada com par e base). Painel: faixa de desvios, tabela, gráfico e tabela diários, `maiores-desvios` (cinco primeiras à vista). Seção `mes-a-mes` (subiu de Analisar). Analisar: `programa-e-revisao`, `programa-repetido`. Auditar: `pdo`, `maiores-sequencias`.

## 5. Testes

Atualizados (descreviam o desenho anterior): `energia-carga.test.ts` e `energia-rede.test.ts`, navegação na abertura (capítulos em vez de `aria-current`; as filhas mantêm a faixa de abas); título da série longa da Carga (agora uma pergunta); título da figura da P027 (sem "achado"); P028, o `<h1>` é a pergunta do painel (a do módulo segue no menu, e o teste do destino Rede continua); lista de arquivos sem número escrito à mão (`RedeEsquemaFluxos.tsx` no lugar de `RedeMapaFluxos.tsx`); texto do cartão do Sul da P029. Nenhum teste de conteúdo, método, unidade, ausência, paridade ou risco foi afrouxado.

Novos: Carga (referência das mesmas datas contra `carga_diaria.csv`; a base sincroniza resposta, faixa, frase da outra base e linhas da tabela, para toda região, janela e base; as duas taxas da janela de 7 dias e o controle de base; partes da diferença; hora modal do pico contra `carga_pico_diario.csv`; cobertura do intervalo em Entender; gráfico diário em 90 dias; resumo e nota da P026). Rede (título, faixa e ordem das quatro páginas; saldo de 30 dias contra as horas do CSV; faixa do balanço contra as identidades; medidas de restrições contra `rede_atls.csv`; medidas de programado contra `rede_horario_2026.csv`; geometria do esquema, com a ponta de toda seta fora dos retângulos; carregamento da janela horária; notas e rótulos novos).

## 6. Medidas da primeira tela

Posição vertical do título do primeiro gráfico (px, em 1440 por 900 e em 390 por 844). O traçado começa de 70 a 190 px abaixo do título. Só na P028, em 1440, o título do primeiro gráfico (energia em cada sentido) entra na dobra; nas demais o cabeçalho do site, as três camadas de navegação, a faixa de métricas e a barra de profundidade ocupam a primeira tela (S14 já reduziu a faixa de abas no celular).

| Página | 1440 por 900 | 390 por 844 |
| --- | --- | --- |
| P025 | 912 | 1524 |
| P026 | 1164 | 1982 |
| P027 | 1198 | 1918 |
| P028 | 874 | 1722 (o esquema vira lista) |
| P029 | 979 | 1655 |
| P030 | 1108 | 1815 |
| P031 | 1082 | 1861 |

A frase resposta cabe na dobra de 1440 em P025, P026, P028, P029 e P031.

## 7. O que ficou sem solução

- Títulos de P026 e P027 com 11 palavras (a regra pede 5 a 9): são as perguntas do Anexo A que testes de conteúdo fixam. As demais páginas têm de 5 a 8.
- P026 em 390 px, mapa de calor (item 1.5) e P031 em 390 px, nota de categorias (item 1.2): dependem do componente compartilhado.
- P026, as três cargas: o resumo curto vem antes dos gráficos, mas o glossário completo segue no fim da página.
- P027, vocabulário do seletor de variante ("dobras", "defasagem"): vêm do rótulo publicado na gold; a página define origem mensal, fora da amostra e intervalo de 80% no ponto de uso.
- Cartões de destaque da P026 e da P029 ficam fixos no SIN (e no Sul, na segunda ficha do balanço): dito na nota da faixa, porque as fichas "Comprove" só existem para esses recortes.
