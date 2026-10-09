# Pedidos da família Modelos e Previsões (rotas /pld/modelos, /pld/modelos/[modelo] e /pld/previsoes)

Registro dos pedidos ao coordenador: arquivos que ficaram sem uso (para apagar no fim, com o servidor parado), mudanças em componentes compartilhados, equivalências para a matriz de preservação e o que está fora do meu escopo.

## Arquivos sem uso, para o coordenador apagar

Nenhum arquivo foi apagado por este executor, conforme a regra do servidor de desenvolvimento.

- `src/components/energia/PrevisoesLinkPainel.tsx`: cópia do `LinkDoPainel`; as páginas passaram a usar `SeguirPainel`, que já inclui `LinkDoPainel`. Nenhum import restante.
- `src/components/energia/ArquivoPrevisoes.tsx`: componente antigo ("O que a plataforma registrava naquele dia"), sem uso nas páginas. Só é lido como texto por `src/tests/energia-governanca.test.ts` (linha 117), que confere três trechos desse arquivo. Para apagá-lo, esse teste precisa mudar de alvo: a regra "número de rodada interna de modelo fora de produção nunca aparece como previsão" vive hoje em `numeroRetido()` e em `linhasArquivo()` de `src/lib/energia/previsoes.ts` (rótulo "número retido (rodada interna)"), e já tem teste de comportamento em `src/tests/energia-previsoes.test.ts` (grupo do arquivo de emissões). O teste de governança pode ler `previsoes.ts` e procurar `tipo === "RODADA_INTERNA" && estadoModelo !== "PRODUCAO"` e `número retido`, e `PrevisoesArquivo.tsx` para `registrado_no_portal_em`.

## Mudanças em componentes compartilhados

1. `src/components/energia/NavegacaoLocal.tsx` (faixa) com `.nav-faixa` de `src/app/globals.css`: abaixo de 640 px o CSS pede duas páginas por linha (`flex: 1 1 calc(50% - 0.25rem)`), mas o `gap-x-6` do `ol` soma 1,5 rem entre as colunas e nenhuma cabe ao lado da outra. Cada página ocupa uma linha inteira: nas fichas são seis linhas, mais de 260 px antes do título (em 390 px, o título da ficha começa em y 410). Vale para todas as filhas de todas as famílias. Sugestão: `gap-x-1 sm:gap-x-6` no `ol`. Nas fichas deste módulo apliquei uma correção local em `PrevisoesFaixaFichas` (`max-sm:[&_ol]:gap-x-1`), que pode sair quando o compartilhado mudar.
2. `src/components/evidencia/ModoProfundidade.tsx`: os três botões (Entender, Analisar, Auditar) medem 40 px de altura no celular (120 por 40 em 390 px, 97 por 40 em 320 px). Pedido: 44 px (`min-h-[44px]`).
3. `Numero` com `ComproveNumero` (faixa de métricas): o botão "Comprove este número" mede 103 por 32 px no celular. Pedido: alvo de 44 px no toque (padding vertical), sem mudar o tamanho do texto.
4. `src/components/energia/TabelaInterativa.tsx` (linha 416): o rótulo "Recorte atual:" usa "atual" como estado. Sugestão: "Recorte:". Outras famílias já registraram o mesmo.
5. `src/lib/energia/mapa.ts`, bloco `"pld-modelos"` (linha 483): o rótulo "Previsão atual por submercado e entrega" descreve o desenho antigo. A página agora responde "O que foi publicado antes do resultado?" e a rodada é "a mais recente", não "atual". Sugestão: "Rodada mais recente: referência B0 por submercado e entrega". As âncoras `#p013` a `#p016` existem e foram mantidas.
6. `TabelaInterativa` (opcional): em tabelas curtas com texto longo (matriz de modelos, entradas e fórmulas) a rolagem horizontal no celular esconde colunas. Resolvi localmente com `src/components/energia/PrevisoesTabela.tsx` (`TabelaAdaptativa`: tabela a partir de 768 px, lista de blocos abaixo disso, com rótulo e valor lado a lado a partir de 360 px). Se o coordenador quiser o mesmo comportamento em outras famílias, o componente pode subir para o sistema.

## Equivalências para a matriz de preservação

A ficha de cada modelo teve o painel principal renomeado: a pergunta "Como o X calcula a previsão do PLD?" virou o título da página (H1) e o painel passou a se chamar "Situação, entradas, fórmula e limites do X". Mesmo painel (`id` `ficha-<modelo>`), mesmo conteúdo. Para `docs/energia/redesign/equivalencias.json`:

```json
{
  "/setor-eletrico/pld/modelos/b0": [{ "antes": "painel|como o b0 calcula a previsão do pld?", "depois": "painel|situação, entradas, fórmula e limites do b0", "justificativa": "Pergunta passou a ser o título da página; o painel foi renomeado, mesmo id e mesmo conteúdo." }],
  "/setor-eletrico/pld/modelos/c1": [{ "antes": "painel|como o c1 calcula a previsão do pld?", "depois": "painel|situação, entradas, fórmula e limites do c1", "justificativa": "Pergunta passou a ser o título da página; o painel foi renomeado, mesmo id e mesmo conteúdo." }],
  "/setor-eletrico/pld/modelos/c2-h": [{ "antes": "painel|como o c2-h calcula a previsão do pld?", "depois": "painel|situação, entradas, fórmula e limites do c2-h", "justificativa": "Pergunta passou a ser o título da página; o painel foi renomeado, mesmo id e mesmo conteúdo." }],
  "/setor-eletrico/pld/modelos/c2-p": [{ "antes": "painel|como o c2-p calcula a previsão do pld?", "depois": "painel|situação, entradas, fórmula e limites do c2-p", "justificativa": "Pergunta passou a ser o título da página; o painel foi renomeado, mesmo id e mesmo conteúdo." }],
  "/setor-eletrico/pld/modelos/s0": [{ "antes": "painel|como o s0 calcula a previsão do pld?", "depois": "painel|situação, entradas, fórmula e limites do s0", "justificativa": "Pergunta passou a ser o título da página; o painel foi renomeado, mesmo id e mesmo conteúdo." }]
}
```

Com essas cinco equivalências, o comparador casa as 41 visões anteriores das sete rotas, sem filtros, arquivos nem fichas "Comprove este número" a menos (Modelos 8 e 8; Previsões 3 antes e 5 depois).

## Fora do meu escopo

- `src/components/energia/PldPagina.tsx`: não precisei mudar. As páginas de Modelos e Previsões não importam mais nada dele.
- Textos escritos pelo pipeline (gold) que aparecem nas páginas e que não alterei: `pipeline/energia/modulos/previsoes.py` linha 509 ("Nenhuma execução agendada registrada até agora", em Analisar e Auditar), linha 745 (indicador "da rodada atual", no "Sobre este dado"), linha 1336 ("positivo = melhor que a persistência", na definição do ganho, em Analisar) e linhas 760 e 803 (estado "CALIBRADO" em maiúsculas dentro da frase). Nas páginas, o "Sobre este dado" passa por `provenienciaParaLeitor` ("rodada mais recente"), a frase das faixas por `semCodigoDeEstado` ("calibrado") e as falhas conhecidas da ficha por `motivoGravado` (troca ", porque" por "; motivo gravado:"), todos em `src/lib/energia/previsoes.ts` e com teste. O texto original continua na gold e em Auditar. Em Auditar também aparecem códigos de estado crus do registro (`DOCUMENTADA_COM_EVIDENCIA`, `NAO_CONCLUIVEL_NO_REPOSITORIO`, `LIBERADA`), que mantive por serem o nível técnico.
- Testes de outras famílias que falharam quando rodei a suíte: `src/tests/energia-pld.test.ts` ("histórico: a faixa sazonal e a distribuição por regime anual dizem nominal...", página do histórico do PLD em migração por outro executor), `src/tests/energia-conteudo-r8-R.test.ts` ("Element type is invalid", página de Carga ou Rede em migração) e `src/tests/energia-interface-r2.test.ts` (Geração, `chaveUrl="dia"`). Não toquei neles.
