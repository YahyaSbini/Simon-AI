import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  size = 40,
  showName = true,
}: {
  className?: string;
  size?: number;
  showName?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <Image
        src="/logo.jpg"
        alt="Simon"
        width={size}
        height={size}
        className="rounded-full object-cover mix-blend-multiply"
        priority
      />
      {showName ? (
        <span className="font-heading text-xl tracking-tight">Simon</span>
      ) : null}
    </span>
  );
}
