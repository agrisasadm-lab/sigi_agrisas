import { ButtonHTMLAttributes } from "react";
import { cn } from "../../../_lib/cn";
import { Icon } from "../Icon/Icon";
import type { IconName } from "../Icon/icons";

type Variant = "filled" | "tonal" | "ghost";

interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  icon: IconName;
  ariaLabel: string;
  variant?: Variant;
  iconSize?: number;
}

const variantClasses: Record<Variant, string> = {
  filled: "bg-primary text-on-primary hover:shadow-md",
  tonal: "bg-surface-container-high text-on-surface hover:bg-surface-container-highest",
  ghost: "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
};

export function IconButton({
  icon,
  ariaLabel,
  variant = "ghost",
  iconSize,
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center justify-center rounded-full p-2 transition-colors duration-200",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      <Icon name={icon} size={iconSize} />
    </button>
  );
}
