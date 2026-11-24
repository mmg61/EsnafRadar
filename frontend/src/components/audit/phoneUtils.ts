/**
 * +90, 0090, 90 veya 0 ile başlayan aynı telefon numaralarını tek bir standart
 * Türkiye formatına (0XXX XXX XX XX) dönüştürür ve mükerrer olanları eler.
 */
export function normalizeAndDeduplicatePhones(rawPhones: (string | null | undefined)[]): string[] {
  const seenKeys = new Set<string>();
  const result: string[] = [];

  for (const raw of rawPhones) {
    if (!raw || typeof raw !== 'string') continue;
    const parts = raw.split(/[;,]/);
    for (const part of parts) {
      let digits = part.replace(/\D/g, '');
      if (!digits) continue;

      if (digits.length === 7 && digits.startsWith('444')) {
        const key = digits;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          result.push(`444 ${digits.slice(3, 5)} ${digits.slice(5, 7)}`);
        }
        continue;
      }

      if (digits.length === 14 && digits.startsWith('0090')) {
        digits = '0' + digits.slice(4);
      } else if (digits.length === 13 && digits.startsWith('900')) {
        digits = '0' + digits.slice(3);
      } else if (digits.length === 12 && digits.startsWith('90')) {
        digits = '0' + digits.slice(2);
      } else if (digits.length === 10 && ['2', '3', '4', '5', '8'].includes(digits[0])) {
        digits = '0' + digits;
      }

      if (digits.length === 11 && digits.startsWith('0')) {
        if (!seenKeys.has(digits)) {
          seenKeys.add(digits);
          const formatted = `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`;
          result.push(formatted);
        }
      } else if (digits.length >= 7) {
        const fallbackKey = digits.slice(-10);
        if (!seenKeys.has(fallbackKey)) {
          seenKeys.add(fallbackKey);
          result.push(part.trim());
        }
      }
    }
  }

  return result;
}

export function formatWhatsAppNumber(rawPhone: string): string {
  const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
  return cleanPhone.startsWith('90')
    ? cleanPhone
    : cleanPhone.startsWith('0')
      ? '9' + cleanPhone
      : '90' + cleanPhone;
}
