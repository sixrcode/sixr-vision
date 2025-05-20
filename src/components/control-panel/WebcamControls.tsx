"use client";

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/providers/SettingsProvider';
import { ControlPanelSection } from './ControlPanelSection';

export function WebcamControls() {
  const { settings, updateSetting } = useSettings();

  return (
    <ControlPanelSection title="Webcam Layer">
      <div className="flex items-center justify-between">
        <Label htmlFor="show-webcam-switch">Show Webcam</Label>
        <Switch
          id="show-webcam-switch"
          checked={settings.showWebcam}
          onCheckedChange={(checked) => updateSetting('showWebcam', checked)}
        />
      </div>
      {settings.showWebcam && (
        <div className="flex items-center justify-between mt-3">
          <Label htmlFor="mirror-webcam-switch">Mirror Webcam</Label>
          <Switch
            id="mirror-webcam-switch"
            checked={settings.mirrorWebcam}
            onCheckedChange={(checked) => updateSetting('mirrorWebcam', checked)}
          />
        </div>
      )}
      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">AI Segmentation: Placeholder</p>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">Motion Energy Scalar: Placeholder</p>
    </ControlPanelSection>
  );
}
