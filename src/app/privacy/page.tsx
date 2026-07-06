import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad | Totem OS",
  description: "Política de Privacidad de Totem OS",
};

export default function PrivacyPage() {
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
          <h1 className="text-4xl font-bold mb-2">Política de Privacidad</h1>
          <p className="text-muted-foreground">
            Última actualización: {new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-sm max-w-none dark:prose-invert space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">1. Introducción</h2>
            <p>
              Totem OS ("nosotros", "nuestro" o "Totem OS") opera el sitio web y aplicación Totem OS (el "Servicio"). Esta página te informa sobre nuestras políticas respecto al tratamiento de datos personales cuando utilizas nuestro Servicio y las opciones que tienes asociadas a esos datos.
            </p>
            <p>
              Tótem Mass Media es responsable del tratamiento de los datos personales recopilados a través de Totem OS. Nos comprometemos a proteger tu privacidad y asegurar que comprendas cómo recopilamos y utilizamos tus datos personales.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">2. Definiciones</h2>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Datos Personales:</strong> Cualquier información que se refiera a una persona física identificada o identificable.</li>
              <li><strong>Tratamiento:</strong> Cualquier operación realizada sobre datos personales, como la recopilación, registro, organización, estructuración, almacenamiento, adaptación, alteración, extracción, consulta, utilización, comunicación o supresión.</li>
              <li><strong>Responsable del Tratamiento:</strong> Tótem Mass Media, responsable de determinar los propósitos y medios del tratamiento de datos personales.</li>
              <li><strong>Encargado del Tratamiento:</strong> Cualquier entidad que trate datos personales en nombre del Responsable.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">3. Información que recopilamos</h2>
            <p>Recopilamos diversos tipos de información en relación con los servicios que proporcionamos:</p>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">3.1 Información proporcionada directamente por ti</h3>
            <ul className="list-disc list-inside space-y-2">
              <li>Datos de autenticación (correo electrónico, contraseña)</li>
              <li>Información de perfil (nombre completo, teléfono, información de empresa)</li>
              <li>Datos de marca (logo, colores corporativos, configuración de marca)</li>
              <li>Información financiera y de facturación</li>
              <li>Información de clientes y contactos</li>
              <li>Contenido generado (tareas, proyectos, disparos de contenido)</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">3.2 Información recopilada automáticamente</h3>
            <ul className="list-disc list-inside space-y-2">
              <li>Datos de dispositivo (tipo de dispositivo, sistema operativo, identificadores únicos)</li>
              <li>Datos de conexión (dirección IP, tipo de navegador, páginas visitadas)</li>
              <li>Datos de uso (características utilizadas, tiempo de acceso, duración de la sesión)</li>
              <li>Datos de localización (aproximados, según permisos concedidos)</li>
              <li>Cookies y tecnologías similares</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">3.3 Información de terceros</h3>
            <ul className="list-disc list-inside space-y-2">
              <li>Datos de Google OAuth (cuando autenticas a través de Google)</li>
              <li>Información de análisis e interacciones de terceros</li>
              <li>Información de proveedores de servicios externos</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">4. Uso de la Información</h2>
            <p>Utilizamos la información recopilada para:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Proveer, mantener y mejorar el Servicio</li>
              <li>Autenticar usuarios y gestionar acceso</li>
              <li>Procesamiento de transacciones y facturación</li>
              <li>Envío de notificaciones técnicas y actualizaciones</li>
              <li>Respuesta a consultas y solicitudes de soporte</li>
              <li>Análisis de uso y optimización del Servicio</li>
              <li>Detección y prevención de fraude y abuso</li>
              <li>Cumplimiento de obligaciones legales</li>
              <li>Comunicaciones de marketing (con tu consentimiento)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">5. Base Legal del Tratamiento</h2>
            <p>El tratamiento de tus datos personales se basa en:</p>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Contrato:</strong> Tratamiento necesario para ejecutar nuestro contrato contigo</li>
              <li><strong>Consentimiento:</strong> Tu consentimiento explícito (por ejemplo, para marketing)</li>
              <li><strong>Obligación legal:</strong> Cumplimiento de leyes aplicables</li>
              <li><strong>Intereses legítimos:</strong> Nuestros intereses legítimos o terceros (análisis, seguridad)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">6. Compartición de Información</h2>
            <p>No vendemos, intercambiamos ni alquilamos tus datos personales a terceros. Compartimos información solo en los siguientes casos:</p>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">6.1 Proveedores de Servicios</h3>
            <p>Compartimos datos con terceros que nos ayudan a operar el Servicio (almacenamiento en la nube, análisis, pago):</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Neon (base de datos PostgreSQL)</li>
              <li>UploadThing (almacenamiento de archivos)</li>
              <li>Google Cloud (TTS, análisis de inteligencia artificial)</li>
              <li>Groq (procesamiento de IA)</li>
              <li>Pusher (comunicaciones en tiempo real)</li>
              <li>Web Push (notificaciones push propias con VAPID)</li>
              <li>Vercel (hosting y deployment)</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">6.2 Requisitos Legales</h3>
            <p>Podemos divulgar información si requerido por ley o en respuesta a solicitudes válidas de autoridades públicas.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">6.3 Transferencias de Control Corporativo</h3>
            <p>Si nuestra empresa es adquirida o fusionada, tus datos podrían ser transferidos como parte de esa transacción.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">7. Retención de Datos</h2>
            <p>Retenemos tus datos personales solo por el tiempo necesario para:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Suministrar el Servicio</li>
              <li>Cumplir obligaciones legales</li>
              <li>Resolver disputas</li>
              <li>Hacer cumplir nuestros acuerdos</li>
            </ul>
            <p className="mt-4">
              Cuando solicites la eliminación de tu cuenta, eliminaremos o anonimizaremos tus datos personales dentro de 30 días, con excepciones para datos requeridos por ley.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">8. Seguridad de Datos</h2>
            <p>Implementamos medidas de seguridad técnicas, administrativas y físicas para proteger tus datos personales:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Cifrado de datos en tránsito (HTTPS/TLS)</li>
              <li>Cifrado de datos en reposo</li>
              <li>Autenticación multi-factor</li>
              <li>Control de acceso basado en roles</li>
              <li>Auditorías de seguridad regulares</li>
              <li>Formación de seguridad del personal</li>
            </ul>
            <p className="mt-4">
              Sin embargo, ningún método de transmisión por Internet es 100% seguro. Aunque nos esforzamos por proteger tus datos, no podemos garantizar seguridad absoluta.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">9. Tus Derechos</h2>
            <p>Tienes los siguientes derechos respecto a tus datos personales:</p>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Derecho de acceso:</strong> Obtener una copia de tus datos</li>
              <li><strong>Derecho de rectificación:</strong> Corregir datos inexactos</li>
              <li><strong>Derecho al olvido:</strong> Solicitar la eliminación de tus datos</li>
              <li><strong>Derecho a la limitación:</strong> Restringir el procesamiento</li>
              <li><strong>Derecho a la portabilidad:</strong> Recibir datos en formato estructurado</li>
              <li><strong>Derecho de oposición:</strong> Oponerme al tratamiento</li>
              <li><strong>Toma de decisiones automatizada:</strong> No ser sujeto solo a decisiones automatizadas</li>
            </ul>
            <p className="mt-4">
              Para ejercer estos derechos, contacta con support@totem-os.com con el asunto "Solicitud de Privacidad".
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">10. Cookies y Tecnologías de Rastreo</h2>
            <p>Utilizamos cookies y tecnologías similares para:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Mantener tu sesión autenticada</li>
              <li>Recordar preferencias (tema, idioma)</li>
              <li>Análisis de uso del servicio</li>
              <li>Prevención de fraude</li>
            </ul>
            <p className="mt-4">
              Puedes controlar cookies a través de la configuración de tu navegador. Sin embargo, desactivar cookies puede afectar la funcionalidad del Servicio.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">11. Transferencias Internacionales</h2>
            <p>
              Tus datos pueden ser procesados en servidores ubicados en diferentes países. Cuando transferimos datos fuera de tu país de residencia, implementamos protecciones apropiadas como Cláusulas Contractuales Tipo o tu consentimiento explícito.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">12. Cambios a esta Política</h2>
            <p>
              Podemos actualizar esta Política de Privacidad ocasionalmente. Notificaremos cambios significativos por correo electrónico o publicando la nueva política en el Servicio con una fecha de actualización prominente. Tu uso continuado del Servicio constituye aceptación de cambios.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">13. Contacto</h2>
            <p>Si tienes preguntas sobre esta Política de Privacidad o prácticas de privacidad, contacta:</p>
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
