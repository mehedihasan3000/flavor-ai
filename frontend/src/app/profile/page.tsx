import type { Metadata } from "next";
import { AuthGuard } from "@/components/auth";
import { ProfileForm } from "@/components/profile/profile-form";

export const metadata: Metadata = {
  title: "Profile & Preferences",
  description:
    "Manage your FlavorAI display name, avatar, bio, dietary preferences, allergies, and nutrition goals.",
};

export default function ProfilePage() {
  return (
    <AuthGuard message="Sign in to view and manage your FlavorAI profile and dietary preferences.">
      <section className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-heading">
            Profile &amp; preferences
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Manage your public details and the food preferences used to personalize your recipes.
          </p>
        </header>
        <ProfileForm />
      </section>
    </AuthGuard>
  );
}

