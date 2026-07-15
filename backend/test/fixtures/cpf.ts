import { calcCpfCheckDigit } from '../../src/auth/validators/is-cpf.validator';

export function randomValidCpf(): string {
  const base = Array.from({ length: 9 }, () =>
    Math.floor(Math.random() * 10),
  ).join('');
  const digit1 = calcCpfCheckDigit(base);
  const digit2 = calcCpfCheckDigit(`${base}${digit1}`);
  return `${base}${digit1}${digit2}`;
}
