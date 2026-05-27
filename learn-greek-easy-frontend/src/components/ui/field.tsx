import React from 'react';

export interface FieldProps {
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  /** Links the rendered label to a child input via the HTML `for` attribute. */
  htmlFor?: string;
}

export function Field({ label, hint, children, htmlFor }: FieldProps) {
  return (
    <div className="dr-field">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="dr-field-l">
          {label}
        </label>
      ) : (
        <div className="dr-field-l">{label}</div>
      )}
      {hint && <div className="dr-field-h">{hint}</div>}
      {children}
    </div>
  );
}
