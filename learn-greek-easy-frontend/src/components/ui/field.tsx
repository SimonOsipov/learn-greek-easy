import React from 'react';

export interface FieldProps {
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <div className="dr-field">
      <div className="dr-field-l">{label}</div>
      {hint && <div className="dr-field-h">{hint}</div>}
      {children}
    </div>
  );
}
