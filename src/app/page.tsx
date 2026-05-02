import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          AI 客服
        </h1>
        <p className="text-zinc-600">
          7×24 在线，处理订单、物流、退换货与售后问题。
        </p>
        <Link
          href="/chat"
          className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          开始咨询
        </Link>
      </div>
    </main>
  );
}
