# Segurança alimentar e avaliação dos serviços · produção

Integração autorizada pelo responsável em 10/10/2026. A decisão anterior de excluir notas próprias foi revista pelo pedido explícito de escores de qualidade do serviço por capítulo. A publicação desta etapa disponibiliza a metodologia experimental e dados reais; não publica escores numéricos sem referências e cobertura validadas. A simulação do protótipo privado não é integrada à produção.

## Rotas e escopo

Sete rotas em `/eficiencia-estatal/seguranca-alimentar`: panorama, necessidades, acesso, qualidade, recursos, dados e métodos. A entrada do OBEE mostra a cesta de Educação, Saúde, Trabalho e renda e Segurança alimentar, com seus escores pendentes. Os capítulos anteriores apresentam a revisão dos critérios sem alterar números, elegibilidade ou séries existentes. Trabalho e renda continua com suas séries originais.

PNADC: Brasil e cinco Grandes Regiões, 2023/2024, cinco percentuais da tabela na página 6 do informativo IBGE 2024. MUNIC: dez variáveis, 5.570 municípios, 55.700 registros, incluindo ausência e desconhecimento. Algumas perguntas da coleta 2024 têm referência 2023. O Distrito Federal é mantido no universo da MUNIC como publicado pelo IBGE; isso não o transforma em prefeitura comparável às finanças municipais. A ficha explicita o universo da fonte.

Não há EBIA municipal ou atribuição causal. Equipamentos e ações declaradas não geram pontos; gastos são contexto. PNAE, refeições populares e assistência emergencial terão denominadores próprios, sem soma de pessoas duplicadas.

## Fontes e pipeline

Originais oficiais vinculados na página, hashes SHA-256 no manifesto. Arquivos grandes não entram no git; o recorte comprimido e o manifesto ficam em `pipeline/eficiencia_alimentar/seed/`. Quinze fichas em `catalogo.json`, contendo definição, unidade, fórmula, numerador, denominador, universo, período, frequência, localização na fonte, cobertura, ausências, quebras, papel no escore, peso, referência e limitações.

`python -m pipeline.eficiencia_alimentar.run` verifica integridade e validações antes de preparar/promover os arquivos públicos. Nenhuma escrita pública ocorre quando a validação falha. Todos os arquivos são preparados antes da substituição, mas as substituições individuais não formam uma transação de filesystem: o deploy publica o artefato completo, depois de finalizar a materialização. Snapshot sem atualização automática.

`node scripts/materializar-seguranca-alimentar.mjs` materializa CSVs e JSONs por UF no prebuild/pretest, verificando hash, chaves e cobertura. Evita versionar os arquivos derivados grandes e funciona no build Vercel sem exigir Python. A interface só formata/filtra dados, sem calcular taxas ou escores de contexto. O explorador carrega uma UF por vez, com abortamento de solicitações anteriores e tratamento de erro, 50 registros/página, busca por nome/código e CSV nacional completo.

Reextração exata dos originais, usando leitor XLSX stdlib do OBEE e Poppler:

```
python -m pipeline.eficiencia_alimentar.capturar --munic /caminho/original.xlsx --pnadc /caminho/informativo.pdf
```

O replay exige os hashes da edição revisada; uma edição nova exige nova captura e revisão. O recorte PNADC foi conferido visualmente no PDF oficial no protótipo que precedeu a integração.

## Escore

Cesta fixa experimental v0.3, três pilares por capítulo, pesos iguais e média geométrica em duas etapas. Ausência bloqueia; não é zero e não redistribui peso. Zero observado e validado produz zero. Período, território e edição devem coincidir no agregado. Entrada de capítulo exige nova edição e recálculo histórico. Falta selecionar e validar medidas, limites fixos, denominadores e cobertura dos três pilares. Equidade transversal; satisfação com pesquisa própria, incluindo demanda não atendida. Critérios e memória dos resultados nulos são baixáveis. Inspiração: OECD Serving Citizens e UK Food Security Report 2024; não são validação dos pesos brasileiros.

## Verificação

Testes Python: cobertura, estados, duplicidade e gate sem ficha. Vitest: conciliação dos 5.570 municípios/55.700 respostas com downloads, valores sentinela PNADC, hashes e quinze fichas, ausência/zero/referências/escala/cesta/período. Sete novas rotas exigidas e inspecionadas pelo contrato estrutural de HTML no build obrigatório do CI. Tipos, lint e build do projeto principal também precisam passar antes do merge.

Limite: inspeção visual em navegador/capturas 1440, 768, 390 e 320 e leitor de tela não realizada nesta sessão, pois o controle de navegador recomendado está indisponível. Layout responsivo e tabelas equivalentes estão implementados; não declarar auditoria visual concluída.

## Resultado local da entrega

Tipos e lint aprovados. Build de produção aprovado: 467 páginas estáticas geradas. Suíte completa com `EXIGIR_BUILD_HTML=1`: 178 arquivos aprovados, 4.363 testes aprovados e um ignorado. Novos testes Python alimentares: três aprovados; regressão Educação/Saúde: 108 aprovados. A reextração dos originais confere exatamente com o recorte preservado. Pipeline de Educação executado sem validação reprovada; suas saídas regeneradas não integram esta entrega.

Publicação externa bloqueada na gravação do blob pelo GitHub: HTTP 403, `Resource not accessible by integration`. Não houve envio de branch, abertura de PR, execução de CI remoto, merge ou mudança em scrutiniums.com nesta sessão. Esses passos precisam de uma conexão com escrita em Contents e Pull requests para o repositório.

## Bases complementares (21/10/2026)

Integração autorizada pelo responsável em 21/10/2026. O PR #131 (fechado) montou um painel concorrente com doze rotas; dele vieram só as fontes, como matéria-prima. Nenhuma rota, arquitetura ou código minificado foi copiado. Cada original foi baixado de novo da fonte oficial em 21/10/2026 e conferido com a captura daquele PR (10/10/2026): CadINSAN, FNDE/PNAE, IPCA, SIDRA 9552 (domicílios), relação de municípios do IBGE e relatório do Ministério da Saúde idênticos byte a byte; as três consultas PAA do MI Social idênticas documento a documento (o cabeçalho do Solr muda o tempo de resposta a cada consulta). A distribuição percentual publicada da tabela 9552 (variáveis 9784 e 9785) foi capturada pela primeira vez nesta integração.

| Base | Fonte | Período | Território | Capítulo |
|---|---|---|---|---|
| EBIA por estado, urbano e rural | IBGE, PNAD Contínua, SIDRA 9552 | 2023 e 2024 | Brasil, 5 regiões, 27 UFs (urbano e rural só Brasil e regiões) | Necessidades |
| CadINSAN | MDS, relatório CadINSAN 2025, anexo municipal | Cadastro Único de janeiro de 2025 | 5.570 municípios (publicado); UF e Brasil (somas calculadas) | Necessidades |
| PNAE | FNDE, produto de dados 82 | 2009 a 2026 (2026 em curso) | Brasil e UF por rede; município, rede municipal, 2025 | Acesso (alunos, escolas) e Recursos (repasses) |
| IPCA dos alimentos | IBGE, tabela 7060 | janeiro de 2023 a setembro de 2026 | Brasil | Acesso |
| PAA | MDS, MI Social, fichas IN002 e IN003 | 2023, 2024 e 2025 | município (publicado); UF e Brasil (somas com cobertura) | Recursos |
| SISVAN | Ministério da Saúde, Relatório de Gestão Integrado 2025, tabela 10 | 2025, preliminar | Brasil, por fase da vida | Qualidade |

Diferenças em relação ao PR #131, corrigidas aqui: a EBIA usa o percentual publicado pelo IBGE em vez de razão recalculada de contagens arredondadas (61 valores estaduais, somadas as cinco classes, diferiam do publicado em 0,1 a 0,2 ponto percentual); o hífen do SIDRA nas células urbana e rural por UF, que o PR convertia em zero (108 observações), fica fora como não publicado.

Não integrado, com motivo na página de método: poder de compra em reais; estado nutricional por território; série de cobertura do gráfico 19 do relatório do Ministério da Saúde; EBIA municipal (não existe); PNAE municipal fora de 2025 e as 18 entidades sem correspondência exata de nome.

Reprodução: `python3 -m pipeline.eficiencia_alimentar.complementos --originais <pasta> --coletar` baixa, confere os hashes e compara a reextração com `seed/complementos.json.gz`; sem argumentos, valida o seed e grava `public/eficiencia/seguranca-alimentar/complementos.json` (versionado). `scripts/materializar-seguranca-alimentar.mjs` gera, do mesmo seed, um arquivo municipal por UF e seis CSV (gitignorados). Fichas em `pipeline/eficiencia_alimentar/catalogo-complementos.json`. Testes: `pipeline/tests/test_eficiencia_alimentar_complementos.py` e `src/tests/obee-alimentar-complementos.test.ts`.

## Recortes sociais da EBIA: "Quem passa fome no Brasil?" (21/10/2026)

Follow-up do PR #325, aprovado pelo responsável. Nove tabelas nacionais da PNAD Contínua (Segurança alimentar), 2023 e 2024, só Brasil, baixadas da API de valores do SIDRA em 21/10/2026 (duas capturas no mesmo dia, idênticas byte a byte), cada uma com domicílios em mil (variável 162), distribuição percentual (9784) e os dois coeficientes de variação publicados (5123 e 9785):

| Tabela | Recorte | Orientação do percentual |
|---|---|---|
| 9553 | Sexo da pessoa responsável | composição: % dos domicílios da classe que estão no grupo |
| 9554 | Cor ou raça da pessoa responsável (só branca, preta e parda) | composição |
| 9555 | Nível de instrução da pessoa responsável | composição |
| 9556 | Posição na ocupação e categoria do emprego da pessoa responsável | composição |
| 9557 | Número de moradores | composição |
| 9558 | Rendimento mensal domiciliar per capita, por situação urbana e rural (moderada e grave publicadas juntas) | composição |
| 9559 | Morador menor de 5 anos | distribuição: % dos domicílios do grupo em cada classe |
| 9562 | Morador menor de 18 anos | distribuição |
| 9560 | Morador com 60 anos ou mais | distribuição |

A tabela 9561 não existe no SIDRA (a API responde "Tabela inválida"; o catálogo de agregados não a lista). O IBGE não publica idade da pessoa responsável nem recortes por estado nessas tabelas; a 9751 (moradores por grupo de idade) conta pessoas e ficou fora.

Pipeline: `pipeline/eficiencia_alimentar/ebia_social.py`, seed `seed/ebia-social.json.gz` e manifesto `seed/ebia-social-manifesto.json` com o SHA-256 de cada original. `python3 -m pipeline.eficiencia_alimentar.ebia_social --originais <pasta> [--coletar]` confere os hashes (sem `--coletar`, original ausente reprova, nunca baixa) e compara a reextração com o seed. A gold única continua sendo `complementos.json`, agora com o bloco `ebia_social`, gravada por `python3 -m pipeline.eficiencia_alimentar.complementos`.

Portão (reprova antes de qualquer escrita): cobertura completa; classes da EBIA somam 100% e leve + moderada + grave = insegurança, em percentuais e em domicílios; grupos somam 100% em cada classe e os domicílios dos grupos somam o total (na cor ou raça, que não é partição, não passam do total); o total de cada tabela repete os domicílios da 9552. Tolerância declarada: 0,05 ponto percentual e 0,5 mil domicílios por parcela somada (arredondamento do IBGE). Exceção declarada: a 9558 tem 59 mil domicílios a menos que a 9552 em 2024 (44 mil em 2023), sem explicação na tabela; a diferença fica registrada e não é distribuída. Hífen, X, .. e ... viram ausência declarada; nas edições capturadas o único hífen é o CV de percentuais fixados em 100%.

Estimativa amostral: o painel marca com asterisco CV de 15% ou mais (limiar próprio, não regra do IBGE; hoje só "Empregador" em insegurança grave e moderada). Nenhuma diferença é apresentada como significativa: o IBGE não publica o teste nem a covariância. A única conta do painel é a parcela do grupo em cada classe nas tabelas de composição (domicílios do grupo na classe ÷ domicílios do grupo), marcada como calculada e sem CV.

Interface: seção "Quem passa fome no Brasil?" em `/eficiencia-estatal/seguranca-alimentar/necessidades` (com conta), componente de servidor `QuemPassaFome`: frases factuais, seis quadros de barras pareadas (parcela do grupo entre todos os domicílios e entre os em insegurança grave, escala comum desde zero), tabela das casas com crianças, adolescentes e idosos, tabelas de apoio com 2023 e 2024 e nota de método. Arquivo `ebia-grupos-sociais.csv` (com conta), gerado por `scripts/materializar-seguranca-alimentar.mjs`. O aperitivo da Eficiência Estatal só anuncia a seção. O tema passou ao cabeçalho comum (`CabecalhoEntrada` com `tema`, molde do PR #323). Testes: `pipeline/tests/test_eficiencia_alimentar_ebia_social.py` e `src/tests/obee-alimentar-ebia-social.test.ts`.
