import { calcCnpjCheckDigit } from '../../src/auth/validators/is-cnpj.validator';

const WEIGHTS_DIGIT_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const WEIGHTS_DIGIT_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export function randomValidCnpj(): string {
  const base = Array.from({ length: 12 }, () =>
    Math.floor(Math.random() * 10),
  ).join('');
  const digit1 = calcCnpjCheckDigit(base, WEIGHTS_DIGIT_1);
  const digit2 = calcCnpjCheckDigit(`${base}${digit1}`, WEIGHTS_DIGIT_2);
  return `${base}${digit1}${digit2}`;
}
