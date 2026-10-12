# Prévia interativa da revisão v3

Artefato de revisão, sem rota pública nem mudança de produção. Abrir `../revisao-interativa-v3.html` no navegador. Arquivo autocontido; não consulta APIs, não usa bibliotecas externas e não recalcula o escore. Geração: `python3.12 docs/obee/resultados/review-ui/generate.py`.

A tela apresenta 18 cenários e 26 capitais, comparação v2/candidata, perfis de percentis, pesos, decomposição e exportação CSV das 26 linhas do cenário. Os controles preservam estado na URL. A fonte é `cesta-conjunta.json`, cujo SHA-256 consta na página. O gerador confere as 468 notas e decomposições contra as identidades aritméticas antes de montar a prévia.

## Verificação em 12/10/2026

- Recife/Curitiba reconciliados: cenário principal material40 = 35,77/77,69; sete iguais = 37,09/82,69. Conectividade isolada com iguais: Recife 33,33; moradores >3 conjunto material40: Recife 35,00.
- Controle de habitação desabilitado quando não aplicável; troca de cidades e seleção da mesma capital verificadas. Tabela equivalente de percentis e pesos aberta e conferida.
- CSV baixado pelo navegador: 26 linhas, cenário conjunto moradores >3 material40 e ressalva em todas as linhas. A captura do evento de download pela automação excedeu o prazo; o arquivo efetivamente baixado foi localizado e lido, confirmando o resultado.
- Filtros mantidos ao recarregar. Navegação por Tab verificada entre controles. Sem leitor de tela ou teste de zoom 200% nesta rodada.
- Larguras 320, 390, 768 e 1440 px: largura do documento igual à viewport após correções. Tabelas e gráfico usam rolagem local em telas estreitas. Inspeção visual de início, gráfico e final no desktop; início no celular. Não afirmar acessibilidade integral.
- Quatro testes do pacote congelado passaram após a geração; nenhum dos seus 54 arquivos foi modificado. A prévia é material complementar, fora do pacote metodológico congelado.

Autoavaliação: direção de arte 8; hierarquia 8; tipografia 8; densidade 9; didática 9; comparabilidade 9; interação/acessibilidade 8; responsividade 8. Limitações: gráfico requer rolagem horizontal no celular; ausência de avaliação com leitor de tela e zoom. Sem atribuição de revisão independente. Captura: `preview.jpg`.

A revisão por responsável distinto da implementação permanece pendente. Não preencher registros de aprovação com resultados desta autoavaliação. A prévia facilita examinar a proposta; não resolve precisão municipal ou decide sua divulgação pública.
