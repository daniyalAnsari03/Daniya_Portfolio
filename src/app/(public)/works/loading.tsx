export default function Loading() {
  return (
    <main className="relative">
      <div className="relative z-10 rounded-b-[16px] bg-background sm:rounded-b-[24px]">
        <section className="relative">
          <div className="relative">
            {/* Mirrors the pinned heading (centre at 36vh). */}
            <div className="pointer-events-none sticky top-[calc(var(--vh-sm)*0.36)] z-0 h-0">
              <div className="absolute inset-x-0 top-0 flex -translate-y-1/2 justify-center px-[2.6vw]">
                <div className="h-[clamp(40px,13vw,90px)] w-[70vw] animate-pulse rounded-2xl bg-charcoal/10 lg:h-[clamp(52px,9vw,190px)]" />
              </div>
            </div>

            <ul
              aria-hidden="true"
              className="relative z-10 flex flex-col gap-[calc(var(--vh-sm)*0.13)] px-[2.6vw] pt-[calc(var(--vh-sm)*0.85)] pb-[calc(var(--vh-sm)*0.26)]"
            >
              {[0, 1, 2].map((item) => (
                <li
                  key={item}
                  className={`flex ${item % 2 === 0 ? "justify-start" : "justify-end"}`}
                >
                  <div className="w-[88vw] lg:w-[35vw]">
                    <div className="aspect-[16/10] w-full animate-pulse rounded-[14px] bg-charcoal/10" />
                    <div className="mt-[14px] h-4 w-32 animate-pulse rounded bg-charcoal/10" />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div aria-hidden="true" className="h-[calc(var(--vh-sm)*0.18)]" />
        </section>
      </div>
    </main>
  );
}
