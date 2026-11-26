import { LegacyAppSections, LegacySection } from './LegacyAppSections';

export function legacyTab(show: LegacySection) {
  return function LegacyTab() {
    return <LegacyAppSections show={show} />;
  };
}
