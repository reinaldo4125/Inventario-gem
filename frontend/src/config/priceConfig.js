// Global configuration for price display
// mode: 'truncate' | 'round' | 'decimals'
let mode = 'truncate';

export function setPriceDisplayMode(m) {
  if (['truncate', 'round', 'decimals'].includes(m)) mode = m;
}

export function getPriceDisplayMode() {
  return mode;
}

export default { getPriceDisplayMode, setPriceDisplayMode };
