# Habitação — OBEE

Cinco rotas sob `/eficiencia-estatal/habitacao`: panorama, deficit, aluguel-renda, inadequacao e dados. Diagnóstico das necessidades e condições habitacionais, com referência 2024, edição FJP 2026. Não mede execução de programas, gasto ou eficiência causal.

## Fontes e decisões

Os quatro originais estão identificados por URL e SHA-256 em `public/eficiencia/habitacao/fontes.json`: duas planilhas de 11/06/2026 e dois relatórios de 10/06/2026, vinculados pelo catálogo oficial da Fundação João Pinheiro. Dados básicos: Pnad Contínua/IBGE e CadÚnico no componente improvisados.

Recorte: Brasil, cinco regiões e 27 UFs. Regiões metropolitanas e estratos dos originais não entram no recorte. Uma consulta de UFs não mistura regiões ou Brasil nas somas. Valores amostrais fracionários são preservados no arquivo e arredondados apenas na apresentação.

- Déficit: `Deficit_habitacional`, C:F; denominador: `Total_domicilios_ocupados`, D.
- Componentes: `DH_Componentes`, C:I. Habitação precária + coabitação + ônus de aluguel. Classificação hierárquica, com tratamento próprio das unidades conviventes, conforme relatório, pp. 10–11.
- Renda: `DH_faixa_renda`, C:G. A tabela difere da geral em +545,81161188 no Piauí e −545,81161188 no Ceará. Percentuais usam G, total da própria tabela; não há ajuste especulativo.
- Inadequação: E das abas correspondentes; denominador próprio em `Domicílios_urbanos_duráveis`. Categorias sobrepostas; não somar. Rural, improvisados, rústicos e cômodos excluídos; ônus de aluguel pode coexistir.
- Fundiária: a aba `Inadeq_Fundiária` contém o recorte **exclusivo**, não o total. Seu F usa outro denominador. Total correto extraído da tabela 30 do relatório, pp. impressas 87–89: Brasil 3.250.536, contra 2.153.610,78392 casos exclusivos na planilha. Os dois valores são preservados com nomes distintos; o comparador usa total / duráveis urbanos.

Conferência da leitura por openpyxl, separada da extração por XML: 990 células verificadas sem divergência. A página da tabela 30 com os totais nacionais foi inspecionada no PDF renderizado. É conferência por mecanismos diferentes, não auditoria independente de terceiros.

## Reprodução

```bash
python3 -m pipeline.habitacao.capturar --reproduzir
python3 -m unittest pipeline.tests.test_habitacao
npx vitest run src/tests/obee-habitacao.test.ts
```

Nova captura: salvar originais como `deficit.xlsx`, `inadequacao.xlsx`, `deficit.pdf`, `inadequacao.pdf`; extrair o texto do último com `pdftotext -layout` para `inadequacao.txt`. Executar `python3 -m pipeline.habitacao.capturar --fontes /caminho`. A extração está vinculada à edição; nova estrutura deve ser conferida, não substituída cegamente. O leitor XML compartilhado está em `pipeline.justica.capturar`.

Semente determinística e texto da tabela 30 versionados. Publicação sem rede, seis arquivos; teste compara bytes da reprodução. Build lê JSON versionado. Não há cron ou atualização automática implícita.

## Verificação de interface

```bash
HABITACAO_PLAYWRIGHT=/caminho/node_modules/playwright node scripts/obee/habitacao-verificacao.mjs
```

Requer build e Chromium de Playwright instalado. Sem `HABITACAO_URL`, o script inicia servidor local; com URL, verifica deployment. Relatórios/capturas em `HABITACAO_QA_DIR`, padrão `/tmp/habitacao-qa`.

Roteiro: cinco rotas × 320/390/768/1440 px; H1, HTTP, overflow, axe A/AA no conteúdo principal, captura integral; texto ampliado a 200% nas cinco páginas; filtros, recarga, voltar, tabela, CSV, teclado, ressalva PI/CE, denominador fundiário, downloads, sitemap, entrada no OBEE e 404. Não substitui leitor de tela, aparelho físico de toque nem zoom nativo. O resultado efetivamente executado e a publicação são registrados no PR.
