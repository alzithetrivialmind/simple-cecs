"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface RadioGroupContextType {
  value?: string;
  onValueChange?: (value: string) => void;
  name?: string;
}

const RadioGroupContext = React.createContext<RadioGroupContextType>({});

export interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
}

export function RadioGroup({
  className,
  value: controlledValue,
  defaultValue,
  onValueChange,
  name,
  children,
  ...props
}: RadioGroupProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : uncontrolledValue;

  const handleValueChange = React.useCallback(
    (val: string) => {
      if (!isControlled) {
        setUncontrolledValue(val);
      }
      onValueChange?.(val);
    },
    [isControlled, onValueChange]
  );

  const contextValue = React.useMemo(
    () => ({
      value: currentValue,
      onValueChange: handleValueChange,
      name,
    }),
    [currentValue, handleValueChange, name]
  );

  return (
    <RadioGroupContext.Provider value={contextValue}>
      <div className={cn("grid gap-2", className)} role="radiogroup" {...props}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

export interface RadioGroupItemProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
}

export const RadioGroupItem = React.forwardRef<
  HTMLInputElement,
  RadioGroupItemProps
>(({ className, value, id, ...props }, ref) => {
  const context = React.useContext(RadioGroupContext);
  const isChecked = context.value === value;

  return (
    <input
      type="radio"
      ref={ref}
      id={id}
      name={context.name}
      value={value}
      checked={isChecked}
      data-state={isChecked ? "checked" : "unchecked"}
      onChange={() => context.onValueChange?.(value)}
      className={cn(
        "aspect-square h-4 w-4 rounded-full border border-primary text-primary shadow focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});
RadioGroupItem.displayName = "RadioGroupItem";
