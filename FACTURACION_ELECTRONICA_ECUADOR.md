# 🇪🇨 Hoja de Ruta - Facturación Electrónica Ecuador

## 📋 Índice
1. [Contexto Legal y Técnico](#contexto-legal-y-técnico)
2. [Análisis del Sistema Actual](#análisis-del-sistema-actual)
3. [Arquitectura Propuesta](#arquitectura-propuesta)
4. [Fases de Implementación](#fases-de-implementación)
5. [Especificaciones Técnicas](#especificaciones-técnicas)
6. [Proveedores y Costos](#proveedores-y-costos)

---

## 🏛️ Contexto Legal y Técnico

### **Marco Legal SRI (Servicio de Rentas Internas)**

**📜 Normativa Vigente:**
- Resolución NAC-DGERCGC12-00105 (Comprobantes electrónicos)
- Resolución NAC-DGERCGC20-00000001 (Actualización 2020)
- Esquema XSD versión 1.1.0 (formato XML)

**📄 Tipos de Comprobantes Electrónicos:**
1. **Facturas** - Ventas de bienes y servicios
2. **Notas de Crédito** - Anulaciones o devoluciones
3. **Notas de Débito** - Cargos adicionales
4. **Comprobantes de Retención** - Retenciones de impuestos
5. **Guías de Remisión** - Transporte de bienes
6. **Liquidaciones de Compra** - Compras sin factura

**🎯 Para Totem OS (Agencia Creativa):**
- ✅ **Facturas** - Cobro a clientes
- ✅ **Notas de Crédito** - Ajustes/correcciones
- ✅ **Comprobantes de Retención** - Pagos a proveedores/honorarios

---

## 🔍 Análisis del Sistema Actual

### **Modelos Existentes**

**💰 Ingresos (Transactions + Invoices):**
```typescript
// Invoice - Factura generada al cliente
{
  id: string
  amount: number
  status: "PENDING" | "SENT" | "PAID"
  clientId: string
  dueDate: DateTime
  generatedAt: DateTime
}

// Transaction - Sistema de cobro automático
{
  id: string
  amount: number
  type: "INCOME" | "EXPENSE" | "HONORARIOS"
  status: "PENDING" | "PAID" | "CANCELLED"
  description: string
  relatedClientId?: string
  userId?: string // Para honorarios
}
```

**👥 Honorarios (Transactions + Payroll):**
```typescript
// Transaction tipo HONORARIOS
{
  type: "HONORARIOS"
  userId: string // Usuario que recibe el pago
  amount: number
  status: "PENDING" | "PAID"
}

// Payroll - Nómina mensual
{
  baseSalary: number
  reimbursements: number
  totalToPay: number
  userId: string
}
```

### **🚨 Brechas Identificadas**

**❌ No existe actualmente:**
1. **Datos del RUC/Cédula** del cliente (obligatorio para factura electrónica)
2. **Número de autorización SRI** (clave de acceso 49 dígitos)
3. **Firma electrónica** (archivo .p12)
4. **XML de factura** según esquema SRI
5. **Código de impuestos** (IVA 12%, 0%, exento)
6. **Tipo de identificación** (RUC, Cédula, Pasaporte)
7. **Secuencial de facturación** por establecimiento y punto de emisión
8. **Datos de retención** para honorarios

---

## 🏗️ Arquitectura Propuesta

### **Capa 1: Extensión del Modelo de Datos**

#### **A) Configuración de la Empresa (nueva tabla)**
```prisma
model CompanyConfig {
  id                String   @id @default(cuid())
  
  // Datos legales
  ruc               String   @unique
  razonSocial       String
  nombreComercial   String?
  direccionMatriz   String
  establecimiento   String   @default("001") // Ej: 001
  puntoEmision      String   @default("001") // Ej: 001
  
  // Firma electrónica
  firmaElectronicaUrl String? // URL del archivo .p12
  firmaPassword      String? // Encriptado
  
  // Secuenciales
  siguienteFactura   Int      @default(1)
  siguienteNotaCredito Int    @default(1)
  siguienteRetencion Int     @default(1)
  
  // Configuración
  obligadoContabilidad Boolean @default(true)
  agenteRetencion     Boolean  @default(false)
  contribuyenteRimpe  Boolean  @default(false)
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

#### **B) Extensión de Cliente**
```prisma
model Client {
  // ... campos existentes ...
  
  // Nuevos campos para facturación
  tipoIdentificacion String?  // RUC, CEDULA, PASAPORTE, CONSUMIDOR_FINAL
  numeroIdentificacion String? // RUC o Cédula
  razonSocial        String?   // Nombre legal/comercial
  direccion          String?   // Dirección fiscal
  telefono           String?
  email              String?   // Para envío de factura
  aplicaRetencion    Boolean @default(false) // Si retiene IVA/Renta
  porcentajeRetencionIva  Float? @default(0)
  porcentajeRetencionRenta Float? @default(0)
}
```

#### **C) Nueva Tabla: Facturas Electrónicas**
```prisma
model ElectronicInvoice {
  id                String   @id @default(cuid())
  
  // Identificación SRI
  claveAcceso       String   @unique // 49 dígitos
  numeroAutorizacion String? // Autorización del SRI
  secuencial        String   // 001-001-000000001
  
  // Datos del cliente
  clientId          String
  client            Client   @relation(fields: [clientId], references: [id])
  tipoIdentificacion String  // RUC, CEDULA, etc.
  numeroIdentificacion String
  razonSocial       String
  
  // Montos
  subtotalSinImpuestos Float
  subtotal0         Float    @default(0)  // Base 0%
  subtotal12        Float    @default(0)  // Base 12%
  iva               Float    @default(0)  // IVA calculado
  total             Float
  
  // Detalles de la factura
  detalles          String   // JSON con items de la factura
  formaPago         String   @default("01") // 01=SIN_UTILIZACION_SISTEMA_FINANCIERO
  
  // Estado
  estado            String   @default("GENERADA") 
  // GENERADA, FIRMADA, ENVIADA_SRI, AUTORIZADA, RECHAZADA, ANULADA
  
  // Archivos
  xmlUrl            String?  // URL del XML generado
  pdfUrl            String?  // URL del PDF (RIDE)
  xmlSriResponse    String?  // Respuesta del SRI (XML)
  
  // Relación con Invoice existente
  invoiceId         String?  @unique
  invoice           Invoice? @relation(fields: [invoiceId], references: [id])
  
  // Fechas
  fechaEmision      DateTime @default(now())
  fechaAutorizacion DateTime?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Relaciones
  notasCredito      CreditNote[]
  retencion         ElectronicRetention?
  
  @@index([clientId])
  @@index([estado])
  @@index([fechaEmision])
  @@index([claveAcceso])
}
```

#### **D) Nueva Tabla: Notas de Crédito**
```prisma
model CreditNote {
  id                String   @id @default(cuid())
  
  // Identificación SRI
  claveAcceso       String   @unique
  numeroAutorizacion String?
  secuencial        String
  
  // Factura que modifica
  facturaElectronicaId String
  facturaElectronica   ElectronicInvoice @relation(fields: [facturaElectronicaId], references: [id])
  
  // Montos
  subtotal          Float
  iva               Float
  total             Float
  
  // Motivo
  motivo            String   // Descripción del ajuste
  
  // Estado
  estado            String   @default("GENERADA")
  
  // Archivos
  xmlUrl            String?
  pdfUrl            String?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([facturaElectronicaId])
}
```

#### **E) Nueva Tabla: Comprobantes de Retención**
```prisma
model ElectronicRetention {
  id                String   @id @default(cuid())
  
  // Identificación SRI
  claveAcceso       String   @unique
  numeroAutorizacion String?
  secuencial        String
  
  // Proveedor/Usuario (para honorarios)
  userId            String?
  user              User?    @relation(fields: [userId], references: [id])
  proveedorRuc      String?
  proveedorNombre   String?
  
  // Factura relacionada (opcional)
  facturaElectronicaId String? @unique
  facturaElectronica   ElectronicInvoice? @relation(fields: [facturaElectronicaId], references: [id])
  
  // Retenciones aplicadas
  retenciones       String   // JSON: [{impuesto: "IVA", porcentaje: 30, base: 100, valor: 30}]
  
  // Totales
  totalRetenido     Float
  
  // Estado
  estado            String   @default("GENERADA")
  
  // Archivos
  xmlUrl            String?
  pdfUrl            String?
  
  // Relación con Transaction (pago de honorarios)
  transactionId     String?  @unique
  transaction       Transaction? @relation(fields: [transactionId], references: [id])
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([userId])
}
```

### **Capa 2: Servicios y Acciones**

#### **Servicios Nuevos:**
```
src/
  lib/
    sri/
      xml-generator.ts          # Generar XML según esquema SRI
      xml-signer.ts             # Firmar XML con .p12
      clave-acceso-generator.ts # Generar clave de acceso 49 dígitos
      sri-client.ts             # Cliente HTTP para API SRI
      ride-generator.ts         # Generar PDF (RIDE)
  
  services/
    facturacion/
      invoice-generator.ts      # Lógica de negocio para facturas
      retention-generator.ts    # Lógica para retenciones
      credit-note-generator.ts  # Lógica para notas de crédito
      
  actions/
    electronic-invoice-actions.ts
    retention-actions.ts
```

### **Capa 3: Interfaz de Usuario**

#### **Nuevas Pantallas:**
```
src/app/
  admin/
    facturacion/
      configuracion/    # Configurar RUC, firma, etc.
      facturas/         # Lista y gestión de facturas
      retenciones/      # Lista y gestión de retenciones
      reportes/         # Reportes para SRI (ATS, etc.)
```

---

## 📅 Fases de Implementación

### **🎯 FASE 1: Base de Datos y Configuración (Semana 1-2)**

**Objetivo:** Preparar la estructura de datos y configuración básica

**Tareas:**
1. **Extender Schema Prisma**
   - ✅ Crear `CompanyConfig`
   - ✅ Extender `Client` con datos fiscales
   - ✅ Crear `ElectronicInvoice`
   - ✅ Crear `CreditNote`
   - ✅ Crear `ElectronicRetention`
   - ✅ Actualizar relaciones

2. **Migración y Seed**
   - ✅ Generar migración Prisma
   - ✅ Seed inicial con datos de prueba SRI
   - ✅ Script para importar datos existentes

3. **Pantalla de Configuración**
   - ✅ Formulario para datos de la empresa
   - ✅ Upload de firma electrónica (.p12)
   - ✅ Configuración de secuenciales

**Entregables:**
- Base de datos actualizada
- Panel de configuración funcional
- Datos de prueba cargados

---

### **🎯 FASE 2: Generación de XML y Firma (Semana 3-4)**

**Objetivo:** Implementar generación de XML según esquema SRI y firma digital

**Tareas:**
1. **Servicio de Generación XML**
   - ✅ Implementar `xml-generator.ts`
   - ✅ Validar contra XSD del SRI v1.1.0
   - ✅ Generar clave de acceso (49 dígitos)
   - ✅ Generar secuencial automático

2. **Servicio de Firma Digital**
   - ✅ Implementar `xml-signer.ts`
   - ✅ Librería: `node-forge` o `xmldsigjs`
   - ✅ Validar firma contra estándares SRI

3. **Testing Offline**
   - ✅ Generar facturas de prueba
   - ✅ Validar XML con herramientas SRI
   - ✅ Verificar firmas

**Entregables:**
- XML de facturas válido según SRI
- Firma digital funcional
- Suite de tests unitarios

---

### **🎯 FASE 3: Integración con SRI (Semana 5-6)**

**Objetivo:** Conectar con los servicios web del SRI para autorización

**Tareas:**
1. **Cliente SRI**
   - ✅ Implementar `sri-client.ts`
   - ✅ Endpoint de recepción: `https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline`
   - ✅ Endpoint de autorización: `https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline`
   - ✅ Manejo de errores SRI (códigos de respuesta)

2. **Flujo de Autorización**
   - ✅ Enviar XML firmado → Recepción
   - ✅ Consultar estado → Autorización
   - ✅ Almacenar respuesta SRI
   - ✅ Actualizar estado en BD

3. **Ambiente de Pruebas SRI**
   - ✅ Configurar credenciales de prueba
   - ✅ Probar ciclo completo
   - ✅ Validar autorizaciones exitosas

**Entregables:**
- Integración con ambiente de pruebas SRI
- Facturas autorizadas correctamente
- Log de comunicación con SRI

---

### **🎯 FASE 4: Generación de RIDE (PDF) (Semana 7)**

**Objetivo:** Crear el PDF visual (RIDE) de la factura

**Tareas:**
1. **Servicio de RIDE**
   - ✅ Implementar `ride-generator.ts`
   - ✅ Librería: `pdfkit` o `puppeteer`
   - ✅ Template según diseño SRI
   - ✅ Incluir código QR con clave de acceso

2. **Almacenamiento**
   - ✅ Guardar PDF en UploadThing o S3
   - ✅ Actualizar URL en `ElectronicInvoice.pdfUrl`

3. **Envío al Cliente**
   - ✅ Email automático con PDF + XML
   - ✅ Descarga desde plataforma

**Entregables:**
- PDF (RIDE) con formato oficial
- Sistema de envío por email
- Descarga desde interfaz

---

### **🎯 FASE 5: Interfaz de Usuario - Facturas (Semana 8-9)**

**Objetivo:** Crear UI para generar y gestionar facturas electrónicas

**Tareas:**
1. **Lista de Facturas**
   - ✅ Tabla con filtros (cliente, estado, fecha)
   - ✅ Vista de detalle de factura
   - ✅ Descarga de XML y PDF
   - ✅ Re-envío de email

2. **Generación Manual**
   - ✅ Formulario de nueva factura
   - ✅ Selección de cliente (autocompletar)
   - ✅ Agregar items/servicios
   - ✅ Cálculo automático de IVA
   - ✅ Vista previa antes de generar

3. **Generación Automática desde Invoice**
   - ✅ Botón "Generar Factura Electrónica" en Invoice
   - ✅ Pre-llenar datos desde Invoice
   - ✅ Convertir automáticamente

4. **Notas de Crédito**
   - ✅ Formulario de nota de crédito
   - ✅ Seleccionar factura a anular/modificar
   - ✅ Generar y enviar a SRI

**Entregables:**
- Panel completo de facturación
- Flujo de generación manual y automático
- Gestión de notas de crédito

---

### **🎯 FASE 6: Retenciones (Honorarios) (Semana 10-11)**

**Objetivo:** Implementar comprobantes de retención para pagos de honorarios

**Tareas:**
1. **Extensión de User**
   - ✅ Agregar campos fiscales (RUC/Cédula, nombre legal)
   - ✅ Configurar porcentajes de retención por defecto

2. **Generación de Retenciones**
   - ✅ Al pagar Transaction tipo HONORARIOS
   - ✅ Generar comprobante de retención automático
   - ✅ Calcular retenciones (Renta 8%, 10%; IVA 30%, 70%, 100%)
   - ✅ Firmar y enviar a SRI

3. **UI de Retenciones**
   - ✅ Lista de retenciones generadas
   - ✅ Descarga de PDF/XML
   - ✅ Envío a usuario (email)

**Entregables:**
- Sistema de retenciones automático
- Integración con honorarios
- Panel de gestión de retenciones

---

### **🎯 FASE 7: Reportes y Anexos SRI (Semana 12)**

**Objetivo:** Generar reportes fiscales obligatorios

**Tareas:**
1. **ATS (Anexo Transaccional Simplificado)**
   - ✅ Exportar XML mensual con todas las transacciones
   - ✅ Formato según esquema SRI
   - ✅ Incluir compras, ventas, retenciones

2. **Reportes Internos**
   - ✅ Dashboard de facturación
   - ✅ Ventas por cliente
   - ✅ Retenciones emitidas/recibidas
   - ✅ Estado de facturas (pendientes, autorizadas, rechazadas)

**Entregables:**
- Generador de ATS mensual
- Dashboard de reportes fiscales
- Exportación a Excel/PDF

---

### **🎯 FASE 8: Testing y Producción (Semana 13-14)**

**Objetivo:** Pruebas finales y paso a producción

**Tareas:**
1. **Testing Completo**
   - ✅ Ciclo completo: Factura → SRI → Email → Pago
   - ✅ Notas de crédito
   - ✅ Retenciones
   - ✅ Edge cases y errores

2. **Migración a Producción SRI**
   - ✅ Cambiar URLs a producción
   - ✅ Cargar firma electrónica real
   - ✅ Configurar secuenciales reales

3. **Documentación**
   - ✅ Manual de usuario
   - ✅ Guía de configuración
   - ✅ Troubleshooting

**Entregables:**
- Sistema en producción
- Documentación completa
- Capacitación a usuarios

---

## 🔧 Especificaciones Técnicas

### **Generación de Clave de Acceso (49 dígitos)**

**Algoritmo:**
```typescript
// Composición de la clave de acceso
function generarClaveAcceso(
  fecha: Date,          // ddmmyyyy
  tipoComprobante: string, // 01=Factura
  ruc: string,          // 13 dígitos
  ambiente: string,     // 1=Pruebas, 2=Producción
  serie: string,        // 001001
  numero: string,       // 000000001 (9 dígitos)
  codigoNumerico: string, // 8 dígitos aleatorios
  tipoEmision: string   // 1=Normal
): string {
  const base = 
    fecha +
    tipoComprobante +
    ruc +
    ambiente +
    serie +
    numero +
    codigoNumerico +
    tipoEmision;
  
  const digitoVerificador = calcularModulo11(base);
  
  return base + digitoVerificador; // 49 dígitos
}

// Ejemplo: 1002202601171234567890001001001000000018765432111
// Fecha: 10/02/2026
// Tipo: 01 (Factura)
// RUC: 1234567890001
// Ambiente: 2 (Producción)
// Serie: 001001
// Número: 000000001
// Código: 87654321
// Emisión: 1
// Verificador: 1
```

### **Estructura XML Básica (Factura)**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>2</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>TOTEM CREATIVE AGENCY S.A.</razonSocial>
    <nombreComercial>TOTEM</nombreComercial>
    <ruc>1234567890001</ruc>
    <claveAcceso>1002202601171234567890001001001000000018765432111</claveAcceso>
    <codDoc>01</codDoc>
    <estab>001</estab>
    <ptoEmi>001</ptoEmi>
    <secuencial>000000001</secuencial>
    <dirMatriz>Av. Principal 123, Quito</dirMatriz>
  </infoTributaria>
  
  <infoFactura>
    <fechaEmision>10/02/2026</fechaEmision>
    <dirEstablecimiento>Av. Principal 123, Quito</dirEstablecimiento>
    <obligadoContabilidad>SI</obligadoContabilidad>
    <tipoIdentificacionComprador>04</tipoIdentificacionComprador>
    <razonSocialComprador>CLIENTE DEMO S.A.</razonSocialComprador>
    <identificacionComprador>0987654321001</identificacionComprador>
    <totalSinImpuestos>1000.00</totalSinImpuestos>
    <totalDescuento>0.00</totalDescuento>
    
    <totalConImpuestos>
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>2</codigoPorcentaje>
        <baseImponible>1000.00</baseImponible>
        <valor>120.00</valor>
      </totalImpuesto>
    </totalConImpuestos>
    
    <propina>0.00</propina>
    <importeTotal>1120.00</importeTotal>
    <moneda>DOLAR</moneda>
    
    <pagos>
      <pago>
        <formaPago>01</formaPago>
        <total>1120.00</total>
      </pago>
    </pagos>
  </infoFactura>
  
  <detalles>
    <detalle>
      <codigoPrincipal>SERV001</codigoPrincipal>
      <descripcion>Servicio de diseño gráfico - Paquete mensual</descripcion>
      <cantidad>1</cantidad>
      <precioUnitario>1000.00</precioUnitario>
      <descuento>0.00</descuento>
      <precioTotalSinImpuesto>1000.00</precioTotalSinImpuesto>
      <impuestos>
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>2</codigoPorcentaje>
          <tarifa>12</tarifa>
          <baseImponible>1000.00</baseImponible>
          <valor>120.00</valor>
        </impuesto>
      </impuestos>
    </detalle>
  </detalles>
</factura>
```

### **Librería para Firma Digital**

**Opción Recomendada: `@fidm/x509` + `node-forge`**

```typescript
import forge from 'node-forge';
import fs from 'fs';

async function firmarXML(
  xmlContent: string,
  p12Path: string,
  password: string
): Promise<string> {
  // Leer certificado .p12
  const p12Buffer = fs.readFileSync(p12Path);
  const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
  
  // Extraer llave privada y certificado
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  
  const privateKey = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0].key;
  const certificate = certBags[forge.pki.oids.certBag][0].cert;
  
  // Firmar XML (XMLDSig)
  const md = forge.md.sha1.create();
  md.update(xmlContent, 'utf8');
  
  const signature = privateKey.sign(md);
  const signatureB64 = forge.util.encode64(signature);
  
  // Insertar firma en XML
  const xmlFirmado = insertarFirmaEnXML(xmlContent, signatureB64, certificate);
  
  return xmlFirmado;
}
```

---

## 💰 Proveedores y Costos

### **Opción 1: Integración Directa SRI (Gratis)**

**✅ Ventajas:**
- Costo: **$0** - Totalmente gratis
- Control total del proceso
- Sin dependencias de terceros

**❌ Desventajas:**
- Complejidad técnica alta
- Mantenimiento de firma digital
- Actualizaciones de esquemas XSD

**🔧 Requisitos:**
- Firma electrónica del SRI (~$60/año)
- Servidor con certificado SSL
- Conocimientos XML/SOAP

---

### **Opción 2: Proveedor de Facturación (API)**

**🏢 Proveedores Populares en Ecuador:**

#### **A) Datil.co**
- **Costo:** $15-30/mes (hasta 100 facturas)
- **API REST** moderna
- **Incluye:** Firma, envío SRI, almacenamiento, RIDE
- **Pros:** Fácil integración, soporte técnico
- **Cons:** Costo mensual

#### **B) FactuListo**
- **Costo:** $20/mes + $0.10/factura
- **API REST**
- **Incluye:** Todo el ciclo de facturación
- **Pros:** Confiable, usado por muchas empresas
- **Cons:** Costo variable por factura

#### **C) Clave.ec**
- **Costo:** $25/mes (ilimitado)
- **API REST + SOAP**
- **Incluye:** ATS automático, reportes
- **Pros:** Precio fijo ilimitado
- **Cons:** Interfaz menos moderna

---

### **🎯 Recomendación Final**

**Para Totem OS (Agencia Creativa):**

**OPCIÓN HÍBRIDA - Mejor relación costo/beneficio:**

1. **Fase 1-2 (Aprendizaje):** Integración directa SRI
   - Desarrollar todo el sistema
   - Entender el proceso completo
   - Costo: Solo firma electrónica ($60/año)

2. **Producción:** Migrar a Datil.co o similar
   - Mantener código propio como backup
   - Usar API para automatización
   - Reducir riesgo de errores SRI
   - Costo: ~$20/mes

**Volumen estimado Totem:**
- ~30-50 facturas/mes (clientes recurrentes)
- ~10-20 retenciones/mes (honorarios)
- **Costo total:** $20-30/mes con proveedor

---

## 🚀 Flujos de Trabajo

### **Flujo 1: Factura desde Invoice Existente**

```
┌─────────────────┐
│ Invoice PENDING │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ Botón "Generar Factura" │
└────────┬────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Verificar datos cliente  │
│ (RUC, razón social, etc.)│
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Generar XML según SRI    │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Firmar XML con .p12      │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Enviar a SRI (recepción) │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Consultar autorización   │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Generar PDF (RIDE)       │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Enviar email al cliente  │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Actualizar Invoice status│
│ PENDING → SENT           │
└──────────────────────────┘
```

### **Flujo 2: Retención en Pago de Honorarios**

```
┌─────────────────────────┐
│ Transaction HONORARIOS  │
│ status: PENDING         │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Usuario presiona "PAGAR"│
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Calcular retenciones:       │
│ - Renta: 8-10% del total    │
│ - IVA: 30-100% del IVA      │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Generar Comprobante         │
│ de Retención (XML)          │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Firmar y enviar a SRI       │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Generar PDF de retención    │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Enviar email al usuario     │
│ con retención               │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Registrar pago neto:        │
│ Total - Retenciones         │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Transaction status → PAID   │
└─────────────────────────────┘
```

---

## 📝 Checklist de Implementación

### **Pre-requisitos Legales:**
- [ ] Obtener RUC de la empresa
- [ ] Adquirir firma electrónica del SRI ($60/año)
- [ ] Configurar establecimiento y punto de emisión
- [ ] Solicitar credenciales de prueba SRI

### **Fase 1 - Base de Datos:**
- [ ] Crear modelo `CompanyConfig`
- [ ] Extender modelo `Client`
- [ ] Crear modelo `ElectronicInvoice`
- [ ] Crear modelo `CreditNote`
- [ ] Crear modelo `ElectronicRetention`
- [ ] Realizar migración Prisma
- [ ] Seed con datos de prueba
- [ ] Pantalla de configuración empresa

### **Fase 2 - Generación XML:**
- [ ] Servicio generador de clave de acceso
- [ ] Servicio generador de XML (facturas)
- [ ] Validación contra XSD SRI
- [ ] Servicio de firma digital (.p12)
- [ ] Tests unitarios

### **Fase 3 - Integración SRI:**
- [ ] Cliente HTTP para SRI (recepción)
- [ ] Cliente HTTP para SRI (autorización)
- [ ] Manejo de errores SRI
- [ ] Pruebas en ambiente de testing
- [ ] Logs de comunicación

### **Fase 4 - RIDE (PDF):**
- [ ] Servicio generador de PDF
- [ ] Template RIDE según SRI
- [ ] Código QR con clave de acceso
- [ ] Upload a storage (UploadThing/S3)
- [ ] Sistema de envío por email

### **Fase 5 - UI Facturas:**
- [ ] Lista de facturas electrónicas
- [ ] Formulario nueva factura manual
- [ ] Botón generar desde `Invoice`
- [ ] Vista de detalle factura
- [ ] Descarga XML/PDF
- [ ] Re-envío email
- [ ] Formulario nota de crédito

### **Fase 6 - Retenciones:**
- [ ] Extender modelo `User` con datos fiscales
- [ ] Servicio generador de retenciones
- [ ] Integración con `Transaction` tipo HONORARIOS
- [ ] Cálculo automático de retenciones
- [ ] UI lista de retenciones
- [ ] Envío automático al usuario

### **Fase 7 - Reportes:**
- [ ] Generador de ATS mensual
- [ ] Dashboard de facturación
- [ ] Reporte ventas por cliente
- [ ] Reporte retenciones emitidas
- [ ] Exportación a Excel

### **Fase 8 - Producción:**
- [ ] Testing completo ciclo de facturación
- [ ] Migrar a URLs de producción SRI
- [ ] Cargar firma electrónica real
- [ ] Configurar secuenciales reales
- [ ] Documentación de usuario
- [ ] Capacitación equipo

---

## 🎯 Próximos Pasos Inmediatos

### **Para Empezar HOY:**

1. **Obtener Firma Electrónica**
   - Ir a página del SRI: https://www.sri.gob.ec
   - Solicitar firma electrónica ($60/año)
   - Descargar archivo .p12

2. **Inicializar Primera Fase**
   ```bash
   # Crear rama para facturación
   git checkout -b feature/facturacion-electronica
   
   # Actualizar schema.prisma (ver modelos arriba)
   # Correr migración
   npm run db:migrate
   ```

3. **Configurar Ambiente de Pruebas SRI**
   - URL recepción: `https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline`
   - URL autorización: `https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline`

---

## 📚 Recursos y Documentación

### **Documentación Oficial SRI:**
- [Ficha Técnica Comprobantes Electrónicos](https://www.sri.gob.ec/facturacion-electronica)
- [Esquemas XSD v1.1.0](https://www.sri.gob.ec/documents/20110/90684/FICHA+T%C3%89CNICA+COMPROBANTES+ELECTR%C3%93NICOS+ESQUEMA+OFFLINE+Versi%C3%B3n+2.23.pdf)
- [Manual de Usuario](https://www.sri.gob.ec/documents/20110/90684/Manual+Usuario+CE+V.2.pdf)

### **Librerías NPM Recomendadas:**
```json
{
  "dependencies": {
    "node-forge": "^1.3.1",        // Firma digital
    "xmlbuilder2": "^3.1.1",        // Construcción XML
    "pdfkit": "^0.13.0",            // Generación PDF
    "qrcode": "^1.5.3",             // Código QR
    "axios": "^1.6.0",              // HTTP Client SRI
    "zod": "^3.22.0"                // Validación datos
  }
}
```

### **Ejemplos de XML:**
- [Repositorio GitHub SRI](https://github.com/Ecuador-SRI)
- Ejemplos en `/docs/sri-examples/` (crear carpeta)

---

## ✅ Resumen Ejecutivo

**🎯 Objetivo:** Implementar sistema completo de facturación electrónica integrado con ingresos y honorarios

**⏱️ Tiempo estimado:** 12-14 semanas

**💰 Costo:**
- Firma electrónica: $60/año
- Proveedor API (opcional): $20-30/mes
- **Total inicial: $60** (+ opcional $20/mes en producción)

**👥 Recursos necesarios:**
- 1 desarrollador full-stack (tú)
- Acceso a credenciales SRI
- Ambiente de pruebas configurado

**📈 Beneficios:**
- ✅ Cumplimiento legal SRI
- ✅ Automatización total de facturación
- ✅ Retenciones automáticas en honorarios
- ✅ Reportes fiscales integrados
- ✅ Reducción de errores manuales
- ✅ Trazabilidad completa

**🚀 Siguiente acción:** Adquirir firma electrónica y empezar Fase 1
