// STUB — ADMIN2-43-06 Mode A; executor replaces with real impl
//
// Assumed prop signature (written against by the RED tests):
//
//   interface AnnouncementJsonViewProps {
//     title: string;
//     message: string;
//     linkUrl: string;
//   }
//
// The real component must:
// - Render a monospaced, readOnly shadcn <Textarea>
// - Its value is JSON.stringify({ title, message, link_url }, null, 2)
//   where link_url is always emitted (empty string when linkUrl is blank)
// - No Preview button; no parse/validate path

interface AnnouncementJsonViewProps {
  title: string;
  message: string;
  linkUrl: string;
}

export function AnnouncementJsonView(_props: AnnouncementJsonViewProps) {
  // Stub: renders an empty, non-readOnly textarea with no value.
  // - Specs 1/2/4 fail: JSON.parse("") throws — textarea has no serialized payload.
  // - Spec 3 fails: textarea lacks the readOnly attribute.
  return <textarea data-testid="announcement-json-view-textarea" />;
}
