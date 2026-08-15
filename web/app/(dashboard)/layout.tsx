import { Sidebar } from "@/components/sidebar";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <KeyboardShortcuts />

      {/* Main content area — offset by sidebar width on desktop */}
      <main className="md:pl-64">
        {/* Mobile top bar spacer */}
        <div className="h-14 md:hidden" />

        <div className="p-4 md:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
