
"use client";

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
// WHY: Context hook is no longer needed.
// import { useSettings as useSettingsContextHook } from '@/providers/SettingsProvider';
// WHY: Import the Zustand store directly.
import { useSettingsStore } from '@/store/settingsStore';
import type { Settings } from '@/types'; 

import { ControlPanelSection } from './ControlPanelSection';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

type VisualControlsProps = {
  value: string; // For AccordionItem
};

export function VisualControls({ value }: VisualControlsProps) {
  // WHY: Feature flag logic is removed. Component now always uses Zustand.
  // const useZustand = process.env.NEXT_PUBLIC_USE_ZUSTAND === 'pilot';

  // WHY: Directly select settings from the Zustand store.
  const gamma = useSettingsStore(state => state.gamma);
  const dither = useSettingsStore(state => state.dither);
  const brightCap = useSettingsStore(state => state.brightCap);
  const sceneTransitionActive = useSettingsStore(state => state.sceneTransitionActive);
  const sceneTransitionDuration = useSettingsStore(state => state.sceneTransitionDuration);
  const zustandUpdateSetting = useSettingsStore(state => state.updateSetting);

  // WHY: Remove fallback to context settings.
  // const updateSettingFromStore = useZustand ? useSettingsStore(state => state.updateSetting) : useSettingsContextHook().updateSetting;

  // WHY: Define a consistent handler function for updating settings using Zustand.
  const handleUpdateSetting = <K extends keyof Settings>(key: K, val: Settings[K]) => {
    zustandUpdateSetting(key, val);
  };

  return (
    <ControlPanelSection title="Visual Output" value={value}>
      <div className="space-y-1">
        <Tooltip>
          <TooltipTrigger asChild>
            {/* WHY: Read 'gamma' from Zustand store. */}
            <Label htmlFor="gamma-slider">Gamma ({gamma.toFixed(2)})</Label>
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
          // WHY: Slider value driven by 'gamma' from Zustand store.
          value={[gamma]}
          // WHY: Update 'gamma' using the Zustand update function.
          onValueChange={([val]) => handleUpdateSetting('gamma', val)}
          aria-label={`Gamma: ${gamma.toFixed(2)}`}
        />
      </div>
      <div className="space-y-1">
        <Tooltip>
          <TooltipTrigger asChild>
            {/* WHY: Read 'dither' from Zustand store. */}
            <Label htmlFor="dither-slider">Dither ({dither.toFixed(2)})</Label>
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
          // WHY: Slider value driven by 'dither' from Zustand store.
          value={[dither]}
          // WHY: Update 'dither' using the Zustand update function.
          onValueChange={([val]) => handleUpdateSetting('dither', val)}
          aria-label={`Dither: ${dither.toFixed(2)}`}
        />
      </div>
      <div className="space-y-1">
        <Tooltip>
          <TooltipTrigger asChild>
            {/* WHY: Read 'brightCap' from Zustand store. */}
            <Label htmlFor="brightcap-slider">Brightness Cap ({brightCap.toFixed(2)})</Label>
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
          // WHY: Slider value driven by 'brightCap' from Zustand store.
          value={[brightCap]}
          // WHY: Update 'brightCap' using the Zustand update function.
          onValueChange={([val]) => handleUpdateSetting('brightCap', val)}
          aria-label={`Brightness Cap: ${brightCap.toFixed(2)}`}
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
          // WHY: Switch state driven by 'sceneTransitionActive' from Zustand store.
          checked={sceneTransitionActive}
          // WHY: Update 'sceneTransitionActive' using the Zustand update function.
          onCheckedChange={(checked) => handleUpdateSetting('sceneTransitionActive', checked)}
          aria-label="Toggle Scene Transitions"
        />
      </div>
      {/* WHY: Conditional rendering based on 'sceneTransitionActive' from Zustand. */}
      {sceneTransitionActive && (
        <div className="space-y-1 mt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              {/* WHY: Read 'sceneTransitionDuration' from Zustand store. */}
              <Label htmlFor="transition-duration-slider">Transition Duration ({sceneTransitionDuration}ms)</Label>
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
            // WHY: Slider value driven by 'sceneTransitionDuration' from Zustand store.
            value={[sceneTransitionDuration]}
            // WHY: Update 'sceneTransitionDuration' using the Zustand update function.
            onValueChange={([val]) => handleUpdateSetting('sceneTransitionDuration', val)}
            aria-label={`Scene Transition Duration: ${sceneTransitionDuration} milliseconds`}
          />
        </div>
      )}
    </ControlPanelSection>
  );
}
