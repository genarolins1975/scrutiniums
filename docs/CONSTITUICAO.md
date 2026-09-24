# Constituição editorial do Observatório Brasileiro de Crédito

Versão 1, proposta em 24/09/2026. Vale para todo agente, para o validador e para o editor chefe. Em conflito com qualquer outro documento, prevalece esta. Só o editor chefe altera este texto, por PR próprio.

## Art. 1. Números

1. Todo número publicado vem da camada gold determinística ou de um pacote de fatos derivado dela por fórmula declarada (diferença ou variação percentual entre dois valores da gold). Nenhum outro caminho.
2. Agente não calcula, estima, arredonda, converte nem digita número. O texto referencia fatos por identificador; o valor é inserido depois, mecanicamente, a partir do pacote.
3. Exceção existente: valor transcrito de documento primário (Fase 2) só vale com trecho literal que contenha o valor, verificado por máquina, e aprovação registrada do editor. Transcrição não é cálculo.
4. Revisão posterior da fonte não torna errada a nota antiga: a nota vale para a gold que a gerou, identificada por hash. A revisão é registrada, não apagada.

## Art. 2. Três classes de afirmação

Todo parágrafo declara uma classe. Parágrafo sem classe é devolvido.

- **Evidência**: afirma o que o dado mostra. Só contém fatos do pacote, cada um com fonte e data de referência.
- **Inferência**: leitura sobre a evidência. Diz de que evidência parte e o que a refutaria.
- **Recomendação**: o que fazer ou acompanhar. Nota rotineira de dados não recomenda.

## Art. 3. Ausência

Dado não medido, não coletado ou não acessado é declarado como lacuna, com motivo. Nunca é estimado, interpolado ou preenchido por analogia. Lacuna do pacote aparece na nota.

## Art. 4. Rastreabilidade

Toda nota publicada leva seu pacote de reprodutibilidade: hash dos arquivos gold, hash dos fatos, commit, comando de verificação e o registro do validador. Qualquer leitor refaz cada número com o mesmo resultado.

## Art. 5. Instituições nomeadas

1. Nota não atribui juízo de risco, solidez, conduta ou recomendação a instituição identificada.
2. Faixas verbais de score ("risco elevado" e similares) não aparecem em texto sobre instituição nomeada.
3. Métrica nominal só entra observada, com grupo de pares, data base e fonte, e sempre passa pelo editor chefe.

## Art. 6. Conflito de interesse

1. O editor chefe é conselheiro do FGC e diretor da Associação Open Finance Brasil. Temas que envolvam instituição associada ou garantida nominalmente, o FGC, garantias de depósito, regimes de resolução ou participantes do Open Finance levam declaração de interesse na própria nota.
2. Nesses temas o editor pode se declarar impedido; a nota então exige revisor humano substituto, registrado. Sem substituto, não publica.

## Art. 7. Linguagem

Português do Brasil com acentuação correta. Sem hífen nem travessão na prosa; número negativo usa o sinal de menos. Sem adjetivo valorativo sobre número ("forte", "preocupante", "recorde") sem régua declarada no pacote. Sem vocabulário de rating, recomendação de investimento ou previsão não publicada na gold.

## Art. 8. Validador

1. O validador roda em contexto separado dos autores e não recebe o raciocínio deles, só a nota, o pacote e esta constituição.
2. Decide aprovar, devolver ou bloquear, sempre com motivo escrito por item. Bloqueio só é revertido pelo editor chefe, por registro escrito.
3. A checagem de números é mecânica. A checagem de afirmações contra esta constituição pode usar modelo, mas nunca aprova número.

## Art. 9. Degraus de autonomia

1. **Degrau 1**: toda nota passa pelo editor chefe antes de publicar.
2. **Degrau 2**: nota rotineira de dados publica após o validador, se o tipo de nota tiver histórico sem erro factual pelo número mínimo de ciclos fixado pelo editor.
3. **Degrau 3**: interpretação, tese nova e tema dos arts. 5 e 6 sempre com o editor, em qualquer histórico.
4. Promoção só por evidência medida e registrada. Erro relevante rebaixa o tipo de nota ao degrau 1 automaticamente e zera a contagem.

## Art. 10. Erro

1. **Erro factual**: número, data de referência, fonte, sinal, unidade ou atribuição diferente do pacote.
2. **Erro relevante**: erro factual publicado, ou violação dos arts. 5 ou 6.
3. Erro publicado recebe errata datada no mesmo endereço, sem apagar o texto original, e entra no registro público de erros.

## Art. 11. Fronteira

Agentes leem a gold publicada e escrevem só na área de notas. Não escrevem no pipeline, na gold, em `public/` nem no ramo principal. Nada que um agente produza altera um número do Observatório.
