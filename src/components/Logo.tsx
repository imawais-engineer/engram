/** Two-tone wordmark: "Eng" in cream, "ram" in the violet→cyan gradient. */
export default function Logo({ size = 20 }: { size?: number }) {
  return (
    <span className="font-display font-bold leading-none tracking-[-0.04em]" style={{ fontSize: size }}>
      <span className="text-cream">Eng</span><span className="text-grad">ram</span>
    </span>
  );
}
