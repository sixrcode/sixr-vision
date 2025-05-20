
"use client";

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useSettings } from '@/providers/SettingsProvider';
import type { LogoAnimationType } from '@/types';
import { ControlPanelSection } from './ControlPanelSection';

type LogoAnimationControlsProps = {
  value: string; // For AccordionItem
};

export function LogoAnimationControls({ value }: LogoAnimationControlsProps) {
  const { settings, updateSetting } = useSettings();
  const { logoAnimationSettings } = settings;

  const handleSettingChange = <K extends keyof typeof logoAnimationSettings>(
    key: K,
    val: (typeof logoAnimationSettings)[K]
  ) => {
    updateSetting('logoAnimationSettings', { ...logoAnimationSettings, [key]: val });
  };

  return (
    <ControlPanelSection title="Logo & Watermark Animation" value={value}>
      <div className="space-y-3">
        <Label htmlFor="logo-animation-type-select">Animation Type</Label>
        <Select
          value={logoAnimationSettings.type}
          onValueChange={(val) => handleSettingChange('type', val as LogoAnimationType)}
        >
          <SelectTrigger id="logo-animation-type-select">
            <SelectValue placeholder="Select animation type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="solid">Solid Color</SelectItem>
            <SelectItem value="blink">Blink</SelectItem>
            <SelectItem value="pulse">Pulse</SelectItem>
            {/* <SelectItem value="rainbowCycle">Rainbow Cycle</SelectItem> */}
          </SelectContent>
        </Select>
      </div>

      {(logoAnimationSettings.type === 'solid' || logoAnimationSettings.type === 'blink') && (
        <div className="space-y-3 mt-3">
          <Label htmlFor="logo-animation-color">Color</Label>
          <Input
            id="logo-animation-color"
            type="color"
            value={logoAnimationSettings.color}
            onChange={(e) => handleSettingChange('color', e.target.value)}
            className="h-10" // Ensure consistent height with other inputs
          />
        </div>
      )}

      {(logoAnimationSettings.type === 'blink' || logoAnimationSettings.type === 'pulse') && (
        <div className="space-y-3 mt-3">
          <Label htmlFor="logo-animation-speed-slider">
            Speed ({logoAnimationSettings.speed.toFixed(1)})
          </Label>
          <Slider
            id="logo-animation-speed-slider"
            min={0.2} // Slower
            max={3}   // Faster
            step={0.1}
            value={[logoAnimationSettings.speed]}
            onValueChange={([val]) => handleSettingChange('speed', val)}
          />
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {logoAnimationSettings.type === 'blink' ? 'Higher is faster blinking.' : 'Higher is faster pulsing.'}
          </p>
        </div>
      )}
       <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">More animations (Rainbow Cycle, Chase, etc.) are placeholders.</p>
    </ControlPanelSection>
  );
}
