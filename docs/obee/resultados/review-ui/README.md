# Prévia interativa da revisão v3

Artefato de revisão, integrado ao preview do OBEE e sem mudança de produção. Também é possível abrir `../revisao-interativa-v3.html` no navegador. Arquivo autocontido; não consulta APIs, não usa bibliotecas externas e não recalcula o escore. Geração: `python3.12 docs/obee/resultados/review-ui/generate.py`.

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

## Integração ao preview em 12/10/2026

A rota `/eficiencia-estatal/laboratorio-cesta` serve o mesmo artefato pelo Next.js. A regra existente `pilotPreviewEnabled` permite `VERCEL_ENV=preview`, ou desenvolvimento local sem `VERCEL_ENV`. Produção, ambientes desconhecidos e execução de produção sem identificação retornam 404 antes de ler o HTML. Não há parâmetro de URL que habilite o acesso. A página é dinâmica, sem cache e com instrução de não indexação; essas instruções não substituem autenticação. O laboratório é uma superfície experimental, não um ambiente privado.

O link no piloto leva as duas capitais selecionadas. O retorno ao panorama acompanha mudanças de capital feitas no laboratório. O artefato foi incluído explicitamente no rastreamento de arquivos do Next.js para estar presente no pacote da rota.

Validação local: 21 testes passaram nos arquivos `obee-laboratorio-cesta.test.ts` e `obee-piloto-resultados.test.ts`; lint dos três arquivos TypeScript envolvidos sem avisos ou erros. HTTP real da rota respondeu 200 com `private, no-store`, `noindex` e `nosniff`. Percurso laboratório → panorama → laboratório confirmado no navegador com Recife/Curitiba; troca para São Paulo atualizou o destino de retorno. Captura: `preview-integrado.jpg`. O bloqueio de produção foi verificado pelos testes automatizados; não houve publicação da rota em produção nesta etapa.

Para reproduzir localmente, instalar dependências, executar os scripts de materialização usados pelo projeto e iniciar `npm run dev`. A verificação completa de tipos e build pertence ao CI do PR; os testes locais acima não equivalem a essa passagem integral.
