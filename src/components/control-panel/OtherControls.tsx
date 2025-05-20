
"use client";

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/providers/SettingsProvider';
import { ControlPanelSection } from './ControlPanelSection';
import { AlertTriangle, ZapOff, FileJson, Database } from 'lucide-react'; // Removed ListMusic as it's not used
import { toast } from '@/hooks/use-toast';

type OtherControlsProps = {
  value: string; // For AccordionItem
};

export function OtherControls({ value }: OtherControlsProps) {
  const { settings, updateSetting } = useSettings();

  const handleExportLog = () => {
    // Placeholder for CSV export from IndexedDB
    console.log("Export rehearsal log (placeholder)");
    toast({ title: "Export Log", description: "CSV export from IndexedDB is a placeholder." });
  };
  
  const handleLoadCueList = () => {
    // Placeholder for JSON Cue-list player
    console.log("Load JSON cue-list (placeholder)");
    toast({ title: "Load Cue List", description: "JSON cue-list player is a placeholder." });
  };


  return (
    <ControlPanelSection title="System & Safety" value={value}>
      <div className="flex items-center justify-between">
        <Label htmlFor="panic-mode-switch" className="flex items-center text-destructive flex-1 min-w-0 mr-2">
          <AlertTriangle className="mr-2 h-4 w-4" /> Panic Mode (Blackout)
        </Label>
        <Switch
          id="panic-mode-switch"
          checked={settings.panicMode}
          onCheckedChange={(checked) => updateSetting('panicMode', checked)}
          className="data-[state=checked]:bg-destructive"
        />
      </div>
      <div className="flex items-center justify-between mt-3">
        <Label htmlFor="logo-blackout-switch" className="flex items-center flex-1 min-w-0 mr-2">
          <ZapOff className="mr-2 h-4 w-4" /> Logo Blackout
        </Label>
        <Switch
          id="logo-blackout-switch"
          checked={settings.logoBlackout}
          onCheckedChange={(checked) => updateSetting('logoBlackout', checked)}
        />
      </div>
      
      <div className="mt-4 space-y-2">
        <Button variant="outline" size="sm" className="w-full" onClick={handleLoadCueList}>
          <FileJson className="mr-2 h-4 w-4" /> Load Cue List (JSON)
        </Button>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">Cue list player is a placeholder.</p>
        
        <Button variant="outline" size="sm" className="w-full" onClick={handleExportLog}>
          <Database className="mr-2 h-4 w-4" /> Export Rehearsal Log (CSV)
        </Button>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">IndexedDB logging & export are placeholders.</p>
      </div>

      <div className="mt-4">
        <h4 className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Placeholders for Advanced Features:</h4>
        <ul className="list-disc list-inside text-xs text-[hsl(var(--muted-foreground))] pl-2">
          <li>WebSocket / OSC API</li>
          <li>Art-Net Bridge</li>
          <li>Adaptive Watchdog (FPS Monitor)</li>
          <li>Photosensitive Flash Guard</li>
          <li>Real-time Frame-Time Heatmap</li>
          <li>Ctrl+Z Undo</li>
        </ul>
      </div>
    </ControlPanelSection>
  );
}
