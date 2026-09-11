# Usuario del sistema de Meta

Estado: **el código está listo y apagado.** Se enciende poniendo
`META_SYSTEM_USER_TOKEN` en Vercel. Mientras esa variable no exista, Totem sigue
funcionando exactamente igual que hoy, con el token de OAuth guardado en la base.

## Por qué

Hoy toda la integración con Meta cuelga de **una persona**. Los tokens de página
se invalidan cuando muere el token de usuario que los emitió, así que si esa
cuenta cambia de contraseña, quita la app o deja la agencia, **las métricas de
todos los clientes caen a la vez**.

Un usuario del sistema es una cuenta programática que pertenece al negocio y no a
nadie. Su token no vence y sobrevive a los tres casos.

## La restricción que manda

De la documentación de Meta:

> "Both the system user and the app must belong to the same business manager."
> "Apps can only target businesses (or sub-businesses of these) that have claimed them."

Una app de Meta **la reclama un solo negocio**. De ahí se deduce todo lo demás:

- No se puede poner un usuario del sistema dentro del BM de cada cliente usando
  la app de Totem: esos BM no reclamaron la app y no pueden hacerlo.
- La alternativa sería una app por cliente, cada una con su propia App Review.
  No es viable.
- Por lo tanto hace falta **un** Business Manager que reclame la app, y los
  activos de los clientes tienen que llegar hasta él por acceso de socio.

## Qué NO es el acceso de socio

Esto se malinterpreta seguido, así que conviene dejarlo escrito:

| | Qué pasa |
|---|---|
| Propiedad de la página | **Sigue siendo del cliente**, en su BM |
| Propiedad de la cuenta publicitaria | **Sigue siendo del cliente** |
| El BM del cliente | Sigue existiendo igual, con sus mismos administradores |
| Qué recibe Totem | Solo **permiso de actuar**, revocable por el cliente en un clic |
| Qué se mueve | **Nada.** No hay transferencia, migración ni consolidación |

El BM de Totem es **mínimo**: reclama la app y nada más. Cero activos de clientes
adentro. Su único trabajo es ser el dueño de la app para que el usuario del
sistema pueda existir.

---

## A. Crear el Business Manager de Totem

1. `business.facebook.com` → crear un negocio a nombre de Totem.
   Anotar el **ID del negocio** (Configuración del negocio → Información del negocio).
2. **Reclamar la app** (`META_APP_ID`) → Configuración del negocio → Apps → Agregar.

> **La verificación de empresa NO va aquí.** Ver la sección de abajo: lo único que
> bloquea es *enviar* App Review, y puede que no haga falta. Arrancar semanas de
> papeleo antes de saberlo es tiempo tirado.

## B. Acceso de socio, cliente por cliente

Lo hace quien sea administrador del BM del cliente. **No hace falta escribir a los
clientes** si ya administramos sus BM.

> BM del cliente → Configuración del negocio → **Socios** → Agregar
> → *Dar acceso a tus activos a un socio* → pegar el **ID del negocio de Totem**
> → asignar Página, cuenta de Instagram y cuenta publicitaria

Niveles a marcar:

| Activo | Tareas |
|---|---|
| Página | Analizar, **y también las de contenido** |
| Instagram | Analizar / Insights |
| Cuenta publicitaria | Analista (basta para leer métricas) |

> Las tareas de contenido en la Página todavía no se usan, pero publicar las va a
> necesitar. Volver a pasar por los 29 clientes después es trabajo tirado.

**Empezar por los 4 del piloto**: los clientes que ya tienen `facebookPageId`
en la base.

## C. Crear el usuario del sistema

1. BM de Totem → Configuración del negocio → **Usuarios del sistema** → Agregar
   → tipo **Empleado**, nombre `Totem OS`.
2. Asignarle la app con permiso **Administrar app** (instalarla; sin esto no puede
   generar token).
3. Asignarle los activos que llegaron por acceso de socio.
4. **Generar token** → elegir la app → expiración **Nunca** → marcar exactamente:

   ```
   pages_show_list
   pages_read_engagement
   read_insights
   instagram_basic
   instagram_manage_insights
   ads_read
   business_management
   ```

   **Sin `public_profile`.** Un usuario del sistema no tiene perfil; pedirlo deja
   un permiso permanentemente "faltante" en la página de integraciones.

5. Copiar el token. **Solo se muestra una vez.** No pegarlo en chat, correo ni
   en el repositorio: va directo a Vercel.

## D. Probar antes de tramitar nada

La verificación de empresa bloquea **una sola cosa**: poder enviar App Review para
Acceso avanzado. No bloquea el BM, ni reclamar la app, ni el acceso de socio, ni
generar el token. Y puede que no haga falta Acceso avanzado en absoluto:

> "Standard Access limits you to your own assets."
> "If you are using the API for yourself as a Direct Developer, you do not need
> Advanced access or app review."

Totem es herramienta interna sobre cuentas propias, no una app que usan terceros.
Y la instalación actual ya lee métricas de clientes que están en BM distintos, sin
App Review, porque el usuario tiene rol en la app y rol en las páginas. El usuario
del sistema tiene la misma forma.

**Así que con UN cliente piloto configurado, se prueba:**

```bash
# 1. ¿El usuario del sistema ve la página?
curl -s "https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=$SU_TOKEN"

# 2. ¿Puede leer insights de esa página?
curl -s "https://graph.facebook.com/v21.0/$PAGE_ID/insights?metric=page_impressions_unique&period=day&access_token=$PAGE_TOKEN"

# 3. ¿Puede leer la cuenta publicitaria? (la más propensa a rebotar)
curl -s "https://graph.facebook.com/v21.0/act_$AD_ACCOUNT_ID/insights?fields=spend&date_preset=last_7d&access_token=$SU_TOKEN"
```

| Resultado | Qué sigue |
|---|---|
| Las tres devuelven datos | No hace falta verificación ni App Review. Seguir con el resto de clientes |
| Error 10 o 200 en alguna | Ahí sí: verificación de empresa y luego App Review de los siete permisos |

**Verificación de empresa**, cuando toque → Configuración del negocio → Centro de
seguridad. Pide documentos legales: RUC, constitución, comprobante de domicilio.
Es el trámite lento, de semanas.

Los permisos de publicación (`pages_manage_posts`, `instagram_content_publish`)
se piden en una tanda posterior. `instagram_content_publish` **sí** exige App
Review sin discusión, y por tanto verificación. No es "nunca", es "no primero".

---

## E. Revisar el token antes de desplegar

Además de las tres llamadas de la sección D, conviene mirar el token en sí:

```bash
curl -s "https://graph.facebook.com/v21.0/debug_token?input_token=$SU_TOKEN&access_token=$META_APP_ID%7C$META_APP_SECRET"
```

Debe devolver `is_valid: true`, `type: "SYSTEM_USER"`, `expires_at: 0`, y los
siete permisos entre `scopes` ∪ `granular_scopes`.

Antes de pasar al resto de clientes, los IDs que devuelve `/me/accounts` tienen
que cubrir los `facebookPageId` que hay en la base. **No seguir hasta que
coincidan:** asignar de menos en Business Manager es la causa de fallo dominante,
y falla en silencio.

## Encendido

1. Poner `META_SYSTEM_USER_TOKEN` en Vercel, **solo en Production**.
   Opcionales y solo cosméticos: `META_SYSTEM_USER_ID`, `META_SYSTEM_USER_NAME`.

   > **Trampa:** Preview y Production comparten la misma base de Neon. Poner la
   > variable en Preview y disparar el refresco sobrescribiría los tokens de
   > página de **producción**.

2. Redesplegar y disparar:
   `GET /api/cron/refresh-social-tokens?secret=$CRON_SECRET`

   Esperado: `refreshed: false`, `mode: "system_user"`, `pageTokensRenewed`
   igual a la cantidad de clientes vinculados, `unmatchedClients: []`.

   `refreshed: false` es correcto: no hubo renovación porque no hay nada que
   renovar.

3. `/admin/settings/integrations`: insignia "Usuario del sistema", sin fecha de
   expiración, sin botón de desconectar, con botón de resincronizar.

4. Sincronizar un cliente a mano y confirmar métricas orgánicas **y de anuncios**.
   Las de anuncios son las que prueban la asignación de la cuenta publicitaria.

## Rollback

Borrar `META_SYSTEM_USER_TOKEN` y redesplegar. `getAgencyToken()` vuelve a la
fila de OAuth, que se deja intacta a propósito.

Después hay que pulsar **Resincronizar tokens** para reemitir los tokens de
página desde el usuario de OAuth. Si ese token murió mientras tanto, el rollback
implica reconectar por OAuth.

## Cuando algo falla

| Síntoma | Causa casi siempre |
|---|---|
| `unmatchedClients` con nombres | Falta asignar esa página al usuario del sistema en Business Manager |
| `pageTokensRenewed: 0` | No se asignó ningún activo, o la app no está instalada en el usuario del sistema |
| Aviso de permisos faltantes | Falta un permiso al generar el token: hay que generar uno nuevo |
| `is_valid: false` en debug_token | El token se revocó, o se regeneró y quedó el viejo en Vercel |

El botón **Resincronizar tokens** aplica una asignación nueva de Business Manager
sin esperar al cron nocturno.

## Dónde está cada cosa

| Archivo | Qué resuelve |
|---|---|
| `src/lib/meta/system-user.ts` | El interruptor y la cuenta sintética. Puro |
| `src/lib/meta/permissions-policy.ts` | Qué permisos se exigen y cómo se lee `/debug_token`. Puro |
| `src/lib/meta/token-store.ts` | `getAgencyToken()`: el entorno gana sobre la base |
| `src/lib/meta/token-refresh-policy.ts` | `decideAgencyRefresh()`: renovar, saltar, o solo páginas |
| `src/lib/meta/token-refresh.ts` | Refresco de tokens de página y reporte de no asignados |
| `src/actions/meta-actions.ts` | `resyncPageTokens()` y la guardia de desconexión |
| `tests/unit/meta-system-user.test.mjs` | 6 pruebas |
| `tests/unit/meta-permissions.test.mjs` | 9 pruebas |
