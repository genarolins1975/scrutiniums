# Revisão independente — Educação PR1, capturas finais

2026-10-25. Revisão somente leitura, sem iniciar navegador, servidor, build ou testes. Skill local observatorio-layout, §10. Evidência: `/tmp/educacao-pr1-final`, build `_EJJyq96po1sZeHCxtPfs`. Não é aprovação de interação manual nem alegação de implantação.

## Capturas efetivamente abertas

Abri as páginas completas e as primeiras telas das quatro rotas abaixo, em **390, 768 e 1440**, em **com e sem sessão**: 24 completas e 24 primeiras telas. Nomes de arquivo: prefixo + `-{largura}-{com|sem}-sessao.jpg`, e correspondente `-primeira-tela.jpg`.

- `/educacao-municipal`: prefixo `educacao_municipal`.
- `/educacao-municipal?ibge=2800100`: `educacao_municipal_ibge_2800100` (Amparo do São Francisco, SE).
- `/educacao-municipal?ibge=2611606`: `educacao_municipal_ibge_2611606` (Recife, PE).
- `/educacao-municipal/municipio/2800100`: `educacao_municipal_municipio_2800100`.

Capitais e mapa não receberam nova revisão visual final nesta rodada: não são páginas alteradas no PR1. Revisão anterior de base registrada em `/tmp/revisao-educacao-antes.md`; intermediária em `/tmp/revisao-educacao-depois-intermediario.md`.

Páginas completas foram abertas para sequência, proporção e ausência de sobreposição; o visualizador reduz páginas longas a 2048 px de altura. A ficha390 foi reaberta em modo original (ainda reduzida a6000 px). Primeiras telas permitiram ler os rótulos em resolução suficiente. Isso limita a certificação de texto minúsculo e controles nas partes inferiores; ver adendo de recortes, quando disponível.

## Resultado visual

Melhora substancial: cidade selecionada precede a escala nacional, e a ficha concentra profundidade; séries principais ocupam uma faixa inteira, tabelas longas estão recolhidas e há apenas um laboratório por página. Identidade duplicada da ficha foi removida. Não observei sobreposição ou clipping na composição geral ou nas primeiras telas.

As referências UF/Brasil estão visíveis na primeira tela390 de Amparo e Recife com sessão. O link para a ficha já aparece na primeira tela de Recife; em Amparo fica logo abaixo, pois o nome maior ocupa duas linhas. Não considero isso bloqueio. No aperitivo, notas, unidade e etapa aparecem sem sessão, antes do convite. A ficha sem sessão apresenta o aperitivo de Amparo; o relatório automático confirma redirecionamento ao endereço público com IBGE preservado.

Limitações editoriais concretas, sem novo bloqueio funcional demonstrado:

1. **Busca afastada da cidade selecionada**: na entrada com sessão, escala nacional e “Para você” separam o extrato de “Escolher outro município”. Em390 é uma viagem longa para trocar a cidade. Local: `src/components/educacao/PainelEducacao.tsx:48` e `:173`. Não é regressão de acesso, mas mantém hierarquia abaixo de excelente. A entrada sem cidade também deixa a busca depois da escala e atalhos.
2. **Notas repetidas nos oito gráficos de componentes**: unidade precisa permanecer local, mas a frase de lacuna/pandemia é repetida em cada figura, alongando especialmente a ficha390. Local: `src/components/educacao/PainelEducacao.tsx:347`. Uma nota por etapa poderia preservar a ressalva com menos repetição.
3. **Primeira tela da ficha390**: o segundo valor fica parcialmente abaixo da dobra. Há boa identificação, mas a expansão integral do nome do IBGE e o subtítulo do extrato ainda ocupam espaço. Não há perda do valor ao rolar; apenas uma limitação de hierarquia/densidade.
4. **Cromo768 com sessão**:310px nas entradas, conforme evidência automática. Permanece alto e desloca o conteúdo, embora menor que332px da base. Não é falha nova específica da ficha.
5. **Rodapé móvel extenso**: ocupa grande parcela dos aperitivos. É compartilhado e preexistente; não proponho ampliar o PR1 para redesenhá-lo.

## Alturas verificadas pelos arquivos finais

Incluem rodapé, com seções inicialmente recolhidas. Valores em px, ordem390/768/1440.

| Página | Sem sessão | Com sessão |
|---|---:|---:|
| Entrada sem cidade |3937 /2696 /2053|7996 /5803 /4776|
| Entrada Amparo |4360 /2952 /2267|8108 /5922 /4930|
| Entrada Recife |4468 /3060 /2362|8053 /5922 /4930|
| Ficha Amparo |4360 /2952 /2267 (aperitivo)|12210 /8685 /8166|

Entradas atendem aos tetos11000/6500 e aperitivos4500/2500 em390/1440. A ficha é deliberadamente detalhada; não apliquei a ela o orçamento da entrada. O aperitivo Recife fica32px abaixo do teto móvel, portanto há pouca margem para acréscimos de texto.

## Rubrica §10, por página e estado

Notas são julgamento independente sustentado apenas pela evidência descrita; NV significa não verificado. Não calculei média nem elevei notas para atingir meta9.

| Página/estado | Arte | Hierarquia | Tipo/acabamento | Densidade/profundidade | Didática | Comparabilidade | Interação/acessibilidade | Responsividade |
|---|---:|---:|---:|---:|---:|---:|---|---:|
| Entrada sem cidade, com sessão |8|7|8|8|8|8|NV|8|
| Entrada Amparo, com sessão |8|8|8|8|8|8|NV|8|
| Entrada Recife, com sessão |8|8|8|8|8|8|NV|8|
| Aperitivo sem cidade |8|9|8|8|8|8|NV|8|
| Aperitivo Amparo |8|9|8|8|8|8|NV|8|
| Aperitivo Recife |8|9|8|8|8|8|NV|8|
| Ficha Amparo, com sessão |8|8|8|8|9|9|NV|8|
| Ficha Amparo, sem sessão |8|9|8|8|8|8|NV|8|

Justificativas: identidade sóbria e coerente, mas não considero demonstrada excelência de todos os estados; acabamento consistente nas primeiras telas, com expansão de siglas e repetição de notas ainda pesando. Hierarquia9 nos aperitivos decorre de pergunta → cidade/busca → explicação → convite, sem concorrência com escala nacional. Ficha ganha9 em didática/comparabilidade pela sequência resultado → série → decomposição → referência/porte, escalas explícitas, lacunas preservadas, referência2021 e três universos identificados. Responsividade8: empilhamento preserva informação, porém tabela de matrículas exige rolagem interna e cabeçalhos/legendas precisam de inspeção interativa. Interação/acessibilidade NV porque screenshots não provam foco, arraste, retorno de teclado, toque ou leitor de tela.

## Limites e evidência de terceiros

`evidencias.md` reporta HTTP200, nenhuma rolagem horizontal da página, Axe0, console0 e nenhuma requisição indevidamente redirecionada ao login nas quatro rotas revisadas. Esses são resultados do processo do agente principal, lidos nesta revisão, não testes executados por mim. As tabelas fechadas não foram abertas por mim; seus dados e estados exigem a suíte/interação do agente principal. A nota NV de interação só deve ser substituída por evidência real, preferencialmente manual além da automação, como pede a skill.

## Adendo — recortes finais da ficha390

Abri em resolução original os três recortes `/tmp/educacao-ficha-final-detalhe-{0,1,2}.png`, extraídos pelo agente principal em y1500,2700,4100 (1500px cada).

- Legenda de séries e de metas é legível, sem cortes: preenchido/alcançou, vazado/não alcançou e ausência de marca quando falta Ideb. Referência2021/pandemia, períodos sem dado e finais Cidade/SE/Brasil aparecem claramente. Cores não são o único código visual, pois traços e texto reforçam a leitura.
- Botões “Aprovação de todos (P = 1)” e “Valor publicado” estão inteiros, separados e com borda visível. Controles N/P mostram valores com quatro casas e rótulos completos; a fórmula quebra antes do5,3 no celular, mas permanece compreensível e sem clipping. A ressalva de arredondamento e de não causalidade está visível junto ao modelo.
- Componentes mantêm eixos0–10,0–1 e0–500, unidades locais e lacunas. Confirma-se a repetição da mesma nota de lacuna/pandemia em cada figura; melhoria editorial possível, não perda de informação.

Esses recortes resolvem a limitação de legibilidade estática dos controles/legenda na ficha390. Não provam operação, foco ou leitura por tecnologia assistiva. Segundo atualização do agente principal, a suíte geral interrompeu numa asserção de países duplicados do Judiciário e estava sendo repetida sem captura concorrente; ainda não havia aprovação final da suíte de navegador da Educação no momento desta revisão. Não trato esse evento como defeito comprovado deste PR.
