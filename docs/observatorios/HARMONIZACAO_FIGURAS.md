# Harmonização das figuras dos observatórios

Revisão de 13/10/2026. Base remota: `1409dad1a2a74196f66884ae2b38ec63b9bb0f2a`.
Pedido: melhorar as figuras de todos os painéis e unificar seu estilo visual.

## Inventário e decisão

O inventário dos ativos de apresentação encontrou oito arquivos de ilustração
usados nas aberturas de Crédito, Energia, OBEE, Contas Públicas Federais e
Contas Públicas Estaduais. Cinco arquivos de Crédito e Energia ainda usavam
miniaturas tridimensionais. Os três trípticos do Estado já tinham nove cenas
em gravura editorial, incorporadas pelo PR #173. Essa direção passa a ser
comum ao conjunto: arquitetura e ambientes reconhecíveis, hachuras em marfim,
acentos discretos em cobre e fundo petróleo.

| Uso | Composição | Relação com o assunto |
| --- | --- | --- |
| Crédito: abertura | Paisagem urbana imaginária com instituições, moradias, comércio e indústria | Crédito e atividade econômica |
| Crédito: oito cenas | Livros de registros; banco; contrato; rua; oficina; negociação; arquivo jurídico; carteira de documentos | Sete etapas do crédito e laboratório de hipóteses |
| Energia: abertura | Reservatório, geração, transmissão, subestação e cidade | Visão conceitual do sistema elétrico |
| Energia: quatro cenas | Geração, transmissão, distribuição e consumo | Uma cena própria para cada etapa |
| Energia: conta de luz | Medidor residencial e fatura sem valores | Medição do consumo e leitura da conta |
| OBEE, Federal e Estadual | Três trípticos existentes, nove cenas próprias | Território, serviços, orçamento, entregas e evidências |

São 24 cenas conceituais em oito arquivos, com reaproveitamento contextual de
cenas nos atalhos. A paleta comum não transforma as ilustrações em informação
estatística. Gráficos, mapas analíticos, diagramas de relações, ícones de
interface, marca e bandeiras oficiais mantêm sua função e seus contratos.
Não foram regenerados por IA nem receberam valores ilustrativos.

## Integração

- `public/observatorios-gravuras.css` concentra os tokens e o enquadramento
  comum; é carregado pela aplicação Next e pela SPA de Crédito.
- Nas aberturas de Crédito e Energia, texto e paisagem ficam lado a lado no
  desktop e em sequência no celular. A imagem é mostrada inteira; atalhos e
  legenda têm espaço próprio, sem marcar posições fictícias sobre a paisagem.
- Títulos, perguntas, fontes e controles são HTML. Imagens decorativas não
  duplicam esses textos no leitor de tela; as paisagens de abertura têm alt.
- Os atalhos de Crédito exibem as cenas de instituições e território. Energia
  reutiliza a cena de distribuição no atalho territorial. O detalhe de cada
  etapa usa a própria cena, substituindo recortes arbitrários da paisagem.
- `GravuraEnergia` centraliza a janela da prancha 2 × 2. A prancha de Crédito
  mantém as oito janelas da grade 4 × 2. Os trípticos do Estado mantêm três
  janelas quadradas, sem esticar ou recortar partes entre cenas.
- Abaixo de 391 px, as etapas de Crédito e Energia ficam em uma coluna para
  preservar a leitura da arte e da pergunta. Entre 761 e 1000 px, Energia
  usa duas colunas. Os atalhos com texto lateral empilham até 480 px.
- Navegação por teclado, âncoras, foco visível, destinos e controles dos
  laboratórios são preservados. Seleção usa borda e estado semântico;
  as artes não saltam nem brilham ao passar o ponteiro.
- Todas as legendas identificam a natureza conceitual e a geração por IA.
  Nenhuma cena representa uma obra avaliada, um município observado ou a
  topologia real do SIN.

## Ativos e desempenho

Imagens geradas por IA com instruções específicas por assunto, inspecionadas
individualmente e convertidas para WebP pelo encoder já incluído no Next.
Não foi acrescentada dependência. Redimensionamento proporcional e compressão
são as únicas transformações feitas após a geração.

| Arquivo em `public/` | Dimensões | Qualidade WebP | Bytes |
| --- | --- | --- | ---: |
| `obs/arte/economia-gravura-v1.webp` | 1600 × 800 | 80 | 397.598 |
| `obs/arte/etapas-gravura-v1.webp` | 1760 × 880 | 80 | 364.074 |
| `energia/arte/sistema-gravura-v1.webp` | 1440 × 720 | 76 | 283.618 |
| `energia/arte/etapas-gravura-v1.webp` | 1200 × 1200 | 76 | 308.730 |
| `energia/arte/conta-gravura-v1.webp` | 720 × 720 | 76 | 88.290 |

Os três ativos de Energia somam 680.638 bytes e permanecem abaixo do portão
existente de 700 × 1024 bytes. As cinco URLs antigas foram removidas do código
em execução; as artes anteriores permanecem no histórico Git. As URLs das
novas imagens e a versão dos arquivos de Crédito evitam reaproveitar cache
da apresentação antiga. Os três trípticos do Estado não mudam de conteúdo.

## Validação e limites

As cinco artes finais comprimidas foram inspecionadas, assim como sua relação
visual com as gravuras existentes. O pacote congelado do OBEE teve os 54
SHA-256 reconferidos; dados, pesos, definições e travas não são alterados.

Lint, TypeScript e build passaram na integração. A primeira suíte completa
identificou uma cor literal no novo componente, corrigida para o token comum,
e conteúdo antigo em cópias locais não versionadas de arquivos de outra
frente. A validação final usa checkout isolado dos arquivos versionados,
preservando essas cópias locais. Os resultados finais são registrados no PR.

O navegador da sessão não respondeu à tentativa de conexão. Não há alegação
de inspeção manual das páginas em 320, 390, 768 ou 1440 px, de zoom a 200%,
nem nota estética numérica. As regras responsivas, os contratos automatizados,
o HTML de produção e as imagens são verificações distintas da inspeção manual.
