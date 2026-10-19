import { redirect } from "next/navigation";

export default async function PetaIndex({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { w } = await searchParams;
  redirect(`/peta/konflik${w ? `?w=${w}` : ""}`);
}
