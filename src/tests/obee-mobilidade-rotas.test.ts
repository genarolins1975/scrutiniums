import {describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {PAGINAS_MOBILIDADE,ROTA_MOBILIDADE} from '../lib/eficiencia/mobilidade/modelo';
import {estadoRotaMobilidade} from '../lib/eficiencia/mobilidade/roteamento';
vi.mock('@/lib/sessionCookie',()=>({verifySessionCookie:vi.fn(async()=>false)}));
import {middleware} from '../middleware';
import {verifySessionCookie} from '../lib/sessionCookie';
describe('Mobilidade: rotas públicas e rejeição antes do streaming',()=>{
 it('compartilha o catálogo das oito páginas',()=>{for(const p of PAGINAS_MOBILIDADE){const path=ROTA_MOBILIDADE+(p.slug?'/'+p.slug:'');expect(estadoRotaMobilidade(path)).toBe('valida');expect(estadoRotaMobilidade(path+'/')).toBe('valida');}});
 it('rejeita caminhos desconhecidos e níveis adicionais',()=>{for(const s of ['/inexistente','/tempo/mais','/%2Fapp'])expect(estadoRotaMobilidade(ROTA_MOBILIDADE+s)).toBe('inexistente');});
 it('não abrange os outros observatórios nem a área de conta',()=>{for(const p of ['/app','/app/admin','/observatorio','/eficiencia-estatal/saude-capitais',ROTA_MOBILIDADE+'-outro'])expect(estadoRotaMobilidade(p)).toBe('fora');});
 it('mantém as páginas válidas abertas sem consultar credenciais',async()=>{vi.mocked(verifySessionCookie).mockClear();const r=await middleware(new NextRequest('https://scrutiniums.com'+ROTA_MOBILIDADE+'/tempo?uf=SP'));expect(r.headers.get('x-middleware-next')).toBe('1');expect(verifySessionCookie).not.toHaveBeenCalled();});
 it('retorna 404 real, sem renderização nem autenticação',async()=>{vi.mocked(verifySessionCookie).mockClear();const r=await middleware(new NextRequest('https://scrutiniums.com'+ROTA_MOBILIDADE+'/inexistente'));expect(r.status).toBe(404);expect(r.headers.get('x-robots-tag')).toBe('noindex');expect(verifySessionCookie).not.toHaveBeenCalled();});
 it('mantém a proteção da área /app',async()=>{const r=await middleware(new NextRequest('https://scrutiniums.com/app'));expect(r.status).toBe(307);expect(new URL(r.headers.get('location')!).pathname).toBe('/entrar');expect(new URL(r.headers.get('location')!).searchParams.get('de')).toBe('/app');});
});
