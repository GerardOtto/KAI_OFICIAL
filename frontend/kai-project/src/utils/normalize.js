export function normalize(value, min, max) {
    if (max === min) return 0.5;
    return (value - min) / (max - min);
  }