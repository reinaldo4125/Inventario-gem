// Script para descontar stock de productos de todas las ventas pagadas
const { Venta, DetalleVenta, Producto } = require('./models');

async function descontarStockVentasPagadas() {
  const ventas = await Venta.findAll({
    where: { estado: 'Pagada' },
    include: [{ model: DetalleVenta }]
  });
  let actualizados = 0;
  for (const venta of ventas) {
    // Puede ser array o único objeto
    const detalles = Array.isArray(venta.DetalleVenta) ? venta.DetalleVenta : (venta.DetalleVenta ? [venta.DetalleVenta] : []);
    for (const detalle of detalles) {
      await Producto.increment(
        { stock: -detalle.cantidad },
        { where: { id: detalle.productoId } }
      );
      actualizados++;
    }
  }
  console.log(`Stock actualizado para ${actualizados} movimientos de productos en ventas pagadas.`);
}

descontarStockVentasPagadas().then(()=>process.exit());
