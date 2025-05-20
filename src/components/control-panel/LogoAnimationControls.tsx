
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
  const { logoAnimationSettings, logoOpacity } = settings;

  const handleAnimationSettingChange = <K extends keyof typeof logoAnimationSettings>(
    key: K,
    val: (typeof logoAnimationSettings)[K]
  ) => {
    updateSetting('logoAnimationSettings', { ...logoAnimationSettings, [key]: val });
  };

  const currentAnimType = logoAnimationSettings.type;

  return (
    <ControlPanelSection title="Logo & Watermark Animation" value={value}>
      <div className="space-y-3">
        <Label htmlFor="logoopacity-slider">Overall Opacity ({logoOpacity.toFixed(2)})</Label>
        <Slider
          id="logoopacity-slider"
          min={0}
          max={1}
          step={0.01}
          value={[logoOpacity]}
          onValueChange={([val]) => updateSetting('logoOpacity', val)}
        />
      </div>

      <div className="space-y-3 mt-4">
        <Label htmlFor="logo-animation-type-select">Animation Type</Label>
        <Select
          value={logoAnimationSettings.type}
          onValueChange={(val) => handleAnimationSettingChange('type', val as LogoAnimationType)}
        >
          <SelectTrigger id="logo-animation-type-select">
            <SelectValue placeholder="Select animation type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="solid">Solid Color</SelectItem>
            <SelectItem value="blink">Blink</SelectItem>
            <SelectItem value="pulse">Pulse</SelectItem>
            <SelectItem value="rainbowCycle">Rainbow Cycle</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(currentAnimType === 'solid' || currentAnimType === 'blink') && (
        <div className="space-y-3 mt-3">
          <Label htmlFor="logo-animation-color">Color</Label>
          <Input
            id="logo-animation-color"
            type="color"
            value={logoAnimationSettings.color}
            onChange={(e) => handleAnimationSettingChange('color', e.target.value)}
            className="h-10"
          />
        </div>
      )}

      {(currentAnimType === 'blink' || currentAnimType === 'pulse' || currentAnimType === 'rainbowCycle') && (
        <div className="space-y-3 mt-3">
          <Label htmlFor="logo-animation-speed-slider">
            Speed ({logoAnimationSettings.speed.toFixed(1)})
          </Label>
          <Slider
            id="logo-animation-speed-slider"
            min={0.2}
            max={3}
            step={0.1}
            value={[logoAnimationSettings.speed]}
            onValueChange={([val]) => handleAnimationSettingChange('speed', val)}
          />
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {currentAnimType === 'blink' ? 'Higher is faster blinking.' :
             currentAnimType === 'pulse' ? 'Higher is faster pulsing.' :
             currentAnimType === 'rainbowCycle' ? 'Higher is faster color cycling.' : ''}
          </p>
        </div>
      )}
       <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">More animations (Chase, Sparkle, etc.) are placeholders.</p>
    </ControlPanelSection>
  );
}
