import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from './formatters';

// Crea una instancia de jsPDF con opciones por defecto
export function createDoc(orientation = 'p', unit = 'mm', format = 'a4') {
  return new jsPDF({ orientation, unit, format });
}

// Añade una tabla usando autoTable y devuelve la posición final
export function tableToPdf(doc, { head = [], body = [], startY = 22, theme = 'striped', styles = {}, headStyles = {}, formatNumbers = false } = {}) {
  const processedBody = (body || []).map(row => row.map(cell => {
    if (!formatNumbers) return cell;
    if (typeof cell === 'number') return formatCurrency(cell);
    if (typeof cell === 'string') {
      const maybeNum = parseFloat(cell.replace(/[^0-9.-]/g, ''));
      if (!isNaN(maybeNum) && /[0-9]/.test(cell)) return formatCurrency(maybeNum);
    }
    return cell;
  }));

  autoTable(doc, {
    startY,
    head: head && head.length ? head : undefined,
    body: processedBody,
    theme,
    styles,
    headStyles
  });
  return doc.lastAutoTable ? doc.lastAutoTable.finalY : startY;
}

// Guarda el PDF (helper que centraliza doc.save)
export function savePdf(doc, fileName = 'documento.pdf') {
  if (!doc || typeof doc.save !== 'function') throw new Error('Documento PDF inválido');
  doc.save(fileName);
}

/**
 * Genera el documento PDF oficial estandarizado (Factura, Comprobante de Venta o Cotización)
 * Devuelve el objeto jsPDF, Blob, File y función de descarga directa.
 */
export function generateOfficialDocumentPdf({
  tipoDoc = 'Comprobante de Venta',
  numero = '',
  fecha = '',
  cliente = 'Cliente General',
  documento = 'Venta Mostrador',
  direccion = '',
  telefono = '',
  bodega = 'Sede Principal',
  metodoPago = 'Efectivo',
  items = [],
  total = 0,
  descuento = 0,
  impuestos = 0,
  notas = '',
  empresa = {}
} = {}) {
  const doc = createDoc();
  const emp = empresa || {};
  let textX = 14;

  if (emp.logo_url && emp.logo_url.startsWith('data:image')) {
    try {
      doc.addImage(emp.logo_url, 'PNG', 14, 10, 28, 20);
      textX = 46;
    } catch (e) {
      console.warn('No se pudo incrustar el logo en el PDF:', e);
    }
  }

  // Encabezado Empresa
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(emp.nombre || 'MULTINYECTORES COLOMBIA', textX, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`NIT: ${emp.nit || '900.123.456-7'}`, textX, 20);

  let currentY = 24;
  if (emp.actividad_economica) {
    doc.text(`Giro: ${emp.actividad_economica}`, textX, currentY);
    currentY += 4;
  }
  doc.text(`Dirección: ${emp.direccion || 'Tuluá - Valle del Cauca'}${emp.ciudad ? `, ${emp.ciudad}` : ''}`, textX, currentY);
  currentY += 4;
  doc.text(`Tel: ${emp.telefono || '(602) 224-5000'}${emp.telefono_secundario ? ` / ${emp.telefono_secundario}` : ''} | Correo: ${emp.correo || 'contacto@multinyectores.com'}`, textX, currentY);

  // Datos del Documento (Derecha)
  const cleanNum = String(numero).replace(/^(FAC-|VEN-|COT-)/i, '');
  const prefix = tipoDoc.toLowerCase().includes('cotiz') ? 'COT' : (tipoDoc.toLowerCase().includes('comp') ? 'VEN' : 'FAC');
  const normalizedTitle = tipoDoc.toLowerCase().includes('factura') ? 'COMPROBANTE DE VENTA' : tipoDoc.toUpperCase();
  const docTitle = `${normalizedTitle} N° ${prefix}-${cleanNum}`;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(docTitle, 130, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  let fechaTexto = '';
  try {
    fechaTexto = fecha ? new Date(fecha).toLocaleDateString('es-CO') : new Date().toLocaleDateString('es-CO');
  } catch {
    fechaTexto = String(fecha || '');
  }

  doc.text(`Fecha: ${fechaTexto}`, 130, 20);
  doc.text(`Bodega: ${bodega || 'Sede Principal'}`, 130, 24);
  doc.text(`Pago: ${metodoPago || 'Efectivo'}`, 130, 28);

  const lineY = Math.max(currentY + 4, 34);
  doc.setDrawColor(200);
  doc.line(14, lineY, 196, lineY);

  // Datos del Cliente / Adquirente
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('DATOS DEL CLIENTE', 14, lineY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Cliente: ${cliente || 'Cliente General'}`, 14, lineY + 11);
  doc.text(`Doc / NIT: ${documento || 'Venta Mostrador'}`, 14, lineY + 16);
  doc.text(`Dirección: ${direccion || 'N/A'}`, 14, lineY + 21);
  doc.text(`Teléfono: ${telefono || 'N/A'}`, 14, lineY + 26);

  // Tabla de Artículos
  const startY = lineY + 32;
  const processedItems = (items || []).map(d => {
    const cant = d.cantidad || 1;
    const oem = d.Producto?.codigo_oem || d.producto?.codigo_oem || d.codigo_oem || '-';
    const nombre = d.Producto?.nombre || d.producto?.nombre || d.nombre || 'Producto / Servicio';
    const precio = d.precio_unitario ?? d.precio ?? 0;
    const subtotal = cant * precio;
    return [
      cant,
      oem,
      nombre,
      formatCurrency(precio),
      formatCurrency(subtotal)
    ];
  });

  const finalY = tableToPdf(doc, {
    startY,
    head: [['Cant', 'Código OEM', 'Producto / Servicio', 'P. Unitario', 'Subtotal']],
    body: processedItems
  });

  // Totales
  let y = (finalY || startY) + 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`VALOR TOTAL: ${formatCurrency(total)}`, 130, y);

  if (notas) {
    y += 8;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Observaciones: ${notas}`, 14, y, { maxWidth: 180 });
  }

  if (emp.pie_pagina_factura) {
    y += 10;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(emp.pie_pagina_factura, 14, y, { maxWidth: 180 });
  }

  const fileName = `${prefix}_${cleanNum}_${(cliente || 'Cliente').replace(/\s+/g, '_')}.pdf`;
  const blob = doc.output('blob');
  const file = new File([blob], fileName, { type: 'application/pdf' });

  return {
    doc,
    blob,
    file,
    fileName,
    download: () => {
      savePdf(doc, fileName);
    }
  };
}

export default { createDoc, tableToPdf, savePdf, generateOfficialDocumentPdf };
