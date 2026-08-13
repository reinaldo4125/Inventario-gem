/**
 * Utilidades para Importación y Descarga de Plantillas CSV de Productos y Clientes
 */

// Descargar archivo plano .csv con codificación UTF-8 para compatibilidad en Excel
export function downloadCSVFile(filename, content) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Generar plantilla de Productos
export function downloadTemplateProductosCSV() {
  const headers = [
    'nombre',
    'codigo_oem',
    'categoria',
    'marca',
    'modelo',
    'compatibilidad',
    'tipo',
    'precio',
    'precio_detal',
    'precio_mayor',
    'precio_almacen',
    'costo',
    'stock_minimo',
    'stock_inicial',
    'unidad_medida',
    'ubicacion_bodega',
    'proveedor',
    'lote',
    'fecha_vencimiento'
  ].join(';');

  const sampleRows = [
    [
      'Inyector Bosch 0280155828',
      '0280155828',
      'Inyectores',
      'Bosch',
      'Chevrolet Aveo',
      'Aveo 1.5 2008-2012',
      'producto',
      '120000',
      '120000',
      '105000',
      '100000',
      '80000',
      '5',
      '15',
      'Unidad',
      'Estante A-3',
      'Bosch Colombia',
      'LOT-2026-01',
      '2028-12-31'
    ].join(';'),
    [
      'Limpieza de Inyectores Ultrasonido',
      'SERV-001',
      'Servicios',
      'Multinyectores',
      'General',
      'Todos los vehículos',
      'servicio',
      '80000',
      '80000',
      '70000',
      '65000',
      '20000',
      '0',
      '0',
      'Servicio',
      'Taller',
      'Interno',
      '',
      ''
    ].join(';'),
    [
      'Filtro Micro Inyector Universal',
      'MICRO-01',
      'Filtros',
      'Genérico',
      'Universal',
      'Inyectores Multipunto',
      'producto',
      '2500',
      '2500',
      '1800',
      '1500',
      '800',
      '20',
      '100',
      'Unidad',
      'Caja B-12',
      'Importadora Repuestos',
      '',
      ''
    ].join(';')
  ];

  const csvContent = headers + '\n' + sampleRows.join('\n');
  downloadCSVFile('plantilla_productos_referencia.csv', csvContent);
}

// Generar plantilla de Clientes
export function downloadTemplateClientesCSV() {
  const headers = [
    'nombre',
    'documento',
    'tipo_documento',
    'tipo_cliente',
    'empresa',
    'telefono',
    'correo',
    'direccion',
    'ciudad',
    'departamento',
    'pais',
    'descuentoEspecial',
    'cupoCredito',
    'notas'
  ].join(';');

  const sampleRows = [
    [
      'Taller Los Inyectores S.A.S.',
      '901234567-8',
      'NIT',
      'Mayorista',
      'Los Inyectores',
      '3101234567',
      'contacto@losinyectores.com',
      'Calle 45 # 12-34',
      'Cali',
      'Valle del Cauca',
      'Colombia',
      '5',
      '5000000',
      'Cliente taller especializado'
    ].join(';'),
    [
      'Carlos Mario Mendoza',
      '16789456',
      'CC',
      'Detal',
      '',
      '3159876543',
      'carlos.mendoza@email.com',
      'Av 6N # 28-10',
      'Cali',
      'Valle del Cauca',
      'Colombia',
      '0',
      '0',
      'Particular'
    ].join(';'),
    [
      'AutoServicios del Valle',
      '800123987-1',
      'NIT',
      'Flota',
      'AutoServicios',
      '6025551234',
      'compras@autoserviciosvalle.com',
      'Carrera 15 # 10-50',
      'Palmira',
      'Valle del Cauca',
      'Colombia',
      '8',
      '10000000',
      'Mantenimiento preventivo de flotas'
    ].join(';')
  ];

  const csvContent = headers + '\n' + sampleRows.join('\n');
  downloadCSVFile('plantilla_clientes_referencia.csv', csvContent);
}

// Mapeo flexible de encabezados
const HEADER_MAP = {
  // Productos
  'nombre': 'nombre',
  'nombre producto': 'nombre',
  'producto': 'nombre',
  'codigo_oem': 'codigo_oem',
  'codigo oem': 'codigo_oem',
  'oem': 'codigo_oem',
  'referencia': 'codigo_oem',
  'codigo': 'codigo_oem',
  'categoria': 'categoria',
  'marca': 'marca',
  'modelo': 'modelo',
  'compatibilidad': 'compatibilidad',
  'tipo': 'tipo',
  'precio': 'precio',
  'precio venta': 'precio',
  'precio_detal': 'precio_detal',
  'precio detal': 'precio_detal',
  'precio_mayor': 'precio_mayor',
  'precio mayor': 'precio_mayor',
  'precio_almacen': 'precio_almacen',
  'precio almacen': 'precio_almacen',
  'costo': 'costo',
  'stock_minimo': 'stock_minimo',
  'stock minimo': 'stock_minimo',
  'stock_inicial': 'stock_inicial',
  'stock inicial': 'stock_inicial',
  'stock': 'stock_inicial',
  'unidad_medida': 'unidad_medida',
  'unidad': 'unidad_medida',
  'ubicacion_bodega': 'ubicacion_bodega',
  'ubicacion': 'ubicacion_bodega',
  'proveedor': 'proveedor',
  'lote': 'lote',
  'fecha_vencimiento': 'fecha_vencimiento',

  // Clientes
  'documento': 'documento',
  'nit': 'documento',
  'cedula': 'documento',
  'identificacion': 'documento',
  'tipo_documento': 'tipo_documento',
  'tipo documento': 'tipo_documento',
  'tipo_cliente': 'tipo_cliente',
  'tipo cliente': 'tipo_cliente',
  'empresa': 'empresa',
  'razon social': 'empresa',
  'telefono': 'telefono',
  'celular': 'telefono',
  'correo': 'correo',
  'email': 'correo',
  'direccion': 'direccion',
  'ciudad': 'ciudad',
  'departamento': 'departamento',
  'pais': 'pais',
  'descuentoespecial': 'descuentoEspecial',
  'descuento especial': 'descuentoEspecial',
  'descuento %': 'descuentoEspecial',
  'cupocredito': 'cupoCredito',
  'cupo credito': 'cupoCredito',
  'cupo de credito': 'cupoCredito',
  'notas': 'notas',
  'observaciones': 'notas'
};

// Función para parsear texto CSV con soporte para comas, punto y coma, comillas y saltos de línea
export function parseCSVText(csvText) {
  if (!csvText) return [];

  // Remover BOM si existe
  const cleanText = csvText.replace(/^\uFEFF/, '').trim();
  if (!cleanText) return [];

  // Detectar delimitador (`;` o `,` o `\t`)
  const firstLine = cleanText.split(/\r?\n/)[0];
  let delimiter = ',';
  if ((firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length) {
    delimiter = ';';
  } else if (firstLine.includes('\t')) {
    delimiter = '\t';
  }

  // Parsear filas respetando comillas
  const lines = parseCSVRows(cleanText, delimiter);
  if (lines.length === 0) return [];

  const rawHeaders = lines[0];
  const headers = rawHeaders.map(h => {
    const norm = String(h).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return HEADER_MAP[norm] || HEADER_MAP[String(h).trim().toLowerCase()] || norm.replace(/\s+/g, '_');
  });

  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (row.length === 0 || (row.length === 1 && !row[0].trim())) continue;

    const rowObj = {};
    let hasData = false;
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j];
      const val = row[j] !== undefined ? String(row[j]).trim() : '';
      if (val !== '') hasData = true;
      rowObj[key] = val;
    }
    if (hasData) {
      result.push(rowObj);
    }
  }

  return result;
}

// Función auxiliar para tokenizar CSV con comillas
function parseCSVRows(text, delimiter) {
  const rows = [];
  let currentRow = [];
  let currentToken = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentToken += '"';
        i++; // saltar comilla doble escape
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentToken);
      currentToken = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // saltar \n de \r\n
      }
      currentRow.push(currentToken);
      rows.push(currentRow);
      currentRow = [];
      currentToken = '';
    } else {
      currentToken += char;
    }
  }

  if (currentToken !== '' || currentRow.length > 0) {
    currentRow.push(currentToken);
    rows.push(currentRow);
  }

  return rows;
}
