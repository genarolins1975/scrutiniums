# Publicação reproduzível e fontes complementares

As oito bases alimentam doze telas públicas, com universo, período, unidade, ausência, cobertura e fonte junto das medidas. A publicação não depende de uma nova coleta durante a compilação.

## Distribuição dos dados

`pipeline/eficiencia_alimentar/distribuicao/manifest.json` identifica 35 arquivos do núcleo; `paa-manifest.json` adiciona seis arquivos. Os pacotes comprimidos preservam os bytes originais dos snapshots e dos brutos. Partes base64 pequenas permitem versionar o conjunto. Não são código executável.

`scripts/materializar-alimentacao.mjs` valida o pacote, o manifesto, cada caminho, tamanho e SHA-256 antes de escrever qualquer arquivo. Materializa os 41 arquivos em `public/eficiencia/seguranca-alimentar`. `scripts/preparar-alimentacao.mjs` produz índices nacionais/estaduais e partições municipais por UF sem perder observações. Ambos rodam no preparo da aplicação e dos testes. Nenhum dado ausente recebe zero.

Os JSON completos permanecem disponíveis para reprodução; a abertura das telas usa índices menores e carrega municípios por UF. A rota `dados.csv?base=<nome>.json` entrega todas as observações da base em CSV progressivo. Os downloads visíveis também exportam exatamente o recorte apresentado. As bases aceitas são snapshot, cadinsan, sisan, aquisicao, precos, escolar, saude e paa.

Para alterar dados, executar o capturador oficial correspondente, seus testes e o empacotador. `python3 scripts/eficiencia/empacotar-alimentacao.py paa` atualiza somente o suplemento. Revisar o manifesto e repetir a auditoria antes de publicar. Os capturadores são ferramentas de manutenção, não executados na visita do cidadão.

## IPCA e PNAE

`capturar-alimentacao-complementos.py` preserva o IPCA oficial, quatro categorias e duas medidas de janeiro de 2023 a setembro de 2026 (360 observações). Inflação não é preço de cesta em reais nem peso do alimento no orçamento familiar. O hash refere-se ao JSON original descomprimido.

O produto 82 da Plataforma Antonieta de Barros/FNDE fornece repasses, alunos e escolas registrados de 2009 a 2026. São 100.682 linhas únicas por entidade e ano e 28.172 observações publicadas. O hash identifica o arquivo gzip original do FNDE. Os 921 campos de repasse ausentes continuam ausentes; somas parciais indicam cobertura. O exercício de 2026 é parcial e não aparece como variação anual comparável a um exercício encerrado.

Os recortes municipais mostram 2025 na rede municipal. Dezoito denominações não foram conciliadas com a relação atual de municípios: permanecem nos agregados Brasil/UF e no arquivo de conciliação, sem associação forçada. Alunos/escolas registrados não comprovam pessoas únicas, frequência, refeições ou execução total do orçamento.

## Vigilância alimentar e nutricional

`capturar-sisvan-relatorio.py` reproduz a tabela 10 do Relatório de Gestão Integrado 2025 do Ministério da Saúde (página impressa 56). São cinco fases da vida, dez observações preliminares nacionais, indivíduos avaliados e cobertura do acompanhamento; gestantes não entram nessa tabela. O bruto preserva o texto extraído e seu hash, e a documentação identifica também o hash do PDF integral oficial.

Os 63.843.170 registros somados das fases não autorizam tratar o resultado como pessoas únicas ou prevalência nutricional. A cobertura geral apresentada em outro gráfico do relatório não foi integrada: seu denominador não está reconciliado com essa tabela. Não há prevalência municipal de desnutrição, obesidade ou qualidade da dieta nessa publicação.

## Validação

A compilação final e a suíte completa passaram em 9 de outubro de 2026: 180 arquivos, 4.385 testes aprovados e um teste preexistente ignorado. Os relatórios independentes registram recomputação das fontes, correções e avaliação das telas. Um aceite visual não transforma ausência de dados em cobertura publicada.
