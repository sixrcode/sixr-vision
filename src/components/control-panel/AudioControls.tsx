
"use client";

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSettings } from '@/providers/SettingsProvider';
import { FFT_SIZES } from '@/lib/constants';
import { ControlPanelSection } from './ControlPanelSection';

type AudioControlsProps = {
  value: string; // For AccordionItem
};

export function AudioControls({ value }: AudioControlsProps) {
  const { settings, updateSetting } = useSettings();

  return (
    <ControlPanelSection title="Audio Engine" value={value}>
      <div className="space-y-3">
        <Label htmlFor="fftSize-select">FFT Bins</Label>
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
      </div>

      <div className="space-y-3">
        <Label htmlFor="gain-slider">Gain ({settings.gain.toFixed(2)})</Label>
        <Slider
          id="gain-slider"
          min={0}
          max={2}
          step={0.05}
          value={[settings.gain]}
          onValueChange={([val]) => updateSetting('gain', val)}
        />
      </div>
      
      <div className="flex items-center justify-between space-y-1">
        <Label htmlFor="agc-switch" className="flex-1 min-w-0 mr-2">Automatic Gain Control (AGC)</Label>
        <Switch
          id="agc-switch"
          checked={settings.enableAgc}
          onCheckedChange={(checked) => updateSetting('enableAgc', checked)}
          aria-label="Toggle Automatic Gain Control"
        />
      </div>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">Note: AGC functionality is a placeholder.</p>
    </ControlPanelSection>
  );
}
