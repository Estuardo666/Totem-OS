"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Edit2, Check, X, Copy, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface AIOption {
  framework: "AIDA" | "PAS" | "Storytelling";
  content: string;
}

interface AiOptionCardProps {
  option: AIOption;
  onSelect: (content: string, framework: AIOption["framework"], destination: "script" | "copy") => void;
  index: number;
}

const frameworkColors = {
  AIDA: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  PAS: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  Storytelling: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const frameworkDescriptions = {
  AIDA: "Atención, Interés, Deseo, Acción - Conversión directa",
  PAS: "Problema, Agitación, Solución - Ataca puntos de dolor",
  Storytelling: "Narrativa emocional - Retención y branding",
};

export function AiOptionCard({ option, onSelect, index }: AiOptionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(option.content);
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(editedContent);
    toast({
      title: "Copiado",
      description: "El contenido ha sido copiado al portapapeles",
    });
  };

  const handleSaveEdit = () => {
    setIsEditing(false);
    toast({
      title: "Guardado",
      description: "El contenido ha sido actualizado",
    });
  };

  const handleCancelEdit = () => {
    setEditedContent(option.content);
    setIsEditing(false);
  };

  return (
    <Card className="border-l-4" style={{ borderLeftColor: `var(--color-${index})` }}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className={frameworkColors[option.framework]}>
              {option.framework}
            </Badge>
            <CardDescription className="text-xs">
              {frameworkDescriptions[option.framework]}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveEdit}
                >
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                >
                  <X className="h-4 w-4 text-red-600" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <Textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="min-h-[120px]"
          />
        ) : (
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {editedContent}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect(editedContent, option.framework, "script");
            }}
            className="flex-1"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Insertar en Script
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect(editedContent, option.framework, "copy");
            }}
            className="flex-1"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Insertar en Copy
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

