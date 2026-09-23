import * as React from "react";
import { AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";

export type FormGroupProps = React.HTMLAttributes<HTMLDivElement>;

export function FormGroup({ className, ...props }: FormGroupProps) {
  return <div className={cn("space-y-1.5", className)} {...props} />;
}

export interface FormLabelProps extends React.ComponentPropsWithoutRef<typeof Label> {
  required?: boolean;
}

export function FormLabel({ className, required, children, ...props }: FormLabelProps) {
  return (
    <Label className={cn("text-sm font-medium text-foreground", className)} {...props}>
      {children}
      {required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
    </Label>
  );
}

export type FormDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;

export function FormDescription({ className, ...props }: FormDescriptionProps) {
  return <p className={cn("text-xs text-muted-foreground leading-normal", className)} {...props} />;
}

export interface FormMessageProps extends React.HTMLAttributes<HTMLParagraphElement> {
  error?: boolean;
}

export function FormMessage({ className, error, children, ...props }: FormMessageProps) {
  if (!children) return null;

  return (
    <p
      role={error ? "alert" : undefined}
      className={cn(
        "text-xs leading-normal flex items-center gap-1",
        error ? "text-destructive font-medium" : "text-muted-foreground",
        className
      )}
      {...props}
    >
      {error && <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      <span>{children}</span>
    </p>
  );
}

export type FormErrorProps = React.HTMLAttributes<HTMLParagraphElement>;

export function FormError({ className, children, ...props }: FormErrorProps) {
  if (!children) return null;

  return (
    <FormMessage error className={className} {...props}>
      {children}
    </FormMessage>
  );
}
