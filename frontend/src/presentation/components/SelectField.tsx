import { ReactNode, SelectHTMLAttributes, useId } from 'react';
import { inputClass, labelClass } from '../ui';

interface SelectFieldProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'className'
> {
  label: string;
  hint?: ReactNode;
}

/** Visible label + select + helper text, same shape as TextField. */
export function SelectField({
  label,
  hint,
  children,
  ...selectProps
}: SelectFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="flex flex-col gap-xs">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <select
        id={id}
        className={inputClass}
        aria-describedby={hint ? hintId : undefined}
        {...selectProps}
      >
        {children}
      </select>
      {hint && (
        <p id={hintId} className="font-body-sm text-body-sm text-mute">
          {hint}
        </p>
      )}
    </div>
  );
}
