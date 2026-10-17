# Observatório Brasileiro do Saneamento: arquitetura e aderência à skill de construção

Análise de 17/10/2026, feita contra a skill `.claude/skills/observatorio-layout/SKILL.md` e o pedido do dono: figuras ilustrativas e artefatos didáticos onde couberem, painel em padrão internacional e referências mundiais dos indicadores quando possível.

## 1. Como a análise foi feita

**Evidência coletada**

| Item | O que foi feito |
|---|---|
| Rotas | As 26 rotas do painel (`/saneamento` e subpáginas), abertas no servidor local com sessão de auditoria |
| Capturas | Primeira tela e página inteira em 1440 px; primeira tela em 390 px |
| Inventário automático | Por rota: status, títulos, altura, rolagem horizontal, figuras, SVG, tabelas, blocos recolhidos, imagens |
| Código | `src/app/saneamento`, `src/components/saneamento`, `src/lib/saneamento`, `pipeline/observatorio_saneamento` |
| Fontes internacionais | Base global dos ODS da ONU (edição 2026.Q3.G.01, consulta em 17/10/2026) e o JMP já integrado (edição de agosto de 2025, capturado em 17/10/2026) |

**Não verificado nesta análise**: leitor de tela, zoom de 200%, 320 e 768 px, navegação só por teclado e o cabeçalho com conta real (a sessão de auditoria passa pelo middleware, mas `/api/auth/estado` não reconhece usuário, e por isso a barra mostra "Entrar"; quem está logado de verdade vê "Minha conta").

## 2. Arquitetura atual

**Organização.** Cinco eixos e catorze capítulos, cada um com uma pergunta da sociedade, definidos numa fonte única (`src/lib/saneamento/capitulos.ts`) que alimenta cabeçalho, entrada, vitrine, sitemap e testes. O capítulo 5 tem cinco subpainéis. Há quatro ferramentas transversais (meu município, comparar municípios, Brasil no mundo, método) e duas fichas (município e prestador). Situação declarada: 2 capítulos publicados e 12 com cobertura parcial, cada um com a pendência escrita.

**Camadas.**

| Camada | Onde | Papel |
|---|---|---|
| Coleta e seed | `pipeline/observatorio_saneamento/*.py`, `seed/` | Seeds comprimidos com sha256; nenhum seed é lido sem conferência |
| Gold | `public/saneamento/gold/*.json` e `.csv` | Reproduzível byte a byte; downloads públicos |
| Contratos | `src/lib/saneamento/*.ts` | Medidas, referências territoriais, tarifas, conta, JMP |
| Componentes | `src/components/saneamento/*.tsx` | Editorial (abertura, seção, números, ressalva, fonte), atlas municipal, tabela, simulador, comparadores, busca |
| Gráficos | `src/components/energia/Grafico*.tsx`, `Histograma.tsx` | Reaproveitados do Setor Elétrico |

**Inventário por rota** (altura em px; 390 px aproxima o número de telas no celular dividindo por 844)

| Rota | Arquétipo | SVG | Tabelas | Altura 1440 | Altura 390 | Referência mundial | Figura ou modelo didático |
|---|---|---:|---:|---:|---:|---|---|
| Entrada | entrada | 0 | 0 | 4.852 | 9.491 | não | diagrama em texto |
| 1 Acesso | panorama | 28 | 8 | 8.113 | 13.731 | não | não |
| 2 Desigualdades | panorama | 18 | 8 | 8.582 | 14.519 | não | não |
| 3 Continuidade e qualidade | panorama | 23 | 15 | 21.062 | 32.468 | não | não |
| 4 Esgoto | panorama | 26 | 8 | 8.776 | 13.662 | não | não |
| 5 Preço regulado (visão) | entrada de módulo | 0 | 1 | 3.519 | 5.860 | não | quatro passos em texto |
| 5.1 Simulador | exploração | 13 | 2 | 10.052 | 22.642 | não | simulador com regras reais |
| 5.2 Formação | ficha de caso | 6 | 13 | 9.746 | 13.792 | não | não |
| 5.3 Reajustes | catálogo | 0 | 0 | 7.480 | 14.258 | não | não |
| 5.4 Contrapartidas | comparação | 0 | 3 | 3.170 | 4.585 | não | não |
| 5.5 Riscos | catálogo | 0 | 2 | 2.585 | 3.824 | não | não |
| 6 Tarifa social | panorama | 14 | 7 | 11.313 | 17.709 | não | não |
| 7 Prestadores | catálogo | 3 | 4 | 6.235 | 10.077 | não | não |
| 8 Comparar prestadores | comparação | 0 | 0 | 1.564 | 2.497 | não | não |
| Ficha do prestador | ficha | 0 | 3 | 5.066 | 10.080 | não | não |
| 9 Investimento | panorama | 14 | 5 | 7.063 | 9.866 | não | não |
| 10 Financiamento | panorama | 10 | 3 | 4.145 | 6.198 | não | não |
| 11 Planejamento | panorama | 13 | 5 | 7.629 | 11.310 | não | não |
| 12 Responsáveis | catálogo | 0 | 2 | 5.476 | 9.509 | não | não |
| 13 Saúde e ambiente | panorama | 10 | 6 | 8.330 | 12.624 | não | não |
| 14 Resiliência | panorama | 6 | 4 | 5.208 | 8.002 | não | não |
| Meu município | busca | 0 | 0 | 1.423 | 3.066 | não | não |
| Ficha do município | ficha | 0 | 4 | 6.268 | 9.776 | não | não |
| Comparar municípios | comparação | 0 | 0 | 1.476 | 2.301 | não | não |
| Brasil no mundo | comparação | 13 | 6 | 7.161 | 11.382 | sim (JMP) | não |
| Método e fontes | método | 0 | 7 | 11.970 | 16.203 | cita o JMP | não |

Em todas as 26 rotas: rolagem horizontal zero em 1440 e 390 px, nenhum elemento `<figure>`, nenhuma imagem.

## 3. O que já está no padrão

**Evidência**

1. Contrato editorial cumprido de forma consistente: cada número com fonte, período e universo; blocos "permite observar / não permite concluir" em todos os capítulos analíticos; ausência separada de zero; universos que não se somam ditos na própria tela.
2. Organização por perguntas da sociedade, com situação de cada capítulo declarada sem promessa; capítulo sem dado não vira link.
3. Atlas municipal com busca, comparação com UF e Brasil, histogramas com mediana e quartis, tabelas equivalentes e CSV em todos os capítulos com mapa.
4. Simulador de conta com 12 tabelas verificadas em atos, fontes com sha256 e limites declarados (teto da tarifa social, método não verificado).
5. Página "Brasil no mundo" com o JMP, conciliação lado a lado com Censo e SINISA, mediana por grupo sem ponderação declarada.
6. Responsividade sem rolagem horizontal nas 26 rotas; alvos de toque de 44 px no cabeçalho, conferidos no código.

## 4. Achados

Ordem por efeito no leitor. Cada achado traz a evidência e o item da skill.

| # | Achado | Evidência | Skill |
|---|---|---|---|
| 1 | Nenhum capítulo traz referência mundial ao lado do indicador | 0 de 14 capítulos citam o JMP ou os ODS; só "Brasil no mundo" e o método. A base dos ODS e o JMP têm série para 8 capítulos (seção 5) | 11, "Quero mais referências"; 1, referência junto à medida |
| 2 | Não há figura explicativa nem modelo didático | 0 `<figure>`, 0 imagens, 0 ocorrências de "modelo didático" no painel. O diagrama da entrada é lista de texto com setas de caractere; "Como uma decisão do regulador chega à sua conta" são quatro parágrafos | 4, item 3 da entrada; "artefatos interativos sempre que possível" |
| 3 | Na entrada, os capítulos não trazem resposta curta nem número com prova | Os 14 itens são links com resumo de cobertura, sem a resposta da pergunta | 4, item 4 da entrada |
| 4 | No celular, o cabeçalho da plataforma ocupa cerca de 265 de 844 px da primeira tela e empurra os quatro números da entrada para baixo da dobra | Captura de 390 px: lista dos sete observatórios em três linhas, mais "Entrar" e "Menu" | 4, item 1 da entrada; 8. O cabeçalho é compartilhado por todos os observatórios |
| 5 | Páginas muito longas sem navegação interna | Continuidade com 32.468 px no celular (cerca de 38 telas), simulador 22.642, tarifa social 17.709, método 16.203; nenhuma página tem "nesta página" | 4, panorama; 10, densidade e profundidade |
| 6 | Doze rotas sem nenhum gráfico, inclusive as duas fichas | Ficha do município e do prestador só com tabelas: sem posição visual frente a UF, Brasil e pares | 4, ficha de entidade; 6 |
| 7 | Gráficos sem semântica de figura | Nenhum gráfico está em `<figure>` com `<figcaption>`; a descrição acessível de cada SVG não foi auditada | 5, figura analítica; 8 |
| 8 | Perdas de água, tarifas e eficiência de prestadores sem régua internacional acessível | O IBNET do Banco Mundial não conecta deste ambiente (falha do túnel, 502) | 1, não inventar referência |
| 9 | Público estrangeiro | A plataforma tem estrutura de tradução, mas a etapa 6 de tradução está bloqueada por decisão do dono | Decisão do dono |

**Inferência.** Os achados 1, 2 e 3 explicam a maior parte da distância para o padrão internacional pedido: o painel é forte em rigor e em análise, mas ensina pouco por imagem e não situa o Brasil no mundo onde o leitor está. Os achados 4 e 5 pesam mais para quem lê pelo celular.

## 5. Referências mundiais disponíveis por capítulo

Valores lidos nas fontes em 17/10/2026. Base dos ODS: edição 2026.Q3.G.01, agregados regionais ponderados pela própria ONU. JMP: edição de agosto de 2025, ano 2024; a mediana é dos países com estimativa, sem ponderação.

| Capítulo | Indicador mundial | Brasil | América Latina e Caribe | Mundo | Comparabilidade com o indicador do painel |
|---|---|---|---|---|---|
| 1 Acesso | ODS 6.1.1 água gerenciada com segurança | 88,6% (2024) | 78,9% | 73,7% | Modelagem do JMP; não é ligação à rede do Censo nem atendimento do SINISA |
| 1 Acesso | ODS 6.2.1 esgotamento gerenciado com segurança | 55,0% (2024) | 51,2% | 58,5% | Inclui fossa esvaziada e tratada; o Censo não mede tratamento |
| 2 Desigualdades | ODS 6.1.1 por situação, rural e urbana | rural 73,6%, urbana 90,7% (2024) | rural 53,7%, urbana 84,5% | rural 60,5%, urbana 83,5% | Mesma fonte, mesmo conceito; diferença urbana e rural comparável. No esgotamento, o Brasil não tem estimativa rural |
| 3 Continuidade e qualidade | JMP, água disponível quando necessária | 98,9% (2024) | não publicado neste arquivo | mediana de 143 países: 78,9% | Pergunta de disponibilidade do JMP; não equivale a paralisações declaradas ao SINISA |
| 3 Continuidade e qualidade | JMP, água livre de contaminação | 88,6% (2024) | não publicado neste arquivo | mediana de 159 países: 91,5% | Componente de qualidade do JMP; não é o resultado de análises do SISAGUA |
| 4 Esgoto | ODS 6.3.1 esgoto doméstico tratado com segurança | 43,4% (2022, estimativa) | 45,9% (2022) | 57,8% (2022) | Mais perto do IES2003 (tratado sobre consumido, 51,8%, 2024) que do IES2004 (tratado sobre coletado, 85,2%, 2024). O Brasil não tem valor de 2024 nesta série; a comparação usa 2022, ano comum aos três |
| 4 Esgoto | JMP, população ligada à rede com tratamento | 44,5% (2024) | não publicado neste arquivo | mediana de 160 países: 25,6% | População, não volume |
| 10 Financiamento | ODS 6.a.1 ajuda oficial ao desenvolvimento para água e saneamento recebida | US$ 29,7 milhões, dólares constantes (2024) | US$ 767,7 milhões | não aplicável | Ordem de grandeza frente ao investimento declarado; câmbio e preços diferentes impedem somar |
| 11 Planejamento | ODS 6.5.1 grau de implementação da gestão integrada de recursos hídricos | 51 (2023) | 39 | 57 | Mede recursos hídricos, não plano de saneamento; régua de governança, não de meta |
| 13 Saúde e ambiente | ODS 3.9.2 mortalidade atribuída a água, esgoto e higiene inseguros, por 100 mil | 6,6 (2019) | 6,5 | 18,2 | Modelo da OMS de mortes atribuíveis; o painel conta óbitos registrados de três grupos de doenças |
| 13 Saúde e ambiente | ODS 6.3.2 corpos d'água com boa qualidade ambiental | 68,2% (2023) | 57,4% | 56,8% | Relatado pelo país à ONU; amostra de corpos d'água monitorados |
| 14 Resiliência | ODS 6.4.2 estresse hídrico | 1,4% (2023) | 5,4% | 17,6% | Média nacional esconde bacias em estresse; não mede racionamento |

Sem régua acessível agora: tarifa e comprometimento de renda (capítulos 5 e 6), perdas e desempenho de prestadores (7 e 8), investimento por habitante (9), controle social (12). A série do ODS 6.b.1 para o Brasil existe só para o meio rural e em código numérico cuja escala precisa de leitura do metadado da GLAAS antes de qualquer uso.

## 6. Figuras e artefatos didáticos propostos

Três tipos, sempre identificados na própria figura: **figura com dado** (valores da gold), **ilustração conceitual** (sem dado e sem escala, como a do PLD no Setor Elétrico) e **modelo didático** (laboratório que o leitor manipula, com o rótulo e o que ele deixa de fora, como os laboratórios de curtailment).

| Onde | Figura ou artefato | Tipo | Dado |
|---|---|---|---|
| Entrada | "Do manancial ao rio": ilustração do caminho físico da água e do esgoto, com cada etapa ligada ao capítulo que a mede, e camada institucional separada | ilustração conceitual | nenhum |
| Entrada | Faixa "Brasil no mundo" com três réguas (água e esgotamento gerenciados com segurança, esgoto tratado) | figura com dado | ODS e JMP |
| 1 Acesso e Brasil no mundo | Escada de serviço do JMP, Brasil ao lado do mundo e da América Latina | figura com dado | ODS e JMP |
| 3 Continuidade e qualidade | Os três componentes da água gerenciada com segurança (no domicílio, disponível, sem contaminação) | figura com dado | JMP |
| 4 Esgoto | Os níveis de tratamento (preliminar, primário, secundário, terciário) ao lado das estações declaradas por nível | ilustração conceitual com dado | SINISA |
| 5 Preço regulado | "Da receita à conta": o leitor muda custo, remuneração do capital e volume e vê a tarifa média e a conta de 10 m³ | modelo didático | valores de exemplo, marcados |
| 8 Comparar prestadores | Balanço hídrico: água produzida, consumo faturado, perdas aparentes e reais | ilustração conceitual | nenhum |
| 10 Financiamento | Tarifas, tributos e transferências: de onde vem cada real investido, na moldura da OCDE | ilustração conceitual com dado | SINISA |
| 11 Planejamento | "A que ritmo chega à meta": cobertura atual, ano da meta e ritmo exigido contra o ritmo entre os Censos | modelo didático | Censo e meta legal |
| 13 Saúde e ambiente | Rotas de transmissão fecal e oral e as barreiras que água, esgoto e higiene colocam | ilustração conceitual | nenhum |
| Fichas | Posição do município frente a UF, Brasil e pares em pontos | figura com dado | gold |

## 7. Plano de execução recomendado

| Etapa | Entrega | Alcance |
|---|---|---|
| 1 | Referências mundiais: coletor da base dos ODS com seed versionado e sha256, gold própria, componente "No mundo" e régua em cada capítulo da seção 5, com a nota de comparabilidade; faixa na entrada | Só o saneamento |
| 2 | Figuras e artefatos da seção 6, com `<figure>` e `<figcaption>` em todos os gráficos novos | Só o saneamento |
| 3 | Entrada pelo checklist: capítulos com resposta curta e número com prova; navegação "nesta página" nas páginas longas | Só o saneamento |
| 4 | Cabeçalho móvel da plataforma | Todos os observatórios: autorizado pelo dono em 17/10/2026 |

**Decisões do dono que esta análise não toma**

1. Cabeçalho móvel compartilhado (achado 4): mexe em todos os observatórios. Autorizado em 17/10/2026. Abaixo de 640 px, a lista dos oito observatórios sai do topo e os mesmos destinos ficam no seletor de observatório da linha da marca. Medido em 390 px, com o dev local, logado e deslogado: o cabeçalho da entrada do Saneamento passou de 266 para 90 px e o título, de 340 para 164 px do topo; a página inicial da plataforma passou de 374 para 170 px.
2. Versão em inglês (achado 9): depende da liberação da etapa 6 de tradução.
