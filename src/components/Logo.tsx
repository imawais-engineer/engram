export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="grid place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-2 font-bold text-white shadow-lg shadow-brand/30"
        style={{ width: size, height: size, fontSize: size * 0.5 }}
      >
        N
      </div>
      <span className="font-semibold tracking-tight text-zinc-100">
        Note<span className="text-brand">Mind</span>
      </span>
    </div>
  );
}
