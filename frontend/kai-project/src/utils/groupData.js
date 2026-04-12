export function groupByUniversity(data) {
    return data.reduce((acc, item) => {
      if (!item.year || !item.value) return acc; // filtro defensivo
  
      if (!acc[item.universidad]) {
        acc[item.universidad] = [];
      }
  
      acc[item.universidad].push(item);
      return acc;
    }, {});
  }