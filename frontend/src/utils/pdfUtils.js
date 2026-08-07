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

export default { createDoc, tableToPdf, savePdf };
