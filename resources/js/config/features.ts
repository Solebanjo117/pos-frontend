/**
 * Interruptores de funciones del frontend.
 *
 * MULTI_WAREHOUSE_ENABLED: por ahora el negocio trabaja con UN solo almacén (decisión 2026-11-11).
 * Mientras esté en false se ocultan en toda la interfaz los selectores, columnas y datos de
 * almacén/sucursal/bodega, el módulo de Almacenes y las transferencias. Los datos se siguen
 * guardando y filtrando con el almacén actual del usuario.
 * Para volver a mostrarlos: VITE_MULTI_WAREHOUSE=true en .env y volver a compilar.
 */
export const MULTI_WAREHOUSE_ENABLED =
    import.meta.env.VITE_MULTI_WAREHOUSE === 'true';
