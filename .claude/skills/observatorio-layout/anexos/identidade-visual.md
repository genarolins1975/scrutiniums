# Observatório Layout, anexo: Identidade visual

Carregar quando a tarefa tocar paleta, tipografia, geometria e ritmo. Texto movido sem alteração do SKILL.md de 22/10/2026; os números de seção são os do original.

## 3. Identidade visual de referência

**Tokens e tipografia da plataforma (Iniciativa 5, 22/10/2026):** a referência é `docs/observatorios/DESIGN_SYSTEM_OBSERVATORIOS.md`: cor só em `src/app/globals.css` (nenhum hexadecimal nem `--cor-*` fora dele, `src/tests/design-tokens.test.ts`), escala única (`.t-h1` a `.t-meta`, `.rotulo` a 12 px), três tamanhos de número em serifa (`.numero-g`, `.numero-m`, `.numero-p`), papel em todo `main` e piso de 12 px conferido no navegador (`src/tests/ux-texto-minimo.test.ts`). Decisão do dono de 22/10/2026: rótulos em caixa alta ficam, a 12 px; a numeração 01, 02, 03 sai dos cartões da home e das portas; destaque colorido no título só no H1 da home; filetes de 3 px na cor do observatório ficam. A tabela abaixo é a referência de origem; os valores em uso são os do documento.
Adotar a paleta abaixo como ponto de partida quando o projeto não possuir tokens equivalentes. Mapear para os tokens existentes e verificar contraste em cada uso. Não afirmar que uma cor isolada garante acessibilidade.

| Papel | Referência | Aplicação |
|---|---|---|
| Papel | `#F8F7F2` | Fundo editorial principal |
| Superfície | `#FFFFFF` | Controles, menus e superfícies funcionais |
| Tinta | `#182B36` | Texto e valores principais |
| Texto secundário | `#58666B` | Contexto e metadados legíveis |
| Destaque | `#09697A` | Série focal, links e seleção |
| Contexto suave | `#E7EFEE` | Faixas de referência e seleção discreta |
| Regra | `#D7DCD7` | Separadores decorativos; não depender dela para distinguir controles |
| Comparação | `#806A45` | Série de referência quando necessária; verificar contraste |

Usar uma cor focal e referências neutras por padrão. Em composição multissérie, aplicar uma paleta categórica acessível com identidade estável, rótulos e alternativas à cor. Não pintar cada entidade com uma cor diferente sem função.

Reservar cores de aviso para estados documentados. Não usar verde/vermelho para dizer que gastar mais, gerar mais ou cobrar menos é bom ou ruim.

Preservar o logotipo e os ativos oficiais. Não redesenhá-los por aproximação. Preferir a aparência clara editorial; preservar e testar modo escuro se o produto já o oferecer, sem adicioná-lo apenas como adorno.

### Tipografia

- Reutilizar as famílias licenciadas já carregadas. Usar serifada editorial para títulos e sans-serif legível para texto, controles, unidades e tabelas.
- Na ausência de fontes próprias, usar fallbacks de sistema coerentes. Não depender de download externo para a primeira leitura.
- Adotar como referência: H1 40–48 px desktop e 30–36 px mobile; H2 28–34/24–28; H3 20–24; corpo 16–18; tabelas 14–16; metadados 12–14.
- Tratar faixas como orientação, não medidas rígidas. Respeitar zoom, texto ampliado, tradução e títulos longos.
- Usar entrelinha de aproximadamente 1,5–1,65 em texto corrido e 1,1–1,25 em títulos. Evitar tracking apertado que prejudique acentos.
- Preferir pesos 400, 500 e 600; reservar negrito para hierarquia real. Não transformar a página em competição de números gigantes.
- Usar algarismos tabulares em colunas e comparações; alinhar números à direita. Aplicar padrão brasileiro de números e datas.
- Limitar parágrafos de explicação a uma largura confortável, aproximadamente 60–75 caracteres. Não restringir gráficos e tabelas à largura do texto.

### Geometria e ritmo

- Usar escala de espaçamento consistente: 4, 8, 12, 16, 24, 32, 48 e 64 px como referência.
- Adotar área principal de cerca de 1.160–1.240 px; permitir maior largura em tabelas analíticas quando a tarefa exigir.
- Usar margens laterais de 32–48 px no desktop e 16–24 px no celular, ajustadas ao espaço real.
- Preferir linhas, alinhamento e proximidade a caixas. Agrupar com superfície apenas quando houver uma função distinta: controles, seleção, aviso ou comparação delimitada.
- Evitar sombras em gráficos, bordas em cada bloco e grandes raios. Reservar sombra discreta para sobreposição real, como menu ou diálogo.
- Construir seções pela pergunta; evitar uma sucessão monótona de três cards iguais.
