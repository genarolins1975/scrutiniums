"""Avaliação dos painéis do Observatório do Setor Elétrico (P071, seção 15 da especificação).

Lê entradas versionadas em docs/observatorios/energia/avaliacao/ (medição por navegador,
jornadas, revisão visual e didática, resultado dos testes, histórico de rodadas) e as golds
publicadas, aplica a rubrica abaixo e escreve:

  public/energia/gold/avaliacao.json                    (lido pela página /setor-eletrico/metodologia/avaliacao)
  docs/observatorios/energia/AVALIACAO_PAGINAS.md
  docs/observatorios/energia/EVIDENCIAS_ACEITE.md

Regras que valem para toda a rubrica (seção 15.1 e anexo A10):
  - nota só existe com evidência medida ou revisão registrada; sem evidência, a dimensão é
    "não avaliada" e não satisfaz o aceite;
  - toda nota é truncada (nunca arredondada para cima) em uma casa decimal;
  - cada teto tem motivo escrito e aparece junto da nota;
  - a revisão visual e didática é feita por revisores em contexto limpo (agentes), a partir de
    capturas abertas e do texto da página: é revisão, não teste com usuários.

Uso:
  python3 scripts/energia_avaliacao.py [--rodada ID] [--relatorio relatorio.json] [--jornadas jornadas.json]
                                       [--rotas-construidas rotas.txt] [--registrar-rodada]
"""
import argparse
import hashlib
import json
import math
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GOLD_DIR = os.path.join(RAIZ, "public", "energia", "gold")
DOCS = os.path.join(RAIZ, "docs", "observatorios", "energia")
ENT = os.path.join(DOCS, "avaliacao")
SAIDA_JSON = os.path.join(GOLD_DIR, "avaliacao.json")
VERSAO_RUBRICA = "1.0"
PREFIXO = "/setor-eletrico"

# ---------------------------------------------------------------------------
# Rubrica
# ---------------------------------------------------------------------------

METAS = {"geral": 9.0, "didatismo": 9.5, "visual": 9.5}

DIMENSOES = [
    {"id": "didatismo", "nome": "Didatismo", "peso": 15, "fonte_da_nota": "revisao",
     "evidencia": "Pergunta respondida, linguagem, exemplo, interpretação e ligação entre conceitos",
     "regras": ["Nota do revisor em contexto limpo, que leu o texto da página e abriu as capturas em desktop e celular.",
                "9,5 ou mais exige que o revisor não registre nenhum defeito de clareza nos blocos lidos.",
                "Sem revisão registrada para a página, a dimensão fica não avaliada."],
     "tetos": []},
    {"id": "visual", "nome": "Qualidade visual", "peso": 12, "fonte_da_nota": "revisao",
     "evidencia": "Capturas inspecionadas, hierarquia, tipografia, densidade e consistência",
     "regras": ["Nota do revisor em contexto limpo, a partir das capturas abertas em 1440 e 390 px (primeira dobra e página inteira).",
                "9,5 ou mais exige que o revisor não registre nenhum defeito de hierarquia, densidade ou consistência.",
                "Sem revisão registrada para a página, a dimensão fica não avaliada."],
     "tetos": [{"valor": 6.0, "motivo": "rolagem horizontal da página em alguma largura medida (defeito visível ao leitor)"}]},
    {"id": "navegacao", "nome": "Navegação e usabilidade", "peso": 10, "fonte_da_nota": "medicao",
     "evidencia": "Jornadas executadas, descoberta de conteúdo e restauração de estado",
     "regras": ["Parte do teto aplicável (10 sem teto). Cada link interno quebrado tira 2,0 (até 6,0); cada âncora ausente no destino tira 0,5 (até 2,0).",
                "Primeiro foco que não seja o atalho Pular para o conteúdo tira 1,0; h1 diferente de um tira 1,5; título do documento vazio ou repetido em outra página tira 1,0.",
                "Foco preso nos primeiros passos de Tab tira 4,0; seletor de profundidade incoerente com URL, marcação ou botão voltar tira 2,0.",
                "Página sem menu de navegação tira 1,0."],
     "tetos": [{"valor": 9.0, "motivo": "nenhuma jornada de usuário executada passou pela página"},
               {"valor": 8.0, "motivo": "só jornadas interrompidas passaram pela página"}]},
    {"id": "interatividade", "nome": "Interatividade", "peso": 8, "fonte_da_nota": "medicao",
     "evidencia": "Controles funcionais e coerência das seleções",
     "regras": ["Parte do teto aplicável (10 sem teto) sobre os controles visíveis acionados em 390 e 1440 px (até 18 por largura): rádios, abas, botões de estado, resumos, caixas, seletores e cabeçalhos de ordenação, mais a ficha Comprove este número, o link copiável e o seletor de profundidade.",
                "Controle que não aciona tira 1,5 (até 6,0); controle sem efeito observável (URL, conteúdo ou resumo aberto) tira 0,5 (até 2,0); erro de console depois da ação tira 3,0 por controle (até 6,0); rolagem horizontal depois da ação tira 1,0 por controle (até 2,0).",
                "Ficha Comprove que não abre, não traz sha256, fonte e reprodução, ou não fecha com Esc tira 2,0 por falha (até 4,0); link copiável sem mensagem nem campo tira 2,0; seletor de profundidade incoerente tira 2,0.",
                "Página sem nenhum controle acionável fica não aplicável nesta dimensão e sai do cálculo ponderado."],
     "tetos": []},
    {"id": "acessibilidade", "nome": "Acessibilidade", "peso": 7, "fonte_da_nota": "medicao",
     "evidencia": "Teclado, foco, contraste, semântica, alternativas e mobile",
     "regras": ["Parte do teto aplicável (10 sem teto). Cada regra distinta do axe-core (WCAG 2.0, 2.1 e 2.2, A e AA) violada em qualquer largura ou modo: crítica tira 3,0, séria 2,0, moderada 1,0, leve 0,5.",
                "Parada de Tab sem indicador de foco visível tira 0,5 (até 2,0); foco fora da tela tira 0,5 (até 1,0); primeiro foco que não seja o atalho de conteúdo tira 1,0.",
                "Página sem idioma pt tira 1,0; sem região principal tira 2,0; alvos de toque menores que 24 px em 390 px tiram 0,25 cada (até 1,5); rolagem horizontal em 360 px tira 1,5."],
     "tetos": [{"valor": 9.0, "motivo": "sem leitor de tela real nem auditoria manual de WCAG: ferramenta automática e roteiro de teclado não cobrem todos os critérios"}]},
    {"id": "completude", "nome": "Completude", "peso": 12, "fonte_da_nota": "medicao",
     "evidencia": "Todos os itens e recortes obrigatórios com conteúdo válido",
     "regras": ["Painéis numéricos (seção 7.2): nota igual a 10 vezes a média de dez itens, cada um de 0 a 1: pergunta como título, resposta curta, período e universo e unidade, gráfico ou mapa, tabela equivalente, interação local, como ler e o que não permite concluir, Comprove este número, download e link compartilhável, próxima pergunta.",
                "Páginas editoriais, fichas e navegação (a seção 7.2 manda não aplicar o molde): nota igual a 10 vezes a média de sete itens: h1 único com abertura, fonte ou data declarada, limite de leitura declarado, caminho seguinte, evidência ou fonte oficial, conteúdo sem NaN nem data crua nem marcador de obra, equivalente textual para figuras.",
                "A presença é medida no modo com mais conteúdo (Auditar, 1440 px) e no Entender."],
     "tetos": []},
    {"id": "correcao", "nome": "Correção técnica e metodológica", "peso": 15, "fonte_da_nota": "evidencia_gold",
     "evidencia": "Fórmulas, universos, unidades, reconciliações e limites de inferência",
     "regras": ["Painéis numéricos: parte do teto aplicável (10 sem teto) sobre as golds que alimentam a página (publicacao.json, eixos.por_gold). Gold com veredito reprovado tira 4,0; ficha com divergência tira 3,0; ficha sem teste registrado tira 0,5 (até 3,0); ficha com ressalva tira 0,15 (até 1,5); gold com veredito ressalva tira 0,3 (até 1,0).",
                "Verbetes: conferidos na fonte primária valem 9,0; pendentes de conferência, declarados como tal, valem 6,0. Páginas editoriais e de navegação: teste automatizado confere cada promessa, nota 9,0 menos 1,0 por link ou âncora quebrados.",
                "Páginas de Dados e Metodologia: integridade do manifesto conferida no build e nenhuma checagem reprovada; cada checagem de arquivo reprovada tira 0,5 (até 2,0).",
                "Não se dá 10 em acurácia: o teto abaixo evita representar certeza sobre a fonte."],
     "tetos": [{"valor": 6.0, "motivo": "testes automatizados do módulo falham"},
               {"valor": 7.5, "motivo": "nenhuma gold da página tem ficha de evidência com teste registrado"},
               {"valor": 9.5, "motivo": "teto de acurácia: 8,5 mais 1,0 vezes a fração de fichas com reconciliação independente aprovada"}]},
    {"id": "rastreabilidade", "nome": "Rastreabilidade", "peso": 10, "fonte_da_nota": "medicao",
     "evidencia": "Fonte, transformação, versão e reprodução do número",
     "regras": ["Parte do teto aplicável (10 sem teto). Sem fonte declarada na página tira 3,0; sem data de referência ou de conferência tira 2,0; painel numérico sem Comprove este número tira 2,0; painel sem download tira 1,0.",
                "Ficha Comprove aberta sem sha256, sem fonte ou sem passos de reprodução tira 1,5 por ausência (até 3,0); gold da página fora do manifesto da publicação tira 3,0 por gold."],
     "tetos": [{"valor": 9.5, "motivo": "reprodução por terceiros, fora do ambiente do observatório, não foi exercitada"}]},
    {"id": "atualidade", "nome": "Atualidade e confiabilidade operacional", "peso": 6, "fonte_da_nota": "evidencia_gold",
     "evidencia": "Atualização, revisão, falha e recuperação verificadas",
     "regras": ["Conjuntos que alimentam a página (publicacao.json, conjuntos[].golds): parte do teto aplicável (10 sem teto). Atrasado tira 1,5; sem dado tira 0,7 (até 3,0); com falha recente de coleta tira 0,3 (até 1,5); captura atrás da fonte tira 0,2 (até 1,0).",
                "Frase com número e a palavra hoje, sem data, tira 0,5 (até 1,5).",
                "Página sem conjunto de dados associado (editorial, navegação) fica não aplicável nesta dimensão e sai do cálculo ponderado."],
     "tetos": [{"valor": 9.0, "motivo": "falha e recuperação verificadas por testes com falha simulada, sem exercício em produção"},
               {"valor": None, "motivo": "10 menos 4 vezes a fração de conjuntos sem SLA (cadência não monitorável)"}]},
    {"id": "desempenho", "nome": "Desempenho e manutenção", "peso": 5, "fonte_da_nota": "medicao",
     "evidencia": "Medição, volume de dados, simplicidade e documentação",
     "regras": ["Parte do teto aplicável (10 sem teto). HTML acima de 600 KB tira 2,0 e acima de 1 MB tira 4,0; JavaScript acima de 1 MB tira 1,0; mais de 8.000 nós no DOM tira 1,0 e mais de 15.000 tira 2,0.",
                "Módulo sem teste automatizado tira 2,0; módulo sem documento em docs/observatorios/energia/modulos tira 1,0. O tempo de carga em laboratório fica registrado como evidência e não pontua: depende da carga da máquina que mede."],
     "tetos": [{"valor": 9.0, "motivo": "desempenho medido só em laboratório, sem dado de campo (LCP, INP, CLS) de usuários reais"}]},
]
PESOS = {d["id"]: d["peso"] for d in DIMENSOES}
assert sum(PESOS.values()) == 100

# ---------------------------------------------------------------------------
# Rotas: entrega (módulo), tipo e golds
# ---------------------------------------------------------------------------

MODULOS = {
    "home": {"rotulo": "Página inicial", "vitest": ["energia-mapa"], "pytest": [], "doc": None},
    "visao-geral": {"rotulo": "Visão geral", "vitest": ["energia-visao"], "pytest": ["test_energia_visao"], "doc": "visao"},
    "agua-e-clima": {"rotulo": "Água e clima", "vitest": ["energia-agua"], "pytest": ["test_energia_agua"], "doc": "agua"},
    "carga": {"rotulo": "Carga", "vitest": ["energia-carga"], "pytest": ["test_energia_carga"], "doc": "carga"},
    "rede": {"rotulo": "Rede", "vitest": ["energia-rede"], "pytest": ["test_energia_rede"], "doc": "rede"},
    "pld": {"rotulo": "PLD e previsões", "vitest": ["energia-pld", "energia-previsoes"], "pytest": ["test_energia_pld", "test_energia_previsoes"], "doc": "pld"},
    "geracao": {"rotulo": "Geração", "vitest": ["energia-geracao"], "pytest": ["test_energia_geracao"], "doc": "geracao"},
    "mercado": {"rotulo": "Mercado", "vitest": ["energia-mercado", "energia-mercado-pagina"], "pytest": ["test_energia_mercado"], "doc": "mercado"},
    "conta-de-luz": {"rotulo": "Conta de luz", "vitest": ["energia-conta"], "pytest": ["test_energia_conta"], "doc": "conta"},
    "perdas": {"rotulo": "Perdas", "vitest": ["energia-perdas"], "pytest": ["test_energia_perdas"], "doc": "perdas"},
    "qualidade": {"rotulo": "Qualidade", "vitest": ["energia-qualidade"], "pytest": ["test_energia_qualidade"], "doc": "qualidade"},
    "inclusao-energetica": {"rotulo": "Inclusão energética", "vitest": ["energia-inclusao"], "pytest": ["test_energia_inclusao"], "doc": "inclusao"},
    "transicao": {"rotulo": "Transição e ambiente", "vitest": ["energia-transicao"], "pytest": ["test_energia_transicao"], "doc": "transicao"},
    "empresas": {"rotulo": "Empresas", "vitest": ["energia-empresas"], "pytest": ["test_energia_empresas"], "doc": "empresas"},
    "expansao": {"rotulo": "Expansão", "vitest": ["energia-expansao"], "pytest": ["test_energia_expansao"], "doc": "expansao"},
    "regulacao": {"rotulo": "Regulação", "vitest": ["energia-regulacao"], "pytest": ["test_energia_regulacao"], "doc": "regulacao"},
    "territorio": {"rotulo": "Território", "vitest": ["energia-territorio"], "pytest": ["test_energia_territorio", "test_energia_geo"], "doc": "territorio"},
    "aprenda": {"rotulo": "Aprenda", "vitest": ["energia-aprenda", "energia-conteudo-conferido"], "pytest": [], "doc": "aprenda"},
    "dados": {"rotulo": "Dados e metodologia", "vitest": ["energia-dados-interface", "energia-gold-contrato", "energia-governanca"], "pytest": ["test_energia_dados"], "doc": "dados"},
}

# golds que alimentam cada página (prefixo mais longo vence). A coerência com metricas.json é conferida em teste.
GOLDS_POR_PREFIXO = [
    (f"{PREFIXO}/visao-geral", ["sintese.json"]),
    (f"{PREFIXO}/agua-e-clima", ["agua_detalhe.json", "hidrologia.json"]),
    (f"{PREFIXO}/carga", ["carga.json", "carga_detalhe.json"]),
    (f"{PREFIXO}/rede", ["rede.json", "rede_detalhe.json"]),
    (f"{PREFIXO}/pld/previsoes", ["previsoes_desempenho.json"]),
    (f"{PREFIXO}/pld/modelos", ["previsoes_desempenho.json"]),
    (f"{PREFIXO}/pld", ["pld.json", "pld_detalhe.json", "cmo.json"]),
    (f"{PREFIXO}/geracao", ["geracao.json", "geracao_detalhe.json"]),
    (f"{PREFIXO}/mercado", ["mercado.json"]),
    (f"{PREFIXO}/conta-de-luz", ["conta.json"]),
    (f"{PREFIXO}/perdas", ["perdas.json"]),
    (f"{PREFIXO}/qualidade", ["qualidade.json"]),
    (f"{PREFIXO}/inclusao-energetica", ["inclusao.json"]),
    (f"{PREFIXO}/transicao", ["transicao.json"]),
    (f"{PREFIXO}/expansao", ["expansao.json"]),
    (f"{PREFIXO}/regulacao", ["regulacao.json"]),
    (f"{PREFIXO}/territorio", ["territorio.json"]),
    (f"{PREFIXO}/empresas/distribuidoras", ["empresas.json", "perdas.json", "qualidade.json", "conta.json"]),
    (f"{PREFIXO}/empresas", ["empresas.json"]),
]
GOLDS_DE_CONTROLE = {"dados": ["publicacao.json", "catalogo.json"], "metodologia": ["publicacao.json", "metricas.json"]}
ROTAS_EDITORIAIS = {f"{PREFIXO}/aprenda", f"{PREFIXO}/aprenda/trilhas"}


def modulo_da_rota(rota):
    resto = rota[len(PREFIXO):].strip("/")
    if not resto:
        return "home"
    topo = resto.split("/")[0]
    if topo == "metodologia":
        return "dados"
    return topo if topo in MODULOS else None


def tipo_da_rota(rota):
    resto = rota[len(PREFIXO):].strip("/").split("/")
    if resto == [""]:
        return "home"
    if resto[0] == "aprenda":
        if len(resto) == 1 or resto[1] == "trilhas":
            return "editorial"
        return "verbete"
    if resto[0] == "dados" and len(resto) == 2 and resto[1] not in ("saude", "reproducao"):
        return "ficha"
    if resto[0] == "empresas" and len(resto) == 2 and resto[1] not in ("ativos", "controle", "distribuidoras", "financas"):
        return "ficha"
    return "painel"


def golds_da_rota(rota):
    resto = rota[len(PREFIXO):].strip("/")
    topo = resto.split("/")[0] if resto else ""
    if topo in GOLDS_DE_CONTROLE:
        return GOLDS_DE_CONTROLE[topo]
    if tipo_da_rota(rota) == "ficha" and topo == "empresas":
        return ["empresas.json", "perdas.json", "qualidade.json", "conta.json"]
    if tipo_da_rota(rota) == "ficha" and topo == "dados":
        return ["publicacao.json", "catalogo.json"]
    for pref, golds in sorted(GOLDS_POR_PREFIXO, key=lambda t: -len(t[0])):
        if rota == pref or rota.startswith(pref + "/"):
            return golds
    return []


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def piso1(x):
    """Trunca em uma casa decimal: nota inferior nunca é arredondada para cima."""
    return math.floor(round(x, 6) * 10) / 10


def pt_fmt(n, casas=1):
    return pt(n, casas)


def lj(caminho, padrao=None):
    if not os.path.exists(caminho):
        return padrao
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


def escreve_json(caminho, obj, compacto=False):
    with open(caminho, "w", encoding="utf-8") as f:
        if compacto:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(obj, f, ensure_ascii=False, indent=1)
            f.write("\n")


def sel(ms, modo=None, largura=None):
    return [m for m in ms if (modo is None or m["modo"] == modo) and (largura is None or m["largura"] == largura)]


def maximo(ms, f):
    vs = [f(m) for m in ms if f(m) is not None]
    return max(vs) if vs else 0


def pt(n, casas=1):
    s = f"{n:,.{casas}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def kb(n):
    return f"{pt(n / 1024, 0)} KB"


class Nota:
    """Acumula deduções e tetos de uma dimensão e devolve o registro publicado."""

    def __init__(self, base=10.0):
        self.base = base
        self.deducoes = []
        self.tetos = []
        self.evidencias = []
        self.defeitos = []

    def deduz(self, pontos, motivo, maximo_pontos=None, ja=None):
        self.deducoes.append([pontos, motivo, maximo_pontos])

    def teto(self, valor, motivo):
        self.tetos.append((valor, motivo))

    def evid(self, texto):
        self.evidencias.append(texto)

    def defeito(self, codigo, severidade, descricao):
        self.defeitos.append({"codigo": codigo, "severidade": severidade, "descricao": descricao})

    def resultado(self):
        """Nota = teto aplicável (o menor teto, ou a base quando não há teto) menos as deduções, entre 0 e 10, truncada.
        O teto diz o melhor que a evidência disponível permite; cada defeito achado desconta do teto, para que um defeito
        pequeno não desapareça atrás do teto."""
        aplicados = [{"valor": v, "motivo": m} for v, m in self.tetos if v is not None and v < self.base - 1e-9]
        partida = min([self.base] + [a["valor"] for a in aplicados])
        itens = [{"pontos": round(p, 2), "motivo": m} for p, m, _ in self.deducoes if p > 0]
        nota = piso1(max(0.0, partida - sum(i["pontos"] for i in itens)))
        return {"nota": nota, "partida": round(partida, 2), "estado": "avaliada", "evidencias": self.evidencias, "deducoes": itens, "tetos": aplicados, "defeitos": self.defeitos}


def deduz_limitado(n, unidade, quantidade, motivo, maximo_pontos):
    if quantidade <= 0:
        return
    n.deduz(min(unidade * quantidade, maximo_pontos), motivo)


def nao_avaliada(motivo):
    return {"nota": None, "estado": "nao_avaliada", "evidencias": [motivo], "deducoes": [], "tetos": [], "defeitos": []}


def nao_aplicavel(motivo):
    return {"nota": None, "estado": "nao_aplicavel", "evidencias": [motivo], "deducoes": [], "tetos": [], "defeitos": []}


# ---------------------------------------------------------------------------
# Condensação do relatório do navegador
# ---------------------------------------------------------------------------

CAMPOS_COMPACTOS = ("largura", "modo", "status", "carga_ms", "bytes", "erros_console", "falhas_rede", "axe", "rolagem_horizontal", "transbordo")


def condensa(rel):
    out = {"base": rel.get("base"), "gerado_em": rel.get("gerado_em"), "navegador": rel.get("navegador"),
           "larguras": rel.get("larguras"), "modos": rel.get("modos"), "nao_medido": rel.get("nao_medido"), "rotas": []}
    for r in rel["rotas"]:
        meds = []
        for m in r.get("medicoes", []):
            completo = (m.get("modo") == "entender" and m.get("largura") in (390, 1440)) or (m.get("modo") == "auditar" and m.get("largura") == 1440)
            if completo:
                x = {k: v for k, v in m.items() if k != "rota"}
                c = x.get("controles")
                if c:
                    c["detalhe"] = [{k: d.get(k) for k in ("rotulo", "grupo", "ok", "acao", "mudou_url", "mudou_dom", "erros_depois", "rolagem_horizontal_depois", "motivo")} for d in c.get("detalhe", [])]
                x["paineis"] = [{k: p[k] for k in ("id", "quatro_blocos", "fonte", "baixar")} for p in x.get("paineis", [])]
            else:
                x = {k: m.get(k) for k in CAMPOS_COMPACTOS}
            meds.append(x)
        item = {"rota": r["rota"], "medicoes": meds}
        if r.get("erro"):
            item["erro"] = r["erro"]
        out["rotas"].append(item)
    return out


def familias(caminho_rotas):
    """Tamanho das famílias dinâmicas a partir da lista de rotas construídas."""
    rotas = [l.strip() for l in open(caminho_rotas, encoding="utf-8") if l.strip()]
    contagem = Counter(tipo_da_rota(r) for r in rotas)
    por_prefixo = Counter()
    for r in rotas:
        if tipo_da_rota(r) in ("verbete", "ficha"):
            por_prefixo[r[len(PREFIXO):].strip("/").split("/")[0]] += 1
    return {"total": len(rotas), "por_tipo": dict(contagem), "familias": dict(por_prefixo)}


# ---------------------------------------------------------------------------
# Dimensões
# ---------------------------------------------------------------------------

def d_didatismo_visual(chave, ctx):
    rev = (ctx["revisao"] or {}).get(chave)
    if not rev or rev.get("nota") is None:
        return nao_avaliada("sem revisão registrada para esta página nesta rodada")
    n = Nota()
    nota = float(rev["nota"])
    n.base = nota
    for o in rev.get("observacoes", [])[:5]:
        n.evid(o)
    if rev.get("defeitos"):
        n.evid("defeitos registrados pelo revisor: " + "; ".join(rev["defeitos"][:4]))
        if nota >= 9.5:
            n.teto(9.0, "defeito registrado pelo revisor impede nota a partir de 9,5")
    if chave == "visual" and any(m.get("rolagem_horizontal") for m in ctx["medicoes"]):
        n.teto(6.0, "rolagem horizontal da página em alguma largura medida")
        n.defeito("rolagem_horizontal", "alto", "rolagem horizontal da página")
    for d in rev.get("defeitos", []):
        n.defeito("revisao", "medio", d)
    r = n.resultado()
    r["revisor"] = rev.get("revisor")
    return r


def d_navegacao(ctx):
    ms = ctx["medicoes"]
    n = Nota()
    if not ms or any(m.get("status") != 200 for m in ms):
        r = Nota(0.0)
        r.evid("resposta HTTP diferente de 200 em alguma medição")
        r.defeito("status", "critico", "página não responde 200")
        return r.resultado()
    links = [m["links"] for m in ms if m.get("links")]
    quebrados = sorted({q for l in links for q in l["quebrados"]})
    ancoras = sorted({a for l in links for a in l["ancoras_ausentes"]})
    internos = max((l["internos"] for l in links), default=0)
    n.evid(f"{internos} links internos verificados (status HTTP), {len(quebrados)} quebrados; {len(ancoras)} âncoras ausentes no destino")
    deduz_limitado(n, 2.0, len(quebrados), f"{len(quebrados)} link(s) interno(s) quebrado(s)", 6.0)
    deduz_limitado(n, 0.5, len(ancoras), f"{len(ancoras)} âncora(s) ausente(s) no destino", 2.0)
    for q in quebrados:
        n.defeito("link_quebrado", "critico", f"link interno quebrado: {q}")
    for a in ancoras:
        n.defeito("ancora_ausente", "medio", f"âncora ausente no destino: {a}")
    tecl = [m["teclado"] for m in ms if m.get("teclado")]
    primeiros = {t.get("primeiro") for t in tecl}
    n.evid(f"primeiro foco: {', '.join(sorted(str(p) for p in primeiros))}; {max((t['alcancados'] for t in tecl), default=0)} paradas de Tab alcançadas")
    if any(not (t.get("primeiro") or "").lower().startswith("pular para o conteúdo") for t in tecl):
        n.deduz(1.0, "primeiro foco não é o atalho Pular para o conteúdo")
        n.defeito("sem_atalho", "medio", "primeiro foco não é o atalho Pular para o conteúdo")
    if any(t.get("preso_nos_primeiros_passos") for t in tecl):
        n.deduz(4.0, "foco preso nos primeiros passos de Tab")
        n.defeito("foco_preso", "critico", "foco preso nos primeiros passos de Tab")
    h1 = {len(m.get("h1", [])) for m in ms if "h1" in m}
    n.evid(f"h1 por medição: {', '.join(str(x) for x in sorted(h1))}; título do documento: {ctx['titulo']!r}")
    if h1 != {1}:
        n.deduz(1.5, "página sem h1 único")
        n.defeito("h1", "medio", "página sem h1 único")
    if not ctx["titulo"] or ctx["titulo_repetido"]:
        n.deduz(1.0, "título do documento vazio ou repetido em outra página")
        n.defeito("titulo", "baixo", "título do documento vazio ou repetido em outra página")
    if not any(m.get("marcos", {}).get("nav") for m in ms if "marcos" in m):
        n.deduz(1.0, "sem menu de navegação")
    modos = [m.get("modo_profundidade") for m in ms if m.get("modo_profundidade")]
    pres = [x for x in modos if x.get("presente")]
    if pres:
        inc = [x for x in pres if not x.get("coerente")]
        n.evid(f"seletor de profundidade: {len(pres) - len(inc)} de {len(pres)} medições coerentes com URL, marcação e botão voltar")
        if inc:
            n.deduz(2.0, "seletor de profundidade incoerente")
            n.defeito("modo_incoerente", "alto", "seletor de profundidade incoerente com URL, marcação ou botão voltar: " + "; ".join(inc[0].get("falhas", [])[:2]))
    else:
        n.evid("a página não usa o seletor de profundidade (conteúdo editorial)")
    j = ctx["jornadas_pagina"]
    if not j:
        n.teto(9.0, "nenhuma jornada de usuário executada passou pela página")
        n.evid("nenhuma das dez jornadas passou por esta página")
    else:
        cump = [x for x in j if x["resultado"] == "cumprida"]
        n.evid("jornadas que passaram pela página: " + ", ".join(f"{x['id']} ({x['resultado']})" for x in j))
        if not cump:
            n.teto(8.0, "só jornadas interrompidas passaram pela página")
    return n.resultado()


def d_interatividade(ctx):
    ms = [m for m in ctx["medicoes"] if m.get("controles") is not None]
    if not ms:
        return nao_avaliada("controles não medidos")
    n = Nota()
    falhas = Counter()
    sem_efeito = Counter()
    erros = Counter()
    rolagem = Counter()
    exercitados = 0
    for m in ms:
        c = m["controles"]
        exercitados += c["exercitados"]
        for d in c.get("detalhe", []):
            chave = f"{d.get('grupo') or ''}|{d.get('rotulo') or ''}"
            if not d.get("ok"):
                falhas[chave] += 1
            elif not d.get("mudou_url") and not d.get("mudou_dom"):
                sem_efeito[chave] += 1
            if d.get("ok") and d.get("erros_depois"):
                erros[chave] += 1
            if d.get("ok") and d.get("rolagem_horizontal_depois"):
                rolagem[chave] += 1
    cl = [m.get("copiar_link") for m in ms if m.get("copiar_link", {}).get("botoes")]
    cp = [m.get("comprove") for m in ms if m.get("comprove", {}).get("botoes")]
    md = [m.get("modo_profundidade") for m in ms if m.get("modo_profundidade", {}).get("presente")]
    total = len(cl) + len(cp) + len(md) + exercitados
    if total == 0:
        return nao_aplicavel("a página não tem controle acionável além da navegação")
    n.evid(f"{exercitados} acionamentos de controles do conteúdo em {len(ms)} medições; {len(falhas)} controles que não acionaram, {len(sem_efeito)} sem efeito observável, {len(erros)} com erro de console depois")
    deduz_limitado(n, 1.5, len(falhas), f"{len(falhas)} controle(s) que não aciona(m)", 6.0)
    deduz_limitado(n, 0.5, len(sem_efeito), f"{len(sem_efeito)} controle(s) sem efeito observável", 2.0)
    deduz_limitado(n, 3.0, len(erros), f"{len(erros)} controle(s) com erro de console depois da ação", 6.0)
    deduz_limitado(n, 1.0, len(rolagem), f"{len(rolagem)} controle(s) que causam rolagem horizontal", 2.0)
    for k in list(falhas)[:5]:
        n.defeito("controle_nao_aciona", "alto", f"controle não aciona: {k}")
    for k in list(sem_efeito)[:5]:
        n.defeito("controle_sem_efeito", "medio", f"controle sem efeito observável: {k}")
    for k in list(erros)[:5]:
        n.defeito("controle_erro", "alto", f"erro de console depois de acionar: {k}")
    if cp:
        ruins = [x for x in cp if not (x.get("aberta") and x.get("sha256") and x.get("fonte") and x.get("reproducao") and x.get("fecha_com_esc"))]
        n.evid(f"ficha Comprove este número: {len(cp) - len(ruins)} de {len(cp)} medições abrem com sha256, fonte e reprodução e fecham com Esc ({maximo(cp, lambda x: x.get('botoes'))} botões na página)")
        deduz_limitado(n, 2.0, len(ruins), "ficha Comprove com falha", 4.0)
        if ruins:
            n.defeito("comprove_falha", "alto", "ficha Comprove não abre, está incompleta ou não fecha com Esc")
    if cl:
        ruins = [x for x in cl if not x.get("ok")]
        n.evid(f"link copiável: {len(cl) - len(ruins)} de {len(cl)} medições devolveram mensagem ou campo com o endereço")
        deduz_limitado(n, 2.0, len(ruins), "link copiável sem retorno ao leitor", 2.0)
        if ruins:
            n.defeito("copiar_link", "medio", "Copiar link não devolve mensagem nem campo com o endereço")
    if md:
        inc = [x for x in md if not x.get("coerente")]
        n.evid(f"seletor de profundidade: {len(md) - len(inc)} de {len(md)} medições coerentes")
        if inc:
            n.deduz(2.0, "seletor de profundidade incoerente")
    return n.resultado()


def d_acessibilidade(ctx):
    ms = ctx["medicoes"]
    if not ms or any(m.get("axe") is None for m in ms):
        return nao_avaliada("varredura axe não executada")
    n = Nota()
    regras = {}
    for m in ms:
        for a in m["axe"]:
            regras.setdefault(a["id"], a)
    PES = {"critical": 3.0, "serious": 2.0, "moderate": 1.0, "minor": 0.5}
    n.evid(f"axe-core (WCAG 2.0, 2.1 e 2.2, A e AA) em {len(ms)} medições: {len(regras)} regra(s) violada(s)")
    for a in regras.values():
        n.deduz(PES.get(a["impacto"], 1.0), f"axe {a['id']} ({a['impacto']}), exemplo {a.get('exemplo')}")
        sev = "alto" if a["impacto"] in ("critical", "serious") else "medio"
        n.defeito(f"axe:{a['id']}", sev, f"axe {a['id']} ({a['impacto']}): {a.get('exemplo')}")
    tecl = [m["teclado"] for m in ms if m.get("teclado")]
    sem = max((t["sem_indicador"] for t in tecl), default=0)
    fora = max((t["foco_invisivel"] for t in tecl), default=0)
    n.evid(f"teclado: até {max((t['alcancados'] for t in tecl), default=0)} paradas de Tab por medição, {sem} sem indicador de foco visível, {fora} fora da tela")
    deduz_limitado(n, 0.5, sem, f"{sem} parada(s) de Tab sem indicador de foco visível", 2.0)
    deduz_limitado(n, 0.5, fora, f"{fora} parada(s) de Tab fora da tela", 1.0)
    if sem:
        n.defeito("foco_sem_indicador", "medio", "parada de Tab sem indicador de foco visível: " + "; ".join(next((t["exemplos_sem_indicador"] for t in tecl if t["sem_indicador"]), [])[:2]))
    if any(not (t.get("primeiro") or "").lower().startswith("pular para o conteúdo") for t in tecl):
        n.deduz(1.0, "primeiro foco não é o atalho de conteúdo")
    langs = {m.get("lang") for m in ms if "lang" in m}
    n.evid(f"idioma do documento: {', '.join(sorted(str(x) for x in langs))}")
    if any(not str(l or "").lower().startswith("pt") for l in langs):
        n.deduz(1.0, "idioma do documento não é pt")
        n.defeito("lang", "medio", "idioma do documento não é pt")
    if any("marcos" in m and not m["marcos"].get("main") for m in ms):
        n.deduz(2.0, "sem região principal")
        n.defeito("sem_main", "alto", "página sem região principal")
    peq = max((m["alvos"]["menores_24"] for m in sel(ms, largura=390) if m.get("alvos")), default=0)
    n.evid(f"alvos de toque em 390 px: {peq} menores que 24 px; {max((m['alvos']['menores_44'] for m in sel(ms, largura=390) if m.get('alvos')), default=0)} menores que 44 px (referência do contrato do observatório)")
    deduz_limitado(n, 0.25, peq, f"{peq} alvo(s) de toque menor(es) que 24 px", 1.5)
    if peq:
        n.defeito("alvo_toque", "medio", f"{peq} alvo(s) de toque menor(es) que 24 px em 390 px")
    r360 = [m for m in ms if m["largura"] == 360 and m.get("rolagem_horizontal")]
    if r360:
        n.deduz(1.5, "rolagem horizontal em 360 px (reflow, WCAG 1.4.10)")
        n.defeito("reflow_360", "alto", "rolagem horizontal em 360 px")
    n.teto(9.0, "sem leitor de tela real nem auditoria manual de WCAG: ferramenta automática e roteiro de teclado não cobrem todos os critérios")
    return n.resultado()


ITENS_PAINEL = [
    ("pergunta", "pergunta como título"), ("resposta", "resposta curta"), ("recorte", "período, universo e unidade"),
    ("visual", "gráfico ou mapa"), ("tabela", "tabela equivalente"), ("interacao", "interação local"),
    ("ler", "como ler e o que não permite concluir"), ("comprove", "Comprove este número"),
    ("baixar", "download e link compartilhável"), ("proxima", "próxima pergunta"),
]
ITENS_EDITORIAL = [
    ("h1", "h1 único com abertura"), ("fonte", "fonte ou data declarada"), ("limite", "limite de leitura declarado"),
    ("seguinte", "caminho seguinte"), ("evidencia", "evidência ou fonte oficial"), ("conteudo", "conteúdo sem NaN, data crua ou marcador de obra"),
    ("equivalente", "equivalente textual para as figuras"),
]


def d_completude(ctx):
    ms = ctx["medicoes"]
    if not ms or any(m.get("marcadores") is None for m in ms if m.get("modo") == "entender" and m.get("largura") in (390, 1440)):
        return nao_avaliada("marcadores de conteúdo não medidos")
    comp = [m for m in ms if m.get("marcadores")]
    mx = lambda f: maximo(comp, f)
    n = Nota()
    for chave, sev, texto in (("datas_cruas", "medio", "data em formato cru no texto"), ("nan_undefined", "alto", "valor de reserva (NaN, undefined) no texto"),
                              ("marcador_de_obra", "medio", "marcador de obra no texto"), ("unidade_duplicada", "medio", "unidade repetida no texto")):
        achados = sorted({x for m in comp if m.get("anomalias") for x in m["anomalias"].get(chave, [])})
        if achados:
            n.defeito(chave, sev, f"{texto}: " + " | ".join(a.strip()[:70] for a in achados[:2]))
    if ctx["tipo"] == "painel":
        paineis = max(1, mx(lambda m: m["marcadores"]["paineis"]) or 1)
        tit = [p for m in comp for p in m.get("paineis", [])]
        interr = ctx["perguntas"]
        itens = {
            "pergunta": ctx["fracao_pergunta"],
            "resposta": min(1.0, mx(lambda m: m["marcadores"]["resposta"]) / paineis),
            "recorte": min(1.0, mx(lambda m: m["marcadores"].get("recorte", 0)) / 3),
            "visual": 1.0 if mx(lambda m: m["marcadores"]["figuras"]) else 0.0,
            "tabela": 1.0 if mx(lambda m: m["marcadores"]["tabelas"]) else 0.0,
            "interacao": 1.0 if any(m.get("controles", {}).get("exercitados") for m in comp) else 0.0,
            "ler": 0.5 * bool(mx(lambda m: m["marcadores"]["interpretar"])) + 0.5 * bool(mx(lambda m: m["marcadores"]["nao_concluir"])),
            "comprove": 1.0 if mx(lambda m: m["marcadores"]["comprove"]) else 0.0,
            "baixar": 0.5 * bool(mx(lambda m: m["marcadores"]["baixar"])) + 0.5 * bool(mx(lambda m: m["marcadores"]["copiar_link"])),
            "proxima": 1.0 if mx(lambda m: m["marcadores"]["proxima"]) else 0.0,
        }
        lista = ITENS_PAINEL
        n.evid(f"{len(set(ctx['paineis_ids']))} painéis na página; títulos em forma de pergunta: {interr}")
    else:
        anom = [m["anomalias"] for m in comp if m.get("anomalias")]
        limpo = not any(a["datas_cruas"] or a["nan_undefined"] or a["marcador_de_obra"] or a.get("unidade_duplicada") for a in anom)
        itens = {
            "h1": 1.0 if all(len(m.get("h1", [])) == 1 for m in comp) and mx(lambda m: m["marcadores"].get("lead", 0)) >= 60 else 0.0,
            "fonte": 1.0 if mx(lambda m: m["marcadores"]["fonte"] + m["marcadores"]["referencia"] + m["marcadores"].get("conferido", 0) + m["marcadores"].get("externo", 0)) else 0.0,
            "limite": 1.0 if mx(lambda m: m["marcadores"]["nao_concluir"]) else 0.0,
            "seguinte": 1.0 if mx(lambda m: m["marcadores"]["proxima"] + m["marcadores"].get("relacionados", 0) + m["marcadores"]["glossario"]) else 0.0,
            "evidencia": 1.0 if mx(lambda m: m["marcadores"]["comprove"] + m["marcadores"].get("externo", 0)) else 0.0,
            "conteudo": 1.0 if limpo else 0.0,
            "equivalente": 1.0 if (not mx(lambda m: m["marcadores"]["figuras"])) or mx(lambda m: m["marcadores"]["tabelas"]) else 0.0,
        }
        lista = ITENS_EDITORIAL
    ausentes = [rot for chave, rot in lista if itens[chave] < 1.0]
    parciais = [f"{rot} ({pt(itens[chave], 1)})" for chave, rot in lista if 0 < itens[chave] < 1.0]
    media = sum(itens.values()) / len(itens)
    n.base = 10 * media
    n.evid(f"{len(lista)} itens da anatomia ({'seção 7.2' if ctx['tipo'] == 'painel' else 'página editorial ou ficha'}): {pt(sum(1 for v in itens.values() if v >= 1.0), 0)} completos")
    if ausentes:
        n.evid("itens ausentes ou incompletos: " + "; ".join(ausentes))
        n.defeito("anatomia", "medio", "itens ausentes da anatomia do painel: " + "; ".join(ausentes))
    r = n.resultado()
    r["itens"] = {k: round(v, 2) for k, v in itens.items()}
    return r


def d_correcao(ctx):
    tipo = ctx["tipo"]
    ev = ctx["evidencia_golds"]
    n = Nota()
    t = ctx["testes_modulo"]
    if tipo == "verbete":
        conf = ctx["verbete_conferido"]
        if conf is None:
            return nao_avaliada("situação de conferência do verbete não encontrada")
        n.base = 9.0 if conf else 6.0
        n.evid("verbete conferido na fonte primária; sem segunda conferência independente" if conf else "verbete pendente de conferência na fonte primária, declarado na página")
        ligacoes = [m for m in ctx["medicoes"] if m.get("links")]
        q = sorted({x for m in ligacoes for x in m["links"]["quebrados"] + m["links"]["ancoras_ausentes"]})
        deduz_limitado(n, 1.0, len(q), f"{len(q)} link(s) ou âncora(s) quebrados", 3.0)
        n.teto(9.0, "conferência feita pelo observatório, sem segunda conferência independente")
    elif tipo in ("home", "editorial"):
        if not t["vitest_total"]:
            return nao_avaliada("sem teste automatizado que confira as promessas da página")
        n.base = 9.0
        n.evid(f"{t['vitest_total']} testes automatizados do módulo ({t['vitest_falhas']} falhas) conferem as promessas e os destinos da página; a página não publica número próprio")
        ligacoes = [m for m in ctx["medicoes"] if m.get("links")]
        q = sorted({x for m in ligacoes for x in m["links"]["quebrados"] + m["links"]["ancoras_ausentes"]})
        deduz_limitado(n, 1.0, len(q), f"{len(q)} link(s) ou âncora(s) quebrados", 3.0)
        if t["vitest_falhas"]:
            n.teto(6.0, "testes automatizados do módulo falham")
    elif ctx["modulo"] == "dados":
        n.evid("manifesto da publicação conferido contra os arquivos entregues a cada build (teste automatizado), com sha256 por arquivo")
        n.evid(f"golds de controle: {ev['golds_integras']} de {ev['golds_total']} íntegras; arquivos CSV: {ev['csv_aprovados']} aprovados, {ev['csv_ressalva']} com ressalva, {ev['csv_reprovados']} reprovados")
        deduz_limitado(n, 0.5, ev["csv_reprovados"], f"{ev['csv_reprovados']} checagem(ns) de arquivo reprovada(s)", 2.0)
        if ev["csv_reprovados"]:
            n.defeito("csv_reprovado", "medio", f"{ev['csv_reprovados']} arquivo(s) CSV com checagem reprovada em publicacao.json (arquivos.csv_com_problema)")
        n.teto(9.0, "sem reconciliação independente do catálogo com o portal de origem além da listagem usada")
        if t["vitest_falhas"] or t["pytest_falhas"]:
            n.teto(6.0, "testes automatizados do módulo falham")
    else:
        golds = ctx["golds"]
        if not golds:
            return nao_avaliada("página sem gold associada na tabela de golds por página")
        n.evid(f"golds da página: {', '.join(golds)}")
        n.evid(f"fichas de evidência com teste registrado: {ev['fichas']} (reconciliação independente aprovada {ev['reconciliadas']}, controles aprovados {ev['controles']}, ressalva {ev['ressalva']}, divergência {ev['divergencia']}, pendência {ev['pendencia']})")
        if ev["fichas_sem_teste"]:
            n.evid(f"{ev['fichas_sem_teste']} fichas de evidência publicadas sem lista de testes (pendência pela definição do módulo Dados)")
        if ev["golds_ressalva"]:
            n.evid(f"golds com veredito ressalva: {', '.join(ev['golds_ressalva'])}")
        deduz_limitado(n, 4.0, len(ev["golds_reprovadas"]), "gold com veredito reprovado", 99)
        deduz_limitado(n, 3.0, ev["divergencia"], f"{ev['divergencia']} ficha(s) com divergência", 99)
        pend = ev["pendencia"] + ev["fichas_sem_teste"]
        if ev["fichas"] > 0:
            # sem nenhuma ficha com teste, o teto de 7,5 já representa o fato; com fichas, as que faltam descontam
            deduz_limitado(n, 0.5, pend, f"{pend} ficha(s) sem teste registrado", 3.0)
        deduz_limitado(n, 0.15, ev["ressalva"], f"{ev['ressalva']} ficha(s) com ressalva declarada", 1.5)
        deduz_limitado(n, 0.3, len(ev["golds_ressalva"]), f"{len(ev['golds_ressalva'])} gold(s) com veredito ressalva", 1.0)
        if ev["fichas"] == 0:
            n.teto(7.5, "nenhuma gold da página tem ficha de evidência com teste registrado")
            n.defeito("sem_ficha_com_teste", "alto", "nenhuma gold da página tem ficha de evidência com teste registrado")
        else:
            n.teto(8.5 + 1.0 * ev["reconciliadas"] / ev["fichas"], "teto de acurácia pela fração de fichas com reconciliação independente aprovada")
        if ev["pendencia"] or ev["fichas_sem_teste"]:
            n.defeito("ficha_sem_teste", "medio", f"{pend} ficha(s) de evidência sem teste registrado nas golds da página")
        if ev["divergencia"] or ev["golds_reprovadas"]:
            n.defeito("divergencia", "critico", "ficha com divergência ou gold reprovada")
        if t["vitest_falhas"] or t["pytest_falhas"]:
            n.teto(6.0, "testes automatizados do módulo falham")
        if not t["vitest_total"] and not t["pytest_total"]:
            n.teto(6.0, "módulo sem teste automatizado")
    n.evid(f"testes automatizados do módulo: {t['vitest_total']} em Vitest e {t['pytest_total']} em Python, {t['vitest_falhas'] + t['pytest_falhas']} falhas")
    return n.resultado()


def d_rastreabilidade(ctx):
    ms = [m for m in ctx["medicoes"] if m.get("marcadores")]
    if not ms:
        return nao_avaliada("marcadores não medidos")
    n = Nota()
    mx = lambda f: maximo(ms, f)
    fonte = mx(lambda m: m["marcadores"]["fonte"] + m["marcadores"].get("externo", 0) + m["marcadores"].get("conferido", 0))
    ref = mx(lambda m: m["marcadores"]["referencia"] + m["marcadores"].get("conferido", 0))
    n.evid(f"fonte declarada na página: {'sim' if fonte else 'não'}; data de referência ou de conferência: {'sim' if ref else 'não'}")
    if not fonte:
        n.deduz(3.0, "sem fonte declarada na página")
        n.defeito("sem_fonte", "alto", "página sem fonte declarada")
    if not ref:
        n.deduz(2.0, "sem data de referência ou de conferência")
        n.defeito("sem_referencia", "medio", "página sem data de referência ou de conferência")
    if ctx["tipo"] == "painel":
        com = mx(lambda m: m["marcadores"]["comprove"])
        n.evid(f"botões Comprove este número: {com}; downloads: {mx(lambda m: m['marcadores']['baixar'])}")
        if not com:
            n.deduz(2.0, "painel numérico sem Comprove este número")
            n.defeito("sem_comprove", "alto", "painel numérico sem Comprove este número")
        if not mx(lambda m: m["marcadores"]["baixar"]):
            n.deduz(1.0, "painel sem download")
            n.defeito("sem_download", "medio", "painel sem download")
    cp = [m["comprove"] for m in ms if m.get("comprove", {}).get("botoes")]
    if cp:
        sem_sha = sum(1 for x in cp if not x.get("sha256"))
        sem_fonte = sum(1 for x in cp if not x.get("fonte"))
        sem_rep = sum(1 for x in cp if not x.get("reproducao"))
        n.evid(f"ficha Comprove aberta em {len(cp)} medições: sha256 em {len(cp) - sem_sha}, fonte em {len(cp) - sem_fonte}, passos de reprodução em {len(cp) - sem_rep}")
        faltas = (sem_sha > 0) + (sem_fonte > 0) + (sem_rep > 0)
        n.deduz(min(1.5 * faltas, 3.0), "ficha Comprove sem sha256, fonte ou reprodução") if faltas else None
        if faltas:
            n.defeito("comprove_incompleta", "alto", "ficha Comprove sem sha256, fonte ou reprodução")
    fora = [g for g in ctx["golds"] if g not in ctx["manifesto"]]
    if ctx["golds"]:
        n.evid(f"golds da página no manifesto da publicação: {len(ctx['golds']) - len(fora)} de {len(ctx['golds'])}")
    deduz_limitado(n, 3.0, len(fora), f"{len(fora)} gold(s) fora do manifesto", 99)
    for g in fora:
        n.defeito("fora_do_manifesto", "alto", f"gold fora do manifesto: {g}")
    n.teto(9.5, "reprodução por terceiros, fora do ambiente do observatório, não foi exercitada")
    return n.resultado()


def d_atualidade(ctx):
    cj = ctx["conjuntos"]
    ms = [m for m in ctx["medicoes"] if m.get("anomalias")]
    if not cj:
        return nao_aplicavel("a página não lê conjunto de dados com cadência (conteúdo editorial ou de navegação)")
    n = Nota()
    sit = Counter(c["situacao"] for c in cj)
    n.evid(f"{len(cj)} conjuntos alimentam a página: " + ", ".join(f"{k.lower()} {v}" for k, v in sorted(sit.items())))
    deduz_limitado(n, 1.5, sit.get("ATRASADO", 0), f"{sit.get('ATRASADO', 0)} conjunto(s) atrasado(s)", 99)
    deduz_limitado(n, 0.7, sit.get("SEM DADO", 0), f"{sit.get('SEM DADO', 0)} conjunto(s) sem dado", 3.0)
    falha = sum(1 for c in cj if c["falha_recente"])
    atras = sum(1 for c in cj if c["atras_da_fonte"])
    deduz_limitado(n, 0.3, falha, f"{falha} conjunto(s) com falha recente de coleta", 1.5)
    deduz_limitado(n, 0.2, atras, f"{atras} conjunto(s) com captura atrás da fonte", 1.0)
    for c in cj:
        if c["situacao"] == "ATRASADO":
            n.defeito("conjunto_atrasado", "alto", f"conjunto atrasado: {c['id']} ({c['dias_atraso']} dias)")
    sem_sla = sit.get("SEM SLA", 0)
    if sem_sla:
        n.evid(f"{sem_sla} dos {len(cj)} conjuntos não têm SLA definido (cadência não monitorável)")
        n.teto(10 - 4 * sem_sla / len(cj), "fração de conjuntos sem SLA")
    hoje = []
    for m in ms:
        hoje += m["anomalias"].get("hoje_com_numero", [])
    hoje = sorted(set(hoje))
    if hoje:
        n.evid(f"{len(hoje)} frase(s) com número e a palavra hoje, sem data: " + " | ".join(h.strip()[:90] for h in hoje[:3]))
        deduz_limitado(n, 0.5, len(hoje), f"{len(hoje)} frase(s) com número e hoje, sem data", 1.5)
        n.defeito("hoje_sem_data", "medio", "frase com número e a palavra hoje, sem data de referência: " + hoje[0].strip()[:100])
    t = ctx["testes_modulo"]
    n.evid(f"tratamento de falha e de revisão: {ctx['testes_falha']} testes do pipeline com falha simulada, revisão ou parcial no módulo")
    n.teto(9.0, "falha e recuperação verificadas por testes com falha simulada, sem exercício em produção")
    return n.resultado()


def d_desempenho(ctx):
    ms = [m for m in ctx["medicoes"] if m.get("bytes")]
    if not ms:
        return nao_avaliada("bytes não medidos")
    n = Nota()
    html = max(m["bytes"]["html"] for m in ms)
    js = max(m["bytes"]["js"] for m in ms)
    dados = max(m["bytes"]["dados"] for m in ms)
    dom = max(m.get("dom_nos", 0) or 0 for m in ms)
    carga = max(m["carga_ms"] for m in sel(ms, modo="entender", largura=1440)) if sel(ms, modo="entender", largura=1440) else max(m["carga_ms"] for m in ms)
    n.evid(f"HTML {kb(html)}; JavaScript {kb(js)}; dados sob demanda {kb(dados)}; {pt(dom, 0)} nós no DOM; carga em laboratório {pt(carga / 1000, 1)} s (Chromium headless, sem limitação de rede)")
    if html > 1024 * 1024:
        n.deduz(4.0, f"HTML de {kb(html)}, acima de 1 MB")
        n.defeito("html_1mb", "medio", f"HTML de {kb(html)}, acima de 1 MB")
    elif html > 600 * 1024:
        n.deduz(2.0, f"HTML de {kb(html)}, acima de 600 KB (meta da seção 5.1 do contrato)")
        n.defeito("html_600kb", "baixo", f"HTML de {kb(html)}, acima da meta de 600 KB")
    if js > 1024 * 1024:
        n.deduz(1.0, f"JavaScript de {kb(js)}, acima de 1 MB")
    if dom > 15000:
        n.deduz(2.0, f"{pt(dom, 0)} nós no DOM, acima de 15.000")
    elif dom > 8000:
        n.deduz(1.0, f"{pt(dom, 0)} nós no DOM, acima de 8.000")
    t = ctx["testes_modulo"]
    mod = MODULOS.get(ctx["modulo"] or "", {})
    n.evid(f"manutenção: {t['vitest_total'] + t['pytest_total']} testes automatizados do módulo; documento do módulo: {'sim' if ctx['doc_modulo'] else 'não'}")
    if not (t["vitest_total"] + t["pytest_total"]):
        n.deduz(2.0, "módulo sem teste automatizado")
    if mod.get("doc") and not ctx["doc_modulo"]:
        n.deduz(1.0, "módulo sem documento em docs/observatorios/energia/modulos")
    n.teto(9.0, "desempenho medido só em laboratório, sem dado de campo (LCP, INP, CLS) de usuários reais")
    return n.resultado()


# ---------------------------------------------------------------------------
# Evidência vinda das golds
# ---------------------------------------------------------------------------

def percorre_fichas(o, saida):
    """Fichas de evidência sem lista de testes (valor_exibido e fonte, sem testes): pendência de teste."""
    if isinstance(o, dict):
        if "valor_exibido" in o and "fonte" in o and "testes" not in o:
            saida.append(o)
        for v in o.values():
            percorre_fichas(v, saida)
    elif isinstance(o, list):
        for v in o:
            percorre_fichas(v, saida)
    return saida


def carrega_evidencia_golds():
    pub = lj(os.path.join(GOLD_DIR, "publicacao.json"))
    man = lj(os.path.join(GOLD_DIR, "manifesto.json"), {})
    por_gold = pub["eixos"]["por_gold"]
    vered = {g["gold"]: g for g in pub["golds"]}
    sem_teste = {}
    for nome in sorted({g for _, gs in GOLDS_POR_PREFIXO for g in gs} | {"empresas.json", "perdas.json", "qualidade.json", "conta.json"}):
        caminho = os.path.join(GOLD_DIR, nome)
        sem_teste[nome] = len(percorre_fichas(lj(caminho, {}), [])) if os.path.exists(caminho) else 0
    arq = pub.get("arquivos", {}).get("csv_com_problema", [])
    csv = pub["resumo"].get("csv", {}).get("por_veredito", {})
    return {
        "pub": pub, "por_gold": por_gold, "vered": vered, "sem_teste": sem_teste,
        "manifesto": {c["caminho"].rsplit("/", 1)[-1] for c in man.get("arquivos", []) if c["caminho"].startswith("/energia/gold/")},
        "csv": {"aprovados": csv.get("aprovado", 0), "ressalva": csv.get("ressalva", 0), "reprovados": csv.get("reprovado", 0)},
        "golds_integras": pub["resumo"]["golds"]["integras"], "golds_total": pub["resumo"]["golds"]["total"],
        "conjuntos": pub["conjuntos"], "csv_com_problema": arq,
    }


def resumo_golds(g, golds):
    r = {"fichas": 0, "reconciliadas": 0, "controles": 0, "ressalva": 0, "divergencia": 0, "pendencia": 0, "fichas_sem_teste": 0,
         "golds_reprovadas": [], "golds_ressalva": [], "golds_integras": g["golds_integras"], "golds_total": g["golds_total"],
         "csv_aprovados": g["csv"]["aprovados"], "csv_ressalva": g["csv"]["ressalva"], "csv_reprovados": g["csv"]["reprovados"]}
    for nome in golds:
        pg = g["por_gold"].get(nome)
        if pg:
            s = pg["situacoes"]
            r["fichas"] += pg["fichas"]
            r["reconciliadas"] += s.get("reconciliacao_aprovada", 0)
            r["controles"] += s.get("controles_aprovados", 0)
            r["ressalva"] += s.get("ressalva", 0)
            r["divergencia"] += s.get("divergencia", 0)
            r["pendencia"] += s.get("pendencia", 0)
        r["fichas_sem_teste"] += g["sem_teste"].get(nome, 0)
        v = g["vered"].get(nome, {}).get("veredito")
        if v == "reprovado":
            r["golds_reprovadas"].append(nome)
        if v == "ressalva":
            r["golds_ressalva"].append(nome)
    return r


def conjuntos_da_pagina(g, golds):
    out = []
    for c in g["conjuntos"]:
        if set(c["golds"]) & set(golds):
            at = c.get("atualidade", {})
            out.append({"id": c["id"], "situacao": at.get("situacao") or "SEM SLA", "dias_atraso": at.get("dias_atraso") or 0,
                        "falha_recente": (c.get("coleta", {}).get("falhas_consecutivas") or 0) > 0,
                        "atras_da_fonte": "fonte_mais_nova" in c.get("capturas", {})})
    return out


def testes_do_modulo(modulo, testes):
    mod = MODULOS.get(modulo or "", {"vitest": [], "pytest": []})
    v = [testes["vitest"].get(f, {"total": 0, "falhas": 0}) for f in mod["vitest"]]
    p = [testes["python"].get(f, {"total": 0, "falhas": 0}) for f in mod["pytest"]]
    return {"vitest_total": sum(x["total"] for x in v), "vitest_falhas": sum(x["falhas"] for x in v),
            "pytest_total": sum(x["total"] for x in p), "pytest_falhas": sum(x["falhas"] for x in p)}


# ---------------------------------------------------------------------------
# Montagem
# ---------------------------------------------------------------------------

def monta(args):
    insp = lj(os.path.join(ENT, "inspecao.json"))
    if insp is None:
        sys.exit("falta docs/observatorios/energia/avaliacao/inspecao.json: rode scripts/energia-avaliacao.mjs e passe --relatorio")
    jornadas = lj(os.path.join(ENT, "jornadas.json"), {"jornadas": []})
    revisao = lj(os.path.join(ENT, "revisao_visual.json"), {"paginas": {}})
    testes = lj(os.path.join(ENT, "testes.json"), {"vitest": {}, "python": {}})
    historico = lj(os.path.join(ENT, "rodadas.json"), {"rodadas": []})
    g = carrega_evidencia_golds()
    titulos = Counter()
    for r in insp["rotas"]:
        for m in r["medicoes"]:
            if m.get("titulo"):
                titulos[m["titulo"]] += 1
                break
    paginas = []
    todos_defeitos = defaultdict(lambda: {"paginas": [], "descricao": None, "severidade": None, "dimensao": None})
    jorn = jornadas["jornadas"]
    n_falha_pipeline = {m: 0 for m in MODULOS}
    for m, mod in MODULOS.items():
        n_falha_pipeline[m] = 0
    dimensoes_ids = [d["id"] for d in DIMENSOES]
    for r in insp["rotas"]:
        rota = r["rota"]
        ms = r["medicoes"]
        modulo = modulo_da_rota(rota)
        tipo = tipo_da_rota(rota)
        golds = golds_da_rota(rota)
        titulo_doc = next((m.get("titulo") for m in ms if m.get("titulo")), None)
        ctx = {
            "rota": rota, "tipo": tipo, "modulo": modulo, "medicoes": ms, "golds": golds,
            "titulo": titulo_doc, "titulo_repetido": bool(titulo_doc) and titulos[titulo_doc] > 1,
            "revisao": (revisao.get("paginas", {}).get(rota) or {}),
            "jornadas_pagina": [{"id": j["id"], "resultado": j["resultado"]} for j in jorn if rota in j.get("paginas_visitadas", [])],
            "evidencia_golds": resumo_golds(g, golds), "manifesto": g["manifesto"], "conjuntos": conjuntos_da_pagina(g, golds),
            "testes_modulo": testes_do_modulo(modulo, testes), "testes_falha": testes.get("falha_simulada", {}).get(modulo or "", 0),
            "doc_modulo": bool(MODULOS.get(modulo or "", {}).get("doc")) and os.path.exists(os.path.join(DOCS, "modulos", f"{MODULOS[modulo]['doc']}.md")),
            "verbete_conferido": ((max((m["marcadores"].get("conferido_fonte_primaria", 0) for m in ms if m.get("marcadores")), default=0) > 0) if any(m.get("marcadores") for m in ms) else None) if tipo == "verbete" else None,
            "perguntas": "", "fracao_pergunta": 0.0, "paineis_ids": [],
        }
        # perguntas como título (medido em texto: heading do painel termina em interrogação)
        tit = [p.get("titulo", "") for m in ms for p in m.get("paineis", [])]
        ctx["paineis_ids"] = [p["id"] for m in ms for p in m.get("paineis", [])]
        tp = [m["titulos_pergunta"] for m in ms if m.get("titulos_pergunta")]
        melhor = max(tp, key=lambda x: (x["com_interrogacao"] / x["total"]) if x["total"] else 0) if tp else None
        ctx["perguntas"] = f"{melhor['com_interrogacao']} de {melhor['total']}" if melhor else "não medido"
        ctx["fracao_pergunta"] = (melhor["com_interrogacao"] / melhor["total"]) if melhor and melhor["total"] else 0.0
        dims = {
            "didatismo": d_didatismo_visual("didatismo", {**ctx, "revisao": ctx["revisao"]}),
            "visual": d_didatismo_visual("visual", {**ctx, "revisao": ctx["revisao"]}),
            "navegacao": d_navegacao(ctx), "interatividade": d_interatividade(ctx), "acessibilidade": d_acessibilidade(ctx),
            "completude": d_completude(ctx), "correcao": d_correcao(ctx), "rastreabilidade": d_rastreabilidade(ctx),
            "atualidade": d_atualidade(ctx), "desempenho": d_desempenho(ctx),
        }
        paginas.append({"rota": rota, "modulo": modulo, "tipo": tipo, "ctx": ctx, "dimensoes": dims})
    return insp, jornadas, revisao, testes, historico, g, paginas


def agrega(paginas):
    for p in paginas:
        aval = [(d, p["dimensoes"][d]) for d in PESOS if p["dimensoes"][d]["estado"] == "avaliada"]
        nao = [d for d in PESOS if p["dimensoes"][d]["estado"] == "nao_avaliada"]
        pesos = sum(PESOS[d] for d, _ in aval)
        p["nota_ponderada"] = piso1(sum(PESOS[d] * x["nota"] for d, x in aval) / pesos) if pesos else None
        p["completa"] = not nao
        p["nao_avaliadas"] = nao
        falhas = []
        for d, x in aval:
            meta = METAS.get(d, METAS["geral"])
            if x["nota"] < meta:
                falhas.append(f"{d} {pt(x['nota'], 1)} abaixo de {pt(meta, 1)}")
        for d in nao:
            falhas.append(f"{d} não avaliada")
        crit = [dd for d, x in aval for dd in x["defeitos"] if dd["severidade"] == "critico"]
        p["atende_meta"] = not falhas and not crit
        p["abaixo_da_meta"] = falhas
        p["defeitos_criticos"] = len(crit)
    return paginas


SEVERIDADES = ["critico", "alto", "medio", "baixo"]
ROTULO_SEVERIDADE = {"critico": "crítico", "alto": "alto", "medio": "médio", "baixo": "baixo"}


def agrega_defeitos(paginas, jornadas, historico):
    agrupados = {}

    def add(dim, codigo, sev, desc, rota):
        chave = f"{dim}|{codigo}|{desc if not codigo.startswith('axe:') else ''}"
        d = agrupados.setdefault(chave, {"dimensao": dim, "codigo": codigo, "severidade": sev, "descricao": desc, "paginas": []})
        if SEVERIDADES.index(sev) < SEVERIDADES.index(d["severidade"]):
            d["severidade"] = sev
        if rota not in d["paginas"]:
            d["paginas"].append(rota)

    for p in paginas:
        for dim, x in p["dimensoes"].items():
            for d in x["defeitos"]:
                add(dim, d["codigo"], d["severidade"], d["descricao"], p["rota"])
    for j in jornadas:
        if j["resultado"] != "cumprida":
            falhou = next((s for s in j["passos"] if s["resultado"] == "falhou"), {})
            rota = (j.get("paginas_visitadas") or [PREFIXO])[-1]
            add("navegacao", f"jornada:{j['id']}", "alto", f"jornada {j['id']} {j['resultado']} no passo \"{falhou.get('descricao', '')}\": {falhou.get('observado', '')}", rota)
    lista = sorted(agrupados.values(), key=lambda d: (SEVERIDADES.index(d["severidade"]), -len(d["paginas"]), d["dimensao"], d["descricao"]))
    for i, d in enumerate(lista, 1):
        d["id"] = f"D{i:03d}"
        d["n_paginas"] = len(d["paginas"])
        d["estado"] = "aberto"
        d["chave"] = hashlib.sha1(f"{d['dimensao']}|{d['codigo']}|{d['descricao']}".encode()).hexdigest()[:10]
    anterior = (historico["rodadas"][-1] if historico["rodadas"] else None)
    corrigidos = []
    if anterior:
        atuais = {d["chave"] for d in lista}
        corrigidos = [x for x in anterior.get("defeitos", []) if x["chave"] not in atuais]
    return lista, corrigidos


def resumo_dimensoes(paginas):
    out = {}
    for d in DIMENSOES:
        i = d["id"]
        aval = [p["dimensoes"][i]["nota"] for p in paginas if p["dimensoes"][i]["estado"] == "avaliada"]
        meta = METAS.get(i, METAS["geral"])
        out[i] = {
            "avaliadas": len(aval), "nao_avaliadas": sum(1 for p in paginas if p["dimensoes"][i]["estado"] == "nao_avaliada"),
            "nao_aplicaveis": sum(1 for p in paginas if p["dimensoes"][i]["estado"] == "nao_aplicavel"),
            "media": piso1(sum(aval) / len(aval)) if aval else None, "minimo": min(aval) if aval else None,
            "atendem_meta": sum(1 for v in aval if v >= meta), "meta": meta,
        }
    return out


def resumo_modulos(paginas):
    por = defaultdict(list)
    for p in paginas:
        por[p["modulo"]].append(p)
    out = []
    for m, ps in sorted(por.items(), key=lambda kv: list(MODULOS).index(kv[0]) if kv[0] in MODULOS else 99):
        dims = {}
        for d in DIMENSOES:
            i = d["id"]
            v = [p["dimensoes"][i]["nota"] for p in ps if p["dimensoes"][i]["estado"] == "avaliada"]
            nao = sum(1 for p in ps if p["dimensoes"][i]["estado"] == "nao_avaliada")
            dims[i] = {"media": piso1(sum(v) / len(v)) if v else None, "minimo": min(v) if v else None, "avaliadas": len(v), "nao_avaliadas": nao}
        pond = [p["nota_ponderada"] for p in ps if p["nota_ponderada"] is not None]
        out.append({"id": m, "rotulo": MODULOS[m]["rotulo"], "paginas": len(ps), "rotas": [p["rota"] for p in ps],
                    "dimensoes": dims, "nota_ponderada": piso1(sum(pond) / len(pond)) if pond else None,
                    "atendem_meta": sum(1 for p in ps if p["atende_meta"]), "completas": sum(1 for p in ps if p["completa"])})
    return out


def limites_da_avaliacao(insp):
    return [
        "A revisão de didatismo e de qualidade visual foi feita por revisores em contexto limpo (agentes de IA) sobre capturas abertas e o texto da página; não é teste com pessoas e não substitui um.",
        "As dez jornadas da seção 15.2 foram executadas como roteiro por script em Chromium headless, com verificação de fatos observáveis; não houve participante humano, amostra ou tarefa cronometrada.",
        "Acessibilidade foi medida com axe-core (WCAG 2.0, 2.1 e 2.2, A e AA) e roteiro de teclado; não houve teste com leitor de tela real (NVDA, JAWS, VoiceOver) nem auditoria manual de todos os critérios, e por isso a nota tem teto de 9,0.",
        "Desempenho foi medido em laboratório (Chromium headless, sem limitação de rede ou CPU); não há dado de campo (LCP, INP, CLS) de usuários reais, e por isso a nota tem teto de 9,0.",
        "Correção técnica depende das fichas de evidência e das validações já publicadas nas golds e dos testes do repositório; não houve reconciliação nova com fonte primária nesta avaliação.",
        "As famílias dinâmicas (verbetes do Aprenda, fichas de conjuntos de Dados e fichas de empresas) foram amostradas (seis páginas de cada); a nota da família vale para a amostra, não para as demais páginas.",
        "Os limiares de desempenho e de alvo de toque e os pontos de cada dedução são decisão de revisão registrada na rubrica, não norma externa.",
        "A avaliação mede a página como publicada na rodada indicada; a data de referência dos dados é a da publicação das golds (01/10/2026).",
    ]


def monta_saida(args):
    insp, jornadas, revisao, testes, historico, g, paginas = monta(args)
    paginas = agrega(paginas)
    jorn = jornadas["jornadas"]
    defeitos, corrigidos = agrega_defeitos(paginas, jorn, historico)
    por_rota = defaultdict(list)
    for d in defeitos:
        for r in d["paginas"]:
            por_rota[r].append(d["id"])
    amostradas = {t: n for t, n in (insp.get("universo", {}).get("por_tipo", {}) or {}).items() if t in ("verbete", "ficha")}
    universo = insp.get("universo", {})
    saida_pag = []
    for p in paginas:
        c = p["ctx"]
        titulo = next((m["h1"][0] for m in c["medicoes"] if m.get("h1")), None) or c["titulo"]
        saida_pag.append({
            "rota": p["rota"], "titulo": titulo, "modulo": p["modulo"], "tipo": p["tipo"],
            "amostra": p["tipo"] in ("verbete", "ficha"),
            "nota_ponderada": p["nota_ponderada"], "completa": p["completa"], "atende_meta": p["atende_meta"],
            "abaixo_da_meta": p["abaixo_da_meta"], "defeitos": por_rota.get(p["rota"], []),
            "golds": c["golds"], "dimensoes": p["dimensoes"],
        })
    pond = [p["nota_ponderada"] for p in paginas if p["nota_ponderada"] is not None]
    res_dim = resumo_dimensoes(paginas)
    sev = Counter(d["severidade"] for d in defeitos)
    cumpridas = Counter(j["resultado"] for j in jorn)
    data = (insp.get("gerado_em") or "")[:10]
    rodada_id = args.rodada or (historico["rodadas"][-1]["id"] if historico["rodadas"] else f"{data}-r1")
    saida = {
        "dominio": "energia", "gold": "avaliacao.json", "gerado_em": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "versao_pipeline": "energia-0.1.0", "versao_codigo": versao_codigo(), "disponivel": True,
        "versao_rubrica": VERSAO_RUBRICA, "painel": "P071",
        "rodada": {"id": rodada_id, "data_inspecao": data, "inspecao_gerada_em": insp.get("gerado_em"), "base": insp.get("base"),
                   "navegador": insp.get("navegador"), "larguras": insp.get("larguras"), "modos": insp.get("modos"),
                   "rotas_medidas": len(insp["rotas"]), "rotas_construidas": universo.get("total"),
                   "familias": universo.get("familias"), "referencia_dos_dados": g["pub"]["referencia"].get("hoje")},
        "metodo": {
            "resumo": "Cada página foi aberta em Chromium nas larguras de 360, 390, 768 e 1440 px nos modos Entender e Auditar (390 e 1440 px em Auditar). Foram medidos resposta, console, rede, axe-core, rolagem, teclado, alvos de toque, controles, ficha de prova, link copiável, links e âncoras, peso e anatomia. Dez jornadas de usuário foram executadas por roteiro. Revisores em contexto limpo leram o texto e abriram as capturas para dar nota de didatismo e de qualidade visual. A correção, a rastreabilidade e a atualidade usam as validações publicadas nas golds e os testes do repositório.",
            "scripts": ["scripts/energia-avaliacao.mjs", "scripts/energia-jornadas.mjs", "scripts/energia_avaliacao.py"],
            "entradas": "docs/observatorios/energia/avaliacao/",
        },
        "rubrica": {"dimensoes": [{k: v for k, v in d.items()} for d in DIMENSOES], "metas": METAS,
                    "escala": "0 a 10, truncada em uma casa decimal; nota inferior nunca é arredondada para cima. Nota = teto aplicável (10 se não houver) menos as deduções",
                    "estados": {"avaliada": "tem nota e evidência", "nao_avaliada": "não testada ou sem revisão registrada; não satisfaz o aceite",
                                "nao_aplicavel": "a dimensão não se aplica ao tipo de página e sai do cálculo ponderado"}},
        "resumo": {
            "paginas": len(paginas), "completas": sum(1 for p in paginas if p["completa"]), "atendem_meta": sum(1 for p in paginas if p["atende_meta"]),
            "nota_ponderada_media": piso1(sum(pond) / len(pond)) if pond else None,
            "por_dimensao": res_dim,
            "defeitos": {"abertos": len(defeitos), "por_severidade": {k: sev.get(k, 0) for k in SEVERIDADES}, "corrigidos_desde_a_rodada_anterior": len(corrigidos)},
            "jornadas": {"total": len(jorn), "cumpridas": cumpridas.get("cumprida", 0), "interrompidas": cumpridas.get("interrompida", 0), "falhas": cumpridas.get("falhou", 0)},
            "defeito_critico_conhecido": sev.get("critico", 0) > 0,
        },
        "modulos": resumo_modulos(paginas),
        "paginas": saida_pag,
        "jornadas": [{k: j.get(k) for k in ("id", "titulo", "perfil", "largura", "movel", "resultado", "passos_ok", "passos_total", "cliques", "duracao_ms", "erros_console", "paginas_visitadas", "passos", "atritos", "limite")} for j in jorn],
        "defeitos": [{k: d[k] for k in ("id", "severidade", "dimensao", "descricao", "n_paginas", "paginas", "estado", "chave")} for d in defeitos],
        "corrigidos": corrigidos,
        "rodadas": historico["rodadas"],
        "limites": limites_da_avaliacao(insp),
    }
    saida["proveniencia"] = {"avaliacao": proveniencia_avaliacao(saida)}
    saida["evidencias"] = evidencias_avaliacao(saida)
    return saida, paginas


REPO = "https://github.com/genarolins1975/scrutiniums"


def sha256_arquivo(caminho):
    h = hashlib.sha256()
    with open(caminho, "rb") as f:
        h.update(f.read())
    return h.hexdigest()


def arquivos_de_entrada(insp_gerado_em):
    out = []
    for nome in ("inspecao.json", "jornadas.json", "revisao_visual.json", "testes.json"):
        c = os.path.join(ENT, nome)
        if os.path.exists(c):
            out.append({"arquivo": f"docs/observatorios/energia/avaliacao/{nome}", "recurso": nome, "sha256": sha256_arquivo(c),
                        "capturado_em": insp_gerado_em, "publicado_em": None})
    return out


def proveniencia_avaliacao(a):
    agora = a["gerado_em"]
    ini = a["rodada"]["data_inspecao"]
    return {
        "indicador": "Avaliação dos painéis por dimensão (nota de 0 a 10)",
        "natureza": "CALCULADO",
        "fonte": {"orgao": "Scrutiniums (avaliação do observatório)", "dataset": "Medição por navegador, jornadas, revisão visual e didática, golds e testes",
                  "recurso": "docs/observatorios/energia/avaliacao/", "url_dataset": f"{REPO}/tree/main/docs/observatorios/energia/avaliacao",
                  "url_primaria": f"{REPO}/blob/main/scripts/energia_avaliacao.py",
                  "licenca": "Sem licença declarada no repositório para os metadados do pipeline; os dados de origem seguem a licença de cada fonte, registrada no catálogo."},
        "unidade": "nota de 0 a 10, truncada em uma casa decimal", "frequencia": "a cada rodada de avaliação",
        "periodo_referencia": {"inicio": ini, "fim": ini}, "publicado_pela_fonte_em": None, "capturado_em": a["rodada"]["inspecao_gerada_em"],
        "validado_em": agora, "cobertura_historica": {"inicio": ini, "fim": ini},
        "transformacoes": ["medição por Chromium (axe-core, teclado, controles, links, anatomia, peso)", "execução das dez jornadas por roteiro",
                           "revisão visual e didática por revisores em contexto limpo", "aplicação da rubrica com deduções e tetos publicados",
                           "média ponderada pelos pesos da seção 15.1, ignorando dimensão não aplicável"],
        "formula": "nota da página = soma(peso x nota) ÷ soma(peso) sobre as dimensões avaliadas e aplicáveis; cada nota = 10 menos as deduções, limitada pelos tetos, truncada em uma casa decimal",
        "snapshot": {"id": f"avaliacao@{a['rodada']['id']}", "sha256": sha256_arquivo(os.path.join(ENT, "inspecao.json"))},
        "versao_pipeline": a["versao_pipeline"], "versao_codigo": a["versao_codigo"],
        "revisoes_conhecidas": None,
        "limitacoes": a["limites"][:5],
        "download": "/energia/gold/avaliacao.json", "notas_fonte": None,
    }


def evidencias_avaliacao(a):
    sys.path.insert(0, RAIZ)
    from pipeline.energia import evidencia as ev
    from fractions import Fraction
    paginas = a["paginas"]
    fonte = {"orgao": "Scrutiniums (avaliação do observatório)", "conjunto": "Medição por navegador, jornadas e revisão",
             "recurso": "inspecao.json", "url": f"{REPO}/tree/main/docs/observatorios/energia/avaliacao", "arquivo": None, "sha256": None,
             "capturado_em": None, "publicado_em": None, "arquivos": arquivos_de_entrada(a["rodada"]["inspecao_gerada_em"])}
    per = {"inicio": a["rodada"]["data_inspecao"], "fim": a["rodada"]["data_inspecao"]}
    versao = {"pipeline": a["versao_pipeline"], "codigo": a["versao_codigo"], "publicacao": a["gerado_em"]}
    dl = [{"rotulo": "Avaliação completa (JSON)", "url": "/energia/gold/avaliacao.json"}]
    repro = "python3 scripts/energia_avaliacao.py (entradas em docs/observatorios/energia/avaliacao/); a medição se refaz com node scripts/energia-avaliacao.mjs"

    def media_exata(ps):
        vs = []
        for p in ps:
            aval = [(PESOS[d], x["nota"]) for d, x in p["dimensoes"].items() if x["estado"] == "avaliada"]
            if aval:
                vs.append(Fraction(sum(Fraction(w) * Fraction(str(n)) for w, n in aval), sum(w for w, _ in aval)))
        return sum(vs) / len(vs) if vs else None

    exata = media_exata(paginas)
    pub = a["resumo"]["nota_ponderada_media"]
    sem_evid = sum(1 for p in paginas for x in p["dimensoes"].values() if x["estado"] == "avaliada" and not x["evidencias"])
    acima_teto = sum(1 for p in paginas for x in p["dimensoes"].values() if x["estado"] == "avaliada" and x["tetos"] and x["nota"] > min(t["valor"] for t in x["tetos"]) + 1e-9)
    fichas = {}
    fichas["nota_media"] = ev.construir(
        indicador="Nota ponderada média das páginas", valor_exibido=pt(pub), valor_calculo=pub, unidade="nota de 0 a 10", periodo=per,
        entidade=f"{len(paginas)} páginas do observatório", universo=f"{a['rodada']['rotas_construidas']} rotas construídas; {len(paginas)} medidas (todas as de módulo e amostra das famílias dinâmicas)",
        fonte=fonte, consulta="média, sobre paginas[], de nota_ponderada (soma de peso x nota ÷ soma de peso das dimensões avaliadas e aplicáveis), truncada em uma casa",
        formula="média das notas ponderadas de cada página; pesos da seção 15.1 (didatismo 15, qualidade visual 12, navegação 10, interatividade 8, acessibilidade 7, completude 12, correção 15, rastreabilidade 10, atualidade 6, desempenho 5)",
        cobertura=f"{len(paginas)} páginas; dimensão não avaliada ou não aplicável sai do denominador da página",
        tratamento_ausencia="dimensão sem teste ou revisão fica como não avaliada e não entra como zero",
        testes=[ev.teste("média refeita com frações exatas", "aprovado" if exata is not None and math.floor(float(exata) * 10) / 10 == pub else "reprovado",
                         f"média exata {float(exata):.4f} sobre as notas por dimensão publicadas; publicada {pt(pub)}" if exata is not None else "sem notas"),
                ev.teste("toda nota avaliada tem evidência escrita", "aprovado" if sem_evid == 0 else "reprovado", f"{sem_evid} notas avaliadas sem evidência"),
                ev.teste("nenhuma nota acima do seu teto", "aprovado" if acima_teto == 0 else "reprovado", f"{acima_teto} notas acima do teto aplicado")],
        download=dl, reproducao=repro, versao=versao, revisoes="Rodada nova substitui a anterior; a anterior fica resumida em rodadas.")
    n_meta = sum(1 for p in paginas if p["atende_meta"])
    fichas["atendem_meta"] = ev.construir(
        indicador="Páginas que atendem à meta de produto", valor_exibido=str(n_meta), valor_calculo=float(n_meta), unidade="páginas", periodo=per,
        entidade=f"{len(paginas)} páginas do observatório", universo="páginas medidas nesta rodada", fonte=fonte,
        consulta="contagem, sobre paginas[], de atende_meta (todas as dimensões aplicáveis avaliadas, a partir de 9,0 e didatismo e visual a partir de 9,5, sem defeito crítico)",
        formula="contagem de páginas com nota de cada dimensão aplicável ≥ meta, nenhuma dimensão não avaliada e nenhum defeito crítico",
        cobertura=f"{len(paginas)} páginas", tratamento_ausencia="dimensão não avaliada reprova a meta: não satisfaz o aceite",
        testes=[ev.teste("contagem refeita a partir das notas por dimensão", "aprovado" if n_meta == sum(1 for p in paginas if all(x["estado"] != "nao_avaliada" and (x["nota"] is None or x["nota"] >= METAS.get(d, METAS["geral"])) for d, x in p["dimensoes"].items()) and not any(dd["severidade"] == "critico" for x in p["dimensoes"].values() for dd in x["defeitos"])) else "reprovado", f"{n_meta} de {len(paginas)} páginas")],
        download=dl, reproducao=repro, versao=versao, revisoes="Rodada nova substitui a anterior; a anterior fica resumida em rodadas.")
    ab = a["resumo"]["defeitos"]["abertos"]
    fichas["defeitos"] = ev.construir(
        indicador="Defeitos abertos", valor_exibido=str(ab), valor_calculo=float(ab), unidade="defeitos", periodo=per,
        entidade="avaliação das páginas", universo="defeitos agrupados por causa em todas as páginas medidas", fonte=fonte,
        consulta="contagem de defeitos[] (grupos por dimensão, código e descrição) com estado aberto",
        formula="um defeito por grupo de ocorrências iguais; a página lista as rotas afetadas",
        cobertura=f"{len(paginas)} páginas e {len(a['jornadas'])} jornadas", tratamento_ausencia="rodada sem medição de uma dimensão não afirma ausência de defeito nela",
        testes=[ev.teste("defeitos por severidade somam o total", "aprovado" if sum(a["resumo"]["defeitos"]["por_severidade"].values()) == ab else "reprovado",
                         f"{a['resumo']['defeitos']['por_severidade']}")],
        download=dl, reproducao=repro, versao=versao, revisoes="Rodada nova substitui a anterior; defeitos corrigidos aparecem em corrigidos.")
    return fichas


def versao_codigo():
    try:
        h = subprocess.run(["git", "rev-parse", "--short=12", "HEAD"], cwd=RAIZ, capture_output=True, text=True, check=True).stdout.strip()
        sujo = subprocess.run(["git", "status", "--porcelain"], cwd=RAIZ, capture_output=True, text=True, check=True).stdout.strip()
        return h + ("+alterado" if sujo else "")
    except Exception:
        return "desconhecida"


def registro_rodada(saida):
    return {"id": saida["rodada"]["id"], "data": saida["rodada"]["data_inspecao"], "versao_codigo": saida["versao_codigo"],
            "paginas": saida["resumo"]["paginas"], "nota_ponderada_media": saida["resumo"]["nota_ponderada_media"],
            "atendem_meta": saida["resumo"]["atendem_meta"], "defeitos": [{"chave": d["chave"], "severidade": d["severidade"], "dimensao": d["dimensao"], "descricao": d["descricao"], "n_paginas": d["n_paginas"]} for d in saida["defeitos"]],
            "defeitos_por_severidade": saida["resumo"]["defeitos"]["por_severidade"],
            "medias_por_dimensao": {k: v["media"] for k, v in saida["resumo"]["por_dimensao"].items()},
            "jornadas_cumpridas": saida["resumo"]["jornadas"]["cumpridas"]}


def integra_publicacao():
    """Aponta publicacao.json para avaliacao.json (mesma função que o módulo dados usa a cada execução do pipeline)
    e refaz o manifesto com os dois arquivos, para que o sha256 publicado confira com os bytes entregues."""
    sys.path.insert(0, RAIZ)
    from pipeline.energia import base
    from pipeline.energia.modulos import dados
    g = lj(os.path.join(GOLD_DIR, "publicacao.json"))
    g["avaliacao"] = dados.bloco_avaliacao()
    base.escreve_gold("publicacao.json", g)
    m = dados.escreve_manifesto(final=True)
    return m["totais"]["arquivos"], m["id_publicacao"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rodada", default=None)
    ap.add_argument("--relatorio")
    ap.add_argument("--jornadas")
    ap.add_argument("--rotas-construidas")
    ap.add_argument("--registrar-rodada", action="store_true")
    ap.add_argument("--sem-publicacao", action="store_true", help="não atualiza publicacao.json nem o manifesto")
    args = ap.parse_args()
    os.makedirs(ENT, exist_ok=True)
    if args.relatorio:
        c = condensa(lj(args.relatorio))
        if args.rotas_construidas:
            c["universo"] = familias(args.rotas_construidas)
        escreve_json(os.path.join(ENT, "inspecao.json"), c, compacto=True)
    if args.jornadas:
        escreve_json(os.path.join(ENT, "jornadas.json"), lj(args.jornadas))
    saida, paginas = monta_saida(args)
    if args.registrar_rodada:
        h = lj(os.path.join(ENT, "rodadas.json"), {"rodadas": []})
        h["rodadas"] = [r for r in h["rodadas"] if r["id"] != saida["rodada"]["id"]] + [registro_rodada(saida)]
        escreve_json(os.path.join(ENT, "rodadas.json"), h)
        saida["rodadas"] = h["rodadas"]
    escreve_json(SAIDA_JSON, saida, compacto=True)
    from energia_avaliacao_docs import escreve_documentos  # noqa: E402
    escreve_documentos(saida, DOCS)
    if not args.sem_publicacao:
        n, ident = integra_publicacao()
        print(f"publicacao.json e manifesto atualizados ({n} arquivos; id da publicação {ident[:12]})")
    r = saida["resumo"]
    print(f"{r['paginas']} páginas; nota ponderada média {r['nota_ponderada_media']}; {r['atendem_meta']} atendem a meta; defeitos {r['defeitos']['por_severidade']}; jornadas {r['jornadas']}")


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    main()
