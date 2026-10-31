/** Two-tone wordmark: "Eng" in cream, "ram" in pink. */
export default function Logo({ size = 20 }: { size?: number }) {
  return (
    <span className="font-display font-bold uppercase leading-none tracking-[-0.035em]" style={{ fontSize: size }}>
      <span className="text-cream">Eng</span><span className="text-pink">ram</span>
    </span>
  );
}
