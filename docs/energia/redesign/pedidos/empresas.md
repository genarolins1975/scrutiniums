# Pedidos de mudança compartilhada: família Empresas

Rotas `/setor-eletrico/empresas`, `/empresas/ativos`, `/empresas/controle`, `/empresas/distribuidoras`, `/empresas/financas` e as 123 fichas `/empresas/[entidade]`. Cada pedido diz o que mudar, por que e em que arquivo. Nenhum bloqueia a família: as páginas seguem com a melhor solução local, descrita em cada item.

## 0. Arquivos sem uso para apagar no fim (regra do coordenador: não apagar com o servidor no ar)

- `src/components/energia/EmpresasLinkPainel.tsx`: nenhum arquivo o importa mais. O rodapé de cada painel passou a usar o `SeguirPainel` compartilhado, por meio de `EmpresasSeguir` (em `EmpresasPagina.tsx`), que já traz o "Copiar link deste painel" pelo `LinkDoPainel`. Nenhum teste nem documento o cita.
- Componentes e funções que saíram de `EmpresasPagina.tsx` sem substituto de mesmo nome (a conversão do guia): `EmpresasAnalise` e `EmpresasAuditoria` viraram `SecaoDoPainel` com `nivel`; `EmpresasSubtitulo` e `EmpresasResposta` viraram `PainelEvidencia` (subtítulo) e `RespostaCurta`. O arquivo foi reescrito, então não há resto a apagar.
- `docs/observatorios/energia/modulos/empresas.md` descreve dados e método, não componentes: nada a ajustar ao apagar o arquivo acima.

## 1. Capítulos com resposta e número por página: cada abertura escreveu o seu componente

A abertura de Empresas mostra as quatro páginas irmãs como capítulos que já respondem à pergunta (resposta curta, um número com ficha "Comprove este número", o limite da leitura e o caminho para a página). `NavegacaoLocal` (variante capítulos) só traz nome, pergunta e link, então a família escreveu `EmpresasCapitulos` (`src/components/energia/EmpresasPagina.tsx`, com `data-navegacao-local="capitulos"` e as âncoras `sintese-p036` a `sintese-p039`). Expansão, Transição e Mercado escreveram o seu. Proposta: um `CapitulosComResposta` compartilhado, com itens `{id, rotulo, pergunta, resposta, numero, contexto, limite, extra}` e `nivelTitulo` (2 fora de painel, 3 dentro).

## 2. Faixa de métricas no celular: quatro medidas gastam cerca de 520 px

Em 390 px a faixa de quatro medidas ocupa entre 420 e 595 px de altura (de y=558 a y=1.153 nas filhas e nas fichas), e a figura principal começa entre y=1.416 e y=1.944 (ativos 1.436, controle 1.416, distribuidoras 1.833, finanças 1.944, ficha de CEMIG-D 1.931). O primeiro número real está na primeira tela, mas o começo do gráfico não. Em 1440 por 900 o começo da figura fica em y=859 (ativos) e y=915 (controle); distribuidoras e finanças começam pelo comparador (a caixa de escolha de companhias vem antes do gráfico, em y=1.121 e y=1.258). Proposta: `FaixaMetricas` com duas colunas (2 por 2) a partir de 360 px quando o rótulo cabe em uma linha, ou uma variante compacta com rolagem horizontal marcada. Local: `src/components/energia/FaixaMetricas.tsx` e a variante `faixa` de `Numero.tsx`. Solução local: rótulos de uma linha, notas de uma ou duas linhas, a resposta curta depois da figura (`RespostaCurta depois`) e título de página com 5 a 9 palavras em uma linha.

## 3. Fichas "Comprove este número" para medidas contadas pelo observatório

A gold de Empresas só publica ficha para a potência com donos identificados (99,91%), os módulos de transmissão ligados ao CNPJ, o HHI por grupo e as séries de receita. As medidas de abertura (22.798 usinas em operação, 220.658,9 MW, 5.581 proprietários identificados, CR4, CR10, fronteira de 220.501,8 MW) não têm ficha própria: a ficha dos 99,91% traz o universo (22.798 usinas) e o denominador (220.658.886 kW), que cobrem as duas primeiras. DEC, FEC e a tarifa B1 de cada distribuidora também não têm ficha, porque as bases de Qualidade e de Conta de luz não publicam ficha por distribuidora (a ficha por CNPJ de `perdas_evidencias_tarifa.json` é de outra medida, os componentes de perdas na tarifa). As páginas dizem isso na própria faixa; o teste `energia-empresas.test.ts` lista as medidas sem ficha e exige ficha em todas as demais. Pedido ao pipeline (próxima coleta): fichas para essas medidas.

## 4. Verbetes e rótulos de Empresas fora do escopo da família

`src/lib/energia/siglas.ts`, `src/lib/energia/mapa.ts` e `src/lib/energia/navegacao.ts` ainda usam "Quem é dono de quê no setor elétrico?" e "Quem participa do setor e como atua?" como pergunta de Empresas, e o título novo da abertura é "Quem atua no setor elétrico?". A pergunta de Cadastro e ativos mudou de "Quem opera quais ativos?" para "Quem são os donos dos ativos?" (título de página com 5 a 9 palavras; a propriedade direta é o que o SIGA registra). `docs/energia/redesign/dados/visoes_antes.json` e `docs/energia/INVENTARIO_VISOES_REDESENHO.md` guardam a pergunta antiga, como registro do "antes".

## 5. Achados de conteúdo e de dado vistos e não corrigidos

- Siglas de exibição truncadas na fonte de tarifas (16 caracteres) aparecem no título da ficha, no índice e nos gráficos: CPFL-PIRATINING, CPFL SUL PAULIST, CPFL LESTE PAULI e CERSAD DISTRIBUI (o SAMP traz "CPFL SUL PAULISTA" e "CERSAD DISTRIBUIDORA"; para Piratininga e Leste Paulista não há outra sigla). A prioridade da sigla de exibição (tarifas, continuidade, SAMP, cadastro de agentes) está na gold; sugestão: preferir a sigla mais longa que começa com a truncada.
- Razão social em caixa alta e sem acento no cadastro (DISTRIBUICAO, ELETRIFICACAO) e com " - " dentro do nome (ENERGISA MATO GROSSO - DISTRIBUIDORA DE ENERGIA S.A.). O lead da ficha mostra o nome como a fonte o entrega.
- "Proprietários identificados" (5.581) conta CNPJ distintos de 14 dígitos, em todas as fases do SIGA; matriz e filial contam separadas, e 15 não estão no cadastro de agentes. A página diz isso na nota da medida.
- Micro e minigeração distribuída está fora do SIGA e fora de todas as medidas de capacidade do módulo; a nota da faixa da abertura e de Cadastro e ativos diz isso.
- A taxa nacional de perdas é a razão entre somas das 51 concessionárias com os 12 meses do ano e sem alerta (não a média das taxas); a leitura "abaixo" ou "acima da taxa nacional" na ficha usa essa referência e só vale para concessionária de ano completo.
- A receita da companhia padrão da abertura (AXIA) é uma escolha determinística: a companhia ativa de maior ativo total sem controladora aberta acima dela. A nota da medida diz isso, e a página de finanças permite trocar.
- O texto "SAMP Balanço" na proveniência das distribuidoras (rodapé "Fontes" do painel) vem da gold e não expande a sigla; as páginas de Empresas expandem SAMP no recorte e nos capítulos.
- A vigência da tarifa B1 é decidida na data do arquivo de tarifas, que a gold de Empresas não repete: a página de distribuidoras lê `data_referencia` da gold de Conta de luz para datar a medida "Com tarifa residencial vigente".

## 6. Pendências da família

- Avaliação independente inicial de Empresas não foi feita (não existe `avaliacao/inicial/empresas_*.json`): o critério de pronto foi tratado pelo guia, pela rubrica e pelas lições (a) a (l) do coordenador.
- Medidas da primeira tela: ver o relatório final da família; as de 390 px dependem do pedido 2.
