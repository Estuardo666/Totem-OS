"use client";

import { useState } from "react";
import { CheckCircle2, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { approveReport, submitFeedback } from "@/actions/client-feedback-actions";

interface ReportApprovalSectionProps {
  clientId: string;
  month: number;
  year: number;
  monthName: string;
  isApproved?: boolean;
  existingComment?: string | null;
}

export function ReportApprovalSection({
  clientId,
  month,
  year,
  monthName,
  isApproved = false,
  existingComment = null,
}: ReportApprovalSectionProps) {
  const { toast } = useToast();
  const [isApproving, setIsApproving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [comment, setComment] = useState(existingComment || "");
  const [approved, setApproved] = useState(isApproved);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const result = await approveReport({
        clientId,
        month,
        year,
      });

      if (result.success) {
        setApproved(true);
        setIsDialogOpen(false);
        toast({
          title: "¡Reporte aprobado!",
          description: `Has aprobado el reporte de ${monthName} ${year}`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "No se pudo aprobar el reporte",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Ocurrió un error inesperado",
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!comment.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Por favor, escribe un comentario",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitFeedback({
        clientId,
        month,
        year,
        comment: comment.trim(),
      });

      if (result.success) {
        toast({
          title: "¡Comentario enviado!",
          description: "Tu feedback ha sido recibido y será revisado por el equipo.",
        });
        setComment("");
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "No se pudo enviar el comentario",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Ocurrió un error inesperado",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 mt-8">
      {/* Botón de Aprobación */}
      <Card className="bg-white shadow-md border-2">
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center space-y-4">
            {approved ? (
              <div className="text-center space-y-2">
                <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
                <h3 className="text-lg font-semibold text-green-700">
                  Reporte Aprobado
                </h3>
                <p className="text-sm text-muted-foreground">
                  Has aprobado este reporte el{" "}
                  {new Date().toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-gray-900">
                  ¿Todo correcto con este reporte?
                </h3>
                <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="lg"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      disabled={isApproving}
                    >
                      {isApproving ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Aprobando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-5 w-5" />
                          Aprobar Reporte del Mes
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar Aprobación</AlertDialogTitle>
                      <AlertDialogDescription>
                        Al aprobar, confirmas que has revisado los entregables y los
                        gastos pendientes de este periodo ({monthName} {year}).
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isApproving}>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleApprove}
                        disabled={isApproving}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isApproving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Aprobando...
                          </>
                        ) : (
                          "Sí, Aprobar"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Caja de Comentarios */}
      <Card className="bg-white shadow-md">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                Deja tu Comentario o Feedback
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Comparte tus observaciones sobre este reporte. Tu feedback es importante
              para nosotros.
            </p>
            <div className="space-y-2">
              <Label htmlFor="comment">Tu Comentario</Label>
              <Textarea
                id="comment"
                placeholder="Ej: ¡Excelente el reel de hoy! o ¿Podemos revisar el gasto del Uber del día 30?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                maxLength={1000}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">
                {comment.length}/1000 caracteres
              </p>
            </div>
            <Button
              onClick={handleSubmitComment}
              disabled={isSubmitting || !comment.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Enviar Comentario
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

