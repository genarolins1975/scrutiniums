"""Gravura editorial do Observatório de Gás Natural (lâmina da home, 480 x 600).

Cena imaginária em traço de gravura: plataforma semissubmersível com tocha acesa,
navio metaneiro, unidade de processamento em terra e vegetação no primeiro plano.
Desenhada por código em supersampling e reduzida para 480 x 600.
Uso: python3 -I scripts/gas_gravura_home.py /tmp/gas.png e conversão para public/home/gas.webp (WebP, qualidade 84).
"""
import math
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

S = 4
W, H = 480 * S, 600 * S

CEU = np.array([11, 46, 54], float)
CEU_BAIXO = np.array([20, 62, 70], float)
CREME = np.array([224, 206, 176], float)
CREME_FRIO = np.array([180, 192, 186], float)
FOLHA = np.array([184, 188, 160], float)
OURO = np.array([216, 164, 90], float)

Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
ink = np.zeros((H, W, 3), np.float32)


def p(v):
    return v * S


def ruido(cy, cx, semente):
    r = np.random.default_rng(semente).random((cy, cx)).astype(np.float32)
    img = Image.fromarray((r * 255).astype(np.uint8), "L").resize((W, H), Image.BICUBIC)
    return np.asarray(img, np.float32) / 255.0


def fbm(by, bx, semente, oitavas=3):
    tot = np.zeros((H, W), np.float32)
    amp = soma = 0.0
    amp = 1.0
    for o in range(oitavas):
        tot += amp * ruido(by * 2 ** o, bx * 2 ** o, semente + o)
        soma += amp
        amp *= 0.5
    return tot / soma


N_ONDA = fbm(3, 8, 35)
N_TRACO = fbm(90, 26, 31, 2)
N_REFLEXO = fbm(70, 9, 41, 2)
N_GERAL = fbm(8, 8, 21)
N_NUVEM = fbm(6, 2, 11, 4)


def fatia(y0, y1, x0, x1):
    y0, y1 = max(0, int(y0)), min(H, int(math.ceil(y1)))
    x0, x1 = max(0, int(x0)), min(W, int(math.ceil(x1)))
    if y1 <= y0 or x1 <= x0:
        return None
    return (slice(y0, y1), slice(x0, x1))


def poligono(pts):
    xs = [p(a) for a, _ in pts]
    ys = [p(b) for _, b in pts]
    sl = fatia(min(ys) - 2, max(ys) + 2, min(xs) - 2, max(xs) + 2)
    if sl is None:
        return None, None
    img = Image.new("L", (sl[1].stop - sl[1].start, sl[0].stop - sl[0].start), 0)
    ImageDraw.Draw(img).polygon([(x - sl[1].start, y - sl[0].start) for x, y in zip(xs, ys)], fill=255)
    return sl, np.asarray(img, np.float32) / 255.0


def retangulo(x0, y0, x1, y1):
    return poligono([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])


def pintar(sl, m, cor):
    a = m[..., None]
    ink[sl] = ink[sl] * (1 - a) + np.asarray(cor, np.float32) * a


def hachura(sl, m, tom, u, passo, cor, quebra=None, nitidez=0.6):
    """Linhas claras sobre fundo escuro; a espessura acompanha o tom."""
    f = (u / passo) % 1.0
    d = np.minimum(f, 1 - f) * passo
    tom = np.clip(tom, 0, 1)
    meia = tom * passo * 0.5
    cob = np.clip(meia - d + nitidez, 0, 1) * np.clip(tom / 0.09, 0, 1)
    if quebra is not None:
        cob = cob * quebra
    a = (cob * m)[..., None]
    ink[sl] = ink[sl] * (1 - a) + np.asarray(cor, np.float32) * a


def u_ang(sl, graus):
    r = math.radians(graus)
    return -X[sl] * math.sin(r) + Y[sl] * math.cos(r)


# ------------------------------------------------------------------ céu
HOR = 226.0
t = np.clip(Y / p(HOR), 0, 1)[..., None] ** 2
ink[:] = CEU * (1 - t) + CEU_BAIXO * t

sl = fatia(0, p(HOR), 0, W)
banda = np.exp(-((Y[sl] - p(176)) / p(26)) ** 2) + 0.7 * np.exp(-((Y[sl] - p(64)) / p(18)) ** 2)
tom_n = np.clip((N_NUVEM[sl] - 0.56) * 3.0, 0, 1) * banda * 0.5
hachura(sl, np.ones_like(tom_n), tom_n, u_ang(sl, 0) + (N_ONDA[sl] - 0.5) * p(6), p(2.2), CREME_FRIO * 0.62 + CEU * 0.38)

FX, FY = 400.0, 114.0
dist = np.sqrt((X - p(FX)) ** 2 + (Y - p(FY)) ** 2)
brilho = (np.exp(-(dist / p(60)) ** 2) * 0.32 + np.exp(-(dist / p(16)) ** 2) * 0.35)[..., None]
ceu_m = (Y < p(HOR))[..., None]
ink[:] = np.where(ceu_m, ink + (OURO - ink) * brilho, ink)

# ------------------------------------------------------------------ relevo e cidade distantes
perfil = np.asarray(Image.fromarray((np.random.default_rng(5).random(12) * 255).astype(np.uint8)[None, :]).resize((W, 1), Image.BICUBIC), np.float32)[0] / 255.0
xs_ = np.arange(W, dtype=np.float32)
env = np.clip(1.25 - xs_ / p(230), 0.0, 1.0) + 0.45 * np.clip((xs_ - p(330)) / p(150), 0, 1)
morro = p(HOR) - (p(4) + p(30) * perfil) * env
sl = fatia(p(HOR) - p(40), p(HOR), 0, W)
m = ((Y[sl] > morro[None, :]) & (Y[sl] < p(HOR))).astype(np.float32)
pintar(sl, m, [15, 42, 48])
alt = np.clip((p(HOR) - Y[sl]) / np.maximum(p(HOR) - morro[None, :], 1), 0, 1)
hachura(sl, m, 0.12 + 0.30 * alt * (0.5 + 0.7 * N_GERAL[sl]), u_ang(sl, -10), p(2.0), CREME_FRIO * 0.8)

r = np.random.default_rng(12)
x = 4.0
luzes = []
while x < 150:
    lg = r.uniform(4, 10)
    ap = r.uniform(7, 30) * (1.2 - x / 200)
    sl, m = retangulo(x, HOR - 1 - ap, x + lg, HOR + 0.5)
    pintar(sl, m, [20, 48, 52])
    face = np.clip(1 - (X[sl] - p(x)) / p(lg), 0, 1)
    hachura(sl, m, 0.18 + 0.38 * face, u_ang(sl, 90), p(1.7), CREME * 0.85)
    for _ in range(int(ap / 6)):
        luzes.append((r.uniform(x + 1, x + lg - 1), r.uniform(HOR - ap + 2, HOR - 2)))
    x += lg + r.uniform(0.4, 2.2)

# ------------------------------------------------------------------ mar
def costa(xv):
    return 398 - 50 * (xv / 480) ** 1.2 + 5 * math.sin(xv / 37)


costa_px = np.array([p(costa(i / S)) for i in range(W)], np.float32)
sl = fatia(p(HOR), costa_px.max(), 0, W)
m = ((Y[sl] >= p(HOR)) & (Y[sl] < costa_px[None, :])).astype(np.float32)
pintar(sl, m, [8, 34, 42])
prof = np.clip((Y[sl] - p(HOR)) / (costa_px[None, :] - p(HOR)), 0, 1)
passo = p(1.9 + 3.2 * prof)
u_mar = Y[sl] + (N_ONDA[sl] - 0.5) * p(9)
quebra = np.clip((N_TRACO[sl] - 0.40) * 3.5, 0, 1)
ceu_ref = np.exp(-prof * 6) * 0.35
tom = (0.10 + 0.32 * (1 - prof) + ceu_ref) * (0.6 + 0.6 * N_GERAL[sl])
hachura(sl, m, tom, u_mar, passo, CREME_FRIO * 0.85, quebra)
# reflexo dourado da tocha e das colunas
refl = np.exp(-((X[sl] - p(FX - 6)) / p(24)) ** 2) * np.exp(-prof * 2.2)
qref = np.clip((N_REFLEXO[sl] - 0.45) * 5, 0, 1)
hachura(sl, m, np.clip(refl * 1.2, 0, 1), u_mar, passo, OURO, qref)

# ------------------------------------------------------------------ camadas de traço (PIL)
traco = Image.new("RGBA", (W, H), (0, 0, 0, 0))
dl = ImageDraw.Draw(traco)
C = (224, 206, 176, 255)
C2 = (190, 184, 164, 235)
C3 = (150, 156, 144, 200)
G = (226, 176, 98, 255)


def seg(pts, cor=C, larg=0.8, alvo=None):
    (alvo or dl).line([(p(a), p(b)) for a, b in pts], fill=cor, width=max(1, int(round(larg * S))), joint="curve")


def luz(x_, y_, rr=0.9, cor=G, alvo=None):
    (alvo or dl).ellipse([p(x_ - rr), p(y_ - rr), p(x_ + rr), p(y_ + rr)], fill=cor)


for lx, ly in luzes:
    if np.random.default_rng(int(lx * 100)).random() < 0.6:
        luz(lx, ly, 0.45)


def esfera(sl, m, cx, cy, rr, tom_min=0.08, ganho=0.85):
    nx = (X[sl] - p(cx)) / p(rr)
    ny = (Y[sl] - p(cy)) / p(rr)
    nz = np.sqrt(np.clip(1 - nx ** 2 - ny ** 2, 0, 1))
    lz = np.clip(-0.5 * nx - 0.55 * ny + 0.68 * nz, 0, 1) ** 1.3
    u = Y[sl] + (X[sl] - p(cx)) ** 2 / p(rr) * 0.45
    hachura(sl, m, tom_min + ganho * lz, u, p(1.6), CREME)


# ------------------------------------------------------------------ navio metaneiro
sl, m = poligono([(26, 261), (178, 261), (170, 278), (38, 278)])
pintar(sl, m, [12, 32, 38])
hachura(sl, m, 0.20 + 0.35 * (Y[sl] < p(265)), u_ang(sl, 0), p(1.7), CREME * 0.8)
sl, m = retangulo(152, 244, 168, 261)
pintar(sl, m, [26, 50, 52])
hachura(sl, m, 0.25 + 0.4 * (X[sl] < p(158)), u_ang(sl, 90), p(1.6), CREME * 0.9)
for cx in (52, 80, 108, 136):
    rr = 12.5
    sl, m = poligono([(cx + rr * math.cos(a), 261 + rr * math.sin(a)) for a in np.linspace(math.pi, 2 * math.pi, 40)])
    pintar(sl, m, [24, 46, 50])
    esfera(sl, m, cx, 261, rr)
seg([(26, 261), (178, 261)], C, 0.7)
seg([(160, 244), (160, 236)], C2, 0.5)
for lx in (155, 159, 163):
    luz(lx, 250, 0.5)
# esteira do navio
sl = fatia(p(276), p(290), p(30), p(200))
quebra = np.clip((N_TRACO[sl] - 0.35) * 4, 0, 1)
fade = np.clip(1 - (Y[sl] - p(278)) / p(10), 0, 1) * np.clip((X[sl] - p(30)) / p(150), 0, 1)
hachura(sl, np.ones_like(fade), 0.5 * fade, Y[sl], p(1.6), CREME_FRIO, quebra)

# ------------------------------------------------------------------ plataforma semissubmersível
PX0, PX1, D0, D1 = 182.0, 328.0, 182.0, 200.0
COLS = (194, 228, 282, 316)
for cx in COLS:
    sl, m = retangulo(cx - 6, D1, cx + 6, 250)
    pintar(sl, m, [20, 44, 48])
    face = np.clip(1 - (X[sl] - p(cx - 6)) / p(12), 0, 1)
    hachura(sl, m, 0.12 + 0.55 * face, u_ang(sl, 90), p(1.6), CREME * 0.92)
for (a, b) in ((COLS[0], COLS[1]), (COLS[2], COLS[3])):
    sl, m = retangulo(a - 7, 240, b + 7, 251)
    pintar(sl, m, [18, 40, 44])
    hachura(sl, m, 0.35, u_ang(sl, 0), p(1.5), CREME * 0.85)
sl, m = retangulo(PX0, D0, PX1, D1)
pintar(sl, m, [24, 48, 52])
hachura(sl, m, 0.68 - 0.36 * (Y[sl] > p(D0 + 8)), u_ang(sl, 0), p(1.5), CREME)
mods = [(186, 166, 214), (216, 156, 238), (244, 172, 260), (262, 168, 296), (298, 160, 324)]
for a, b, c in mods:
    sl, m = retangulo(a, b, c, D0)
    pintar(sl, m, [28, 52, 54])
    face = np.clip(1 - (X[sl] - p(a)) / p(c - a), 0, 1)
    hachura(sl, m, 0.18 + 0.55 * face ** 0.8, u_ang(sl, 90), p(1.5), CREME)
    seg([(a, b), (c, b)], C, 0.6)
    for yy in np.arange(b + 5, D0, 5):
        seg([(a + 1, yy), (c - 1, yy)], C3, 0.25)
sl, m = poligono([(150, 175), (186, 175), (182, 181), (154, 181)])
pintar(sl, m, [28, 52, 54])
hachura(sl, m, 0.8, u_ang(sl, 0), p(1.3), CREME)
seg([(154, 181), (170, 196)], C2, 0.5)
seg([(PX0, D0), (PX1, D0), (PX1, D1), (PX0, D1), (PX0, D0)], C, 0.8)
for cx in COLS:
    seg([(cx - 6, D1), (cx - 6, 250)], C2, 0.5)
for y_ in (226, 214):
    seg([(COLS[0] + 6, y_), (COLS[1] - 6, y_)], C2, 0.6)
    seg([(COLS[2] + 6, y_), (COLS[3] - 6, y_)], C2, 0.6)
seg([(COLS[1] + 6, 220), (COLS[2] - 6, 220)], C2, 0.6)
seg([(COLS[0] + 6, 214), (COLS[1] - 6, 226)], C3, 0.4)
seg([(COLS[2] + 6, 214), (COLS[3] - 6, 226)], C3, 0.4)
# torre de perfuração
tx0, tx1, tt0, tt1, ty0, ty1 = 220.0, 246.0, 229.0, 237.0, 156.0, 88.0
seg([(tx0, ty0), (tt0, ty1)], C, 0.9)
seg([(tx1, ty0), (tt1, ty1)], C, 0.9)
seg([(tt0 - 1.5, ty1), (tt1 + 1.5, ty1)], C, 0.9)
n = 10
for i in range(n + 1):
    f0 = i / n
    ya = ty0 + (ty1 - ty0) * f0
    xa, xb = tx0 + (tt0 - tx0) * f0, tx1 + (tt1 - tx1) * f0
    seg([(xa, ya), (xb, ya)], C2, 0.45)
    if i < n:
        f1 = (i + 1) / n
        yb = ty0 + (ty1 - ty0) * f1
        seg([(xa, ya), (tx1 + (tt1 - tx1) * f1, yb)], C3, 0.4)
        seg([(xb, ya), (tx0 + (tt0 - tx0) * f1, yb)], C3, 0.4)
seg([(233, ty1), (233, ty1 - 7)], C, 0.6)
luz(233, ty1 - 7.5, 0.9)
# guindaste
seg([(304, 160), (304, 146)], C, 1.0)
seg([(304, 148), (266, 120)], C, 0.8)
seg([(304, 154), (266, 120)], C3, 0.4)
seg([(266, 120), (266, 138)], C3, 0.3)
# lança da tocha
bx0, by0, bx1, by1 = 322.0, 166.0, FX - 3, FY + 10
seg([(bx0, by0), (bx1, by1)], C, 0.9)
seg([(bx0 + 2, by0 + 6), (bx1, by1 + 3)], C, 0.7)
for i in range(1, 13):
    f0 = i / 13
    xa, ya = bx0 + (bx1 - bx0) * f0, by0 + (by1 - by0) * f0
    xb, yb = bx0 + 2 + (bx1 - bx0 - 2) * f0, by0 + 6 + (by1 - by0 - 3) * f0
    seg([(xa, ya), (xb, yb)], C3, 0.4)
for lx, ly in [(190, 172), (203, 171), (226, 164), (250, 178), (270, 175), (286, 173), (306, 166), (318, 172), (198, 193), (246, 193), (296, 193), (312, 193)]:
    luz(lx, ly, 0.8)

chama = Image.new("RGBA", (W, H), (0, 0, 0, 0))
dch = ImageDraw.Draw(chama)
for rx, ry, cor in ((9, 20, (214, 146, 66, 110)), (6, 14, (238, 182, 100, 220)), (3, 8, (252, 236, 196, 255))):
    dch.polygon([(p(FX - rx), p(FY + 4)), (p(FX - rx * 0.5), p(FY - ry * 0.45)), (p(FX + rx * 0.15), p(FY - ry)),
                 (p(FX + rx * 0.75), p(FY - ry * 0.3)), (p(FX + rx), p(FY + 4)), (p(FX), p(FY + 7))], fill=cor)
chama = chama.filter(ImageFilter.GaussianBlur(S * 1.1))

# ------------------------------------------------------------------ terra e praia
sl = fatia(costa_px.min() - 2, H, 0, W)
m = (Y[sl] >= costa_px[None, :]).astype(np.float32)
pintar(sl, m, [12, 34, 36])
praia = np.clip(1 - (Y[sl] - costa_px[None, :]) / p(12), 0, 1)
hachura(sl, m, 0.02 + 0.6 * praia ** 1.5 + 0.07 * N_GERAL[sl], u_ang(sl, -6) + (N_ONDA[sl] - 0.5) * p(4), p(2.0), CREME * 0.85)
# espuma na linha da costa
sl = fatia(costa_px.min() - p(8), costa_px.max() + 2, 0, W)
perto = np.clip(1 - np.abs(Y[sl] - costa_px[None, :] + p(3)) / p(3), 0, 1)
hachura(sl, perto, 0.6, Y[sl], p(1.6), CREME, np.clip((N_TRACO[sl] - 0.3) * 3, 0, 1))

# ------------------------------------------------------------------ unidade de processamento de gás
BASE = 392.0
fundo_upgn = Image.new("RGBA", (W, H), (0, 0, 0, 0))
du = ImageDraw.Draw(fundo_upgn)
for cx, cy, rr in ((316, 352, 22), (364, 356, 19)):
    for lx in (-0.8, -0.35, 0.35, 0.8):
        seg([(cx + lx * rr, cy + rr * 0.5), (cx + lx * rr * 1.08, BASE)], C2, 0.8)
    sl, m = poligono([(cx + rr * math.cos(a), cy + rr * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 80)])
    pintar(sl, m, [22, 44, 48])
    esfera(sl, m, cx, cy, rr, 0.06, 0.9)
    seg([(cx - rr, cy + 1), (cx + rr, cy + 1)], C3, 0.4)
    seg([(cx, cy - rr), (cx, cy - rr - 4), (cx + 5, cy - rr - 4)], C2, 0.5)
sl, m = retangulo(398, 341, 452, BASE)
pintar(sl, m, [22, 44, 48])
cil = np.clip(np.cos((X[sl] - p(414)) / p(56) * math.pi * 0.95), 0, 1)
hachura(sl, m, 0.08 + 0.72 * cil ** 1.2, u_ang(sl, 90), p(1.6), CREME)
sl, m = poligono([(398 + 27 + 27 * math.cos(a), 341 + 4 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 60)])
hachura(sl, m, 0.75, u_ang(sl, 0), p(1.3), CREME)
for yy in (356, 371):
    seg([(398, yy), (452, yy)], C3, 0.35)
seg([(452, 341), (452, BASE)], C3, 0.4)
for cx, top, rw in ((262, 284, 5.5), (278, 298, 4.5), (292, 310, 4.0)):
    sl, m = retangulo(cx - rw, top, cx + rw, BASE)
    pintar(sl, m, [22, 44, 48])
    cil = np.clip(np.cos((X[sl] - p(cx - rw * 0.35)) / p(rw * 2.1) * math.pi), 0, 1)
    hachura(sl, m, 0.10 + 0.75 * cil, u_ang(sl, 90), p(1.4), CREME)
    seg([(cx - rw, top), (cx, top - 3), (cx + rw, top)], C, 0.6)
    for yy in np.arange(top + 9, BASE - 4, 13):
        seg([(cx - rw - 2.5, yy), (cx + rw + 2.5, yy)], C2, 0.45)
    luz(cx, top - 3.5, 0.7)
seg([(246, BASE), (246, 292)], C, 1.2)
luz(246, 291, 1.1)
sl, m = poligono([(198, BASE), (198, 368), (221, 359), (244, 368), (244, BASE)])
pintar(sl, m, [26, 48, 50])
hachura(sl, m, 0.45 + 0.25 * (X[sl] < p(221)), u_ang(sl, 0), p(1.5), CREME)
for wx in np.arange(203, 240, 6):
    dl.rectangle([p(wx), p(374), p(wx + 2.4), p(377.5)], fill=G)
for yy, cor, lg in ((383.5, C, 0.9), (386.2, C2, 0.7), (388.8, C2, 0.7)):
    seg([(120, yy + 14), (196, yy), (462, yy)], cor, lg)
for sx in range(126, 462, 11):
    yy = 383.5 + max(0.0, (196 - sx) * 14 / 76)
    seg([(sx, yy), (sx, yy + 8)], C3, 0.5)
seg([(70, 410), (120, 398)], C, 1.2)
seg([(70, 413), (120, 401)], C3, 0.5)

# ------------------------------------------------------------------ vegetação do primeiro plano
def cacho(cx, cy, rr, semente, vigor=1.0):
    rg = np.random.default_rng(semente)
    sl = fatia(p(cy - rr * 1.3), p(cy + rr * 1.3), p(cx - rr * 1.3), p(cx + rr * 1.3))
    if sl is None:
        return
    dx = (X[sl] - p(cx)) / p(rr)
    dy = (Y[sl] - p(cy)) / p(rr)
    ang = np.arctan2(dy, dx)
    borda = 1 + 0.12 * np.sin(6 * ang + rg.uniform(0, 6.3)) + 0.08 * np.sin(11 * ang + rg.uniform(0, 6.3))
    rad = np.sqrt(dx ** 2 + dy ** 2) / borda
    m = np.clip((1 - rad) * p(rr) * 0.6, 0, 1)
    if m.max() == 0:
        return
    nz = np.sqrt(np.clip(1 - rad ** 2, 0, 1))
    lz = np.clip(-0.55 * dx - 0.62 * dy + 0.55 * nz, 0, 1) ** 1.6
    pintar(sl, m, [7, 26, 28])
    tom = (0.02 + 0.72 * lz * vigor) * (0.6 + 0.6 * N_GERAL[sl])
    hachura(sl, m, tom, u_ang(sl, 32) + (N_ONDA[sl] - 0.5) * p(3), p(2.0), FOLHA)


def arvore(cx, cy, rr, semente, vigor=1.0):
    rg = np.random.default_rng(semente)
    k = int(8 + rr * 0.55)
    pts = []
    for _ in range(k):
        a = rg.uniform(math.pi, 2 * math.pi) if rg.random() < 0.7 else rg.uniform(0, math.pi)
        d = rg.uniform(0.0, 0.75) ** 0.8
        pts.append((cx + math.cos(a) * rr * d, cy + math.sin(a) * rr * d * 0.75, rr * rg.uniform(0.24, 0.40)))
    pts.sort(key=lambda q: q[1])
    for i, (x_, y_, r_) in enumerate(pts):
        cacho(x_, y_, r_, semente * 31 + i, vigor)


rg = np.random.default_rng(3)
arvores = []
for _ in range(26):
    arvores.append((rg.uniform(-20, 260), rg.uniform(440, 600), rg.uniform(24, 40)))
for _ in range(16):
    arvores.append((rg.uniform(240, 500), rg.uniform(462, 600), rg.uniform(22, 36)))
for _ in range(7):
    arvores.append((rg.uniform(-10, 130), rg.uniform(410, 440), rg.uniform(14, 20)))
for _ in range(14):
    arvores.append((rg.uniform(120, 490), rg.uniform(412, 450), rg.uniform(12, 19)))
arvores.sort(key=lambda q: q[1])

base = Image.fromarray(np.clip(ink, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
base.alpha_composite(traco)
base.alpha_composite(chama)
ink[:] = np.asarray(base.convert("RGB"), np.float32)

traco = Image.new("RGBA", (W, H), (0, 0, 0, 0))
dl = ImageDraw.Draw(traco)
for i, (cx, cy, rr) in enumerate(arvores):
    arvore(cx, cy, rr, 100 + i, 0.95 if cy < 470 else (0.8 if cy < 530 else 0.6))


def palmeira(bx, by, alt_, semente, curva):
    rg2 = np.random.default_rng(semente)
    topo = (bx + alt_ * curva, by - alt_)
    caule = [(bx + alt_ * curva * (f ** 1.6), by - alt_ * f) for f in np.linspace(0, 1, 16)]
    seg(caule, C2, 1.6)
    for (x_, y_) in caule[1:-1]:
        seg([(x_ - 1.4, y_), (x_ + 1.4, y_ + 0.6)], C3, 0.4)
    for k in range(11):
        ang = math.pi + (k / 10) * math.pi + rg2.uniform(-0.12, 0.12)
        comp = alt_ * rg2.uniform(0.34, 0.48)
        pts = []
        for j in range(12):
            f = j / 11
            xx = topo[0] + math.cos(ang) * comp * f
            yy = topo[1] + math.sin(ang) * comp * f * 0.45 + comp * 0.75 * f * f * (1 - abs(math.sin(ang)) * 0.3)
            pts.append((xx, yy))
        seg(pts, C, 0.7)
        for j in range(1, 12):
            f = j / 11
            xx, yy = pts[j]
            folha = 5.5 * (1 - f * 0.7)
            seg([(xx, yy), (xx - folha * 0.35, yy + folha)], C2, 0.45)
            seg([(xx, yy), (xx + folha * 0.35, yy + folha)], C2, 0.45)



base = Image.fromarray(np.clip(ink, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
base.alpha_composite(traco)
final = base.convert("RGB").resize((480, 600), Image.LANCZOS)
saida = sys.argv[1] if len(sys.argv) > 1 else "gas.png"
final.save(saida)
print("ok", saida)
