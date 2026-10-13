import {describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {PAGINAS_MOBILIDADE,ROTA_MOBILIDADE} from '../lib/eficiencia/mobilidade/modelo';
import {estadoRotaMobilidade} from '../lib/eficiencia/mobilidade/roteamento';
vi.mock('@/lib/sessionCookie',()=>({verifySessionCookie:vi.fn(async()=>false)}));
import {middleware} from '../middleware';
import {verifySessionCookie} from '../lib/sessionCookie';
describe('Mobilidade: rotas com sessão e rejeição antes do streaming',()=>{
 it('compartilha o catálogo das oito páginas',()=>{for(const p of PAGINAS_MOBILIDADE){const path=ROTA_MOBILIDADE+(p.slug?'/'+p.slug:'');expect(estadoRotaMobilidade(path)).toBe('valida');expect(estadoRotaMobilidade(path+'/')).toBe('valida');}});
 it('rejeita caminhos desconhecidos e níveis adicionais',()=>{for(const s of ['/inexistente','/tempo/mais','/%2Fapp'])expect(estadoRotaMobilidade(ROTA_MOBILIDADE+s)).toBe('inexistente');});
 it('não abrange os outros observatórios nem a área de conta',()=>{for(const p of ['/app','/app/admin','/observatorio','/eficiencia-estatal/saude-capitais',ROTA_MOBILIDADE+'-outro'])expect(estadoRotaMobilidade(p)).toBe('fora');});
 it('exige sessão nas páginas válidas e devolve o visitante ao mesmo recorte depois do login',async()=>{vi.mocked(verifySessionCookie).mockClear();const r=await middleware(new NextRequest('https://scrutiniums.com'+ROTA_MOBILIDADE+'/tempo?uf=SP',{headers:{accept:'text/html'}}));expect(verifySessionCookie).toHaveBeenCalled();expect(r.status).toBe(307);const destino=new URL(r.headers.get('location')!);expect(destino.pathname).toBe('/entrar');expect(destino.searchParams.get('de')).toBe(ROTA_MOBILIDADE+'/tempo?uf=SP');expect(r.cookies.get('scrutiniums_destino')?.value).toBe(ROTA_MOBILIDADE+'/tempo?uf=SP');});
 it('com sessão válida, a página segue para a renderização',async()=>{vi.mocked(verifySessionCookie).mockResolvedValueOnce({token:'t',exp:9e9});const r=await middleware(new NextRequest('https://scrutiniums.com'+ROTA_MOBILIDADE+'/tempo'));expect(r.headers.get('x-middleware-next')).toBe('1');});
 it('a API de dados responde 401 sem sessão, sem redirecionar',async()=>{const r=await middleware(new NextRequest('https://scrutiniums.com/api/eficiencia-mobilidade/exportar'));expect(r.status).toBe(401);});
 it('a página de método do tema continua pública',async()=>{vi.mocked(verifySessionCookie).mockClear();const r=await middleware(new NextRequest('https://scrutiniums.com'+ROTA_MOBILIDADE+'/metodos'));expect(r.headers.get('x-middleware-next')).toBe('1');expect(verifySessionCookie).not.toHaveBeenCalled();});
 it('retorna 404 real, sem renderização nem autenticação',async()=>{vi.mocked(verifySessionCookie).mockClear();const r=await middleware(new NextRequest('https://scrutiniums.com'+ROTA_MOBILIDADE+'/inexistente'));expect(r.status).toBe(404);expect(r.headers.get('x-robots-tag')).toBe('noindex');expect(verifySessionCookie).not.toHaveBeenCalled();});
 it('mantém a proteção da área /app',async()=>{const r=await middleware(new NextRequest('https://scrutiniums.com/app'));expect(r.status).toBe(307);expect(new URL(r.headers.get('location')!).pathname).toBe('/entrar');expect(new URL(r.headers.get('location')!).searchParams.get('de')).toBe('/app');});
});
