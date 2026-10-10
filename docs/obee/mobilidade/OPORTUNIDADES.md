# Acesso a oportunidades: edição histórica Ipea/AOP

## Escopo implementado

Nona página do capítulo: `/eficiencia-estatal/mobilidade-transporte/oportunidades`.

Estimativas de acessibilidade de **2019**, ponderadas pela distribuição espacial da população de **2010**. Os períodos são exibidos antes dos controles. Não são informações da rede atual, viagens observadas, vagas de emprego abertas, matrículas disponíveis ou consultas realizadas.

Quatro oportunidades, em 30 e 60 minutos: empregos (CMATT), escolas de ensino fundamental (CMAEF), estabelecimentos de saúde de baixa complexidade (CMASB) e CRAS (CMACT). Automóvel, bicicleta e caminhada: 20 cidades. Transporte público: 9 cidades. Pico e fora do pico ficam separados nos modos motorizados; modos ativos não recebem distinção de horário fictícia.

Arquivos oficiais: 69 de acessibilidade e 20 de população, com 929.319 registros de origem/modo/horário e 390.030 células populacionais. O resumo tem 784 recortes e 12 grupos por recorte: total, dez decis e áreas sem decil válido. O CSV integral tem 9.408 linhas de cálculo, mais cabeçalho. Esses totais não representam pessoas ou viagens únicas.

## Fonte e linhagem

- Dados oficiais: https://www.ipea.gov.br/acessooportunidades/dados/
- Dicionário: https://ipea.github.io/aopdata/articles/data_dic_pt.html
- Catálogo: https://www.ipea.gov.br/geobr/aopdata/metadata/metadata.csv
- Estudos: Ipea, Textos para Discussão 2772 e 2800 (Pereira e colaboradores, 2022).

O manifesto registra URL, SHA-256, data de captura, ano, cidade, modo e contagem de cada arquivo. Cada resumo aponta para duas fontes: acessibilidade e população. A semente reduzida conserva cada célula das colunas utilizadas, incluindo zeros e ausências, e a linhagem dos 89 originais. Não conserva colunas que não entram nos cálculos.

## Fórmulas e denominadores

Para cidade, modo, horário, oportunidade e grupo, sejam `w_i = P001_i` e `a_i = CMA_i`. A população e a acessibilidade são associadas por código municipal e célula H3.

- Média: `sum(w_i * a_i) / sum(w_i)` nas células com peso positivo conhecido e estimativa válida.
- Cobertura: `100 * população coberta / população positiva de peso conhecido no arquivo populacional da cidade/grupo`.
- Sem oportunidade alcançável: `100 * população coberta em células com a_i = 0 / população coberta`.

Não se somam oportunidades sobrepostas entre pontos de partida. Célula sem estimativa não vira zero; célula sem peso conhecido é contabilizada como tal e não entra no denominador. Uma cidade sem fonte para um modo permanece na tabela com ausência explícita; não é exportada como linha de cálculo fictícia.

Os decis R003 descrevem **áreas**, não a renda individual de cada morador. São relativos a cada cidade, não patamares monetários comuns entre cidades. Foram encontrados códigos zero na variável de decil, fora de 1 a 10; ficam em “Sem decil válido”, preservados como zero na semente, sem remapeamento. Continuam no total da cidade quando há peso e estimativa válidos.

A cobertura populacional dos totais desta edição varia de aproximadamente 99,712% a 100%; cada recorte e cada grupo apresentam sua cobertura. A interface evita arredondar uma fração positiva inferior a 0,01% para zero e uma cobertura inferior a 100% para cobertura completa.

## Reprodução

Arquivos persistentes: `data/eficiencia_mobilidade/aop/{resumo.json,resumo.sha256,seed.json.gz.b64,pipeline.sha256}`.

1. Conferir o SHA-256 do resumo.
2. Decodificar a semente base64 e conferir o SHA-256 do gzip com `seedSha256` do resumo.
3. Descomprimir, interpretar o JSON e executar `aggregate` de `pipeline/eficiencia_mobilidade/oportunidades_normalizar.py`.
4. Comparar todos os campos ao resumo, exceto o campo acrescentado `seedSha256`.

O workflow de oportunidades faz essa reprodução sem rede quando o normalizador não muda. A recuperação inicial dos originais usou o artefato da coleta 38074320067; artefatos têm prazo de retenção. Depois de expirado, uma nova transformação que exija os originais deve repetir `oportunidades_coletar.py`, conferir as mudanças de fontes e registrar uma nova edição. A semente persistente continua permitindo reproduzir integralmente a edição existente sem depender do artefato.

## Validação

Há 12 testes Python de ponderação, zeros, ausências, duplicatas, grupos e horários. A UI/API têm testes de integridade, linhagem, cobertura, valores e filtros. O roteiro de navegador confere quatro larguras, gráficos e tabelas, CSV do recorte, todas as 9.408 linhas do CSV integral, arquivos JSON/gzip por SHA-256 e parâmetros inválidos. O relatório registra falhas e não relaxa critérios para aprovar.

Antes da integração visual, doze verificações independentes foram feitas por leitura dos CSV com pandas e associação direta: Recife, São Paulo e Belo Horizonte; pico e fora do pico; CMATT60 e CMASB30. As médias e os denominadores coincidiram. Exemplo de teste: Recife, transporte público, pico, CMATT60: média 145.515,61454361054; população coberta 1.528.300.

A aprovação de código ou navegador não atesta produção. O PR permanece separado da main até aceite e autorização. Não há alegação de avaliação estética independente, conformidade integral de acessibilidade, teste com usuários ou leitor de tela real.

## Limites do capítulo

O módulo do Ipea não altera o snapshot Censo/Pemob nem a cesta de escores. Mapas das células H3, mortes/lesões do SIM e despesas/obras reconciliadas do Siconfi não foram integrados nesta etapa. Acessibilidade física permanece em sua página própria.
