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
