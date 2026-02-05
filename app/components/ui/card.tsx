"use client";

export function Card({
  children,
  className = "",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-3xl border-2 border-[#E8E3DC] bg-white p-6 shadow-lg transition-all duration-300 hover:shadow-xl md:p-8 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
