#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
THE Latin America University Rankings Scraper (2011–2026)
Fetches rankings data from the official THE LATAM rankings pages.
Filters only Chilean universities.
"""

import requests
import pandas as pd
import os
import time
import json
import re
from typing import Optional, List

# ======================================================
# CONSTANTES
# ======================================================

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5_2) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
}

# Database field mappings
RANKINGS_FIELDS = {
    'rank': 'Rank',
    'name': 'Name',
    'scores_overall': 'Overall',
    'scores_teaching': 'Teaching',
    'scores_research': 'Research Environment',
    'scores_citations': 'Research Quality',
    'scores_industry_income': 'Industry',
    'scores_international_outlook': 'International Outlook'
}

AVAILABLE_YEARS = list(range(2011, 2027))


# ======================================================
# FUNCIONES BASE
# ======================================================

def fetch_page(year: int) -> Optional[str]:
    """Fetch the HTML page for a given LATAM ranking year."""
    url = f"https://www.timeshighereducation.com/world-university-rankings/{year}/latin-america-university-rankings"
    print(f"  Fetching: {url}")
    
    try:
        r = requests.get(url, headers=HEADERS, timeout=60)
        if r.status_code == 200:
            return r.text
        print(f"[WARN] {r.status_code} for {url}")
    except Exception as e:
        print(f"[ERROR] Fetch failed for {url}: {e}")
    return None


def extract_json_from_page(html: str) -> Optional[dict]:
    """Extract __NEXT_DATA__ JSON from the HTML page."""
    pattern = r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>'
    match = re.search(pattern, html, re.DOTALL)
    
    if not match:
        print("[ERROR] Could not find __NEXT_DATA__ in page")
        return None
    
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError as e:
        print(f"[ERROR] Failed to parse JSON: {e}")
        return None


def get_rankings_data(year: int) -> Optional[List[dict]]:
    """Extract rankings data from the LATAM ranking page."""
    html = fetch_page(year)
    if not html:
        return None
    
    data = extract_json_from_page(html)
    if not data:
        return None
    
    try:
        rankings_data = data['props']['pageProps']['page']['rankingsTableConfig']['rankingsData']['data']
        print(f"  Total universities found: {len(rankings_data)}")
        return rankings_data
    except KeyError as e:
        print(f"[ERROR] Could not find rankings data. Missing key: {e}")
        return None


def filter_chile_universities(universities_data):
    """Filtrar solo universidades de Chile."""
    if not universities_data:
        return None
    
    chile_universities = []
    
    # Detectar si es lista o diccionario
    if isinstance(universities_data, list):
        for uni in universities_data:
            if uni.get('location') == 'Chile':
                chile_universities.append(uni)
    elif isinstance(universities_data, dict):
        for uni_id, uni in universities_data.items():
            if uni.get('location') == 'Chile':
                chile_universities.append(uni)
    
    print(f"  Chilean universities found: {len(chile_universities)}")
    return chile_universities


def filter_data_for_db(universities_data, year, field_mapping):
    """Filter and format the data for CSV/JSON output."""
    if not universities_data:
        return None
    
    filtered_data = []
    
    # Detectar si es lista o diccionario
    if isinstance(universities_data, dict):
        for uni_id, uni_data in universities_data.items():
            filtered_university = {'year': year}
            for json_field, db_field in field_mapping.items():
                value = uni_data.get(json_field, '')
                
                if json_field == 'rank' and isinstance(value, str) and value.startswith('='):
                    filtered_university['rank_prefix'] = '='
                    filtered_university[db_field] = value[1:]
                else:
                    if json_field.startswith('scores_') or json_field == 'stats_student_staff_ratio':
                        value = str(value).replace(',', '') if value else ''
                    filtered_university[db_field] = value
            filtered_data.append(filtered_university)
    
    elif isinstance(universities_data, list):
        for uni_data in universities_data:
            filtered_university = {'year': year}
            for json_field, db_field in field_mapping.items():
                value = uni_data.get(json_field, '')
                
                if json_field == 'rank' and isinstance(value, str) and value.startswith('='):
                    filtered_university['rank_prefix'] = '='
                    filtered_university[db_field] = value[1:]
                else:
                    if json_field.startswith('scores_') or json_field == 'stats_student_staff_ratio':
                        value = str(value).replace(',', '') if value else ''
                    filtered_university[db_field] = value
            filtered_data.append(filtered_university)
    
    else:
        print(f"[ERROR] Unexpected data type: {type(universities_data)}")
        return None
    
    return {"data": filtered_data}


def save_outputs(year, data, name, category: str = "latam"):
    """Save both CSV and JSON versions for a given dataset."""
    if not data or "data" not in data:
        print(f"[WARN] No data for {year} {name}.")
        return
    
    json_dir = os.path.join("outputs", "json", category)
    csv_dir = os.path.join("outputs", "csv", category)
    os.makedirs(json_dir, exist_ok=True)
    os.makedirs(csv_dir, exist_ok=True)
    
    # JSON output
    json_path = os.path.join(json_dir, f"THE_{year}_{name}.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    # CSV output
    csv_path = os.path.join(csv_dir, f"THE_{year}_{name}.csv")
    df = pd.DataFrame(data["data"])
    df.to_csv(csv_path, index=False, encoding="utf-8")
    
    print(f"[DONE] {year} {name}: {len(df)} rows → {csv_path}")


def process_latam_year(year: int) -> None:
    """Fetch and save LATAM rankings for a single year."""
    print(f"\n=== LATAM RANKINGS {year} ===")
    
    universities_data = get_rankings_data(year)
    if not universities_data:
        return
    
    # Filtrar solo universidades de Chile
    chile_data = filter_chile_universities(universities_data)
    if not chile_data:
        print(f"  No Chilean universities found for {year}")
        return
    
    filtered_data = filter_data_for_db(chile_data, year, RANKINGS_FIELDS)
    if filtered_data:
        save_outputs(year, filtered_data, "rankings_chile", category="latam")


# ======================================================
# INTERACCIÓN CON USUARIO
# ======================================================

def ask_years_range() -> List[int]:
    """Prompt for a year or range of years to process."""
    default = "2011-2026"
    while True:
        response = input(
            f"Enter the year or range to process (e.g. {default}) [blank = full range]: "
        ).strip()
        if not response:
            return AVAILABLE_YEARS
        if "-" in response:
            start_str, end_str = response.split("-", 1)
        else:
            start_str = end_str = response
        try:
            start_year = int(start_str)
            end_year = int(end_str)
        except ValueError:
            print("Year must be a valid number. Please try again.")
            continue
        if start_year > end_year:
            print("Start year cannot be greater than end year.")
            continue
        if start_year < 2011 or end_year > 2026:
            print("Years must be between 2011 and 2026.")
            continue
        return list(range(start_year, end_year + 1))


# ======================================================
# EJECUCIÓN PRINCIPAL
# ======================================================

def main():
    os.makedirs("outputs", exist_ok=True)
    
    print("🚀 THE Latin America University Rankings Scraper - Chilean Universities Only")
    print("=" * 60)
    print("Extracts data from THE LATAM rankings pages (2011-2026)")
    print("Filters only universities from Chile")
    print("=" * 60)
    
    years = ask_years_range()
    
    for year in years:
        process_latam_year(year)
        time.sleep(2)  # Be respectful to the server
    
    print("\n✅ Processing complete.")
    print("• Chilean data saved in outputs/csv/latam/ and outputs/json/latam/")


if __name__ == "__main__":
    main()