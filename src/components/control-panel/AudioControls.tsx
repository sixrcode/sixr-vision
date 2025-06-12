
"use client";

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// WHY: Import the original useSettings hook for fallback behavior.
import { useSettings as useSettingsContextHook } from '@/providers/SettingsProvider';
// WHY: Import the Zustand store for pilot mode.
import { useSettingsStore } from '@/store/settingsStore';
import type { Settings } from '@/types'; // WHY: For explicit typing of updateSetting.

import { FFT_SIZES } from '@/lib/constants';
import { ControlPanelSection } from './ControlPanelSection';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ControlHint } from './ControlHint';
import { LabelledSwitchControl } from './common/LabelledSwitchControl';
import { AlertTriangle } from 'lucide-react';

const DEFAULT_AUDIO_INPUT_VALUE = "__DEFAULT_AUDIO_INPUT__";

type AudioControlsProps = {
  value: string; // For AccordionItem
  audioInputDevices: MediaDeviceInfo[];
  isAudioToggling: boolean;
};

export function AudioControls({ value, audioInputDevices, isAudioToggling }: AudioControlsProps) {
  // WHY: Determine if we are in 'pilot' mode for Zustand.
  // When 'pilot', this component (and others in this phase) will use Zustand.
  const useZustand = process.env.NEXT_PUBLIC_USE_ZUSTAND === 'pilot';

  // WHY: Conditionally select settings source and update function.
  const selectedAudioInputDeviceId = useZustand ? useSettingsStore(state => state.selectedAudioInputDeviceId) : useSettingsContextHook().settings.selectedAudioInputDeviceId;
  const fftSize = useZustand ? useSettingsStore(state => state.fftSize) : useSettingsContextHook().settings.fftSize;
  const gain = useZustand ? useSettingsStore(state => state.gain) : useSettingsContextHook().settings.gain;
  const enableAgc = useZustand ? useSettingsStore(state => state.enableAgc) : useSettingsContextHook().settings.enableAgc;
  const monitorAudio = useZustand ? useSettingsStore(state => state.monitorAudio) : useSettingsContextHook().settings.monitorAudio;

  const updateSettingFromStore = useZustand ? useSettingsStore(state => state.updateSetting) : useSettingsContextHook().updateSetting;

  // WHY: Create a consistent handler function for updating settings.
  const handleUpdateSetting = <K extends keyof Settings>(key: K, val: Settings[K]) => {
    updateSettingFromStore(key, val);
  };

  const handleDeviceChange = (newDeviceId: string) => {
    if (newDeviceId === DEFAULT_AUDIO_INPUT_VALUE) {
      // WHY: Update 'selectedAudioInputDeviceId' using the determined update function.
      handleUpdateSetting('selectedAudioInputDeviceId', undefined);
    } else {
      handleUpdateSetting('selectedAudioInputDeviceId', newDeviceId);
    }
    // Re-initialization will be handled by ControlPanelView's useEffect
  };

  return (
    <ControlPanelSection title="Audio Engine" value={value}>
      <div className="space-y-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor="audioSource-select">Audio Input Device</Label>
          </TooltipTrigger>
          <TooltipContent>
            <p>Select the microphone or audio source for the visualizer.</p>
            {audioInputDevices.length === 0 && <p className="text-xs text-muted-foreground">No audio input devices found or permission not granted.</p>}
          </TooltipContent>
        </Tooltip>
        <Select
          // WHY: Select value is driven by 'selectedAudioInputDeviceId' from the determined source.
          value={selectedAudioInputDeviceId || DEFAULT_AUDIO_INPUT_VALUE}
          onValueChange={handleDeviceChange}
          disabled={audioInputDevices.length === 0 || isAudioToggling}
        >
          <SelectTrigger id="audioSource-select" aria-label="Select Audio Input Device">
            <SelectValue placeholder="Select an audio source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT_AUDIO_INPUT_VALUE}>Default System Microphone</SelectItem>
            {audioInputDevices
              .filter(device => device.deviceId) 
              .map(device => (
              <SelectItem key={device.deviceId} value={device.deviceId}>
                {device.label || `Device (${device.deviceId.substring(0, 8)}...)`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ControlHint>Changes take effect when audio is (re)started.</ControlHint>
      </div>

      <div className="space-y-1 mt-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor="fftSize-select">FFT Bins</Label>
          </TooltipTrigger>
          <TooltipContent>
            <p>Number of frequency bands for audio analysis. More bins offer greater detail but may affect performance.</p>
          </TooltipContent>
        </Tooltip>
        <Select
          // WHY: Select value is driven by 'fftSize' from the determined source.
          value={String(fftSize)}
          // WHY: Update 'fftSize' using the determined update function. Cast to number type.
          onValueChange={(val) => handleUpdateSetting('fftSize', Number(val) as typeof fftSize)}
          disabled={isAudioToggling}
        >
          <SelectTrigger id="fftSize-select" aria-label={`Select FFT Bins, current value ${fftSize}`}>
            <SelectValue placeholder="Select FFT size" />
          </SelectTrigger>
          <SelectContent>
            {FFT_SIZES.map(size => (
              <SelectItem key={size} value={String(size)}>{size}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ControlHint>Controls the resolution of audio frequency analysis.</ControlHint>
      </div>

      {/* WHY: Conditional styling based on 'enableAgc' from the determined source. */}
      <div className={cn("space-y-1 mt-3", enableAgc && "opacity-50 pointer-events-none")}>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* WHY: Read 'gain' and 'enableAgc' from the determined source. */}
            <Label htmlFor="gain-slider" className={cn(enableAgc && "text-muted-foreground")}>
              Manual Gain ({gain.toFixed(2)}) {enableAgc && "(AGC Active)"}
            </Label>
          </TooltipTrigger>
          <TooltipContent>
            <p>Amplifies or reduces the incoming audio signal level before analysis. Disabled when AGC is active.</p>
          </TooltipContent>
        </Tooltip>
        <Slider
          id="gain-slider"
          min={0}
          max={2}
          step={0.05}
          // WHY: Slider value is driven by 'gain' from the determined source.
          value={[gain]}
          // WHY: Update 'gain' using the determined update function.
          onValueChange={([val]) => handleUpdateSetting('gain', val)}
          // WHY: Disabled state based on 'enableAgc' from the determined source.
          disabled={enableAgc || isAudioToggling}
          aria-label={`Manual Gain: ${gain.toFixed(2)}${enableAgc ? ". Automatic Gain Control is Active." : ""}`}
        />
      </div>
      
      <LabelledSwitchControl
        labelContent="Automatic Gain Control (AGC)"
        labelHtmlFor="agc-switch"
        switchId="agc-switch"
        // WHY: Switch state is driven by 'enableAgc' from the determined source.
        checked={enableAgc}
        // WHY: Update 'enableAgc' using the determined update function.
        onCheckedChange={(checked) => handleUpdateSetting('enableAgc', checked)}
        tooltipContent={<>
          <p>Automatically adjusts gain to maintain a consistent audio level.</p>
          {/* WHY: Conditional text based on 'enableAgc' from the determined source. */}
          {enableAgc && <p className="text-xs text-primary">AGC is currently managing audio levels.</p>}
        </>}
        containerClassName="pt-2"
        switchAriaLabel="Toggle Automatic Gain Control"
        switchProps={{ disabled: isAudioToggling }}
      />
       <ControlHint>
        {/* WHY: Conditional hint based on 'enableAgc' from the determined source. */}
        {enableAgc ? "AGC is active. Manual gain is disabled." : "Adjust gain manually or enable AGC."}
      </ControlHint>

      <div className="mt-4">
        <LabelledSwitchControl
          labelContent="Monitor Audio (Playback to Speakers)"
          labelHtmlFor="monitor-audio-switch"
          switchId="monitor-audio-switch"
          // WHY: Switch state is driven by 'monitorAudio' from the determined source.
          checked={monitorAudio}
          // WHY: Update 'monitorAudio' using the determined update function.
          onCheckedChange={(checked) => handleUpdateSetting('monitorAudio', checked)}
          tooltipContent={
            <div className="space-y-1">
              <p className="flex items-center text-destructive">
                <AlertTriangle className="mr-1.5 h-4 w-4 shrink-0" /> WARNING: Feedback Loop!
              </p>
              <p>Enabling this plays microphone input through your speakers. Lower speaker volume before enabling to avoid loud feedback/howling.</p>
            </div>
          }
          containerClassName="pt-2"
          switchAriaLabel="Toggle audio monitoring to speakers"
          switchProps={{ disabled: isAudioToggling }}
        />
        <ControlHint>Hear what the microphone is picking up. Use with caution!</ControlHint>
      </div>
    </ControlPanelSection>
  );
}
