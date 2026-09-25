"""Estimación de los valores reales (no normalizados) de las métricas de THE, QS
y Scimago para la PUCV, y pruebas sobre la forma de la normalización de cada
ranking.

Todo sale de datos que ya están en el repositorio:

- backend/backup.sql ........................ métricas cargadas en la plataforma
- KAI/THE/Código y outputs/csv/ ............. "key statistics" y pilares de THE
- KAI/QS/DatosQS/QS global/ ................. puntajes QS World (Excel de qs.com)
- KAI/Top 2_ Scientist Rankings/ ............ publicaciones PUCV en OpenAlex
- tools/scopus_scraper/resultados_scopus.csv  perfiles de autor PUCV en Scopus

Uso (desde la raíz del repositorio):

    python tools/desnormalizacion/estimar_valores_pucv.py

Escribe tools/desnormalizacion/valores_reales_pucv.csv y muestra en pantalla
las pruebas que respaldan docs/estudio-desnormalizacion-rankings.md.
"""

import re
import unicodedata
from pathlib import Path

import numpy as np
import pandas as pd

RAIZ = Path(__file__).resolve().parents[2]
DUMP = RAIZ / "backend" / "backup.sql"
THE_CSV = RAIZ / "KAI" / "THE" / "Código y outputs" / "csv"
QS_WORLD_2025 = RAIZ / "KAI" / "QS" / "DatosQS" / "QS global" / "2025 QS World University Rankings 2.2 (For qs.com).xlsx"
OPENALEX = RAIZ / "KAI" / "Top 2_ Scientist Rankings" / "openalex_pucv_publicaciones_TODAS.csv"
SCIMAGO_CSV = RAIZ / "KAI" / "Scimago" / "SCIMAGO-DATA" / "instituciones_chilenas_limpias.csv"
AUTORES_SCOPUS = RAIZ / "tools" / "scopus_scraper" / "resultados_scopus.csv"
SALIDA = Path(__file__).resolve().parent / "valores_reales_pucv.csv"

PUCV_DB = "Pontificia Universidad Catolica de Valparaiso"
PUCV_THE = "Pontifical Catholic University of Valparaíso"

# Nombres en inglés que usa THE -> nombres de la tabla `universidad`.
THE_A_DB = {
    "Pontificia Universidad Católica de Chile": "Pontificia Universidad Catolica de Chile",
    "Pontifical Catholic University of Valparaíso": PUCV_DB,
    "Adolfo Ibáñez University": "Universidad Adolfo Ibanez",
    "Alberto Hurtado University": "Universidad Alberto Hurtado",
    "Arturo Prat University": "Universidad Arturo Prat",
    "Austral University of Chile": "Universidad Austral de Chile",
    "Bernardo O’Higgins University": "Universidad Bernardo O'Higgins",
    "Catholic University of the North": "Universidad Catolica del Norte",
    "Diego Portales University": "Universidad Diego Portales",
    "Federico Santa María Technical University": "Universidad Tecnica Federico Santa Maria",
    "Finis Terrae University": "Universidad Finis Terrae",
    "Temuco Catholic University": "Universidad Catolica de Temuco",
    "Universidad Andrés Bello (UNAB)": "Universidad Andres Bello",
    "Universidad Autónoma de Chile": "Universidad Autonoma de Chile",
    "Universidad Católica de la Santísima Concepción": "Universidad Catolica de la Santisima Concepcion",
    "Universidad Católica del Maule": "Universidad Catolica del Maule",
    "Universidad Mayor": "Universidad Mayor",
    "Universidad Santo Tomás": "Universidad Santo Tomas",
    "Universidad del Desarrollo": "Universidad del Desarrollo",
    "University of Antofagasta": "Universidad de Antofagasta",
    "University of Bío-Bío": "Universidad del Bio-Bio",
    "University of Chile": "Universidad de Chile",
    "University of Concepción": "Universidad de Concepcion",
    "University of La Frontera": "Universidad de la Frontera",
    "University of La Serena": "Universidad de La Serena",
    "University of Los Lagos": "Universidad de Los Lagos",
    "University of Magallanes": "Universidad de Magallanes",
    "University of Talca": "Universidad de Talca",
    "University of Tarapacá": "Universidad de Tarapaca",
    "University of Valparaíso": "Universidad de Valparaiso",
    "University of Santiago, Chile": "Universidad de Santiago de Chile",
    "University of the Andes, Chile": "Universidad de los Andes",
}


# ---------------------------------------------------------------- lectura ---

def tabla_dump(nombre):
    """Lee el bloque COPY de una tabla del dump de PostgreSQL."""
    lineas = DUMP.read_text(encoding="utf-8").split("\n")
    inicio = next(i for i, l in enumerate(lineas) if l.startswith(f"COPY public.{nombre} "))
    columnas = re.search(r"\((.*)\)", lineas[inicio]).group(1).split(", ")
    filas = []
    for l in lineas[inicio + 1:]:
        if l == "\\.":
            break
        filas.append(l.split("\t"))
    return pd.DataFrame(filas, columns=columnas)


def metricas_db():
    mu = tabla_dump("metrica_universidad")
    mu = mu.merge(tabla_dump("universidad"), on="id_universidad")
    mu = mu.merge(tabla_dump("metrica")[["id_metrica", "nombre_metrica", "id_ranking"]], on="id_metrica")
    mu["valor_metrica"] = pd.to_numeric(mu.valor_metrica, errors="coerce")
    mu["anio_metrica"] = pd.to_numeric(mu.anio_metrica, errors="coerce")
    return mu


def the_key_statistics(anio):
    d = pd.read_csv(THE_CSV / f"THE_{anio}_key_statistics.csv")
    d["uni"] = d.Name.map(THE_A_DB)
    d = d[d.uni.notna()].copy()
    d["fte_estudiantes"] = d["No. of FTE students"].astype(str).str.replace(",", "").astype(float)
    d["estudiantes_por_staff"] = pd.to_numeric(d["No. of students per staff"], errors="coerce")
    d["pct_internacional"] = pd.to_numeric(d["International students"].astype(str).str.rstrip("%"), errors="coerce")
    d["staff_fte"] = d.fte_estudiantes / d.estudiantes_por_staff
    return d.set_index("uni")[["fte_estudiantes", "estudiantes_por_staff", "pct_internacional", "staff_fte"]]


def spearman(a, b):
    return a.rank().corr(b.rank())


def sin_acentos(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\(.*?\)", "", s)
    return re.sub(r"[^a-z ]", "", s).strip()


# ---------------------------------------------------------- estimaciones ---

def serie_the_pucv():
    filas = []
    for anio in range(2016, 2027):
        ks = the_key_statistics(anio)
        if PUCV_DB in ks.index:
            filas.append(ks.loc[PUCV_DB].rename(anio))
    return pd.DataFrame(filas)


def scimago_pucv(mu):
    s = mu[(mu.id_ranking == "3") & (mu.nombre_universidad == PUCV_DB)]
    return s.pivot_table(index="anio_metrica", columns="nombre_metrica", values="valor_metrica")


def scimago_excellence_pucv():
    """`Excellence` (métrica 33) no está cargada en la BD; se toma del CSV de origen."""
    d = pd.read_csv(SCIMAGO_CSV)
    d = d[d.Institucion == PUCV_DB]
    return d.set_index(d.years.str[-4:].astype(int))["excel"]


def openalex_pucv():
    d = pd.read_csv(OPENALEX)
    d["clave"] = d.doi.fillna("T:" + d.titulo.str.lower().str.strip())
    unicos = d.drop_duplicates("clave")
    ventanas = {}
    for a, b in [(2018, 2022), (2019, 2023), (2020, 2024)]:
        w = unicos[(unicos["año"] >= a) & (unicos["año"] <= b)]
        ventanas[f"{a}-{b}"] = {"trabajos": len(w), "citas": int(w.citaciones.sum()),
                                "citas_por_trabajo": w.citaciones.mean()}
    return pd.DataFrame(ventanas).T


def autores_scopus_pucv():
    r = pd.read_csv(AUTORES_SCOPUS)
    r = r[(r.status == "ok") & r.afiliacion_actual.fillna("").str.contains("Católica de Valpara")]
    docs = pd.to_numeric(r.documentos.astype(str).str.replace(",", ""), errors="coerce")
    return {umbral: int((docs >= umbral).sum()) for umbral in (1, 5, 10, 20)}


# --------------------------------------------------------------- pruebas ---

def prueba_qs_mundial_vs_latam(mu):
    """Mismo dato de origen, dos poblaciones: si la normalización es lineal,
    los puntajes World y Latam de una misma universidad son proporcionales."""
    latam = mu[mu.id_ranking == "2"].pivot_table(index="nombre_universidad", columns="nombre_metrica",
                                                 values="valor_metrica").reset_index()
    latam["k"] = latam.nombre_universidad.map(sin_acentos)
    crudo = pd.read_excel(QS_WORLD_2025, header=None)
    fila = next(i for i in range(10) if crudo.iloc[i].astype(str).str.contains("Institution").any())
    mundo = pd.read_excel(QS_WORLD_2025, header=fila)
    mundo = mundo[mundo["Location"].astype(str).str.contains("Chile")].copy()
    mundo["k"] = mundo["Institution Name"].map(sin_acentos)
    j = latam.merge(mundo, on="k")
    filas = []
    for m_latam, m_mundo in [("Faculty student ratio", "Faculty Student"),
                             ("Academic reputation", "Academic Reputation"),
                             ("Employer reputation", "Employer Reputation"),
                             ("International research network", "International Research Network")]:
        x = pd.to_numeric(j[m_mundo], errors="coerce")
        y = j[m_latam]
        ok = x.notna() & y.notna()
        x, y = x[ok], y[ok]
        pendiente = (x * y).sum() / (x ** 2).sum()
        r2_origen = 1 - ((y - pendiente * x) ** 2).sum() / ((y - y.mean()) ** 2).sum()
        b, a = np.polyfit(x, y, 1)
        filas.append({"indicador": m_latam, "n": int(ok.sum()), "spearman": spearman(x, y),
                      "R2_proporcional": r2_origen, "afin_pendiente": b, "afin_intercepto": a})
    return pd.DataFrame(filas)


def prueba_the_vs_qs(mu, ks):
    """¿Sirve el personal FTE de THE como denominador de los indicadores QS?"""
    latam = mu[mu.id_ranking == "2"].pivot_table(index="nombre_universidad", columns="nombre_metrica",
                                                 values="valor_metrica")
    sci = mu[(mu.id_ranking == "3") & (mu.anio_metrica == 2022)].pivot_table(
        index="nombre_universidad", columns="nombre_metrica", values="valor_metrica")
    j = ks.join(latam, how="inner").join(sci[["Scientific Output", "Normalized Impact"]], how="left")
    j["staff_por_1000_est"] = 1000 / j.estudiantes_por_staff
    j["papers_por_staff"] = j["Scientific Output"] / j.staff_fte
    pares = [("staff_por_1000_est", "Faculty student ratio"),
             ("papers_por_staff", "Papers per faculty"),
             ("Normalized Impact", "Citations per paper")]
    return pd.DataFrame([{"crudo (THE/Scimago)": a, "puntaje QS Latam": b, "n": int(j[[a, b]].dropna().shape[0]),
                          "spearman": spearman(j[a], j[b])} for a, b in pares])


# ------------------------------------------------------------------ main ---

def main():
    pd.set_option("display.width", 200)
    mu = metricas_db()
    the = serie_the_pucv()
    sci = scimago_pucv(mu)
    oa = openalex_pucv()
    autores = autores_scopus_pucv()

    print("== THE key statistics PUCV (valores reales publicados por THE) ==")
    print(the.round(1).to_string(), "\n")
    print("== Scimago PUCV en la BD (conteos crudos; año = último año de la ventana de 5) ==")
    print(sci.round(2).T.to_string(), "\n")
    print("== OpenAlex PUCV (trabajos únicos por DOI/título) ==")
    print(oa.round(2).to_string(), "\n")
    print("== Perfiles de autor Scopus con afiliación PUCV, por nº mínimo de documentos ==")
    print(autores, "\n")
    print("== Prueba 1: QS World 2025 vs QS Latam 2025 (misma data, distinta población) ==")
    print(prueba_qs_mundial_vs_latam(mu).round(2).to_string(index=False), "\n")
    print("== Prueba 2: denominadores THE/Scimago vs puntajes QS Latam 2025 ==")
    print(prueba_the_vs_qs(mu, the_key_statistics(2025)).round(2).to_string(index=False), "\n")

    # ---- tabla final de valores reales / estimados para la PUCV ----------
    t26 = the.loc[2026]
    s23, s22 = sci.loc[2023].copy(), sci.loc[2022]
    s23["Excellence"] = scimago_excellence_pucv().loc[2023]
    staff = t26.staff_fte

    # Publicaciones Scopus 2020–2024 por dos vías independientes:
    # (a) OpenAlex 2020–2024 escalado por la razón Scimago/OpenAlex de 2019–2023;
    # (b) ventana Scimago 2019–2023 más el incremento medio de las dos últimas ventanas.
    output = sci["Scientific Output"]
    via_a = oa.loc["2020-2024", "trabajos"] * output.loc[2023] / oa.loc["2019-2023", "trabajos"]
    via_b = output.loc[2023] + output.diff().iloc[-2:].mean()
    papers_min, papers_max = sorted((via_a, via_b))
    papers_2020_2024 = (via_a + via_b) / 2

    # Personal según la definición QS (FT + PT/3), con cifras públicas de la
    # PUCV que no están en el repo (ver el documento): 1.501 académicos, ~650 FT.
    faculty_qs = 650 + (1501 - 650) / 3
    estudiantes_qs = 18327
    fsr_min, fsr_max = estudiantes_qs / faculty_qs, t26.estudiantes_por_staff
    ppf_min, ppf_max = output.loc[2022] / faculty_qs, output.loc[2022] / staff

    filas = [
        # ranking, métrica, valor, rango, unidad, ventana, fuente, confianza
        ("THE", "FTE students", t26.fte_estudiantes, "", "estudiantes FTE", "WUR 2026", "THE key statistics", "Alta (dato publicado)"),
        ("THE", "Student staff ratio", t26.estudiantes_por_staff, "", "estudiantes por académico FTE", "WUR 2026", "THE key statistics", "Alta (dato publicado)"),
        ("THE", "Academic staff FTE (derivado)", staff, f"{t26.fte_estudiantes / 23.25:.0f}–{t26.fte_estudiantes / 23.15:.0f}", "académicos FTE", "WUR 2026", "FTE students / SSR", "Alta (derivado exacto salvo redondeo)"),
        ("THE", "International students", t26.pct_internacional, "1,5–2,5 %", "% de estudiantes FTE", "WUR 2026", "THE key statistics", "Alta (redondeado a entero)"),
        ("THE", "International students (conteo)", t26.fte_estudiantes * t26.pct_internacional / 100, f"{t26.fte_estudiantes * .015:.0f}–{t26.fte_estudiantes * .025:.0f}", "estudiantes FTE", "WUR 2026", "FTE × %", "Media"),
        ("THE", "Publicaciones Scopus 2020–2024 (numerador productividad)", papers_2020_2024, f"{papers_min:.0f}–{papers_max:.0f}", "documentos", "2020–2024", "OpenAlex escalado + tendencia Scimago", "Media"),
        ("THE", "Research productivity", papers_2020_2024 / staff, f"{papers_min / staff:.2f}–{papers_max / staff:.2f}", "documentos por académico FTE (5 años)", "2020–2024", "estimación", "Media (THE suma personal de investigación al denominador → cota superior)"),
        ("THE", "Citation impact (FWCI)", s23["Normalized Impact"], "0,90–1,00", "veces el promedio mundial", "2019–2023", "Scimago Normalized Impact", "Media (THE mezcla FWCI con y sin ajuste por país)"),
        ("THE", "Research excellence (top 10 %)", s23["Excellence"], f"{s23['Excellence'] / s23['Scientific Output'] * 100:.1f} % de la producción", "documentos en el 10 % más citado", "2019–2023", "Scimago Excellence", "Media"),
        ("THE", "International co-authorship", s23["International Collaboration"] / s23["Scientific Output"] * 100, "", "% de documentos con coautor internacional", "2019–2023", "Scimago", "Alta"),
        ("THE", "Patents (proxy)", s23["Innovative Knowledge"], "", "documentos PUCV citados en patentes", "2019–2023", "Scimago Innovative Knowledge", "Baja (THE cuenta patentes, no documentos)"),
        ("QS Latam", "Student mix international", 2.0, "", "% de estudiantes", "2025", "Perfil QS (ya en la BD)", "Alta (dato publicado)"),
        ("QS Latam", "Staff with PhD", 64.3, "60–66 %", "% de académicos (JCE) con doctorado", "2024", "Prensa PUCV / ranking La Tercera (SIES)", "Media (QS usa FT + PT/3)"),
        ("QS Latam", "Faculty student ratio", (fsr_min + fsr_max) / 2, f"{fsr_min:.1f}–{fsr_max:.1f}", "estudiantes por académico", "2025", f"entre definición QS (FT + PT/3 ≈ {faculty_qs:.0f}) y THE (FTE ≈ {staff:.0f})", "Baja"),
        ("QS Latam", "Papers per faculty", (ppf_min + ppf_max) / 2, f"{ppf_min:.1f}–{ppf_max:.1f}", "documentos por académico (5 años)", "2018–2022", "Scimago output / personal (QS o THE)", "Baja (puntaje saturado en 99,1)"),
        ("QS Latam", "Citations per paper (OpenAlex acumulado)", oa.loc["2018-2022", "citas_por_trabajo"], "cota superior; ventana QS sin autocitas sería menor", "citas por documento", "2018–2022", "OpenAlex (citas acumuladas a 2026)", "Baja"),
        ("Scimago", "Scientific Output", s23["Scientific Output"], "", "documentos", "2019–2023", "BD (valor crudo)", "Alta"),
    ]
    tabla = pd.DataFrame(filas, columns=["ranking", "metrica", "valor", "rango", "unidad", "ventana", "fuente", "confianza"])
    tabla["valor"] = tabla.valor.astype(float).round(2)
    tabla.to_csv(SALIDA, index=False)
    print("== Valores reales / estimados PUCV ==")
    print(tabla[["ranking", "metrica", "valor", "rango", "unidad"]].to_string(index=False))
    print(f"\nGuardado en {SALIDA.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
