# Reconciliação do Censo 2022 — decisão documentada

## Achado

A consulta nacional da tabela 10330, variável 13376, realizada em 10/10/2026, com total nas dimensões complementares, devolveu total de 67.325.501 pessoas. As sete faixas de tempo somam 66.793.191, diferença de 532.310. As 14 categorias de meio principal somam 66.161.956, diferença de 1.163.545. O diagnóstico foi executado por `diagnostico_censo.py`, sem alterar a fonte.

O primeiro teste tratava as categorias como exaustivas e admitia somente arredondamento. Essa premissa não é sustentada pela resposta oficial. A divergência é substantiva e NÃO foi rebatizada de arredondamento.

## Tratamento

Preservar as parcelas divididas pelo total publicado, sem reescalonar para 100%. Publicar também um diagnóstico calculado `total - soma das categorias`, visível nas duas distribuições e exportável com sua fórmula. Ele não é uma categoria fornecida pelo IBGE; não recebe interpretação como não resposta, modalidade ou erro. A causa permanece não determinada nesta integração.

Só calcular a diferença quando TODAS as células originais necessárias estão disponíveis; não inferir valores suprimidos. Denominador zero gera não aplicável. Pequeno resíduo negativo permanece no diagnóstico, sem ser truncado a zero e sem percentual publicado. Soma acima do total além do número de categorias bloqueia o candidato. Os totais de tempo e de modos precisam coincidir em cada território.

As páginas de tempo exibem a diferença após as categorias oficiais, com o título explícito “diferença entre total e categorias (calculada)”. A ficha explica o cálculo e o seu limite. Todas as medidas do Censo avisam que as categorias não esgotam necessariamente o total. O indicador acima de uma hora NÃO aloca parcela alguma desse resíduo a deslocamentos longos.

## Fontes verificáveis

- Metadados: https://servicodados.ibge.gov.br/api/v3/agregados/10330/metadados
- Tabela: https://sidra.ibge.gov.br/tabela/10330
- Diagnóstico nacional: logs do job 114241863297 do workflow de interface, no PR 136.
- Consultas exatas, captura e SHA-256 são mantidos no manifesto e no pacote de originais.

Esta decisão é uma leitura descritiva transparente das células publicadas, não uma confirmação externa da metodologia. A causa da diferença exige esclarecimento adicional na fonte.
