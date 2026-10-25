# Educação: análise do painel em 25/10/2026

Base: main `954c9a2e`, build local `mUzIKl7CmFZI_BSPdgPSD`, capturas de `npm run evidencias` a 390, 768 e 1440 px, com e sem sessão, das rotas `/educacao-municipal`, `/educacao-municipal?ibge=2800100` (Amparo do São Francisco, SE, 2.202 habitantes), `/educacao-municipal?ibge=2611606` (Recife), `/eficiencia-estatal/educacao-municipal-capitais` e `.../resultados`. Avaliação feita nesta sessão, não é revisão independente. O protocolo formal de crítica do impeccable (dois avaliadores isolados e detector) não rodou: o executável do detector não está no repositório (`.claude/skills/impeccable/ORIGEM.md`).

## Resumo

O painel é correto e honesto: nenhuma violação do axe, zero erro de console, ausência nunca vira zero, cada número tem fonte e período, e a regra do aperitivo está cumprida. O problema é de hierarquia e de aproveitamento. O leitor que escolhe a sua cidade a encontra abaixo da primeira tela, depois de quatro números nacionais. A página com município passa do orçamento de comprimento em 36% a 1440 px e em 31% a 390 px, em boa parte por duas tabelas brutas abertas no meio. E a gold já traz série nacional de 20 anos, distribuição por estado, metas do INEP, composição das matrículas e geometria municipal pronta, mas nada disso vira gráfico. O único artefato didático, o laboratório N × P, aparece duas vezes, além de um bloco estático com a mesma conta.

## Evidência

| # | Achado | Medida | Onde |
|---|---|---|---|
| 1 | A cidade escolhida fica fora da primeira tela | A 1440 px, o cartão do município começa por volta de 1.710 px (primeira tela: 900 px); antes dele vêm a abertura, quatro números do Brasil e o "Para você" | `/educacao-municipal?ibge=2800100` |
| 2 | Página com município acima do orçamento da entrada | 8.837 px a 1440 (teto 6.500) e 14.380 px a 390 (teto 11.000); Recife: 8.934 e 14.511. Sem município: 4.790 e 7.985, dentro do teto | anexo `arquiteturas.md`, seção 4 |
| 3 | Duas tabelas brutas abertas no meio da leitura | 11 linhas por 8 colunas cada (Ideb, meta, aprovação, Saeb de matemática e de português, N, P), cerca de 1.300 px a 1440 | seção `#componentes` |
| 4 | O mesmo mecanismo três vezes | Bloco estático N × P, laboratório do município e laboratório do Brasil no artefato da entrada | `#componentes` e fatia Artefato |
| 5 | Gráficos de série pequenos e comprimidos | Dois SVG de cerca de 470 px de largura a 1440, eixo de 0 a 10 para séries que vivem entre 2 e 7; meta como círculo vazado sem leitura de "alcançou ou não" | `Graficos.tsx` |
| 6 | Nenhum mapa | 5.571 municípios sem visão territorial, embora `MapaCoropletico` e `public/energia/geo/municipios.json` já sirvam o Saneamento (`AtlasMunicipal.tsx`) | todo o painel |
| 7 | Dados na gold que não aparecem | Série nacional 2005 a 2025 (anos iniciais, rede municipal: 3,4 para 6,1; anos finais: 3,1 para 4,9) com N, P, Saeb e aprovação; série por UF (só 2025 aparece); distribuição do Brasil e de cada UF em 20 faixas (só a do porte aparece); metas de 2007 a 2021 sem contagem de quem alcançou; matrículas federal, estadual e privada | `public/educacao/gold/educacao.json`, `municipios/{UF}.json` |
| 8 | Capitais: 26 capitais viram 3 barras | Cada medida aparece como menor valor, mediana e maior valor em barras pretas grossas; as 26 capitais só na tabela recolhida; paleta destoa do painel dos municípios (azul petróleo) | `/eficiencia-estatal/educacao-municipal-capitais` |
| 9 | Capitais: instrumento não pronto no corpo do painel | "Como avaliar este serviço?", com acesso, resposta, qualidade e escore "Pendente" e "Não calculável" | mesmo painel, fim da página |
| 10 | Cromo alto a 768 px | 332 px do topo ao conteúdo nos municípios e 316 nas capitais (390 e 1440 dentro do orçamento) | tabela de evidências |

Sem achado: rótulos de rede (municipal contra pública), porte, posição na UF, histograma do porte, tratamento de "Sem Ideb" com motivo, nota de 2021 e ressalva de creche e pré escola.

## Nota pela rubrica da skill (seção 10)

| Critério | `/educacao-municipal?ibge=` | Panorama das capitais |
|---|---|---|
| Direção de arte | 7 | 6 |
| Hierarquia | 5 | 7 |
| Tipografia e acabamento | 7 | 7 |
| Densidade e profundidade | 6 | 6 |
| Didática visual | 6 | 6 |
| Comparabilidade | 8 | 8 |
| Interação e acessibilidade | 7 (axe 0; teclado e leitor de tela não verificados à mão) | 7 (idem) |
| Responsividade | 6 | 7 |

O aperitivo aberto (`/educacao-municipal` sem sessão) cumpre o que promete: 2.290 px a 1440 e 4.519 a 390, dentro do teto de 2.500 e 4.500 com folga mínima a 390.

## Inferência

1. O leitor do painel completo chega para saber da sua cidade. Hoje ele precisa rolar dois a três telas para isso. É a reprovação explícita da skill: "destino mais procurado a mais de um clique da entrada", aqui a mais de uma tela.
2. O excesso de comprimento não vem de conteúdo demais, e sim de conteúdo na forma errada: tabelas de base no lugar de gráficos das partes, e o mesmo mecanismo repetido.
3. O painel explica o Ideb, mas não responde às perguntas que o leitor leigo faz em seguida: a cidade melhorou por aprender mais ou por reprovar menos? Bateu as metas? Como está o meu estado perto dos vizinhos? Onde estão as redes com resultado parecido? Todos os dados para essas respostas já existem.
4. O painel das capitais é o mais rico em método do projeto, e a apresentação esconde essa riqueza atrás de um resumo de três barras.

## Recomendação

Executar em três PRs, nesta ordem, com o prompt `PROMPT_CODEX_EDUCACAO.md` ou nesta sessão:

1. **Hierarquia e orçamento** (sem dado novo): ficha própria do município, extrato da cidade na primeira tela de quem escolheu, laboratório único, tabelas brutas recolhidas, gráficos maiores.
2. **Artefatos com os dados que já existem**: decomposição da variação em aprendizagem e fluxo, placar das metas do INEP, mapa dos 5.571 municípios, a década do Ideb por estado, distribuição do Brasil e da UF com a cidade marcada, quem atende os alunos da cidade.
3. **Capitais**: as 26 capitais à vista em gráfico de pontos, "Do recurso ao resultado" da educação, ponte da razão em destaque, escores não calculáveis recolhidos ao método, paleta coerente com o painel dos municípios.
