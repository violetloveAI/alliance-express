// Campus map props share the warm miniature materials used by neighbouring landmarks.
// The memory cards keep their separate hand-drawn story illustrations.
export const CAMPUS_LANDMARK_IDS = Object.freeze(['fitness', 'pe', 'physics', 'guitar']);

export function createCampusLandmark(id, element) {
  if (!CAMPUS_LANDMARK_IDS.includes(id)) return null;
  const group = element('g', {
    class: 'campus-landmark', 'data-campus': id, 'pointer-events': 'none',
  });
  group.append(element('image', {
    href: `${import.meta.env?.BASE_URL ?? './'}assets/${id}-landmark-v12.webp`,
    x: -125, y: -186, width: 250, height: 210,
    preserveAspectRatio: 'xMidYMax meet',
    'aria-hidden': 'true', class: 'landmark',
  }));
  return group;
}
