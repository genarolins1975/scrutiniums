import {montarRetrato} from '@/lib/eficiencia/entrada';
import {csv} from '@/lib/eficiencia/entrada-nucleo';

/**
 * As 26 capitais do retrato da entrada, em CSV: as sete condições e os três recursos, com valor,
 * unidade, período e situação de cada um (o mesmo `csv(retrato)` que a entrada gerava no navegador).
 * A entrada é aberta (leva 1, 19/10/2026), mas a exportação fica com conta: esta rota não está em
 * src/lib/rotasPublicas.ts e o middleware pede a sessão. Antes era gerada no navegador, o que não
 * tinha como ficar atrás do login.
 */
export const dynamic = 'force-static';

export function GET() {
  return new Response('﻿' + csv(montarRetrato()), {
    headers: {'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="obee-retrato-26-capitais.csv"'},
  });
}
