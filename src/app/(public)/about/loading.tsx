export default function Loading() {
  return (
    <main className="relative">
      <div className="relative z-10 rounded-b-[16px] bg-background sm:rounded-b-[24px]">
        <section aria-hidden="true" className="px-6 pt-[calc(var(--vh-sm)*0.2)] sm:px-8 lg:px-12 lg:pt-[calc(var(--vh-sm)*0.24)]">
          <div className="mx-auto max-w-[1400px] space-y-4">
            <div className="h-[12vw] w-[80vw] max-w-[760px] animate-pulse rounded-xl bg-charcoal/10 md:h-32" />
            <div className="h-[4vw] w-[40vw] max-w-[320px] animate-pulse rounded bg-charcoal/10 md:h-10" />
          </div>
        </section>

        <div className="mt-[calc(var(--vh-sm)*0.1)] flex gap-4 overflow-hidden px-6 sm:px-8 lg:px-12">
          {[0, 1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="aspect-[3/4] w-[62vw] shrink-0 animate-pulse rounded-[12px] bg-charcoal/10 sm:w-[34vw] lg:w-[19vw]"
            />
          ))}
        </div>

        <section aria-hidden="true" className="px-6 pt-[calc(var(--vh-sm)*0.14)] sm:px-8 lg:px-12">
          <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="h-24 animate-pulse rounded-xl bg-charcoal/10 lg:col-span-7" />
            <div className="aspect-[4/5] animate-pulse rounded-xl bg-charcoal/10 lg:col-span-5" />
          </div>
        </section>
      </div>
    </main>
  );
}
