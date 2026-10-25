# Captura real do BCB para o pacote C

CSV integral de 24/10/2026, recuperado em 25/10/2026 da release pública `pipeline-estado`, arquivo `pipeline-estado.20261024150225.tar.zst.00`. SHA-256 do pacote conferido contra o manifesto da release antes da extração.

- Origem: https://www.bcb.gov.br/pda/desig/desenrola/dados_desenrola.csv
- Bronze: `data/bronze/desenrola/20261024/dados_desenrola.csv.14b4deec1cc2.json` (a extensão do bronze não muda o conteúdo CSV).
- SHA-256 do CSV descomprimido: `14b4deec1cc239fd4e293a2b12e96190d4660ea8fa83cb31872d3b91e9a414f7`.
- 13.638 linhas: 11.242 de tipos 1 a 3 e 2.396 do tipo 4, entre maio e agosto de 2026.
- Licença declarada pelo coletor: Open Data Commons ODbL.
- Compactação gzip determinística (`mtime=0`), sem edição dos bytes da fonte.

O teste confere o hash, separação, ressalva, período, preservação e reprocessamento; não depende de rede. O tipo 4 continua sem significado atribuído. A implementação da recomendação D2 foi autorizada no pacote C em 25/10/2026; o merge espera a decisão do dono.
