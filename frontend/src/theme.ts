export type ThemeId = 'midnight' | 'forest' | 'ocean' | 'anthracite';

export interface ThemeOption {
  id: ThemeId;
  label: string;
  badge: string;
  description: string;
  contrastRatio: string;
  colorProfile: string;
  isDark: boolean;
  palette: {
    canvas: string;
    surface: string;
    muted: string;
    primary: string;
    contrast: string;
    heroBg: string;
    faviconBg: string;
    faviconStroke: string;
  };
}

export const THEME_STORAGE_KEY = 'esnafradar_theme_v2';

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'midnight',
    label: 'Gece Radarı',
    badge: 'Varsayılan Ana Tema',
    description: 'Uzun süreli saha ve harita taramalarında göz yorgunluğunu azaltan yüksek kontrastlı koyu lacivert ve zümrüt yeşili komuta merkezi teması.',
    contrastRatio: '15.4:1 (AAA)',
    colorProfile: 'Dark Slate / Emerald sRGB',
    isDark: true,
    palette: {
      canvas: '#0F172A',
      surface: '#1E293B',
      muted: '#334155',
      primary: '#10B981',
      contrast: '#F1F5F9',
      heroBg: '#1E293B',
      faviconBg: '#0F172A',
      faviconStroke: '#34D399',
    },
  },
  {
    id: 'forest',
    label: 'Doğal Orman',
    badge: 'Kurumsal Açık',
    description: 'Sıcak krem zemin üzerinde adaçayı ve çam yeşili tonlarıyla kağıt dokusu hissi veren, gündüz kullanımına uygun kurumsal tema.',
    contrastRatio: '12.1:1 (AAA)',
    colorProfile: 'Warm Ivory / Sage Green',
    isDark: false,
    palette: {
      canvas: '#FFF8E7',
      surface: '#EFE5D0',
      muted: '#D3E0C6',
      primary: '#5E7F61',
      contrast: '#2C4431',
      heroBg: '#35513A',
      faviconBg: '#35513A',
      faviconStroke: '#FFF8E7',
    },
  },
  {
    id: 'ocean',
    label: 'Kurumsal Okyanus',
    badge: 'Yüksek Aydınlık',
    description: 'Ferah beyaz ve buz mavisi yüzeyler üzerinde derin okyanus mavisi eylem butonları sunan modern finans ve analiz paneli teması.',
    contrastRatio: '16.2:1 (AAA)',
    colorProfile: 'Pure Daylight / Royal Blue',
    isDark: false,
    palette: {
      canvas: '#F8FAFC',
      surface: '#FFFFFF',
      muted: '#E2E8F0',
      primary: '#2563EB',
      contrast: '#0F172A',
      heroBg: '#1E3A8A',
      faviconBg: '#1E3A8A',
      faviconStroke: '#93C5FD',
    },
  },
  {
    id: 'anthracite',
    label: 'Antrasit & Kehribar',
    badge: 'Koyu Endüstriyel',
    description: 'Mat karbon siyahı yüzeyler ile sıcak kehribar turuncusu vurguları birleştiren, OLED ekranlar için optimize edilmiş koyu tema.',
    contrastRatio: '14.8:1 (AAA)',
    colorProfile: 'Carbon Matte / Amber Gold',
    isDark: true,
    palette: {
      canvas: '#18181B',
      surface: '#27272A',
      muted: '#3F3F46',
      primary: '#D97706',
      contrast: '#FAFAFA',
      heroBg: '#27272A',
      faviconBg: '#18181B',
      faviconStroke: '#FBBF24',
    },
  },
];

const VALID_THEME_IDS: Set<string> = new Set(THEME_OPTIONS.map(t => t.id));

export function getSavedTheme(): ThemeId {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw && VALID_THEME_IDS.has(raw)) {
      return raw as ThemeId;
    }
  } catch {
    // localStorage erisimi kapaliysa varsayilana don
  }
  return 'midnight';
}

export function updateFaviconForTheme(theme: ThemeId): void {
  if (typeof document === 'undefined') return;
  const opt = THEME_OPTIONS.find(t => t.id === theme) || THEME_OPTIONS[0];
  const { faviconBg, primary, faviconStroke } = opt.palette;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="11.5" fill="${faviconBg}" />
    <circle cx="12" cy="12" r="11.5" fill="${primary}" fill-opacity="0.25" stroke="${primary}" stroke-width="1" stroke-opacity="0.5"/>
    <g stroke="${faviconStroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19.07 4.93A10 10 0 0 0 6.99 3.34" />
      <path d="M4 6h.01" />
      <path d="M2.29 9.62A10 10 0 1 0 21.31 8.35" />
      <path d="M16.24 7.76A6 6 0 1 0 8.23 16.67" />
      <path d="M12 18h.01" />
      <path d="M17.99 11.66A6 6 0 0 1 15.77 16.67" />
      <circle cx="12" cy="12" r="2" />
      <path d="m13.41 10.59 5.66-5.66" />
    </g>
  </svg>`;

  const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    document.head.appendChild(link);
  }
  link.href = dataUri;
}

export function applyAndSaveTheme(theme: ThemeId): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // localStorage erisimi kapaliysa varsayilana don
  }
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
    updateFaviconForTheme(theme);
  }
}
