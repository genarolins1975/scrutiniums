# Prévia interativa da revisão v3

Artefato de revisão, integrado ao preview do OBEE e sem mudança de produção. Também é possível abrir `../revisao-interativa-v3.html` no navegador. Arquivo autocontido; não consulta APIs, não usa bibliotecas externas e não recalcula o escore. Geração: `python3.12 docs/obee/resultados/review-ui/generate.py`.

A tela apresenta 18 cenários e 26 capitais, comparação v2/candidata, perfis de percentis, pesos, decomposição e exportação CSV das 26 linhas do cenário. Os controles preservam estado na URL. A fonte é `cesta-conjunta.json`, cujo SHA-256 consta na página. O gerador confere as 468 notas e decomposições contra as identidades aritméticas antes de montar a prévia.

## Verificação em 12/10/2026

- Recife/Curitiba reconciliados: cenário principal material40 = 35,77/77,69; sete iguais = 37,09/82,69. Conectividade isolada com iguais: Recife 33,33; moradores >3 conjunto material40: Recife 35,00.
- Controle de habitação desabilitado quando não aplicável; troca de cidades e seleção da mesma capital verificadas. Tabela equivalente de percentis e pesos aberta e conferida.
- CSV baixado pelo navegador: 26 linhas, cenário conjunto moradores >3 material40 e ressalva em todas as linhas. A captura do evento de download pela automação excedeu o prazo; o arquivo efetivamente baixado foi localizado e lido, confirmando o resultado.
- Filtros mantidos ao recarregar. Navegação por Tab verificada entre controles. Sem leitor de tela ou teste de zoom 200% nesta rodada.
- Larguras 320, 390, 768 e 1440 px: largura do documento igual à viewport após correções. Tabelas e gráfico usam rolagem local em telas estreitas. Inspeção visual de início, gráfico e final no desktop; início no celular. Não afirmar acessibilidade integral.
- Quatro testes do pacote congelado passaram após a geração; nenhum dos seus 54 arquivos foi modificado. A prévia é material complementar, fora do pacote metodológico congelado.

Autoavaliação: direção de arte 8; hierarquia 8; tipografia 8; densidade 9; didática 9; comparabilidade 9; interação/acessibilidade 8; responsividade 8. Limitações: gráfico requer rolagem horizontal no celular; ausência de avaliação com leitor de tela e zoom. Sem atribuição de revisão independente. Captura: `preview.jpg`.

A revisão por responsável distinto da implementação permanece pendente. Não preencher registros de aprovação com resultados desta autoavaliação. A prévia facilita examinar a proposta; não resolve precisão municipal ou decide sua divulgação pública.

## Integração ao preview em 12/10/2026

A rota `/eficiencia-estatal/laboratorio-cesta` serve o mesmo artefato pelo Next.js. A regra existente `pilotPreviewEnabled` permite `VERCEL_ENV=preview`, ou desenvolvimento local sem `VERCEL_ENV`. Produção, ambientes desconhecidos e execução de produção sem identificação retornam 404 antes de ler o HTML. Não há parâmetro de URL que habilite o acesso. A página é dinâmica, sem cache e com instrução de não indexação; essas instruções não substituem autenticação. O laboratório é uma superfície experimental, não um ambiente privado.

O link no piloto leva as duas capitais selecionadas. O retorno ao panorama acompanha mudanças de capital feitas no laboratório. O artefato foi incluído explicitamente no rastreamento de arquivos do Next.js para estar presente no pacote da rota.

Validação local: 21 testes passaram nos arquivos `obee-laboratorio-cesta.test.ts` e `obee-piloto-resultados.test.ts`; lint dos três arquivos TypeScript envolvidos sem avisos ou erros. HTTP real da rota respondeu 200 com `private, no-store`, `noindex` e `nosniff`. Percurso laboratório → panorama → laboratório confirmado no navegador com Recife/Curitiba; troca para São Paulo atualizou o destino de retorno. Captura: `preview-integrado.jpg`. O bloqueio de produção foi verificado pelos testes automatizados; não houve publicação da rota em produção nesta etapa.

Para reproduzir localmente, instalar dependências, executar os scripts de materialização usados pelo projeto e iniciar `npm run dev`. A verificação completa de tipos e build pertence ao CI do PR; os testes locais acima não equivalem a essa passagem integral.

## Reconciliação alternativa e correção de CI em 12/10/2026

O CI da integração (`9f2f12c7`, execução `38279411825`) encontrou TS1501 no teste da rota: a flag `s` da expressão regular exige ES2018, acima do alvo configurado. O teste passou a usar `[\s\S]`, preservando a leitura multilinha sem alterar a configuração global de compilação. Verificação local de tipos concluída sem erros; os 21 testes da rota/piloto e o lint passaram após a correção.

O novo `scripts/auditar-cesta-obee-v3.py` ordena valores originais das auditorias, calcula os pontos médios dos empates e faz agregação/decomposição com `fractions.Fraction`. Não importa as funções do motor original. Confere 18 cenários, 468 observações cidade–cenário, 49 comparações entre cenários e a concordância das notas no JSON, CSV e HTML. Os pesos são reconstruídos a partir das duas convenções declaradas. Empates e inversões de pares são comparados com aritmética exata, sem escolher tolerância para decidir a ordem.

Resultado: nenhuma divergência acima de `1e-9`; maior diferença absoluta entre os números gravados e a reconstrução racional = `1,87 × 10⁻¹⁴` ponto, compatível com representação numérica. Relatório com hashes: [reconciliacao-aritmetica-v3.json](../reconciliacao-aritmetica-v3.json). Nove testes adversos cobrem, entre outros casos, nota/peso alterado, capital ausente, não finito, CSV truncado e HTML de outra edição. Essa verificação passou a integrar o CI. Os 66 testes existentes do motor/evidências também passaram localmente.

Reprodução: `python3.12 -m unittest scripts.test_auditar_cesta_obee_v3` e `python3.12 scripts/auditar-cesta-obee-v3.py`. O script apenas lê as entradas e imprime o relatório; não escreve no pacote congelado nem promove publicação.

**Limite da conclusão:** segunda implementação aritmética elaborada pela mesma assistência técnica, não revisão metodológica independente. Parte das auditorias preservadas, sem repetir a extração das fontes oficiais; não verifica a semântica dos dados nem quantifica incerteza amostral. Nenhum parecer foi preenchido. O aceite da definição de habitação, dos pesos/compensações e do escopo de divulgação continua dependente de revisão substantiva e decisão editorial.

## Sensibilidade das comparações em 12/10/2026

A seção “A ordem entre as capitais se mantém?” usa o diagnóstico reproduzível `../sensibilidade-pares-v3.json`. A análise cobre toda a faixa contínua de orçamento material de 2/5 a 4/7, com pesos iguais dentro dos dois blocos, nas quatro definições de habitação da cesta conjunta. Dos 325 pares, 294 preservam ordem estrita, 30 podem inverter e um pode empatar sem inversão. A prova pelos extremos da função afim, os limites e a recomendação estão em `../AVALIACAO_COMPENSACAO_V3.md`.

Verificações desta etapa:

- Seis testes do diagnóstico, nove da reconciliação alternativa e quatro do pacote congelado aprovados em Python 3.12. Os 21 testes Vitest da rota/piloto passaram, incluindo igualdade entre o diagnóstico e seus dados embutidos no HTML. Lint do teste TypeScript sem avisos ou erros.
- Recife–Curitiba conserva a direção nas hipóteses testadas. Aracaju–Teresina mostra inversão e empate em 47,46% na definição domicílios >2. A troca A/B inverte o sinal e os limites corretamente.
- São Paulo–Teresina mostra empate sem inversão; a tabela confirma diferença zero em material 40% com moradores >3. Selecionar a mesma cidade ou uma cesta isolada remove o gráfico e mostra a explicação correspondente.
- Filtros preservados ao recarregar. O botão de exemplo funciona por Enter e transfere foco para a conclusão, com indicação visual. A tabela equivalente foi aberta e conferida no navegador.
- Documento sem transbordamento horizontal em 320, 390, 768 e 1440 px. Inspeção visual da conclusão e figura em 320 px e no desktop; a figura mantém rolagem local no celular e requer deslocamento para ver o eixo. Sem validação com leitor de tela ou zoom 200% nesta rodada.

Captura da comparação Aracaju–Teresina: `sensibilidade-pares.jpg`. Autoavaliação desta seção: direção de arte 8; hierarquia 9; tipografia 8; densidade 8; didática 9; comparabilidade 9; interação/acessibilidade 8; responsividade 8. O gráfico amplo e a ausência de ensaio com leitor de tela limitam a avaliação de acessibilidade; não há certificação integral.

Nenhum arquivo do pacote congelado ou registro de aprovação foi alterado. O diagnóstico não estima incerteza amostral nem cobre todos os pesos possíveis. A candidata continua restrita à avaliação experimental.

## Correções após revisão cruzada

* **Valores originais na tela.** A seção "O que foi observado em cada capital?" mostra as sete medidas nas unidades originais, com direção favorável, universo e fonte. Homicídios trazem a parcela de ocultos estimados por capital. O percentil passa a ser apresentado como posição relativa, com rótulo orientado ("Menos homicídios estimados") e a faixa real de 1,9 a 98,1.
* **Robustez por par.** Além da família de 40% a 4/7, a seção de sensibilidade informa a classe do par (dominância, estável só na família, inversão possível, empate possível) e os testes de `robustez-ampliada-v3.json`.
* **Decomposição.** A convenção do centro 50 está declarada junto às parcelas; o total independe dela.
* **Celular.** Gráficos redesenhados para a largura disponível (rótulo acima do segmento), sem rolagem lateral; ponto de empate marcado no gráfico.
* **Precisão de exibição e CSV.** Uma casa decimal na tela (R$ com centavos). O CSV usa vírgula decimal e ponto e vírgula, e inclui valores originais, unidades, percentis, pesos, definição de habitação, SHA-256 da fonte, link do arquivo auditável e a ressalva obrigatória integral.
* **Links fixos** no commit `ad1b8cf4`; sinal de menos tipográfico.
* **Bundle de produção.** O piloto v2 deixou de ser importado por componentes cliente: o snapshot é lido no servidor e só chega ao navegador em preview. `src/tests/obee-piloto-bundle.test.ts` falha se dados do piloto ou da candidata aparecerem em `.next/static`.

O CI passa a exigir que `reconciliacao-aritmetica-v3.json` seja a saída atual do auditor e que este HTML seja a saída atual do gerador.
