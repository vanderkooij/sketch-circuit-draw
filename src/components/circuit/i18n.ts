// Lightweight i18n for the circuit editor. Two locales, flat key→string map.
// Add new keys here and reference via t(lang, 'key').

export type Lang = 'en' | 'nl';

type Dict = Record<string, string>;

const en: Dict = {
  // Tools
  'tool.select': 'Select',
  'tool.voltage': 'DC voltage source (drag to canvas)',
  'tool.voltage_ac': 'AC voltage source (drag to canvas)',
  'tool.resistor': 'Resistor (drag to canvas)',
  'tool.led': 'LED (drag to canvas)',
  'tool.motor': 'Motor (drag to canvas)',
  'tool.lamp': 'Lamp (drag to canvas)',
  'tool.ammeter': 'Ammeter (drag to canvas)',
  'tool.voltmeter': 'Voltmeter (drag to canvas)',
  'tool.capacitor': 'Capacitor (drag to canvas)',
  'tool.inductor': 'Inductor (drag to canvas)',
  'tool.switch': 'Switch — double-click to toggle (drag to canvas)',
  'tool.diode': 'Diode (drag to canvas)',
  'tool.ground': 'Ground (drag to canvas)',
  'tool.potentiometer': 'Potentiometer (drag to canvas)',
  'tool.wire': 'Wire (W)',
  'tool.text': 'Text',
  'tool.delete': 'Delete',
  // Toolbar
  'group.basic': 'Basic',
  'group.sources': 'Sources',
  'group.loads': 'Loads',
  'group.meters': 'Meters',
  'group.advanced': 'Advanced',
  'btn.undo': 'Undo (Ctrl+Z)',
  'btn.redo': 'Redo (Ctrl+Shift+Z)',
  'btn.reset': 'Reset',
  'btn.resetConfirm': 'Clear the entire canvas?',
  'btn.more': 'More…',
  // Status hints
  'status.wire.placing': 'Click endpoint · Space = flip L direction ({orient}) · Esc to cancel',
  'status.wire.start': 'Click start → move in desired direction → click endpoint (space flips L)',
  'status.select.component': 'R / right-click = rotate · Delete = remove · Double-click switch = toggle',
  'status.select.wire': 'Drag nodes or segments · Double-click wire to add a node',
  'status.select.empty': 'Drag components from the toolbar · Double-click = new label · Esc = select tool · Alt+drag = pan · W = wire',
  'status.text': 'Click to place a label · Use ₁₂₃ ₜₒₜ ᵥ Ω for notation',
  'status.delete': 'Click an element to remove it',
  // Label editor
  'label.placeholder': 'R₁, U₂, Ω...',
  'label.quickInsert': 'Quick insert:',
};

const nl: Dict = {
  'tool.select': 'Selecteren',
  'tool.voltage': 'DC-spanningsbron (sleep naar canvas)',
  'tool.voltage_ac': 'AC-spanningsbron (sleep naar canvas)',
  'tool.resistor': 'Weerstand (sleep naar canvas)',
  'tool.led': 'LED (sleep naar canvas)',
  'tool.motor': 'Motor (sleep naar canvas)',
  'tool.lamp': 'Lamp (sleep naar canvas)',
  'tool.ammeter': 'Amperemeter (sleep naar canvas)',
  'tool.voltmeter': 'Voltmeter (sleep naar canvas)',
  'tool.capacitor': 'Condensator (sleep naar canvas)',
  'tool.inductor': 'Spoel (sleep naar canvas)',
  'tool.switch': 'Schakelaar — dubbelklik om te wisselen (sleep naar canvas)',
  'tool.diode': 'Diode (sleep naar canvas)',
  'tool.ground': 'Massa (sleep naar canvas)',
  'tool.potentiometer': 'Potmeter (sleep naar canvas)',
  'tool.wire': 'Draad (W)',
  'tool.text': 'Tekst',
  'tool.delete': 'Verwijderen',
  'group.basic': 'Basis',
  'group.sources': 'Bronnen',
  'group.loads': 'Belastingen',
  'group.meters': 'Meters',
  'group.advanced': 'Geavanceerd',
  'btn.undo': 'Ongedaan maken (Ctrl+Z)',
  'btn.redo': 'Opnieuw (Ctrl+Shift+Z)',
  'btn.reset': 'Wissen',
  'btn.resetConfirm': 'Het hele canvas wissen?',
  'btn.more': 'Meer…',
  'status.wire.placing': 'Klik eindpunt · Spatie = wissel L-richting ({orient}) · Esc om af te breken',
  'status.wire.start': 'Klik startpunt → beweeg in gewenste richting → klik eindpunt (spatie wisselt L-vorm)',
  'status.select.component': 'R / rechtermuisknop = roteren · Delete = verwijderen · Dubbelklik schakelaar = wisselen',
  'status.select.wire': 'Sleep nodes of segmenten · Dubbelklik wire om node toe te voegen',
  'status.select.empty': 'Sleep componenten uit de toolbar · Dubbelklik = nieuw tekstvak · Esc = select tool · Alt+drag = pan · W = wire',
  'status.text': 'Klik om label te plaatsen · Gebruik ₁₂₃ ₜₒₜ ᵥ Ω voor notatie',
  'status.delete': 'Klik op een element om het te verwijderen',
  'label.placeholder': 'R₁, U₂, Ω...',
  'label.quickInsert': 'Snel invoegen:',
};

const dicts: Record<Lang, Dict> = { en, nl };

export function t(lang: Lang, key: string, params?: Record<string, string>): string {
  let s = dicts[lang][key] ?? dicts.en[key] ?? key;
  if (params) for (const k of Object.keys(params)) s = s.replace(`{${k}}`, params[k]);
  return s;
}
