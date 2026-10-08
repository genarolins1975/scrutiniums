# Módulo Aprenda (P065, P066)

Documento do módulo Aprenda (rotas `/setor-eletrico/aprenda`, `/setor-eletrico/aprenda/<verbete>`, `/setor-eletrico/aprenda/trilhas` e `/setor-eletrico/aprenda/trilhas/<trilha>`). Estado em 08/10/2026 (Brasília): glossário com 48 verbetes, todos conferidos na fonte primária (45 em 06/10/2026 e GSF, REE e constrained-off em 07/10/2026); duas trilhas que ligam conceitos a números publicados. O Aprenda não tem gold própria: lê as golds e as séries de evidência dos módulos temáticos no build.

## 1. Painéis e estado

| Painel | Entregue | Estado |
| --- | --- | --- |
| P065 Glossário completo | Cada verbete conferido traz definição em uma frase, por que importa, como é medido, unidade (quando é grandeza), exemplo real ligado ao painel onde o número aparece, "não confundir com", relações, nas trilhas, fonte oficial com trecho literal, data de conferência (e de revisão, quando posterior) e o que não se pode concluir. Das oito pendências do inventário, todas foram conferidas: MRE no Mercado e ACR, ACL, garantia física e ESS no Decreto nº 5.163/2004 (06/10/2026); GSF no boletim e no relatório do GT do MRE, REE em notas da EPE, do MME e do ONS, e constrained-off na nota técnica da EPE que cita a REN ANEEL nº 1.030/2022 (07/10/2026). Os temas pedidos (tarifa, perdas, DEC e FEC, inclusão e emissões) já estavam conferidos pelos módulos e ganharam unidade, contraste e exemplo | Concluído com limitação declarada: a definição regulatória do GSF (Regras de Comercialização da CCEE), o texto original da REN ANEEL nº 1.030/2022 e os Procedimentos de Rede do ONS não foram acessados, e cada verbete diz isso |
| P066 Trilhas e exemplos | Duas trilhas: água → operação → preço (seis passos) e custo → tarifa → orçamento (cinco passos). Cada passo tem verbetes conferidos, texto escrito só com o que eles dizem, um número real com a ficha de prova e o link ao painel, e a ligação tipificada com o passo seguinte (fluxo físico, decisão de operação, regra de mercado, componente de custo, associação analítica), desenhada com o traço do tipo, como no mapa conceitual da página inicial. Exemplo sintético interativo em cada trilha, com rótulo permanente. Do painel, um botão traz o leitor de volta ao passo da trilha ou ao exemplo do verbete | Concluído com limitação declarada: a liquidação sintética é simplificação pedagógica (Regras de Comercialização da CCEE não conferidas); o peso no orçamento vem da POF 2017-2018 |

Revisão adversarial da interface feita em 07/10/2026 (seção 7): três revisores independentes em contexto limpo, 84 achados, nenhum bloqueante. Em 08/10/2026 os 35 que estavam abertos ou parciais foram retomados: ficam 73 corrigidos, 11 parciais e nenhum aberto (seção 7, "Fechamento").

## 2. Fontes primárias conferidas (06 e 07/10/2026)

| Documento | Endereço | Captura versionada | Verbetes |
| --- | --- | --- | --- |
| Decreto nº 5.163, de 30 de julho de 2004, texto compilado do Planalto (redação vigente em 06/10/2026) | https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/decreto/d5163.htm | `pipeline/energia/seed/documentos_aprenda/v20261006T212851Z/decreto_5163_2004_trechos.txt` (capturado às 21h28 UTC; sha256 do HTML original e do recorte no `MANIFESTO.json`) | ACR e ACL (art. 1º, § 2º, incisos I e II), garantia física (art. 2º, §§ 1º a 3º), ESS (art. 59, caput e incisos I a III) |
| CCEE, InfoMercado mensal Nº 229 (julho de 2026), página 12 | coleta autorizada do Mercado | `infomercado_229_p12.txt` (texto da página extraído com pdftotext; sha256 do PDF e do texto) | MRE (glossário) |
| MME, Boletim Mensal de Monitoramento do Sistema Elétrico Brasileiro, janeiro de 2021, seção 8.5 e lista de siglas | https://www.gov.br/mme/pt-br/assuntos/secretarias/secretaria-nacional-energia-eletrica/publicacoes/boletim-de-monitoramento-do-sistema-eletrico/2021/boletim-de-monitoramento-do-sistema-eletrico-jan-2021.pdf | `pipeline/energia/seed/documentos_aprenda/v20261007T211054Z/boletim_gsf_mre_p28.txt` | GSF |
| MME, GT Modernização do Setor Elétrico, Relatório do GT Aprimoramento do MRE, julho de 2019, figura 8 e Tabela 1 | https://www.gov.br/mme/pt-br/assuntos/secretarias/secretaria-executiva/modernizacao-do-setor-eletrico/arquivos/pasta-geral-publicada/mre.pdf | `pipeline/energia/seed/documentos_aprenda/v20261007T211054Z/gt_mre_tabela1.txt` | GSF |
| MME, GT Modernização do Setor Elétrico, Relatório do GT Mecanismos de Formação de Preços, julho de 2019, seções 2.2.1 e 5 | https://www.gov.br/mme/pt-br/assuntos/secretarias/secretaria-executiva/modernizacao-do-setor-eletrico/arquivos/pasta-geral-publicada/formacao-de-precos.pdf | `pipeline/energia/seed/documentos_aprenda/v20261007T211054Z/gt_formacao_ree.txt` | REE |
| EPE, PDE 2031, Estudos Complementares: Sensibilidades what if (NT EPE-DEE-RE-037/2022, 12/07/2022), seção 2 | https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/publicacoes/Documents/Estudos%20Complementares%20PDE2031_Sensibilidades%20what%20if.pdf | `pipeline/energia/seed/documentos_aprenda/v20261007T211054Z/epe_pde2031_ree.txt` | REE |
| EPE, NT EPE/DEE/099/2025 (dezembro de 2025), premissas e topologia | https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/publicacoes/PublicacoesArquivos/publicacao-525/topico-813/EPE-DEE-RE-099_2025_rv0.pdf | `pipeline/energia/seed/documentos_aprenda/v20261007T211054Z/epe_nt099_ree.txt` | REE |
| MME e EPE, NT EPE-DEE-NT-096/2022-r0, Constrained-off de usinas eólicas, período definitivo (novembro de 2022) | https://www.gov.br/mme/pt-br/assuntos/noticias/mme-publica-valores-de-garantias-fisicas-de-usinas-eolicas-para-2023/constrained-off-de-usinas-eolicas.pdf | `pipeline/energia/seed/documentos_aprenda/v20261007T211054Z/epe_nt096_constrained_off.txt` | Constrained-off |
| ONS, dados abertos, EAR Diário por REE (descrição) | https://dados.ons.org.br/dataset/ear-diario-por-ree-reservatorio-equivalente-de-energia | `pipeline/energia/seed/documentos_aprenda/v20261007T211054Z/ons_ear_diario_por_ree.txt` | REE |
| ONS, dados abertos, ENA Diário por REE (descrição) | https://dados.ons.org.br/dataset/ena-diario-por-ree-reservatorio-equivalente-de-energia | `pipeline/energia/seed/documentos_aprenda/v20261007T211054Z/ons_ena_diario_por_ree.txt` | REE |
| ONS, dados abertos, Restrição de Operação por Constrained-off de Usinas Eólicas (descrição) | https://dados.ons.org.br/dataset/restricao_coff_eolica_usi | `pipeline/energia/seed/documentos_aprenda/v20261007T211054Z/ons_restricao_coff_eolica.txt` | Constrained-off |
| ANEEL, REN nº 1.030/2022, texto compilado até a REN 1.109/2024 (cópia do Internet Archive de 08/01/2025), Título II e Título II-A | https://www2.aneel.gov.br/cedoc/ren20221030.pdf | `pipeline/energia/seed/documentos_aprenda/v20261007T215553Z/ren_aneel_1030_2022_constrained_off.txt` (PDF páginas 10 a 18; sha256 do original a1d25fd0…2e638 no manifesto) | Constrained-off |
| ANEEL, REN nº 957/2021, Convenção de Comercialização, texto compilado (cópia do Internet Archive de 01/06/2025), art. 2º, XIII, e art. 5º, § 4º | https://www2.aneel.gov.br/cedoc/ren2021957.pdf | `v20261007T215553Z/ren_aneel_957_2021_mcp.txt` (sha256 do original 472d18da…23e00 no manifesto) | MCP e PLD (revisados em 07/10/2026) |

O recorte do Decreto remove só o texto riscado (redação revogada) e as marcas HTML. As capturas de 07/10/2026 são o texto das páginas citadas (pdftotext sem `-layout`, espaços repetidos reduzidos) ou o parágrafo de descrição da página do ONS; o `MANIFESTO.json` de cada pasta guarda data e hora, tamanho e sha256 do original, a transformação aplicada e o sha256 do recorte. O teste `energia-aprenda.test.ts` reúne os manifestos de todas as pastas, confere o sha256 de cada captura e que todo trecho citado aparece nela literalmente, a menos de espaços.

Conferidos em 07/10/2026, com a ressalva de cada verbete:

* **GSF**: o boletim do MME de janeiro de 2021 dá a conta do mês (42.500 MWmédios gerados sobre 52.788 MWmédios de garantia física sazonalizada, GSF mensal de 80,51%, conferida em teste) e a sigla; o relatório do GT do MRE (julho de 2019) define o GSF verificado como a razão entre a geração mensal verificada e as garantias físicas históricas e registra o efeito do descolamento entre a sazonalidade da produção e a da garantia física. Os três documentos usam denominadores diferentes (sazonalizada, histórica sem sazonalização, modulada e ajustada pela disponibilidade no observatório), e o verbete diz isso. A definição regulatória das Regras de Comercialização da CCEE e da regulamentação da ANEEL não foi lida (o repositório de normas da ANEEL responde 403, e o bloqueio não foi contornado); por isso o selo do GSF traz uma ressalva. Os trechos do relatório do GT do MRE são, ao todo, seis: cinco no GSF (balanço operativo, Tabela 1, contabilização, crise do MRE e figura 8) e um no MRE (PCHs).
* **REE**: nenhum documento consultado define o termo formalmente. A EPE o descreve como a representação agregada das usinas hidrelétricas nos modelos oficiais de planejamento, de acordo com as bacias hidrográficas; a EPE (dezembro de 2025) registra a topologia G, de 12 REE e 4 subsistemas, em uso desde o PMO de janeiro de 2018; o MME (julho de 2019) registra a passagem de 4 para 12 REE e a correlação espacial mensal das afluências entre eles; o ONS publica EAR e ENA por REE. Os Submódulos 2.4, 4.3 e 4.5 dos Procedimentos de Rede, lidos para o módulo PLD, não contêm o termo (conferido de novo em 07/10/2026 nos PDFs de mesmo sha256); os demais submódulos e o glossário do ONS não foram lidos, e a composição de cada REE em usinas não está no verbete. O selo do REE traz a ressalva "sem definição formal nas fontes consultadas". O relatório do GT de 2019 lista a correlação espacial mensal entre REE entre os aprimoramentos em desenvolvimento sob consulta pública; o verbete a trata assim, sem afirmar que esteja em uso.
* **Constrained-off**: o texto compilado da REN ANEEL nº 1.030/2022 (arts. 13 a 16 e 18 para eólicas; arts. 20-A a 20-D e 20-F para fotovoltaicas) define o evento (redução da produção por comando do ONS, de origem externa à usina, com as instalações externas enumeradas), as três razões, a geração de referência (só para a indisponibilidade externa), o pagamento por ESS (só para essa razão, em eventos a partir de 1º de outubro de 2021 nas eólicas e de 1º de abril de 2024 nas fotovoltaicas, e só depois de 78 horas acumuladas no ano nas eólicas e de 30 horas e 30 minutos nas fotovoltaicas) e a valoração ao PLD. Os eventos anteriores a esses marcos seguem regras próprias (arts. 19 e 20-G). A primeira redação do verbete, no commit `3665932fb`, omitia os marcos de vigência; corrigida depois, na auditoria própria. A primeira versão do verbete (commit `3665932fb`) citava a nota técnica da EPE que reproduz a definição; a revisão adversarial mostrou que a norma era recuperável pelo mesmo canal que o módulo Regulação já usa, o Internet Archive em modo `id_` (o endereço oficial da ANEEL responde 403 e não foi contornado), e o verbete passou a citar a REN. A cópia vale até 08/01/2025; alterações posteriores não estão cobertas. A nota da EPE ficou só como fonte do pedido do MME sobre a garantia física.

Revisados sem nova conferência de definição: MCP (o "como é medido" passou a dizer que o resumo mensal e a liquidação estão integrados no Mercado) e CVU (unidade R$/MWh do dicionário de dados versão 2.0, de 24/09/2025, lido na integração da Geração; o conjunto está integrado no despacho térmico). Os dois mostram "revisado em 06/10/2026".

## 3. Método

### 3.1 Verbete (P065)

* **Ordem dos campos**: Em uma frase (com "Em palavras simples" antes do texto da fonte, quando o verbete tem), Exemplo (real ou sintético), Por que importa, Como é medido (com a unidade ao fim e, em constrained-off e GSF, um resumo aberto e o detalhe técnico recolhido), Não confundir com, Relações (com uma frase por relação em GSF, constrained-off e REE), Nas trilhas, Fonte oficial, O que não se pode concluir, Veja no painel (só o que o exemplo ainda não ofereceu). O exemplo vem logo depois da definição para que o leitor veja o número antes de ler a explicação; o teste fixa essa ordem em todo verbete conferido.
* **Unidade** (`complementos.ts`, `UNIDADE`; mostrada no fim de Como é medido): a unidade em que a grandeza é publicada e lida no observatório, tirada do "como é medido" conferido ou da evidência publicada; verbete que não é grandeza (SIN, submercado, modelos, MRE, conjunto elétrico, agenda) não tem.
* **Não confundir com** (`CONTRASTES`, 41 pares): cada texto usa só o que os dois verbetes conferidos dizem; quatro pares de vizinhos (MRE e GSF, GSF e garantia física, MRE e garantia física, REE e EAR) têm uma versão curta no verbete do segundo lado, para o mesmo parágrafo não aparecer duas vezes. Só liga verbetes conferidos (um contraste também define); quando o termo confundido não é verbete (município, família, fator marginal, norma publicada), entra pelo rótulo. Todo verbete conferido tem ao menos um contraste.
* **Exemplo real**: uma só regra para verbete e trilha (`provas.ts`). O cartão traz a fonte à vista ("Fonte: órgão, conjunto, capturada em dd/mm/aaaa") sob o recorte, além da ficha Comprove. Com ficha publicada por um painel (`evidencias-verbetes.ts`, 28 verbetes, incluindo PLD e EAR, que passaram a ter ficha em 08/10/2026), o cartão mostra o valor exatamente como o painel o exibe, a base do percentual quando o valor não a traz, o recorte, a natureza que o próprio painel declara, a ficha "Comprove este número" e o link ao painel; sem ficha, o exemplo em texto lido da gold (`exemplos.ts`, 19 verbetes), no mesmo cartão, com o aviso de que o exemplo não tem ficha Comprove própria e a legenda visível do selo de natureza. O MRE tem exemplo próprio em texto (geração conjunta das usinas e garantia física do mês) e não repete o cartão do GSF. O custo de disponibilidade, sem número publicado, tem exemplo sintético rotulado.
* **Datas**: "conferido na fonte primária em" no topo e "Documentos acessados e texto conferido em" junto da fonte; `revisadoEm` quando o texto mudou depois.
* **Ressalva** (`ressalva` no verbete): quando a fonte que define o termo não foi lida ou não existe, o selo "conferido na fonte primária" ganha, ao lado, "◐ com ressalva" e o motivo, e o índice conta quantos verbetes têm ressalva (GSF e REE). Foi o achado de maior alcance do auditor de fonte: o selo e a frase "os 48 verbetes estão conferidos" diziam mais do que as limitações dos verbetes provavam.
* **Fonte oficial**: órgão e documento, a paráfrase "Em outras palavras" à vista e o trecho literal num bloco recolhível ("Trecho literal do documento"), que abre sozinho na impressão. As siglas do texto principal que o texto não expande entram numa linha "Siglas:" abaixo do selo.
* **Complemento do exemplo** (`COMPLEMENTO_EXEMPLO` em `evidencias-verbetes.ts`): frase lida da mesma gold do painel e do mesmo mês ou período da ficha. No GSF, os termos da conta (geração, garantia física modulada e ajustada, e o resultado com a sazonalizada); no constrained-off, a taxa e a decomposição por razão.
* **Pendente**: sem definição, contraste, unidade nem exemplo; não indexado; mostra a fonte planejada e o que já foi consultado. Em 07/10/2026 nenhum verbete está pendente; a regra e o teste continuam valendo para o próximo que surgir.

### 3.2 Trilhas (P066)

`trilhas.ts` define os passos; cada um tem verbetes, texto, prova (ficha de um painel ou o exemplo do verbete) e a ligação com o seguinte. Os tipos de ligação são os do mapa do setor (`TIPOS_LIGACAO` em `mapa.ts`): água → operação → preço usa fluxo físico, decisão de operação (duas vezes) e regra de mercado (duas vezes); custo → tarifa → orçamento usa componente de custo (três vezes) e associação analítica (Tarifa Social e peso no orçamento vêm de fontes e anos diferentes e ficam lado a lado, sem causa).

Números de cada passo na publicação de 06/10/2026 (lidos das golds no build):

| Trilha | Passo | Número | Natureza | Período |
| --- | --- | --- | --- | --- |
| Água, operação e preço | Afluência | ENA bruta de 30 dias do SIN, 172,3% da MLT | Calculado | 31/08 a 29/09/2026 |
| | Armazenamento | EAR do SIN, 61,5% da EAR máxima | Calculado | 29/09/2026 |
| | Operação | Geração térmica despachada, 8.033 MWmed | Calculado | 09/2025 a 08/2026 |
| | CMO | CMO médio do DESSEM no Sudeste/Centro-Oeste, R$ 63,31/MWh | Calculado | semana operativa de 19 a 25/09/2026 |
| | PLD | PLD horário do Sudeste/Centro-Oeste de R$ 57,31 a R$ 577,20/MWh; média das 24 horas R$ 135,25/MWh | Observado; Calculado | 30/09/2026 |
| | Mercado | Fator de ajuste do MRE (GSF), 78,9% | Calculado | 08/2026 |
| Custo, tarifa e orçamento | Custos | Taxa de perdas totais na distribuição, 14,7% da energia injetada | Calculado | 2025 |
| | Tarifa | Tarifa B1 residencial mediana, R$ 0,8212/kWh | Calculado | vigente em 30/09/2026 |
| | Bandeira | Amarela, R$ 0,01885/kWh | Observado | 09/2026 |
| | Tarifa Social | 17.246.524 unidades consumidoras | Observado | 05/2025 |
| | Orçamento | Peso da energia no orçamento das famílias de menor rendimento, 6,9% | Estimado | POF 2017-2018 |

### 3.3 Exemplos sintéticos

`AprendaSimulacao.tsx`: "Do CMO ao PLD e à liquidação da diferença" (CMO hipotético limitado por piso de R$ 60/MWh e teto horário de R$ 1.600/MWh, também hipotéticos; diferença entre consumido e contratado liquidada ao preço da hora) e "Da tarifa à conta e ao peso no orçamento" (consumo, tarifa hipotética, bandeira hipotética e renda; conta sem tributos e peso no orçamento). Regras: rótulo "Exemplo sintético" e o aviso "Valores hipotéticos, escolhidos para ensinar. Não são dados do observatório e não entram em nenhum indicador" no topo do quadro e "sintético" ao lado de cada resultado; sem selo de natureza; estado só local (sem URL, sem telemetria, sem leitura de gold); valores de partida redondos e diferentes dos vigentes. O texto de cada quadro diz o que a conta deixa de fora.

### 3.4 Volta ao contexto

Os links do Aprenda para os painéis levam `?volta=trilha:<id>:<passo>` ou `?volta=verbete:<slug>` antes da âncora. `RetornoContexto` (no cabeçalho de todas as páginas do observatório) transforma o parâmetro num botão fixo "Voltar à trilha …, passo n" ou "Voltar ao verbete …", tira o parâmetro da URL (o link copiado do painel fica limpo) e guarda o destino na sessão do navegador só para aquela página, para o botão sobreviver à troca de modo e de recorte. Em outra página, o botão não aparece; sem sessão disponível, vale só o parâmetro. O cabeçalho recebe só os nomes curtos dos verbetes e das trilhas (menos de 2 KB).

## 4. Evidências de aceite

* `src/tests/energia-aprenda.test.ts` (26 testes): sha256 das capturas de todas as pastas e trechos literais (inclusive os de GSF, REE e constrained-off e a conta 42.500 ÷ 52.788 = 80,51%); temas pedidos conferidos; todo conferido com data, contraste e exemplo; nenhum pendente (e, se voltar a haver, sem definição e com o que foi consultado); contrastes só entre conferidos, sem par repetido e sem travessão; cada ficha resolve na gold e aponta painel existente; exemplo que muda com o número; páginas dos 48 verbetes, das trilhas e do índice sem valor de reserva, sem data crua e leves; passos com âncora, prova e link com volta; ligações com o traço do tipo; quadro sintético com rótulo, sem selo e sem ficha; simulador sem URL, gold ou telemetria; regras do botão de volta; e, com o build presente, todo link do Aprenda com rota e âncora pré-renderizadas.
* `energia-mercado-pagina.test.ts`: ACR, ACL, garantia física e ESS conferidos no Decreto; GSF conferido nos documentos do MME. `dois-observatorios.test.ts`: todo verbete conferido está no sitemap e nenhum pendente entra.
* Build: HTML pré-renderizado de 174 KB (índice do Aprenda), 107 KB (índice das trilhas), 183 KB e 176 KB (trilhas) e até 133 KB por verbete.
* Navegador (Chromium, laboratório): 72 combinações de página, largura (360, 390, 768 e 1440 px) e modo (Entender e Auditar) sem violação axe e sem rolagem horizontal; único erro de console é o `favicon.ico` do site (404, anterior). Simulador conferido (CMO acima do teto vira o teto; consumo abaixo do contratado vira sobra vendida). Volta conferida em 390 e 1440 px: o painel abre na âncora, o botão continua após trocar o modo e recarregar, leva ao passo exato da trilha ou ao exemplo do verbete, some em outra página e volta com o histórico.
* Achado e corrigido: a âncora `#ena` da página Água e clima não existe mais (a ENA está em `/agua-e-clima/afluencia#p018`); estava no exemplo e nos verbetes ENA e MLT, na página do PLD, no conteúdo do PLD e no catálogo de dados.

## 5. Limitações e o que não se pode concluir

* O GSF é descrito como os documentos do MME o usam; a definição regulatória (Regras de Comercialização da CCEE e regulamentação da ANEEL) não foi acessada, e os denominadores variam entre fontes.
* O REE não tem definição formal nas fontes consultadas; vale a descrição da EPE, e a composição de cada REE não está publicada no verbete.
* O constrained-off vale para usinas eolioelétricas, pela citação da REN ANEEL nº 1.030/2022 na nota da EPE; o original da REN e a norma das fotovoltaicas não foram lidos.
* As trilhas explicam relações; não somam fontes nem afirmam causa. Os números de cada passo têm períodos diferentes, e cada cartão diz o seu.
* A liquidação sintética ignora perfis de agente, perdas, encargos, garantias e o teto estrutural; serve para a ideia de liquidar a diferença ao preço, não para estimar resultado de agente.
* O peso no orçamento medido vem da POF 2017-2018, anterior às regras atuais da Tarifa Social e às tarifas vigentes.

## 6. Inventário dos verbetes (publicação de 07/10/2026)

| Verbete | Grupo | Conferido em | Unidade | Exemplo | Contrastes | Órgãos das fontes |
| --- | --- | --- | --- | --- | --- | --- |
| PLD (`pld`) | Preço | 28/09/2026 (revisado em 07/10/2026) | sim | ficha publicada | 4 | CCEE, ONS, ANEEL |
| MCP (`mcp`) | Mercado | 28/09/2026 (revisado em 07/10/2026) | sim | texto da gold | 1 | ANEEL, CCEE |
| CMO (`cmo`) | Preço | 28/09/2026 | sim | texto da gold | 2 | ONS, CCEE |
| Submercado (`submercado`) | Preço | 28/09/2026 | não é grandeza | texto da gold | 1 | CCEE |
| SIN (`sin`) | Operação | 28/09/2026 | não é grandeza | texto da gold | 1 | CCEE |
| CVU (`cvu`) | Preço | 28/09/2026 (revisado em 06/10/2026) | sim | texto da gold | 1 | ONS |
| EAR (`ear`) | Água | 28/09/2026 | sim | ficha publicada | 3 | ONS |
| Capacidade de armazenamento (EAR máxima) (`armazenamento`) | Água | 28/09/2026 | sim | ficha publicada | 1 | ONS |
| ENA (`ena`) | Água | 28/09/2026 | sim | texto da gold | 2 | ONS |
| MLT (`mlt`) | Água | 28/09/2026 | não é grandeza | texto da gold | 1 | ONS |
| REE (`ree`) | Água | 07/10/2026 (com ressalva) | não é grandeza | texto da gold | 2 | EPE, MME, ONS |
| Carga de energia (`carga`) | Operação | 01/10/2026 | sim | texto da gold | 2 | ONS |
| Geração verificada (`geracao-centralizada`) | Operação | 28/09/2026 | sim | texto da gold | 4 | ONS |
| MMGD (`geracao-distribuida`) | Transição | 01/10/2026 | sim | ficha (observado) | 1 | ANEEL, ONS |
| Intercâmbio entre subsistemas (`intercambio`) | Operação | 30/09/2026 | sim | texto da gold | 2 | ONS |
| Constrained-off (`constrained-off`) | Operação | 07/10/2026 | sim | ficha (estimado) | 2 | ANEEL, MME e EPE, ONS |
| NEWAVE (`newave`) | Modelos | 27/09/2026 | não é grandeza | texto da gold | 1 | CCEE, ONS |
| DECOMP (`decomp`) | Modelos | 28/09/2026 | não é grandeza | texto da gold | 2 | ONS, CCEE |
| DESSEM (`dessem`) | Modelos | 28/09/2026 | não é grandeza | ficha (calculado) | 1 | ONS, CCEE |
| ACL (`acl`) | Mercado | 06/10/2026 | sim | ficha (calculado) | 2 | Presidência da República |
| ACR (`acr`) | Mercado | 06/10/2026 | sim | texto da gold | 1 | Presidência da República |
| MRE (`mre`) | Mercado | 06/10/2026 | não é grandeza | texto da gold | 2 | CCEE |
| GSF (`gsf`) | Mercado | 07/10/2026 (com ressalva) | sim | ficha (calculado) | 2 | MME |
| ESS (`ess`) | Mercado | 06/10/2026 | sim | ficha (calculado) | 2 | Presidência da República |
| Garantia física (`garantia-fisica`) | Mercado | 06/10/2026 | sim | texto da gold | 3 | Presidência da República |
| IMERG (`imerg`) | Água | 01/10/2026 | sim | ficha (estimado) | 1 | NASA (Langley Research Center), projeto POWER |
| MERRA-2 (`merra-2`) | Água | 01/10/2026 | sim | ficha (estimado) | 1 | NASA (Langley Research Center), projeto POWER |
| Curva de carga horária (`curva-de-carga`) | Operação | 01/10/2026 | sim | ficha (observado) | 2 | ONS |
| Carga global (carga verificada) (`carga-global`) | Operação | 01/10/2026 | sim | ficha (estimado) | 2 | ONS |
| Carga global líquida de MMGD (`carga-liquida-de-mmgd`) | Operação | 01/10/2026 | sim | ficha (estimado) | 1 | ONS |
| Intercâmbio com outros países (`intercambio-internacional`) | Operação | 30/09/2026 | sim | ficha (calculado) | 1 | ONS |
| ATLS (`atls`) | Operação | 30/09/2026 | sim | ficha (calculado) | 1 | ONS |
| TE e TUSD (`tarifa-te-tusd`) | Consumidor | 30/09/2026 | sim | ficha (calculado) | 3 | ANEEL |
| Bandeira tarifária (`bandeira-tarifaria`) | Consumidor | 30/09/2026 | sim | ficha (observado) | 1 | ANEEL |
| Custo de disponibilidade (`custo-de-disponibilidade`) | Consumidor | 30/09/2026 | sim | sintético rotulado | 1 | ANEEL |
| CDE (`cde`) | Consumidor | 30/09/2026 | sim | ficha (calculado) | 2 | ANEEL |
| Perdas de energia (`perdas-de-energia`) | Qualidade e perdas | 30/09/2026 | sim | ficha (observado) | 1 | ANEEL |
| Perdas técnicas (`perdas-tecnicas`) | Qualidade e perdas | 30/09/2026 | sim | texto da gold | 1 | ANEEL |
| Perdas não técnicas (`perdas-nao-tecnicas`) | Qualidade e perdas | 30/09/2026 | sim | ficha (estimado) | 1 | ANEEL |
| Percentual regulatório de perdas (`percentual-regulatorio-de-perdas`) | Qualidade e perdas | 30/09/2026 | sim | texto da gold | 1 | ANEEL |
| DEC (`dec`) | Qualidade e perdas | 30/09/2026 | sim | ficha (calculado) | 2 | ANEEL |
| FEC (`fec`) | Qualidade e perdas | 30/09/2026 | sim | ficha (calculado) | 1 | ANEEL |
| Conjunto de unidades consumidoras (conjunto elétrico) (`conjunto-eletrico`) | Qualidade e perdas | 30/09/2026 | não é grandeza | ficha (calculado) | 1 | ANEEL |
| Compensação por violação de limite de continuidade (`compensacao-continuidade`) | Qualidade e perdas | 30/09/2026 | sim | ficha (calculado) | 1 | ANEEL |
| TSEE (`tarifa-social`) | Inclusão | 30/09/2026 | sim | ficha (observado) | 2 | ANEEL |
| Fator de emissão de CO2 da energia elétrica (`fator-de-emissao`) | Transição | 01/10/2026 | sim | ficha (estimado) | 1 | MCTI |
| Limites do PLD (piso, teto estrutural e teto horário) (`limites-do-pld`) | Preço | 30/09/2026 | sim | ficha (observado) | 1 | ANEEL |
| Agenda Regulatória da ANEEL (`agenda-regulatoria`) | Regulação | 30/09/2026 | não é grandeza | texto da gold | 1 | ANEEL |

## 7. Revisão adversarial da interface (07/10/2026)

Três revisores independentes, cada um em contexto limpo e com uma lente, sobre o site construído a partir do commit `3665932fb`: **leitor não especialista** (38 achados), **auditor de fonte e de risco** (26) e **interface e acessibilidade** (20). Eles exercitaram 52 páginas em 390 e 1440 px, conferiram os trechos contra os PDFs originais e testaram o fluxo de volta, os simuladores, o teclado, o axe, a impressão e a navegação sem JavaScript. Registro por achado (severidade, página, categoria e estado) em `docs/observatorios/energia/avaliacao/revisao_aprenda.json`.

**Resultado.** 84 achados, nenhum bloqueante: 49 corrigidos, 5 parciais e 30 abertos (47, 5 e 32 na entrega da revisão; L-18 e L-27 foram corrigidos depois, por decisão de desenho, descrita abaixo). Dois de severidade alta seguem parciais (L-06, definição regulatória de constrained-off ainda como frase de abertura, e L-26, índice de 14 telas a 390 px). Notas dos revisores antes da correção (0 a 10, de agentes, não de leitores reais): fidelidade literal dos trechos 9,0; fidelidade das paráfrases 6,0; afirmações além do trecho 5,5; didatismo do leitor 5; jargão e siglas 4; ordem e leveza a 390 px 4; interface: layout 9,5, contraste 9,5, alvos de toque 6,5, impressão 3.

**Evidência que se confirmou.** Os 14 trechos de GSF, REE e constrained-off existem literalmente nos originais e os sha256 batem; a conta do boletim (42.500 ÷ 52.788 = 80,51%) e os exemplos reais (78,9%, 28.923 GWh, 12 REE, PLD de 30/09) batem com a gold e com os painéis; nenhuma rolagem horizontal, nenhum erro de console, nenhuma violação axe no nível de página e nenhuma falha de contraste; 165 de 166 links internos respondem 200 e todas as âncoras existem; o fluxo de volta funciona nos 48 verbetes e nos 11 passos de trilha.

**Corrigido nesta rodada** (por impacto):

* Paráfrase que invertia o estado do fato (REE: correlação espacial mensal, que o relatório lista como aprimoramento em desenvolvimento) e atribuições imprecisas (o GT é coordenado pela CCEE).
* Constrained-off lido na norma (REN ANEEL nº 1.030/2022, via Internet Archive), com as três razões, o limite de horas e o pagamento por ESS no corpo do verbete, e a decomposição por razão no exemplo; o escopo "razão de indisponibilidade externa" que a paráfrase omitia voltou.
* GSF com o nome em português no título, a conta do mês no exemplo, os três denominadores descritos com precisão (sazonalizada, modulada, ajustada pela disponibilidade) e o efeito medido no mesmo mês, o motivo do relatório do GT ("abaixo de 90% desde 2014, exposição a PLD elevado") e a equivalência "fator de ajuste do MRE, conhecido como GSF" no trecho do relatório; MRE sem "como é medido" próprio e sem inferência causal sobre o despacho centralizado.
* PLD e MCP deixaram de ser circulares: a REN nº 957/2021 (art. 2º, XIII, e art. 5º, § 4º) define o MCP como a contabilização e liquidação das diferenças entre energia contratada e verificada, com as exposições valoradas ao PLD.
* Selo com ressalva e índice com a contagem (F03 do auditor), legenda de siglas em cada verbete (L-04 e L-05), trecho literal recolhível, texto de bastidor ("nesta fase", "pendente") reescrito como limite para o leitor, URL de arquivo e sha256 fora do texto de link em Limites do PLD, resposta curta no resumo da trilha de água.
* Interface: barra de volta que cobria o foco por teclado (WCAG 2.4.11), impressão (menu e rodapés ocultos, endereços dos links, trechos abertos), alvos de toque de "Veja no portal", lista com `role="region"` no diálogo Comprove, âncoras do índice, rótulo "Exemplo sintético", espaço antes da pontuação, `aria-label` sem papel e landmark do breadcrumb.

**Auditoria própria depois da revisão (07/10/2026, mesmo dia).** Reler o que eu tinha entregue achou erros que a revisão não pegou ou que eu mesmo introduzi:

* O pagamento por ESS do constrained-off vale só para eventos a partir de 1º de outubro de 2021 (eólicas) e de 1º de abril de 2024 (fotovoltaicas), arts. 18 e 20-F; a redação anterior omitia o marco. A captura da REN subiu para as páginas 10 a 18.
* A limitação do REE dizia que só o Submódulo 2.4 dos Procedimentos de Rede foi lido; os três que o módulo PLD leu (2.4, 4.3 e 4.5) foram conferidos de novo e nenhum contém o termo.
* Documentação com erro: uma hora do dia inventada ("pela manhã") para o commit do verbete e a contagem de trechos do GT do MRE (seis, não sete). A observação da jornada 5, no relatório da avaliação, ainda dizia "45 de 48 verbetes conferidos"; as dez jornadas foram executadas de novo no build corrigido (todas cumpridas, mesmas contagens de passos e interações) e o texto agora diz 48 de 48.
* ACR e garantia física citavam o art. 2º do Decreto 5.163 no "por que importa" sem exibir os incisos; passaram a exibi-los. O trecho do MCP sinaliza o corte, a seta do link não fica mais sozinha na linha e o `aria-live` do simulador cobre o rótulo "sintético".
* A falha que eu vinha chamando de preexistente no teste de reauditoria era real: datas ISO cruas em dez páginas de outros módulos. Corrigidas com `datasLegiveis` (movida para `formato.ts` e endurecida) nos pontos de renderização. Na primeira tentativa, aplicar a conversão às células de texto da tabela interativa transformou "33.541.368/0001-86" em "33.541.368/undefined/0001" na página de ativos, porque o "0001-86" do CNPJ casava com AAAA-MM; o próprio teste pegou, e a conversão passou a exigir data válida (ano de quatro dígitos sem zero à esquerda, mês 01 a 12, dia 01 a 31), com teste permanente. Território, que está no limite de 600 KB, usa uma conversão de mesmo tamanho (mês numérico).
* O trecho literal de linha da fonte na Regulação ("2017-11;Vermelha P2;50,00") ficou em `<code>`, e o teste de reauditoria não o trata como prosa; essa é a única relaxação do teste, e o motivo está no comentário dele.

Segue como falha conhecida só `test_energia_carga`, que exige um arquivo do bronze que este ambiente não tem (o bronze não é versionado), e não um defeito de código.

**Decisões de desenho aplicadas (07/10/2026).** (1) Ordem do verbete: o exemplo, real ou sintético, passou a vir logo depois de "Em uma frase" e antes de "Por que importa" (achado L-18, o exemplo ficava a 1,5 a 2 telas do topo). A âncora `#exemplo` e os links de volta não mudam. (2) Título do índice (achado L-27): o título vinha do mapa do setor ("Como funciona o sistema elétrico brasileiro, conceito a conceito?") e prometia mais do que 48 verbetes entregam. Passou a ser "O que significam os conceitos e como se ligam aos números?", que reúne as perguntas de P065 e P066 e dispensa "do setor elétrico" para caber no teto de 600 KB da página Território, que carrega a pergunta no menu e fica em 599.995 caracteres contra o teto de 600.000, igual no título da página, no mapa (`PAGINAS_MAPA.aprenda`), no menu (`DESTINOS_NAVEGACAO`) e no quadro da especificação; o título das trilhas ganhou o "?". O lede do índice declara o escopo: os conceitos que aparecem nos painéis do observatório, não todo o vocabulário do setor. Testes novos em `energia-aprenda.test.ts` cobrem a ordem em todos os verbetes conferidos e a igualdade entre título, mapa e menu. Medido no build local de 07/10/2026 (Chromium headless, axe-core): o bloco do exemplo começa a 0,96 a 1,14 tela do topo a 390 px (GSF 1,02; constrained-off 0,98; REE 0,96; PLD 1,14) e a 0,64 a 0,72 tela a 1440 px, contra 1,5 a 2 telas antes; axe sem violações e sem rolagem horizontal no índice, nas trilhas e nesses quatro verbetes. A avaliação página a página da rodada r5 mediu o layout e o título anteriores e não foi remedida; a jornada 5 foi refeita e registra o título novo.

**Aberto, para a próxima rodada ou decisão do responsável:** bloco "Fontes deste observatório" repetido em toda página; explicação do selo de natureza só em `title`; busca ou filtro no índice; versão do código "+alterado" nas fichas de prova (pipeline: gerar só de árvore limpa); painel de Mercado com afirmações sobre o risco hidrológico que os verbetes não conferem; legibilidade do corpo pequeno e prefetch (945 KB de "outros" a 390 px); texto cortado na segunda linha do cabeçalho global em celular.

### Fechamento dos achados abertos (08/10/2026, rodada r7)

Os 35 achados que a entrega de 07/10/2026 deixou abertos (30) ou parciais (5) foram retomados: **73 dos 84 ficam corrigidos, 11 parciais e nenhum aberto** (`avaliacao/revisao_aprenda.json`, com a nota de cada um). Dos 11 parciais, um é de severidade alta (L-26, o índice) e a razão de cada um está na nota. Corrigiu-se o que dependia só do código e do texto do próprio Aprenda.

* **Verbete**: leitura em palavras simples antes do texto da fonte (constrained-off, REE); Como é medido em duas camadas (constrained-off, GSF); unidade fundida; legenda visível do selo de natureza; relações com uma frase (GSF, constrained-off, REE); contrastes sem o mesmo parágrafo nos dois lados (quatro pares); coluna de leitura de 44 rem; termo sem verbete na mesma caixa; um só termo e um só link por destino ("Veja no painel" deixa de repetir o destino do exemplo); páginas citadas com a numeração do documento e a do PDF, conferidas contra os marcadores de página das capturas; afirmações do constrained-off rotuladas como método do observatório; qualificador do GSF no boletim.
* **Exemplos**: PLD e EAR com ficha Comprove (o PLD é a média da mesma semana operativa do CMO do passo anterior da trilha); MRE com exemplo próprio; exemplo sem ficha no mesmo cartão; REE nomeia o REE sem armazenamento. Contagem em 08/10/2026: 28 verbetes com ficha, 19 com texto lido da gold e 1 sintético, num total de 48.
* **Índice**: busca por sigla, nome ou texto (`?q=`), 11 grupos recolhidos com a contagem (`#g-<grupo>` abre o grupo), grupo Fontes de dados (IMERG e MERRA-2) e abertura de duas frases; a explicação de como ler um verbete foi para o fim da página.
* **Trilhas**: passo 5 com o PLD da mesma semana do CMO e cartão Comprove; exemplo sintético logo depois do passo que ele explica, com enunciado e dica; rótulos de bandeira hipotéticos; legenda dos cinco tipos de ligação só em cada trilha; títulos de seção na hierarquia dos passos; controles do exemplo desligados e botão Comprove escondido sem JavaScript.
* **Cromo e painel de Mercado**: fontes do observatório recolhidas; faixa de módulos sem item cortado (a lista não rola quando o atual cabe e ganha o respiro que falta quando não cabe) e sem pré carga das páginas; nota da ficha sobre o código com alterações locais; painel de Mercado MRE e GSF sem afirmar o repasse do risco ao consumidor cativo e com as definições operacionais rotuladas como não conferidas em norma.
* **Medição** (Chromium headless, build de 08/10/2026): 24 combinações de página e largura sem violação axe, sem rolagem horizontal e sem erro de console; índice de 14.499 para 3.488 px a 390 px e de 7.299 para 2.296 px a 1440 px; bytes de outros tipos, em média, de 1.251 KB para 391 KB nas 12 páginas do Aprenda a 390 px. Os verbetes ficaram um pouco mais altos a 1440 px (GSF de 4.394 para 4.681 px, PLD de 3.638 para 4.059 px).
* **O que segue parcial e por quê**: PLD e EAR têm ficha, mas o REE não (a gold não publica ficha para a EAR por REE: L-11, F08); só três verbetes têm frase por relação (L-23); a definição curta de cada verbete do índice exigiria texto novo conferido (L-26); MLT, NEWAVE, DESSEM, CVU e carga global líquida seguem com a definição circular ou incompleta da fonte, que não foi lida (L-28); a proporção da térmica sobre o total não foi acrescentada (L-32); DECOMP e DESSEM não têm nome por extenso conferido para a legenda de siglas (L-33); o título do painel de Mercado vem da gold e mudar exige regenerá-la, sem o bronze (F19); o pipeline ainda não impede publicar de árvore suja (F21); a linha Siglas e algumas legendas seguem em 12 px (F15); o rodapé institucional da plataforma, compartilhado, ficou como está (F17).
* **Não medido**: o efeito sobre as notas de didatismo e de qualidade visual. Não houve nova rodada com revisores; a r6 mediu o layout anterior.
