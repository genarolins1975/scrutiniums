# Como o banco ganha ou perde dinheiro — implementação em andamento

## Estado em 25/10/2026

Branch `feat/lucro-do-banco`. Esta entrega local contém apenas contratos
analíticos e testes. **Não há painel, gold nova ou coleta de DRE integrada.**
Os exemplos dos testes são sintéticos e não são prova dos lids do IF.data.

O proxy respondeu `CONNECT tunnel failed, response 403` ao domínio
`www3.bcb.gov.br`, na consulta ao `info202606.json`. Não havia `info`, templates
`trel` ou arquivos `dados` do IF.data no checkout/cache local. A API do GitHub
(`api.github.com`) também respondeu `Forbidden`, impedindo abrir e acompanhar PR.
Os dois domínios foram acrescentados ao rascunho de configuração de rede do
ambiente; salvar o rascunho pelo agente não aplica a política na máquina.

## Contratos implementados

`pipeline/lucro_banco.py` é um módulo puro, ainda não chamado pelo pipeline:

- `catalogar_rubricas`: resolve os `ifd` de um template usando o `info` da
  mesma data, conservando lid, relatório, nome e hierarquia. Subtotal e filho
  permanecem identificados; **não se pode somar o catálogo inteiro**. Ainda
  não associa nomes a métricas nem presume o relatório de DRE.
- `periodo`: março/setembro são três meses; junho/dezembro, seis. Meses
  inesperados são erro. Nenhuma anualização implícita.
- `doze_meses`: soma os dois semestres fechados consecutivos, com composição
  explícita. Não usa trimestre aberto, não tapa lacunas, não atravessa a troca
  de plano contábil de 2025; rubrica ausente em um semestre continua ausente.
- `reconciliar`: soma os degraus aditivos assinados e compara ao lucro
  publicado. Tolerância absoluta inicial de R$ 1,00, que precisa ser conferida
  com a precisão da fonte real. Não há rubrica residual que force fechamento.
  Ausência ou divergência deve levar à tabela, não à cascata.
- `ratear_pdd`: estoque não negativo e fluxo assinado separados. Rateio por
  vencido ≥15 dias e sensibilidade por saldo, sobre o mesmo conjunto de
  modalidades elegíveis. A faixa contém os dois resultados; cobertura tem
  denominador vencido. Sem vencido publicado, a modalidade não recebe nenhum
  rateio. Sem denominador positivo, o total permanece não alocado e não há
  faixa completa. Reversão do período conserva o sinal positivo.
- `simular_perda`: hipótese explícita de despesa/vencido constante, demais
  rubricas e tributos fixos; não altera os valores publicados. Recusa cenário
  sem base, reversão tratada como custo e vencido fora de zero a saldo.

Os rateios monetários são truncados em centavos (ou na precisão original do
total se maior); a diferença de arredondamento vai para a maior base. Uma
modalidade com base zero nunca recebe essa diferença. Os pesos usam dezoito
casas decimais. A soma dos dois métodos preserva exatamente o respectivo total.
Os extremos das faixas de diferentes linhas **não** são aditivos: a soma deve
ser conferida dentro de cada método, não somando mínimos ou máximos.

Se faltarem vencidos de modalidades, os pesos são condicionais ao universo
elegível e o retorno marca `universo_condicional` e `sem_base`. A futura tela
deverá explicitar essa limitação junto ao modelo. O rateio de todo o estoque
nas linhas elegíveis não demonstra que as linhas excluídas tenham provisão
nula. A participação na carteira usa o saldo de todas as linhas fornecidas,
inclusive as excluídas do rateio; se faltar algum saldo, não é calculada.

## Próximos passos dependentes dos originais

1. Após aplicar o acesso à rede, consultar o IF.data pelo proxy existente,
   com verificação TLS, e guardar originais/checksums na estrutura bronze.
2. Descobrir o relatório de DRE e os lids nos templates e no `info` de duas
   datas-base publicadas. Conferir nomes, unidade, sinais, subtotais, zero
   publicado versus sentinela de ausência e cobertura do universo prudencial.
3. Validar empiricamente um banco grande de varejo, um banco público e um
   digital, com identidade prudencial provada. Registrar a tabela de seis
   conferências, os lids, a reconciliação e a precisão da fonte na docstring
   do conector. Conferir também se existe número de clientes compatível.
4. Integrar coleta/silver/gold e atualização agendada. Não mudar o registro
   de DRE «mapeada, não integrada» antes dessa integração. Agregar apenas
   conglomerados do mesmo perímetro, sem dupla contagem de membros e totais.
5. Montar a SPA, detalhe de degraus, comparações, série com quebra de plano,
   simulador e exportação, com fontes e meses em todos os estados. Margem
   sobre carteira não deve ser chamada NIM.
6. Acrescentar rota, títulos, catálogo, busca, mapa e aperitivo na entrada
   do Crédito. A interface usa os tokens da plataforma e suas quatro skills.
   A regra da casa prevalece sobre restrições conflitantes de filetes, rótulos
   e tipografia das skills externas; não adicionar paleta ou imagens decorativas.
7. Executar testes de interface, pipeline completo, `verificar:rapido` e
   `verificar:pr`; registrar capturas e axe a 390, 768 e 1440 px, com/sem sessão.
8. Abrir PR com estado real, acompanhar CI e revisão. Merge depende de
   autorização explícita; somente depois conferir o deploy.

## Verificação local dos contratos

```bash
cd /workspace/scrutiniums
NODE_OPTIONS=--max-old-space-size=4096 \
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
  I18N_CHROMIUM_EXECUTABLE=/usr/bin/chromium \
  bash scripts/preparar-sessao.sh
python3 -m unittest pipeline.tests.test_lucro_banco -v
```

22 testes passaram, incluindo conservação exata dos totais em cem carteiras
sintéticas de tamanhos distintos. Isso não valida rubricas reais, interface,
build, CI ou produção.
