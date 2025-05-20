
"use client";

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useSettings } from '@/providers/SettingsProvider';
import { ControlPanelSection } from './ControlPanelSection';

type VisualControlsProps = {
  value: string; // For AccordionItem
};

export function VisualControls({ value }: VisualControlsProps) {
  const { settings, updateSetting } = useSettings();

  return (
    <ControlPanelSection title="Visual Output" value={value}>
      <div className="space-y-3">
        <Label htmlFor="gamma-slider">Gamma ({settings.gamma.toFixed(2)})</Label>
        <Slider
          id="gamma-slider"
          min={0.1}
          max={3}
          step={0.05}
          value={[settings.gamma]}
          onValueChange={([val]) => updateSetting('gamma', val)}
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
          onValueChange={([val]) => updateSetting('dither', val)}
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
          onValueChange={([val]) => updateSetting('brightCap', val)}
        />
      </div>
    </ControlPanelSection>
  );
}

