#!/usr/bin/env python3
"""Consolida los CSV diarios de actividad (formato COURIER_DAILY) en un único CSV.

Reglas (idénticas al pipeline de la app, sin inventar datos):
  - Dentro de un fichero, un rider puede aparecer varias veces el mismo día (una fila por
    mercado): se SUMAN las métricas por (telefono, fecha).
  - Entre ficheros, para cada (telefono, fecha) gana la fila del fichero con la exportación
    MÁS RECIENTE (latest-export-wins); NO se suman entre ficheros.
  - El timestamp de exportación se toma del nombre COURIER_DAILY_SAPIENS_YYYYMMDD_HHMMSS.csv.

Salida: un CSV con una fila por (telefono, fecha) + columna `exported_at` por fila, listo para
subir con el botón de importación de la app. NO contiene PII en el repositorio: se escribe en
la carpeta local del usuario.

Uso:
  python build_glovo_history.py [ruta_zip] [ruta_salida_csv]
"""
import csv
import io
import re
import sys
import zipfile
from collections import defaultdict
from datetime import datetime

DEFAULT_ZIP = r"C:\Users\Usuario\OneDrive\Uber\Daily\Daily.zip"
DEFAULT_OUT = r"C:\Users\Usuario\OneDrive\Uber\Daily\HISTORICO_GLOVO_CONSOLIDADO.csv"

SUM_FIELDS = [
    "online_hours", "active_hours", "open_hours", "enroute_p2_hours", "ontrip_p3_hours",
    "unavailable_hours", "num_of_trips", "single_trips_total", "late_p2_trips", "late_p3_trips",
    "accept_trips", "reject_trips", "cancel_trips", "cancel_not_at_fault_trips",
    "p2_km", "p2_min", "p3_km", "p3_min", "total_km", "total_min",
]
INT_FIELDS = {
    "num_of_trips", "single_trips_total", "late_p2_trips", "late_p3_trips",
    "accept_trips", "reject_trips", "cancel_trips", "cancel_not_at_fault_trips",
}
ID_FIELDS = ["driver_uuid", "driver_name", "driver_number", "driver_email", "city_id", "city_name", "form_factor"]
OUT_HEADER = ["datestr", "driver_uuid", "driver_name", "driver_number", "driver_email",
              "city_id", "city_name", "market_name", "form_factor"] + SUM_FIELDS + ["exported_at"]

FN_RE = re.compile(r"_(\d{8})_(\d{6})\.csv$", re.IGNORECASE)


def exported_at(name):
    m = FN_RE.search(name)
    if not m:
        return None
    return datetime.strptime(m.group(1) + m.group(2), "%Y%m%d%H%M%S")


def digits(s):
    # Quita la parte decimal de exportaciones float ("698870966.0") antes de los dígitos,
    # para no crear un "0" final espurio (rider_key duplicado por persona).
    return re.sub(r"\D", "", re.sub(r"[.,]\d+$", "", (s or "").strip()))


def num(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return 0.0


def main():
    zip_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_ZIP
    out_path = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_OUT

    winner = {}  # (phone, date) -> {ea, sum, markets, ident}
    files_read = 0
    with zipfile.ZipFile(zip_path) as z:
        names = [n for n in z.namelist() if n.lower().endswith(".csv")]
        names.sort(key=lambda n: (exported_at(n) or datetime.min))  # ascending: later overwrites
        for name in names:
            ea = exported_at(name)
            if ea is None:
                continue
            files_read += 1
            text = z.read(name).decode("utf-8-sig")
            file_agg = {}
            for row in csv.DictReader(io.StringIO(text)):
                phone = digits(row.get("driver_number"))
                ds = (row.get("datestr") or "")[:10]
                if not phone or not ds:
                    continue
                key = (phone, ds)
                a = file_agg.get(key)
                if a is None:
                    a = {"sum": defaultdict(float), "markets": set(), "ident": {}}
                    file_agg[key] = a
                for f in SUM_FIELDS:
                    a["sum"][f] += num(row.get(f))
                mk = (row.get("market_name") or "").strip()
                if mk:
                    a["markets"].add(mk)
                for f in ID_FIELDS:
                    v = (row.get(f) or "").strip()
                    if v:
                        a["ident"][f] = v
            for key, a in file_agg.items():
                winner[key] = {"ea": ea, **a}  # latest-export-wins (ascending order)

    # Filtra filas sin actividad real (ruido de conexiones de segundos).
    rows = []
    for (phone, ds), a in winner.items():
        s = a["sum"]
        if s["online_hours"] <= 0 and s["active_hours"] <= 0 and s["num_of_trips"] <= 0:
            continue
        out = {
            "datestr": ds,
            "market_name": "|".join(sorted(a["markets"])),
            "exported_at": a["ea"].strftime("%Y-%m-%dT%H:%M:%S"),
        }
        for f in ID_FIELDS:
            out[f] = a["ident"].get(f, "")
        out["driver_number"] = phone  # teléfono ya normalizado (sin ".0" ni símbolos)
        for f in SUM_FIELDS:
            v = s[f]
            out[f] = int(round(v)) if f in INT_FIELDS else round(v, 4)
        rows.append(out)

    rows.sort(key=lambda r: (r["datestr"], r["driver_name"]))

    with open(out_path, "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=OUT_HEADER)
        w.writeheader()
        w.writerows(rows)

    # Verificación
    dates = sorted({r["datestr"] for r in rows})
    riders = {r["driver_number"] for r in rows}
    by_city = defaultdict(int)
    for r in rows:
        by_city[r["city_name"]] += 1
    print(f"Ficheros leidos        : {files_read}")
    print(f"Filas consolidadas     : {len(rows)}")
    print(f"Riders distintos       : {len(riders)}")
    print(f"Dias distintos         : {len(dates)}  ({dates[0]} .. {dates[-1]})")
    print("Filas por ciudad:")
    for c, n in sorted(by_city.items()):
        print(f"  {c:<22} {n}")
    print(f"\nEscrito en: {out_path}")
    if rows:
        sample = rows[len(rows) // 2]
        print("\nMuestra de fila:")
        for k in OUT_HEADER:
            print(f"  {k} = {sample[k]}")


if __name__ == "__main__":
    main()
