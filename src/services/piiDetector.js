/** Standard email address. */
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Colombian mobile numbers: 10 digits starting with 3.
 * Accepts optional +57 country code and common separators (space, dash, dot).
 * Examples: 3152319157, +57 3152319157, 315-231-9157, 315 231 9157
 */
const PHONE_RE = /(?:\+57[\s.-]?)?3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}/g;

/**
 * Two or more capitalized words (Spanish accents included).
 * Allows name particles between words: de, del, la, los, las.
 * Example: "Dago Borda", "María de los Ángeles"
 */
const NAME_RE =
  /\b[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+(?:\s+(?:(?:de|del|la|los|las)\s+)?[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+)+\b/g;

const NAME_PARTICLES = new Set(['de', 'del', 'la', 'los', 'las']);

/**
 * Scan the message for name, email, and phone spans.
 * Emails and phones are claimed first so they are not treated as names.
 *
 * @param {string} message
 * @returns {Array<{ type: 'name' | 'email' | 'phone', value: string, start: number, end: number }>}
 */
export function detectPii(message) {
  const emails = matchAll(message, EMAIL_RE, 'email');
  const occupied = toRanges(emails);

  const phones = matchAll(message, PHONE_RE, 'phone').filter((span) => !overlaps(span, occupied));
  occupied.push(...toRanges(phones));

  const names = matchAll(message, NAME_RE, 'name').filter((span) => !overlaps(span, occupied));

  // Reverse order so replacements from the end of the string keep earlier indexes valid.
  return [...emails, ...phones, ...names].sort((a, b) => b.start - a.start);
}

/**
 * Split a detected full name into words that should become tokens.
 * Particles such as "de" / "del" are kept as literal text, not tokenized.
 *
 * @param {string} fullName
 * @returns {string[]}
 */
export function nameParts(fullName) {
  return fullName.split(/\s+/).filter((part) => !NAME_PARTICLES.has(part.toLocaleLowerCase('es-CO')));
}

/**
 * True when a name word is a Spanish particle and should stay visible.
 * @param {string} part
 * @returns {boolean}
 */
export function isNameParticle(part) {
  return NAME_PARTICLES.has(part.toLocaleLowerCase('es-CO'));
}

/**
 * @param {string} text
 * @param {RegExp} regex
 * @param {'name' | 'email' | 'phone'} type
 */
function matchAll(text, regex, type) {
  const spans = [];

  for (const match of text.matchAll(regex)) {
    spans.push({
      type,
      value: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return spans;
}

function toRanges(spans) {
  return spans.map(({ start, end }) => ({ start, end }));
}

function overlaps(span, occupied) {
  return occupied.some((range) => span.start < range.end && span.end > range.start);
}
