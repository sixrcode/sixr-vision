
"use client";

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
// WHY: Import the original useSettings hook for fallback behavior.
import { useSettings as useSettingsContextHook } from '@/providers/SettingsProvider';
// WHY: Import the Zustand store for pilot mode.
import { useSettingsStore } from '@/store/settingsStore';
import type { Settings } from '@/types'; // WHY: For explicit typing of updateSetting.

import { ControlPanelSection } from './ControlPanelSection';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

type VisualControlsProps = {
  value: string; // For AccordionItem
};

export function VisualControls({ value }: VisualControlsProps) {
  // WHY: Determine if we are in 'pilot' mode for Zustand.
  // When 'pilot', this component (and others in this phase) will use Zustand.
  const useZustand = process.env.NEXT_PUBLIC_USE_ZUSTAND === 'pilot';

  // WHY: Conditionally select settings source and update function.
  // This allows the component to use Zustand or fallback to React Context based on the feature flag.
  const gamma = useZustand ? useSettingsStore(state => state.gamma) : useSettingsContextHook().settings.gamma;
  const dither = useZustand ? useSettingsStore(state => state.dither) : useSettingsContextHook().settings.dither;
  const brightCap = useZustand ? useSettingsStore(state => state.brightCap) : useSettingsContextHook().settings.brightCap;
  const sceneTransitionActive = useZustand ? useSettingsStore(state => state.sceneTransitionActive) : useSettingsContextHook().settings.sceneTransitionActive;
  const sceneTransitionDuration = useZustand ? useSettingsStore(state => state.sceneTransitionDuration) : useSettingsContextHook().settings.sceneTransitionDuration;

  const updateSettingFromStore = useZustand ? useSettingsStore(state => state.updateSetting) : useSettingsContextHook().updateSetting;

  // WHY: Create a consistent handler function for updating settings.
  // This abstracts the conditional logic for where the update is sent (Zustand or Context).
  const handleUpdateSetting = <K extends keyof Settings>(key: K, val: Settings[K]) => {
    updateSettingFromStore(key, val);
  };

  return (
    <ControlPanelSection title="Visual Output" value={value}>
      <div className="space-y-1">
        <Tooltip>
          <TooltipTrigger asChild>
            {/* WHY: Read 'gamma' from the determined source (Zustand or Context). */}
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
          // WHY: Slider value is driven by 'gamma' from the determined source.
          value={[gamma]}
          // WHY: Update 'gamma' using the determined update function via handleUpdateSetting.
          onValueChange={([val]) => handleUpdateSetting('gamma', val)}
          aria-label={`Gamma: ${gamma.toFixed(2)}`}
        />
      </div>
      <div className="space-y-1">
        <Tooltip>
          <TooltipTrigger asChild>
            {/* WHY: Read 'dither' from the determined source. */}
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
          // WHY: Slider value is driven by 'dither' from the determined source.
          value={[dither]}
          // WHY: Update 'dither' using the determined update function.
          onValueChange={([val]) => handleUpdateSetting('dither', val)}
          aria-label={`Dither: ${dither.toFixed(2)}`}
        />
      </div>
      <div className="space-y-1">
        <Tooltip>
          <TooltipTrigger asChild>
            {/* WHY: Read 'brightCap' from the determined source. */}
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
          // WHY: Slider value is driven by 'brightCap' from the determined source.
          value={[brightCap]}
          // WHY: Update 'brightCap' using the determined update function.
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
          // WHY: Switch state is driven by 'sceneTransitionActive' from the determined source.
          checked={sceneTransitionActive}
          // WHY: Update 'sceneTransitionActive' using the determined update function.
          onCheckedChange={(checked) => handleUpdateSetting('sceneTransitionActive', checked)}
          aria-label="Toggle Scene Transitions"
        />
      </div>
      {/* WHY: Conditional rendering based on 'sceneTransitionActive' from the determined source. */}
      {sceneTransitionActive && (
        <div className="space-y-1 mt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              {/* WHY: Read 'sceneTransitionDuration' from the determined source. */}
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
            // WHY: Slider value is driven by 'sceneTransitionDuration' from the determined source.
            value={[sceneTransitionDuration]}
            // WHY: Update 'sceneTransitionDuration' using the determined update function.
            onValueChange={([val]) => handleUpdateSetting('sceneTransitionDuration', val)}
            aria-label={`Scene Transition Duration: ${sceneTransitionDuration} milliseconds`}
          />
        </div>
      )}
    </ControlPanelSection>
  );
}
