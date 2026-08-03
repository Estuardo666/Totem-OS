import { CATPPUCCIN_PALETTES } from "@/lib/theme";

export function ThemeScript() {
  const palettes = JSON.stringify(CATPPUCCIN_PALETTES);
  const script = `(() => {
    try {
      var palettes = ${palettes};
      var readCookie = function(name) {
        try { var row = document.cookie.split('; ').find(function(item) { return item.startsWith(name + '='); }); return row ? decodeURIComponent(row.split('=')[1]) : null; }
        catch (_) { return null; }
      };
      var readStored = function(name) { try { return localStorage.getItem(name); } catch (_) { return null; } };
      var validAccents = ['rosewater','flamingo','pink','mauve','red','maroon','peach','yellow','green','teal','sky','sapphire','blue','lavender'];
      var themeId = readStored('themeId') || readCookie('themeId') || 'default';
      if (themeId !== 'catppuccin') themeId = 'default';
      var theme = readStored('theme');
      var systemDark = false;
      try { systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (_) {}
      var variant = theme === 'dark' || (!theme && systemDark) ? 'dark' : 'light';
      var accent = readStored('catppuccinAccent') || readCookie('catppuccinAccent') || 'mauve';
      if (validAccents.indexOf(accent) === -1) accent = 'mauve';
      var root = document.documentElement;
      root.classList.toggle('dark', variant === 'dark');
      root.dataset.theme = themeId;
      root.dataset.themeVariant = variant;

      var sanitizeHex = function(value) { if (!value || !/^#?[0-9a-fA-F]{6}$/.test(value.trim())) return null; return value.charAt(0) === '#' ? value : '#' + value; };
      var hexToHsl = function(value) {
        var hex = (sanitizeHex(value) || '#27221F').slice(1); var r=parseInt(hex.slice(0,2),16)/255,g=parseInt(hex.slice(2,4),16)/255,b=parseInt(hex.slice(4,6),16)/255;
        var max=Math.max(r,g,b),min=Math.min(r,g,b),h=0,s=0,l=(max+min)/2;
        if(max!==min){var d=max-min;s=l>.5?d/(2-max-min):d/(max+min);if(max===r)h=(g-b)/d+(g<b?6:0);else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h/=6;}
        return Math.round(h*360)+' '+Math.round(s*100)+'% '+Math.round(l*100)+'%';
      };
      var set = function(name, value) { root.style.setProperty(name, value); };
      if (themeId === 'catppuccin') {
        var p = palettes[variant], h = function(key) { return hexToHsl(p[key]); }, primary = p[accent], isDark = variant === 'dark';
        var vars = {
          '--background':isDark?h('base'):'0 0% 100%','--foreground':h('text'),'--card':isDark?h('mantle'):'0 0% 100%','--card-foreground':h('text'),'--popover':h(isDark?'crust':'base'),'--popover-foreground':h('text'),
          '--primary':hexToHsl(primary),'--primary-color':primary,'--primary-foreground':h('base'),'--gradient-accent':hexToHsl(primary),'--secondary':isDark?h('mantle'):'0 0% 100%','--secondary-foreground':h('text'),
          '--muted':isDark?h('mantle'):'0 0% 100%','--muted-foreground':h('subtext0'),'--accent':h('surface1'),'--accent-foreground':h('text'),'--destructive':h('red'),'--destructive-foreground':h('base'),
          '--border':h('surface1'),'--input':h('surface1'),'--ring':hexToHsl(primary),'--chart-1':h('blue'),'--chart-2':h('green'),'--chart-3':h('peach'),'--chart-4':h('mauve'),'--chart-5':h('pink'),
          '--scroll-track':h('mantle'),'--scroll-thumb':h('surface2'),'--scroll-thumb-hover':h('overlay0'),'--scroll-corner':h('crust'),'--theme-success':h('green'),'--theme-success-foreground':h('base'),'--theme-warning':h('yellow'),'--theme-warning-foreground':h('crust'),'--theme-error':h('red'),'--theme-error-foreground':h('base'),'--theme-info':h('blue'),'--theme-info-foreground':h('base'),'--theme-peach':h('peach'),'--theme-rosewater':h('rosewater'),'--theme-pink':h('pink'),'--theme-mauve':h('mauve'),'--theme-green':h('green'),'--theme-teal':h('teal'),'--theme-sky':h('sky'),'--theme-sapphire':h('sapphire'),'--theme-blue':h('blue'),'--theme-lavender':h('lavender')
        };
        Object.keys(vars).forEach(function(key){ set(key, vars[key]); });
      } else {
        var primaryHex = sanitizeHex(readStored('primaryColor') || readCookie('primaryColor')) || '#27221F';
        set('--primary-color', primaryHex); set('--primary', hexToHsl(primaryHex));
        set('--gradient-accent', hexToHsl(primaryHex.toLowerCase() === '#27221f' ? '#6366f1' : primaryHex));
        var rgb = [parseInt(primaryHex.slice(1,3),16),parseInt(primaryHex.slice(3,5),16),parseInt(primaryHex.slice(5,7),16)].map(function(c){c/=255;return c<=.03928?c/12.92:Math.pow((c+.055)/1.055,2.4);});
        set('--primary-foreground', (.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2])>.58?'22 11% 14%':'0 0% 100%');
        set('--accent', variant === 'dark' ? '23 1% 16%' : '220 20% 96%');
        set('--accent-foreground', variant === 'dark' ? '0 0% 98%' : '22 11% 14%');
      }
      var previous = root.style.transition; root.style.transition = 'background-color 0ms, color 0ms';
      requestAnimationFrame(function(){ setTimeout(function(){ root.style.transition = previous; },0); });
    } catch (error) { console.error('Error applying theme:', error); }
  })();`;

  return <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: script }} />;
}
