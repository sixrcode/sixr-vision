
"use client";

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSettings } from '@/providers/SettingsProvider';
import { FFT_SIZES } from '@/lib/constants';
import { ControlPanelSection } from './ControlPanelSection';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ControlHint } from './ControlHint';
import { LabelledSwitchControl } from './common/LabelledSwitchControl';
import { AlertTriangle } from 'lucide-react';


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
          <SelectTrigger id="fftSize-select" aria-label="Select FFT Bins">
            <SelectValue placeholder="Select FFT size" />
          </SelectTrigger>
          <SelectContent>
            {FFT_SIZES.map(size => (
              <SelectItem key={size} value={String(size)}>{size}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ControlHint>Controls the resolution of audio frequency analysis.</ControlHint>
      </div>

      <div className={cn("space-y-1", settings.enableAgc && "opacity-50 pointer-events-none")}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor="gain-slider" className={cn(settings.enableAgc && "text-muted-foreground")}>
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
          aria-label={`Manual Gain: ${settings.gain.toFixed(2)}${settings.enableAgc ? " (AGC Active)" : ""}`}
        />
      </div>
      
      <LabelledSwitchControl
        labelContent="Automatic Gain Control (AGC)"
        labelHtmlFor="agc-switch"
        switchId="agc-switch"
        checked={settings.enableAgc}
        onCheckedChange={(checked) => updateSetting('enableAgc', checked)}
        tooltipContent={<>
          <p>Automatically adjusts gain to maintain a consistent audio level.</p>
          {settings.enableAgc && <p className="text-xs text-primary">AGC is currently managing audio levels.</p>}
        </>}
        containerClassName="pt-2"
        switchAriaLabel="Toggle Automatic Gain Control"
      />
       <ControlHint>
        {settings.enableAgc ? "AGC is active. Manual gain is disabled." : "Adjust gain manually or enable AGC."}
      </ControlHint>

      <div className="mt-4">
        <LabelledSwitchControl
          labelContent="Monitor Audio (Playback to Speakers)"
          labelHtmlFor="monitor-audio-switch"
          switchId="monitor-audio-switch"
          checked={settings.monitorAudio}
          onCheckedChange={(checked) => updateSetting('monitorAudio', checked)}
          tooltipContent={
            <div className="space-y-1">
              <p className="flex items-center text-destructive">
                <AlertTriangle className="mr-1.5 h-4 w-4 shrink-0" /> WARNING: Feedback Loop!
              </p>
              <p>Enabling this plays microphone input through your speakers. Lower speaker volume before enabling to avoid loud feedback/howling.</p>
            </div>
          }
          containerClassName="pt-2"
          switchAriaLabel="Toggle audio monitoring to speakers"
        />
        <ControlHint>Hear what the microphone is picking up. Use with caution!</ControlHint>
      </div>
    </ControlPanelSection>
  );
}
