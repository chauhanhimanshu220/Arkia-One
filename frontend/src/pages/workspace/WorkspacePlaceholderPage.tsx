interface WorkspacePlaceholderPageProps {
  title: string;
  description: string;
  highlights?: string[];
}

export const WorkspacePlaceholderPage = ({
  title,
  description,
  highlights = [],
}: WorkspacePlaceholderPageProps) => (
  <section className="space-y-6">
    <div className="workspace-hero rounded-[2rem] p-6 sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">{title}</h2>
          <p className="mt-4 text-base leading-7 text-zinc-600 dark:text-zinc-300">{description}</p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-black/50 dark:text-zinc-200">
          Not created yet
        </span>
      </div>
    </div>

    <div className="workspace-panel rounded-[2rem] p-6 sm:p-8">
      <h3 className="text-xl font-semibold text-zinc-900 dark:text-white">Not created yet</h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
        This finance workspace has been added to the sidebar and routing, but the full page UI has not been created yet.
      </p>
      {highlights.length > 0 ? (
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {highlights.map((item) => (
            <div key={item} className="rounded-2xl border border-zinc-200/80 bg-white/80 px-4 py-3 text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:bg-black/50 dark:text-zinc-200">
              {item}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  </section>
);
