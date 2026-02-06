"use client";

import { useState } from "react";
import { Link2, Check, RefreshCw, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { generateShareToken } from "@/actions/client-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ShareReportButtonProps {
  clientId: string;
  shareToken: string | null;
  onTokenGenerated?: (token: string) => void;
}

export function ShareReportButton({
  clientId,
  shareToken,
  onTokenGenerated,
}: ShareReportButtonProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copied, setCopied] = useState(false);

  const buildShareUrl = (token: string): string => {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
    return `${baseUrl}/reports/share/${token}`;
  };

  const handleCopyLink = async (token: string) => {
    setIsCopying(true);
    try {
      const shareUrl = buildShareUrl(token);
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: "¡Enlace copiado!",
        description: "Listo para enviar por WhatsApp",
      });
      setTimeout(() => {
        setCopied(false);
        setIsCopying(false);
      }, 2000);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo copiar el enlace",
      });
      setIsCopying(false);
    }
  };

  const handleGenerateAndCopy = async () => {
    setIsGenerating(true);
    try {
      const result = await generateShareToken(clientId);

      if (result.success && result.data) {
        const shareUrl = result.data.shareUrl;
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        toast({
          title: "¡Enlace generado y copiado!",
          description: "Listo para enviar por WhatsApp",
        });
        if (onTokenGenerated) {
          onTokenGenerated(result.data.shareToken);
        }
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "No se pudo generar el enlace",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Ocurrió un error inesperado",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateToken = async () => {
    setIsGenerating(true);
    try {
      const result = await generateShareToken(clientId);

      if (result.success && result.data) {
        const shareUrl = result.data.shareUrl;
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        toast({
          title: "Nuevo enlace generado",
          description: "El enlace anterior ha sido invalidado. Nuevo enlace copiado al portapapeles.",
        });
        if (onTokenGenerated) {
          onTokenGenerated(result.data.shareToken);
        }
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "No se pudo generar el nuevo enlace",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Ocurrió un error inesperado",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (shareToken) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isCopying || isGenerating}
            className={`rounded-full ${
              copied ? "border-green-600 text-green-600" : ""
            }`}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-1.5" />
                ¡Copiado!
              </>
            ) : isCopying ? (
              <>
                <Copy className="h-4 w-4 mr-1.5 animate-pulse" />
                Copiando...
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4 mr-1.5" />
                Generar Enlace
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => handleCopyLink(shareToken)}
            disabled={isCopying}
          >
            <Copy className="h-4 w-4 mr-1.5" />
            Copiar Enlace Actual
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleRegenerateToken}
            disabled={isGenerating}
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Invalidar y Generar Nuevo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleGenerateAndCopy}
      disabled={isGenerating}
      className={`rounded-full ${
        copied ? "border-green-600 text-green-600" : ""
      }`}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 mr-1.5" />
          ¡Copiado!
        </>
      ) : isGenerating ? (
        <>
          <Link2 className="h-4 w-4 mr-1.5 animate-pulse" />
          Generando...
        </>
      ) : (
        <>
          <Link2 className="h-4 w-4 mr-1.5" />
          Generar Enlace
        </>
      )}
    </Button>
  );
}

