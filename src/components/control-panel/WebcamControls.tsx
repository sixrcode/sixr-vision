
"use client";

// WHY: Import the original useSettings hook for fallback.
import { useSettings as useSettingsContextHook } from '@/providers/SettingsProvider';
// WHY: Import the Zustand store for conditional usage.
import { useSettingsStore } from '@/store/settingsStore';
// WHY: Ensure component imports are absolute.
import { ControlPanelSection } from '@/components/control-panel/ControlPanelSection';
import { ControlHint } from '@/components/control-panel/ControlHint';
import { LabelledSwitchControl } from '@/components/control-panel/common/LabelledSwitchControl';
import type { Settings } from '@/types';

type WebcamControlsProps = {
  value: string; // For AccordionItem
};

export function WebcamControls({ value }: WebcamControlsProps) {
  // WHY: Feature flag to determine data source.
  const useZustand = process.env.NEXT_PUBLIC_USE_ZUSTAND === 'bundle-a';

  // Zustand state and actions
  const showWebcamFromStore = useSettingsStore(state => state.showWebcam);
  const mirrorWebcamFromStore = useSettingsStore(state => state.mirrorWebcam);
  const zustandUpdateSetting = useSettingsStore(state => state.updateSetting);

  // Context state and actions (fallback)
  const { settings: contextSettings, updateSetting: contextUpdateSetting } = useSettingsContextHook();

  // Determine current values based on feature flag
  const showWebcam = useZustand ? showWebcamFromStore : contextSettings.showWebcam;
  const mirrorWebcam = useZustand ? mirrorWebcamFromStore : contextSettings.mirrorWebcam;

  // Determine update function based on feature flag
  const handleUpdateSetting = <K extends keyof Settings>(key: K, val: Settings[K]) => {
    if (useZustand) {
      zustandUpdateSetting(key, val);
    } else {
      contextUpdateSetting(key, val);
    }
  };

  return (
    <ControlPanelSection title="Webcam Layer" value={value}>
      <LabelledSwitchControl
        labelContent="Show Webcam"
        labelHtmlFor="show-webcam-switch"
        switchId="show-webcam-switch"
        checked={showWebcam}
        onCheckedChange={(checked) => handleUpdateSetting('showWebcam', checked)}
        tooltipContent={<>
          <p>Toggles the webcam feed visibility in compatible scenes.</p>
          <p className="text-xs text-muted-foreground">Requires camera permission.</p>
        </>}
        switchAriaLabel="Toggle show webcam"
      />
      {showWebcam && (
        <LabelledSwitchControl
          labelContent="Mirror Webcam"
          labelHtmlFor="mirror-webcam-switch"
          switchId="mirror-webcam-switch"
          checked={mirrorWebcam}
          onCheckedChange={(checked) => handleUpdateSetting('mirrorWebcam', checked)}
          tooltipContent={<p>Flips the webcam image horizontally.</p>}
          containerClassName="mt-3"
          switchAriaLabel="Toggle mirror webcam"
        />
      )}
      <ControlHint className="mt-2">AI Segmentation (Planned Feature)</ControlHint>
      <ControlHint>Motion Energy Scalar (Planned Feature)</ControlHint>
    </ControlPanelSection>
  );
}
