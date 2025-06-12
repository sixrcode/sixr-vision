
"use client";

// WHY: Import the Zustand store directly. The feature flag and context fallback are removed.
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
  // WHY: Directly use Zustand state and actions. The 'useZustand' feature flag is removed.
  const showWebcam = useSettingsStore(state => state.showWebcam);
  const mirrorWebcam = useSettingsStore(state => state.mirrorWebcam);
  const zustandUpdateSetting = useSettingsStore(state => state.updateSetting);

  // WHY: The context fallback (useSettingsContextHook) is removed.

  // WHY: Define a consistent handler function for updating settings using Zustand.
  const handleUpdateSetting = <K extends keyof Settings>(key: K, val: Settings[K]) => {
    zustandUpdateSetting(key, val);
  };

  return (
    <ControlPanelSection title="Webcam Layer" value={value}>
      <LabelledSwitchControl
        labelContent="Show Webcam"
        labelHtmlFor="show-webcam-switch"
        switchId="show-webcam-switch"
        checked={showWebcam} // WHY: Directly read from Zustand store.
        onCheckedChange={(checked) => handleUpdateSetting('showWebcam', checked)} // WHY: Directly use Zustand update function.
        tooltipContent={<>
          <p>Toggles the webcam feed visibility in compatible scenes.</p>
          <p className="text-xs text-muted-foreground">Requires camera permission.</p>
        </>}
        switchAriaLabel="Toggle show webcam"
      />
      {showWebcam && ( // WHY: Conditional rendering based on Zustand state.
        <LabelledSwitchControl
          labelContent="Mirror Webcam"
          labelHtmlFor="mirror-webcam-switch"
          switchId="mirror-webcam-switch"
          checked={mirrorWebcam} // WHY: Directly read from Zustand store.
          onCheckedChange={(checked) => handleUpdateSetting('mirrorWebcam', checked)} // WHY: Directly use Zustand update function.
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

