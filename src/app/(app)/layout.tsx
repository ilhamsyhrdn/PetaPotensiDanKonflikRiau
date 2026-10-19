import TopNav from "@/components/TopNav";
import { wajibSesi } from "@/lib/sesi";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sesi = await wajibSesi();
  return (
    <div className="min-h-dvh">
      <TopNav sesi={sesi} />
      <main className="min-w-0">{children}</main>
    </div>
  );
}
