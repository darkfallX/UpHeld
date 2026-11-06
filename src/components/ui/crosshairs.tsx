/** Registration crosshairs at the four corners of the nearest `.crosshairs` frame. */
export function Crosshairs({ corners = ["tl", "tr", "bl", "br"] }: { corners?: Array<"tl" | "tr" | "bl" | "br"> }) {
  return (
    <>
      {corners.map((c) => (
        <span key={c} aria-hidden className={`xh ${c}`} />
      ))}
    </>
  );
}
