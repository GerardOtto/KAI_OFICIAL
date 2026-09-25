import requests
import pandas as pd
from bs4 import BeautifulSoup

def get_arwu_2018_full():
    """Extrae ARWU 2018 con todos los indicadores desde HTML archivado"""
    
    url = "https://web.archive.org/web/20180821000000/http://www.shanghairanking.com/ARWU2018.html"
    
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
    except Exception as e:
        print(f"Error al descargar: {e}")
        return None
    
    soup = BeautifulSoup(response.content, 'html.parser')
    
    # Buscar la tabla con los datos
    table = soup.find('table', {'class': 'ranking-table'})
    if not table:
        table = soup.find('table', {'id': 'UniversityRanking'})
    
    if not table:
        print("No se encontró la tabla en la página")
        return None
    
    universities = []
    
    # Obtener headers para identificar columnas
    headers = []
    header_row = table.find('tr')
    if header_row:
        for th in header_row.find_all('th'):
            headers.append(th.get_text(strip=True))
    
    print(f"Headers encontrados: {headers}")
    
    # Procesar cada fila de datos
    for row in table.find_all('tr')[1:]:  # Saltar header
        cols = row.find_all('td')
        
        if len(cols) >= 6:  # Mínimo de columnas esperado
            uni = {
                'Rank': cols[0].get_text(strip=True) if len(cols) > 0 else '',
                'Institution': cols[1].get_text(strip=True) if len(cols) > 1 else '',
                'Country/Region': cols[2].get_text(strip=True) if len(cols) > 2 else '',
                'Region Rank': '',  # No disponible en esta versión
                'Score': cols[3].get_text(strip=True) if len(cols) > 3 else '',
                'Alumni': cols[4].get_text(strip=True) if len(cols) > 4 else '',
                'Award': cols[5].get_text(strip=True) if len(cols) > 5 else '',
                'HiCi': cols[6].get_text(strip=True) if len(cols) > 6 else '',
                'N&S': cols[7].get_text(strip=True) if len(cols) > 7 else '',
                'PUB': cols[8].get_text(strip=True) if len(cols) > 8 else '',
                'PCP': cols[9].get_text(strip=True) if len(cols) > 9 else ''
            }
            universities.append(uni)
    
    return pd.DataFrame(universities)


def main():
    print("Extrayendo ARWU 2018...")
    df = get_arwu_2018_full()
    
    if df is not None and not df.empty:
        # Guardar archivo completo
        df.to_csv('shanghai-arwu-2018-full.csv', index=False)
        print(f"✅ Guardadas {len(df)} universidades en shanghai-arwu-2018-full.csv")
        
        # Ver universidades chilenas
        chile_df = df[df['Country/Region'].str.contains('Chile', na=False, case=False)]
        print(f"\n🏫 Universidades chilenas encontradas: {len(chile_df)}")
        print(chile_df.to_string(index=False))
        
        # Verificar formato de columnas
        print(f"\n📋 Columnas del archivo: {list(df.columns)}")
        
    else:
        print("No se pudo extraer datos para 2018")

if __name__ == "__main__":
    main()