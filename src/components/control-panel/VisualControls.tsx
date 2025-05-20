"use client";

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useSettings } from '@/providers/SettingsProvider';
import { ControlPanelSection } from './ControlPanelSection';

export function VisualControls() {
  const { settings, updateSetting } = useSettings();

  return (
    <ControlPanelSection title="Visual Output">
      <div className="space-y-3">
        <Label htmlFor="gamma-slider">Gamma ({settings.gamma.toFixed(2)})</Label>
        <Slider
          id="gamma-slider"
          min={0.1}
          max={3}
          step={0.05}
          value={[settings.gamma]}
          onValueChange={([value]) => updateSetting('gamma', value)}
        />
      </div>
      <div className="space-y-3">
        <Label htmlFor="dither-slider">Dither ({settings.dither.toFixed(2)})</Label>
        <Slider
          id="dither-slider"
          min={0}
          max={1}
          step={0.01}
          value={[settings.dither]}
          onValueChange={([value]) => updateSetting('dither', value)}
        />
      </div>
      <div className="space-y-3">
        <Label htmlFor="brightcap-slider">Brightness Cap ({settings.brightCap.toFixed(2)})</Label>
        <Slider
          id="brightcap-slider"
          min={0}
          max={1}
          step={0.01}
          value={[settings.brightCap]}
          onValueChange={([value]) => updateSetting('brightCap', value)}
        />
      </div>
      <div className="space-y-3">
        <Label htmlFor="logoopacity-slider">Logo Opacity ({settings.logoOpacity.toFixed(2)})</Label>
        <Slider
          id="logoopacity-slider"
          min={0}
          max={1}
          step={0.01}
          value={[settings.logoOpacity]}
          onValueChange={([value]) => updateSetting('logoOpacity', value)}
        />
      </div>
    </ControlPanelSection>
  );
}
