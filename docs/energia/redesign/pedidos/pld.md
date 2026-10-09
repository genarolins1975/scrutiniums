# Pedidos de mudança compartilhada: família PLD

Rotas `/setor-eletrico/pld`, `/pld/cmo-e-formacao`, `/pld/diferencas-regionais`, `/pld/historico` e `/pld/limites`. Cada pedido diz o que mudar, por que e em que arquivo. Nenhum deles bloqueia as páginas: cada uma segue com a melhor solução local, descrita no item. No fim, a matriz de preservação (visão anterior, nova localização, nível) e as medidas da primeira tela.

## 0. Arquivo sem uso para apagar no fim (regra do coordenador: não apagar componente com o servidor no ar)

- `src/components/energia/PldLinkPainel.tsx`: nenhum arquivo o importa. O rodapé de cada painel usa o `SeguirPainel` compartilhado, por meio de `PldSeguir` (em `PldPagina.tsx`), com o mesmo botão "Copiar link deste painel". O arquivo continua no repositório com o conteúdo original (56 linhas); nenhum teste depende dele.
- `docs/observatorios/energia/modulos/pld.md` ainda descreve a interface anterior (cita `PldLinkPainel`, a lista de componentes e a ordem das páginas). Vale atualizar quando o coordenador fechar o módulo.

## 1. Siglas DECOMP, DESSEM e NEWAVE sem expansão no registro compartilhado

`src/lib/energia/siglas.ts` (`SIGLAS`) não tem as três. Os verbetes do glossário (`conteudo/conceitos.ts`, slugs `decomp`, `dessem` e `newave`) trazem a sigla como nome porque o manual do CEPEL não está entre os documentos lidos, e a expansão não pode ser escrita sem fonte. Local: nas páginas do PLD cada uma aparece como `Termo` (definição visível ao tocar ou focar) no ponto de uso: lead de CMO e formação, aula e diagrama da abertura. A legenda "Fontes, datas e siglas" não as expande. Pedido: quando a fonte primária for lida, acrescentar as três a `SIGLAS`.

## 2. Primeira tela: componentes compartilhados que gastam altura

Medidas depois do reordenamento local (figura antes da faixa de medidas): ver o fim deste arquivo. O que ainda custa altura e não é das páginas:

- `NavegacaoLocal variante="faixa"`: com os cinco rótulos longos de `PAINEIS_PLD`, ocupa de 3 a 5 linhas em 390 px (de 130 a 215 px) antes do painel. Proposta: rótulos mais curtos na faixa (a lista é usada pelo menu, pelos testes e pela página de Regulação, por isso a decisão é do coordenador) ou uma faixa rolável com indicação de que há mais itens.
- `CabecalhoModulo`: título, lead, recorte, fonte e "Fontes, datas e siglas" somam 257 px em 1440 e cerca de 330 px em 390 (lead de 3 e de 6 linhas). O botão "Mais N siglas" tem 24 px de altura no celular.
- `GraficoLinhas` com `zoom` e `legendaInterativa`: título, botões de período, "Ajustar início e fim" e legenda gastam cerca de 190 px antes do traçado em 1440 e cerca de 250 px em 390 (CMO semanal e médias mensais do Histórico). Proposta: variante compacta, com os botões de período e a legenda na mesma linha.
- `CabecalhoModulo` aceita a faixa de medidas só como conteúdo fixo do servidor; nas páginas filhas as medidas dependem do submercado, do período ou do ano escolhidos (estado do cliente), por isso a faixa vive no painel, depois da figura.

## 3. `MapaCalor`: valor na célula e peso do HTML

- A célula só mostra a cor; o valor aparece na tabela equivalente e na dica. Proposta: prop `mostrarValor` (texto de 11 px) quando a célula comporta, com contraste calculado pela escala.
- Peso: o mapa hora × mês do Histórico (12 × 24 células) tem cerca de 138 kB de HTML e o calendário de Limites (183 dias), cerca de 91 kB, por causa dos atributos repetidos em cada célula. Local: em tela estreita o mapa hora × mês vira seis faixas de 4 horas (cerca de 38 kB) e a grade de 24 horas só é montada ao abrir "Ver as 24 horas", mas a grade larga continua no HTML (a troca é de CSS). Proposta: classes e variáveis CSS no lugar de atributos por célula.

## 4. Peso das páginas (meta de cerca de 600 kB)

HTML servido pelo servidor de desenvolvimento (inclui o fluxo RSC): `/pld` 659 kB, `/pld/cmo-e-formacao` 476 kB, `/pld/diferencas-regionais` 384 kB, `/pld/historico` 619 kB e `/pld/limites` 540 kB. As duas acima da meta passam pouco dela. O que é das páginas já foi cortado (a aula de 1.000 palavras caiu para 460 em Entender, com o resto em Analisar e Auditar; o boxplot do Histórico é HTML em vez de SVG por faixa). O que depende de compartilhado: `MapaCalor` (item 3), os diálogos "Sobre este dado" e as fichas "Comprove este número" (cada uma leva o objeto de evidência inteiro no fluxo), e os `Termo` (cada um leva o texto da definição no HTML). Proposta, a mesma de outras famílias: montar o conteúdo do diálogo e da ficha na primeira abertura.

## 5. Campos de dado que o pipeline poderia publicar (nenhum foi alterado aqui)

- `regional.amplitude[]`: acrescentar `media_nas_horas_separadas` e `mediana_nas_horas_separadas`. A média sobre todas as horas (R$ 37,82/MWh em 12 meses) lê-se como média das horas separadas; a página diz "contando todas as horas" e deriva "cerca de R$ 87" para as 3.791 separadas só quando os limites de arredondamento (duas casas da média e as horas sem separação, de no máximo R$ 0,01 cada) dão o mesmo inteiro. O valor exato e a mediana das horas separadas (R$ 12,35 na avaliação técnica) dependem do dado.
- `cmo_pld.relacao_anual[].entre`: `frac_abs_ate_1` vem com quatro casas (por exemplo 0,0205). A página mostra duas casas de percentual para não arredondar duas vezes. Pedido: publicar também a contagem de horas.
- Fichas "Comprove este número" (`pld_evidencias.json`, 27 fichas): não há ficha para a média diária por submercado e o menor e o maior da abertura, para as estatísticas por período, para a amplitude e as medidas da página de diferenças regionais fora dos últimos 12 meses (só há `separacao_12m_*`), nem para a posição do dia pelo percentil. A página mostra esses números sem a ficha e diz, na própria medida, quando a ficha existe só para outro recorte.
- Textos de limitações, regras e `nota_teto_estrutural` ainda dizem que os limites "não foram auditados nesta fase" e que a regra do teto estrutural não está citada. É do coordenador (`pld.py`). Enquanto a gold não for regerada, as páginas trocam só essa cláusula (`semRessalvaDeLimitesNaoAuditados`, `provenienciaSemRessalvaObsoleta`, `notaTetoComConfirmacaoEmpirica`, em `lib/energia/pld.ts`); com a frase nova na gold, as três funções devolvem o texto igual e deixam de valer sozinhas.
- `pld_horario_recente.json`: o fluxo nas fronteiras termina em 28/09/2026 23h e o PLD, em 30/09/2026. A abertura usa 28/09 para o preço e para o fluxo no mapa dos submercados e diz isso; os dois últimos dias de PLD ficam sem fluxo.
- A série semanal do PLD de 2001 a 2020 (CCEE) continua catalogada e não integrada: a referência histórica começa em janeiro de 2021, e as páginas dizem isso. A decisão de integrar é de produto.

## 6. Achados de conteúdo e de dado vistos e não corrigidos

- Um dado de produto, não de página: o "Mapa hora × dia" só se monta no cliente, ao entrar na tela (arquivo de 95 kB sob demanda); sem JavaScript fica o mapa hora × mês e a tabela equivalente.
- O calendário de limites cobre só os 366 dias mais recentes da gold; o leitor não escolhe o calendário de anos anteriores (a gold de limites não o publica). A página nomeia o calendário ("Em quais dos últimos dias o preço ficou no limite?"), diz que ele não segue o Ano escolhido acima e lista por data os dias no limite quando são poucos. O histórico de cada ano está nas barras e no CSV diário de limites.
- Os valores de Médias ponderadas pela carga do balanço de set/2026 só entram com as horas de carga publicadas (672 das 720 do mês): a página mostra ago/2026 como último mês com as três médias e diz por quê.
- "Geração verificada" continua escrito em um lugar: o cabeçalho de coluna do exemplo sintético de liquidação (conceito da CCEE de energia contabilizada, com quantidades hipotéticas). Nenhuma participação de fonte do Balanço do ONS é chamada de verificada (a solar inclui a MMGD estimada desde 29/04/2023, e os textos e o selo dizem isso).

## 7. Medidas da primeira tela (posição vertical do topo da primeira figura)

| Rota | 1440 por 900 | 390 por 844 |
| --- | --- | --- |
| `/pld` | 741 | 1.129 |
| `/pld/cmo-e-formacao` | 891 | 1.547 |
| `/pld/diferencas-regionais` | 772 | 1.453 |
| `/pld/historico` | 821 | 1.388 |
| `/pld/limites` | 703 | 1.234 |

Antes do reordenamento local as filhas ficavam em 1.114, 1.053, 1.266 e 936 (1440) e em 2.081, 2.029, 2.320 e 1.687 (390). O que mudou: a resposta e a escolha abrem o painel, a figura vem logo depois e a faixa de medidas vem depois da figura (no Histórico, antes das médias mensais, junto das definições das réguas). Referência de outras famílias na mesma medida: Água e clima, filhas, 638 e 665 (1440) e 1.038 e 1.055 (390); Geração, filhas, 764 e 832 (1440); Qualidade, 769 (1440) e 1.340 (390).

## 8. Matriz de preservação: visão anterior, nova localização, nível

Fonte das visões anteriores: `dados/visoes_antes.json`. Níveis: E é visível em Entender (e, portanto, nos três modos), A só em Analisar e Auditar, U só em Auditar. "Sobe" quer dizer que a visão estava em Analisar ou Auditar e passou a Entender.

### `/setor-eletrico/pld` (20 visões)

| Visão anterior | Nova localização | Nível |
| --- | --- | --- |
| Painel P008, "O que o PLD remunera e como é formado?" | Seção `#p008` (aula e diagrama), depois do preço e das medidas | E |
| Painel da etapa selecionada (EAR) | `#formacao-painel`, ao lado do diagrama (hoje abre na etapa escolhida, com o estado de cada etapa) | E |
| Painel sem título | Painel do preço do dia (`#hoje` e `#precos`), com a faixa de três medidas no cabeçalho | E |
| Painel `#periodos`, "Em que horas o preço sobe, e as regiões se separam?" | Mesmo `#periodos`, com `?per=` na URL, "Copiar link deste período" e "Baixar este período (CSV)" | E |
| Tabela recolhida de 24 linhas e gráfico do dia | Mesmo painel, aba Dia | E |
| Tabela recolhida de 8 linhas (dados do mapa) | `#submercados` | E |
| Gráfico "PLD dos quatro submercados, dia 30/09" | `#periodos` (aba Dia); a abertura ganha o gráfico de barras "Média diária do PLD por submercado" | E |
| Diagrama de fluxos médios de 28/09 | `#submercados` (mapa com preço e fluxo do mesmo dia e as horas em cada sentido) | E |
| Ilustração conceitual sem dados (passado e futuro) | `#previsao` | E |
| Controles Nível de profundidade e Período | Seletor fixo de profundidade; abas de Período em `#periodos` | E |
| Arquivos (CSV de CMO e PLD horário; Baixar CSV) | "Baixar os dados (2 arquivos)" e botões de CSV das tabelas | E |
| Painel `#amplitude`, "Quando os submercados se separaram no último ano?", com tabela de 368 linhas e gráfico | Mesmo `#amplitude` | Sobe de A para E |
| Resumos de 6 linhas, limites por vigência e menor valor por ano | `#limites-por-vigencia` e `#menor-valor-por-ano` | U |
| Arquivos do PLD horário e do PLD médio diário (CSV) | "Baixar os dados" do painel | E |
| Como classificamos | `#regras` | A |

Novos nesta página: aula curta (460 palavras em Entender), cartão "Não é a sua tarifa de energia" com link para `/setor-eletrico/conta-de-luz`, ponte entre os limiares de R$ 1,00 e R$ 0,01, texto nominal e regimes, estados do diagrama com o Balanço do ONS e o selo Estimado, e a lista de horas por sentido.

### `/setor-eletrico/pld/cmo-e-formacao` (24 visões)

| Visão anterior | Nova localização | Nível |
| --- | --- | --- |
| Painel P009 e gráfico semanal (DECOMP, DESSEM e PLD) | `#p009`; piso e tetos do ato entram no gráfico quando algum valor os alcança | E |
| Tabela equivalente das semanas e tabela recolhida de 156 linhas | `#p009`, segue o intervalo do gráfico | E |
| Controles Submercado, Início e Fim | Escolha de submercado ao lado da resposta; Início e Fim em "Ajustar início e fim" | E |
| Arquivos (3) e Baixar CSV | "Baixar os dados (3 arquivos)" e botões das tabelas (o arquivo da tabela segue o intervalo) | E |
| 2 fichas Comprove (Entender) e 3 (Analisar e Auditar) | Faixa de medidas do painel (2 fichas) e `#a02` (ficha dos zeros) | E e A |
| Gráfico sem título (quatro painéis, 168 horas) e "Dados dos painéis em tabela" | `#mesma-hora` | Sobe de A para E |
| Gráfico e tabela "Horas de cada ano pela situação do PLD frente aos limites" | `#relacao-anual`, com a tabela de 13 colunas e a tabela recolhida de 6 linhas | Sobe de A para E |
| Tabela de sequências de semanas com CMO zero e filtro Subsistema | `#a02`, "Sequências de 4 semanas seguidas ou mais com CMO semanal zero, por subsistema (desde 2005)" | A |
| Arquivos anuais relidos; conferência da data da semana; meias horas esperadas e publicadas | `#a02-arquivos`, `#alinhamento` e `#cobertura` | U |

Novo: `#quatro-submercados` (tabela e distância entre submercados nos três produtos), em Entender.

### `/setor-eletrico/pld/diferencas-regionais` (27 visões)

| Visão anterior | Nova localização | Nível |
| --- | --- | --- |
| Painel P012, barras por par, tabelas equivalentes (separação, matriz) e tabelas recolhidas | `#p012`; barras, matriz e as duas tabelas seguem o Período escolhido | E |
| Controles Matriz dos últimos 12 meses, Submercado A e B, Período, Par em destaque | "Matriz do período", filtros da tabela da matriz, Período e Par ao lado da resposta | E |
| Arquivos (JSON de 168 horas, CSVs de separação e amplitude, Baixar CSV) | "Baixar os dados (3 arquivos)" e botões das tabelas | E |
| 1 ficha Comprove | Faixa de medidas (medida do par, 12 meses) | E |
| Gráfico sem título e tabela recolhida de 24 linhas (perfil horário por par) e controle Pares nos gráficos | `#perfil-horario` | Sobe de A para E |
| Gráfico "PLD dos quatro submercados, hora a hora", tabela de 168 linhas, diagrama de fluxos da hora e controle Hora no esquema | `#hora-a-hora` (abre na hora de maior diferença) | A |
| Tabelas de fluxo nas fronteiras nas horas separadas e de amplitude por período (agora com horas dos quatro no piso) | `#fluxo-nas-horas-separadas` | A |

### `/setor-eletrico/pld/historico` (35 visões)

| Visão anterior | Nova localização | Nível |
| --- | --- | --- |
| Painel P011, resposta e escolha de submercado | `#p011` | E |
| Gráfico mensal (temporal e ponderadas), tabela de 69 linhas, controle Moeda, Início e Fim, filtros da tabela (mês parcial, perímetro, ponderada, sem MMGD) | `#medias-mensais`, com marcas numeradas e legenda das mudanças de perímetro | E |
| 2 fichas Comprove | Faixa de medidas | E |
| Tabela de percentis por mês, gráfico das médias diárias por mês | `#sazonalidade` (primeira figura) | Sobe de A para E |
| Tabela de quantis por ano e diagrama de faixas por regime | `#distribuicao` (boxplot em HTML) | Sobe de A para E |
| Tabelas recolhidas de 12 e 30 linhas e controle Janela do mapa | `#perfil-hora-mes` e `#mapa-hora-dia` (em tela estreita, faixas de 4 horas) | Sobe de A para E |
| Gráfico por submercado na mesma escala, controles Medida e Submercados no gráfico | `#comparar` | A |
| Tabelas de perímetros e de revisões da carga e seus filtros | `#peso` e `#revisoes` | U |
| Arquivos (4 e Baixar CSV) | "Baixar os dados (5 arquivos)", com o CSV da carga verificada | E |

### `/setor-eletrico/pld/limites` (31 visões)

| Visão anterior | Nova localização | Nível |
| --- | --- | --- |
| Painel P010, gráfico por ano, tabela de permanência, tabelas recolhidas | `#p010`; a faixa traz os limites do ano e o objeto de cada um | E |
| Calendário, tabela equivalente de 183 linhas, controles Calendário e Janela do calendário, filtro da tabela | `#calendario`, "Em quais dos últimos dias o preço ficou no limite?" | E |
| Controles Submercado e Ano | Ao lado da resposta | E |
| Arquivo CSV diário e Baixar CSV | "Baixar os dados" e botões das tabelas | E |
| 1 ficha Comprove | Faixa de medidas | E |
| Gráfico "Horas no piso por ano e submercado" e controle Submercados no gráfico | `#piso-por-submercado` | Sobe de A para E |
| Gráfico e tabela "Horas por número de submercados no piso" | `#empates-piso` | Sobe de A para E |
| Gráfico sem título, tabela de limites por trecho de vigência e controles Categoria, Período por data, De e Até | `#atos` | A |
| Tabela de atos e filtro Nível de conferência | `#atos-conferencia` | U |
| Tabela de menor e maior valor observado contra o ato e filtros | `#menor-observado` | U |

Novas: `#norma-limites` (passagens da REN ANEEL 1.032/2022, arts. 22 a 24, em Auditar) e `#tolerancia`.

Equivalências que consolidam: nenhuma. Nenhuma visão foi removida; as três "tabelas recolhidas" de cada figura continuam ao lado da figura.
