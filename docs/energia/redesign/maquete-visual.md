# Página inicial: direção visual aprovada em 11/10/2026

A inicial usa uma maquete conceitual como navegação para quatro etapas: geração, transmissão, distribuição e consumo. Os números continuam derivados de `sinaisDaInicial()`; não foram incorporados valores à imagem.

## Ativos e procedência

Ilustrações produzidas com o gerador integrado de imagens, a partir do mock aprovado pelo proprietário. A página informa que são geradas por IA, sem escala geográfica e sem representar uma instalação real ou a topologia do SIN. Arquivos WebP versionados; as imagens não contêm texto, indicadores ou séries. Os textos, fontes, pontos de navegação e controles são elementos HTML.

- `public/energia/arte/sistema-eletrico-v1.webp`: 1774 × 887, 291.892 bytes.
- `public/energia/arte/etapas-eletricas-v1.webp`: 2172 × 724, 248.186 bytes.
- `public/energia/arte/conta-regiao-v1.webp`: 800 × 800, 47.852 bytes.

Conversão com Sharp, WebP qualidade 84; apenas a imagem do medidor foi reduzida para 800 px. Sem dependência adicionada à aplicação. Peso total: 587.930 bytes. O Next Image entrega variantes responsivas da abertura; o percurso reutiliza uma única faixa ilustrada. Imagens secundárias usam carregamento adiado padrão do Next Image.

### Especificação dos prompts

1. Maquete panorâmica em fundo marfim, reservatório e barragem à esquerda, eólicas e solar no centro, torres, subestação e cidade à direita. Realismo de maquete arquitetônica, luz natural, espaço vazio superior esquerdo para título HTML. Sem texto, números, logos ou mapa geográfico real.
2. Quatro miniaturas em faixa sobre fundo petróleo: hidrelétrica, torre de transmissão, subestação e casa. Mesma perspectiva, sem setas, valores ou linhas quantitativas. Acabamento de modelo físico detalhado.
3. Medidor de eletricidade com visor vazio, fatura com linhas sem texto ou valores e pequena casa em fundo marfim. Ilustração de medição e conta, sem dados de cliente.

## Conteúdo e comportamento

- Pontos da maquete abrem a etapa correspondente e posicionam o percurso na tela.
- Etapas usam botões nativos, `aria-pressed`, Tab, setas esquerda/direita, Home e End.
- Os quatro textos distinguem potência de energia, fluxo de capacidade, perdas de furto e PLD de tarifa.
- O percurso declara que é simplificado e não cobre todas as configurações de geração distribuída e sistemas isolados.
- O mapa analítico de sete elos permanece completo em um disclosure nativo. Fontes, métodos, distribuidoras, seis perguntas, inclusão, busca e catálogo foram preservados.
- Em telas estreitas, a maquete é seguida por quatro alvos de toque; os indicadores ficam em linhas e as etapas em duas colunas.
- Sem animação automática; a pequena transição de foco visual respeita movimento reduzido.

## Validação

Os testes existentes de dados, evidência, unidades e navegação permanecem ativos. Atualizados apenas o título aprovado e a abertura progressiva do mapa. Testes novos verificam destinos publicados, estrutura acessível inicial, distinções metodológicas e orçamento de imagens.
