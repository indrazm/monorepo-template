import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ui/components/alert-dialog";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { toast } from "@repo/ui/components/sonner";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2Icon, Globe2Icon, PlusIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { AppShell } from "../../app-shell/app-shell";
import {
  sitesQueryOptions,
  useCreateSiteMutation,
  useDeleteSiteMutation,
} from "../hooks/use-sites";

export function SitesPage() {
  const sites = useQuery(sitesQueryOptions);

  return (
    <AppShell>
      <section className="grid gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Workspace</p>
            <h1 className="text-3xl font-extrabold tracking-tight">Sites</h1>
            <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
              A site is a domain where your Tacto pixel runs. Add one, install the snippet, then
              start showing notifications.
            </p>
          </div>
          <CreateSiteDialog />
        </div>

        {sites.isLoading ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Loading sites…
            </CardContent>
          </Card>
        ) : sites.data && sites.data.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {sites.data.map((site) => (
              <Card key={site.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Globe2Icon className="size-4 text-muted-foreground" />
                    {site.name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{site.domain}</p>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  {site.pixelVerifiedAt ? (
                    <Badge className="gap-1">
                      <CheckCircle2Icon className="size-3" /> Pixel verified
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Pixel not detected</Badge>
                  )}
                  <DeleteSiteButton id={site.id} name={site.name} />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Globe2Icon className="size-6" />
              </span>
              <div>
                <p className="font-semibold">No sites yet</p>
                <p className="text-sm text-muted-foreground">
                  Add your first site to get a pixel snippet and start showing proof.
                </p>
              </div>
              <CreateSiteDialog />
            </CardContent>
          </Card>
        )}
      </section>
    </AppShell>
  );
}

function CreateSiteDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const createSite = useCreateSiteMutation();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createSite.mutate(
      { name: name.trim(), domain: domain.trim() },
      {
        onSuccess: () => {
          toast.success("Site created");
          setName("");
          setDomain("");
          setOpen(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-fit">
          <PlusIcon className="size-4" /> New site
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>Add a site</DialogTitle>
            <DialogDescription>
              Give it a name and the domain where the pixel runs.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="site-name">Name</Label>
            <Input
              id="site-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="My store"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="site-domain">Domain</Label>
            <Input
              id="site-domain"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              placeholder="shop.example.com"
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createSite.isPending}>
              {createSite.isPending ? "Creating…" : "Create site"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteSiteButton({ id, name }: { id: string; name: string }) {
  const deleteSite = useDeleteSiteMutation();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the site and its notifications. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              deleteSite.mutate(id, {
                onSuccess: () => toast.success("Site deleted"),
                onError: (error) => toast.error(error.message),
              })
            }
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
