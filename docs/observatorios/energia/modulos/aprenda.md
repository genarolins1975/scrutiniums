# Módulo Aprenda (P065, P066)

Documento do módulo Aprenda (rotas `/setor-eletrico/aprenda`, `/setor-eletrico/aprenda/<verbete>`, `/setor-eletrico/aprenda/trilhas` e `/setor-eletrico/aprenda/trilhas/<trilha>`). Estado em 06/10/2026 (Brasília): glossário com 48 verbetes, 45 conferidos na fonte primária e 3 em preparação; duas trilhas que ligam conceitos a números publicados. O Aprenda não tem gold própria: lê as golds e as séries de evidência dos módulos temáticos no build.

## 1. Painéis e estado

| Painel | Entregue | Estado |
| --- | --- | --- |
| P065 Glossário completo | Cada verbete conferido traz definição em uma frase, por que importa, como é medido, unidade (quando é grandeza), exemplo real ligado ao painel onde o número aparece, "não confundir com", relações, nas trilhas, fonte oficial com trecho literal, data de conferência (e de revisão, quando posterior) e o que não se pode concluir. Das oito pendências do inventário, cinco foram conferidas (MRE no Mercado; ACR, ACL, garantia física e ESS no Decreto nº 5.163/2004) e três seguem em preparação, com o que foi consultado e o que falta. Os temas pedidos (tarifa, perdas, DEC e FEC, inclusão e emissões) já estavam conferidos pelos módulos e ganharam unidade, contraste e exemplo | Concluído com limitação declarada: GSF, REE e constrained-off sem definição publicada |
| P066 Trilhas e exemplos | Duas trilhas: água → operação → preço (seis passos) e custo → tarifa → orçamento (cinco passos). Cada passo tem verbetes conferidos, texto escrito só com o que eles dizem, um número real com a ficha de prova e o link ao painel, e a ligação tipificada com o passo seguinte (fluxo físico, decisão de operação, regra de mercado, componente de custo, associação analítica), desenhada com o traço do tipo, como no mapa conceitual da página inicial. Exemplo sintético interativo em cada trilha, com rótulo permanente. Do painel, um botão traz o leitor de volta ao passo da trilha ou ao exemplo do verbete | Concluído com limitação declarada: a liquidação sintética é simplificação pedagógica (Regras de Comercialização da CCEE não conferidas); o peso no orçamento vem da POF 2017-2018 |

Revisão adversarial da interface pendente, como nas demais páginas da Fase 2.

## 2. Fontes primárias conferidas neste ciclo (06/10/2026)

| Documento | Endereço | Captura versionada | Verbetes |
| --- | --- | --- | --- |
| Decreto nº 5.163, de 30 de julho de 2004, texto compilado do Planalto (redação vigente em 06/10/2026) | https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/decreto/d5163.htm | `pipeline/energia/seed/documentos_aprenda/v20261006T212851Z/decreto_5163_2004_trechos.txt` (capturado às 21h28 UTC; sha256 do HTML original e do recorte no `MANIFESTO.json`) | ACR e ACL (art. 1º, § 2º, incisos I e II), garantia física (art. 2º, §§ 1º a 3º), ESS (art. 59, caput e incisos I a III) |
| CCEE, InfoMercado mensal Nº 229 (julho de 2026), página 12 | coleta autorizada do Mercado | `infomercado_229_p12.txt` (texto da página extraído com pdftotext; sha256 do PDF e do texto) | MRE (glossário) |

O recorte do Decreto remove só o texto riscado (redação revogada) e as marcas HTML; o teste `energia-aprenda.test.ts` confere o sha256 de cada captura e que todo trecho citado aparece nela literalmente, a menos de espaços.

Consultados sem definição (registrado no verbete):

* **GSF**: Decreto nº 5.163/2004, Lei nº 10.848/2004 (baixada do Planalto em 06/10/2026) e glossário do InfoMercado Nº 229, que usa "fator de ajuste do MRE" sem defini-lo. A definição está nas Regras de Comercialização da CCEE, fora do escopo autorizado de coleta (conjuntos abertos e InfoMercado).
* **REE**: dicionário de dados do conjunto EAR Diário por REE do ONS, que usa o termo sem defini-lo. Fonte planejada: Procedimentos de Rede e documentação dos modelos.
* **Constrained-off**: descrição e dicionário do conjunto de restrição de eólicas do ONS (descrevem a apuração e as razões, não o termo). Fonte planejada: regulamentação da ANEEL e rotina operacional RO-AO.BR.13 do ONS.

Revisados sem nova conferência de definição: MCP (o "como é medido" passou a dizer que o resumo mensal e a liquidação estão integrados no Mercado) e CVU (unidade R$/MWh do dicionário de dados versão 2.0, de 24/09/2025, lido na integração da Geração; o conjunto está integrado no despacho térmico). Os dois mostram "revisado em 06/10/2026".

## 3. Método

### 3.1 Verbete (P065)

* **Unidade** (`complementos.ts`, `UNIDADE`): a unidade em que a grandeza é publicada e lida no observatório, tirada do "como é medido" conferido ou da evidência publicada; verbete que não é grandeza (SIN, submercado, modelos, MRE, conjunto elétrico, agenda) não tem.
* **Não confundir com** (`CONTRASTES`, 34 pares): cada texto usa só o que os dois verbetes conferidos dizem. Só liga verbetes conferidos (um contraste também define); quando o termo confundido não é verbete (município, família, fator marginal, norma publicada), entra pelo rótulo. Todo verbete conferido tem ao menos um contraste.
* **Exemplo real**: uma só regra para verbete e trilha (`provas.ts`). Com ficha publicada por um painel (`evidencias-verbetes.ts`, 24 verbetes), o cartão mostra o valor exatamente como o painel o exibe, a base do percentual quando o valor não a traz, o recorte, a natureza que o próprio painel declara, a ficha "Comprove este número" e o link ao painel; sem ficha, o exemplo em texto lido da gold (`exemplos.ts`, 20 verbetes, oito acrescentados neste ciclo: CVU, NEWAVE, ACR, garantia física, perdas técnicas, percentual regulatório e agenda regulatória). O custo de disponibilidade, sem número publicado, tem exemplo sintético rotulado.
* **Datas**: "conferido na fonte primária em" no topo e "Documentos acessados e texto conferido em" junto da fonte; `revisadoEm` quando o texto mudou depois.
* **Pendente**: sem definição, contraste, unidade nem exemplo; não indexado; mostra a fonte planejada e o que já foi consultado.

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

* `src/tests/energia-aprenda.test.ts` (20 testes): sha256 das capturas e trechos literais; temas pedidos conferidos; todo conferido com data, contraste e exemplo; pendentes sem definição e com o que foi consultado; contrastes só entre conferidos, sem par repetido e sem travessão; cada ficha resolve na gold e aponta painel existente; exemplo que muda com o número; páginas dos 48 verbetes, das trilhas e do índice sem valor de reserva, sem data crua e leves; passos com âncora, prova e link com volta; ligações com o traço do tipo; quadro sintético com rótulo, sem selo e sem ficha; simulador sem URL, gold ou telemetria; regras do botão de volta; e, com o build presente, todo link do Aprenda com rota e âncora pré-renderizadas.
* `energia-mercado-pagina.test.ts`: ACR, ACL, garantia física e ESS conferidos no Decreto; GSF pendente.
* Build: HTML pré-renderizado de 174 KB (índice do Aprenda), 107 KB (índice das trilhas), 183 KB e 176 KB (trilhas) e até 133 KB por verbete.
* Navegador (Chromium, laboratório): 72 combinações de página, largura (360, 390, 768 e 1440 px) e modo (Entender e Auditar) sem violação axe e sem rolagem horizontal; único erro de console é o `favicon.ico` do site (404, anterior). Simulador conferido (CMO acima do teto vira o teto; consumo abaixo do contratado vira sobra vendida). Volta conferida em 390 e 1440 px: o painel abre na âncora, o botão continua após trocar o modo e recarregar, leva ao passo exato da trilha ou ao exemplo do verbete, some em outra página e volta com o histórico.
* Achado e corrigido: a âncora `#ena` da página Água e clima não existe mais (a ENA está em `/agua-e-clima/afluencia#p018`); estava no exemplo e nos verbetes ENA e MLT, na página do PLD, no conteúdo do PLD e no catálogo de dados.

## 5. Limitações e o que não se pode concluir

* GSF, REE e constrained-off seguem sem definição publicada; o GSF depende das Regras de Comercialização da CCEE.
* As trilhas explicam relações; não somam fontes nem afirmam causa. Os números de cada passo têm períodos diferentes, e cada cartão diz o seu.
* A liquidação sintética ignora perfis de agente, perdas, encargos, garantias e o teto estrutural; serve para a ideia de liquidar a diferença ao preço, não para estimar resultado de agente.
* O peso no orçamento medido vem da POF 2017-2018, anterior às regras atuais da Tarifa Social e às tarifas vigentes.

## 6. Inventário dos verbetes (publicação de 06/10/2026)

| Verbete | Grupo | Conferido em | Unidade | Exemplo | Contrastes | Órgãos das fontes |
| --- | --- | --- | --- | --- | --- | --- |
| PLD (`pld`) | Preço | 28/09/2026 | sim | texto da gold | 4 | CCEE, ONS, ANEEL |
| MCP (`mcp`) | Mercado | 28/09/2026 (revisado em 06/10/2026) | sim | texto da gold | 1 | CCEE |
| CMO (`cmo`) | Preço | 28/09/2026 | sim | texto da gold | 2 | ONS, CCEE |
| Submercado (`submercado`) | Preço | 28/09/2026 | não é grandeza | texto da gold | 1 | CCEE |
| SIN (`sin`) | Operação | 28/09/2026 | não é grandeza | texto da gold | 1 | CCEE |
| CVU (`cvu`) | Preço | 28/09/2026 (revisado em 06/10/2026) | sim | texto da gold | 1 | ONS |
| EAR (`ear`) | Água | 28/09/2026 | sim | texto da gold | 2 | ONS |
| Capacidade de armazenamento (EAR máxima) (`armazenamento`) | Água | 28/09/2026 | sim | texto da gold | 1 | ONS |
| ENA (`ena`) | Água | 28/09/2026 | sim | texto da gold | 2 | ONS |
| MLT (`mlt`) | Água | 28/09/2026 | não é grandeza | texto da gold | 1 | ONS |
| REE (`ree`) | Água | em preparação | não publicada | não publicado | não publicado | ver fonte planejada |
| Carga de energia (`carga`) | Operação | 01/10/2026 | sim | texto da gold | 2 | ONS |
| Geração verificada (`geracao-centralizada`) | Operação | 28/09/2026 | sim | texto da gold | 3 | ONS |
| MMGD (`geracao-distribuida`) | Transição | 01/10/2026 | sim | ficha (observado) | 1 | ANEEL, ONS |
| Intercâmbio entre subsistemas (`intercambio`) | Operação | 30/09/2026 | sim | texto da gold | 2 | ONS |
| Constrained-off (`constrained-off`) | Operação | em preparação | não publicada | não publicado | não publicado | ver fonte planejada |
| NEWAVE (`newave`) | Modelos | 27/09/2026 | não é grandeza | texto da gold | 1 | CCEE, ONS |
| DECOMP (`decomp`) | Modelos | 28/09/2026 | não é grandeza | texto da gold | 2 | ONS, CCEE |
| DESSEM (`dessem`) | Modelos | 28/09/2026 | não é grandeza | ficha (calculado) | 1 | ONS, CCEE |
| ACL (`acl`) | Mercado | 06/10/2026 | sim | ficha (calculado) | 2 | Presidência da República |
| ACR (`acr`) | Mercado | 06/10/2026 | sim | texto da gold | 1 | Presidência da República |
| MRE (`mre`) | Mercado | 06/10/2026 | não é grandeza | ficha (calculado) | 1 | CCEE |
| GSF (`gsf`) | Mercado | em preparação | não publicada | não publicado | não publicado | ver fonte planejada |
| ESS (`ess`) | Mercado | 06/10/2026 | sim | ficha (calculado) | 2 | Presidência da República |
| Garantia física (`garantia-fisica`) | Mercado | 06/10/2026 | sim | texto da gold | 2 | Presidência da República |
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
