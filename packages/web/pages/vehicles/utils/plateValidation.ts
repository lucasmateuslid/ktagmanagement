
export const validateBrazilianPlate = (plate: string): boolean => {
  if (!plate) return false;
  // Regex for Brazil (AAA0000) and Mercosul (AAA0A00)
  const regex = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;
  return regex.test(plate);
};

export const getPlateInputStatus = (plate: string) => {
  if (!plate || plate.length === 0) return 'idle';
  if (plate.length < 7) return 'typing';
  return validateBrazilianPlate(plate) ? 'valid' : 'invalid';
};
