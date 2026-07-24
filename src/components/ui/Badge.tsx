import { cn } from '../../utils';

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  variant?: 'solid' | 'soft';
  className?: string;
}

export default function Badge({ children, color = '#6366f1', variant = 'soft', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium',
        variant === 'soft' && 'bg-opacity-10',
        className
      )}
      style={{
        backgroundColor: variant === 'soft' ? `${color}15` : color,
        color: variant === 'soft' ? color : 'white',
      }}
    >
      {children}
    </span>
  );
}