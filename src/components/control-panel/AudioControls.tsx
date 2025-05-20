
"use client";

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSettings } from '@/providers/SettingsProvider';
import { FFT_SIZES } from '@/lib/constants';
import { ControlPanelSection } from './ControlPanelSection';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type AudioControlsProps = {
  value: string; // For AccordionItem
};

export function AudioControls({ value }: AudioControlsProps) {
  const { settings, updateSetting } = useSettings();

  return (
    <ControlPanelSection title="Audio Engine" value={value}>
      <div className="space-y-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor="fftSize-select">FFT Bins</Label>
          </TooltipTrigger>
          <TooltipContent>
            <p>Number of frequency bands for audio analysis. More bins offer greater detail but may affect performance.</p>
          </TooltipContent>
        </Tooltip>
        <Select
          value={String(settings.fftSize)}
          onValueChange={(val) => updateSetting('fftSize', Number(val) as typeof settings.fftSize)}
        >
          <SelectTrigger id="fftSize-select">
            <SelectValue placeholder="Select FFT size" />
          </SelectTrigger>
          <SelectContent>
            {FFT_SIZES.map(size => (
              <SelectItem key={size} value={String(size)}>{size}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">Controls the resolution of audio frequency analysis.</p>
      </div>

      <div className={cn("space-y-1", settings.enableAgc && "opacity-50 pointer-events-none")}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor="gain-slider" className={cn(settings.enableAgc && "text-[hsl(var(--muted-foreground))]")}>
              Manual Gain ({settings.gain.toFixed(2)}) {settings.enableAgc && "(AGC Active)"}
            </Label>
          </TooltipTrigger>
          <TooltipContent>
            <p>Amplifies or reduces the incoming audio signal level before analysis. Disabled when AGC is active.</p>
          </TooltipContent>
        </Tooltip>
        <Slider
          id="gain-slider"
          min={0}
          max={2}
          step={0.05}
          value={[settings.gain]}
          onValueChange={([val]) => updateSetting('gain', val)}
          disabled={settings.enableAgc}
        />
      </div>
      
      <div className="flex items-center justify-between pt-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor="agc-switch" className="flex-1 min-w-0 mr-2">Automatic Gain Control (AGC)</Label>
          </TooltipTrigger>
          <TooltipContent>
            <p>Automatically adjusts gain to maintain a consistent audio level.</p>
            {settings.enableAgc && <p className="text-xs text-primary">AGC is currently managing audio levels.</p>}
          </TooltipContent>
        </Tooltip>
        <Switch
          id="agc-switch"
          checked={settings.enableAgc}
          onCheckedChange={(checked) => updateSetting('enableAgc', checked)}
          aria-label="Toggle Automatic Gain Control"
        />
      </div>
       <p className="text-xs text-[hsl(var(--muted-foreground))]">
        {settings.enableAgc ? "AGC is active. Manual gain is disabled." : "Adjust gain manually or enable AGC."}
      </p>
    </ControlPanelSection>
  );
}

