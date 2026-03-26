import { ReactNode } from "react";

interface CardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function Card({ title, description, children, action, className = "" }: CardProps) {
  return (
    <div className={`rounded-xl border border-border bg-card shadow-sm overflow-hidden ${className}`}>
      {(title || description || action) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gray-50/50">
          <div>
            {title && <h3 className="text-lg font-semibold text-primary">{title}</h3>}
            {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}
