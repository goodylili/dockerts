import { forwardRef, useId } from "react";

const controlBase =
  "w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition " +
  "placeholder:text-slate-400 focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 " +
  "dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500";

const controlOk =
  "border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20 dark:border-slate-700 dark:focus:border-indigo-400";

const controlError =
  "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-500";

function controlClass(hasError: boolean, extra = ""): string {
  return [controlBase, hasError ? controlError : controlOk, extra]
    .filter(Boolean)
    .join(" ");
}

interface FieldShellProps {
  id: string;
  label: string;
  hint?: string;
  hintId?: string;
  error?: string;
  errorId: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

function FieldShell({
  id,
  label,
  hint,
  hintId,
  error,
  errorId,
  required,
  className,
  children,
}: FieldShellProps) {
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-1.5 flex items-baseline gap-1 text-sm font-medium text-slate-700 dark:text-slate-200"
      >
        {label}
        {required ? (
          <span aria-hidden="true" className="text-rose-500">
            *
          </span>
        ) : (
          <span className="text-xs font-normal text-slate-400 dark:text-slate-500">
            optional
          </span>
        )}
      </label>
      {children}
      {hint && !error ? (
        <p
          id={hintId}
          className="mt-1.5 text-xs text-slate-500 dark:text-slate-400"
        >
          {hint}
        </p>
      ) : null}
      <p
        id={errorId}
        role="alert"
        className={
          error
            ? "mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400"
            : "sr-only"
        }
      >
        {error ?? ""}
      </p>
    </div>
  );
}

function useFieldIds(explicitId?: string) {
  const generated = useId();
  const id = explicitId ?? generated;
  return { id, hintId: `${id}-hint`, errorId: `${id}-error` };
}

function describedBy(
  hasError: boolean,
  hasHint: boolean,
  hintId: string,
  errorId: string,
): string | undefined {
  const ids = [hasError ? errorId : null, hasHint && !hasError ? hintId : null]
    .filter(Boolean)
    .join(" ");
  return ids === "" ? undefined : ids;
}

type BaseProps = {
  label: string;
  hint?: string;
  error?: string;
  fieldClassName?: string;
};

export type TextFieldProps = BaseProps &
  React.InputHTMLAttributes<HTMLInputElement>;

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField(
    { label, hint, error, fieldClassName, id: explicitId, ...props },
    ref,
  ) {
    const { id, hintId, errorId } = useFieldIds(explicitId);
    return (
      <FieldShell
        id={id}
        label={label}
        hint={hint}
        hintId={hintId}
        error={error}
        errorId={errorId}
        required={props.required}
        className={fieldClassName}
      >
        <input
          {...props}
          id={id}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(!!error, !!hint, hintId, errorId)}
          className={controlClass(!!error)}
        />
      </FieldShell>
    );
  },
);

export type SelectFieldProps = BaseProps &
  React.SelectHTMLAttributes<HTMLSelectElement>;

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  function SelectField(
    { label, hint, error, fieldClassName, id: explicitId, children, ...props },
    ref,
  ) {
    const { id, hintId, errorId } = useFieldIds(explicitId);
    return (
      <FieldShell
        id={id}
        label={label}
        hint={hint}
        hintId={hintId}
        error={error}
        errorId={errorId}
        required={props.required}
        className={fieldClassName}
      >
        <select
          {...props}
          id={id}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(!!error, !!hint, hintId, errorId)}
          className={controlClass(!!error, "appearance-none pr-8")}
        >
          {children}
        </select>
      </FieldShell>
    );
  },
);

export type TextAreaFieldProps = BaseProps &
  React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const TextAreaField = forwardRef<
  HTMLTextAreaElement,
  TextAreaFieldProps
>(function TextAreaField(
  { label, hint, error, fieldClassName, id: explicitId, ...props },
  ref,
) {
  const { id, hintId, errorId } = useFieldIds(explicitId);
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      hintId={hintId}
      error={error}
      errorId={errorId}
      required={props.required}
      className={fieldClassName}
    >
      <textarea
        {...props}
        id={id}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(!!error, !!hint, hintId, errorId)}
        className={controlClass(!!error, "min-h-24 resize-y leading-relaxed")}
      />
    </FieldShell>
  );
});
