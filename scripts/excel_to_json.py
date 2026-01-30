import json
import pandas as pd
from pathlib import Path

# Point this to your workbook (kept in repo root)
EXCEL_PATH = Path(__file__).resolve().parents[1] / "Alante Performance Data.xlsx"
DATA_DIR = Path(__file__).resolve().parents[1] / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

pm = pd.read_excel(EXCEL_PATH, sheet_name="Performance_Metrics")
po = pd.read_excel(EXCEL_PATH, sheet_name="Program_Outcomes")
ul = pd.read_excel(EXCEL_PATH, sheet_name="Utilization Log")

# Clean strings
for df in (pm, po, ul):
    for c in df.columns:
        if df[c].dtype == object:
            df[c] = df[c].astype(str).str.strip()

# Programs: allow comma-separated tags in Excel -> list in JSON
if "Programs" in ul.columns:
    def split_programs(x: str):
        x = (x or "").strip()
        if not x or x.lower() in ("nan", "none"):
            return []
        return [p.strip() for p in x.split(",") if p.strip()]
    ul["Programs"] = ul["Programs"].apply(split_programs)
else:
    ul["Programs"] = [[] for _ in range(len(ul))]

with open(DATA_DIR / "performance_metrics.json", "w") as f:
    json.dump(pm.to_dict(orient="records"), f, indent=2)

with open(DATA_DIR / "program_outcomes.json", "w") as f:
    json.dump(po.to_dict(orient="records"), f, indent=2)

with open(DATA_DIR / "utilization_log.json", "w") as f:
    json.dump(ul.to_dict(orient="records"), f, indent=2)

print("Wrote JSON files to", DATA_DIR)
