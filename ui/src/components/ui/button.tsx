import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Arcade button. Visual states live in CSS (`.arcade-btn*`). Variants here
 * just compose the right modifier classes.
 */
const buttonVariants = cva('arcade-btn', {
  variants: {
    variant: {
      default: '',
      destructive: 'arcade-btn-danger',
      outline: 'arcade-btn-outline',
      secondary: 'arcade-btn-outline',
      ghost: 'arcade-btn-ghost',
      link: 'arcade-btn-ghost underline underline-offset-4',
    },
    size: {
      default: '',
      sm: 'arcade-btn-sm',
      lg: 'text-base px-5 py-2.5',
      icon: 'h-9 w-9 p-0',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
