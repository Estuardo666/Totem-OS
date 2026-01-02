import { getPendingFeedbacks } from "@/actions/client-feedback-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

export async function PendingFeedbacks() {
  // Obtener feedbacks pendientes
  const feedbacksResult = await getPendingFeedbacks();
  const pendingFeedbacks = feedbacksResult.success ? feedbacksResult.data ?? [] : [];

  if (pendingFeedbacks.length === 0) {
    return null;
  }

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];

  return (
    <Card className="mb-6 border-yellow-300 bg-yellow-50/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-yellow-700" />
          <CardTitle className="text-yellow-900">
            Feedback Pendiente de Revisar
          </CardTitle>
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
            {pendingFeedbacks.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {pendingFeedbacks.map((feedback) => (
            <div
              key={feedback.id}
              className="flex items-start justify-between gap-3 p-3 rounded-lg border border-yellow-200 bg-white"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-sm text-gray-900">
                    {feedback.clientName}
                  </h4>
                  {feedback.approved && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-xs">
                      Aprobado
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {monthNames[feedback.month - 1]} {feedback.year}
                </p>
                {feedback.comment && (
                  <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded border">
                    "{feedback.comment}"
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  {format(new Date(feedback.createdAt), "dd/MM/yyyy 'a las' HH:mm")}
                </p>
              </div>
              <Link
                href={`/clients/${feedback.clientId}`}
                className="text-primary hover:underline text-sm whitespace-nowrap"
              >
                Ver Cliente →
              </Link>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
