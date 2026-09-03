import Link from "next/link";

type HomeButtonProps = {
  className?: string;
};

const defaultClassName =
  "rounded-lg border border-slate-200 bg-white px-5 py-3 text-center text-sm font-black text-[#092046] transition hover:border-[#2f73b7] hover:bg-[#eaf3ff]";

export function HomeButton({ className = defaultClassName }: HomeButtonProps) {
  return (
    <Link href="/" className={className}>
      처음 화면
    </Link>
  );
}
