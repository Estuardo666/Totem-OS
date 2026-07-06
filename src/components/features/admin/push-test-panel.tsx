"use client";

/**
 * Push Test Panel — admin-only component for sending manual push notifications.
 * Mirrors OneSignal's "Send to Test Users" functionality.
 */

import { useState, useTransition, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Send,
  Users,
  Shield,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { sendCustomPush, getSubscriptionStats } from "@/actions/push-actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TargetType = "all" | "role" | "users";

interface SendResult {
  sent: number;
  failed: number;
  cleaned: number;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PushTestPanel() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [image, setImage] = useState("");
  const [targetType, setTargetType] = useState<TargetType>("all");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["ADMIN"]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<UserOption[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [stats, setStats] = useState<{ total: number; byRole: Record<string, number> } | null>(null);

  // Load subscription stats
  const loadStats = useCallback(async () => {
    const res = await getSubscriptionStats();
    if (res.success && res.data) {
      setStats(res.data);
    }
  }, []);

  // Search users (debounced)
  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setUserResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/push/search-users?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setUserResults(data.users || []);
      }
    } catch {
      // ignore
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSend = () => {
    if (!title.trim() || !body.trim()) return;

    setError(null);
    setResult(null);

    startTransition(async () => {
      const targets: {
        type: TargetType;
        roles?: string[];
        userIds?: string[];
      } = { type: targetType };

      if (targetType === "role") {
        targets.roles = selectedRoles;
      } else if (targetType === "users") {
        targets.userIds = selectedUsers;
      }

      const res = await sendCustomPush({
        title: title.trim(),
        body: body.trim(),
        url: url.trim() || undefined,
        image: image.trim() || undefined,
        targets,
      });

      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.error || "Error al enviar");
      }
    });
  };

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
              <Send className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-medium">Enviar Push de Prueba</h3>
              <p className="text-xs text-muted-foreground">Envía notificaciones push a usuarios</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={loadStats}>
            {stats ? `${stats.total} suscritos` : "Ver stats"}
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Message fields */}
        <div className="space-y-3">
          <div>
            <Label htmlFor="push-title" className="text-xs">Título</Label>
            <Input
              id="push-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título de la notificación"
              maxLength={100}
            />
          </div>
          <div>
            <Label htmlFor="push-body" className="text-xs">Mensaje</Label>
            <Textarea
              id="push-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Cuerpo del mensaje..."
              rows={3}
              maxLength={300}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="push-url" className="text-xs">Enlace destino (opcional)</Label>
              <Input
                id="push-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="/content"
              />
            </div>
            <div>
              <Label htmlFor="push-image" className="text-xs">
                Imagen URL (opcional)
              </Label>
              <Input
                id="push-image"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://..."
              />
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                No se mostrará en iPhone/iPad, solo Android/escritorio
              </p>
            </div>
          </div>
        </div>

        {/* Target selector */}
        <div className="space-y-3">
          <Label className="text-xs font-medium">Destinatarios</Label>
          <div className="flex flex-col gap-2">
            {(["all", "role", "users"] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="push-target"
                  value={t}
                  checked={targetType === t}
                  onChange={() => setTargetType(t)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm flex items-center gap-1.5">
                  {t === "all" && <Users className="h-3.5 w-3.5" />}
                  {t === "role" && <Shield className="h-3.5 w-3.5" />}
                  {t === "users" && <Search className="h-3.5 w-3.5" />}
                  {t === "all" && "Todos los suscritos"}
                  {t === "role" && "Por tipo de usuario"}
                  {t === "users" && "Usuarios específicos"}
                </span>
              </label>
            ))}
          </div>

          {/* Role checkboxes */}
          {targetType === "role" && (
            <div className="flex gap-3 pl-6">
              {["ADMIN", "EDITOR"].map((role) => (
                <div key={role} className="flex items-center gap-2">
                  <Checkbox
                    id={`role-${role}`}
                    checked={selectedRoles.includes(role)}
                    onCheckedChange={(checked) => {
                      setSelectedRoles((prev) =>
                        checked ? [...prev, role] : prev.filter((r) => r !== role)
                      );
                    }}
                  />
                  <Label htmlFor={`role-${role}`} className="text-sm cursor-pointer">
                    {role === "ADMIN" ? "Admin" : "Editor"}
                  </Label>
                </div>
              ))}
            </div>
          )}

          {/* User search */}
          {targetType === "users" && (
            <div className="pl-6 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    searchUsers(e.target.value);
                  }}
                  placeholder="Buscar por nombre o email..."
                  className="pl-9"
                />
                {searchLoading && (
                  <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {userResults.length > 0 && (
                <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                  {userResults.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors ${
                        selectedUsers.includes(user.id) ? "bg-primary/10" : ""
                      }`}
                      onClick={() => {
                        setSelectedUsers((prev) =>
                          prev.includes(user.id)
                            ? prev.filter((id) => id !== user.id)
                            : [...prev, user.id]
                        );
                      }}
                    >
                      <div className="font-medium">{user.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {user.email} · {user.role}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedUsers.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedUsers.length} usuario(s) seleccionado(s)
                </p>
              )}
            </div>
          )}
        </div>

        {/* Send button + results */}
        <div className="space-y-3">
          <Button
            onClick={handleSend}
            disabled={isPending || !title.trim() || !body.trim()}
            className="w-full"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar Push
              </>
            )}
          </Button>

          {/* Result */}
          {result && (
            <div className="rounded-lg border p-3 bg-muted/30 space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Resultado
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-lg font-bold text-green-600">{result.sent}</div>
                  <div className="text-[10px] text-muted-foreground">Enviados</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-red-500">{result.failed}</div>
                  <div className="text-[10px] text-muted-foreground">Fallidos</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-amber-500">{result.cleaned}</div>
                  <div className="text-[10px] text-muted-foreground">Limpiados</div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/50 p-3 bg-destructive/5 flex items-start gap-2">
              <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
