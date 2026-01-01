import { AnimatedGridBackground } from "@/components/ui/animated-background";
import { getPublicLoginBackground } from "@/actions/admin-actions";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const backgroundResult = await getPublicLoginBackground();
  const backgroundUrl = backgroundResult.success && backgroundResult.data 
    ? backgroundResult.data.backgroundUrl 
    : null;

  return (
    <div className="relative min-h-screen w-full">
      <AnimatedGridBackground backgroundUrl={backgroundUrl} />
      <div className="relative flex items-center justify-center min-h-screen w-full z-10">
        {children}
      </div>
    </div>
  );
}

