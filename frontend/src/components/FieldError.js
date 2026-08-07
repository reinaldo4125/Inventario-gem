import React from 'react';

export default function FieldError({ children, className = '', style = {}, ...rest }) {
  if (!children) return null;
  // Combina la clase por defecto con cualquier clase adicional pasada
  const classes = ['form-error', className].filter(Boolean).join(' ');
  return (
    <div className={classes} role="alert" aria-live="polite" style={style} {...rest}>
      {children}
    </div>
  );
}
