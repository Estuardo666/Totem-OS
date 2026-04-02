export function ThemeScript() {
  const script = `(() => {
    try {
      var primaryKey = 'primaryColor';

      var readCookie = function(name) {
        try {
          return document.cookie
            .split('; ')
            .find(function(row) { return row.startsWith(name + '='); })
            ?.split('=')[1] || null;
        } catch (_) { return null; }
      };

      var primaryFromLocal = null;
      try { primaryFromLocal = localStorage.getItem(primaryKey); } catch (_) {}

      var primaryFromCookie = readCookie(primaryKey);
      if (primaryFromCookie) {
        try { primaryFromCookie = decodeURIComponent(primaryFromCookie); } catch (_) {}
      }

      var primaryHex = primaryFromLocal || primaryFromCookie || '#27221F';

      var sanitizeHex = function(val) {
        if (!val) return null;
        var trimmed = val.trim();
        if (!/^#?[0-9a-fA-F]{6}$/.test(trimmed)) return null;
        return trimmed.startsWith('#') ? trimmed : '#' + trimmed;
      };

      var hex = sanitizeHex(primaryHex) || '#27221F';

      var hexToHsl = function(hexVal) {
        var normalized = hexVal.replace('#', '');
        var r = parseInt(normalized.substring(0, 2), 16) / 255;
        var g = parseInt(normalized.substring(2, 4), 16) / 255;
        var b = parseInt(normalized.substring(4, 6), 16) / 255;
        var max = Math.max(r, g, b);
        var min = Math.min(r, g, b);
        var h = 0, s = 0;
        var l = (max + min) / 2;
        if (max !== min) {
          var d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            default: h = (r - g) / d + 4; break;
          }
          h /= 6;
        }
        var hue = Math.round(h * 360);
        var sat = Math.round(s * 100);
        var light = Math.round(l * 100);
        return hue + ' ' + sat + '% ' + light + '%';
      };

      var primaryHsl = hexToHsl(hex);

      var html = document.documentElement;
      html.style.setProperty('--primary-color', hex);
      html.style.setProperty('--primary', primaryHsl);

      var theme = null;
      try {
        theme = localStorage.getItem('theme');
      } catch (_) {}

      var systemPrefersDark = false;
      try {
        systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      } catch (_) {}

      var shouldBeDark = theme === 'dark' || (!theme && systemPrefersDark);
      if (shouldBeDark) {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }

      // Evitar flash de fondo/texto mientras se hidrata
      var previousTransition = html.style.transition;
      html.style.transition = 'background-color 0ms, color 0ms';

      // Restaurar transición al siguiente frame
      var restore = function() {
        html.style.transition = previousTransition;
      };

      if ('requestAnimationFrame' in window) {
        requestAnimationFrame(function() {
          setTimeout(restore, 0);
        });
      } else {
        setTimeout(restore, 50);
      }
    } catch (e) {
      console.error('Error applying theme:', e);
    }
  })();`;

  return (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
