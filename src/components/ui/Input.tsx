import { forwardRef } from 'react';
import { cn } from '../../utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-text-primary">{label}</label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              'w-full px-3.5 py-2.5 text-sm rounded-xl border border-border-theme bg-bg-surface text-text-primary placeholder:text-text-muted transition-all duration-150',
              'focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent',
              'hover:border-border-theme',
              icon && 'pl-10',
              error && 'border-danger-theme focus:ring-danger-theme/20 focus:border-danger-theme',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-danger-theme">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;