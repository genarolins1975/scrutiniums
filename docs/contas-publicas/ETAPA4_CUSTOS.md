# Etapa 4 — custos agregados e condições para produtividade

Integração do Relatório Foco em Custos 2025 (Tesouro Nacional, publicado em 17/06/2026). A página de custos mostra a composição de 2025 e a base revisada de 2024, com alternância entre valores e variações nominais/reais. Sete recortes hierárquicos permitem explorar as cinco naturezas principais, mão de obra, funcionamento, serviços, materiais e depreciação.

## Fonte e reprodução

Fonte: https://www.tesourotransparente.gov.br/publicacoes/relatorio-foco-em-custos-rfc/2025/114

Extração das tabelas das páginas 9, 11 e 15. O importador `scripts/contas-publicas/importar-custos.py` usa Python 3 e pypdf; aceita `--pdf ARQUIVO` ou baixa o documento oficial. O hash esperado impede atualização silenciosa para outra edição. O JSON registra URL, hash, publicação, captura, página de cada linha, unidade e controles.

Foram extraídas 27 linhas, com sete grupos exploráveis e 14 conferências de composição. Pais e filhos nunca são somados na mesma vista; repartições de receita e outras reduções patrimoniais ficam fora do total de custos. O anexo XLSX é uma classificação de contas, não uma base de valores; não foi usado para inferir observações.

## Precisão e revisões

A tabela da página 9 publica R$ 3.661.983,6 milhões em 2025 e R$ 3.429.963,1 milhões em 2024. O sumário da publicação informa, respectivamente, 3.661.983,5 e 3.429.963,2 milhões. Conservamos a tabela como referência. O maior resíduo entre total e parcelas é R$ 0,1 milhão; não foi distribuído artificialmente entre categorias. O importador limita a tolerância à soma dos intervalos de arredondamento das linhas e do total.

Percentuais nominais e reais são reproduzidos da fonte. O IPCA médio não foi substituído por IPCA de dezembro. Em componentes pequenos, recalcular taxas com valores já arredondados distorceria o resultado: juros e encargos de mora têm variação nominal publicada de 134,9%, distinta da obtida com os montantes arredondados 26,4 e 11,3 milhões.

A edição revisou a classificação de 2024 devido à metodologia da Proteção Social dos Militares, alterando Previdenciários e Assistenciais e Outros Custos. A ressalva permanece visível junto ao painel. Não conectamos mecanicamente esta base a edições históricas anteriores.

## Limites e próxima integração

O RFC oferece custos agregados da União. A API do Portal de Custos usa identificadores organizacionais SIORG; AFFO usa órgão/UO/ação/localizador. Coincidência numérica de códigos não demonstra identidade de universo. Custo por entrega exige atribuição contábil a um serviço, período compatível, produto homogêneo e tratamento de qualidade e complexidade. Produtividade por hora requer horas atribuíveis ao serviço. Não se publica nenhuma dessas razões antes de homologar os vínculos.

Os dois indicadores de custo unitário e produtividade permanecem pendentes no catálogo de 24 indicadores. O novo panorama é evidência complementar, não uma falsa homologação desses indicadores. Não há escore ou ranking de eficiência, nem comparação internacional de universos incompatíveis.

## Verificação

Testes do domínio verificam integridade da edição, composição hierárquica, separação dos itens fora de custos, resíduos e preservação de taxas publicadas. A cópia local não contém um snapshot de outro observatório exigido pela configuração geral de testes; a execução local usa configuração isolada do domínio, sem alterar os gates do repositório. CI completo e build são verificados no PR. Revisão visual e de interação registrada na descrição do PR após o deploy.
