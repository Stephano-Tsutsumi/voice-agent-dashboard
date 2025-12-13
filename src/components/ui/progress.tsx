import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  variant?: "default" | "success" | "warning" | "destructive";
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, variant, ...props }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    
    const getColorClass = () => {
      if (variant) {
        const variants = {
          default: "bg-primary",
          success: "bg-green-500",
          warning: "bg-orange-500",
          destructive: "bg-red-500",
        };
        return variants[variant];
      }
      // Auto-detect based on value
      if (value >= 80) return "bg-green-500";
      if (value >= 50) return "bg-orange-500";
      return "bg-red-500";
    };
    
    return (
      <div
        ref={ref}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
          className
        )}
        {...props}
      >
        <div
          className={cn("h-full w-full flex-1 transition-all", getColorClass())}
          style={{ transform: `translateX(-${100 - percentage}%)` }}
        />
      </div>
    );
  }
);
Progress.displayName = "Progress";

export { Progress };

