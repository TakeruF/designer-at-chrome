import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'icon';
}

export function Button({ variant = 'secondary', className = '', ...props }: ButtonProps) {
  return <button className={`button button--${variant} ${className}`.trim()} {...props} />;
}

interface AccordionProps extends PropsWithChildren {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  badge?: ReactNode;
}

export function Accordion({
  title,
  description,
  defaultOpen = false,
  badge,
  children,
}: AccordionProps) {
  return (
    <details className="accordion" open={defaultOpen}>
      <summary>
        <span>
          <strong>{title}</strong>
          {description ? <small>{description}</small> : null}
        </span>
        {badge}
      </summary>
      <div className="accordion__content">{children}</div>
    </details>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state__mark" aria-hidden="true" />
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function Notice({
  tone = 'neutral',
  children,
}: PropsWithChildren<{ tone?: 'neutral' | 'error' | 'success' }>) {
  return <div className={`notice notice--${tone}`}>{children}</div>;
}
