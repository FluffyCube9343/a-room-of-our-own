export type PaletteColors = { paper: string; ink: string; accent: string };
export type Palette = PaletteColors & { id: string; name: string; mood: string };
export type PalettePreference = { id: string; custom: PaletteColors };

export const palettes: Palette[] = [
  {
    id: 'terracotta',
    name: 'Terracotta',
    mood: 'Cobalt meets a little orange',
    paper: '#FF825E',
    ink: '#3525A5',
    accent: '#FFF06A',
  },
  {
    id: 'graphite',
    name: 'Graphite',
    mood: 'Midnight with a flash of lime',
    paper: '#151B24',
    ink: '#FDFBE8',
    accent: '#D7F75B',
  },
  {
    id: 'moss',
    name: 'Moss',
    mood: 'Fresh green, bright coral',
    paper: '#DEFF9A',
    ink: '#174D39',
    accent: '#FF6B45',
  },
  {
    id: 'blush',
    name: 'Blush',
    mood: 'Pink with a purple pulse',
    paper: '#FFD9ED',
    ink: '#6C2EE8',
    accent: '#FA5D39',
  },
  {
    id: 'blue-hour',
    name: 'Blue hour',
    mood: 'Electric blue and apricot',
    paper: '#1D46E8',
    ink: '#FCF6DC',
    accent: '#FFB75E',
  },
  {
    id: 'butter',
    name: 'Butter',
    mood: 'Sunshine, blue, and pink',
    paper: '#FFF07A',
    ink: '#3948AF',
    accent: '#E6537D',
  },
  {
    id: 'plum',
    name: 'Plum',
    mood: 'Rich purple, warm peach',
    paper: '#47208E',
    ink: '#FFEABB',
    accent: '#FC947B',
  },
  {
    id: 'sea-glass',
    name: 'Sea glass',
    mood: 'Mint with a cobalt kick',
    paper: '#C5F5E5',
    ink: '#1A56CB',
    accent: '#F55D3E',
  },
  {
    id: 'uva',
    name: 'UVA',
    mood: 'Navy, orange, and open doors',
    paper: '#232D4B',
    ink: '#FFF4DB',
    accent: '#E57200',
  },
];

const storageKey = 'room-invitation-palette-v1';
const hexColor = /^#[0-9a-f]{6}$/i;

export function validateColors(value: unknown): asserts value is PaletteColors {
  if (typeof value !== 'object' || value === null)
    throw new Error('Palette colors must be an object.');
  const fields = value as Record<string, unknown>;
  for (const key of ['paper', 'ink', 'accent'] as const) {
    const color = fields[key];
    if (typeof color !== 'string' || !hexColor.test(color)) {
      throw new Error(`The palette is missing a valid ${key} color. Use a six-digit hex color.`);
    }
  }
}

export function selectedPalette(preference: PalettePreference): Palette {
  if (preference.id === 'custom') {
    validateColors(preference.custom);
    return { ...preference.custom, id: 'custom', name: 'Your own', mood: 'Made a little more you' };
  }
  const selected = palettes.find((palette) => palette.id === preference.id);
  if (!selected) throw new Error(`Unknown homepage palette: ${preference.id}.`);
  return selected;
}

export function readPalettePreference(): PalettePreference {
  const saved = localStorage.getItem(storageKey);
  if (saved === null)
    return { id: 'terracotta', custom: { paper: '#FF825E', ink: '#3525A5', accent: '#FFF06A' } };
  let parsed: unknown;
  try {
    parsed = JSON.parse(saved);
  } catch {
    throw new Error(
      'The saved homepage palette is not valid JSON. Clear room-invitation-palette-v1 in browser storage to reset it.',
    );
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('id' in parsed) ||
    typeof parsed.id !== 'string' ||
    !('custom' in parsed)
  ) {
    throw new Error(
      'The saved homepage palette has an invalid format. Clear room-invitation-palette-v1 in browser storage to reset it.',
    );
  }
  validateColors(parsed.custom);
  const preference = parsed as PalettePreference;
  selectedPalette(preference);
  return preference;
}

export function writePalettePreference(preference: PalettePreference): void {
  validateColors(preference.custom);
  selectedPalette(preference);
  localStorage.setItem(storageKey, JSON.stringify(preference));
}
