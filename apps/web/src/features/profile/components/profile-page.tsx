import type { SessionUser } from "@repo/api-client";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/avatar";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { toast } from "@repo/ui/components/sonner";
import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { AppShell } from "../../app-shell/app-shell";
import { meQueryOptions } from "../../auth/hooks/use-auth";
import { useUpdateProfileMutation } from "../hooks/use-profile";
import { updateProfileSchema } from "@repo/contracts/profile";
import { SecuritySettings } from "./security-settings";

export function ProfilePage() {
  const user = useQuery(meQueryOptions);
  if (!user.data) return null;
  return <ProfileEditor key={user.data.id} currentUser={user.data} />;
}

function ProfileEditor({ currentUser }: { currentUser: SessionUser }) {
  const updateProfileMutation = useUpdateProfileMutation();
  const [name, setName] = useState(currentUser.name);
  const [image, setImage] = useState(currentUser.image ?? "");
  const validationError = validateProfile(name, image);
  const normalizedImage = image.trim() || null;
  const isDirty = name !== currentUser.name || normalizedImage !== (currentUser.image ?? null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (validationError) {
      return;
    }

    updateProfileMutation.mutate(
      {
        image: normalizedImage,
        name: name.trim(),
      },
      {
        onError: (error) => {
          const message = error instanceof Error ? error.message : "Failed to save profile.";
          toast.error(message);
        },
        onSuccess: (savedUser) => {
          setName(savedUser.name);
          setImage(savedUser.image ?? "");
          toast.success("Profile saved.");
        },
      },
    );
  }

  function handleReset() {
    setName(currentUser.name);
    setImage(currentUser.image ?? "");
  }

  return (
    <AppShell>
      <section className="grid gap-8">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-muted-foreground">Profile settings</p>
          <h1 className="text-3xl font-semibold text-balance">Edit profile</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Update the display details tied to your user account.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          <Card>
            <form onSubmit={handleSubmit}>
              <CardHeader>
                <CardTitle>Edit profile</CardTitle>
                <CardDescription>
                  Name is required. Avatar image is optional and must be a public URL.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5">
                <Field>
                  <FieldLabel htmlFor="profile-name">Display name</FieldLabel>
                  <Input
                    id="profile-name"
                    autoComplete="name"
                    value={name}
                    aria-invalid={Boolean(validationError)}
                    onChange={(event) => setName(event.target.value)}
                  />
                  <FieldDescription>
                    Use the name people should recognize in the product.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="profile-image">Avatar URL</FieldLabel>
                  <Input
                    id="profile-image"
                    inputMode="url"
                    placeholder="https://example.com/avatar.png"
                    value={image}
                    aria-invalid={Boolean(validationError)}
                    onChange={(event) => setImage(event.target.value)}
                  />
                  <FieldDescription>Leave empty to remove the avatar image.</FieldDescription>
                </Field>
                <FieldError>{validationError}</FieldError>
              </CardContent>
              <CardFooter className="mt-6 gap-3">
                <Button
                  type="submit"
                  disabled={!isDirty || Boolean(validationError) || updateProfileMutation.isPending}
                >
                  {updateProfileMutation.isPending ? "Saving..." : "Save profile"}
                </Button>
                <Button type="button" variant="outline" disabled={!isDirty} onClick={handleReset}>
                  Cancel
                </Button>
              </CardFooter>
            </form>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>A quick check before saving your changes.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-4">
              <Avatar className="size-20 rounded-xl">
                {normalizedImage ? (
                  <AvatarImage src={normalizedImage} alt={`${name || currentUser.name} avatar`} />
                ) : null}
                <AvatarFallback className="rounded-xl text-lg">
                  {getInitials(name || currentUser.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 gap-1">
                <p className="text-lg font-semibold">{name || currentUser.name}</p>
                <p className="text-sm text-muted-foreground">{currentUser.email}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <SecuritySettings
          twoFactorEnabled={Boolean(
            (currentUser as { twoFactorEnabled?: boolean }).twoFactorEnabled,
          )}
        />
      </section>
    </AppShell>
  );
}

function validateProfile(name: string, image: string) {
  const result = updateProfileSchema.safeParse({ name, image });
  if (result.success) return null;
  const issue = result.error.issues[0];
  if (issue?.path[0] === "name") {
    return issue.code === "too_big"
      ? "Display name must be 100 characters or fewer."
      : "Display name is required.";
  }
  return "Enter a valid http or https image URL.";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
