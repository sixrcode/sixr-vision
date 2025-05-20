
"use client";

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/providers/SettingsProvider';
import { ControlPanelSection } from './ControlPanelSection';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

type VisualControlsProps = {
  value: string; // For AccordionItem
};

export function VisualControls({ value }: VisualControlsProps) {
  const { settings, updateSetting } = useSettings();

  return (
    <ControlPanelSection title="Visual Output" value={value}>
      <div className="space-y-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor="gamma-slider">Gamma ({settings.gamma.toFixed(2)})</Label>
          </TooltipTrigger>
          <TooltipContent>
            <p>Adjusts the brightness curve. Higher values make mid-tones brighter.</p>
          </TooltipContent>
        </Tooltip>
        <Slider
          id="gamma-slider"
          min={0.1}
          max={3}
          step={0.05}
          value={[settings.gamma]}
          onValueChange={([val]) => updateSetting('gamma', val)}
        />
      </div>
      <div className="space-y-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor="dither-slider">Dither ({settings.dither.toFixed(2)})</Label>
          </TooltipTrigger>
          <TooltipContent>
            <p>Adds noise to reduce color banding, creating smoother gradients. (Effect depends on scene implementation)</p>
          </TooltipContent>
        </Tooltip>
        <Slider
          id="dither-slider"
          min={0}
          max={1}
          step={0.01}
          value={[settings.dither]}
          onValueChange={([val]) => updateSetting('dither', val)}
        />
      </div>
      <div className="space-y-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor="brightcap-slider">Brightness Cap ({settings.brightCap.toFixed(2)})</Label>
          </TooltipTrigger>
          <TooltipContent>
            <p>Limits the maximum overall brightness of the visualizer output.</p>
          </TooltipContent>
        </Tooltip>
        <Slider
          id="brightcap-slider"
          min={0}
          max={1}
          step={0.01}
          value={[settings.brightCap]}
          onValueChange={([val]) => updateSetting('brightCap', val)}
        />
      </div>
      <div className="flex items-center justify-between mt-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor="scene-transition-switch" className="flex-1 min-w-0 mr-2">Enable Scene Transitions</Label>
          </TooltipTrigger>
          <TooltipContent>
            <p>Enables a smooth crossfade effect when switching between visualizer scenes.</p>
          </TooltipContent>
        </Tooltip>
        <Switch
          id="scene-transition-switch"
          checked={settings.sceneTransitionActive}
          onCheckedChange={(checked) => updateSetting('sceneTransitionActive', checked)}
        />
      </div>
      {settings.sceneTransitionActive && (
        <div className="space-y-1 mt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Label htmlFor="transition-duration-slider">Transition Duration ({settings.sceneTransitionDuration}ms)</Label>
            </TooltipTrigger>
            <TooltipContent>
              <p>Controls how long the crossfade transition between scenes takes, in milliseconds.</p>
            </TooltipContent>
          </Tooltip>
          <Slider
            id="transition-duration-slider"
            min={0}
            max={2000}
            step={50}
            value={[settings.sceneTransitionDuration]}
            onValueChange={([val]) => updateSetting('sceneTransitionDuration', val)}
          />
        </div>
      )}
    </ControlPanelSection>
  );
}
