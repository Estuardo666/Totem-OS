import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos de Servicio | Totem OS",
  description: "Términos de Servicio de Totem OS",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="mb-12">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-block"
          >
            ← Volver al inicio
          </Link>
          <h1 className="text-4xl font-bold mb-2">Términos de Servicio</h1>
          <p className="text-muted-foreground">
            Última actualización: {new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-sm max-w-none dark:prose-invert space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">1. Aceptación de Términos</h2>
            <p>
              Estos Términos de Servicio (&quot;Términos&quot;) constituyen un acuerdo vinculante entre tú (el &quot;Usuario&quot; o &quot;tú&quot;) y Tótem Mass Media (&quot;Nosotros&quot;, &quot;la Empresa&quot; o &quot;Totem OS&quot;). Al acceder y utilizar Totem OS, aceptas estos Términos en su totalidad. Si no estás de acuerdo con cualquier parte, no debes usar el Servicio.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">2. Descripción del Servicio</h2>
            <p>
              Totem OS es un sistema operativo interno (&quot;Sistema&quot;) diseñado para agencias de marketing digital. Proporciona herramientas para gestión de clientes, contenido, finanzas, métricas y comunicaciones. El Servicio es proporcionado &quot;tal cual&quot; y está sujeto a estas condiciones.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">3. Licencia de Uso</h2>
            <p>
              Te otorgamos una licencia limitada, no exclusiva, no transferible y revocable para acceder y usar Totem OS de conformidad con estos Términos. Tienes derecho a:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>Acceder al Servicio según tu plan de suscripción</li>
              <li>Usar las características incluidas en tu plan</li>
              <li>Almacenar y procesar tus datos conforme a la Política de Privacidad</li>
            </ul>
            <p className="mt-4">No tienes derecho a:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Sublicenciar, vender o transferir la licencia</li>
              <li>Modificar, descompilar o crear trabajos derivados</li>
              <li>Usar el Servicio para competencia directa</li>
              <li>Acceder sin autorización o por medios no permitidos</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">4. Elegibilidad y Registro</h2>
            <p>Para usar Totem OS debes:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Ser mayor de 18 años (o tener consentimiento parental)</li>
              <li>Ser legal para celebrar contratos en tu jurisdicción</li>
              <li>Proporcionar información verdadera y precisa</li>
              <li>Mantener la confidencialidad de tu contraseña</li>
              <li>Ser responsable de todas las actividades bajo tu cuenta</li>
            </ul>
            <p className="mt-4">
              Nos reservamos el derecho de rechazar o cancelar cuentas que violen estos requisitos.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">5. Responsabilidades del Usuario</h2>
            <p>Aceptas mantener:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Toda la información de registro es verdadera y exacta</li>
              <li>Tu contraseña y credenciales confidenciales</li>
              <li>No compartir acceso con usuarios no autorizados</li>
              <li>Cumplimiento con todas las leyes aplicables</li>
              <li>No usar el Servicio para actividades ilícitas</li>
              <li>No interferir con la operación del Servicio</li>
              <li>No intentar acceso no autorizado a sistemas o datos</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">6. Contenido del Usuario</h2>
            <p>
              Eres responsable de todo contenido que cargues, publiques o transmitas a través de Totem OS (&quot;Contenido del Usuario&quot;). Al cargar Contenido del Usuario, garantizas que:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>Posees todos los derechos sobre el contenido</li>
              <li>El contenido no viola leyes aplicables</li>
              <li>El contenido no infringe derechos de terceros</li>
              <li>El contenido no es difamatorio, obsceno u ofensivo</li>
            </ul>
            <p className="mt-4">
              Nos reservamos el derecho de eliminar Contenido del Usuario que viole estos Términos. Al cargar contenido, nos otorgas una licencia para usarlo en el Servicio.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">7. Propiedad Intelectual</h2>
            <p>
              Totem OS y todo su contenido, características y funcionalidad (incluyendo todo el código, software, diseños, gráficos, texto e imágenes) son propiedad de Tótem Mass Media, sus licenciadores o proveedores de contenido y están protegidos por leyes de derechos de autor internacionales.
            </p>
            <p className="mt-4">
              No tienes derecho a reproducir, distribuir, modificar o explotar cualquier parte de Totem OS excepto según lo permitido explícitamente en estos Términos.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">8. Planes de Suscripción y Facturación</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">8.1 Planes Disponibles</h3>
            <p>
              Totem OS ofrece varios planes con diferentes características, cuotas y límites. Al seleccionar un plan, aceptas pagar las tarifas asociadas.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">8.2 Términos de Pago</h3>
            <ul className="list-disc list-inside space-y-2">
              <li>Las suscripciones se renuevan automáticamente según el período seleccionado</li>
              <li>Eres responsable de proporcionar información de pago válida</li>
              <li>Nos reservamos el derecho de cambiar precios con notificación previa</li>
              <li>Los impuestos se agregarán según tu ubicación</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">8.3 Cancelación</h3>
            <p>
              Puedes cancelar tu suscripción en cualquier momento desde tu cuenta. La cancelación entra en vigor al final del período de facturación actual. No hacemos reembolsos por períodos parciales de suscripción.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">8.4 Límites de Cuota</h3>
            <p>
              Cada plan incluye límites de cuota específicos. Si excedes tu cuota, podemos: suspender features, ralentizar el acceso, requerir upgrade, o cobrar tarifas por uso adicional.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">9. Garantía Limitada y Renuncia</h2>
            <p>
              Totem OS se proporciona &quot;TAL CUAL&quot; y &quot;SEGÚN DISPONIBILIDAD&quot;. Renunciamos expresamente a cualquier garantía, incluidas:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>Garantía de comerciabilidad</li>
              <li>Garantía de idoneidad para propósito particular</li>
              <li>Garantía de no infracción</li>
              <li>Garantía de precisión o completitud</li>
            </ul>
            <p className="mt-4">
              No garantizamos que el Servicio sea ininterrumpido, seguro o libre de errores.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">10. Limitación de Responsabilidad</h2>
            <p>
              EN LA MÁXIMA MEDIDA PERMITIDA POR LEY, TÓTEM MASS MEDIA NO SERÁ RESPONSABLE DE:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>Daños indirectos, incidentales, especiales o consecuentes</li>
              <li>Daños por pérdida de datos, ganancias o ingresos</li>
              <li>Parálisis del negocio o pérdida de oportunidades</li>
              <li>Daños por acceso no autorizado a datos</li>
            </ul>
            <p className="mt-4">
              EN NINGÚN CASO NUESTRA RESPONSABILIDAD TOTAL EXCEDERÁ LA CANTIDAD QUE PAGASTE EN EL ÚLTIMO AÑO.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">11. Indemnización</h2>
            <p>
              Aceptas indemnizar y mantener sin daño a Tótem Mass Media, sus funcionarios, directores, empleados y agentes de cualquier reclamación, daño, pérdida, gasto (incluidos honorarios legales) y responsabilidad que surja de:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>Tu violación de estos Términos</li>
              <li>Tu uso de Totem OS</li>
              <li>Tu Contenido del Usuario</li>
              <li>Tu violación de derechos de terceros</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">12. Suspensión y Terminación</h2>
            <p>
              Podemos suspender o terminar tu acceso a Totem OS sin previo aviso si:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>Violas estos Términos</li>
              <li>Realizas actividad sospechosa o fraudulenta</li>
              <li>No cumples con obligaciones de pago</li>
              <li>El Servicio es requerido por ley</li>
              <li>Causas daño al Servicio</li>
            </ul>
            <p className="mt-4">
              La terminación no libera de obligaciones previas, incluyendo pagos adeudados.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">13. Links Externos y Servicios de Terceros</h2>
            <p>
              Totem OS puede contener links a sitios y servicios externos. No afirmamos control sobre contenido, precisión o prácticas de terceros. Tu acceso a sitios externos está a tu propio riesgo y sujeto a sus términos.
            </p>
            <p className="mt-4">
              No somos responsables de daños resultantes de tu uso de servicios de terceros.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">14. Compliance Legal</h2>
            <p>
              Te comprometes a usar Totem OS de conformidad con todas las leyes, regulaciones y normativas aplicables, incluyendo pero no limitado a:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>Leyes de protección de datos (GDPR, CCPA, etc.)</li>
              <li>Leyes de propiedad intelectual</li>
              <li>Leyes anti-fraude</li>
              <li>Leyes de comercio electrónico</li>
              <li>Leyes locales y nacionales aplicables</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">15. Disputas y Mediación</h2>
            <p>
              Cualquier disputa será intentada de resolver mediante negociación de buena fe. Si no se resuelve, intentaremos mediación antes de litigio. El lugar de mediación será determinado por ambas partes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">16. Ley Aplicable</h2>
            <p>
              Estos Términos se rigen por las leyes de Ecuador, sin respetar conflictos de disposiciones legales. Cualquier acción legal debe iniciarse en cortes ubicadas en Quito, Ecuador.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">17. Cambios a los Términos</h2>
            <p>
              Podemos actualizar estos Términos ocasionalmente. Publicaremos cambios significativos en el Servicio o por correo electrónico. Tu uso continuado después de cambios constituye aceptación de nuevos Términos.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">18. Severabilidad</h2>
            <p>
              Si alguna parte de estos Términos es inválida o inaplicable, esa parte será modificada al mínimo necesario o eliminada, y el resto permanecerá en vigencia.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">19. Acuerdo Completo</h2>
            <p>
              Estos Términos, junto con nuestra Política de Privacidad, constituyen el acuerdo completo entre tú y nosotros respecto a Totem OS, reemplazando todos los acuerdos previos.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">20. Contacto</h2>
            <p>Para preguntas sobre estos Términos de Servicio, contacta:</p>
            <div className="bg-muted p-4 rounded-lg mt-4">
              <p><strong>Tótem Mass Media</strong></p>
              <p>Email: support@totem-os.com</p>
              <p>URL: https://totem-os.com</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
