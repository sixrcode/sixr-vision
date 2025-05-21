
"use client";

import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Switch, type SwitchProps } from '@/components/ui/switch';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type LabelledSwitchControlProps = {
  labelContent: ReactNode;
  labelHtmlFor: string;
  switchId: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  tooltipContent: ReactNode;
  containerClassName?: string;
  labelClassName?: string;
  switchAriaLabel?: string;
  switchProps?: Omit<SwitchProps, 'id' | 'checked' | 'onCheckedChange' | 'aria-label'>;
};

export function LabelledSwitchControl({
  labelContent,
  labelHtmlFor,
  switchId,
  checked,
  onCheckedChange,
  tooltipContent,
  containerClassName,
  labelClassName,
  switchAriaLabel,
  switchProps,
}: LabelledSwitchControlProps) {
  const effectiveSwitchAriaLabel = switchAriaLabel || (typeof labelContent === 'string' ? labelContent : labelHtmlFor);
  return (
    <div className={cn("group flex items-center justify-between", containerClassName)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Label
            htmlFor={labelHtmlFor}
            className={cn(
              "flex-1 min-w-0 mr-2 cursor-pointer group-hover:text-accent-foreground",
              labelClassName
            )}
          >
            {labelContent}
          </Label>
        </TooltipTrigger>
        <TooltipContent>{tooltipContent}</TooltipContent>
      </Tooltip>
      <Switch
        id={switchId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={effectiveSwitchAriaLabel}
        {...switchProps}
        className={cn(switchProps?.className, "group-hover:ring-1 group-hover:ring-ring/30")}
      />
    </div>
  );
}
