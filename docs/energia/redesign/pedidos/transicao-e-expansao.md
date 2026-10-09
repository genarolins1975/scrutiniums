# Pedidos da família Transição e ambiente e Expansão

Rotas `/setor-eletrico/transicao` (e `/mmgd`, `/energia-estimada`, `/emissoes`) e `/setor-eletrico/expansao` (e `/carteira`, `/cronograma`, `/geracao-e-transmissao`, `/cenarios`). Cada pedido diz o que mudar, por que e em que arquivo. Nenhum bloqueia as páginas: elas seguem com a melhor solução local, descrita em cada item.

## 0. Arquivos sem uso, para o coordenador apagar no fim (com o servidor parado)

Nenhum arquivo foi apagado por este executor.

- `src/components/energia/ExpansaoLinkPainel.tsx`: nenhum import restante. O rodapé de cada painel passou a usar o `SeguirPainel` compartilhado (mesmo botão "Copiar link deste painel", mesmo endereço e mesma mensagem).
- `src/components/energia/TransicaoLinkPainel.tsx`: idem. Ao apagar, tirar `"TransicaoLinkPainel"` da lista de arquivos da verificação de hexadecimal em `src/tests/energia-transicao.test.ts` (teste "sem estado de construção, sem hexadecimal solto...", o `for (const f of [...])` do fim), porque o teste lê o arquivo.
- `docs/observatorios/energia/modulos/transicao.md` (linha 20) e `docs/observatorios/energia/modulos/expansao.md` (linha 21) citam os dois arquivos na lista de componentes.

## 1. `NavegacaoLocal variante="capitulos"` não aceita resumo por item

Na abertura de cada módulo, os capítulos precisam de nome, pergunta, resposta curta, grandeza ou unidade, limite e link para a página (a resposta curta e o limite da leitura são o que o leitor usa para decidir se abre a página). `NavegacaoLocal` aceita só rótulo, descrição e href. Proposta: aceitar `children` (ou `resumo`) por item e `nivelTitulo` do rótulo do item. Local: `ExpansaoCapitulos` e `TransicaoCapitulos` (em `ExpansaoPagina.tsx` e `TransicaoPagina.tsx`) escrevem a mesma estrutura (`nav` com `data-navegacao-local="capitulos"`, `h3` do bloco, `h4` por item, `li` com `id="sintese-<painel>"`, `scroll-mt-28` e alvo de 44 px no link). Quando o componente compartilhado aceitar o resumo, os dois locais viram `NavegacaoLocal`.

## 2. Medidas sem evidência na gold (pedido ao pipeline)

O contrato diz que "Comprove este número" só existe onde a gold publica a evidência. As medidas abaixo estão na faixa de abertura, vêm do mesmo seletor que alimenta a tabela e o CSV, mas a gold não traz uma evidência com fórmula, numerador e denominador para elas. Ficam sem a ficha de prova; o teste de cada família as lista por nome (`SEM_FICHA`) para que um número novo sem prova falhe.

- Expansão: "Em construção" (potência outorgada da fase Construção, 145 usinas); "Prevista para o restante do ano", "Em datas convencionais em bloco" e "Com cronograma atrasado, segundo a fiscalização" (cronograma); "Transformação nova em obras em andamento" (MVA do SIGET); "Capacidade instalada nacional" no início do horizonte do PDE (só o fim, dez/2035, tem evidência).
- Transição: "MMGD conectada no ano" e "Potência por habitante no Brasil" (cadastro); "Participação na carga global", "MMGD estimada no último ano completo" e no primeiro ano completo (energia estimada); "Fator médio anual" do ano anterior e "Fator médio" do mesmo mês do ano anterior (emissões).

## 3. `PAGINAS_MAPA` e a pergunta da tela

`src/lib/energia/mapa.ts` (linhas 120 e 126) traz a pergunta de cada módulo: Expansão com "Quanta capacidade está chegando, e de que fontes?" e Transição com "Como a transformação do setor se distribui e afeta as emissões?". As telas 17 e 18 do redesenho perguntam "O que está sendo construído?" e "Como a matriz está mudando?". As páginas passaram a usar as perguntas novas como título (`PERGUNTA_EXPANSAO` e `PERGUNTA_TRANSICAO`, constantes novas em `expansao.ts` e `transicao.ts`); a pergunta antiga da Expansão continua como título do primeiro painel (`PERGUNTA_CAPACIDADE`), então `PAGINAS_MAPA.expansao.pergunta` ainda aparece na página e o teste `energia-expansao.test.ts` ("a síntese responde à pergunta do mapa") passa. Para a inicial e a navegação dizerem a mesma coisa que o título, trocar os dois textos em `mapa.ts` pelas constantes novas.

## 4. Pergunta do painel de energia estimada com 12 palavras

`PERGUNTA_ONS` ("Quanta energia a MMGD entrega ao SIN, segundo a estimativa do ONS?", em `src/lib/energia/transicao.ts`) é o título do painel e fica com 12 palavras. O `h1` da página é outro texto, descritivo e curto ("Energia da micro e minigeração distribuída no SIN", 8 palavras), e o título da figura não repete o dele. A pergunta continua como está porque `docs/observatorios/energia/modulos/transicao.md` e o inventário de visões a citam. Se a regra de 5 a 9 palavras valer também para a pergunta do painel, trocar a constante (e esses dois documentos).
