import React from 'react';
import { formatCurrency, parsePrecio } from './utils/formatters';
import FieldError from './components/FieldError';

// FacturaForm: implementación única y limpia
export default function FacturaForm({
  form = {},
  formErrors = {},
  loading = false,
  handleChange = () => {},
  handleSubmit = () => {},
  setForm = () => {},
  setEditId = () => {},
  setError = () => {},
  setSuccess = () => {},
  setFormErrors = () => {}
}) {
  const totalParsed = parsePrecio(form.total || 0);
  const totalInvalid = !(totalParsed && totalParsed > 0.01);

  // Local field-level validation helpers (UI-only; server still authoritative)
  const fechaInvalid = !form.fecha || form.fecha === '';
  const descuentoInvalid = form.descuento !== undefined && (Number(form.descuento) < 0 || Number(form.descuento) > 100);
  const impuestosInvalid = form.impuestos !== undefined && (Number(form.impuestos) < 0 || Number(form.impuestos) > 100);

  return (
    <form className="usuarios-form card factura-form" onSubmit={handleSubmit} noValidate aria-label="Formulario de Factura">
      <div className="factura-form-grid">
        <div className="field">
          <label htmlFor="fecha">Fecha *</label>
          <input id="fecha" name="fecha" type="date" value={form.fecha ? form.fecha.slice(0,10) : ''} onChange={handleChange} aria-required="true" aria-invalid={!!(formErrors.fecha || fechaInvalid)} />
          {(formErrors.fecha || fechaInvalid) && <FieldError>{formErrors.fecha || 'La fecha es obligatoria'}</FieldError>}
        </div>

        <div className="field">
          <label htmlFor="descuento">Descuento (%)</label>
          <input id="descuento" name="descuento" type="number" value={form.descuento || ''} onChange={handleChange} min="0" max="100" step="0.01" aria-invalid={!!(formErrors.descuento || descuentoInvalid)} />
          {(formErrors.descuento || descuentoInvalid) && <FieldError>{formErrors.descuento || 'El descuento debe estar entre 0 y 100'}</FieldError>}
        </div>

        <div className="field">
          <label htmlFor="impuestos">Impuestos (%)</label>
          <input id="impuestos" name="impuestos" type="number" value={form.impuestos || ''} onChange={handleChange} min="0" max="100" step="0.01" aria-invalid={!!(formErrors.impuestos || impuestosInvalid)} />
          {(formErrors.impuestos || impuestosInvalid) && <FieldError>{formErrors.impuestos || 'Los impuestos deben estar entre 0 y 100'}</FieldError>}
        </div>

        <div className="field field-total">
          <div className="label">Total</div>
          <div className="total-value">{form.total ? formatCurrency(form.total) : '-'}</div>
          {totalInvalid && <FieldError role="alert" aria-live="polite">Total inválido. Verifica los precios y descuentos.</FieldError>}
        </div>
      </div>

      <div className="factura-form-actions">
        <button type="submit" disabled={loading || totalInvalid} className="btn-principal">{loading ? 'Actualizando...' : 'Actualizar'}</button>
        <button type="button" onClick={() => { setForm({}); setEditId(null); setError(''); setSuccess(''); setFormErrors({}); }} className="btn-cancelar">Cancelar</button>
      </div>
    </form>
  );
}
