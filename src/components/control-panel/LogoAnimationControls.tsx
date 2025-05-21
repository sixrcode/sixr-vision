
"use client";

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useSettings } from '@/providers/SettingsProvider';
import type { LogoAnimationType } from '@/types';
import { ControlPanelSection } from './ControlPanelSection';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ControlHint } from './ControlHint';

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
      <div className="space-y-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor="logoopacity-slider">Overall Opacity ({logoOpacity.toFixed(2)})</Label>
          </TooltipTrigger>
          <TooltipContent>
            <p>Controls the maximum visibility of all logo and watermark elements.</p>
          </TooltipContent>
        </Tooltip>
        <Slider
          id="logoopacity-slider"
          min={0}
          max={1}
          step={0.01}
          value={[logoOpacity]}
          onValueChange={([val]) => updateSetting('logoOpacity', val)}
        />
      </div>

      <div className="space-y-1 mt-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor="logo-animation-type-select">Animation Type</Label>
          </TooltipTrigger>
          <TooltipContent>
            <p>Selects the style of animation for the logo elements.</p>
          </TooltipContent>
        </Tooltip>
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
        <div className="space-y-1 mt-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Label htmlFor="logo-animation-color">Color</Label>
            </TooltipTrigger>
            <TooltipContent>
              <p>Sets the color for 'Solid' or 'Blink' animations.</p>
            </TooltipContent>
          </Tooltip>
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
        <div className="space-y-1 mt-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Label htmlFor="logo-animation-speed-slider">
                Speed ({logoAnimationSettings.speed.toFixed(1)})
              </Label>
            </TooltipTrigger>
            <TooltipContent>
              <p>Adjusts the speed of 'Blink', 'Pulse', or 'Rainbow Cycle' animations.</p>
            </TooltipContent>
          </Tooltip>
          <Slider
            id="logo-animation-speed-slider"
            min={0.2}
            max={3}
            step={0.1}
            value={[logoAnimationSettings.speed]}
            onValueChange={([val]) => handleAnimationSettingChange('speed', val)}
          />
          <ControlHint>
            {currentAnimType === 'blink' ? 'Higher is faster blinking.' :
             currentAnimType === 'pulse' ? 'Higher is faster pulsing.' :
             currentAnimType === 'rainbowCycle' ? 'Higher is faster color cycling.' : ''}
          </ControlHint>
        </div>
      )}
       <ControlHint className="mt-2">More animations (Chase, Sparkle, etc.) are placeholders.</ControlHint>
    </ControlPanelSection>
  );
}
