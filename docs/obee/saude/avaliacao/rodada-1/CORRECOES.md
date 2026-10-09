# Correções da rodada 1: Saúde nas capitais

Documento do **executor**. Não contém notas: as notas valem só quando atribuídas pelos avaliadores independentes. Cada linha liga um achado dos relatórios `avaliador-dados.md` (códigos B, P) e `avaliador-experiencia.md` (códigos B e números de problema, aqui com a letra X) à correção e à verificação. Data: 09/10/2026. Gold depois das correções: `hash_dados` `ce882081d96f44d5`, 8.777 observações.

## 1. Bloqueios

| Achado | Correção | Onde | Verificação |
| --- | --- | --- | --- |
| B1 (dados), bloqueio 1 e X1 (experiência): razão agregada em escala errada em 8 medidas e no CSV de referências | A razão agregada passa a sair na unidade do indicador (fator 10.000, 100.000 ou 100, registrado em `fator_razao`); dicionário e CSV de referências atualizados | `pipeline/eficiencia_saude/gold.py` (`FATOR_RAZAO`, `_aplica_fator`) | Python: razão = soma do numerador ÷ soma do denominador × fator e dentro de [mínimo, máximo] em todas as linhas; valores conhecidos (eSF 2025: 1,89; ICSAP 2024: 776,1; ASPS 2025: 21,8). Vitest: mesma invariante sobre o payload de cada medida e ano |
| B2, X2: composição por subfunção apresentada como soma das capitais comparáveis, calculada com 1 a 6 | `composicaoAgregada` soma as linhas que a declaração traz (a soma das linhas reproduz o total da função em 130 de 130 declarações) e devolve as capitais fora da soma com o motivo; natureza, fonte e grupos de ICSAP exigem a abertura completa. A interface escreve, em texto normal, "Soma de N de 26 capitais" e nomeia quem ficou fora | `src/lib/eficiencia/saude/consulta.ts`, `DetalhesSaude.tsx` (`UniversoDoAgregado`) | Vitest: de 2021 a 2025 a soma por subfunção usa 25 ou 26 capitais, a soma das categorias é igual à soma dos totais das capitais incluídas e Campo Grande 2021 aparece como fora |
| B3, X3: frase sobre planos privados sem suporte | Frase reescrita de forma descritiva e sem relação estabelecida, na página e na ficha; expressões causais passam a reprovar nos testes de neutralidade | `DetalhesSaude.tsx`, `catalogo_indicadores.json`, testes | Python e vitest: busca de "por esse motivo", "devido a", "em razão de", "em consequência" e do trecho antigo nos textos públicos, no catálogo, na matriz e nas referências |
| B4 (dados): troca da base da população de referência da cobertura potencial sem sinalização | Marca de quebra de série para dezembro de 2021 e 2022 (população anterior ao Censo 2022); nota na observação e na referência do Brasil; aviso único na tela; medição M05 quantifica o efeito (9,1 dos 14,6 pontos percentuais da mediana vêm só do denominador); a linha da Evolução se interrompe e a variação é bloqueada | `padroniza.py` (`ANO_BASE_POPULACAO_PRE_CENSO`), `referencias_externas.py`, `validacoes.py` (M05), `consulta.ts` (`avisoDoPeriodo`) | Python: marcas [sim, sim, não, não, não] em 2021 a 2025 e texto da referência do Brasil. Vitest: variação 2023 para 2024 existe; 2022 para 2023 bloqueada |

## 2. Dados e método (relatório do avaliador de dados)

| Achado | Correção |
| --- | --- |
| P5: razão "1,07 a 2,79 vezes" sem fonte reproduzível | Números retirados da página e da matriz (R05); R01 passa a dizer que a conferência com o espelho de terceiros é da fase de viabilidade, não está guardada e não sustenta nenhum número publicado |
| P6: notas de natureza descrevem ausência como R$ 0,00 e diferença de R$ 0,00 | Três textos: MSC sem registros ("não é um valor zero"), MSC com linhas sem natureza identificável e MSC que não fecha com a DCA |
| P7: estágio do ASPS | Definição e "o que não é" dizem que o percentual usa a despesa empenhada (regra do último bimestre) e que o valor aplicado pode superar a despesa liquidada da função (Vitória 2021 e 2022); ficha atualizada |
| P8: exportações sem fonte legível, endereço, data, versão, hash e ressalva; decimal misto; período errado para ICSAP | CSV do recorte, da série e da tabela com fonte por extenso, endereço, data de captura, versão metodológica, hash, numerador, denominador, mediana do grupo e ressalva geral; coluna de valor numérico com ponto decimal declarada; período por medida; CSVs de `public/eficiencia/series` com fonte legível, endereço e data |
| P9: UBS de gestão municipal operadas por entidades não públicas | Nova linha do retrato (`gestao_municipal_nao_publica`: 125 no total, 52 no Rio de Janeiro e 38 em São Paulo) e aviso na definição da medida e na ficha |
| P10: diferença de percentuais ambígua | Parcelas: pontos percentuais; razões: unidade na frase e diferença relativa; totais: sem percentual (também contra a mediana) |
| P11: composições de natureza e fonte sem n | `UniversoDoAgregado` em todas as composições agregadas |
| P12: reprodução sem repositório, hash e receita | Página Dados e métodos: link do repositório, nota sobre o hash do conteúdo descomprimido e a receita do `hash_dados` |
| P13: exemplo de ASPS | Documento: 19,756% pela divisão, 19,75 como o SIOPS informa |
| P14: dicionário sem 18 colunas | Dicionário cobre as colunas dos CSV por indicador e do CSV de referências, com o arquivo de cada uma |
| P15: tabela mistura tipos de período | Cabeçalho em dois níveis (perímetro e tipo de período por coluna) e série até o último ano onde a medida acaba |
| P16: política de referências ausente | Seção "Como as referências são calculadas" em Dados e métodos |
| P17: E01 contra M03; filas "avaliadas"; Macapá | E01 corrigido (21 de 26 coincidem); entrada diz que filas não foram pesquisadas; a explicação de Macapá 2025 diz que a MSC é igual ao RREO e a DCA é a única fonte com valor distinto |
| P18: `versao_codigo` da gold | Gold regenerada depois da última alteração de código |
| P19: contagens do documento | Corrigidas (24 arquivos `sau_*` e `saude_*`, gold de 6,2 MB, testes) |
| P20: trilhas cruas | Trilhas formatadas com unidade e componente, para São Paulo, a capital dos exemplos documentados |
| P21: evolução por habitante só conectava 2024 e 2025 | Marcas de base por grupo: 2022 e 2023 (mesma população do Censo 2022) passam a ser comparáveis; 2021 para 2022 e 2023 para 2024 continuam bloqueadas, com explicação |
| P22: empates, "(de 26 a 26)", fragmentos nas referências do Brasil, ponto flutuante, URL, soma `valor ?? 0`, M02 | "Em todos os anos a mediana usa as mesmas 26 capitais"; texto das referências do Brasil refeito (causa: troca global de vírgula por ponto); números limpos nos CSV; ano inválido normalizado na URL; somas só com capitais com valor; nota de estágio violado em Porto Velho 2023 |

## 3. Experiência (relatório do avaliador de experiência)

| Achado | Correção |
| --- | --- |
| X4: CSV da Evolução entregava o recorte do ano | A visão Evolução exporta a série mostrada (capital ou mediana), com marca de base e mediana do ano; o botão diz o que baixa |
| X5: tabela do Comparar ilegível ao rolar no celular | Coluna fixa com fundo opaco, inclusive nas linhas destacadas |
| X6: reais de 2025 e 2021 fragmentados; linha da Evolução quebrando sem justificativa | Explicação de "Reais de 2025" ao lado do controle; aviso único e visível do período acima do gráfico; anotações nos anos de mudança de base; linha só se interrompe onde a base muda |
| X7: estado vazio da cobertura potencial em 2021 | Mensagem própria com o motivo; capitais fora agrupadas por motivo, sem 26 blocos repetidos |
| X8: alternância "IBGE do exercício" sem efeito em 2024; nota do CSV contraditória | Texto ao lado do controle diz quando as populações coincidem; nota do CSV condicional |
| X9: siglas sem tradução | Bloco "Siglas desta página" à vista em cada página; seção Siglas em Dados e métodos |
| X10: perímetro não nomeado | Etiqueta de perímetro em cada tema, no Comparar e na tabela |
| X11: faixa do Panorama sem legenda | Legenda da faixa clara com os valores |
| X12: ordenação | Controle "Ordem das capitais" (alfabética, maior ao menor, menor ao maior) em Distribuição e Tabela, com a nota de que é recurso de leitura |
| X13 e X14: unidades nas diferenças e percentual sobre totais | Ver P10 |
| X15: CSV sem metadados | Ver P8 |
| X16: celular, primeiro gráfico muito abaixo | Cabeçalho compacto (uma linha); visual antes da definição na ordem do celular; controles continuam à frente |
| X17: Dados e métodos longo | Resumo por perfil no topo, matriz de fontes agrupada por perímetro e recolhida, blocos técnicos com nome acessível, exemplos para São Paulo |
| X18: Evolução abria com o salto bruto | Frase usa o último trecho da mesma base e diz quais anos usam outra |
| X19: defeitos de texto | "UBS" e "ICSAP" no início de frase sem a primeira letra minúscula; "1 capital"; ajudas dos seletores |
| X20: título sem indicador de atendimento | O nome da página é mantido; um parágrafo visível diz que não há série de produção da atenção primária e leva ao motivo |
| X21: alvos de toque | Link das decisões sobre fontes com 44 px |
| X22: texto pequeno; seleção só por tom | Textos do módulo com 12 px no mínimo; item selecionado dos controles com marca sublinhada (componente compartilhado) |
| X23: foco após âncora; blocos roláveis sem nome | Seções de Dados e métodos recebem o foco; blocos técnicos com `aria-label` |
| X24: carga | Navegação do módulo sem pré-carga das rotas irmãs |
| X25 a X27: trocar a medida reinicia o ano; URL com ano inválido | O exercício é preservado quando a nova medida o tem; ano inválido é normalizado na URL |
| X28: redundância | Definições das medidas sem repetir a ressalva do bloco vizinho |

## 4. O que não foi alterado, e por quê

* Rodapé do site (23 links com 17 px de altura) e link inline "Série completa em CSV" da ficha de indicador (20 ocorrências em Dados e métodos): componentes compartilhados fora do módulo. A ressalva continua registrada.
* Rótulos em caixa alta da classe `.rotulo` do site (cerca de 11 px): classe global; não alterada.
* Rótulo "Rede e APS" no menu: a sigla é expandida pela página (título "Rede e atenção primária" e bloco de siglas).
* Eixo do gráfico de faixa do Panorama com rótulos de quartis entre marcas regulares: componente compartilhado.
* Carga de 391 a 460 KB de HTML por página (payload de dados): sem alteração nesta rodada.
* Educação: o marcador de quebra de série de Educação (que bloqueia 2022 para 2023) não foi mudado; a marca por base vale só para Saúde.

## 5. Segundo ciclo de correções (achados da reavaliação 1)

Depois da seção "Reavaliação 1" dos dois avaliadores. Gold: `hash_dados` `159b76024a953f4d`, 8.777 observações. Esta seção também é do executor e não contém notas.

| Achado | Correção |
| --- | --- |
| R1 e B4 (dados): segunda troca de base da cobertura potencial, de dezembro de 2024 para 2025, sem sinalização | Três bases (anterior ao Censo, Censo 2022, estimativa de 2024) com marca alternada; nota na observação, na referência do Brasil, aviso e anotação na Evolução; M05 mede as duas trocas (+9,1 e −5,5 pontos percentuais da mediana vêm só do denominador); variação 2024 para 2025 bloqueada |
| N1 (experiência), bloqueio: a mediana de 2021 aparecia com marca de base errada e a linha tracejada atravessava as quebras | A marca de base da mediana é a da maioria das capitais (o perímetro distinto de Campo Grande 2021 não troca a base do conjunto); a linha da mediana se interrompe onde a base muda, também com capital escolhida |
| N2 (experiência): a despesa total explicava a quebra por um denominador que não tem | Motivo da quebra por medida: população de referência (cobertura), base da população (medidas por habitante) ou perímetro do valor oficial (demais) |
| N1 (dados): ano sem mediana de cobertura rotulado "Ausente na coleta" | Estado "Fora da comparação", com a nota de que os valores oficiais existem |
| N2 (dados): endereço da fonte com marcadores e IPCA em valores nominais | Páginas oficiais das fontes (o endereço exato de cada coleta fica no manifesto); IPCA só como fonte quando a moeda é de 2025 |
| N3 (dados): trilhas com reais em % e ruído de ponto flutuante | Composições mostram o valor em reais e a participação em %; até 4 casas decimais |
| N4 (dados): motivo genérico para capitais fora da soma de natureza | Três motivos: MSC sem registros, MSC com linhas sem natureza identificável e abertura que não reproduz a DCA |
| N5 (dados): receita do hash, dicionário sem a matriz, "4 medições", singular, empates | Receita com "sem escape ASCII"; dicionário cobre a matriz de fontes; contagens corrigidas; "ponto" e "pontos percentuais" concordam; empates em ordem alfabética na frase e nas referências |
| P9 (experiência): siglas incompletas | Bloco de siglas também no Panorama; Comparar com DCA, RREO e MSC; Rede com eCR, eSFR, eAPP, Siaps e Sisab; entrada sem siglas não expandidas |
| P16 (experiência): celular, definição e siglas antes do gráfico no Comparar | Resultado antes da definição na ordem do celular; ajudas dos seletores só a partir de telas médias (continuam descrevendo o campo para leitores de tela); etiqueta de perímetro e ajuda de moeda mais curtas no celular |
| N5, N6 (experiência): "Ordem das capitais" sem gráfico; "soma de N" em minúscula; "vai de" no plural; zeros de eAP | Controle só com gráfico; maiúscula depois de ponto; verbo concorda com o rótulo; nota de zero observado nomeia as capitais |
| Outros: aviso de exclusão só abaixo do gráfico; "Não é custo por usuário" repetido em Gastos; "texto qualitativo sem fonte" | Linha com as capitais fora da comparação acima do gráfico, com link ao motivo; repetição removida; frases sobre ocorrência por local reescritas como possibilidade |

Não alterado no segundo ciclo: marcador de nota "2" que encosta no rótulo de valor na Evolução de São Paulo (componente compartilhado); parâmetros inválidos de capital, medida e visão na URL (apenas o ano é normalizado); texto SVG de 10 a 11,5 px e `.rotulo` (classes e componentes compartilhados); CSV com ressalva repetida em cada linha (decisão: o arquivo precisa se explicar sozinho).
