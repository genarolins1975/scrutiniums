import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/session';
import { trackEvent, type ProductEventName } from '@/lib/events';
import { checkRateLimit, POLICIES } from '@/lib/ratelimit';
export const runtime = 'nodejs';
const schema = z.object({ acao: z.enum(['simulacao', 'download', 'percurso']) }).strict();
const nomes: Record<z.infer<typeof schema>['acao'], ProductEventName> = { simulacao: 'agro_simulacao_calculada', download: 'agro_exportacao_solicitada', percurso: 'agro_percurso_trocado' };
export async function POST(req: Request) {
    const user = await getSessionUser();
    if (!user)
        return new NextResponse(null, { status: 204 });
    if (req.headers.get('origin') !== new URL(req.url).origin)
        return new NextResponse(null, { status: 403 });
    const limite = checkRateLimit('agro-uso:' + user.id, POLICIES.viewsPerUser);
    if (!limite.allowed)
        return new NextResponse(null, { status: 429 });
    let body: unknown;
    try {
        body = await req.json();
    }
    catch {
        return new NextResponse(null, { status: 400 });
    }
    const result = schema.safeParse(body);
    if (!result.success)
        return new NextResponse(null, { status: 400 });
    // Sem userId: registros de uso por tipo/data, sem perfil, parâmetro ou valor pessoal.
    await trackEvent(nomes[result.data.acao]);
    return new NextResponse(null, { status: 204 });
}
