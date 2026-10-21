# Correções pedidas pelas avaliações independentes: unidade U11

Fonte: tecnico em /tmp/claude-0/-home-user-scrutiniums/fdb6f8f5-b80e-56ed-ab31-342c1b46c73d/scratchpad/tmp_u11t. Meta: nota igual ou superior a 9 em cada critério, sem bloqueio.

| Página | Critérios abaixo da meta | Bloqueios |
| --- | --- | --- |
| `/inclusao-energetica` | 5 | 0 |
| `/inclusao-energetica/tarifa-social` | 4 | 0 |
| `/inclusao-energetica/cobertura` | 5 | 0 |
| `/inclusao-energetica/orcamento` | 5 | 0 |
| `/inclusao-energetica/acesso` | 4 | 0 |

## `/inclusao-energetica`

### E, Profundidade: nota 8.5 (tecnico)

- Sem evolução temporal, território nem composição na abertura; só a variação de 2,4% das UC em 12 meses.
- O bloco O que mudou cita a média na renda (6,88%) e 40 famílias, medida que a abertura não exibe.
- Benefício e acesso trazem valores pontuais de datas diferentes (mai/2025, mar/2026, 2025, ago/2026) sem comparação entre eles.
- Justificativa do avaliador: Abertura que responde às quatro perguntas, com unidade e data próprias e distribuição por renda, números conferidos na fonte. Faltam evolução, território e composição, que ficam nas páginas filhas, e há um trecho sobre medida que a abertura não mostra.

### F, Benchmarks e comparabilidade: nota 8.5 (tecnico)

- Proxy em destaque sem a ordem de grandeza do BPC no numerador (10,9%) nem do excesso de faturas sobre UC (2,12% em mai/2025).
- Medidas de datas e unidades diferentes (UC de mai/2025, faturas de mar/2026) lado a lado, só com aviso de que não se somam.
- Justificativa do avaliador: Comparações por renda compatíveis e conferidas com a tabela do IBGE, sem benchmark enganoso. A proxy de cobertura é destacada sem quantificar a diferença entre numerador e denominador (BPC, fatura contra UC), embora os dados permitam medir.

### G, Rigor setorial: nota 8.5 (tecnico)

- O denominador despesa total do IBGE inclui impostos, contribuições e variação de ativos e dívidas (consumo é de 66% a 92,5% dela); a abertura não diz isso nem mostra a sensibilidade.
- Que o tempo integral é interrupção declarada pelo morador, e não medida técnica, só consta em Sobre este dado.
- População de localidades isoladas marcada como Observado, embora seja informada pelas distribuidoras (a frase de apoio diz isso).
- A abertura diz que o numerador inclui critérios que o denominador não tem, sem nomear o BPC nem medir (10,9% das faturas; excesso de faturas sobre UC de 2,12%).
- Justificativa do avaliador: Unidades, datas e ausência tratadas com rigor, e todos os números principais conferidos na fonte. Restam o denominador despesa total sem composição, a ressalva do tempo integral escondida em Sobre este dado e a proxy sem quantificar BPC e excesso de faturas.

### H, Rastreabilidade: nota 8.5 (tecnico)

- Versão do código 6d3bc3a2f759+alterado: refazer a base com ela pode dar outro resultado, como a página Dados e reprodução admite.
- Fichas das faturas e do proxy dizem que a detecção de revisões não está disponível, embora a base da CDE seja retificada pela fonte.
- O comando de reprodução usa um silver local não publicado; os arquivos brutos não são públicos e o MME já mudou desde a captura.
- Justificativa do avaliador: Cadeia fonte, hash, fórmula, filtros e testes verificada de ponta a ponta, com reprodução independente dos números principais. A nota é limitada pelo código marcado como alterado, pela falta de histórico de revisões nas faturas e por um procedimento que depende de base local.

### L, Confiabilidade técnica: nota 8.5 (tecnico)

- Bloqueio de publicação cobre só o gold: CSV e JSON da unidade são escritos antes da validação.
- Sem teste do caminho negativo de validar_gold e da sentinela para esta unidade.
- Desempenho só de laboratório; sem dado de campo (LCP, INP e CLS de usuários reais).
- Justificativa do avaliador: Sem erros de console, falhas de rede ou violações axe, carga e LCP baixos em laboratório e testes fortes. Fica abaixo de 9 porque a validação de publicação não protege CSV e JSON, o caminho inválido não é testado e não há dado de campo.

## `/inclusao-energetica/tarifa-social`

### G, Rigor setorial: nota 8.0 (tecnico)

- Base legal citada como MPV nº 1.300/2025, convertida na Lei nº 15.235/2025; o desconto social de 2026 não aparece.
- Queda de 33% do SCS entre dez/2014 e jul/2015, em meses completos, sem evento nem nota na página.
- Multifamiliar 0 no SCS contra 142.193 faturas da subclasse 3.6 na CDE, sem explicação; a diferença SCS contra CDE é atribuída só a outras referências e mais de uma fatura por UC.
- O que mudou liga a regra de 80 kWh ao desconto médio por fatura (R$ 25,31, R$ 40,01, e R$ 56,49 em dez/2025) sem separar tarifa, consumo e sazonalidade.
- Diz que em 2025 a Tarifa Social foi 15,9% da despesa da CDE, mas a fonte não separa orçado de executado; e a faixa de 101 a 220 kWh sai 44,2% por arredondamento duplo (exato 44,147).
- Justificativa do avaliador: Números principais refeitos na fonte e batendo, com tratamento exemplar de meses incompletos. A nota cai por base legal desatualizada, queda de 2015 sem nota, multifamiliar sem explicação, atribuição da variação do desconto à regra e pequenas imprecisões (orçado como realizado, arredondamento duplo).

### F, Benchmarks e comparabilidade: nota 8.5 (tecnico)

- Mapa padrão de contagem absoluta de faturas por UF reflete população; a razão por 100 famílias está em outra página.
- Desconto médio por UF compara tarifas e perfis de consumo diferentes sem aviso na própria página.
- Justificativa do avaliador: Comparações no mesmo universo e conferências cruzadas bem feitas, com exceções declaradas. Reduzem a nota o mapa padrão em contagem absoluta e o desconto médio entre UF sem aviso de que tarifas e consumos diferem.

### H, Rastreabilidade: nota 8.5 (tecnico)

- Código com sufixo alterado e fichas das faturas sem detecção de revisões.
- O comando de reprodução é o mesmo em todas as fichas e usa o silver local; o SCS é regenerado todo mês e o bruto não é público.
- Justificativa do avaliador: Reproduzi UC, DMR, faturas e desconto direto dos arquivos da ANEEL com hash idêntico ao declarado, e a paridade com CSV e tabelas fecha. Limitam a nota o código alterado, a ausência de revisões nas faturas e a reprodução que depende de base local.

### L, Confiabilidade técnica: nota 8.5 (tecnico)

- Bloqueio de publicação cobre só o gold; CSV e JSON são escritos antes da validação.
- Sem teste do caminho negativo da validação.
- Desempenho só de laboratório.
- Justificativa do avaliador: Sem erro, com interações corretas, carga abaixo de 1,7 s e testes que cobrem a série e a paridade. A nota fica abaixo de 9 pela validação que não protege CSV e JSON, pelo caminho inválido sem teste e pela falta de dado de campo.

## `/inclusao-energetica/cobertura`

### F, Benchmarks e comparabilidade: nota 8.0 (tecnico)

- Universos só em parte compatíveis: a página não quantifica o BPC (10,9%) nem oferece a variante sem BPC, que os dados permitem.
- Comparação entre UF sem aviso quantificado do excesso de faturas sobre UC (até 12,35%): a conferência está no Auditar da Tarifa Social e o dicionário do CSV só diz que há distribuidoras com mais faturas que UC.
- Série mensal de 2015 a 2025 sem referência às quebras do denominador e do numerador.
- Justificativa do avaliador: A proxy é honesta e rotulada, mas cruza o total de faturas com um denominador só de renda. O BPC (10,9% das faturas e 16,3% nos municípios acima de 100) não é quantificado nem separado, e o excesso de faturas sobre UC também fica fora.

### G, Rigor setorial: nota 8.0 (tecnico)

- Série mensal sem notas de quebra: queda de 2015, subida de 2020 e 2021 e salto do denominador em 2022; a página não relaciona essas variações a mudanças do cadastro nem à concessão automática de jan/2022.
- Base legal citada como MPV, já convertida na Lei 15.235/2025, e sem menção à faixa de meio a um salário mínimo de 2026, fora do denominador mas parte do desenho do benefício.
- O excesso acima de 100 é atribuído ao BPC e ao equipamento médico sem medir o peso de cada um: o BPC é 10,9% das faturas e a subclasse 3.6 (multifamiliar), 0,8%; fatura multifamiliar pode cobrir várias famílias.
- Por que isso importa contradiz o aviso de proxy.
- Justificativa do avaliador: Dados e cruzamento conferidos na fonte, com tratamento correto de ausência e base pequena. A nota cai por série mensal sem quebras anotadas, base legal desatualizada, excesso acima de 100 atribuído sem medir e uma frase de Por que isso importa que contradiz o aviso de proxy.

### E, Profundidade: nota 8.5 (tecnico)

- Falta a composição do numerador: o BPC (subclasse 3.5) é 10,9% das faturas e não é mostrado, embora o arquivo da CDE traga a subclasse.
- A evolução usa outra unidade (UC do SCS) e termina em mai/2025; o nível atual usa faturas de mar/2026 e as duas não se emendam.
- Justificativa do avaliador: Cobre nível, distribuição por UF e município, evolução e sensibilidade do denominador, tudo conferido. Falta separar o numerador por subclasse (BPC, multifamiliar), que o arquivo permite, e a evolução usa outra unidade e termina em mai/2025.

### H, Rastreabilidade: nota 8.5 (tecnico)

- Fichas sem detecção de revisões; o serviço do MDS não informa data de publicação.
- Código com sufixo alterado.
- A série mensal depende do SCS, regenerado todo mês, e o comando de reprodução usa o silver local.
- Justificativa do avaliador: O número principal e o denominador reproduzem exatamente a partir dos arquivos e do serviço do MDS, com hash idêntico e meses conferidos. Ficam o código alterado, a falta de histórico de revisões e a data de publicação do serviço do MDS não informada.

### L, Confiabilidade técnica: nota 8.5 (tecnico)

- Bloqueio de publicação cobre só o gold; CSV e JSON são escritos antes da validação.
- Sem teste do caminho negativo da validação.
- Desempenho só de laboratório.
- Justificativa do avaliador: Sem erros, interações corretas, dados pesados sob demanda e testes por risco. A nota fica abaixo de 9 porque a validação não protege CSV e JSON, o caminho inválido não é testado e o desempenho é só de laboratório.

## `/inclusao-energetica/orcamento`

### E, Profundidade: nota 8.5 (tecnico)

- Sem evolução: só a POF 2017/2018, embora as edições de 2002/2003 e 2008/2009 estejam públicas no FTP do IBGE.
- Sem ponte com a mudança de preços e de Tarifa Social desde 2018: a página só diz que mudaram.
- Na base renda não há razão de médias, só média das participações e mediana.
- Justificativa do avaliador: Distribuição, território, precisão e sensibilidade bem cobertos e reproduzidos dos microdados. Falta a dimensão de evolução (edições anteriores públicas) e uma ponte com preços e tarifas desde 2018, e a base renda não traz a razão de médias.

### F, Benchmarks e comparabilidade: nota 8.5 (tecnico)

- Destaque de 6,9% usa o estimador mais sensível a rendas muito baixas, sem a razão de médias como contraparte da razão sobre a despesa.
- Sem edições anteriores da POF como referência histórica, embora públicas.
- Sem quartis ou percentis da participação por família, só média e mediana.
- Justificativa do avaliador: Estimadores distintos e precisão aplicada com rigor, mas o destaque na renda é o estimador mais sensível e falta a razão de médias para comparação direta com a despesa. Sem referência histórica nem quartis, que ajudariam a ler a dispersão.

### G, Rigor setorial: nota 8.5 (tecnico)

- Denominador despesa total sem composição nem sensibilidade ao consumo.
- Conceito de renda (rendimento total e variação patrimonial) escrito de forma simplificada.
- Zero na amostra aparece como 0,0 no gráfico sem qualificador.
- Justificativa do avaliador: Rigor estatístico alto, com razão de médias, média das razões, CV e sensibilidade tratados e reproduzidos dos microdados. Restam o denominador despesa total sem composição, o conceito de renda simplificado e o zero na amostra mostrado como 0,0 no gráfico.

### H, Rastreabilidade: nota 8.5 (tecnico)

- Dicionário do CSV incompleto (códigos de classe e estados sem_erro_padrao e zero_na_amostra).
- Código com sufixo alterado e reprodução com silver local.
- A frase de resposta não acompanha o seletor: em Na renda continua dizendo 4,4% e 2,5% sobre a despesa enquanto o gráfico mostra 6,88% e 3,73%.
- Justificativa do avaliador: Microdados, tradutor e tabela do IBGE com hash e parâmetros declarados, e reprodução sem divergência. A nota fica abaixo de 9 pelo dicionário do CSV incompleto, pelo código alterado e pela frase de resposta que não acompanha o seletor de base.

### L, Confiabilidade técnica: nota 8.5 (tecnico)

- Bloqueio de publicação cobre só o gold; CSV e JSON são escritos antes da validação.
- Sem teste do caminho negativo da validação.
- Desempenho só de laboratório.
- Justificativa do avaliador: Sem erros, interações corretas e testes que cobrem estimador, precisão e paridade. A nota fica abaixo de 9 porque a validação não protege CSV e JSON, o caminho inválido não é testado e o desempenho é só de laboratório.

## `/inclusao-energetica/acesso`

### F, Benchmarks e comparabilidade: nota 8.5 (tecnico)

- Precisão por recorte sem a regra de cautela aplicada na POF.
- Mapa por quantis com empates agrupa extremos com valores intermediários.
- A soma das UF não fecha com o Brasil e a página não avisa.
- Justificativa do avaliador: Universos declarados e fontes sem soma indevida, e números refeitos na fonte. Reduzem a nota a precisão por recorte sem regra de cautela, o mapa por quantis com empates e a soma das UF que não fecha com o Brasil, sem aviso.

### G, Rigor setorial: nota 8.5 (tecnico)

- O eixo da série do Brasil mostra precisão que o dado não tem (3 casas sobre 1) e destaca um pico de 2018.
- Tempo integral declarado: ressalva essencial só em Sobre este dado, como a ambiguidade do dicionário do MME (vlrpagocaixa).
- LPT 2025 rotulado completo embora a homologação ainda acrescente (210 domicílios em duas semanas).
- PASI marcado como Observado; a população é informada pelas distribuidoras e o caderno da EPE cita Tefé com 61,5 mil contra 73.669 na exportação.
- Justificativa do avaliador: Domicílio, pessoa e ligação bem separados, ausência e arredondamento tratados e números refeitos na fonte. Descontam o eixo com precisão aparente, ressalvas essenciais só em Sobre este dado, 2025 do LPT como completo e a população do PASI marcada como observada.

### H, Rastreabilidade: nota 8.5 (tecnico)

- O LPT mudou depois da captura (3.867.244 contra 3.863.418) e o bruto não é público: a página não permite refazer o valor exato.
- Código com sufixo alterado e reprodução com silver local.
- Ambiguidade do dicionário do MME só na ficha Sobre este dado.
- Justificativa do avaliador: As três fichas reproduzem na fonte, com hash e conferência com o caderno da EPE. Fica abaixo de 9: o LPT já mudou na fonte sem snapshot público, o código é marcado como alterado e a ambiguidade do dicionário do MME está só no Sobre este dado.

### L, Confiabilidade técnica: nota 8.5 (tecnico)

- Bloqueio de publicação cobre só o gold; CSV e JSON são escritos antes da validação.
- Sem teste do caminho negativo da validação.
- Desempenho só de laboratório.
- Justificativa do avaliador: Sem erros, interações corretas e testes que cobrem lacuna, ausência e paridade. A nota fica abaixo de 9 porque a validação não protege CSV e JSON, o caminho inválido não é testado e o desempenho é só de laboratório.

## Achados que se repetem entre páginas

- (tecnico) Base legal citada como MPV nº 1.300/2025, convertida na Lei nº 15.235/2025, e omissão da isenção de quotas da CDE de meio a um salário mínimo desde 1/1/2026 (Tarifa Social e Cobertura; o projeto já tem a lei na linha do tempo de Regulação).
- (tecnico) Numerador do proxy de cobertura com BPC (10,9% das faturas), multifamiliar (0,8%) e excesso de faturas sobre UC (2,12% em mai/2025, até 12,35%) sem quantificação (Síntese, Cobertura e Tarifa Social).
- (tecnico) Validação de publicação que protege só o gold: CSV e JSON são gravados antes de validar_gold, e não há teste do caminho negativo (as cinco páginas).
- (tecnico) Código com sufixo alterado, detecção de revisões indisponível nas faturas e fontes móveis sem snapshot público (as cinco páginas).
- (tecnico) Ressalvas essenciais só em Sobre este dado: tempo integral é interrupção declarada e ambiguidade do dicionário do MME (Acesso e Síntese).
- (tecnico) Denominador despesa total do IBGE (consumo de 66% a 92,5% dele) e estimador mais sensível em destaque na renda (Síntese e Orçamento).
- (tecnico) Séries com quebras sem nota: queda do SCS em 2015 na Tarifa Social e variações do proxy na Cobertura; eixo de 3 casas sobre dado de 1 casa em Acesso.
- (tecnico) Frase de resposta que não acompanha o seletor de base ou de indicador (Orçamento e Acesso).

## Limites declarados pelos avaliadores

- (tecnico) Conferi contra fontes primárias por curl e API: IBGE (SIDRA 6715, 6731, 6737 e 6738; microdados da POF e tradutor), ANEEL (SCS, ZIP da CDE de mar/2026 e de mai/2025, custeio da CDE, dicionários), MDS (API do MI Social), EPE (exportação do PASI e caderno em PDF) e MME (Luz para Todos). Os hashes do SCS, do ZIP da CDE e dos arquivos da POF são idênticos aos das fichas. O MME e a ANEEL (custeio) mudaram os arquivos depois da captura, então só comparei com o instantâneo quando a fonte não mudou. O site do IBGE (www.ibge.gov.br) respondeu 403 e planalto.gov.br respondeu 503: o período de campo da POF não foi confirmado e li a Lei nº 15.235/2025 numa cópia impressa do Planalto hospedada por terceiro; a REN 1.147/2025 só pela linha do tempo do projeto. Na POF, usei o leitor do próprio projeto para a despesa por família (validada contra as médias e a distribuição do IBGE) e reimplementei os estimadores; não refiz o erro padrão. Não conferi por distribuidora a conciliação SCS contra CDE nem a série antiga do Internet Archive. Não testei leitor de tela nem desempenho de campo; LCP e CLS vêm de Chromium headless local, sem limitar rede ou CPU. Não rodei build, servidor de desenvolvimento nem testes, conforme o protocolo; li os testes. Arquivos de apoio em saida/tmp_T2U11.

