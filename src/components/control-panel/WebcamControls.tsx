
"use client";

// WHY: Import the original useSettings hook is no longer needed.
// import { useSettings as useSettingsContextHook } from '@/providers/SettingsProvider';
// WHY: Import the Zustand store directly.
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
  // WHY: Feature flag logic is removed. Component now always uses Zustand.
  // const useZustand = process.env.NEXT_PUBLIC_USE_ZUSTAND === 'pilot';

  // WHY: Directly select settings from the Zustand store.
  const showWebcam = useSettingsStore(state => state.showWebcam);
  const mirrorWebcam = useSettingsStore(state => state.mirrorWebcam);
  const zustandUpdateSetting = useSettingsStore(state => state.updateSetting);

  // WHY: Remove fallback to context settings.
  // const { settings: contextSettings, updateSetting: contextUpdateSetting } = useSettingsContextHook();
  // const showWebcam = useZustand ? showWebcamFromStore! : contextSettings.showWebcam;
  // const mirrorWebcam = useZustand ? mirrorWebcamFromStore! : contextSettings.mirrorWebcam;
  // const updateSettingToUse = useZustand ? zustandUpdateSetting! : contextUpdateSetting;


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
        // WHY: Read 'showWebcam' directly from Zustand store.
        checked={showWebcam}
        // WHY: Update 'showWebcam' using the Zustand update function.
        onCheckedChange={(checked) => handleUpdateSetting('showWebcam', checked)}
        tooltipContent={<>
          <p>Toggles the webcam feed visibility in compatible scenes.</p>
          <p className="text-xs text-muted-foreground">Requires camera permission.</p>
        </>}
        switchAriaLabel="Toggle show webcam"
      />
      {/* WHY: Conditional rendering based on 'showWebcam' from Zustand. */}
      {showWebcam && (
        <LabelledSwitchControl
          labelContent="Mirror Webcam"
          labelHtmlFor="mirror-webcam-switch"
          switchId="mirror-webcam-switch"
          // WHY: Read 'mirrorWebcam' directly from Zustand store.
          checked={mirrorWebcam}
          // WHY: Update 'mirrorWebcam' using the Zustand update function.
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
