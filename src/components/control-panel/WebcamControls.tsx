
"use client";

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/providers/SettingsProvider';
import { ControlPanelSection } from './ControlPanelSection';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

type WebcamControlsProps = {
  value: string; // For AccordionItem
};

export function WebcamControls({ value }: WebcamControlsProps) {
  const { settings, updateSetting } = useSettings();

  return (
    <ControlPanelSection title="Webcam Layer" value={value}>
      <div className="flex items-center justify-between">
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor="show-webcam-switch" className="flex-1 min-w-0 mr-2">Show Webcam</Label>
          </TooltipTrigger>
          <TooltipContent>
            <p>Toggles the webcam feed visibility in compatible scenes.</p>
            <p className="text-xs text-muted-foreground">Requires camera permission.</p>
          </TooltipContent>
        </Tooltip>
        <Switch
          id="show-webcam-switch"
          checked={settings.showWebcam}
          onCheckedChange={(checked) => updateSetting('showWebcam', checked)}
        />
      </div>
      {settings.showWebcam && (
        <div className="flex items-center justify-between mt-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Label htmlFor="mirror-webcam-switch" className="flex-1 min-w-0 mr-2">Mirror Webcam</Label>
            </TooltipTrigger>
            <TooltipContent>
              <p>Flips the webcam image horizontally.</p>
            </TooltipContent>
          </Tooltip>
          <Switch
            id="mirror-webcam-switch"
            checked={settings.mirrorWebcam}
            onCheckedChange={(checked) => updateSetting('mirrorWebcam', checked)}
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-2">AI Segmentation: Placeholder</p>
      <p className="text-xs text-muted-foreground">Motion Energy Scalar: Placeholder</p>
    </ControlPanelSection>
  );
}
