export function transformToRecharts(data) {
    const result = {};
  
    data.forEach(d => {
      const year = d.anio;
      const uni = d.universidad;
      const value = Number(d.valor);
  
      if (!result[year]) {
        result[year] = { year };
      }
  
      result[year][uni] = value;
    });
  
    return Object.values(result).sort((a, b) => a.year - b.year);
  }