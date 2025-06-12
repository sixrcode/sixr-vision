
"use client";

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
// WHY: Import the original useSettings hook for fallback.
import { useSettings as useSettingsContextHook } from '@/providers/SettingsProvider';
// WHY: Import the Zustand store for conditional usage.
import { useSettingsStore } from '@/store/settingsStore';
import type { LogoAnimationType, LogoAnimationSettings } from '@/types';
import { ControlPanelSection } from './ControlPanelSection';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ControlHint } from './ControlHint';

type LogoAnimationControlsProps = {
  value: string; // For AccordionItem
};

export function LogoAnimationControls({ value }: LogoAnimationControlsProps) {
  // WHY: Feature flag to determine data source.
  const useZustand = process.env.NEXT_PUBLIC_USE_ZUSTAND === 'bundle-a';

  // Zustand state and actions
  const logoOpacityFromStore = useSettingsStore(state => state.logoOpacity);
  const logoAnimationSettingsFromStore = useSettingsStore(state => state.logoAnimationSettings);
  const zustandUpdateSetting = useSettingsStore(state => state.updateSetting);
  const zustandUpdateLogoAnimationSetting = useSettingsStore(state => state.updateLogoAnimationSetting);

  // Context state and actions (fallback)
  const { settings: contextSettings, updateSetting: contextUpdateSetting } = useSettingsContextHook();

  // Determine current values based on feature flag
  const logoOpacity = useZustand ? logoOpacityFromStore : contextSettings.logoOpacity;
  const logoAnimationSettings = useZustand ? logoAnimationSettingsFromStore : contextSettings.logoAnimationSettings;

  const handleOpacityChange = (val: number) => {
    if (useZustand) {
      zustandUpdateSetting('logoOpacity', val);
    } else {
      contextUpdateSetting('logoOpacity', val);
    }
  };

  const handleAnimationSettingChange = <K extends keyof LogoAnimationSettings>(
    key: K,
    val: LogoAnimationSettings[K]
  ) => {
    if (useZustand) {
      zustandUpdateLogoAnimationSetting(key, val);
    } else {
      // Context doesn't have a dedicated logo animation setting updater,
      // so we update the whole logoAnimationSettings object.
      contextUpdateSetting('logoAnimationSettings', { ...logoAnimationSettings, [key]: val });
    }
  };
  
  const currentAnimType = logoAnimationSettings.type;

  return (
    <ControlPanelSection title="Logo & Watermark Animation" value={value}>
      <div className="space-y-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor="logoopacity-slider">Overall Opacity ({logoOpacity.toFixed(2)})</Label>
          </TooltipTrigger>
 <TooltipContent><p>Controls the maximum visibility of all logo and watermark elements.</p>
            <p>Controls the maximum visibility of all logo and watermark elements.</p>
          </TooltipContent>
        </Tooltip>
        <Slider
          id="logoopacity-slider"
          min={0}
          max={1}
          step={0.01}
          value={[logoOpacity]}
          onValueChange={([val]) => handleOpacityChange(val)}
          aria-label={`Overall Logo Opacity: ${logoOpacity.toFixed(2)}`}
        />
      </div>

      <div className="space-y-1 mt-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor="logo-animation-type-select">Animation Type</Label>
          </TooltipTrigger>
 <TooltipContent><p>Selects the style of animation for the logo elements.</p>
            <p>Selects the style of animation for the logo elements.</p>
          </TooltipContent>
        </Tooltip>
        <Select
          value={logoAnimationSettings.type}
          onValueChange={(val) => handleAnimationSettingChange('type', val as LogoAnimationType)}
        >
          <SelectTrigger id="logo-animation-type-select" aria-label={`Select Logo Animation Type, current value ${logoAnimationSettings.type}`}>
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
 <TooltipContent><p>Sets the color for &apos;Solid&apos; or &apos;Blink&apos; animations.</p>
              <p>Sets the color for 'Solid' or 'Blink' animations.</p>
            </TooltipContent>
          </Tooltip>
          <Input
            id="logo-animation-color"
            type="color"
            value={logoAnimationSettings.color}
            onChange={(e) => handleAnimationSettingChange('color', e.target.value)}
            className="h-10"
            aria-label={`Logo Animation Color, current value ${logoAnimationSettings.color}`}
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
 <TooltipContent><p>Adjusts the speed of &apos;Blink&apos;, &apos;Pulse&apos;, or &apos;Rainbow Cycle&apos; animations.</p>
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
            aria-label={`Logo Animation Speed: ${logoAnimationSettings.speed.toFixed(1)}`}
          />
          <ControlHint>
 {currentAnimType === &apos;blink&apos; ? &apos;Higher is faster blinking.&apos; : currentAnimType === &apos;pulse&apos; ? &apos;Higher is faster pulsing.&apos; : currentAnimType === &apos;rainbowCycle&apos; ? &apos;Higher is faster color cycling.&apos; : &apos;&apos;}
          </ControlHint>
        </div>
      )}
 <ControlHint className="mt-2">{`More animations (Chase, Sparkle, etc.) are placeholders.`}</ControlHint>
    </ControlPanelSection>
  );
}
