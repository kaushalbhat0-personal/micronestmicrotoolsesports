import { MicronestLoader } from "@/components/ui/micronest-loader";

export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <MicronestLoader size="lg" label="MicroNest" />
    </div>
  );
}
