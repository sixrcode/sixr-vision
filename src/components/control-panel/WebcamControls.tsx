
"use client";

import { useSettings } from '@/providers/SettingsProvider';
import { ControlPanelSection } from './ControlPanelSection';
import { ControlHint } from './ControlHint';
import { LabelledSwitchControl } from './common/LabelledSwitchControl';

type WebcamControlsProps = {
  value: string; // For AccordionItem
};

export function WebcamControls({ value }: WebcamControlsProps) {
  const { settings, updateSetting } = useSettings();

  return (
    <ControlPanelSection title="Webcam Layer" value={value}>
      <LabelledSwitchControl
        labelContent="Show Webcam"
        labelHtmlFor="show-webcam-switch"
        switchId="show-webcam-switch"
        checked={settings.showWebcam}
        onCheckedChange={(checked) => updateSetting('showWebcam', checked)}
        tooltipContent={<>
          <p>Toggles the webcam feed visibility in compatible scenes.</p>
          <p className="text-xs text-muted-foreground">Requires camera permission.</p>
        </>}
        switchAriaLabel="Toggle show webcam"
      />
      {settings.showWebcam && (
        <LabelledSwitchControl
          labelContent="Mirror Webcam"
          labelHtmlFor="mirror-webcam-switch"
          switchId="mirror-webcam-switch"
          checked={settings.mirrorWebcam}
          onCheckedChange={(checked) => updateSetting('mirrorWebcam', checked)}
          tooltipContent={<p>Flips the webcam image horizontally.</p>}
          containerClassName="mt-3"
          switchAriaLabel="Toggle mirror webcam"
        />
      )}
      <ControlHint className="mt-2">AI Segmentation: Placeholder</ControlHint>
      <ControlHint>Motion Energy Scalar: Placeholder</ControlHint>
    </ControlPanelSection>
  );
}
