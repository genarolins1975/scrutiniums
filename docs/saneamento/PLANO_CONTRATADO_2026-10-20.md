# Plano: "O que está contratado desde o novo marco legal" (Observatório do Saneamento)

Data: 20/10/2026. Estado: plano para decisão do dono; nenhuma página, gold ou pipeline foi criada. Implementação em PR próprio, depois deste documento aprovado e depois do merge do PR 305 (que altera `capitulos.ts`, a entrada, o aperitivo e `respostas.ts`).

## 1. Origem

Comentário de especialista recebido em 20/10/2026, em resumo: desde o novo marco (Lei 14.026/2020) seria preciso reunir todos os leilões realizados desde 2020 com valores; entrar nos cadernos de encargos e nas tabelas de metas dos contratos para montar as previsões de atendimento futuro; aferir o que está sendo cumprido ou não; e responder perguntas como "se tudo que foi contratado for executado, onde estaremos em 2033?" e "quanto falta para universalizar, descontado o que já está contratado?".

Decisões do dono em 20/10/2026: o tema é o Saneamento (não o Setor Elétrico); primeiro o plano em documento, depois PR próprio.

## 2. Evidência: o que a plataforma já tem

Inventário feito sobre a `main` de 20/10/2026 (ramo do PR 305 comparado à parte).

- Não existe capítulo, gold nem pipeline sobre leilões, lotes, outorga, investimento contratado ou metas contratuais por ano. Nenhuma ocorrência de "B3", "caderno de encargos", "ABCON", "Trata Brasil", "Plansab" ou "novo marco" em `src/`, `pipeline/` ou `docs/` do Saneamento.
- A pista mais próxima está na gold `public/saneamento/gold/uf/{UF}.json`, bloco `sinisa.prestadores[]`: instrumento (CAD2004/CAD2104), início e término do contrato declarados ao SINISA 2024 por município e prestador. Contagem sobre a gold: 3.905 vínculos "Contrato de Concessão", 2.110 "Contrato de Programa", 1.215 "Outro", 98 "Inexistente", 2.212 sem resposta; concessões com início de 2020 em diante: 14 (2020), 76 (2021), 201 (2022), 25 (2023), 768 (2024), 1 (2025), em 578 municípios. É autodeclaração do prestador, sem valor nem meta.
- Metas legais já estão em `meta.json` (`metas: {agua: 99, esgoto: 90, data: "2033-12-31", base_legal: Lei 11.445/2007, art. 11-B}`), e o capítulo 11 (`/saneamento/planejamento`) calcula o ritmo exigido até 2033 por UF e no laboratório `LabRitmoMeta` (`src/lib/saneamento/laboratorios.ts`), sempre sobre os indicadores da NR 8 aproximados (sem ICA e ICE), com a ressalva de que nenhum município é declarado em cumprimento.
- Investimento: `municipios.json` (`inv_ag`, `inv_es`, R$ correntes de 2024, prestador mais Estado) e `prestadores.json` (`investimento_*`). O PR 305 marca esses valores como "autodeclarado ao SINISA, sem conferência com demonstrações auditadas" e retira rankings por investimento.
- Estudo de caso já transcrito: Sabesp, Contrato de Concessão 01/2024 (URAE 1), em `src/lib/saneamento/dados/estudos.ts`: ICA 97% em 2026 e 99% a partir de 2027; ICE 90, 93, 96 e 99% de 2026 a 2029; IEC 85% em 2026 e 99% a partir de 2029; "sem aferição publicada". É o protótipo do que o capítulo faria em escala.
- O próprio observatório declara as lacunas: capítulo 9 ("As obras viram serviço?" indisponível; Transferegov, PAC e financiamentos não integrados), capítulo 10 (BNDES, CAIXA e Transferegov não conciliados com o SINISA), capítulo 12 ("contratos, fiscalizações e sanções dependem dos portais de cada regulador"), capítulo 5.4 ("aferições anuais das metas contratuais pelos reguladores não foram localizadas para 2026").
- Dívida e alavancagem dos prestadores (7.1, PR 305, não mergeado): DFP e ITR da CVM para 23 companhias, trimestral. Útil para a pergunta "quem financia o contratado", não para metas.

## 3. Evidência: o que existe fora da plataforma

Pesquisa de 20/10/2026. [V] conferido na página ou no arquivo; [S] só em trecho de busca ou fonte secundária. Três fontes centrais bloquearam acesso automatizado nesta sessão: ABCON SINDCON (403), Hub de Projetos do BNDES (aplicação só com JavaScript) e Agência BNDES de Notícias (acervo fora do ar por defeso eleitoral de 04/07 a 25/10/2026 [V]). Os números delas vieram de veículos que os reproduziram.

### 3.1 Inventários de leilões e contratos

- Ministério das Cidades: não há painel público de concessões ou contratos [V]. O SINISA 2025 (esgoto) registra 25 entidades reguladoras na coleta, cobrindo 2.544 municípios regulados, sem listar contratos [V, PDF].
- B3: sem lista consolidada legível por máquina; a página de histórico carrega vazia sem JavaScript [V]. Há uma notícia HTML por leilão (Amapá 02/09/2021, Ceará 27/09/2022, Sanepar 20/09/2024, Ceará interior 30/06/2026) [V].
- BNDES, via Revista OE de 13/10/2025 [V na página, secundária]: oito projetos estruturados e leiloados, 16 leilões, cerca de 34,7 milhões de pessoas, investimentos da ordem de R$ 84,2 bilhões (Alagoas, Rio de Janeiro, Amapá, Sergipe, Pará, Espírito Santo, Ceará, Corsan). Em carteira: Rondônia, Pernambuco, Paraíba, Maranhão, Rio Grande do Norte, Alagoas restante, Pará bloco C, Goiás, Minas (PPP com IFC). Nenhum dado tabular público.
- ABCON SINDCON, Panorama da Universalização 2026 (10/08/2026), via CNN Brasil de 11/08/2026 [V]: 70 leilões desde o marco; mais de R$ 227 bilhões contratados; 31 projetos em estruturação (R$ 32 bi, 636 municípios); participação privada no investimento de 32,4% em 2024 contra 15,1% em 2020. Via ICL Notícias de 15/08/2026 [V]: 2.720 municípios com operação privada até junho de 2026 (48,8%); 84% concessão plena, 14% PPP, 2% parcial; projetos abrangem 100 milhões de pessoas em 2.480 municípios. Formato: PDF e release; parte interessada.
- Instituto Trata Brasil: Painel Saneamento Brasil (SNIS/SINISA, IBGE, DATASUS) sem contratos nem download anunciado [V]; estudo "Avanços do Marco Legal 2025" (Agência Brasil, 19/08/2025) [V]: água 83,6% (2019) para 83,1% (2023), coleta 53,2% para 55,2%, tratamento 46,3% para 51,8%, 363 municípios com contratos irregulares.
- Instituto Água e Saneamento: plataforma municipal com SINISA 2024, Censo 2022 e MUNIC 2023; sem contratos nem metas [V].
- ANA: Resolução 192 de 08/05/2024 aprova a NR 8/2024 [V, PDF]; adesão de 20 entidades reguladoras em água (1.915 municípios) e 21 em esgoto (1.598) até 22/12/2025 [V, Agência iNFRA]; Resolução 301 de 14/08/2026 suspende para 2026 o preenchimento do sistema de monitoramento da universalização (art. 31, IV da NR 8) por impossibilidade técnica do sistema [V aviso na ANA; detalhe S].
- TCU, Acórdão 1.940/2024 Plenário (Agência iNFRA, 27/09/2024) [V]: 90 dias para o Ministério institucionalizar a avaliação das condicionantes de repasse (mais de R$ 8,5 bi/ano); mais de 1.000 contratos irregulares em 2023; ANA deve publicar a lista de reguladoras aderentes. Nenhum acórdão específico sobre leilões de concessão localizado.
- Radar PPP: fichas por contrato com vencedor e valor, sem prazo nem metas, por assinatura [V].

Tabela de leilões reunida na pesquisa (data; lotes; vencedor; outorga ou contraprestação; investimento declarado; população; prazo; grau):

| Poder concedente | Data | Resultado | Grau |
|---|---|---|---|
| Alagoas, bloco A | 30/09/2020 | BRK; outorga R$ 2,009 bi; 13 municípios; 1,5 mi hab; R$ 2,6 bi; 35 anos | S |
| Cedae, blocos 1, 2 e 4 | 30/04/2021 | Aegea (B1, R$ 8,2 bi), Iguá (B2, R$ 7,286 bi), Aegea (B4, R$ 7,203 bi); total R$ 22,69 bi; cerca de R$ 30 bi de investimento; 35 anos; população por bloco não achada | V (Suno) |
| Amapá | 02/09/2021 | Marco Zero (Equatorial 80%, SAM 20%); R$ 930,008 mi; desconto tarifário 20%; 16 municípios; 738 mil; cerca de R$ 3 bi; 35 anos | S |
| Alagoas, blocos B e C | 13/12/2021 | Allonda (B, R$ 1,215 bi) e Cymi (C, R$ 430 mi); 61 municípios; 1,3 mi; R$ 4,5 bi; 35 anos | V |
| Cedae, bloco 3 | 29/12/2021 | Águas do Brasil; R$ 2,201 bi; 21 municípios; R$ 4,7 bi; 35 anos | S |
| Ceará, PPP esgoto RMF e Cariri | 27/09/2022 | Aegea nos dois blocos; contraprestação R$ 7,652 bi e R$ 11,376 bi; 24 municípios; 4,1 mi; 30 anos; meta 95% | V (B3) |
| Corsan (RS) | 20/12/2022 | Aegea; R$ 4,151 bi; ágio 1,15% | S |
| Sanepar (PR), PPP esgoto, 3 lotes | 20/09/2024 | Saneamento Consultoria, Acciona e Iguá; 112 municípios; R$ 2,9 bi; 24 anos | V (B3) |
| Sergipe (Deso) | 04/09/2024 | Iguá; R$ 4,5 bi; 74 municípios; 2,3 mi; R$ 6,3 bi; 35 anos | V (Exame) |
| Piauí | 30/10/2024 | Aegea; outorga R$ 1 bi; 224 municípios; R$ 8,6 bi; 35 anos; 99% água em 2033 e 90% esgoto em 2040 | V (Poder360) |
| Pará (Cosanpa), lotes A, B e D | 11/04/2025 | Aegea; outorgas R$ 1,42 bi; R$ 15,21 bi em 40 anos; 99 de 144 municípios; lote C sem proposta | V (NeoFeed) |
| Espírito Santo (Cesan), PPP | jun/2025 | GS Inima/Forte Ambiental e Acciona; cerca de R$ 7 bi | S |
| Pernambuco (Compesa) | 18/12/2025 | RMR Pajeú: BRK e Acciona, outorga R$ 3,5 bi, R$ 15,4 bi; Sertão: Pátria, R$ 720 mi, R$ 2,9 bi; 35 anos | V (Diário de Pernambuco) |
| Paraíba (Cagepa), PPP esgoto | 15/05/2026 | Acciona; R$ 3,003 bi; 85 municípios; até 1,7 mi; 25 anos; 90% esgoto até 2039 | V (Movimento Econômico) |
| Copasa (MG) | 03/06/2026 | Equatorial, 30% por R$ 5,593 bi; follow-on cerca de R$ 8,4 bi (privatização, não concessão) | S |
| Ceará interior, bloco 1 | 30/06/2026 | Consórcio Ceará Saneamento; R$ 3,74 bi; 23 municípios; 276 mil; R$ 1,08 bi; 28 anos | V (B3) |
| Rondônia | 22/09/2026 | sem propostas; 40 municípios; R$ 8,47 bi; 35 anos | V (FNU) |

Toda a tabela vem de HTML de notícia ou PDF. Nenhuma fonte oficial publica CSV, API ou planilha de leilões.

### 3.2 Onde estão as metas contratuais

- Editais, contratos e cadernos de encargos ficam dispersos em portais estaduais e sites de agências (ex.: Agenersa, RJ, referencia o "Anexo IV, Caderno de Encargos da Concessão" nas INs 116 e 128 [S]).
- Nenhum agregador consolida metas anuais por contrato em formato estruturado (ABCON em PDF; IAS sem contratos; Radar PPP sem metas; Trata Brasil sem contratos).
- NR 8/2024 [V]: metas por município (99% dos domicílios com água, 90% com coleta e tratamento até 31/12/2033); indicadores IAA, ICA, IAE e ICE (art. 23), por município, área, contrato, prestação regionalizada e prestador (art. 24); meta só atingida quando atendimento e cobertura chegam juntos ao limiar (arts. 26 e 27); reguladoras devem publicar a relação de municípios com metas progressivas e a avaliação anual (art. 31, §2º). Em 2026 o preenchimento do sistema nacional foi suspenso.
- Decreto 10.710 de 31/05/2021 (capacidade econômico-financeira) [V página da ANA]: a ANA deve publicar cópia das decisões, mas a página não mostra a publicação nem a contagem; Decretos 11.598 e 11.599 de 12/07/2023 [V, Mayer Brown] presumiram capacidade para estatais com requerimento até 31/12/2023 e desestatização concluída até 31/12/2024.
- Lacuna: estudo ABCON com "mais de mil municípios" sem metas contratualizadas (Agência iNFRA, 24/02/2026) [V]; TCU, mais de 1.000 contratos irregulares em 2023 [V].

### 3.3 Medir cumprimento

- SINISA 2025, referência 2024 (zip de 19 MB, baixado) [V]: água por base municipal, por prestador e consolidada; 5.145 linhas com código IBGE, prestador, natureza jurídica e IAG0001 a IAG0006; publicado em 18/12/2025, retificado em 25/05/2026. A planilha de esgoto 2024 não está linkada na página de resultados; o relatório em PDF [V] traz 2.749 municípios participantes (49,4%), IES0001 de 62,3% da população total, investimentos em esgoto de R$ 13,68 bi em 2024, e a ressalva literal "apenas municípios com rede de coleta de esgoto são registrados no módulo". A plataforma já usa essa coleta.
- SNIS até 2022 em CSV [S]; o IAS registra que o SINISA ainda não foi compatibilizado com a série histórica [V].
- Censo 2022 [S]: rede geral de água 82,9% das pessoas; esgoto por rede geral ou pluvial 58,3%; 62,5% em rede ou fossa ligada. Base domiciliar, não de prestador.
- Limites para comparar com contrato: universo (SINISA cobre só respondentes e só municípios com rede no módulo esgoto); definição ("atendido" declarado pelo prestador contra domicílio da NR 8 contra metas próprias de cada contrato: 95% no Ceará, 90% em 2039 na Paraíba e 2040 no Piauí); ano (SINISA 2024 saiu em dez/2025 e foi retificado em mai/2026); área (contrato por bloco e área de concessão, SINISA por município ou prestador).

### 3.4 Custo da universalização e quanto já está contratado

- KPMG e ABCON, jul/2020: R$ 753 bi até 2033 (R$ 498 bi de expansão: R$ 144 bi água e R$ 354 bi esgoto; R$ 255 bi de reposição) [S; PDF da KPMG hoje em 404].
- Plansab: R$ 511 bi a preços de dez/2021 [S]; Trata Brasil, 02/09/2025 [V]: R$ 516,4 bi a preços de jun/2023, saldo R$ 454,1 bi, R$ 45,1 bi por ano de 2024 a 2033; realizado R$ 13,6 bi (2021), R$ 22,5 bi (2022), R$ 25,6 bi (2023), correntes. ABCON: R$ 29,1 bi em 2024 [S].
- Revisão do Plansab (ano-base 2022) em curso, sem valor publicado [V]. O valor "R$ 882,4 bi" atribuído ao ministro não foi localizado em nenhuma fonte; não usar. Outras cifras sem origem conferida: KPMG 2023 R$ 893 bi [S], ABCON "até R$ 900 bi" [S], "pelo menos US$ 100 bilhões" (G20, jul/2024) [S].
- Contratado: ABCON, mais de R$ 227 bi em 70 leilões (2020 a jun/2026) [V, CNN]; BNDES, R$ 84,2 bi em 16 leilões (out/2025) [V, Revista OE]. Recortes não comparáveis (a ABCON inclui PPPs municipais e privatizações; o BNDES só o que estruturou).

### 3.5 Riscos para um observatório honesto

"Investimento previsto" mistura CAPEX de edital, compromisso contratual, ágio convertido em obra e prazos de 10 a 40 anos. Outorga não é investimento; contraprestação de PPP não é outorga. Metas contratuais divergem da lei (2039, 2040) e são repactuáveis; aditivos e reequilíbrios não têm registro consolidado. Metas vivem em anexos em PDF, por bloco, sem série anual aberta; o sistema nacional de monitoramento está suspenso em 2026. População "abrangida" (100 mi, ABCON) não é população atendida. As fontes principais são partes interessadas e as contagens divergem (70 leilões na ABCON; 16 ou 20 no BNDES).

## 4. Inferência: viabilidade por pergunta

| Pergunta do especialista | Viabilidade hoje | Com o quê | O que a página dirá que falta |
|---|---|---|---|
| O que está contratado desde 2020? | Viável, parcial | Tabela curada de leilões (data, lotes, vencedor, outorga ou contraprestação, investimento declarado, prazo, população quando houver), cada linha com fonte, data e grau de verificação; proxy do SINISA 2024 (vínculos de concessão iniciados de 2020 em diante, por município) | População de RJ, PE e PR; valor conciliado entre ABCON e BNDES; aditivos |
| Metas previstas em contrato, ano a ano | Parcial, por amostra | Transcrição manual dos anexos de metas de 6 a 8 contratos com documento público (Sabesp URAE 1 já feito; Cedae blocos 1 a 4; Ceará; Piauí; Pernambuco; Paraíba; Amapá; Sergipe), com sha256 do PDF e cláusula citada, como em `estudos.ts` | Os demais contratos; metas por município dentro do bloco; repactuações |
| Cumprido ou não | Não viável como série; viável como "posição em 2024" | IAG0001 e IES0001 do SINISA 2024 por município das áreas concedidas, ao lado da meta contratual do ano, com as quatro ressalvas de 3.3 | Aferição oficial anual (NR 8, art. 31) e o sistema da ANA, suspenso em 2026 |
| Se tudo contratado for executado, onde estaremos em 2033? | Viável como modelo didático, identificado como tal | Laboratório: população das áreas com meta contratual transcrita × meta no ano, mais o restante do país no ritmo observado entre os Censos (mecanismo já existente em `ritmoAteMeta`); o leitor escolhe o ritmo do restante | Contratos sem meta transcrita; áreas sem contrato; cumprimento real |
| Quanto falta, descontado o contratado | Parcial, só com bases de preço explícitas | Estimativas públicas lado a lado (KPMG/ABCON 2020, Plansab 2021 e 2023, Trata Brasil 2025), cada uma com base de preço e método, e o contratado da ABCON e do BNDES como recortes distintos, nunca subtraídos silenciosamente | Revisão oficial do Plansab; conciliação entre estimativas; investimento contratado em base comparável |

## 5. Recomendação: desenho do capítulo

- **Posição**: capítulo 15 do eixo D (Investimento e planejamento), slug `contratado`, pergunta "O que já está contratado para universalizar até 2033?", situação `parcial` com `pendencia` explícita. Alternativa mais econômica: dois subpainéis com `naNavegacao` (7.2 "Concessões desde 2020" no eixo C e 11.1 "Cenário contratado para 2033" no eixo D), no padrão do 7.1 do PR 305. A primeira opção responde ao especialista numa só narrativa; a segunda evita renumerar testes e a entrada. Decisão do dono.
- **Primeira tela**: a pergunta, uma frase do que a página mostra e até quatro números com fonte e data: leilões registrados desde 2020 (contagem própria da tabela curada, não a da ABCON), municípios com concessão iniciada de 2020 em diante (SINISA 2024), contratos com metas transcritas (contagem própria), e o investimento declarado somado só dos leilões com fonte verificada [V] **e com contrato de serviço adjudicado** (`tipo = concessao` ou `ppp` e `resultado = adjudicado`): leilão sem propostas (Rondônia, 2024) e venda de ações (Copasa, 2025, privatização) ficam na tabela, com o seu resultado, e fora de todo total; com a nota de que o investimento declarado não é comparável entre contratos.
- **Seção 1, Leilões desde 2020**: tabela com ordenação, grau de verificação por linha (documento oficial, notícia oficial, imprensa), outorga separada de contraprestação e de investimento, prazo e população; mapa dos municípios por bloco quando a composição for pública; download CSV com conta.
- **Seção 2, O que cada contrato promete**: para os contratos transcritos, a curva de metas por ano (ICA, ICE e, quando houver, perdas) até o fim do contrato, uma por bloco, com a cláusula e o sha256 do documento; a diferença entre a meta contratual e a legal (2033) dita em texto.
- **Seção 3, Onde estamos**: posição 2024 do SINISA por município das áreas concedidas contra a meta contratual do ano, com as quatro ressalvas de 3.3 na própria seção, nunca em tooltip; sem selo de "cumprido" ou "descumprido" (contrato editorial, seção 1 da skill).
- **Seção 4, Laboratório "se tudo for cumprido"**: modelo didático identificado como tal; o leitor ajusta o ritmo do restante do país e vê o Brasil em 2033 com e sem os contratos; o que o modelo deixa de fora dito ao lado.
- **Seção 5, Quanto custa universalizar**: as estimativas lado a lado com base de preço e método; o contratado como recortes separados; nenhuma subtração entre bases diferentes.
- **Método recolhido no fim**, com a lista de contratos lidos, os não lidos e o motivo, e a vigília de fontes.
- **Aperitivo** (`/saneamento/municipio`): um item em `comConta()`: "Concessões contratadas desde 2020: lotes, vencedores, investimento previsto e metas contratuais até 2033", com a contagem gerada do dado.
- **Entrada e registro**: `respostasDosCapitulos()[15]`, `data-capitulo`, `VIABILIDADE` com a linha do capítulo, `registro.ts` (mapeamento automático por `CAPITULOS`), `saneamento-entrada.test.ts` (`toHaveLength` de 14 para 15), `i18n-home-indice.test.ts`.

## 6. Dados e pipeline

- `pipeline/saneamento_contratos/`: `seed/leiloes.json` (curadoria manual: uma linha por leilão e lote, com `tipo` em {concessao, ppp, privatizacao, alienacao_de_acoes}, `resultado` em {adjudicado, sem_propostas, suspenso, anulado}, fonte, URL, data da fonte, grau de verificação e campos nulos quando a fonte não informa), `seed/metas_contratuais.json` (uma linha por contrato, ano e indicador, com cláusula, documento, URL e sha256), `seed/abrangencia.json` (o vínculo versionado entre cada contrato ou bloco e os códigos IBGE abrangidos, com início e fim de vigência e a fonte da composição; é a ponte que as golds de hoje não têm, pois `municipios.json` e `prestadores.json` ligam município a prestador, não a bloco), `gold.py` (cruza `abrangencia.json` com `municipios.json` e `uf/{UF}.json` pelo código IBGE, calcula a posição 2024 e valida: totais só sobre linhas com `tipo` de contrato de serviço e `resultado = adjudicado`; outorga, contraprestação e investimento nunca somados entre si; população só quando declarada; meta anual monotônica; nenhum município em dois blocos com vigências sobrepostas; todo bloco com meta tem abrangência), saída em `public/saneamento/contratos/{leiloes.json, metas.json, abrangencia.json, posicao_2024.json, leiloes.csv}`.
- `config/atualizacao/saneamento-contratos.json`: sem coleta automática (as fontes não têm API); verificação mensal no motor por grupo (`scripts/atualizacao_por_grupo.py`) que baixa de novo cada documento do seed e compara o SHA-256 com o registrado (PDF trocado na mesma URL vira pendência com a diferença, nunca atualização silenciosa), confere se o SINISA mudou de versão e procura, nas páginas das agências e dos contratos listadas no seed, aditivos e novas versões pelo padrão de nome e data; leilão novo, aditivo ou repactuação entra por PR com a fonte e o novo hash.
- Testes: `saneamento-contratos.test.ts` (schema do seed, `tipo` e `resultado` só nos valores permitidos, totais excluem leilão sem contrato adjudicado e alienação de ações, graus de verificação só nos valores permitidos, nenhuma soma entre naturezas de valor, toda meta com documento e sha256, todo bloco com meta tem abrangência sem sobreposição de vigência, toda linha com fonte e data, páginas e aperitivo citando as contagens do dado, sem travessão).
- Custo de curadoria estimado: tabela de leilões, 1 dia; seis a oito anexos de metas, 2 a 3 dias (localizar PDF, transcrever, conferir); laboratório e páginas, 2 dias; testes e revisão, 1 dia.

## 7. Etapas

1. **Etapa 1 (viável agora)**: tabela de leilões curada, proxy do SINISA, estimativas de custo com base de preço, página com situação `parcial`, aperitivo e registro. Entrega: PR próprio.
2. **Etapa 2**: metas transcritas de 6 a 8 contratos, seção 2 e laboratório 2033, posição 2024 por área concedida. Entrega: PR próprio; pede o dono aprovar a lista de contratos.
3. **Etapa 3 (dependente de terceiros)**: aferição anual oficial, quando as reguladoras publicarem a avaliação do art. 31 da NR 8 ou quando o sistema da ANA voltar; artigos críticos linkados como leitura, nunca como dado.

## 8. Decisões do dono

1. Capítulo 15 próprio ou dois subpainéis (seção 5).
2. Aceitar curadoria manual com fontes secundárias marcadas por grau, ou publicar só o que tiver documento oficial (hoje: B3 em 4 leilões, Sabesp URAE 1).
3. Publicar os números da ABCON e do BNDES com o rótulo de parte interessada e recorte próprio, ou só citá-los no método.
4. Lista dos contratos da etapa 2 (sugestão: Cedae blocos 1 a 4, Ceará RMF e Cariri, Piauí, Pernambuco, Paraíba, Amapá, Sergipe, além da Sabesp).
5. Não assinar o Radar PPP (dado sem metas, com licença restrita).

## 9. Fontes citadas (acessadas em 20/10/2026)

- SINISA resultados: https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/sinisa/resultados-sinisa (zip ref. 2024: SINISA_Resultados_Ref2024.zip; relatório de esgoto 2025: 009_RELATORIO_SINISA_ESGOTAMENTO_SANITARIO_2025_defeso.pdf).
- SNIS: https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/snis e https://app4.cidades.gov.br/serieHistorica/
- ANA, Resolução 192/2024 (NR 8): https://www.gov.br/ana/pt-br/legislacao/resolucoes/resolucoes-regulatorias/2024/192 ; Decreto 10.710: página da ANA sobre comprovação de capacidade econômico-financeira; adesão das reguladoras (Agência iNFRA, 22/12/2025): https://agenciainfra.com/blog/ana-20-agencias-aderiram-a-normas-sobre-abastecimento-de-agua-em-esgoto-dado-vai-a-21/ ; Resolução 301/2026: https://agenciainfra.com/blog/ana-suspende-preenchimento-do-sistema-de-monitoramento-da-universalizacao/
- TCU, Acórdão 1.940/2024 (Agência iNFRA, 27/09/2024): https://agenciainfra.com/blog/tcu-da-90-dias-de-prazo-para-regulacao-da-avaliacao-de-condicionantes-para-repasse-de-verba-para-saneamento/
- ABCON Panorama 2026: https://www.cnnbrasil.com.br/infra/trabalhadores-no-setor-de-saneamento-cresceram-69-em-2025-aponta-abcon/ e https://iclnoticias.com.br/atuacao-privada-saneamento-salto/
- BNDES (Revista OE, 13/10/2025): https://revistaoe.com.br/bndes-investimentos-saneamento-norte-nordeste/ ; Hub de Projetos: https://hubdeprojetos.bndes.gov.br/pt/projetos/nossos-projetos
- B3: Amapá 2021 https://www.b3.com.br/pt_br/noticias/governo-do-amapa-realiza-leilao-para-concessao-do-servico-de-agua-e-esgoto.htm ; Ceará 2022 https://www.b3.com.br/pt_br/noticias/governo-do-ceara-e-cagece-realizam-leilao-na-b3-para-concessao-administrativa-de-saneamento.htm ; Sanepar 2024 https://www.b3.com.br/pt_br/noticias/leiloes-8AE490C991F1EDE401921F4BE3F6452C.htm ; Ceará 2026 https://www.b3.com.br/pt_br/noticias/governo-do-ceara-realiza-leilao-para-concessao-dos-servicos-de-esgotamento-sanitario.htm
- Leilões em fontes secundárias conferidas: Cedae https://www.suno.com.br/noticias/?p=143867 ; Alagoas B e C https://movimentoeconomico.com.br/geral/infraestrutura/2021/12/13/leilao-de-dois-blocos-de-saneamento-de-alagoas-arrecada-r-16-bilhao/ ; Sergipe https://exame.com/brasil/em-leilao-com-forte-competicao-igua-leva-concessao-de-saneamento-de-sergipe-por-r-45-bi/ ; Piauí https://www.poder360.com.br/poder-infra/aegea-vence-leilao-de-saneamento-do-piaui/ ; Pará https://neofeed.com.br/negocios/aegea-abre-torneira-de-agio-e-vence-leilao-de-saneamento-no-para/ ; Pernambuco https://www.diariodepernambuco.com.br/economia/2025/12/11703284-leilao-da-compesa-entenda-o-que-muda-apos-concessao-em-pernambuco.html ; Paraíba https://movimentoeconomico.com.br/saneamento/2026/05/15/acciona-vence-ppp-da-cagepa-com-r-3-bilhoes-e-unico-lance-na-b3/ ; Rondônia https://www.fnucut.org.br/57609/leilao-do-saneamento-de-rondonia-termina-sem-propostas/
- Custo: Trata Brasil https://tratabrasil.org.br/distante-investimento-saneamento-mais-dobrar/ ; Agência Brasil https://agenciabrasil.ebc.com.br/direitos-humanos/noticia/2025-08/estudo-aponta-estagnacao-no-saneamento-5-anos-apos-novo-marco-legal ; KPMG 2020 (404 em 20/10/2026) https://assets.kpmg.com/content/dam/kpmg/br/pdf/2020/07/kpmg-quanto-custa-universalizar-o-saneamento-no-brasil.pdf ; revisão do Plansab https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/plano-nacional-de-saneamento-basico-plansab/processo-de-revisao-ano-base-2022-em-curso
- Decretos de 2023 (Mayer Brown): https://www.mayerbrown.com/pt/insights/publications/2023/08/perspectivas-para-o-saneamento-basico-apos-os-novos-decretos-federais
- IAS: https://www.aguaesaneamento.org.br/municipios-e-saneamento/fontes-notas-tecnicas ; Trata Brasil painel: https://tratabrasil.org.br/inteligencia-artificial-saneamento-painel/
