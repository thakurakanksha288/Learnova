// Masked passcode state handler
export function maskCode(code) {
  if (!code) return '';
  return '*'.repeat(code.length);
}
