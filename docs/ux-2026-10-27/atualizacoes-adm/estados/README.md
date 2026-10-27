# Estados de auditoria do monitor

27/10/2026. Fixtures locais derivadas de `../estado-observado.json`, sem gravação no GitHub ou na produção.

- `vencido.json`: somente o instante de geração foi deslocado para 20/10/2026. A ressalva de consulta fora do prazo aparece e o frescor das publicações continua vindo dos arquivos do site.
- `parcial.json`: dois erros de consulta explícitos e execução de Energia ausente; quadro e fila indicam a limitação.
- Indisponível: caminho local inexistente. O erro de leitura gera aviso, mantendo os arquivos publicados e as tarefas manuais.

Reprodução após `npm run build`, com Chromium configurado:

```bash
npm run evidencias -- --rotas /app/admin/atualizacoes --conta adm --modos com --larguras 390,1440 --estado-operacoes docs/ux-2026-10-27/atualizacoes-adm/estados/vencido.json --saida /tmp/adm-vencido
```

Trocar o estado por `parcial.json` ou por um caminho inexistente para os demais casos. As capturas registram o build `mXMizLsighsc8Sf0SmbFi`; o comando futuro usa o build então disponível. A consulta observada também envelhece: após três horas, sua reprodução deve mostrar a ressalva, e não fingir uma consulta nova.
