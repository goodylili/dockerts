import { BiodataApp } from "@/components/biodata-app";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-indigo-600 uppercase dark:text-indigo-400">
          Biodata intake
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-balance text-slate-900 sm:text-4xl dark:text-slate-50">
          Record a person&rsquo;s biodata
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-slate-600 dark:text-slate-400">
          Fill in the details below. Age and BMI are calculated as you type, and
          each submission is saved exactly once — retrying after a network hiccup
          will never create a duplicate record.
        </p>
      </header>

      <BiodataApp />

      <footer className="mt-10 text-xs text-slate-400 dark:text-slate-500">
        Data is stored on the records service; this page never talks to it
        directly.
      </footer>
    </main>
  );
}
