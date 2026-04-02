import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t bg-background/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-xs md:text-sm text-muted-foreground" suppressHydrationWarning>
          © {new Date().getFullYear()} Totem OS | Tótem Mass Media
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
          <Link
            href="/privacy"
            className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Política de Privacidad
          </Link>
          <span className="text-muted-foreground">|</span>
          <Link
            href="/terms"
            className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Términos de Servicio
          </Link>
        </div>
      </div>
    </footer>
  );
}
