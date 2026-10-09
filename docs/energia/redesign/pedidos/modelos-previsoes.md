# Pedidos da família Modelos e Previsões (rotas /pld/modelos, /pld/modelos/[modelo] e /pld/previsoes)

Registro dos pedidos ao coordenador: mudanças em componentes compartilhados, arquivos que ficaram sem uso (para apagar no fim, com o servidor parado) e o que está fora do meu escopo.

## Arquivos sem uso, para o coordenador apagar

Nenhum arquivo foi apagado por este executor, conforme a regra do servidor de desenvolvimento.

- `src/components/energia/PrevisoesLinkPainel.tsx`: cópia do `LinkDoPainel`; as páginas passaram a usar `SeguirPainel`, que já inclui `LinkDoPainel`. Nenhum import restante.
- `src/components/energia/ArquivoPrevisoes.tsx`: componente antigo ("O que a plataforma registrava naquele dia"), sem uso nas páginas. Só é lido como texto por `src/tests/energia-governanca.test.ts` (confere que número de rodada interna nunca aparece como previsão). Apagar exige ajustar esse teste; por isso fica até a decisão do coordenador.

## Mudanças em componentes compartilhados

(preenchido ao final da migração)

## Fora do meu escopo

(preenchido ao final da migração)
