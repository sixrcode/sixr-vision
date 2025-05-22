
"use client";

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSettings } from '@/providers/SettingsProvider';
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
  const { settings, updateSetting } = useSettings();

  const handleDeviceChange = (newDeviceId: string) => {
    if (newDeviceId === DEFAULT_AUDIO_INPUT_VALUE) {
      updateSetting('selectedAudioInputDeviceId', undefined);
    } else {
      updateSetting('selectedAudioInputDeviceId', newDeviceId);
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
          value={settings.selectedAudioInputDeviceId || DEFAULT_AUDIO_INPUT_VALUE}
          onValueChange={handleDeviceChange}
          disabled={audioInputDevices.length === 0 || isAudioToggling}
        >
          <SelectTrigger id="audioSource-select" aria-label="Select Audio Input Device">
            {/* SelectValue will display the selected item's children. Placeholder is a fallback. */}
            <SelectValue placeholder="Select an audio source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT_AUDIO_INPUT_VALUE}>Default System Microphone</SelectItem>
            {audioInputDevices
              .filter(device => device.deviceId) // Filter out devices with empty deviceIds
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
          value={String(settings.fftSize)}
          onValueChange={(val) => updateSetting('fftSize', Number(val) as typeof settings.fftSize)}
          disabled={isAudioToggling}
        >
          <SelectTrigger id="fftSize-select" aria-label="Select FFT Bins">
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

      <div className={cn("space-y-1 mt-3", settings.enableAgc && "opacity-50 pointer-events-none")}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor="gain-slider" className={cn(settings.enableAgc && "text-muted-foreground")}>
              Manual Gain ({settings.gain.toFixed(2)}) {settings.enableAgc && "(AGC Active)"}
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
          value={[settings.gain]}
          onValueChange={([val]) => updateSetting('gain', val)}
          disabled={settings.enableAgc || isAudioToggling}
          aria-label={`Manual Gain: ${settings.gain.toFixed(2)}${settings.enableAgc ? " (AGC Active)" : ""}`}
        />
      </div>
      
      <LabelledSwitchControl
        labelContent="Automatic Gain Control (AGC)"
        labelHtmlFor="agc-switch"
        switchId="agc-switch"
        checked={settings.enableAgc}
        onCheckedChange={(checked) => updateSetting('enableAgc', checked)}
        tooltipContent={<>
          <p>Automatically adjusts gain to maintain a consistent audio level.</p>
          {settings.enableAgc && <p className="text-xs text-primary">AGC is currently managing audio levels.</p>}
        </>}
        containerClassName="pt-2"
        switchAriaLabel="Toggle Automatic Gain Control"
        switchProps={{ disabled: isAudioToggling }}
      />
       <ControlHint>
        {settings.enableAgc ? "AGC is active. Manual gain is disabled." : "Adjust gain manually or enable AGC."}
      </ControlHint>

      <div className="mt-4">
        <LabelledSwitchControl
          labelContent="Monitor Audio (Playback to Speakers)"
          labelHtmlFor="monitor-audio-switch"
          switchId="monitor-audio-switch"
          checked={settings.monitorAudio}
          onCheckedChange={(checked) => updateSetting('monitorAudio', checked)}
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
