# Manual de Usuario — HermeX POS

**Sistema de Punto de Venta y Gestión de Inventario**

---

## Tabla de Contenidos

1. [Introducción](#1-introducción)
2. [Acceso al Sistema](#2-acceso-al-sistema)
3. [Roles y Permisos](#3-roles-y-permisos)
4. [Contexto de Almacén](#4-contexto-de-almacén)
5. [Flujo de Trabajo Principal](#5-flujo-de-trabajo-principal)
6. [Módulo: Productos](#6-módulo-productos)
7. [Módulo: Ventas POS](#7-módulo-ventas-pos)
8. [Módulo: Órdenes de Venta y Cotizaciones](#8-módulo-órdenes-de-venta-y-cotizaciones)
9. [Módulo: Inventario y Almacenes](#9-módulo-inventario-y-almacenes)
10. [Módulo: Compras y Proveedores](#10-módulo-compras-y-proveedores)
11. [Módulo: Clientes](#11-módulo-clientes)
12. [Módulo: Reportes](#12-módulo-reportes)
13. [Módulo: Configuración](#13-módulo-configuración)
14. [Sesión POS y Cierre de Caja](#14-sesión-pos-y-cierre-de-caja)
15. [Solución de Problemas Comunes (FAQ)](#15-solución-de-problemas-comunes-faq)

---

## 1. Introducción

HermeX POS es un sistema integral de Punto de Venta y gestión de inventario diseñado para negocios con operación multi-almacén. El sistema permite gestionar productos con compatibilidad vehicular, procesar ventas rápidas en terminal POS, administrar órdenes de venta, cotizaciones, transferencias entre almacenes, compras a proveedores y generar reportes financieros y de inventario.

### Características principales

- **Arquitectura multi-almacén:** cada acción se ejecuta en el contexto de un almacén específico.
- **Compatibilidad vehicular:** los productos pueden asociarse a marcas, modelos, motores y chasis específicos.
- **Variantes de producto:** un mismo producto puede tener múltiples variantes por marca con precios y stock independientes.
- **Ventas rápidas y órdenes complejas:** flujo POS optimizado para mostrador y módulo de órdenes con ciclo de vida completo.
- **Gestión de compras:** órdenes de compra, recepción parcial, lotes y fechas de vencimiento.
- **Reportes financieros:** Z-Report, P&L, niveles de stock e historial de movimientos.
- **Control de caja:** sesiones POS con apertura, movimientos de efectivo y cierre con arqueo.

---

## 2. Acceso al Sistema

### Inicio de sesión

1. Abra la dirección del sistema en su navegador.
2. Ingrese su **nombre de usuario** y **contraseña**.
3. Haga clic en **Iniciar Sesión**.

> **Nota:** Si su cuenta tiene autenticación de dos factores (2FA) activada, se le solicitará un código adicional después de ingresar sus credenciales.

### Primer acceso

Al ingresar por primera vez, el administrador del sistema le habrá asignado:

- Un **rol** que determina sus permisos.
- Uno o más **almacenes** a los que tiene acceso (excepto administradores, que tienen acceso a todos).

### Cerrar sesión

Haga clic en su nombre o avatar en la esquina superior derecha y seleccione **Cerrar Sesión**.

---

## 3. Roles y Permisos

El sistema cuenta con seis roles. Cada rol tiene acceso a módulos específicos:

### 3.1 Administrador (admin)

Acceso completo a todo el sistema.

| Capacidad | Detalle |
|---|---|
| Usuarios | Crear, editar, desactivar y asignar almacenes |
| Productos | Crear, editar, eliminar, importar |
| Ventas POS | Procesar ventas, devoluciones, cola de cajero |
| Órdenes de venta | Crear, editar, confirmar, cancelar |
| Inventario | Ver y mover stock en todos los almacenes |
| Compras | Órdenes de compra, proveedores, lista de reabastecimiento |
| Reportes | Todos los reportes |
| Configuración | Tienda, fórmulas de precio, respaldos, logs de actividad |
| Almacenes | Acceso automático a todos |

### 3.2 Gerente (manager)

Gestión operativa completa sin acceso a administración de usuarios ni respaldos.

| Capacidad | Detalle |
|---|---|
| Productos | Crear, editar, importar |
| Ventas POS | Procesar ventas, devoluciones, cola de cajero |
| Órdenes de venta | Crear, editar, confirmar, cancelar |
| Inventario | Ver y mover stock en almacenes asignados |
| Compras | Órdenes de compra, proveedores |
| Reportes | Todos los reportes |
| Configuración | Tienda, fórmulas de precio |
| Almacenes | Solo los asignados |

### 3.3 Cajero (cashier)

Operación exclusiva de terminal POS y devoluciones.

| Capacidad | Detalle |
|---|---|
| Ventas POS | Procesar ventas rápidas |
| Cola de cajero | Ver pagos pendientes |
| Devoluciones | Procesar devoluciones de órdenes |
| Almacenes | Solo los asignados |

### 3.4 Comprador (buyer)

Gestión de compras, proveedores y creación de productos.

| Capacidad | Detalle |
|---|---|
| Productos | Crear y editar |
| Inventario | Ver stock, movimientos entrantes, cola de almacén |
| Compras | Órdenes de compra, proveedores, lista de reabastecimiento |
| Almacenes | Solo los asignados |

### 3.5 Vendedor (seller)

Gestión de cotizaciones y órdenes de venta.

| Capacidad | Detalle |
|---|---|
| Cotizaciones | Crear, editar, enviar, convertir a orden |
| Órdenes de venta | Crear y gestionar |
| Almacenes | Solo los asignados |

### 3.6 Asistente (assistant)

Apoyo en inventario y movimientos entrantes.

| Capacidad | Detalle |
|---|---|
| Inventario | Ver stock, cola de almacén |
| Movimientos entrantes | Registrar recepción de mercancía |
| Almacenes | Solo los asignados |

> **Importante:** Si un usuario no tiene ningún almacén asignado (y no es administrador), no podrá realizar ninguna acción que requiera contexto de almacén. Contacte al administrador para que le asigne al menos un almacén.

---

## 4. Contexto de Almacén

### ¿Qué es el contexto de almacén?

HermeX POS es un sistema **centrado en almacenes**. Cada acción —vender un producto, crear stock, transferir mercancía— se ejecuta dentro del contexto de un almacén específico. Esto significa que **antes de realizar cualquier operación, debe seleccionar en qué almacén está trabajando**.

### Cómo funciona

1. Al iniciar sesión, el sistema carga su **almacén predeterminado** (si tiene uno configurado).
2. El almacén activo se muestra en la barra superior o en el panel de configuración del POS.
3. Puede cambiar de almacén en cualquier momento desde el selector de almacén.
4. El almacén seleccionado se guarda automáticamente y se mantiene entre sesiones.

### Reglas importantes

- **Stock por almacén:** cada almacén tiene su propio inventario. Un producto puede tener 10 unidades en el Almacén A y 0 en el Almacén B.
- **Ventas por almacén:** al procesar una venta, el stock se descuenta del almacén activo en ese momento.
- **Transferencias:** para mover stock entre almacenes, use el módulo de Transferencias de Inventario.
- **Administradores:** tienen acceso a todos los almacenes automáticamente.
- **Otros roles:** solo pueden operar en los almacenes que el administrador les haya asignado.

> **Advertencia:** Verifique siempre que el almacén seleccionado sea el correcto antes de procesar una venta o registrar un movimiento de inventario. Un error de contexto puede generar discrepancias de stock.

---

## 5. Flujo de Trabajo Principal

Este es el ciclo completo desde la creación de un producto hasta su venta:

### Paso 1: Configurar catálogo base

1. Crear **Marcas** (Bosch, Denso, Valeo, etc.).
2. Crear **Categorías** (Alternadores, Filtros, Frenos, etc.).
3. Importar o registrar **Vehículos** (Marca → Modelo → Motores/Chasis).

### Paso 2: Crear productos

1. Ir a **Catálogo > Productos > Crear Producto**.
2. Completar información básica: nombre, categoría, marca, SKU.
3. Asignar **compatibilidad vehicular** (ver sección 6.3).
4. Configurar **precios** (costo, precio de venta, margen, impuestos).
5. Agregar **inventario inicial** por almacén.
6. Si el producto tiene múltiples marcas/fabricantes, crear **variantes**.

### Paso 3: Gestionar inventario

1. Verificar stock en **Inventario > Inventario**.
2. Registrar entradas de mercancía en **Movimientos de Inventario > Entrada**.
3. Transferir stock entre almacenes si es necesario.

### Paso 4: Vender

**Venta rápida (POS):**

1. Abrir una **Sesión POS** (declarar monto inicial de caja).
2. Buscar productos por nombre, SKU o código OEM.
3. Agregar al carrito, seleccionar variante si aplica.
4. Procesar pago (efectivo, tarjeta, transferencia, crédito).
5. Imprimir ticket.

**Orden de venta:**

1. Ir a **Ventas > Órdenes de Venta > Crear**.
2. Seleccionar cliente, agregar productos.
3. Guardar como borrador o confirmar.
4. Confirmar descuenta inventario automáticamente.

### Paso 5: Reportes y cierre

1. Revisar **Reportes > Reporte Financiero** para ver ganancias.
2. Generar **Z-Report** para cierre diario de caja.
3. Cerrar **Sesión POS** declarando el monto final de caja.

---

## 6. Módulo: Productos

### 6.1 Crear un producto

1. Navegue a **Catálogo > Productos**.
2. Haga clic en **Crear Producto**.
3. Complete los campos:

| Campo | Descripción |
|---|---|
| SKU Base | Identificador base del producto (ej. "ALT-12V-90A") |
| Código Alternativo | Código secundario o referencia |
| Nombre | Nombre descriptivo del producto |
| Descripción | Detalles técnicos o notas |
| Categoría | Clasificación del producto |
| Línea de Producto | Subclasificación opcional |
| Marca | Marca principal (si aplica) |
| Estado | Activo, Descontinuado o Pendiente |

4. Configure **precios**:

| Campo | Descripción |
|---|---|
| Costo | Precio de compra del producto |
| Precio Base | Precio de venta calculado o manual |
| MSRP | Precio sugerido por el fabricante |
| Margen (%) | Porcentaje de ganancia sobre el costo |
| Tasa de Impuesto | Porcentaje de impuesto aplicable |
| Tipo de Impuesto | Estándar, Exento o Personalizado |
| Descuento Máximo (%) | Límite de descuento permitido |

5. Agregue **inventario inicial** indicando stock disponible y punto de reorden por cada almacén.
6. Agregue **atributos técnicos** (voltaje, amperaje, dimensiones, etc.).
7. Haga clic en **Guardar**.

### 6.2 Variantes de producto

Un producto genérico puede tener múltiples variantes, cada una representando un fabricante o especificación diferente.

**Ejemplo:**

- **Producto:** "Alternador 12V 90A"
- **Variantes:**
  - Bosch — SKU: ALT-BSH-90A — Precio: $120.00
  - Denso — SKU: ALT-DNS-90A — Precio: $135.00
  - Valeo — SKU: ALT-VLE-90A — Precio: $110.00

**Para crear variantes:**

1. Abra el producto existente.
2. Vaya a la sección **Variantes**.
3. Haga clic en **Agregar Variante**.
4. Complete: marca, SKU, UPC, precio y stock.
5. Puede marcar una variante como **predeterminada** (se selecciona automáticamente al vender).

> **Nota:** Cada variante tiene su propio stock, precio e inventario por almacén. El precio de la variante sobrescribe el precio del producto padre.

### 6.3 Compatibilidad vehicular

El sistema permite asociar productos a vehículos específicos para facilitar la búsqueda y evitar errores de compatibilidad.

#### Nivel de motor

1. Seleccione **Marca del vehículo** (ej. Toyota).
2. Seleccione **Modelo** (ej. Corolla).
3. Seleccione uno o más **Motores** (ej. 1.8L 2ZR-FE, 2.0L 3ZR-FE).
4. Puede marcar **"Todos los motores"** para aplicar a todos los motores del modelo.

#### Nivel de chasis

1. Seleccione **Códigos de chasis** específicos (ej. E140, E150).
2. Puede marcar **"Todos los chasis"** para aplicar a todos.

#### Producto universal

Si el producto es compatible con todos los vehículos (ej. limpiaparabrisas genérico), marque la casilla **Producto Universal**.

#### Generación automática del nombre

El sistema genera automáticamente un nombre descriptivo basado en la compatibilidad:

- **Motor:** "Filtro de Aceite — Toyota Corolla 20-24"
- **Chasis:** "Pastillas de Freno — Honda Civic Si (FK8) 17-21"
- **Universal:** "Aceite Sintético 5W-30 — Universal"

> **Nota:** Los productos de categorías como "Motor", "Pistón", "Biela", "Culata" o "Válvula" activan automáticamente la nomenclatura a nivel de motor.

### 6.4 Referencias OEM

Puede agregar códigos de referencia del fabricante original (OEM):

1. En la sección **Referencias OEM**, ingrese el código (ej. "123-456-ABC").
2. Seleccione el fabricante de referencia (ej. Bosch, Toyota).
3. Estas referencias son buscables en el POS, lo que permite encontrar productos por el código OEM.

### 6.5 Productos alternativos

Puede establecer relaciones entre productos para sugerir alternativas durante la venta:

- **Compatible:** producto que funciona junto con el actual.
- **Sustituto:** producto que puede reemplazar al actual.
- **Mejora (Upgrade):** versión superior del producto.

### 6.6 Seguimiento por lotes

Si el producto requiere control por lote (ej. productos con fecha de vencimiento):

1. Active la casilla **Seguimiento por Lote** al crear el producto.
2. Al registrar entradas de inventario, deberá especificar el **número de lote** y la **fecha de vencimiento**.
3. Al realizar transferencias o salidas, deberá seleccionar el lote específico.

### 6.7 Importar productos

1. Vaya a **Catálogo > Productos > Importar**.
2. Descargue la plantilla CSV de ejemplo.
3. Complete los datos siguiendo el formato.
4. Suba el archivo y revise la vista previa.
5. Confirme la importación.

### 6.8 Estados del producto

| Estado | Significado |
|---|---|
| Activo | Producto disponible para venta |
| Descontinuado | Producto que ya no se vende (se mantiene en historial) |
| Pendiente | Producto en proceso de configuración, no visible en POS |

---

## 7. Módulo: Ventas POS

### 7.1 Abrir una sesión POS

Antes de vender, debe abrir una sesión de caja:

1. Navegue a **POS**.
2. Si no hay una sesión abierta, se le solicitará ingresar el **monto inicial de caja**.
3. Ingrese el amounto y haga clic en **Abrir Sesión**.

> **Importante:** No puede procesar ventas sin una sesión POS abierta.

### 7.2 Interfaz del POS

La pantalla del POS se divide en:

- **Panel izquierdo:** lista de productos en el carrito.
- **Panel derecho:** buscador de productos y catálogo.
- **Barra superior:** almacén activo, sesión actual, accesos rápidos.
- **Pestañas de carrito:** puede manejar múltiples carritos simultáneos.

### 7.3 Buscar y agregar productos

1. Use el campo de búsqueda para encontrar productos por:
   - Nombre
   - SKU
   - Código OEM
   - Código VIN
2. Los resultados aparecen en el panel de búsqueda.
3. Haga clic en un producto para agregarlo al carrito.
4. Si el producto tiene **múltiples variantes**, se abrirá un modal para seleccionar la variante deseada.
5. Si el producto está **agotado**, se abrirá un modal de **Compra Rápida** para crear una orden de compra al proveedor.

### 7.4 Gestionar el carrito

#### Agregar cantidades

- Seleccione un producto en el carrito y modifique la cantidad directamente.
- El sistema valida el stock disponible del almacén activo.

#### Aplicar descuentos por ítem

1. Seleccione el producto en el carrito.
2. Ingrese el **porcentaje de descuento**.
3. El descuento no puede exceder el máximo configurado en el producto (a menos que tenga permisos de gerente o administrador).

#### Líneas personalizadas

Puede agregar ítems que no están en el catálogo:

1. Haga clic en **Agregar línea personalizada**.
2. Ingrese: descripción, SKU (opcional), cantidad, precio unitario e impuesto.
3. Se agregará como un ítem misceláneo al carrito.

#### Múltiples carritos

- Puede crear **múltiples carritos** simultáneos (útil para atender varios clientes).
- Cada carrito se guarda localmente y persiste entre recargas.
- Puede renombrar, cambiar o eliminar carritos.

### 7.5 Procesar una venta rápida

1. Con productos en el carrito, haga clic en **Cobrar** o presione **F10**.
2. Seleccione el **cliente** (opcional, obligatorio para pagos parciales o a crédito).
3. Seleccione el **método de pago**:

| Método | Descripción |
|---|---|
| Efectivo | Pago en cash. El sistema calcula el cambio |
| Tarjeta | Pago con tarjeta de crédito/débito |
| Transferencia | Pago por transferencia bancaria |
| Crédito | Cargo a la cuenta del cliente |
| Múltiple | Combinación de métodos de pago |
| Saldo a favor | Uso de crédito acumulado del cliente |

4. Ingrese el **monto recibido** (en efectivo, el sistema calcula el cambio).
5. Si usa **pago múltiple**, agregue cada método con su monto.
6. Agregue **notas** si es necesario.
7. Haga clic en **Procesar Venta**.
8. Se generará la orden y podrá **imprimir el ticket**.

### 7.6 Guardar como borrador

Si no puede completar la venta en este momento:

1. Haga clic en **Guardar Borrador**.
2. La orden se guarda con estado "Borrador" y no descuenta inventario.
3. Puede recuperarla más tarde desde las pestañas de carrito.

### 7.7 Guardar como cotización

1. Haga clic en **Guardar Cotización**.
2. La cotización se guarda y puede enviarse al cliente.
3. Las cotizaciones tienen fecha de expiración configurable.
4. Puede convertir una cotización en una orden de venta o cargarla como carrito en el POS.

### 7.8 Atajos de teclado

| Tecla | Acción |
|---|---|
| F1 | Enfocar búsqueda de productos |
| F2 | Enfocar campo de cantidad |
| F4 | Limpiar carrito |
| F10 | Abrir panel de pago (efectivo) |
| F12 | Mostrar/ocultar atajos de teclado |

### 7.9 Modo devolución

Para procesar devoluciones:

1. Navegue a **Ventas > Devoluciones** o abra una orden desde el historial.
2. Haga clic en **Procesar Devolución**.
3. La orden se carga en el POS con cantidades negativas.
4. Procese la devolución como una venta normal.
5. El stock se restaura automáticamente y el reembolso se registra.

### 7.10 Modo edición de orden

Puede agregar productos a una orden ya confirmada:

1. Abra la orden confirmada.
2. Haga clic en **Agregar Productos**.
3. La orden se carga en el POS en modo edición.
4. Agregue productos y cobre la diferencia.

---

## 8. Módulo: Órdenes de Venta y Cotizaciones

### 8.1 Diferencias entre venta POS y orden de venta

| Aspecto | Venta POS | Orden de Venta |
|---|---|---|
| Velocidad | Instantánea, optimizada para mostrador | Deliberada, con ciclo de vida completo |
| Estado inicial | Confirmada inmediatamente | Borrador → Pendiente → Confirmada → Completada |
| Sesión POS | Requiere sesión abierta | No requiere sesión |
| Pago | Inmediato | Puede ser pendiente, parcial o pagado |
| Inventario | Se descuenta al confirmar | Se descuenta al confirmar |
| Uso típico | Ventas de mostrador | Pedidos especiales, entregas programadas |

### 8.2 Crear una orden de venta

1. Navegue a **Ventas > Órdenes de Venta**.
2. Haga clic en **Crear Orden**.
3. Seleccione el **cliente**.
4. Seleccione el **almacén** de origen.
5. Agregue productos buscando por nombre o SKU.
6. Ajuste cantidades, precios y descuentos si es necesario.
7. Agregue **costo de envío** y **notas**.
8. Eliña una acción:
   - **Guardar como borrador:** la orden se guarda sin afectar inventario.
   - **Confirmar:** descuenta inventario y marca la orden como confirmada.

### 8.3 Estados de una orden de venta

| Estado | Descripción |
|---|---|
| Borrador | Orden en construcción, sin impacto en inventario |
| Pendiente | Orden lista para confirmar |
| Confirmada | Inventario descontado, orden en proceso |
| En Proceso | Orden siendo preparada |
| Completada | Orden entregada y finalizada |
| Cancelada | Orden anulada (si estaba confirmada, restaura inventario) |

### 8.4 Estados de pago

| Estado | Descripción |
|---|---|
| Pendiente | Sin pago registrado |
| Parcial | Pago parcial recibido |
| Pagada | Pago completo recibido |
| Reembolsada | Pago devuelto al cliente |

### 8.5 Cotizaciones

Las cotizaciones son presupuestos formales que se envían al cliente.

**Crear una cotización:**

1. Navegue a **Ventas > Cotizaciones**.
2. Haga clic en **Crear Cotización**.
3. Complete datos del cliente, productos y condiciones.
4. Guarde y envíe al cliente.

**Convertir cotización a orden:**

1. Abra la cotización aceptada.
2. Haga clic en **Convertir a Orden de Venta**.
3. Se crea la orden con los datos de la cotización.

**Cargar cotización en POS:**

1. En el POS, haga clic en **Cargar Cotización**.
2. Seleccione la cotización deseada.
3. Los productos se cargan en el carrito como una sesión nueva.

> **Nota:** Las cotizaciones tienen fecha de expiración configurable (15, 30, 60 o 90 días). Una cotización expirada no puede convertirse en orden.

---

## 9. Módulo: Inventario y Almacenes

### 9.1 Ver inventario

1. Navegue a **Inventario > Inventario**.
2. Verá una lista de productos con su stock actual en el almacén activo.
3. Puede filtrar por marca, categoría y estado de stock.

#### Estados de stock

| Estado | Significado |
|---|---|
| Sin stock | 0 unidades disponibles |
| Stock bajo | Por debajo del punto de reorden |
| Normal | Dentro del rango esperado |
| Óptimo | Por encima del nivel objetivo |

### 9.2 Movimientos de inventario

Todo cambio de stock se registra como un movimiento.

#### Entrada de inventario

Registra la recepción de mercancía:

1. Navegue a **Movimientos de Inventario > Entrada**.
2. Seleccione el **producto** (y variante si aplica).
3. Ingrese la **cantidad**.
4. Seleccione el **tipo de referencia**: Compra, Ajuste o Devolución.
5. Si el producto usa lotes, ingrese **número de lote**, **fecha de fabricación** y **fecha de vencimiento**.
6. Ingrese el **costo unitario**.
7. Haga clic en **Registrar**.

#### Salida de inventario

Registra la remoción de stock (no vinculada a una venta):

1. Navegue a **Movimientos de Inventario > Salida**.
2. Seleccione el producto y variante.
3. Ingrese la cantidad.
4. Seleccione el tipo de referencia: Venta, Ajuste o Transferencia.
5. Si el producto usa lotes, seleccione el lote específico.
6. Haga clic en **Registrar**.

#### Transferencia entre almacenes

Mueve stock de un almacén a otro:

1. Navegue a **Movimientos de Inventario > Transferencia**.
2. Seleccione el **almacén de origen** y el **almacén de destino**.
3. Seleccione el producto y variante.
4. Ingrese la cantidad.
5. Si el producto usa lotes, seleccione el lote.
6. Agregue notas si es necesario.
7. Haga clic en **Transferir**.

> **Nota:** La transferencia descuenta stock del almacén de origen y lo agrega al destino inmediatamente.

### 9.3 Gestión de almacenes

#### Crear un almacén (solo administrador y gerente)

1. Navegue a **Inventario > Almacenes**.
2. Haga clic en **Crear Almacén**.
3. Complete: código, nombre, ubicación, capacidad y notas.
4. Haga clic en **Guardar**.

#### Asignar almacenes a usuarios (solo administrador)

1. Navegue a **Configuración > Usuarios**.
2. Edite el usuario deseado.
3. En la sección **Almacenes**, seleccione los almacenes a los que tendrá acceso.
4. Guarde los cambios.

### 9.4 Cola de almacén

Los asistentes y compradores pueden ver tareas pendientes en la **Cola de Almacén**:

1. Navegue a **Colas > Cola de Almacén**.
2. Verá movimientos entrantes pendientes de procesamiento.
3. Procese cada entrada verificando la mercancía recibida.

### 9.5 Lista de reabastecimiento

1. Navegue a **Compras > Lista de Reabastecimiento**.
2. Verá productos cuyo stock está por debajo del punto de reorden.
3. Puede generar órdenes de compra directamente desde esta lista.

---

## 10. Módulo: Compras y Proveedores

### 10.1 Proveedores

#### Crear un proveedor

1. Navegue a **Compras > Proveedores**.
2. Haga clic en **Crear Proveedor**.
3. Complete: nombre, contacto, email, teléfono.
4. Haga clic en **Guardar**.

#### Importar proveedores

1. Haga clic en **Importar**.
2. Descargue la plantilla, complete los datos y suba el archivo.

### 10.2 Órdenes de compra

#### Crear una orden de compra

1. Navegue a **Compras > Órdenes de Compra**.
2. Haga clic en **Crear Orden de Compra**.
3. Seleccione el **proveedor** y el **almacén de destino**.
4. Agregue productos con cantidad y costo unitario.
5. Establezca la **fecha esperada de entrega**.
6. Guarde como borrador o envíe al proveedor.

#### Estados de orden de compra

| Estado | Descripción |
|---|---|
| Borrador | En construcción |
| Enviada | Enviada al proveedor |
| Parcial | Recepción parcial de mercancía |
| Recibida | Mercancía completamente recibida |
| Cancelada | Orden anulada |

#### Recibir mercancía

1. Abra la orden de compra enviada.
2. Haga clic en **Recibir**.
3. Ingrese las cantidades recibidas (puede ser parcial).
4. Para productos con lote, ingrese los datos del lote.
5. Confirme la recepción. El stock se actualiza automáticamente.

### 10.3 Cuentas por pagar

1. Navegue a **Compras > Cuentas por Pagar**.
2. Verá el saldo pendiente con cada proveedor.
3. Registre pagos parciales o totales.

---

## 11. Módulo: Clientes

### 11.1 Crear un cliente

1. Navegue a **Clientes**.
2. Haga clic en **Crear Cliente**.
3. Complete la información:

| Campo | Descripción |
|---|---|
| Tipo | Individual o Empresa |
| Código | Identificador único del cliente |
| Nombre | Nombre completo o razón social |
| Email | Correo electrónico |
| Teléfono | Número de contacto |
| RUC/ID Fiscal | Identificación tributaria |
| Dirección | Dirección física |
| Límite de crédito | Monto máximo de crédito otorgado |
| Días de crédito | Plazo para pago |
| Saldo a favor | Crédito acumulado del cliente |

4. Haga clic en **Guardar**.

### 11.2 Tipos de cliente

| Tipo | Uso |
|---|---|
| Individual | Persona natural |
| Empresa | Empresa o negocio |

### 11.3 Estados del cliente

| Estado | Descripción |
|---|---|
| Activo | Cliente habilitado para compras |
| Inactivo | Cliente sin actividad reciente |
| Bloqueado | Cliente con crédito vencido o restricciones |

### 11.4 Transacciones del cliente

Cada cliente tiene un historial de transacciones:

- **Venta:** compra registrada.
- **Pago:** abono a su cuenta.
- **Nota de crédito:** ajuste a favor del cliente.
- **Ajuste:** modificación manual del saldo.
- **Uso de saldo a favor:** aplicación de crédito acumulado.

---

## 12. Módulo: Reportes

### 12.1 Niveles de Stock

**Ubicación:** Reportes > Niveles de Stock

Muestra el estado del inventario por producto y almacén:

- **Resumen:** total de productos, stock crítico, stock bajo, stock normal, stock óptimo y valor total del inventario.
- **Desglose por almacén:** comparación de stock entre almacenes.
- **Por producto:** SKU, nombre, marca, almacén, stock actual, punto de reorden, nivel objetivo, estado y valor.

**Filtros:** almacén, marca, categoría, estado de stock.

**Exportar:** PDF o Excel.

### 12.2 Historial de Movimientos

**Ubicación:** Reportes > Historial de Movimientos

Registro detallado de todos los movimientos de inventario:

- **Resumen:** total de movimientos, entradas, salidas, transferencias, cantidad neta.
- **Línea de tiempo:** movimientos agrupados por día, semana o mes.
- **Por producto:** resumen de movimientos por cada producto.
- **Detalle:** fecha, producto, almacén, tipo de movimiento, cantidad, referencia y usuario.

**Filtros:** rango de fechas, producto, almacén, usuario, tipo de movimiento, agrupación.

**Exportar:** PDF o Excel.

### 12.3 Reporte Financiero

**Ubicación:** Reportes > Reporte Financiero

Análisis de rentabilidad del negocio:

- **Resumen P&L:** ingresos totales, reembolsos, costo de ventas, ganancia neta, margen porcentual y número de órdenes.
- **Rentabilidad por marca:** marcas con mayor ganancia y margen.
- **Rentabilidad por categoría:** categorías con mayor ganancia y margen.

**Filtros:** rango de fechas (hoy, semana, mes, personalizado), almacén.

### 12.4 Z-Report (Cierre de Caja)

**Ubicación:** Reportes > Z-Report

Reporte de cierre diario de caja:

**Sección A — Arqueo de Caja:**

| Concepto | Descripción |
|---|---|
| Monto de apertura | Dinero declarado al abrir la sesión |
| Ventas en efectivo | Total de ventas cobradas en cash |
| Reembolsos en efectivo | Devoluciones pagadas en cash |
| Efectivo esperado | Lo que debería haber en caja |
| Movimientos de entrada | Ingresos adicionales a caja |
| Movimientos de salida | Retiros de caja |

**Sección B — P&L Diario:**

| Concepto | Descripción |
|---|---|
| Ventas totales | Ingreso bruto del día |
| Reembolsos | Devoluciones procesadas |
| Descuentos | Total descontado |
| Ventas netas | Ventas menos reembolsos y descuentos |
| Costo de ventas | Costo de los productos vendidos |
| Ganancia bruta | Ventas netas menos costo |
| Ticket promedio | Valor promedio por orden |
| Número de órdenes | Total de órdenes procesadas |

**Sección C — Desglose por Método de Pago:**

Detalle de ingresos por cada método: efectivo, tarjeta, transferencia, crédito, etc.

**Filtros:** fecha, almacén, usuario.

**Exportar:** PDF.

### 12.5 Sesiones POS

**Ubicación:** Reportes > Sesiones POS / Cierres de Caja

Lista de todas las sesiones POS cerradas:

- Usuario que operó la sesión.
- Almacén.
- Hora de apertura y cierre.
- Monto de apertura, monto esperado y monto declarado.
- Diferencia: **Sobrante**, **Faltante** o **Cuadra**.

Puede hacer clic en una sesión para ver el detalle de las órdenes procesadas en esa sesión.

---

## 13. Módulo: Configuración

### 13.1 Configuración de la Tienda

**Ubicación:** Configuración > Tienda

| Parámetro | Descripción | Valor predeterminado |
|---|---|---|
| Nombre de la tienda | Nombre que aparece en tickets y reportes | HermeX POS |
| Eslogan | Descripción corta | — |
| Logo | Imagen del logo | — |
| Nombre del propietario | Nombre del dueño | — |
| Teléfono | Número de contacto | — |
| Email | Correo de contacto | — |
| Dirección | Dirección física | — |
| RUC/ID Fiscal | Identificación tributaria | — |
| Moneda | USD, PAB, EUR, MXN, COP | USD |
| Pie de ticket | Texto al final del ticket impreso | "¡Gracias por su compra!" |
| Tasa de impuesto predeterminada | Porcentaje de impuesto global | 7% |
| Fórmula de precios | Fórmula global tipo Excel para cálculo de precios | — |
| Redondeo de precios | Incremento de redondeo (0.25, 0.50, 1.00, 5.00, 10.00) | 1.00 |
| Formato de SKU | Campos para generación automática de SKU | Categoría + Marca |
| Días de expiración de cotizaciones | 0 = desactivado, o 15/30/60/90 | 0 |
| Requerir stock para cotizaciones | Si es verdadero, no se pueden cotizar productos sin stock | Falso |

### 13.2 Fórmulas de Precios

**Ubicación:** Configuración > Fórmulas de Precio

El sistema permite definir fórmulas de cálculo de precios similares a Excel.

**Variables disponibles:**

| Variable | Descripción |
|---|---|
| `costo` | Costo del producto |
| `ITBM` | Tasa de impuesto aplicable |

**Funciones disponibles:**

| Función | Descripción |
|---|---|
| `ROUND()` | Redondeo al entero más cercano |
| `ROUNDUP()` | Redondeo hacia arriba |
| `FLOOR()` | Redondeo hacia abajo |
| `CEIL()` | Redondeo hacia arriba (techo) |

**Ejemplo de fórmula:**

```
ROUNDUP(costo * 1.35)
```

Esto calcula un precio con un margen del 35% sobre el costo, redondeado hacia arriba.

**Simulador:**

La página incluye un simulador donde puede ingresar un costo de ejemplo y ver el resultado de la fórmula antes de aplicarla.

### 13.3 Métodos de Pago

Puede personalizar los métodos de pago disponibles:

- **Métodos del sistema:** Efectivo, Tarjeta, Transferencia, Crédito.
- **Métodos personalizados:** Puede agregar métodos como "Yappy", "Nequi", etc.
  - **Nombre:** nombre del método.
  - **Requiere referencia:** si se debe ingresar un número de referencia.
  - **Activo:** si está disponible en el POS.

Los métodos se pueden reordenar mediante arrastrar y soltar.

### 13.4 Perfil de Usuario

**Ubicación:** Configuración > Perfil

- Cambiar nombre y datos personales.
- Ver almacenes asignados.

### 13.5 Cambiar Contraseña

**Ubicación:** Configuración > Contraseña

- Ingrese su contraseña actual.
- Ingrese la nueva contraseña.
- Confirme la nueva contraseña.

### 13.6 Apariencia

**Ubicación:** Configuración > Apariencia

- Seleccione el tema: Claro u Oscuro.

### 13.7 Autenticación de Dos Factores

**Ubicación:** Configuración > Autenticación de Dos Factores

- Active o desactive la verificación en dos pasos.
- Escanee el código QR con su aplicación autenticadora.

### 13.8 Respaldos de Base de Datos (solo administrador)

**Ubicación:** Configuración > Respaldos

- Cree respaldos manuales de la base de datos.
- Descargue respaldos existentes.
- Elimine respaldos antiguos.

### 13.9 Logs de Actividad (solo administrador)

**Ubicación:** Configuración > Logs de Actividad

- Registro auditado de todas las acciones del sistema.
- Filtros por usuario, fecha y tipo de acción.
- Cada registro incluye: usuario, acción, modelo afectado, fecha y detalles.

### 13.10 Reiniciar Datos Transaccionales (solo administrador)

> **Advertencia:** Esta acción elimina todas las ventas, cotizaciones, órdenes y sesiones POS. **No** elimina catálogos, productos, clientes ni configuraciones.

1. Navegue a **Configuración > Tienda > Zona de Peligro**.
2. Haga clic en **Reiniciar Data Transaccional**.
3. Ingrese su contraseña.
4. Escriba **REINICIAR DATOS** para confirmar.
5. Opcionalmente, puede omitir la creación de respaldo.
6. Confirme la acción.

---

## 14. Sesión POS y Cierre de Caja

### 14.1 Abrir sesión

1. Al ingresar al POS sin sesión abierta, se le pedirá declarar el **monto inicial de caja**.
2. Ingrese el amounto y haga clic en **Abrir Sesión**.
3. La sesión queda registrada con hora de apertura y usuario.

### 14.2 Movimientos de caja

Durante la sesión, puede registrar entradas y salidas de efectivo:

1. Haga clic en **Movimientos de Caja**.
2. Seleccione el tipo: **Entrada** o **Salida**.
3. Ingrese el monto.
4. Indique el **motivo** (ej. "Pago de servicio", "Retiro de gerente").
5. Agregue notas si es necesario.
6. Registre el movimiento.

### 14.3 Cerrar sesión

1. Haga clic en **Cerrar Sesión**.
2. Declare el **monto final de caja** (conteo físico del dinero en caja).
3. El sistema compara el monto declarado con el monto esperado:
   - **Cuadra:** el monto declarado coincide con el esperado.
   - **Sobrante:** hay más dinero del esperado.
   - **Faltante:** hay menos dinero del esperado.
4. Agregue notas de cierre.
5. Confirme el cierre.

> **Importante:** El cierre de sesión es obligatorio al final de cada turno. La diferencia entre el monto esperado y el declarado queda registrada para revisión del gerente o administrador.

---

## 15. Solución de Problemas Comunes (FAQ)

### Acceso y Sesión

**P: No puedo iniciar sesión. ¿Qué hago?**

R: Verifique que su nombre de usuario y contraseña sean correctos. Si olvidó su contraseña, contacte al administrador para que la restablezca. Si tiene 2FA activado, asegúrese de ingresar el código correcto de su aplicación autenticadora.

**P: El sistema me redirige al login automáticamente.**

R: Su sesión ha expirado por inactividad. Inicie sesión nuevamente. Si el problema persiste, contacte al administrador.

### Almacén

**P: No puedo crear productos ni procesar ventas. Dice que no tengo almacén asignado.**

R: Contacte al administrador para que le asigne al menos un almacén. Sin un almacén asignado, no puede realizar operaciones que requieran contexto de inventario.

**P: El stock que veo no coincide con el físico.**

R: Verifique que esté en el almacén correcto. Cada almacén tiene su propio inventario. Si el almacén es correcto, revise el historial de movimientos para identificar discrepancias.

### Productos

**P: No encuentro un producto en la búsqueda del POS.**

R: Verifique que:
- El producto esté en estado **Activo**.
- El producto tenga stock en el **almacén activo**.
- Esté buscando por el término correcto (nombre, SKU, código OEM).

**P: ¿Cómo agrego un producto que no está en el catálogo durante una venta?**

R: Use la función **Línea Personalizada** en el carrito. Ingrese descripción, SKU, cantidad y precio unitario.

**P: Un producto tiene variantes pero no me aparece la opción de seleccionar.**

R: La selección de variantes aparece automáticamente al agregar un producto con múltiples variantes al carrito. Si no aparece, verifique que el producto tenga más de una variante creada.

### Ventas POS

**P: No puedo abrir una sesión POS.**

R: Verifique que tenga al menos un almacén asignado y que no exista una sesión abierta de otro usuario en el mismo almacén.

**P: No puedo aplicar un descuento mayor al configurado.**

R: Cada producto tiene un **descuento máximo** configurado. Si necesita aplicar un descuento mayor, solicite autorización a un gerente o administrador.

**P: El sistema no me permite cobrar a crédito.**

R: Las ventas a crédito requieren que el cliente esté seleccionado y tenga un **límite de crédito** configurado. Si el cliente no tiene límite o ya lo excedió, el sistema bloqueará la venta a crédito.

**P: ¿Puedo usar múltiples métodos de pago en una sola venta?**

R: Sí. Seleccione **Múltiple** como método de pago y agregue cada método con su monto correspondiente hasta cubrir el total.

### Inventario

**P: ¿Cómo corrijo un error de stock?**

R: Registre un **movimiento de ajuste** (entrada o salida) con el tipo de referencia "Ajuste". Esto corregirá el stock y quedará registrado en el historial.

**P: No puedo transferir un producto con lote.**

R: Para productos con seguimiento por lote, debe seleccionar el **lote específico** del cual desea transferir stock. Verifique que el lote exista y tenga unidades disponibles.

**P: ¿Qué pasa si recibo menos mercancía de la ordenada?**

R: Puede hacer una **recepción parcial**. Ingrese solo las cantidades recibidas y la orden quedará en estado "Parcial". Puede completar la recepción cuando llegue el resto.

### Reportes

**P: El Z-Report no cuadra. ¿Qué hago?**

R: Revise los **movimientos de caja** de la sesión para verificar que todos los ingresos y retiros estén registrados. Si hay una diferencia, documente la discrepancia en las notas de cierre y notifique al gerente.

**P: ¿Puedo exportar los reportes?**

R: Sí. Los reportes de Niveles de Stock e Historial de Movimientos se pueden exportar en **PDF** o **Excel**. El Z-Report se exporta en **PDF**.

### Cotizaciones

**P: Una cotización expiró. ¿Puedo renovarla?**

R: No directamente. Debe crear una nueva cotización con los datos actualizados.

**P: ¿Puedo modificar una cotización después de enviarla?**

R: Sí, mientras no haya sido convertida en orden. Abra la cotización, edite los datos y guarde.

### Órdenes de Venta

**P: ¿Puedo cancelar una orden confirmada?**

R: Sí. Al cancelar una orden confirmada, el stock descontado se **restaura automáticamente**.

**P: ¿Cómo agrego productos a una orden ya confirmada?**

R: Abra la orden y use el modo **Agregar Productos**. Esto carga la orden en el POS donde puede agregar ítems y cobrar la diferencia.

### Configuración

**P: ¿Quién puede cambiar la configuración de la tienda?**

R: El **administrador** y el **gerente** pueden modificar la configuración de la tienda. Solo el **administrador** puede gestionar usuarios, respaldos y logs de actividad.

**P: ¿Puedo cambiar la fórmula de precios sin afectar productos existentes?**

R: La fórmula de precios se aplica al momento de calcular el precio. Si cambia la fórmula global, los nuevos productos o los productos que usen la fórmula global se verán afectados. Los productos con fórmula personalizada no cambian.

### General

**P: El sistema está lento. ¿Qué hago?**

R: Intente lo siguiente:
- Refresque la página (F5).
- Verifique su conexión a internet.
- Limpie la caché del navegador.
- Si el problema persiste, contacte al administrador.

**P: ¿Puedo usar el sistema en mi teléfono?**

R: Sí. HermeX POS es responsivo y funciona en dispositivos móviles, aunque la experiencia óptima es en computadora de escritorio o laptop.

**P: ¿Cómo contacto al soporte técnico?**

R: Contacte al administrador del sistema o al equipo de soporte de HermeX a través del correo o teléfono proporcionado por su empresa.

---

*Manual de Usuario HermeX POS — Versión 1.0*

*Sistema desarrollado con Laravel 12 y Vue 3 / Inertia.js*
