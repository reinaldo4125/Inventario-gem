import { formatCurrency } from './formatters';

/**
 * Limpia y formatea números de teléfono para WhatsApp, adaptado a Colombia (+57)
 */
export function cleanColombiaPhone(rawPhone) {
  if (!rawPhone) return '';
  const digits = String(rawPhone).replace(/\D/g, '');
  if (!digits) return '';

  // Si ya tiene código de país Colombia (57) seguido de 10 dígitos (total 12 dígitos)
  if (digits.startsWith('57') && digits.length === 12) {
    return digits;
  }

  // Si es un celular colombiano típico de 10 dígitos (empieza por 3...)
  if (digits.length === 10 && digits.startsWith('3')) {
    return `57${digits}`;
  }

  // Si tiene 10 dígitos generales en Colombia
  if (digits.length === 10) {
    return `57${digits}`;
  }

  // Si tiene 7 u 8 dígitos (fijo local), colocar prefijo indicativo Colombia Valle 57602
  if (digits.length === 7) {
    return `57602${digits}`;
  }

  // Si ya tiene algún otro prefijo internacional largo (+1, +34, etc.)
  if (digits.length >= 11) {
    return digits;
  }

  return digits;
}

/**
 * Genera el mensaje formateado para enviar por WhatsApp
 */
export function buildWhatsAppDocumentMessage({
  tipoDoc = 'Factura',
  numero = '',
  cliente = 'Cliente General',
  fecha = '',
  total = 0,
  metodoPago = 'Efectivo',
  estado = 'Completada',
  items = [],
  empresa = {},
  notas = '',
  publicUrl = ''
}) {
  const empresaNombre = empresa?.nombre || 'Multinyectores Colombia';
  const empresaDir = empresa?.direccion 
    ? `${empresa.direccion}${empresa.ciudad ? ', ' + empresa.ciudad : ''}` 
    : 'Tuluá - Valle del Cauca';
  const empresaTel = empresa?.telefono || '(602) 224-5000';
  const totalFormateado = typeof total === 'number' ? formatCurrency(total) : total;

  let fechaTexto = fecha;
  try {
    if (fecha) {
      fechaTexto = new Date(fecha).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      fechaTexto = new Date().toLocaleDateString('es-CO');
    }
  } catch {
    fechaTexto = String(fecha || '');
  }

  // Formatear lista de items/productos/servicios
  let itemsTexto = '';
  if (Array.isArray(items) && items.length > 0) {
    itemsTexto = items.map(it => {
      const cant = it.cantidad || 1;
      const nombre = it.Producto?.nombre || it.producto?.nombre || it.nombre || 'Item';
      const oem = it.Producto?.codigo_oem || it.codigo_oem;
      const precioUnit = it.precio_unitario ?? it.precio ?? 0;
      const subtotal = cant * precioUnit;
      const oemStr = oem && oem !== '-' ? ` [OEM: ${oem}]` : '';
      return `• ${cant}x ${nombre}${oemStr} → ${formatCurrency(subtotal)}`;
    }).join('\n');
  } else {
    itemsTexto = '• Detalle según orden adjunta';
  }

  const emojiDoc = tipoDoc.toLowerCase().includes('cotiz') ? '📋' : '📄';

  let mensaje = `*${empresaNombre.toUpperCase()}*
_Inyección Electrónica Automotriz & Repuestos_

¡Hola, *${cliente}*! 👋

Adjuntamos el detalle de su *${tipoDoc} ${numero}* por valor de *${totalFormateado}* en *${empresaNombre}*:

${emojiDoc} *Documento:* ${tipoDoc} ${numero}
📅 *Fecha:* ${fechaTexto}
💰 *Valor Total:* ${totalFormateado}
💳 *Método de Pago:* ${metodoPago}
📌 *Estado:* ${estado}

📦 *Detalle:*
${itemsTexto}
${notas ? `\n📝 *Observaciones:* ${notas}` : ''}
${publicUrl ? `\n📥 *Ver / Descargar PDF Oficial:* \n${publicUrl}\n` : ''}
📍 *Sede:* ${empresaDir}
📞 *Atención / Soporte:* ${empresaTel}

¡Muchas gracias por su preferencia! 🚗💨`;

  return mensaje;
}

/**
 * Genera la URL directa de WhatsApp Web / Móvil
 */
export function getWhatsAppUrl(phone, messageText) {
  const cleanedPhone = cleanColombiaPhone(phone);
  const encodedText = encodeURIComponent(messageText || '');
  if (cleanedPhone) {
    return `https://api.whatsapp.com/send?phone=${cleanedPhone}&text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}
