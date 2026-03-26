import { ReactNode } from "react";

interface CardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Card({ title, description, children, action, className = "", noPadding = false }: CardProps) {
  return (
    <div className={`rounded-2xl border border-border bg-card shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md ${className}`}>
      {(title || description || action) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div>
            {title && <h3 className="text-base font-semibold text-primary tracking-tight">{title}</h3>}
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={noPadding ? "" : "p-6"}>{children}</div>
    </div>
  );
}
