"""Vigília das fontes do Observatório do Saneamento (cheque `saneamento` de scripts/vigilancia.py).

O saneamento não tem coleta diária: a gold sai de um seed versionado (pipeline/observatorio_saneamento/seed),
com o sha256, o tamanho e o Last-Modified de cada original registrados em public/saneamento/gold/meta.json.
Sem rotina, uma retificação do SINISA, um arquivo novo do SISAGUA ou uma nova edição passam sem que ninguém
veja, e a gold publicada envelhece em silêncio. Este cheque compara o que a fonte serve hoje com o que o
meta.json registra, uma vez por semana, e acusa só o que pede decisão de quem mantém.

O que é vigiado e quando acusa:
- SINISA, página de resultados: link novo para arquivo do SINISA (snapshot em
  pipeline/watch/saneamento_sinisa_links.txt); página sem nenhum link (formato mudou: vigia cego);
  edição seguinte publicada (resultados-sinisa-<ano da edição + 1>, hoje respondendo 404).
- SINISA, ZIPs integrados: tamanho diferente do registrado (retificação de arquivo já integrado, como a
  da base municipal de água em 25/05/2026).
- SISAGUA (Ministério da Saúde, S3): arquivo registrado com tamanho ou Last-Modified diferente E mudança
  posterior a TOLERANCIA_SISAGUA_DIAS da captura (o Ministério reescreve os arquivos todo mês; a gold é
  anual); arquivo anual novo quando o ano completo já devia estar publicado (março do ano seguinte).
- CadÚnico (MDS, API MI Social): mês mais recente publicado até o mês corrente com LIMITE_MESES_CADUNICO
  ou mais de distância do mês mais recente da gold.

O que NÃO é vigiado, por não ter sinal confiável a custo baixo: Censo (decenal, só revisão), atos
tarifários dos reguladores (coleta manual, curadoria em pipeline/observatorio_saneamento/curadoria), o
módulo Gestão Municipal do SINISA além da presença do link (o meta.json guarda só o sha256) e fontes ainda
não integradas (CVM, Transferegov, DATASUS, JMP).

Fonte que não responde NÃO é silêncio: vira linha "não verificado" no corpo da issue. Vigia cego é pior que
alerta falso.

Contrato: `verificar(...)` devolve uma lista de linhas de acusação; vazia = silêncio (saída 0).
"""
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
META = RAIZ / "public" / "saneamento" / "gold" / "meta.json"
SNAPSHOT_LINKS = RAIZ / "pipeline" / "watch" / "saneamento_sinisa_links.txt"

TOLERANCIA_SISAGUA_DIAS = 60
LIMITE_MESES_CADUNICO = 3
MES_DO_ANO_COMPLETO_SISAGUA = 3  # março do ano seguinte: o ano fechado já devia estar publicado
UA = "ObservatorioBrasileiroDeCredito vigilancia saneamento"
S3_SISAGUA = "https://s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/SISAGUA/"
SINISA_BASE = (
    "https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/sinisa/resultados-sinisa/"
)
SINISA_SECAO = "/saneamento/sinisa/"
MISOCIAL = "https://aplicacoes.mds.gov.br/sagi/servicos/misocial"


class Rede:
    """Acesso à rede. Os testes trocam esta classe; o cheque nunca chama urllib direto."""

    def tamanho(self, url):
        """(status, bytes totais ou None, Last-Modified ou None) por um GET de 1 byte (HEAD é recusado pelo gov.br)."""
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Range": "bytes=0-0"})
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                intervalo = r.headers.get("Content-Range") or ""
                total = int(intervalo.rsplit("/", 1)[1]) if "/" in intervalo else int(r.headers.get("Content-Length") or 0)
                return r.status, total or None, r.headers.get("Last-Modified")
        except urllib.error.HTTPError as e:
            return e.code, None, None

    def texto(self, url):
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.status, r.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            return e.code, ""

    def json(self, url, params):
        return json.loads(self.texto(url + "?" + urllib.parse.urlencode(params))[1])


def _tenta(f, vezes=3):
    ultimo = None
    for _ in range(vezes):
        try:
            return f()
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError, ValueError) as e:
            ultimo = e
    raise ultimo


def _data(rfc):
    try:
        d = parsedate_to_datetime(rfc)
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def _iso(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def links_do_sinisa(html):
    """Links de arquivo da seção do SINISA na página (o menu lateral traz arquivos de outros temas)."""
    brutos = re.findall(r'href="([^"]+\.(?:zip|xlsx?|csv))"', html, re.I)
    absolutos = {urllib.parse.urljoin(SINISA_BASE, b) for b in brutos}
    return sorted(u for u in absolutos if SINISA_SECAO in u)


def sinisa(meta, rede, snapshot):
    linhas = []
    s = meta["sinisa"]
    status, html = _tenta(lambda: rede.texto(s["pagina"]))
    if status != 200:
        return [f"- SINISA: a página de resultados respondeu HTTP {status}; **não verificado** ({s['pagina']})."]
    links = links_do_sinisa(html)
    if not links:
        return [f"- SINISA: a página de resultados não devolveu nenhum link de arquivo do SINISA; o formato pode ter "
                f"mudado e a vigília está cega ({s['pagina']})."]
    novos = [u for u in links if u not in snapshot]
    for u in novos:
        linhas.append(f"- SINISA: link novo na página de resultados: {u}")
    # edição seguinte: o nome da página termina no ano da edição (2025 → 2026)
    m = re.search(r"resultados-sinisa-(\d{4})", s["pagina"])
    if m:
        proxima = s["pagina"].replace(m.group(0), f"resultados-sinisa-{int(m.group(1)) + 1}")
        st, _ = _tenta(lambda: rede.texto(proxima))
        if st == 200:
            linhas.append(f"- SINISA: a edição seguinte está publicada ({proxima}); a gold usa {s['edicao']}, ano de referência {s['ano_referencia']}.")
        elif st not in (404,):
            linhas.append(f"- SINISA: a página da edição seguinte respondeu HTTP {st}; **não verificado** ({proxima}).")
    for chave, z in s["zips"].items():
        st, total, _ = _tenta(lambda: rede.tamanho(z["url"]))
        if st not in (200, 206):
            linhas.append(f"- SINISA: ZIP de {chave} respondeu HTTP {st}; **não verificado** ({z['url']}).")
        elif total is not None and total != z["bytes"]:
            linhas.append(f"- SINISA: o ZIP de {chave} ({z['arquivo']}) mudou de {z['bytes']:,} para {total:,} bytes desde a coleta "
                          f"de {s['capturado_em'][:10]}: retificação de arquivo já integrado.".replace(",", "."))
    return linhas


def _arquivos_sisagua(meta):
    sis = meta["sisagua"]
    yield from sis["proveniencia"]["arquivos"]
    yield from sis["quimicos"]["proveniencia"]["arquivos"]


def sisagua(meta, rede, hoje):
    linhas = []
    sis = meta["sisagua"]
    capturas = [_iso(sis["proveniencia"]["capturado_em"]), _iso(sis["quimicos"]["proveniencia"]["capturado_em"])]
    captura_min = min(capturas)
    mudados, falhas = [], []
    for a in _arquivos_sisagua(meta):
        nome = a["url"].rsplit("/", 1)[1]
        st, total, lm = _tenta(lambda: rede.tamanho(a["url"]))
        if st not in (200, 206):
            falhas.append(f"{nome} (HTTP {st})")
            continue
        novo = _data(lm) if lm else None
        antigo = _data(a.get("last_modified") or "")
        if not (total is not None and total != a["bytes"]) and not (novo and antigo and novo > antigo):
            continue
        # defasagem da gold em relação à fonte: Last-Modified atual contra o registrado (ou contra a captura)
        base = antigo or captura_min
        dias = (novo - base).days if novo else None
        if dias is None or dias >= TOLERANCIA_SISAGUA_DIAS:
            quando = f"Last-Modified {novo:%d/%m/%Y}" if novo else "sem Last-Modified"
            registrado = f", registrado {antigo:%d/%m/%Y}" if antigo else ""
            tam = f"{total:,}".replace(",", ".") if total is not None else "?"
            mudados.append(f"{nome}: {quando}{registrado}, {tam} bytes contra {a['bytes']:,}".replace(",", "."))
    if mudados:
        linhas.append(f"- SISAGUA: {len(mudados)} arquivo(s) registrado(s) foram reescritos pelo Ministério pelo menos "
                      f"{TOLERANCIA_SISAGUA_DIAS} dias depois do Last-Modified registrado (captura de {captura_min:%d/%m/%Y}):")
        linhas.extend(f"  - {m}" for m in mudados[:12])
        if len(mudados) > 12:
            linhas.append(f"  - e mais {len(mudados) - 12}")
    if falhas:
        linhas.append(f"- SISAGUA: {len(falhas)} arquivo(s) não responderam e ficaram **não verificados**: " + "; ".join(falhas[:6]))
    # ano completo novo: o último ano da gold + 1, a partir de março do ano seguinte
    ano = max(sis["anos"]) + 1
    if (hoje.year, hoje.month) >= (ano + 1, MES_DO_ANO_COMPLETO_SISAGUA):
        for conjunto in ("controle_mensal_parametros_basicos", "vigilancia_parametros_basicos"):
            url = f"{S3_SISAGUA}{conjunto}_{ano}_csv.zip"
            st, _, _ = _tenta(lambda: rede.tamanho(url))
            if st in (200, 206):
                linhas.append(f"- SISAGUA: o arquivo anual de {ano} está publicado e a gold termina em {max(sis['anos'])} ({url}).")
            elif st not in (403, 404):
                linhas.append(f"- SISAGUA: o arquivo anual de {ano} respondeu HTTP {st}; **não verificado** ({url}).")
    return linhas


def cadunico(meta, rede, hoje):
    c = meta["cadunico"]
    j = _tenta(lambda: rede.json(MISOCIAL, {"q": f"anomes_s:[* TO {hoje.year:04d}{hoje.month:02d}]", "fl": "anomes_s",
                                            "rows": 1, "sort": "anomes_s desc", "wt": "json"}))
    docs = (j.get("response") or {}).get("docs") or []
    if not docs:
        return ["- CadÚnico: a API MI Social não devolveu nenhum mês até o mês corrente; **não verificado**."]
    mais_recente = docs[0]["anomes_s"]
    da_gold = c["mes_mais_recente"]
    distancia = (int(mais_recente[:4]) - int(da_gold[:4])) * 12 + int(mais_recente[4:]) - int(da_gold[4:])
    if distancia >= LIMITE_MESES_CADUNICO:
        return [f"- CadÚnico: a API publica o mês {mais_recente[4:]}/{mais_recente[:4]} e a gold usa {da_gold[4:]}/{da_gold[:4]} "
                f"como mês mais recente ({distancia} meses de distância; limite {LIMITE_MESES_CADUNICO})."]
    return []


def verificar(rede=None, hoje=None, meta=None, snapshot=None):
    rede = rede or Rede()
    hoje = hoje or date.today()
    meta = meta if meta is not None else json.loads(META.read_text(encoding="utf-8"))
    if snapshot is None:
        snapshot = {l.strip() for l in SNAPSHOT_LINKS.read_text(encoding="utf-8").splitlines() if l.strip()} if SNAPSHOT_LINKS.exists() else set()
    linhas = []
    for nome, f in (("SINISA", lambda: sinisa(meta, rede, snapshot)), ("SISAGUA", lambda: sisagua(meta, rede, hoje)),
                    ("CadÚnico", lambda: cadunico(meta, rede, hoje))):
        try:
            linhas.extend(f())
        except Exception as e:  # uma fonte fora do ar não cala as outras
            linhas.append(f"- {nome}: falha ao verificar (`{type(e).__name__}: {str(e)[:140]}`); **não verificado**.")
    return linhas


def corpo(linhas, meta=None):
    meta = meta if meta is not None else json.loads(META.read_text(encoding="utf-8"))
    s = meta["sinisa"]
    return (
        f"A gold do saneamento foi gerada de {s['edicao']} (ano de referência {s['ano_referencia']}), capturada em "
        f"{s['capturado_em'][:10]}. A comparação semanal com as fontes acusa:\n\n" + "\n".join(linhas) + "\n\n"
        "**O que fazer.** Linha \"não verificado\": a fonte não respondeu a esta execução; conferir se o endereço ou o bloqueio mudou. "
        "Mudança confirmada: recolher e reconstruir a gold com os comandos de docs/saneamento/README.md "
        "(`coletar --zips <pasta>`, `gold`, `tarifas`, testes), conferir as contagens de meta.json contra a fonte e publicar. "
        "O que a coleta registra em meta.json (tamanho, Last-Modified, sha256) é o que silencia o aviso; link novo do SINISA "
        "que não será integrado entra em pipeline/watch/saneamento_sinisa_links.txt no mesmo commit."
    )


def semear():
    """Uso local: grava o snapshot dos links do SINISA com o estado corrente da página."""
    meta = json.loads(META.read_text(encoding="utf-8"))
    status, html = Rede().texto(meta["sinisa"]["pagina"])
    links = links_do_sinisa(html)
    if status != 200 or not links:
        raise SystemExit(f"página do SINISA indisponível (HTTP {status}, {len(links)} links)")
    SNAPSHOT_LINKS.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT_LINKS.write_text("\n".join(links) + "\n", encoding="utf-8")
    print(f"snapshot com {len(links)} links gravado em {SNAPSHOT_LINKS}")
