import { auth } from "@/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { AppCredit } from "@/components/shared/app-credit";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user;

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Desktop Fixed Sidebar */}
      <div className="print:hidden">
        <Sidebar userRole={user?.role} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:pl-64 print:lg:pl-0 min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-6 print:pb-0">
        <div className="print:hidden">
          <Header user={user} />
        </div>
        <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 print:p-0 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
        <footer className="px-4 pb-4 lg:hidden print:hidden">
          <AppCredit />
        </footer>
      </div>

      {/* Mobile Sticky Bottom Navigation */}
      <div className="print:hidden">
        <BottomNav userRole={user?.role} />
      </div>
    </div>
  );
}
