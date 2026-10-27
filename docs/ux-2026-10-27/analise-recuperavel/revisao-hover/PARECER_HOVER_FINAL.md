# Confirmação independente do contraste das ações de recortes

27/10/2026. Commit `54e2bfd00ff64c567529917b80fec1a9bf418568`; build `X--ElloZSDGMxGxEB4ivY`.

A diferença de fonte desde `32db0c3d2` está restrita a `src/components/conta/MeusRecortes.tsx`: seis linhas substituídas, ajustando entrelinha e o token de hover das ações/links. Não foram repetidas as jornadas funcionais já confirmadas naquele commit.

| Estado examinado | 390 px | 1440 px |
| --- | --- | --- |
| Ponteiro sobre Copiar link | Contraste 6,09:1; axe 0 | Contraste 6,09:1; axe 0 |
| Após clicar em Copiar link, com ponteiro mantido | Contraste 6,09:1; axe 0 | Contraste 6,09:1; axe 0 |

Cor computada do texto: `rgb(124, 86, 56)`; fundo efetivo: `rgb(250, 248, 242)`. Razão calculada pela luminância relativa sRGB: **6,093212:1**, acima de 4,5:1 exigidos para esse texto de 12 px. O estado de hover estava efetivamente ativo nas quatro medições. A cópia entregue continha `/combustiveis?uf=PE&litros=60` nas duas larguras.

Axe examinou a região completa Meus recortes salvos, com regras WCAG 2 A/AA, 2.1 A/AA e 2.2 AA disponíveis. Essa verificação complementa a auditoria anterior da página Minha conta inteira; não representa certificação integral WCAG ou teste com leitor de tela.

Evidências: `hover-final.json` (inclui diff), `execucao.log` e quatro capturas `recortes-{390,1440}-{apontar,clicar}.png`. Roteiro independente: `/tmp/analise-hover-final.mjs`. Banco e conta sintéticos locais; nenhum arquivo do checkout foi alterado. Navegador e servidor encerrados.
