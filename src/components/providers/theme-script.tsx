"use client";

import { useEffect } from "react";

export function ThemeScript() {
  useEffect(() => {
    // Script para prevenir flash de tema claro
    const themeScript = document.createElement("script");
    themeScript.innerHTML = `
      (function() {
        try {
          // Obtener preferencia de tema desde localStorage
          var theme = localStorage.getItem('theme');
          var systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          
          // Determinar si debe ser dark mode
          var shouldBeDark = theme === 'dark' || (!theme && systemPrefersDark);
          
          // Aplicar clase dark inmediatamente antes de que renderice nada
          if (shouldBeDark) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
          
          // Prevenir SOLO transición de colores de fondo, no de todos los estilos
          document.documentElement.style.transition = 'background-color 0ms, color 0ms';
          
          // Restaurar transición más rápido en desarrollo
          var isDevelopment = window.location.hostname === 'localhost';
          var delay = isDevelopment ? 0 : 50; // Inmediato en desarrollo
          
          if (isDevelopment) {
            // En desarrollo, restaurar inmediatamente
            document.documentElement.style.transition = '';
          } else {
            // En producción, esperar un poco para prevenir flash
            setTimeout(function() {
              document.documentElement.style.transition = '';
            }, delay);
          }
        } catch (e) {
          console.error('Error applying theme:', e);
        }
      })();
    `;
    
    // Insertar script al inicio del head para que se ejecute antes que nada
    document.head.insertBefore(themeScript, document.head.firstChild);
  }, []);

  return null;
}
