import { parsePrecio, formatCurrency } from '../utils/formatters';

describe('formatters - parsePrecio', () => {
  test('número simple', () => {
    expect(parsePrecio(1500)).toBe(1500);
  });

  test('string con separador de miles y decimal coma', () => {
    expect(parsePrecio('1.500,50')).toBe(1500.5);
  });

  test('string con decimal coma sin miles', () => {
    expect(parsePrecio('1500,5')).toBe(1500.5);
  });

  test('valor vacío o inválido devuelve fallback positivo', () => {
    expect(parsePrecio('')).toBe(0.01);
    expect(parsePrecio(null)).toBe(0.01);
    expect(parsePrecio('abc')).toBe(0.01);
  });

  test('valores negativos retornan fallback mínimo', () => {
    expect(parsePrecio('-5')).toBe(0.01);
  });
});

describe('formatters - formatCurrency', () => {
  test('devuelve string y contiene parte entera formateada', () => {
    const out = formatCurrency(1500);
    expect(typeof out).toBe('string');
    // Debe contener la parte entera (sin decimales) formateada
    expect(/1\.500/.test(out) || /1500/.test(out)).toBe(true);
  });
});
