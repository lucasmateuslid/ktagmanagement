export const documentDigits = (value: string): string => String(value || '').replace(/\D/g, '').slice(0, 14);

const repeated = (digits: string) => /^(\d)\1+$/.test(digits);

export function isValidCPF(value: string): boolean {
  const cpf = documentDigits(value);
  if (cpf.length !== 11 || repeated(cpf)) return false;
  for (let size = 9; size <= 10; size++) {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += Number(cpf[i]) * (size + 1 - i);
    const digit = (sum * 10) % 11 % 10;
    if (digit !== Number(cpf[size])) return false;
  }
  return true;
}

export function isValidCNPJ(value: string): boolean {
  const cnpj = documentDigits(value);
  if (cnpj.length !== 14 || repeated(cnpj)) return false;
  const calculate = (length: 12 | 13) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(cnpj[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return calculate(12) === Number(cnpj[12]) && calculate(13) === Number(cnpj[13]);
}

export const isValidCpfCnpj = (value: string): boolean => {
  const digits = documentDigits(value);
  return digits.length === 11 ? isValidCPF(digits) : digits.length === 14 ? isValidCNPJ(digits) : false;
};

export function formatCPF(value: string): string {
  const d = documentDigits(value).slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function formatCpfCnpj(value: string): string {
  const d = documentDigits(value);
  if (d.length <= 11) return formatCPF(d);
  return d.slice(0, 14).replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\/\d{4})(\d)/, '$1-$2');
}
