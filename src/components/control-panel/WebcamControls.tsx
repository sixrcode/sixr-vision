
"use client";

// WHY: Import the original useSettings hook for fallback behavior.
import { useSettings } from '@/providers/SettingsProvider';
// WHY: Import the Zustand store for pilot mode.
import { useSettingsStore } from '@/store/settingsStore';
// WHY: Ensure component imports are absolute.
import { ControlPanelSection } from '@/components/control-panel/ControlPanelSection'; // WHY: This component is used to structure the section.
import { ControlHint } from '@/components/control-panel/ControlHint';
import { LabelledSwitchControl } from '@/components/control-panel/common/LabelledSwitchControl';
import type { Settings } from '@/types';

type WebcamControlsProps = {
  value: string; // For AccordionItem
};

export function WebcamControls({ value }: WebcamControlsProps) {
  // WHY: Determine if we are in 'pilot' mode for Zustand.
  const useZustand = process.env.NEXT_PUBLIC_USE_ZUSTAND === 'pilot';

  // WHY: Conditionally select settings source.
  // If in 'pilot' mode, use Zustand store. Otherwise, use React Context.
  const showWebcamFromStore = useZustand ? useSettingsStore(state => state.showWebcam) : undefined;
  const mirrorWebcamFromStore = useZustand ? useSettingsStore(state => state.mirrorWebcam) : undefined;
  const zustandUpdateSetting = useZustand ? useSettingsStore(state => state.updateSetting) : undefined;

  const { settings: contextSettings, updateSetting: contextUpdateSetting } = useSettings();

  // WHY: Consolidate settings and update function based on the mode.
  const showWebcam = useZustand ? showWebcamFromStore! : contextSettings.showWebcam;
  const mirrorWebcam = useZustand ? mirrorWebcamFromStore! : contextSettings.mirrorWebcam;
  const updateSettingToUse = useZustand ? zustandUpdateSetting! : contextUpdateSetting;


  // WHY: Type assertion for the updateSetting function.
  // This ensures that regardless of the source (Zustand or Context),
  // the function signature is compatible with what LabelledSwitchControl expects.
  const handleUpdateSetting = <K extends keyof Settings>(key: K, val: Settings[K]) => {
    updateSettingToUse(key, val);
  };


  return (
    <ControlPanelSection title="Webcam Layer" value={value}>
      <LabelledSwitchControl
        labelContent="Show Webcam"
        labelHtmlFor="show-webcam-switch"
        switchId="show-webcam-switch"
        // WHY: Read 'showWebcam' from the determined source (Zustand or Context).
        checked={showWebcam}
        // WHY: Update 'showWebcam' using the determined update function.
        onCheckedChange={(checked) => handleUpdateSetting('showWebcam', checked)}
        tooltipContent={<>
          <p>Toggles the webcam feed visibility in compatible scenes.</p>
          <p className="text-xs text-muted-foreground">Requires camera permission.</p>
        </>}
        switchAriaLabel="Toggle show webcam"
      />
      {/* WHY: Conditional rendering of 'Mirror Webcam' switch also uses the determined 'showWebcam' state. */}
      {showWebcam && (
        <LabelledSwitchControl
          labelContent="Mirror Webcam"
          labelHtmlFor="mirror-webcam-switch"
          switchId="mirror-webcam-switch"
          // WHY: Read 'mirrorWebcam' from the determined source.
          checked={mirrorWebcam}
          // WHY: Update 'mirrorWebcam' using the determined update function.
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
