import { InputHTMLAttributes, ReactNode, useId } from 'react';
import { inputClass, labelClass } from '../ui';

interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'className'
> {
  label: string;
  /** Helper text under the field (may be live, e.g. the derived key). */
  hint?: ReactNode;
}

/** Visible label + input + helper text, wired with aria-describedby. */
export function TextField({ label, hint, ...inputProps }: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="flex flex-col gap-xs">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        className={inputClass}
        aria-describedby={hint ? hintId : undefined}
        {...inputProps}
      />
      {hint && (
        <p id={hintId} className="font-body-sm text-body-sm text-mute">
          {hint}
        </p>
      )}
    </div>
  );
}
