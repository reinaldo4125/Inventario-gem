import React, { useState, useEffect } from 'react';
import { FaWhatsapp, FaCopy, FaCheck, FaFilePdf, FaDownload, FaShareAlt, FaPaperclip } from 'react-icons/fa';
import { MdClose, MdPhone, MdInfoOutline } from 'react-icons/md';
import { cleanColombiaPhone, getWhatsAppUrl } from '../utils/whatsapp';
import { generateOfficialDocumentPdf } from '../utils/pdfUtils';

export default function WhatsAppModal({
  isOpen,
  onClose,
  data = {}
}) {
  const [telefono, setTelefono] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [pdfDescargado, setPdfDescargado] = useState(false);
  const [canShareFile, setCanShareFile] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (isOpen && data) {
      setTelefono(data.telefono || '');
      setMensaje(data.mensaje || '');
      setCopiado(false);
      setPdfDescargado(false);

      // Verificar si el dispositivo soporta compartir archivos directamente (Android/iOS/Chrome)
      try {
        if (navigator.canShare && typeof navigator.share === 'function') {
          const testFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
          if (navigator.canShare({ files: [testFile] })) {
            setCanShareFile(true);
          } else {
            setCanShareFile(false);
          }
        } else {
          setCanShareFile(false);
        }
      } catch {
        setCanShareFile(false);
      }
    }
  }, [isOpen, data]);

  if (!isOpen) return null;

  const phonePreview = cleanColombiaPhone(telefono);
  const waUrl = getWhatsAppUrl(telefono, mensaje);

  // Generar el archivo PDF oficial
  const handleObtenerPdf = () => {
    try {
      return generateOfficialDocumentPdf({
        tipoDoc: data.tipoDoc || 'Factura',
        numero: data.numero || '',
        fecha: data.fecha || '',
        cliente: data.cliente || 'Cliente General',
        documento: data.documento || '',
        direccion: data.direccion || '',
        telefono: telefono || data.telefono || '',
        bodega: data.bodega || 'Sede Principal',
        metodoPago: data.metodoPago || 'Efectivo',
        items: data.items || [],
        total: data.total || 0,
        descuento: data.descuento || 0,
        impuestos: data.impuestos || 0,
        notas: data.notas || '',
        empresa: data.empresa || {}
      });
    } catch (e) {
      console.error('Error al generar PDF para WhatsApp:', e);
      return null;
    }
  };

  // Descargar el PDF
  const handleDescargarPdf = () => {
    const pdfData = handleObtenerPdf();
    if (pdfData && pdfData.download) {
      pdfData.download();
      setPdfDescargado(true);
      setTimeout(() => setPdfDescargado(false), 3000);
    }
  };

  // Descargar PDF y abrir WhatsApp simultáneamente
  const handleDescargarYAbrirWhatsApp = () => {
    handleDescargarPdf();
    // Abrir WhatsApp en nueva pestaña
    const link = document.createElement('a');
    link.href = waUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compartir directamente el PDF adjunto si el sistema lo soporta (Android, iOS)
  const handleCompartirArchivo = async () => {
    const pdfData = handleObtenerPdf();
    if (!pdfData || !pdfData.file) return;

    setSharing(true);
    try {
      if (navigator.canShare && navigator.canShare({ files: [pdfData.file] })) {
        await navigator.share({
          files: [pdfData.file],
          title: `${data.tipoDoc || 'Documento'} ${data.numero || ''}`,
          text: mensaje
        });
        onClose();
      } else {
        // Si falla o no soporta, recurrir a descarga y apertura
        handleDescargarYAbrirWhatsApp();
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Error en navigator.share:', err);
        handleDescargarYAbrirWhatsApp();
      }
    } finally {
      setSharing(false);
    }
  };

  const handleCopiar = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(mensaje)
        .then(() => {
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2500);
        })
        .catch(() => {});
    }
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 1100 }}>
      <div 
        className="modal-card card" 
        style={{ 
          maxWidth: '560px', 
          width: '95%', 
          background: '#ffffff', 
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          padding: '22px'
        }}
      >
        {/* Cabecera */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ background: '#25D366', color: '#fff', borderRadius: '50%', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FaWhatsapp size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1a202c' }}>
                Enviar por WhatsApp
              </h3>
              <small style={{ color: '#718096' }}>
                {data.tipoDoc || 'Documento'} {data.numero || ''} • {data.cliente || 'Cliente General'}
              </small>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-secundario" style={{ padding: '4px 8px' }}>
            <MdClose size={18} />
          </button>
        </div>

        {/* Guía visual para adjuntar el PDF */}
        <div style={{ 
          background: '#f0fdf4', 
          border: '1px solid #bbf7d0', 
          borderRadius: '8px', 
          padding: '10px 14px', 
          marginBottom: '14px', 
          display: 'flex', 
          alignItems: 'flex-start', 
          gap: '10px',
          fontSize: '12px',
          color: '#166534'
        }}>
          <FaPaperclip size={18} style={{ marginTop: '2px', flexShrink: 0, color: '#15803d' }} />
          <div>
            <b>¿Cómo adjuntar el archivo PDF en WhatsApp?</b>
            <div style={{ color: '#14532d', marginTop: '2px', lineHeight: '1.4' }}>
              Los navegadores web no pueden ingresar archivos automáticamente a WhatsApp Web por seguridad. 
              Al hacer clic en <b>"Descargar PDF y Abrir WhatsApp"</b>, el PDF se descargará al instante en tu equipo y solo debes <b>arrastrarlo al chat o hacer clic en 📎 &gt; Documento</b>.
              {data.publicUrl && <span> Además, el mensaje incluye el <b>enlace directo</b> para que el cliente lo consulte o descargue con un solo toque.</span>}
            </div>
          </div>
        </div>

        {/* Campo Teléfono WhatsApp */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#2d3748', marginBottom: '6px' }}>
            Número de WhatsApp del Cliente / Mecánico:
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <MdPhone size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: '#a0aec0' }} />
              <input 
                type="text" 
                value={telefono} 
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej: 3101234567 o +57 310..."
                className="form-control"
                style={{ paddingLeft: '34px', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            {phonePreview && (
              <span style={{ fontSize: '12px', background: '#e6fffa', color: '#234e52', padding: '6px 10px', borderRadius: '6px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                +{phonePreview}
              </span>
            )}
          </div>
          <small style={{ color: '#718096', fontSize: '11px', marginTop: '4px', display: 'block' }}>
            🇨🇴 Para números en Colombia agregamos automáticamente el prefijo internacional (+57).
          </small>
        </div>

        {/* Vista previa del mensaje */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ fontWeight: 600, fontSize: '13px', color: '#2d3748' }}>
              Mensaje a enviar:
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button 
                type="button" 
                onClick={handleDescargarPdf}
                className="btn btn-secundario" 
                style={{ fontSize: '11px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px', color: '#c53030' }}
                title="Descargar archivo PDF oficial"
              >
                <FaFilePdf size={12} /> {pdfDescargado ? '¡PDF Descargado!' : 'Descargar PDF 📥'}
              </button>
              <button 
                type="button" 
                onClick={handleCopiar} 
                className="btn btn-secundario" 
                style={{ fontSize: '11px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                {copiado ? <FaCheck color="#38a169" /> : <FaCopy />}
                {copiado ? '¡Copiado!' : 'Copiar texto'}
              </button>
            </div>
          </div>
          <textarea
            rows={7}
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            className="form-control"
            style={{ 
              width: '100%', 
              fontSize: '12px', 
              fontFamily: 'monospace', 
              background: '#f8fafc',
              border: '1px solid #cbd5e0',
              borderRadius: '6px',
              padding: '10px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Botones de acción */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <button type="button" onClick={onClose} className="btn btn-secundario">
            Cerrar
          </button>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {/* Si el navegador es móvil o soporta compartir archivo directo con WhatsApp */}
            {canShareFile && (
              <button
                type="button"
                onClick={handleCompartirArchivo}
                disabled={sharing}
                style={{
                  background: '#1d4ed8',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '13px',
                  padding: '9px 14px',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: 'none',
                  cursor: 'pointer'
                }}
                title="Compartir el archivo PDF directamente a WhatsApp (móvil)"
              >
                <FaShareAlt size={14} /> Compartir con PDF Adjunto
              </button>
            )}

            {/* Botón principal: Descarga el PDF y abre WhatsApp con el mensaje */}
            <button
              type="button"
              onClick={handleDescargarYAbrirWhatsApp}
              style={{
                background: '#25D366',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '13px',
                padding: '9px 16px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 6px -1px rgba(37, 211, 102, 0.4)'
              }}
              title="Descarga el PDF a tu equipo y abre WhatsApp listo para adjuntarlo o enviarlo"
            >
              <FaWhatsapp size={18} /> Descargar PDF y Abrir WhatsApp
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
