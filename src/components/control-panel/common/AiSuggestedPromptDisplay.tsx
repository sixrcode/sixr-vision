
"use client";

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Wand2 } from 'lucide-react'; // Default and alternative icons
import { cn } from '@/lib/utils';

type AiSuggestedPromptDisplayProps = {
  suggestedPrompt: string | undefined | null;
  onUsePrompt: (prompt: string) => void;
  isLoading?: boolean;
  icon?: React.ElementType;
  labelText?: string;
  containerClassName?: string;
  buttonText?: string;
};

export function AiSuggestedPromptDisplay({
  suggestedPrompt,
  onUsePrompt,
  isLoading = false,
  icon: IconComponent = Sparkles, // Default to Sparkles
  labelText = "AI suggestion:",
  containerClassName,
  buttonText = "Use",
}: AiSuggestedPromptDisplayProps) {
  if (!suggestedPrompt) {
    return null;
  }

  return (
    <div className={cn("mt-2 p-2 border border-dashed rounded-md bg-background", containerClassName)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground flex-1 min-w-0">
          <IconComponent className="inline h-3 w-3 mr-1 text-primary/80 shrink-0" />
          {labelText} <em className="text-primary/90 truncate inline-block align-middle max-w-[calc(100%-50px)]">{`"${suggestedPrompt}"`}</em>
        </p>
        <Button
          size="xs"
          variant="outline"
          onClick={() => onUsePrompt(suggestedPrompt)}
          className="px-2 py-1 h-auto text-xs"
          disabled={isLoading}
        >
          {buttonText}
        </Button>
      </div>
    </div>
  );
}
